/**
 * Bangladesh Election Commission voter list PDF extractor.
 *
 * These official PDFs use custom Bengali fonts. When extracted with pdftotext,
 * the text is "consistently garbled" — vowel markers are displaced and ligatures
 * are broken — but the STRUCTURE and PATTERNS are perfectly reliable.
 *
 * Empirically confirmed patterns (from real BD EC voter PDFs):
 *   Voter record start : "০০১. নাম: Full Name"
 *   Voter number       : "ভাটার নং: ৬৭১১৭৫০০০০০১"  (ভাটার = garbled ভোটার)
 *   Father             : "িপতা: Name"               (িপতা = garbled পিতা)
 *   Mother             : "মাতা: Name"                (correct)
 *   Occupation + DOB   : "পশা: চাকরী,জ তারিখ:dd/mm/yyyy" (both on one line)
 *   Address            : "িঠকানা: ..."               (iঠকানা = garbled ঠিকানা, may wrap)
 *
 * Area metadata (extracted from page header / sidebar):
 *   District: "জলা: নারায়ণগ"   (জলা = garbled জেলা; value may be truncated)
 *   Thana   : "উপেজলা/থানা: নারায়ণগ সদর"
 *   etc.
 */

import { execFileSync } from "child_process";
import { writeFileSync, unlinkSync, existsSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { logger } from "../logger";

// ─── Voter-record field patterns ─────────────────────────────────────────────
// Each voter block starts with a Bengali ordinal + ". নাম: <name>"
const RE_VOTER_START = /^([০-৯]+)\.\s+নাম:\s*(.+)/;
const RE_VOTER_NO    = /^ভাটার নং:\s*(.+)/;          // ভাটার = garbled ভোটার
const RE_FATHER      = /^িপতা:\s*(.+)/;               // িপতা = garbled পিতা
const RE_MOTHER      = /^মাতা:\s*(.+)/;
// Occupation and DOB appear on the same line: "পশা: <occ>,জ তারিখ:<date>"
const RE_OCC_DOB     = /^পশা:\s*(.*?),জ[^\s]*\s*তা[^\s:]*\s*:(.+)/;
const RE_ADDRESS     = /^িঠকানা:\s*(.+)/;             // িঠকানা = garbled ঠিকানা

// ─── Area metadata patterns (page header + right-column sidebar) ──────────────
// These appear before the first voter record and scattered throughout the text
// as pdftotext renders left+right columns interleaved.
const RE_DISTRICT    = /^জলা:\s*(.+)/;               // জলা = garbled জেলা
const RE_THANA       = /^উপেজলা\/থানা[:\s]+(.+)/;    // উপেজলা = garbled উপজেলা
const RE_THANA_INLINE= /উপেজলা\/থানা:\s*(.+)/;       // e.g. "উপেজলা/থানা: নারায়ণগ সদর"
const RE_CITYCORP    = /িসিট[^\s]*\s*কে?পা[^\s\/]*\s*(?:\/\s*পৗরসভা)?\s*[:\s]+(.+)/i;
const RE_AREA_NAME   = /^ভাটার এলাকার নাম\s*[:\s]+(.+)/;
const RE_AREA_BARE   = /^ভাটার এলাকা\s{2,}(.+)/;    // label + multiple spaces + value (no colon)
const RE_AREA_NO     = /^ভাটার এলাকার ন র\s*[:\s]+(.+)/;
const RE_AREA_CODE   = /^ভাটার এলাকার কাড\s*[:\s]+(.+)/; // alternative area code label
const RE_POST_OFFICE = /^ডাকঘর\s*[:\s]+(.+)/;
const RE_POST_CODE   = /^পা েকাড\s*[:\s]+(.+)/;
const RE_REGION      = /^অ ল:\s*(.+)/;               // অ ল = garbled অঞ্চল
const RE_WARD_EMBED  = /ওয়াড নং-([০-৯\d]+)/;        // ward number embedded in any line

// ─── Lines to skip entirely ───────────────────────────────────────────────────
// Page headers, footers, section titles, and garbled vertical text artifacts
const SKIP_PATTERNS: RegExp[] = [
  /^বাংলাে?দশ/,
  /^িনবাচন কিমশন/,
  /^ভাটার তারিলকা\s*-/,
  /^ভাটার তা[িা]লকা\s*[-–]/,
  /^ফরম-/,
  /^ছিব ছাড়া/,
  /^চূড়া ভাটার/,
  /^পু\s*ষ$/,
  /^মিহলা$/,
  /^কাশের তারিখ[:\s]/,
  /^ভাটার তারিখ কাশের/,
  /^ইউিনয়ন\//,
  /^ক া টনেমট বাড/,
  /^সবেমাট ভাটার/,
  /^মাট পু ষ ভাটার/,
  /^মাট মিহলা ভাটার/,
  /^ওয়াড ন র \(ইউিনয়ন/,
  /^রাড$/,
  /^রিজে শন অিফসার/,
  /^[।\s]*$/,                      // blank / punctuation-only
  /^\s*[\u09E6-\u09EF\d]{1,3}\s*$/, // bare page numbers
  // Garbled vertical-text artifacts (PDF side-column header rotated 90°)
  /^[িাুূৃেৈোৌ্ংঃঁ]+$/,
  /^[া-৺]{1,2}$/,
];

interface AreaMeta {
  district?: string;
  upazilaThana?: string;
  cityCorp?: string;
  voterAreaName?: string;
  voterAreaNumber?: string;
  postOffice?: string;
  postCode?: string;
  region?: string;
  ward?: string;
}

function tryUpdateMeta(meta: AreaMeta, line: string): void {
  let m: RegExpExecArray | null;
  if (!meta.district && (m = RE_DISTRICT.exec(line)))     { meta.district = m[1].trim(); return; }
  if (!meta.upazilaThana) {
    if ((m = RE_THANA.exec(line)) || (m = RE_THANA_INLINE.exec(line))) {
      meta.upazilaThana = m[1].trim();
      return;
    }
  }
  if (!meta.cityCorp && (m = RE_CITYCORP.exec(line)))     { meta.cityCorp = m[1].trim(); return; }
  if (!meta.voterAreaName) {
    if ((m = RE_AREA_NAME.exec(line)) || (m = RE_AREA_BARE.exec(line))) {
      meta.voterAreaName = m[1].trim();
      return;
    }
    // Sidebar format: "ভাটার এলাকার নাম : িনউ হাজীগ রাড"
    const sidebarAreaName = /ভাটার এলাকার নাম\s*:\s*(.+)/.exec(line);
    if (sidebarAreaName) { meta.voterAreaName = sidebarAreaName[1].trim(); return; }
  }
  if (!meta.voterAreaNumber) {
    if ((m = RE_AREA_NO.exec(line)) || (m = RE_AREA_CODE.exec(line))) {
      meta.voterAreaNumber = m[1].trim();
      return;
    }
    // Sidebar: "ভাটার এলাকার ন র : ১১৭৫"
    const sidebarAreaNo = /ভাটার এলাকার ন র\s*:\s*(.+)/.exec(line);
    if (sidebarAreaNo) { meta.voterAreaNumber = sidebarAreaNo[1].trim(); return; }
  }
  if (!meta.postOffice && (m = RE_POST_OFFICE.exec(line))) { meta.postOffice = m[1].trim(); return; }
  if (!meta.postCode && (m = RE_POST_CODE.exec(line)))     { meta.postCode = m[1].trim(); return; }
  if (!meta.region && (m = RE_REGION.exec(line)))          { meta.region = m[1].trim(); return; }
  if (!meta.ward) {
    const wm = RE_WARD_EMBED.exec(line);
    if (wm) meta.ward = wm[1].trim();
  }
}

/** Lines that are clearly metadata/headers and should NOT be treated as address continuations */
const METADATA_LINE_PATTERNS: RegExp[] = [
  RE_DISTRICT, RE_THANA, RE_THANA_INLINE, RE_CITYCORP,
  RE_AREA_NAME, RE_AREA_NO, RE_AREA_CODE, RE_POST_OFFICE, RE_POST_CODE, RE_REGION,
  /^ইউিনয়ন\//, /^কাশের তারিখ/, /^ওয়াড ন র/,
  /ভাটার এলাকার ন র/, /ভাটার এলাকার নাম/,
];

function isMetadataLine(line: string): boolean {
  return METADATA_LINE_PATTERNS.some((re) => re.test(line));
}

/**
 * Run pdftotext on a temp file (or directly on a file path) and return the text.
 */
function runPdfToText(pdfPath: string): string {
  try {
    const buf = execFileSync("pdftotext", ["-enc", "UTF-8", pdfPath, "-"], {
      maxBuffer: 100 * 1024 * 1024,
      timeout: 120_000,
    });
    return buf.toString("utf8");
  } catch (err) {
    logger.warn({ err, pdfPath }, "pdftotext failed");
    throw err;
  }
}

function parseText(text: string): Record<string, string>[] {
  const lines = text.split(/\r?\n/);
  const meta: AreaMeta = {};

  // First pass: gather area metadata from entire doc (header is top ~100 lines)
  for (const line of lines.slice(0, 150)) {
    tryUpdateMeta(meta, line.trim());
  }

  const rows: Record<string, string>[] = [];
  let current: Record<string, string> | null = null;
  let lastField: string | null = null;

  function flush() {
    if (current && (current["voterNo"] || current["name"])) {
      // Apply area metadata to each voter record
      if (meta.district       && !current["district"])        current["district"]       = meta.district;
      if (meta.upazilaThana   && !current["upazilaThana"])    current["upazilaThana"]   = meta.upazilaThana;
      if (meta.cityCorp       && !current["cityCorp"])        current["cityCorp"]       = meta.cityCorp;
      if (meta.voterAreaName  && !current["voterAreaName"])   current["voterAreaName"]  = meta.voterAreaName;
      if (meta.voterAreaNumber && !current["voterAreaNumber"]) current["voterAreaNumber"] = meta.voterAreaNumber;
      if (meta.postOffice     && !current["postOffice"])      current["postOffice"]     = meta.postOffice;
      if (meta.postCode       && !current["postCode"])        current["postCode"]       = meta.postCode;
      if (meta.region         && !current["region"])          current["region"]         = meta.region;
      if (meta.ward           && !current["ward"])            current["ward"]           = meta.ward;
      rows.push({ ...current });
    }
    current = null;
    lastField = null;
  }

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;
    if (SKIP_PATTERNS.some((re) => re.test(line))) continue;

    // Always try to update area metadata (it appears scattered throughout)
    tryUpdateMeta(meta, line);

    // Detect new voter record
    const voterStart = RE_VOTER_START.exec(line);
    if (voterStart) {
      flush();
      current = {
        serialNo: voterStart[1],
        name: voterStart[2].trim(),
      };
      lastField = "name";
      continue;
    }

    if (!current) continue; // Still in header area, skip non-metadata lines

    let m: RegExpExecArray | null;

    if ((m = RE_VOTER_NO.exec(line))) {
      current["voterNo"] = m[1].trim();
      lastField = "voterNo";
      continue;
    }
    if ((m = RE_FATHER.exec(line))) {
      current["fatherName"] = m[1].trim();
      lastField = "fatherName";
      continue;
    }
    if ((m = RE_MOTHER.exec(line))) {
      current["motherName"] = m[1].trim();
      lastField = "motherName";
      continue;
    }
    if ((m = RE_OCC_DOB.exec(line))) {
      current["occupation"] = m[1].trim();
      current["dob"]        = m[2].trim();
      lastField = "dob";
      continue;
    }
    // Occupation-only line (no DOB, e.g. some PDFs omit it)
    if (/^পশা:\s*(.+)/.test(line) && !current["occupation"]) {
      current["occupation"] = (/^পশা:\s*(.+)/.exec(line)!)[1].trim();
      lastField = "occupation";
      continue;
    }
    if ((m = RE_ADDRESS.exec(line))) {
      current["generalAddress"] = m[1].trim();
      lastField = "generalAddress";
      continue;
    }

    // Address continuation: next line(s) that don't match any field label
    if (lastField === "generalAddress" && current["generalAddress"] && !isMetadataLine(line)) {
      current["generalAddress"] += " " + line;
      continue;
    }

    // Name continuation (rare — name wraps to next line before voter no)
    if (lastField === "name" && current["name"] && !RE_VOTER_NO.test(line) && !isMetadataLine(line)) {
      current["name"] += " " + line;
      continue;
    }
    // Father/mother continuation
    if ((lastField === "fatherName" || lastField === "motherName") && !isMetadataLine(line)) {
      if (!RE_MOTHER.test(line) && !RE_VOTER_NO.test(line) && !RE_OCC_DOB.test(line)) {
        current[lastField] = (current[lastField] || "") + " " + line;
      }
      continue;
    }
  }
  flush();

  logger.info({ count: rows.length, district: meta.district }, "BD EC PDF parse complete");
  return rows;
}

/**
 * Extract voter rows from a PDF buffer (called from ZIP extractor).
 * Writes to a temp file, runs pdftotext, then parses.
 */
export async function extractRowsFromPdfBuffer(
  buffer: Buffer,
  hint?: string,
): Promise<Record<string, string>[]> {
  const tmp = join(tmpdir(), `voter_pdf_${Date.now()}_${Math.random().toString(36).slice(2)}.pdf`);
  try {
    writeFileSync(tmp, buffer);
    logger.info({ tmp, hint }, "Extracting BD EC PDF via pdftotext");
    const text = runPdfToText(tmp);
    const rows = parseText(text);
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
    logger.info({ filePath }, "Extracting BD EC PDF via pdftotext");
    const text = runPdfToText(filePath);
    return parseText(text);
  } catch (err) {
    logger.error({ err, filePath }, "PDF extraction failed");
    return [];
  }
}
