import express from "express";
import { createServer as createViteServer } from "vite";
import axios, { AxiosError } from "axios";
import { spawn } from "child_process";
import { writeFile, unlink } from "fs/promises";
import path from "path";
import os from "os";
import { fileURLToPath } from "url";
import { generateFilledPdf } from "./generatePdf.js";
import pg from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "./generated/prisma/client.js";

const { Pool } = pg;
const prisma: PrismaClient | null = process.env.DATABASE_URL
  ? new PrismaClient({ adapter: new PrismaPg(new Pool({ connectionString: process.env.DATABASE_URL })) })
  : null;
if (!prisma) console.warn("[DB] DATABASE_URL not set – running without database");

const __dirname = path.dirname(fileURLToPath(import.meta.url));

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

  app.post("/api/generate-xml-a1", async (req, res) => {
    try {
      if (!prisma) return res.status(503).json({ error: "Database not configured" });
      const { xmlContent = "", ...formData } = req.body;
      const bundle = await prisma.documentBundle.create({
        data: {
          formType: "PD_A1",
          status: "GENERATED",
          ico: formData.ico || "",
          companyName: formData.obchodneMeno || "",
          xmlContent,
          metadata: req.body,
        },
      });
      res.json({ success: true, id: bundle.id });
    } catch (err: any) {
      console.error("[DB] generate-xml-a1 failed:", err.message);
      res.status(500).json({ error: "Failed to save bundle", details: err.message });
    }
  });

  app.post("/api/generate-xml-uplatnitelna", async (req, res) => {
    try {
      if (!prisma) return res.status(503).json({ error: "Database not configured" });
      const { xmlContent = "", ...formData } = req.body;
      const bundle = await prisma.documentBundle.create({
        data: {
          formType: "UPLATNITELNA_LEGISLATIVA",
          status: "GENERATED",
          ico: formData.ico || "",
          companyName: formData.obchodneMeno || "",
          xmlContent,
          metadata: req.body,
        },
      });
      res.json({ success: true, id: bundle.id });
    } catch (err: any) {
      console.error("[DB] generate-xml-uplatnitelna failed:", err.message);
      res.status(500).json({ error: "Failed to save bundle", details: err.message });
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
      });
      if (!bundle) return res.status(404).json({ error: "Bundle not found" });
      res.json(bundle);
    } catch (err: any) {
      console.error("[DB] Failed to fetch bundle:", err.message);
      res.status(500).json({ error: "Failed to fetch bundle", details: err.message });
    }
  });

  // ── Static / Vite ────────────────────────────────────────────────────────
  if (process.env.NODE_ENV === "production") {
    app.use(express.static("dist"));
    app.get("/{*splat}", (_req, res) => {
      res.sendFile("index.html", { root: "dist" });
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();