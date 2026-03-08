import express from "express";
import { createServer as createViteServer } from "vite";
import axios from "axios";
import { generateFilledPdf } from "./generatePdf.js";

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
      }
    }
    console.log(`[Server] Using direct Axios request for: ${url}`);
    const response = await axios.get(url, {
      headers: {
        Accept: "application/json",
        "User-Agent": "Mozilla/5.0",
      },
    });
    return response.data;
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
      console.error("[Server] RPO Combined Error:", error.message);
      res.status(error.response?.status || 500).json({
        error: "Failed to fetch entity from RPO",
        details: error.response?.data || error.message,
      });
    }
  });

  app.get("/api/rpo/search", async (req, res) => {
    try {
      const { identifier } = req.query;
      if (!identifier) return res.status(400).json({ error: "Missing identifier" });
      const apiUrl = `https://api.statistics.sk/rpo/v1/search?identifier=${identifier}`;
      const data = await fetchData(apiUrl, process.env.BROWSERLESS_API_KEY);
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
      const apiUrl = `https://api.statistics.sk/rpo/v1/entity/${id}?showHistoricalData=true&showOrganizationUnits=true`;
      const data = await fetchData(apiUrl, process.env.BROWSERLESS_API_KEY);
      res.json(data);
    } catch (error: any) {
      res.status(error.response?.status || 500).json({
        error: "Failed to fetch entity detail",
        details: error.response?.data || error.message,
      });
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
    // SPA fallback
    app.get("*", (_req, res) => {
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
