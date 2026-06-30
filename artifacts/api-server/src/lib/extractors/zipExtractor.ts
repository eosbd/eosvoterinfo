import AdmZip from "adm-zip";
import path from "path";
import fs from "fs";
import os from "os";
import { extractRowsFromCsvFile } from "./csvExtractor";
import { extractRowsFromXlsxFile } from "./xlsxExtractor";
import { extractRowsFromPdfFile } from "./pdfExtractor";
import { extractRowsFromDocxFile } from "./docxExtractor";
import { logger } from "../logger";

export async function extractRowsFromZipFile(filePath: string): Promise<Record<string, string>[]> {
  let zip: InstanceType<typeof AdmZip>;
  try {
    zip = new AdmZip(filePath);
  } catch (err) {
    logger.error({ err, filePath }, "Failed to open ZIP file");
    return [];
  }

  const entries = zip.getEntries();
  const allRows: Record<string, string>[] = [];

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "zip-extract-"));

  try {
    for (const entry of entries) {
      if (entry.isDirectory) continue;

      const name = entry.entryName.toLowerCase();
      const ext = path.extname(name);

      if (name.startsWith("__macosx") || name.startsWith(".")) continue;

      const supported = [".csv", ".xlsx", ".xls", ".pdf", ".docx", ".doc"];
      if (!supported.includes(ext)) continue;

      const safeName = path.basename(entry.entryName).replace(/[^a-zA-Z0-9._-]/g, "_");
      const tempFile = path.join(tempDir, safeName);

      try {
        const data = entry.getData();
        if (!data || data.length === 0) {
          logger.warn({ entry: entry.entryName }, "ZIP entry has no data, skipping");
          continue;
        }
        fs.writeFileSync(tempFile, data);

        let rows: Record<string, string>[] = [];
        if (ext === ".csv") {
          rows = await extractRowsFromCsvFile(tempFile);
        } else if (ext === ".xlsx" || ext === ".xls") {
          rows = extractRowsFromXlsxFile(tempFile);
        } else if (ext === ".pdf") {
          rows = await extractRowsFromPdfFile(tempFile);
        } else if (ext === ".docx" || ext === ".doc") {
          rows = await extractRowsFromDocxFile(tempFile);
        }

        allRows.push(...rows);
        logger.info({ entry: entry.entryName, rows: rows.length }, "ZIP entry extracted");
      } catch (err) {
        logger.warn({ err, entry: entry.entryName }, "ZIP entry extraction failed, skipping");
      } finally {
        try { fs.unlinkSync(tempFile); } catch { /* ignore */ }
      }
    }
  } finally {
    try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch { /* ignore */ }
  }

  return allRows;
}

export async function extractRowsFromZipBuffer(buffer: Buffer): Promise<Record<string, string>[]> {
  const tempFile = path.join(os.tmpdir(), `zip-buf-${Date.now()}.zip`);
  try {
    fs.writeFileSync(tempFile, buffer);
    return await extractRowsFromZipFile(tempFile);
  } finally {
    try { fs.unlinkSync(tempFile); } catch { /* ignore */ }
  }
}
