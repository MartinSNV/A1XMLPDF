import express from "express";
import { createServer as createViteServer } from "vite";
import axios, { AxiosError } from "axios";
import { spawn } from "child_process";
import { writeFile, unlink } from "fs/promises";
import path from "path";
import os from "os";
import { fileURLToPath } from "url";
import { generateFilledPdf } from "./generatePdf.js";

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

// Retry with exponential backoff — handles 429 rate limit from api.statistics.sk
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

  // ── Helper: fetch with optional Browserless proxy ────────────────────────
  const fetchData = async (url: string, browserlessToken?: string) => {
    if (browserlessToken && browserlessToken.trim().length > 0) {
      console.log(`[Server] Attempting Browserless proxy for: ${url}`);
      try {
        const browserlessUrl = `https://chrome.browserless.io/content?token=${browserlessToken}`;
        const response = await axios.post(browserlessUrl, {
          url,
          waitFor: "networkidle0",
          setJavaScriptEnabled: true,
        }, {
          headers: { "Content-Type": "application/json" },
          timeout: 40000,
        });
        if (response.data) {
          const content = response.data;
          const jsonMatch = content.match(/\{[\s\S]*\}/);
          const jsonStr = jsonMatch ? jsonMatch[0] : content;
          try {
            return JSON.parse(jsonStr);
          } catch {
            const bodyMatch = content.match(/<body[^>]*>([\s\S]*)<\/body>/i);
            const bodyText = bodyMatch
              ? bodyMatch[1].replace(/<[^>]*>/g, "").trim()
              : content.replace(/<[^>]*>/g, "").trim();
            return JSON.parse(bodyText);
          }
        }
        throw new Error("No content returned from Browserless");
      } catch (error: any) {
        console.error(`[Server] Browserless failed: ${error.message}`);
        // fallthrough to direct request with retry
      }
    }
    // Direct request with retry logic (handles 429)
    return fetchWithRetry(url);
  };

  // ── API routes ───────────────────────────────────────────────────────────

  app.get("/api/rpo/entity", async (req, res) => {
    try {
      const { ico } = req.query;
      if (!ico) return res.status(400).json({ error: "Missing ICO" });

      const searchUrl = `https://api.statistics.sk/rpo/v1/search?identifier=${ico}`;
      console.log(`[Server] RPO Combined: Searching for ICO ${ico}`);
      const searchData = await fetchData(searchUrl, process.env.BROWSERLESS_API_KEY);

      if (!searchData.results?.length)
        return res.status(404).json({ error: "Organization not found" });

      const entityId = searchData.results[0].id;
      if (!entityId)
        return res.status(404).json({ error: "Entity ID not found" });

      const detailUrl = `https://api.statistics.sk/rpo/v1/entity/${entityId}?showHistoricalData=true&showOrganizationUnits=true`;
      console.log(`[Server] RPO Combined: Fetching detail for ID ${entityId}`);
      const detailData = await fetchData(detailUrl, process.env.BROWSERLESS_API_KEY);
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
      const data = await fetchData(
        `https://api.statistics.sk/rpo/v1/search?identifier=${identifier}`,
        process.env.BROWSERLESS_API_KEY
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
      const data = await fetchData(
        `https://api.statistics.sk/rpo/v1/entity/${id}?showHistoricalData=true&showOrganizationUnits=true`,
        process.env.BROWSERLESS_API_KEY
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
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();