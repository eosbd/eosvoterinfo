// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse = require("pdf-parse") as (buf: Buffer) => Promise<{ text: string; numpages: number }>;
import { fixBengaliEncoding, headerToField } from "../bengali";

/**
 * Attempt to extract structured voter rows from PDF text.
 *
 * Strategy:
 * 1. Extract all text from the PDF.
 * 2. Split into blocks separated by serial numbers or voter numbers.
 * 3. For each block, try to identify field: value pairs using known Bengali labels.
 */

// Known Bengali label patterns
const FIELD_PATTERNS: [RegExp, string][] = [
  [/ক্রমিক[:\s]+(\S+)/u, "serialNo"],
  [/ভোটার নং[:\s]+([^\n]+)/u, "voterNo"],
  [/ভোটার নম্বর[:\s]+([^\n]+)/u, "voterNo"],
  [/নাম[:\s]+([^\n]+)/u, "name"],
  [/পিতা[:\s]+([^\n]+)/u, "fatherName"],
  [/মাতা[:\s]+([^\n]+)/u, "motherName"],
  [/পেশা[:\s]+([^\n]+)/u, "occupation"],
  [/জন্ম তারিখ[:\s]+([^\n]+)/u, "dob"],
  [/জন্মতারিখ[:\s]+([^\n]+)/u, "dob"],
  [/ঠিকানা[:\s]+([^\n]+)/u, "generalAddress"],
  [/বিভাগ[:\s]+([^\n]+)/u, "region"],
  [/অঞ্চল[:\s]+([^\n]+)/u, "region"],
  [/জেলা[:\s]+([^\n]+)/u, "district"],
  [/উপজেলা[:\s]+([^\n]+)/u, "upazilaThana"],
  [/থানা[:\s]+([^\n]+)/u, "upazilaThana"],
  [/সিটি কর্পোরেশন[:\s]+([^\n]+)/u, "cityCorp"],
  [/পৌরসভা[:\s]+([^\n]+)/u, "cityCorp"],
  [/ডাকঘর[:\s]+([^\n]+)/u, "postOffice"],
  [/পোস্টকোড[:\s]+([^\n]+)/u, "postCode"],
  [/ভোটার এলাকার নাম[:\s]+([^\n]+)/u, "voterAreaName"],
  [/ভোটার এলাকার নম্বর[:\s]+([^\n]+)/u, "voterAreaNumber"],
  [/এলাকা কোড[:\s]+([^\n]+)/u, "areaCode"],
  [/ওয়ার্ড[:\s]+([^\n]+)/u, "ward"],
];

function parseBlockToRow(block: string): Record<string, string> | null {
  const row: Record<string, string> = {};
  for (const [pattern, field] of FIELD_PATTERNS) {
    const m = block.match(pattern);
    if (m && m[1]) {
      row[field] = fixBengaliEncoding(m[1].trim());
    }
  }
  if (!row["name"] && !row["voterNo"]) return null;
  return row;
}

export async function extractRowsFromPdfBuffer(buffer: Buffer): Promise<Record<string, string>[]> {
  let parsed;
  try {
    parsed = await pdfParse(buffer);
  } catch {
    return [];
  }

  const text = fixBengaliEncoding(parsed.text);

  // Strategy 1: split by serial number pattern
  // Blocks typically start with a serial like "০১" or "01" on a line by itself
  const blocks = text
    .split(/(?=(?:^|\n)\s*[০-৯\d]{1,3}\s*\n)/u)
    .filter((b) => b.trim().length > 20);

  const rows: Record<string, string>[] = [];
  for (const block of blocks) {
    const row = parseBlockToRow(block);
    if (row) rows.push(row);
  }

  // Strategy 2: if no rows found, try line-by-line colon-separated pairs
  if (rows.length === 0) {
    const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
    const row: Record<string, string> = {};
    for (const line of lines) {
      const colonIdx = line.indexOf(":");
      if (colonIdx > 0) {
        const label = fixBengaliEncoding(line.slice(0, colonIdx).trim());
        const value = fixBengaliEncoding(line.slice(colonIdx + 1).trim());
        const field = headerToField(label);
        if (field && value) {
          if (row[field] && field === "name") {
            // Flush current record and start new
            if (row["name"] || row["voterNo"]) rows.push({ ...row });
            Object.keys(row).forEach((k) => delete row[k]);
          }
          row[field] = value;
        }
      }
    }
    if (row["name"] || row["voterNo"]) rows.push(row);
  }

  return rows;
}

export async function extractRowsFromPdfFile(filePath: string): Promise<Record<string, string>[]> {
  const buffer = require("fs").readFileSync(filePath);
  return extractRowsFromPdfBuffer(buffer);
}
