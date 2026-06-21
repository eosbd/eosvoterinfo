// eslint-disable-next-line @typescript-eslint/no-require-imports
const AdmZip = require("adm-zip") as new (buf: Buffer) => { getEntries(): Array<{ entryName: string; isDirectory: boolean; getData(): Buffer }> };
import path from "path";
import { extractRowsFromCsvBuffer } from "./csvExtractor";
import { extractRowsFromXlsxBuffer } from "./xlsxExtractor";
import { extractRowsFromPdfBuffer } from "./pdfExtractor";
import { extractRowsFromDocxBuffer } from "./docxExtractor";

export async function extractRowsFromZipBuffer(buffer: Buffer): Promise<Record<string, string>[]> {
  let zip: InstanceType<typeof AdmZip>;
  try {
    zip = new AdmZip(buffer);
  } catch {
    return [];
  }

  const entries = zip.getEntries();
  const allRows: Record<string, string>[] = [];

  for (const entry of entries) {
    if (entry.isDirectory) continue;
    const name = entry.entryName.toLowerCase();
    const ext = path.extname(name);
    // Skip hidden/metadata files
    if (name.startsWith("__macosx") || name.startsWith(".")) continue;

    const entryBuffer = entry.getData();

    try {
      let rows: Record<string, string>[] = [];
      if (ext === ".csv") {
        rows = extractRowsFromCsvBuffer(entryBuffer);
      } else if (ext === ".xlsx" || ext === ".xls") {
        rows = extractRowsFromXlsxBuffer(entryBuffer);
      } else if (ext === ".pdf") {
        rows = await extractRowsFromPdfBuffer(entryBuffer);
      } else if (ext === ".docx" || ext === ".doc") {
        rows = await extractRowsFromDocxBuffer(entryBuffer);
      }
      allRows.push(...rows);
    } catch {
      // Skip unreadable entries
    }
  }

  return allRows;
}

export async function extractRowsFromZipFile(filePath: string): Promise<Record<string, string>[]> {
  const buffer = require("fs").readFileSync(filePath);
  return extractRowsFromZipBuffer(buffer);
}
