import "dotenv/config";
import express from "express";
import { createServer as createViteServer } from "vite";
import axios, { AxiosError } from "axios";
import { spawn } from "child_process";
import { writeFile, unlink } from "fs/promises";
import path from "path";
import os from "os";
import { fileURLToPath } from "url";
import multer from "multer";
import { generateFilledPdf } from "./generatePdf.js";
import { generateXmlFromBundle } from "./generateXmlBackend.js";
import pg from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "./generated/prisma/client.js";

const { Pool } = pg;
const prisma: PrismaClient | null = process.env.DATABASE_URL
  ? new PrismaClient({ adapter: new PrismaPg(new Pool({ connectionString: process.env.DATABASE_URL })) })
  : null;
if (!prisma) console.warn("[DB] DATABASE_URL not set – running without database");

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Multer — súbory len v pamäti (ukladáme do DB)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // max 10MB na súbor
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === "application/pdf") cb(null, true);
    else cb(new Error("Povolené sú len PDF súbory"));
  },
});

// ── XML Validácia cez validate_xml.py ────────────────────────────────────────
async function validateXml(xmlString: string, typ: "vyslanie" | "uplatnitelna"): Promise<{ valid: boolean; errors: string[] }> {
  const tmpXml = path.join(os.tmpdir(), `validate-${Date.now()}.xml`);
  try {
    await writeFile(tmpXml, xmlString, "utf-8");
    const scriptPath = path.join(__dirname, "validate_xml.py");
    const result = await new Promise<string>((resolve, reject) => {
      const proc = spawn("python3", [scriptPath, tmpXml, typ]);
      let out = "";
      let err = "";
      proc.stdout.on("data", (d) => { out += d.toString(); });
      proc.stderr.on("data", (d) => { err += d.toString(); });
      proc.on("close", (code) => {
        if (out) resolve(out);
        else reject(new Error(err || `Validácia zlyhala s kódom ${code}`));
      });
      proc.on("error", reject);
    });
    return JSON.parse(result);
  } catch (e: any) {
    return { valid: false, errors: [`Chyba validácie: ${e.message}`] };
  } finally {
    await unlink(tmpXml).catch(() => {});
  }
}

// ── Retry with exponential backoff — handles 429 rate limit from api.statistics.sk ──
async function fetchWithRetry(
  url: string,
  maxRetries = 4,
  baseDelayMs = 1000
): Promise<any> {
  let lastError: any;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await axios.get(url, {
        headers: {
          Accept: "application/json",
          "User-Agent": "Mozilla/5.0",
        },
        timeout: 15000,
      });
      return response.data;
    } catch (err) {
      const axiosErr = err as AxiosError;
      const status = axiosErr.response?.status;
      lastError = err;
      const shouldRetry = status === 429 || (status !== undefined && status >= 500);
      if (!shouldRetry || attempt === maxRetries) break;
      const retryAfter = axiosErr.response?.headers?.["retry-after"];
      const delayMs = retryAfter
        ? parseInt(retryAfter) * 1000
        : baseDelayMs * Math.pow(2, attempt) + Math.random() * 500;
      console.log(`[Server] RPO attempt ${attempt + 1} failed (${status}), retrying in ${Math.round(delayMs)}ms...`);
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  throw lastError;
}

async function startServer() {
  const app = express();
  const PORT = parseInt(process.env.PORT || "3000", 10);

  app.use(express.json({ limit: "10mb" }));

  // ── API routes ───────────────────────────────────────────────────────────

  app.get("/api/rpo/entity", async (req, res) => {
    try {
      const { ico } = req.query;
      if (!ico) return res.status(400).json({ error: "Missing ICO" });

      const searchUrl = `https://api.statistics.sk/rpo/v1/search?identifier=${ico}`;
      console.log(`[Server] RPO Combined: Searching for ICO ${ico}`);
      const searchData = await fetchWithRetry(searchUrl);

      if (!searchData.results?.length)
        return res.status(404).json({ error: "Organization not found" });

      const entityId = searchData.results[0].id;
      if (!entityId)
        return res.status(404).json({ error: "Entity ID not found" });

      const detailUrl = `https://api.statistics.sk/rpo/v1/entity/${entityId}?showHistoricalData=true&showOrganizationUnits=true`;
      console.log(`[Server] RPO Combined: Fetching detail for ID ${entityId}`);
      const detailData = await fetchWithRetry(detailUrl);
      res.json(detailData);
    } catch (error: any) {
      const status = error.response?.status;
      const message = status === 429
        ? "RPO API dočasne obmedzuje požiadavky (rate limit). Skúste za chvíľu."
        : "Failed to fetch entity from RPO";
      console.error("[Server] RPO Combined Error:", error.message);
      res.status(status || 500).json({
        error: message,
        details: error.response?.data || error.message,
      });
    }
  });

  app.get("/api/rpo/search", async (req, res) => {
    try {
      const { identifier } = req.query;
      if (!identifier) return res.status(400).json({ error: "Missing identifier" });
      const data = await fetchWithRetry(
        `https://api.statistics.sk/rpo/v1/search?identifier=${identifier}`
      );
      res.json(data);
    } catch (error: any) {
      res.status(error.response?.status || 500).json({
        error: "Failed to fetch from RPO",
        details: error.response?.data || error.message,
      });
    }
  });

  app.get("/api/rpo/detail/:id", async (req, res) => {
    try {
      const { id } = req.params;
      if (!id) return res.status(400).json({ error: "Missing ID" });
      const data = await fetchWithRetry(
        `https://api.statistics.sk/rpo/v1/entity/${id}?showHistoricalData=true&showOrganizationUnits=true`
      );
      res.json(data);
    } catch (error: any) {
      res.status(error.response?.status || 500).json({
        error: "Failed to fetch entity detail",
        details: error.response?.data || error.message,
      });
    }
  });

  app.post("/api/validate-xml", async (req, res) => {
    try {
      const { xml, typ } = req.body as { xml: string; typ: "vyslanie" | "uplatnitelna" };
      if (!xml || !typ) return res.status(400).json({ error: "Chýba xml alebo typ" });
      const result = await validateXml(xml, typ);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ valid: false, errors: [err.message] });
    }
  });

  // ── POST /api/submit — podanie žiadosti s prílohami ─────────────────────
  app.post("/api/submit", upload.array("attachments", 20), async (req, res) => {
    try {
      if (!prisma) return res.status(503).json({ error: "Databáza nie je nakonfigurovaná" });

      // formData príde ako JSON string v poli "formData"
      let formData: any;
      try {
        formData = JSON.parse(req.body.formData);
      } catch {
        return res.status(400).json({ error: "Neplatný formát formData" });
      }

      const formType = req.body.formType as string;
      if (!["PD_A1", "UPLATNITELNA_LEGISLATIVA"].includes(formType)) {
        return res.status(400).json({ error: "Neplatný typ formulára" });
      }

      const files = (req.files as Express.Multer.File[]) || [];

      // Parsuj metadata príloh (názov typu pre každý súbor)
      let attachmentMeta: { attachmentType: string }[] = [];
      try {
        attachmentMeta = JSON.parse(req.body.attachmentMeta || "[]");
      } catch {
        attachmentMeta = files.map(() => ({ attachmentType: "ine" }));
      }

      const bundle = await prisma.documentBundle.create({
        data: {
          formType: formType as any,
          status: "NEW",
          ico: formData.ico || "",
          companyName: formData.obchodneMeno || "",
          applicantName: `${formData.meno || ""} ${formData.priezvisko || ""}`.trim(),
          formData: formData,
          attachments: {
            create: files.map((file, i) => ({
              fileName: file.originalname,
              attachmentType: attachmentMeta[i]?.attachmentType || "ine",
              mimeType: file.mimetype,
              sizeBytes: file.size,
              data: file.buffer,
            })),
          },
        },
        include: { attachments: { select: { id: true, fileName: true, attachmentType: true, sizeBytes: true } } },
      });

      console.log(`[DB] Žiadosť uložená: ${bundle.id} (${formType}, ${files.length} príloh)`);
      res.json({ success: true, id: bundle.id, attachments: bundle.attachments });
    } catch (err: any) {
      console.error("[DB] submit failed:", err.message);
      res.status(500).json({ error: "Chyba pri ukladaní žiadosti", details: err.message });
    }
  });

  app.post("/api/generate-pdf", async (req, res) => {
    try {
      const pdfBuffer = await generateFilledPdf(req.body);
      res.set({
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="ziadost-A1-SZCO.pdf"`,
        "Content-Length": pdfBuffer.length,
      });
      res.send(pdfBuffer);
    } catch (err: any) {
      console.error("[PDF] Generation failed:", err.message);
      res.status(500).json({ error: "PDF generation failed", details: err.message });
    }
  });

  app.get("/api/bundles", async (_req, res) => {
    try {
      if (!prisma) return res.status(503).json({ error: "Database not configured" });
      const bundles = await prisma.documentBundle.findMany({
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          createdAt: true,
          formType: true,
          status: true,
          ico: true,
          companyName: true,
          applicantName: true,
          _count: { select: { attachments: true } },
        },
      });
      res.json(bundles);
    } catch (err: any) {
      console.error("[DB] Failed to fetch bundles:", err.message);
      res.status(500).json({ error: "Failed to fetch bundles", details: err.message });
    }
  });

  app.get("/api/bundles/:id", async (req, res) => {
    try {
      if (!prisma) return res.status(503).json({ error: "Database not configured" });
      const bundle = await prisma.documentBundle.findUnique({
        where: { id: req.params.id },
        include: {
          attachments: {
            select: { id: true, fileName: true, attachmentType: true, mimeType: true, sizeBytes: true, createdAt: true },
          },
        },
      });
      if (!bundle) return res.status(404).json({ error: "Bundle not found" });
      res.json(bundle);
    } catch (err: any) {
      console.error("[DB] Failed to fetch bundle:", err.message);
      res.status(500).json({ error: "Failed to fetch bundle", details: err.message });
    }
  });

  // Stiahnutie prílohy podľa ID
  // ── Admin endpointy ──────────────────────────────────────────────────────

  // Zmena stavu žiadosti
  app.patch("/api/bundles/:id/status", async (req, res) => {
    try {
      if (!prisma) return res.status(503).json({ error: "Database not configured" });
      const { status } = req.body;
      const valid = ['NEW', 'REVIEWED', 'SUBMITTED', 'COMPLETED'];
      if (!valid.includes(status)) return res.status(400).json({ error: "Neplatný stav" });
      await prisma.documentBundle.update({ where: { id: req.params.id }, data: { status } });
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Uloženie admin poznámky
  app.patch("/api/bundles/:id/note", async (req, res) => {
    try {
      if (!prisma) return res.status(503).json({ error: "Database not configured" });
      const { adminNote } = req.body;
      await prisma.documentBundle.update({ where: { id: req.params.id }, data: { adminNote } });
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Generovanie XML zo žiadosti v DB
  app.post("/api/bundles/:id/generate-xml", async (req, res) => {
    try {
      if (!prisma) return res.status(503).json({ error: "Database not configured" });
      const bundle = await prisma.documentBundle.findUnique({ where: { id: req.params.id } });
      if (!bundle) return res.status(404).json({ error: "Žiadosť nenájdená" });

      const formData = bundle.formData as any;
      const xml = generateXmlFromBundle(bundle.formType, formData);

      // Uloži xmlContent do DB
      await prisma.documentBundle.update({
        where: { id: req.params.id },
        data: { xmlContent: xml },
      });

      console.log(`[XML] Vygenerovaný XML pre bundle ${bundle.id} (${bundle.formType})`);
      res.json({ success: true, xml });
    } catch (err: any) {
      console.error("[XML] generate-xml failed:", err.message);
      res.status(500).json({ error: err.message });
    }
  });

  // Stiahnutie ZIP balíka (XML + prílohy)
  app.get("/api/bundles/:id/zip", async (req, res) => {
    try {
      if (!prisma) return res.status(503).json({ error: "Database not configured" });
      const bundle = await prisma.documentBundle.findUnique({
        where: { id: req.params.id },
        include: { attachments: true },
      });
      if (!bundle) return res.status(404).json({ error: "Žiadosť nenájdená" });

      // Dynamický import archiver
      const archiver = (await import("archiver")).default;
      res.set({
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="ziadost-${bundle.ico}-${bundle.id.slice(0, 8)}.zip"`,
      });

      const archive = archiver("zip");
      archive.pipe(res);

      // Pridaj XML ak existuje
      if (bundle.xmlContent) {
        archive.append(bundle.xmlContent, { name: `ziadost-${bundle.ico}.xml` });
      }

      // Pridaj prílohy
      for (const att of bundle.attachments) {
        archive.append(Buffer.from(att.data), { name: att.fileName });
      }

      await archive.finalize();
    } catch (err: any) {
      console.error("[ZIP] Error:", err.message);
      if (!res.headersSent) res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/attachments/:id", async (req, res) => {
    try {
      if (!prisma) return res.status(503).json({ error: "Database not configured" });
      const att = await prisma.attachment.findUnique({ where: { id: req.params.id } });
      if (!att) return res.status(404).json({ error: "Príloha nenájdená" });
      res.set({
        "Content-Type": att.mimeType,
        "Content-Disposition": `attachment; filename="${att.fileName}"`,
        "Content-Length": att.sizeBytes,
      });
      res.send(att.data);
    } catch (err: any) {
      res.status(500).json({ error: "Chyba pri sťahovaní prílohy", details: err.message });
    }
  });

  // ── Static / Vite ────────────────────────────────────────────────────────
  if (process.env.NODE_ENV === "production") {
    app.use(express.static("dist"));
    app.get("/admin", (_req, res) => res.sendFile("admin/index.html", { root: "dist" }));
    app.get("/admin/*splat", (_req, res) => res.sendFile("admin/index.html", { root: "dist" }));
    app.get("/{*splat}", (_req, res) => {
      res.sendFile("index.html", { root: "dist" });
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "custom",
    });
    app.use(vite.middlewares);

    // Admin stránka v dev móde
    app.get("/admin", async (_req, res) => {
      const { readFile } = await import("fs/promises");
      let html = await readFile(path.join(__dirname, "admin/index.html"), "utf-8");
      html = await vite.transformIndexHtml("/admin/index.html", html);
      res.status(200).set({ "Content-Type": "text/html" }).end(html);
    });

    // Hlavná SPA
    app.get("/{*splat}", async (req, res) => {
      const { readFile } = await import("fs/promises");
      let html = await readFile(path.join(__dirname, "index.html"), "utf-8");
      html = await vite.transformIndexHtml(req.originalUrl, html);
      res.status(200).set({ "Content-Type": "text/html" }).end(html);
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();