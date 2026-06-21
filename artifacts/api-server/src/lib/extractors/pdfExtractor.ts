/**
 * Bangladesh Election Commission voter list PDF extractor.
 *
 * Uses a Python script (pdf_extract.py) with PyMuPDF to extract text from
 * BD EC official PDFs that use SutonnyMJ custom Bengali font encoding.
 * The Python script applies the SutonnyMJ→Unicode character mapping and
 * returns a JSON array of voter records with correct Bengali text.
 */

import { execFileSync } from "child_process";
import { writeFileSync, unlinkSync, existsSync } from "fs";
import { tmpdir } from "os";
import { join, resolve } from "path";
import { logger } from "../logger";

// Resolve the Python extractor path relative to the project root.
// process.cwd() is the workspace root when running via pnpm --filter.
const _workspaceRoot = process.cwd().endsWith(["artifacts", "api-server"].join("/"))
  || process.cwd().endsWith(["artifacts", "api-server"].join("\\"))
  ? resolve(process.cwd(), "../..")
  : process.cwd();

const PYTHON_SCRIPT = resolve(
  _workspaceRoot,
  "artifacts/api-server/src/lib/extractors/pdf_extract.py",
);

/**
 * Run the Python PDF extractor on a file and return parsed voter rows.
 */
function runPythonExtractor(pdfPath: string): Record<string, string>[] {
  try {
    const out = execFileSync("python3", [PYTHON_SCRIPT, pdfPath], {
      maxBuffer: 100 * 1024 * 1024,
      timeout: 180_000,
    });
    const json = out.toString("utf8").trim();
    if (!json) return [];
    return JSON.parse(json) as Record<string, string>[];
  } catch (err) {
    logger.warn({ err, pdfPath }, "Python PDF extractor failed");
    throw err;
  }
}

/**
 * Extract voter rows from a PDF buffer (called from ZIP extractor).
 * Writes to a temp file, runs the Python extractor, then returns rows.
 */
export async function extractRowsFromPdfBuffer(
  buffer: Buffer,
  hint?: string,
): Promise<Record<string, string>[]> {
  const tmp = join(tmpdir(), `voter_pdf_${Date.now()}_${Math.random().toString(36).slice(2)}.pdf`);
  try {
    writeFileSync(tmp, buffer);
    logger.info({ tmp, hint }, "Extracting BD EC PDF via Python/PyMuPDF");
    const rows = runPythonExtractor(tmp);
    logger.info({ count: rows.length, hint }, "PDF extraction done");
    return rows;
  } catch (err) {
    logger.error({ err, hint }, "PDF extraction failed");
    return [];
  } finally {
    try { if (existsSync(tmp)) unlinkSync(tmp); } catch { /* ignore */ }
  }
}

/**
 * Extract voter rows directly from a PDF file path (called from uploads route).
 */
export async function extractRowsFromPdfFile(
  filePath: string,
): Promise<Record<string, string>[]> {
  try {
    logger.info({ filePath }, "Extracting BD EC PDF via Python/PyMuPDF");
    return runPythonExtractor(filePath);
  } catch (err) {
    logger.error({ err, filePath }, "PDF extraction failed");
    return [];
  }
}
