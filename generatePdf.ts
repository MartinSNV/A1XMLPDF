// generatePdf.ts
// Fills the A1 PDF form by calling fill_a1_pdf.py (pypdf — full Unicode support).
// Detects Python on Windows (py/python/python3) and Linux/macOS (python3/python).

import { spawn } from "child_process";
import { writeFile, readFile, unlink } from "fs/promises";
import path from "path";
import os from "os";
import { fileURLToPath } from "url";

import type { FormDataState } from "./types.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const SCRIPT_PATH = path.join(__dirname, "fill_a1_pdf.py");
const PDF_SOURCE  = path.join(__dirname, "public", "a1-form.pdf");

// ── Run a shell command ───────────────────────────────────────────────────────
function run(cmd: string): Promise<{ stdout: string; stderr: string; code: number }> {
  return new Promise((resolve) => {
    const proc = spawn(cmd, { shell: true });
    let stdout = "";
    let stderr = "";
    proc.stdout.on("data", (d) => { stdout += d.toString(); });
    proc.stderr.on("data", (d) => { stderr += d.toString(); });
    proc.on("close", (code) => resolve({ stdout, stderr, code: code ?? 1 }));
    proc.on("error", (err) => resolve({ stdout, stderr: err.message, code: 1 }));
  });
}

// ── Find Python ───────────────────────────────────────────────────────────────
let cachedPython: string | null = null;

async function findPython(): Promise<string> {
  if (cachedPython) return cachedPython;

  const candidates = os.platform() === "win32"
    ? ["py", "python", "python3"]
    : ["python3", "python"];

  for (const cmd of candidates) {
    const { stdout, stderr, code } = await run(`${cmd} --version`);
    const ver = (stdout + stderr).trim();
    if (code === 0 && ver) {
      console.log(`[PDF] Python: ${cmd} → ${ver}`);
      cachedPython = cmd;
      return cmd;
    }
  }

  throw new Error(
    "Python nie je nainštalovaný alebo nie je v PATH.\n" +
    "Nainštalujte Python 3 z https://www.python.org\n" +
    "a spustite: pip install pypdf"
  );
}

// ── Check pypdf ───────────────────────────────────────────────────────────────
async function ensurePypdf(python: string): Promise<void> {
  const { code, stderr } = await run(`${python} -c "import pypdf"`);
  if (code !== 0) {
    throw new Error(
      `Knižnica 'pypdf' nie je nainštalovaná.\n` +
      `Spustite: ${python} -m pip install pypdf\n${stderr}`
    );
  }
}

// ── Main export ───────────────────────────────────────────────────────────────
export async function generateFilledPdf(formData: FormDataState): Promise<Buffer> {
  const python = await findPython();
  await ensurePypdf(python);

  const tmpJson = path.join(os.tmpdir(), `a1-data-${Date.now()}.json`);
  const tmpOut  = path.join(os.tmpdir(), `a1-out-${Date.now()}.pdf`);

  try {
    await writeFile(tmpJson, JSON.stringify(formData), "utf-8");

    const cmd = `${python} "${SCRIPT_PATH}" "${PDF_SOURCE}" "${tmpJson}" "${tmpOut}"`;
    console.log(`[PDF] Running: ${cmd}`);

    const { stdout, stderr, code } = await run(cmd);

    if (stderr) console.warn("[PDF] stderr:", stderr);
    console.log(`[PDF] stdout: ${stdout.trim()} | exit: ${code}`);

    if (code !== 0 || !stdout.includes("OK")) {
      throw new Error(
        `PDF generovanie zlyhalo (exit ${code}).\nstdout: ${stdout}\nstderr: ${stderr}`
      );
    }

    return await readFile(tmpOut);
  } finally {
    await unlink(tmpJson).catch(() => {});
    await unlink(tmpOut).catch(() => {});
  }
}
