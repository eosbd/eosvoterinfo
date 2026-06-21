import fs from "fs";
import { fixBengaliEncoding, headerToField, buildVoterRecord } from "../bengali";

function parseCsvRow(row: string): string[] {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < row.length; i++) {
    const ch = row[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if ((ch === "," || ch === "\t") && !inQuotes) {
      cells.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  cells.push(current.trim());
  return cells;
}

export function extractRowsFromCsvBuffer(buffer: Buffer): Record<string, string>[] {
  // Try UTF-8 first; if that produces mojibake, the encoding fix will handle it
  const content = buffer.toString("utf-8");
  const lines = content.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];

  const rawHeaders = parseCsvRow(lines[0]);
  const headers = rawHeaders.map((h) => fixBengaliEncoding(h).trim());

  const rows: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = parseCsvRow(lines[i]);
    if (cells.every((c) => !c.trim())) continue;
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => {
      if (cells[idx] !== undefined) {
        row[h] = cells[idx];
      }
    });
    rows.push(row);
  }
  return rows;
}

export function extractRowsFromCsvFile(filePath: string): Record<string, string>[] {
  const buffer = fs.readFileSync(filePath);
  return extractRowsFromCsvBuffer(buffer);
}
