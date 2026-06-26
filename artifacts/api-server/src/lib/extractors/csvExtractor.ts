import fs from "fs";
import readline from "readline";
import path from "path";
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
  return 0;
}

export function extractRowsFromCsvBuffer(
  buffer: Buffer,
  filename = "unknown.csv",
): Record<string, string>[] {
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

/**
 * Stream a large CSV file line-by-line — no full file in memory.
 * Reads up to 20 lines to find the header, then streams data rows.
 */
export async function extractRowsFromCsvFile(filePath: string): Promise<Record<string, string>[]> {
  const filename = path.basename(filePath);

  return new Promise<Record<string, string>[]>((resolve, reject) => {
    const stream = fs.createReadStream(filePath, { encoding: "utf8" });
    const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });

    const headerBuf: string[] = [];
    let headerDetected = false;
    let delimiter = ",";
    let colToField: Record<number, string> = {};
    let headerRowIdx = 0;
    const rows: Record<string, string>[] = [];
    let linesSeen = 0;

    const tryDetectHeader = () => {
      if (headerBuf.length === 0) return;
      if (headerBuf.length === 1) {
        delimiter = detectDelimiter(headerBuf[0]);
      }
      for (let i = 0; i < headerBuf.length; i++) {
        const cells = splitRow(headerBuf[i], delimiter);
        const hits = cells.filter((c) => matchHeader(fixBengaliEncoding(c).trim()) !== null);
        if (hits.length >= 2 || (cells.length >= 3 && hits.length >= 1)) {
          headerRowIdx = i;
          const rawHeaders = cells.map((h) => fixBengaliEncoding(h).trim());
          rawHeaders.forEach((h, idx) => {
            const field = matchHeader(h);
            if (field) colToField[idx] = field;
          });
          logger.info(
            { filename, headerRowIdx, mappedFields: Object.values(colToField), delimiter },
            "CSV header detection result (streaming)",
          );
          headerDetected = true;
          return;
        }
      }
      if (headerBuf.length >= 20) {
        // Fallback: use first buffered line as header
        delimiter = detectDelimiter(headerBuf[0]);
        const rawHeaders = splitRow(headerBuf[0], delimiter).map((h) => fixBengaliEncoding(h).trim());
        rawHeaders.forEach((h, idx) => {
          const field = matchHeader(h);
          if (field) colToField[idx] = field;
        });
        logger.warn({ filename }, "CSV header not found in first 20 lines — using line 0 as header");
        headerDetected = true;
      }
    };

    rl.on("line", (line) => {
      if (!line.trim()) return;
      linesSeen++;

      if (!headerDetected) {
        headerBuf.push(line);
        tryDetectHeader();
        return;
      }

      if (Object.keys(colToField).length === 0) return;

      const cells = splitRow(line, delimiter);
      if (cells.every((c) => !c.trim())) return;

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
    });

    rl.on("close", () => {
      if (!headerDetected && headerBuf.length > 0) {
        tryDetectHeader();
      }
      logger.info({ filename, linesSeen, extractedRows: rows.length }, "CSV streaming extraction complete");
      resolve(rows);
    });

    rl.on("error", (err) => {
      logger.error({ err, filename }, "CSV streaming error");
      reject(err);
    });

    stream.on("error", reject);
  });
}
