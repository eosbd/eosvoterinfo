import mammoth from "mammoth";
import { fixBengaliEncoding, headerToField } from "../bengali";

/**
 * Extract voter rows from DOCX files.
 *
 * Strategy:
 * 1. Try raw HTML extraction to detect tables → parse table rows.
 * 2. Fall back to plain text extraction with label:value line parsing.
 */

function parseHtmlTableRows(html: string): Record<string, string>[] {
  // Basic HTML table parser — extracts <tr><td>…</td></tr> rows
  const rows: Record<string, string>[] = [];
  const tableMatch = html.match(/<table[\s\S]*?<\/table>/gi);
  if (!tableMatch) return [];

  for (const table of tableMatch) {
    const trMatches = table.match(/<tr[\s\S]*?<\/tr>/gi);
    if (!trMatches || trMatches.length < 2) continue;

    // First row is headers
    const headerCells = trMatches[0]
      .match(/<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/gi)
      ?.map((cell) => {
        const text = cell.replace(/<[^>]+>/g, "").trim();
        return fixBengaliEncoding(text);
      }) ?? [];

    for (let i = 1; i < trMatches.length; i++) {
      const cells = trMatches[i]
        .match(/<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/gi)
        ?.map((cell) => fixBengaliEncoding(cell.replace(/<[^>]+>/g, "").trim())) ?? [];

      const row: Record<string, string> = {};
      headerCells.forEach((header, idx) => {
        if (cells[idx]) row[header] = cells[idx];
      });
      rows.push(row);
    }
  }
  return rows;
}

function parseTextToRows(text: string): Record<string, string>[] {
  const lines = text.split("\n").map((l) => fixBengaliEncoding(l.trim())).filter(Boolean);
  const rows: Record<string, string>[] = [];
  let current: Record<string, string> = {};

  for (const line of lines) {
    const colonIdx = line.indexOf(":");
    if (colonIdx > 0) {
      const label = line.slice(0, colonIdx).trim();
      const value = line.slice(colonIdx + 1).trim();
      const field = headerToField(label);
      if (field && value) {
        // If we hit another "name" field, flush the current record
        if (field === "name" && current["name"]) {
          if (current["name"] || current["voterNo"]) rows.push({ ...current });
          current = {};
        }
        current[field] = value;
      }
    }
  }
  if (current["name"] || current["voterNo"]) rows.push(current);
  return rows;
}

export async function extractRowsFromDocxBuffer(buffer: Buffer): Promise<Record<string, string>[]> {
  try {
    // Try HTML first (preserves tables)
    const htmlResult = await mammoth.convertToHtml({ buffer });
    const tableRows = parseHtmlTableRows(htmlResult.value);
    if (tableRows.length > 0) return tableRows;

    // Fall back to text
    const textResult = await mammoth.extractRawText({ buffer });
    return parseTextToRows(textResult.value);
  } catch {
    return [];
  }
}

export async function extractRowsFromDocxFile(filePath: string): Promise<Record<string, string>[]> {
  const buffer = require("fs").readFileSync(filePath);
  return extractRowsFromDocxBuffer(buffer);
}
