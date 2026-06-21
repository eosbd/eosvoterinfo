import * as XLSX from "xlsx";
import { fixBengaliEncoding } from "../bengali";

export function extractRowsFromXlsxBuffer(buffer: Buffer): Record<string, string>[] {
  const workbook = XLSX.read(buffer, {
    type: "buffer",
    codepage: 65001, // UTF-8
    cellText: true,
    cellDates: false,
    raw: false,
  });

  const allRows: Record<string, string>[] = [];

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) continue;

    // sheet_to_json returns array of row objects keyed by header
    const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
      defval: "",
      raw: false,
    });

    for (const rawRow of rawRows) {
      const row: Record<string, string> = {};
      for (const [k, v] of Object.entries(rawRow)) {
        row[fixBengaliEncoding(String(k)).trim()] = fixBengaliEncoding(String(v ?? ""));
      }
      allRows.push(row);
    }
  }

  return allRows;
}

export function extractRowsFromXlsxFile(filePath: string): Record<string, string>[] {
  const buffer = require("fs").readFileSync(filePath);
  return extractRowsFromXlsxBuffer(buffer);
}
