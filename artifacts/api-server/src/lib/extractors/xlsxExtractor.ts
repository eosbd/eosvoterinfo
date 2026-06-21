import * as XLSX from "xlsx";
import { fixBengaliEncoding, matchHeader } from "../bengali";
import { logger } from "../../lib/logger";

/**
 * Scan all rows as raw 2-D arrays and find the row index that looks most
 * like a header row (i.e. contains the most recognisable column-name tokens).
 */
function findHeaderRowIndex(sheet: XLSX.WorkSheet): number {
  const range = XLSX.utils.decode_range(sheet["!ref"] ?? "A1:A1");
  const maxScanRows = Math.min(range.e.r + 1, 20); // scan first 20 rows at most

  let bestRow = 0;
  let bestScore = -1;

  for (let r = range.s.r; r < range.s.r + maxScanRows; r++) {
    let score = 0;
    for (let c = range.s.c; c <= range.e.c; c++) {
      const cell = sheet[XLSX.utils.encode_cell({ r, c })];
      if (!cell) continue;
      const text = fixBengaliEncoding(String(cell.v ?? "")).trim();
      if (matchHeader(text) !== null) score++;
    }
    if (score > bestScore) {
      bestScore = score;
      bestRow = r;
    }
  }

  return bestRow;
}

export function extractRowsFromXlsxBuffer(
  buffer: Buffer,
  filename = "unknown.xlsx",
): Record<string, string>[] {
  let workbook: XLSX.WorkBook;
  try {
    workbook = XLSX.read(buffer, {
      type: "buffer",
      codepage: 65001,
      cellText: true,
      cellDates: false,
      raw: false,
      dense: false,
    });
  } catch (err) {
    logger.warn({ err, filename }, "XLSX read failed");
    return [];
  }

  const allRows: Record<string, string>[] = [];

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet || !sheet["!ref"]) continue;

    const headerRow = findHeaderRowIndex(sheet);
    const range = XLSX.utils.decode_range(sheet["!ref"]);

    // Build header map: column index → field key
    const colToField: Record<number, string> = {};
    const rawHeaders: string[] = [];
    for (let c = range.s.c; c <= range.e.c; c++) {
      const cell = sheet[XLSX.utils.encode_cell({ r: headerRow, c })];
      const text = cell ? fixBengaliEncoding(String(cell.v ?? "")).trim() : "";
      rawHeaders.push(text);
      const field = matchHeader(text);
      if (field) colToField[c] = field;
    }

    logger.info(
      { filename, sheetName, headerRow, rawHeaders, mappedFields: Object.values(colToField) },
      "XLSX header detection result",
    );

    const unmappedHeaders = rawHeaders.filter((h, i) => h && !colToField[range.s.c + i]);
    if (unmappedHeaders.length > 0) {
      logger.warn({ filename, sheetName, unmappedHeaders }, "Some headers were not mapped to fields");
    }

    if (Object.keys(colToField).length === 0) {
      logger.warn({ filename, sheetName }, "No column headers recognised — skipping sheet");
      continue;
    }

    // Extract data rows
    for (let r = headerRow + 1; r <= range.e.r; r++) {
      const row: Record<string, string> = {};
      let hasValue = false;
      for (const [cStr, field] of Object.entries(colToField)) {
        const c = Number(cStr);
        const cell = sheet[XLSX.utils.encode_cell({ r, c })];
        const val = cell ? fixBengaliEncoding(String(cell.v ?? "")).trim() : "";
        if (val) {
          row[field] = val;
          hasValue = true;
        }
      }
      if (hasValue) allRows.push(row);
    }

    logger.info({ filename, sheetName, extractedRows: allRows.length }, "Sheet extraction complete");
  }

  return allRows;
}

export function extractRowsFromXlsxFile(filePath: string): Record<string, string>[] {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const fs = require("fs") as typeof import("fs");
  const buffer: Buffer = fs.readFileSync(filePath);
  const filename = require("path").basename(filePath);
  return extractRowsFromXlsxBuffer(buffer, filename);
}
