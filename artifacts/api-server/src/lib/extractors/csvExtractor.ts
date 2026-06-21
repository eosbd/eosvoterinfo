import fs from "fs";
import { fixBengaliEncoding, matchHeader } from "../bengali";
import { logger } from "../../lib/logger";

/** Auto-detect delimiter: comma, tab, semicolon, or pipe */
function detectDelimiter(line: string): string {
  const counts: Record<string, number> = { ",": 0, "\t": 0, ";": 0, "|": 0 };
  for (const ch of line) {
    if (ch in counts) counts[ch]++;
  }
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
}

function splitRow(row: string, delimiter: string): string[] {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < row.length; i++) {
    const ch = row[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === delimiter && !inQuotes) {
      cells.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  cells.push(current.trim());
  return cells;
}

/** Find first row that has recognisable header tokens */
function findHeaderRow(lines: string[], delimiter: string): number {
  for (let i = 0; i < Math.min(lines.length, 20); i++) {
    const cells = splitRow(lines[i], delimiter);
    const hits = cells.filter((c) => matchHeader(fixBengaliEncoding(c).trim()) !== null);
    if (hits.length >= 2 || (cells.length >= 3 && hits.length >= 1)) return i;
  }
  return 0; // fallback: first row
}

export function extractRowsFromCsvBuffer(
  buffer: Buffer,
  filename = "unknown.csv",
): Record<string, string>[] {
  // Try UTF-8; encoding fixes handle mojibake
  const content = buffer.toString("utf-8");
  const lines = content.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];

  const delimiter = detectDelimiter(lines[0]);
  const headerRowIdx = findHeaderRow(lines, delimiter);
  const rawHeaders = splitRow(lines[headerRowIdx], delimiter).map((h) =>
    fixBengaliEncoding(h).trim(),
  );

  const colToField: Record<number, string> = {};
  rawHeaders.forEach((h, i) => {
    const field = matchHeader(h);
    if (field) colToField[i] = field;
  });

  logger.info(
    { filename, headerRowIdx, rawHeaders, mappedFields: Object.values(colToField), delimiter },
    "CSV header detection result",
  );

  const unmapped = rawHeaders.filter((h, i) => h && !colToField[i]);
  if (unmapped.length > 0) {
    logger.warn({ filename, unmapped }, "Some CSV headers were not mapped");
  }

  if (Object.keys(colToField).length === 0) {
    logger.warn({ filename }, "No CSV headers recognised — no data extracted");
    return [];
  }

  const rows: Record<string, string>[] = [];
  for (let i = headerRowIdx + 1; i < lines.length; i++) {
    const cells = splitRow(lines[i], delimiter);
    if (cells.every((c) => !c.trim())) continue;

    const row: Record<string, string> = {};
    let hasValue = false;
    for (const [cStr, field] of Object.entries(colToField)) {
      const val = fixBengaliEncoding(cells[Number(cStr)] ?? "").trim();
      if (val) {
        row[field] = val;
        hasValue = true;
      }
    }
    if (hasValue) rows.push(row);
  }

  logger.info({ filename, extractedRows: rows.length }, "CSV extraction complete");
  return rows;
}

export function extractRowsFromCsvFile(filePath: string): Record<string, string>[] {
  const buffer = fs.readFileSync(filePath);
  return extractRowsFromCsvBuffer(buffer, require("path").basename(filePath));
}
