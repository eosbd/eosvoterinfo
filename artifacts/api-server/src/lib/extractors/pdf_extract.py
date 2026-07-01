#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Bangladesh Election Commission PDF extractor using pymupdf.

Structure of a BD EC voter list PDF:
  Page 1-2 : Cover / intro pages  →  SKIP entirely
  Page 3   : First voter-list page; the HEADER section (first ~60 lines) contains
             shared area metadata for ALL voters in this PDF (district, thana,
             voter area, post office, ward, union/ward/cab, city corp, region,
             publication date).  Voter records also begin on this page after the
             header.
  Pages 4+ : Continuation — voter records only (headers repeat but are ignored;
             the page-3 header metadata is already known).

Output: JSON array of voter record dicts.
"""

import sys
import re
import json
import fitz  # pymupdf

# ─── SutonnyMJ glyph → Unicode Bengali map ────────────────────────────────
CHAR_MAP = {
    "\xfd": "\u099e\u09cd\u099c",
    "\xce": "\u09b0\u09cd",
    "\xcb": "\u09cd\u09af",
    "\u0125": "\u09a8\u09cd\u09ae",
    "\u0128": "\u09a8\u09cd\u09a8",
    "\u0122": "\u09a8\u09cd\u09a4",
    "\u0134": "\u09aa\u09cd\u09b0",
    "\u013a": "\u09ac\u09cd\u09a6",
    "\u013c": "\u09ac\u09cd\u09ac",
    "\u0126": "\u09a8\u09cd\u09a7",
    "\u0127": "\u09a8\u09cd\u09a6\u09cd\u09b0",
    "\u0117": "\u09a6\u09cd\u09a6",
    "\u0119": "\u09af\u09bc",
    "\u0181": "\u09b0\u09c1",
    "\u0180": "\u09b0",
    "\u0183": "\u09ac\u09c1",
    "\u01a3": "\u0995",
    "\u015b": "\u09b6",
    "\u0144": "\u0982",
    "\u017f": "\u09a8\u09cd\u09a4",
    "\u017d": "\u09b6\u09cd\u09b0\u09c0",
    "\u017e": "\u09b6\u09cd\u09b0\u09c0",
    "\u014c": "\u09b2\u09cd\u09b2",
    "\u014d": "\u09b2\u09cd\u09b2",
    "\u0132": "\u09dc",
    "\u0133": "\u09dc",
    "\u012f": "\u099c\u09cd\u099e",
    "\u0184": "\u09ac\u09cd\u09af",
    "\u0158": "\u09b6\u09cd\u09b0",
    "\u0159": "\u09b6\u09cd\u09b0",
    "\u0147": "\u09ae\u09cd\u09ae",
    "\u015e": "\u09b7",
    "\u015f": "\u09b7",
    "\xfb": "\u099e\u09cd\u099a",
    "\xd7": "\u0995\u09cd\u09a4",
    "\xd9": "\u0995\u09cd\u09b7",
    "\xc1": "\u0995\u09cd\u09b7",
    "\u012e": "\u0997\u09cd",
    "\u0139": "\u09b2\u09cd\u09b2",
    "\u0160": "\u09b6",
    "\u015a": "\u09b6",
    "\u0161": "\u09b6\u09cd\u09b0",
    "\u0114": "\u09a4\u09cd\u09b0",
    "\u0148": "\u099e\u09cd\u099a",
    "\u014b": "\u09ae\u09cd\u09aa",
    "\u013e": "\u09b2\u09cd\u0995",
    "\u0137": "\u0995\u09cd\u09a4",
    "\u0135": "\u099c\u09cd\u09ac",
    "\u0130": "\u09aa\u09cd\u09a4",
    "\u0103": "\u09a1\u09cd\u09b0",
    "\u00d4": "\u0995\u09cd\u09b8",
    "\u0186": "\u09b9\u09c1",
    "\u00d8": "\u0995\u09cd\u09b0",
    "\u00ea": "\u0999\u09cd\u0997",
    "\u00e8": "\u0999\u09cd\u0995",
    "\u0145": "\u0999\u09cd\u0995",
    "\u00f5": "\u099c\u09cd\u099c",
    "\u00e5": "\u0997\u09cd\u09b0",
    "\u0113": "\u09a4\u09cd\u09a4",
    "\u011b": "\u09a6",
    "\u0124": "\u09a8\u09cd\u09a6",
    "\u013d": "\u09ac\u09cd\u09b0",
    "\u0150": "\u09b2\u09cd\u09aa",
    "\u015d": "\u09b7\u09cd\u09a3",
    "\u0169": "\u09b8\u09cd\u09a4",
    "\u016b": "\u09b8\u09cd\u09a8",
    "\u016e": "\u09b8\u09cd\u09ac",
    "\u0171": "\u09b8\u09cd\u09a4\u09cd\u09b0",
    "\u0185": "\u0989",
    "\u00fa": "\u099c\u09cd\u09ac",
    "\u00d0": "\u09c8",
    "\u00ff": "\u099f\u09cd\u099f",
    "\u00da": "\u0995\u09cd\u09b7\u09cd\u09ae",
    "\u00f8": "\u099c\u09cd\u099e",
    "\u011a": "\u09a6\u09cd\u09ae",
    "\u011c": "\u09a6\u09cd\u09a7",
    "\u0129": "\u09a8\u09cd\u09b8",
    "\u0142": "\u09a7",
    "\u018f": "\u09a8\u09cd\u09a7\u09c1",
    "\u0131": "\u09bf",
    "\u00d6": "\u0995\u09cd\u09b2",
    "\u0154": "\u09b6\u09cd\u099a",
    "\u0166": "\u09b8\u09cd\u0995",
    "\u0123": "\u09a8",
    "\u00d1": "\u0995",
    "\u00e1": "\u0997\u09cd\u09a8",
    "\u0100": "\u09be\u09a5",
    "\u00ee": "\u09ac",
    "\u00d2": "\u0995\u09cd\u099f",
    "\u25cc": "",
    "\u00cc": "",
    "\u00a1": "\u09a4",
    "\x8c": "",
    "\x8d": "",
    "\x8e": "",
    "\x98": "",
}

_BN_CONS_RE = re.compile(
    r"([\u0995-\u09b9\u09dc-\u09df\u09f0\u09f1])"
)


def fix_pre_base_e(text):
    CONS_SET = set(range(0x0995, 0x09BA)) | {0x09DC, 0x09DD, 0x09DE, 0x09DF, 0x09F0, 0x09F1}
    result = []
    i = 0
    while i < len(text):
        ch = text[i]
        if ord(ch) == 0x00CF:
            i += 1
            if i < len(text) and ord(text[i]) in CONS_SET:
                base = text[i]
                i += 1
                if i < len(text) and text[i] == "\u09be":
                    result.append(base + "\u09cb")
                    i += 1
                elif i < len(text) and text[i] == "\u09d7":
                    result.append(base + "\u09cc")
                    i += 1
                else:
                    result.append(base + "\u09c7")
        else:
            result.append(ch)
            i += 1
    return "".join(result)


def fix_suton_chars(text):
    for src, dst in CHAR_MAP.items():
        text = text.replace(src, dst)
    return text


def fix_reph_position(text):
    CONS_BASE = r"[\u0995-\u09b9\u09dc-\u09df\u09f0\u09f1]"
    CLUSTER   = CONS_BASE + r"(?:\u09cd" + CONS_BASE + r")*"
    text = re.sub(
        r"(" + CLUSTER + r")\xce",
        "\u09b0\u09cd" + r"\1",
        text,
    )
    return text


def fix_visual_order(text):
    I_MARK  = "\u09bf"
    E_MARK  = "\u09c7"
    AI_MARK = "\u09c8"
    CONS_BASE = r"[\u0995-\u09b9\u09dc-\u09df\u09f0\u09f1]"
    CLUSTER   = r"(" + CONS_BASE + r"(?:\u09cd" + CONS_BASE + r")*)"
    text = re.sub(I_MARK  + CLUSTER, lambda m: m.group(1) + I_MARK,  text)
    text = re.sub(E_MARK  + CLUSTER, lambda m: m.group(1) + E_MARK,  text)
    text = re.sub(AI_MARK + CLUSTER, lambda m: m.group(1) + AI_MARK, text)
    text = text.replace("\u09c7\u09be", "\u09cb")
    text = text.replace("\u09c8\u09be", "\u09cc")
    return text


def clean_text(text):
    text = fix_reph_position(text)
    text = fix_suton_chars(text)
    text = fix_visual_order(text)
    text = fix_pre_base_e(text)
    text = re.sub(r"[ \t]+", " ", text)
    return text


# ─── Bengali digit normalisation ───────────────────────────────────────────────
_BN_TO_ASCII = str.maketrans("০১২৩৪৫৬৭৮৯", "0123456789")
_ASCII_TO_BN = str.maketrans("0123456789", "০১২৩৪৫৬৭৮৯")

def bn_to_ascii_digits(s):
    return s.translate(_BN_TO_ASCII)

def normalise_voter_no(s):
    """Store voter number with ASCII digits for easier search."""
    return bn_to_ascii_digits(s).strip()


# ─── Field patterns ───────────────────────────────────────────────────────────
RE_VOTER_START  = re.compile(r"^([০-৯\d]+)\.\s+নাম:\s*(.+)")
RE_VOTER_NO     = re.compile(r"^ভোটার নং:\s*(.+)")
RE_FATHER       = re.compile(r"^পিতা:\s*(.+)")
RE_MOTHER       = re.compile(r"^মাতা:\s*(.+)")
RE_OCC_DOB      = re.compile(r"^প[েো]শা:\s*(.*?)\s*জন্ম\s*তারিখ\s*[:\s]+(.+)", re.IGNORECASE)
RE_OCC_ONLY     = re.compile(r"^প[েো]শা:\s*(.+)")
RE_DOB_ONLY     = re.compile(r"^জন্ম\s*তারিখ\s*[:\s]+(.+)")
RE_ADDRESS      = re.compile(r"^ঠিকানা:\s*(.+)")
RE_GENDER       = re.compile(r"^(পুরুষ|মহিলা|হিজড়া)$")

# ─── Header / shared metadata patterns ────────────────────────────────────────
RE_DISTRICT     = re.compile(r"^জ[েো]লা:\s*(.+)")
RE_THANA        = re.compile(r"^উপ[েো]?জলা/থানা[:\s]+(.+)")
RE_THANA2       = re.compile(r"^উপ[েো]?জলা[:\s]+(.+)")
RE_CITYCORP     = re.compile(r"সিটি\s*\S+/পৌরসভা[:\s]+(.+)|সিটি\s*\S+[:\s]+(.+)", re.IGNORECASE)
RE_AREA_NAME    = re.compile(r"ভোটার এলাকার নাম[:\s]+(.+)")
RE_AREA_NUMBER  = re.compile(r"ভোটার এলাকার নং[রর্]*[:\s]+(.+)")
RE_POST_OFFICE  = re.compile(r"^ডাকঘর[:\s]+(.+)")
RE_POST_CODE    = re.compile(r"^পো[ষস][েো]?কাড?\s*[:\s]+(.+)")
RE_REGION       = re.compile(r"^অ[ঞঅ][চ্ছ]?ল:\s*(.+)")
RE_WARD_EMBED   = re.compile(r"ওয়া[রড][রড্]*\s*নং[-–\s]*([০-৯\d]+)")
RE_UNION_WARD   = re.compile(r"ইউনিয়ন/ওয়ার[্ড]+[^:]*[:\s]+(.+)")
RE_PUBLISH_DATE = re.compile(r"^প্রকাশের তারিখ[:\s]+(.+)")

# Lines to skip outright (not voter records, not useful header)
SKIP_RE = [
    re.compile(r"^বাংলাদেশ"),
    re.compile(r"^নির্বাচন কমিশন"),
    re.compile(r"^ভোটার তালিকা\s*[-–]"),
    re.compile(r"^চূড়ান্ত"),
    re.compile(r"^ফরম-"),
    re.compile(r"^ছবি ছাড়া"),
    re.compile(r"^সর্বমোট ভোটার"),
    re.compile(r"^মোট পুরুষ ভোটার"),
    re.compile(r"^মোট মহিলা ভোটার"),
    re.compile(r"^[।\s]*$"),
    re.compile(r"^\s*[\u09E6-\u09EF\d]{1,3}\s*$"),
]

META_RE = [RE_DISTRICT, RE_THANA, RE_THANA2, RE_CITYCORP, RE_AREA_NAME,
           RE_AREA_NUMBER, RE_POST_OFFICE, RE_POST_CODE, RE_REGION,
           RE_UNION_WARD, RE_PUBLISH_DATE]


def is_metadata(line):
    return any(p.search(line) for p in META_RE)


def update_meta(meta, line):
    """Extract a header field value from `line` into `meta` dict (first-match wins)."""
    m = RE_DISTRICT.match(line)
    if m and not meta.get("district"):
        meta["district"] = m.group(1).strip(); return
    m = RE_THANA.match(line) or RE_THANA2.match(line)
    if m and not meta.get("upazilaThana"):
        meta["upazilaThana"] = m.group(1).strip(); return
    m = RE_CITYCORP.search(line)
    if m and not meta.get("cityCorp"):
        meta["cityCorp"] = (m.group(1) or m.group(2) or "").strip(); return
    m = RE_AREA_NAME.search(line)
    if m and not meta.get("voterAreaName"):
        meta["voterAreaName"] = m.group(1).strip(); return
    m = RE_AREA_NUMBER.search(line)
    if m and not meta.get("voterAreaNumber"):
        meta["voterAreaNumber"] = m.group(1).strip(); return
    m = RE_POST_OFFICE.match(line)
    if m and not meta.get("postOffice"):
        meta["postOffice"] = m.group(1).strip(); return
    m = RE_POST_CODE.match(line)
    if m and not meta.get("postCode"):
        meta["postCode"] = m.group(1).strip(); return
    m = RE_REGION.match(line)
    if m and not meta.get("region"):
        meta["region"] = m.group(1).strip(); return
    m = RE_UNION_WARD.search(line)
    if m and not meta.get("unionWardCab"):
        meta["unionWardCab"] = m.group(1).strip(); return
    m = RE_PUBLISH_DATE.match(line)
    if m and not meta.get("publishDate"):
        meta["publishDate"] = m.group(1).strip(); return
    m = RE_WARD_EMBED.search(line)
    if m and not meta.get("ward"):
        meta["ward"] = bn_to_ascii_digits(m.group(1).strip())


def extract_page3_header(doc):
    """
    Extract shared header metadata from page 3 (index 2).
    Returns a meta dict.  Falls back gracefully if PDF has < 3 pages.
    """
    meta = {}
    header_page_idx = min(2, len(doc) - 1)
    raw = doc[header_page_idx].get_text("text")
    lines = [clean_text(ln).strip() for ln in raw.split("\n")]

    # The header section is the first block before the first numbered voter entry.
    # We scan until we hit the first voter record (or 80 lines, whichever comes first).
    for ln in lines[:80]:
        if RE_VOTER_START.match(ln):
            break
        update_meta(meta, ln)

    return meta


def parse_voter_pages(text, header_meta):
    """
    Parse voter records from pages 3+ text.
    header_meta: pre-extracted dict from page 3 header (applied to every record).
    """
    lines_raw = text.split("\n")
    lines = [clean_text(ln).strip() for ln in lines_raw]

    rows = []
    current = None
    last_field = None

    def flush():
        nonlocal current, last_field
        if current and (current.get("voterNo") or current.get("name")):
            # Merge header metadata (only for fields not already set)
            for k, v in header_meta.items():
                if v and not current.get(k):
                    current[k] = v
            # Normalise voter number to ASCII digits for searchability
            if current.get("voterNo"):
                current["voterNo"] = normalise_voter_no(current["voterNo"])
            rows.append(dict(current))
        current = None
        last_field = None

    for ln in lines:
        if not ln:
            continue
        if any(p.match(ln) for p in SKIP_RE):
            continue

        # ── Gender line (standalone) ────────────────────────────────────────
        m = RE_GENDER.match(ln)
        if m:
            if current is not None:
                current["gender"] = m.group(1)
            continue

        # ── Start of a new voter record ─────────────────────────────────────
        m = RE_VOTER_START.match(ln)
        if m:
            flush()
            current = {"serialNo": bn_to_ascii_digits(m.group(1)), "name": m.group(2).strip()}
            last_field = "name"
            continue

        if current is None:
            continue

        # ── Known fields ─────────────────────────────────────────────────────
        m = RE_VOTER_NO.match(ln)
        if m:
            current["voterNo"] = m.group(1).strip(); last_field = "voterNo"; continue

        m = RE_FATHER.match(ln)
        if m:
            current["fatherName"] = m.group(1).strip(); last_field = "fatherName"; continue

        m = RE_MOTHER.match(ln)
        if m:
            current["motherName"] = m.group(1).strip(); last_field = "motherName"; continue

        m = RE_OCC_DOB.match(ln)
        if m:
            current["occupation"] = m.group(1).strip()
            current["dob"] = m.group(2).strip()
            last_field = "dob"; continue

        m = RE_OCC_ONLY.match(ln)
        if m and not current.get("occupation"):
            current["occupation"] = m.group(1).strip(); last_field = "occupation"; continue

        m = RE_DOB_ONLY.match(ln)
        if m and not current.get("dob"):
            current["dob"] = m.group(1).strip(); last_field = "dob"; continue

        m = RE_ADDRESS.match(ln)
        if m:
            current["generalAddress"] = m.group(1).strip(); last_field = "generalAddress"; continue

        # ── Continuation lines ────────────────────────────────────────────────
        if is_metadata(ln):
            # Header line (repeated from subsequent page headers) — skip body parse,
            # but update meta so ward etc. can still be captured
            continue

        if last_field == "generalAddress" and current.get("generalAddress"):
            current["generalAddress"] += " " + ln; continue
        if last_field == "name" and current.get("name"):
            if not RE_VOTER_NO.match(ln):
                current["name"] += " " + ln; continue
        if last_field in ("fatherName", "motherName"):
            if not RE_MOTHER.match(ln) and not RE_VOTER_NO.match(ln) and not RE_OCC_DOB.match(ln):
                current[last_field] = (current.get(last_field) or "") + " " + ln
            continue

    flush()
    return rows


def extract_pdf(pdf_path):
    doc = fitz.open(pdf_path)
    n = len(doc)

    if n == 0:
        doc.close()
        return []

    # ── Step 1: extract shared header from page 3 (index 2) ───────────────
    header_meta = extract_page3_header(doc)

    # ── Step 2: extract voter records from pages 3 onwards (skip pages 1-2)
    # We start from page 3 (index 2) because voters start there too (after the
    # header block).  Pages 1 and 2 are cover/intro and contain no voter data.
    start_page = min(2, n - 1)
    voter_text = ""
    for i in range(start_page, n):
        voter_text += doc[i].get_text("text") + "\n"

    doc.close()
    return parse_voter_pages(voter_text, header_meta)


if __name__ == "__main__":
    if len(sys.argv) < 2:
        sys.stderr.write("Usage: pdf_extract.py <pdf_path>\n")
        sys.exit(1)
    try:
        rows = extract_pdf(sys.argv[1])
        sys.stdout.write(json.dumps(rows, ensure_ascii=False))
        sys.stdout.write("\n")
    except Exception as e:
        sys.stderr.write(str(e) + "\n")
        sys.exit(1)
