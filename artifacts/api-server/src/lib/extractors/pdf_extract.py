#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Bangladesh Election Commission PDF extractor using pymupdf.

BD EC PDFs use the SutonnyMJ custom Bengali font encoding. When extracted
naively, special Latin-range glyphs appear for Bengali conjuncts and vowels.
This script applies the SutonnyMJ->Unicode mapping and visual-to-logical
vowel reordering to produce correct Unicode Bengali text.

Usage:
  python3 pdf_extract.py <pdf_path>
Output:
  JSON array of voter record dicts to stdout.
"""

import sys
import re
import json
import fitz  # pymupdf

# ─── SutonnyMJ glyph → Unicode Bengali map ────────────────────────────────
# Keys are the custom Latin-range glyphs; values are correct Bengali Unicode.
CHAR_MAP = {
    "\xfd": "\u099e\u09cd\u099c",   # ý  → ঞ্জ  (ganj, e.g. নারায়ণগঞ্জ)
    "\xce": "\u09b0\u09cd",         # Î  → র্   (reph)
    "\xcb": "\u09cd\u09af",         # Ë  → ্য   (ya-phala)
    "\u0125": "\u09a8\u09cd\u09ae", # ĥ  → ন্ম  (nm conjunct, জন্ম)
    "\u0128": "\u09a8\u09cd\u09a8", # Ĩ  → ন্ন  (nn conjunct, চুন্নু)
    "\u0122": "\u09a8\u09cd\u09a4", # Ģ  → ন্ত  (nt conjunct, চূড়ান্ত)
    "\u0134": "\u09aa\u09cd\u09b0", # Ĵ  → প্র  (pra, প্রকাশ)
    "\u013a": "\u09ac\u09cd\u09a6", # ĺ  → ব্দ  (bd, আব্দুল)
    "\u013c": "\u09ac\u09cd\u09ac", # ļ  → ব্ব  (bb, জব্বার)
    "\u0126": "\u09a8\u09cd\u09a7", # Ħ  → ন্ধ  (ndh, সন্ধ্যা)
    "\u0127": "\u09a8\u09cd\u09a6\u09cd\u09b0", # ħ → ন্দ্র (ndra, চন্দ্র)
    "\u0117": "\u09a6\u09cd\u09a6", # ė  → দ্দ  (dd, উদ্দিন)
    "\u0119": "\u09af\u09bc",       # ę  → য়   (ya with nukta)
    "\u0181": "\u09b0\u09c1",       # Ɓ  → রু   (ru, পুরুষ)
    "\u0180": "\u09b0",             # ƀ  → র    (ra)
    "\u0183": "\u09ac\u09c1",       # ƃ  → বু   (bu)
    "\u01a3": "\u09b6",             # ƣ  → শ    (sha)
    "\u015b": "\u09b6",             # ś  → শ    (sha)
    "\u0144": "\u0982",             # ń  → ং    (anusvara)
    "\u017f": "\u09a8\u09cd\u09a4", # ſ  → ন্ত  (nt)
    "\u017d": "\u09b6\u09cd\u09b0\u09c0", # Ž → শ্রী
    "\u017e": "\u09b6\u09cd\u09b0\u09c0", # ž → শ্রী
    "\u014c": "\u09ae\u09cb",       # Ō  → মো
    "\u014d": "\u09ae\u09cb",       # ō  → মো
    "\u0132": "\u09dc",             # Ĳ  → ড়   (da dot below)
    "\u0133": "\u09dc",             # ĳ  → ড়
    "\u012f": "\u099c\u09cd\u099e", # į  → জ্ঞ  (gn conjunct)
    "\u0184": "\u09ac\u09cd\u09af", # Ƅ  → ব্য  (bya)
    "\u0158": "\u09cd\u09b0",       # Ř  → ্র   (ra-phala)
    "\u0159": "\u09cd\u09b0",       # ř  → ্র
    "\u0147": "\u09a3\u09cd\u09a1", # Ň  → ণ্ড  (nd)
    "\u015e": "\u09b7",             # Ş  → ষ    (retroflex sha)
    "\u015f": "\u09b7",             # ş  → ষ
    "\xfb": "\u0985",              # û  → অ
    "\xd7": "\u0995\u09cd\u09b7",  # ×  → ক্ষ  (ksha)
    "\xc1": "\u0995\u09cd\u09b7",  # Á  → ক্ষ
    "\u012e": "\u0997\u09cd",       # Į  → গ্
    "\u0139": "\u09b2\u09cd\u09b2", # Ĺ  → ল্ল (ll)
    "\x8c": "",                     # control char → remove
    "\x8d": "",                     # control char → remove
}

# Bengali consonant set for vowel reordering
_BN_CONS_RE = re.compile(
    r"([\u0995-\u09b9\u09dc-\u09df\u09f0\u09f1])"
)


def fix_pre_base_e(text):
    """
    Ï (U+00CF): pre-base marker for ে/ো vowel in SutonnyMJ encoding.

    Rules (C = a single Bengali consonant codepoint):
      Ï + C + া  →  C + ো
      Ï + C + ৗ  →  C + ৌ
      Ï + C      →  C + ে
    """
    CONS_SET = set(range(0x0995, 0x09BA)) | {0x09DC, 0x09DD, 0x09DE, 0x09DF, 0x09F0, 0x09F1}
    result = []
    i = 0
    while i < len(text):
        ch = text[i]
        if ord(ch) == 0x00CF:       # Ï
            i += 1
            if i < len(text) and ord(text[i]) in CONS_SET:
                base = text[i]
                i += 1
                if i < len(text) and text[i] == "\u09be":   # া (aa-mark)
                    result.append(base + "\u09cb")           # ো
                    i += 1
                elif i < len(text) and text[i] == "\u09d7": # ৗ (au-length mark)
                    result.append(base + "\u09cc")           # ৌ
                    i += 1
                else:
                    result.append(base + "\u09c7")           # ে (default)
            # Ï not followed by Bengali consonant: discard
        else:
            result.append(ch)
            i += 1
    return "".join(result)


def fix_suton_chars(text):
    """Replace SutonnyMJ custom glyphs with proper Bengali Unicode."""
    for src, dst in CHAR_MAP.items():
        text = text.replace(src, dst)
    return text


def fix_visual_order(text):
    """
    Pre-base vowel signs appear BEFORE their base consonant in visual/PDF order.
    Move them AFTER the consonant (Unicode logical order).
      ি  (U+09BF) + C  →  C + ি
      ে  (U+09C7) + C  →  C + ে
      ৈ  (U+09C8) + C  →  C + ৈ

    Then fix compound vowel marks that only form correctly after reordering:
      ে (U+09C7) + া (U+09BE)  →  ো (U+09CB)   [o-matra]
      ৈ (U+09C8) + া (U+09BE)  →  ৌ (U+09CC)   [ou-matra]
    """
    I_MARK  = "\u09bf"   # ি
    E_MARK  = "\u09c7"   # ে  (e-matra, pre-base in visual order)
    AI_MARK = "\u09c8"   # ৈ
    PAT = _BN_CONS_RE.pattern
    text = re.sub(I_MARK  + "(" + PAT + ")", lambda m: m.group(1) + I_MARK,  text)
    text = re.sub(E_MARK  + "(" + PAT + ")", lambda m: m.group(1) + E_MARK,  text)
    text = re.sub(AI_MARK + "(" + PAT + ")", lambda m: m.group(1) + AI_MARK, text)
    # After reordering, ে+া forms ো and ৈ+া forms ৌ
    text = text.replace("\u09c7\u09be", "\u09cb")   # ে + া → ো
    text = text.replace("\u09c8\u09be", "\u09cc")   # ৈ + া → ৌ
    return text


def clean_text(text):
    text = fix_visual_order(text)  # First: fix ি/ে/ৈ positioning from PDF visual layout
    text = fix_pre_base_e(text)   # Then: Ï → ো/ে (already in correct position, won't re-shuffle)
    text = fix_suton_chars(text)  # Then: replace conjunct glyphs
    text = re.sub(r"[ \t]+", " ", text)
    return text


# ─── Field patterns (post-fix, correct Bengali) ───────────────────────────────
RE_VOTER_START = re.compile(r"^([০-৯]+)\.\s+নাম:\s*(.+)")
RE_VOTER_NO    = re.compile(r"^ভোটার নং:\s*(.+)")
RE_FATHER      = re.compile(r"^পিতা:\s*(.+)")
RE_MOTHER      = re.compile(r"^মাতা:\s*(.+)")
RE_OCC_DOB     = re.compile(r"^প[েো]শা:\s*(.*?),জন্ম\s*তারিখ\s*:(.+)", re.IGNORECASE)
RE_OCC_ONLY    = re.compile(r"^প[েো]শা:\s*(.+)")
RE_ADDRESS     = re.compile(r"^ঠিকানা:\s*(.+)")

RE_DISTRICT    = re.compile(r"^জ[েো]লা:\s*(.+)")           # জেলা: or জোলা: (SutonnyMJ variant)
RE_THANA       = re.compile(r"^উপ[েো]?জলা/থানা[:\s]+(.+)")  # উপেজলা/থানা: or উপজেলা/থানা:
RE_THANA2      = re.compile(r"^উপ[েো]?জলা[:\s]+(.+)")
RE_CITYCORP    = re.compile(r"সিটি\s*\S+\s*পৌরসভা\s*[:/]+\s*(.+)|সিটি\s*\S+[:\s]+(.+)", re.IGNORECASE)
RE_AREA_NAME   = re.compile(r"ভোটার এলাকার নাম\s*[:\s]+(.+)")
RE_AREA_NUMBER = re.compile(r"ভোটার এলাকার নং[রর্]*\s*[:\s]+(.+)")
RE_POST_OFFICE = re.compile(r"^ডাকঘর\s*[:\s]+(.+)")
RE_POST_CODE   = re.compile(r"^পো[ষস][েো]?কাড?\s*[:\s]+(.+)")  # পোষেকাড: or পোস্টকোড:
RE_REGION      = re.compile(r"^অ[ঞঅ][চ্ছ]?ল:\s*(.+)")           # অঞ্চল: or অঅল: variant
RE_WARD_EMBED  = re.compile(r"ওয়াড[রর্]*\s*নং-([০-৯\d]+)")     # ওয়াডর্ নং-১১ or ওয়ার্ড নং-১১

SKIP_RE = [
    re.compile(r"^বাংলাদেশ"),
    re.compile(r"^নির্বাচন কমিশন"),
    re.compile(r"^ভোটার তালিকা\s*[-–]"),
    re.compile(r"^চূড়ান্ত"),
    re.compile(r"^ফরম-"),
    re.compile(r"^ছবি ছাড়া"),
    re.compile(r"^পুরুষ$"),
    re.compile(r"^মহিলা$"),
    re.compile(r"^প্রকাশের তারিখ[:\s]"),
    re.compile(r"^ইউনিয়ন/"),
    re.compile(r"^সর্বমোট ভোটার"),
    re.compile(r"^মোট পুরুষ ভোটার"),
    re.compile(r"^মোট মহিলা ভোটার"),
    re.compile(r"^[।\s]*$"),
    re.compile(r"^\s*[\u09E6-\u09EF\d]{1,3}\s*$"),
]

META_RE = [RE_DISTRICT, RE_THANA, RE_THANA2, RE_CITYCORP, RE_AREA_NAME,
           RE_AREA_NUMBER, RE_POST_OFFICE, RE_POST_CODE, RE_REGION]


def is_metadata(line):
    return any(p.search(line) for p in META_RE)


def update_meta(meta, line):
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
    m = RE_WARD_EMBED.search(line)
    if m and not meta.get("ward"):
        meta["ward"] = m.group(1).strip()


def parse_text(raw):
    lines_raw = raw.split("\n")
    lines = [clean_text(ln).strip() for ln in lines_raw]

    meta = {}
    for ln in lines[:150]:
        update_meta(meta, ln)

    rows = []
    current = None
    last_field = None

    def flush():
        nonlocal current, last_field
        if current and (current.get("voterNo") or current.get("name")):
            for k, v in meta.items():
                if not current.get(k):
                    current[k] = v
            rows.append(dict(current))
        current = None
        last_field = None

    for ln in lines:
        if not ln:
            continue
        if any(p.match(ln) for p in SKIP_RE):
            continue

        update_meta(meta, ln)

        m = RE_VOTER_START.match(ln)
        if m:
            flush()
            current = {"serialNo": m.group(1), "name": m.group(2).strip()}
            last_field = "name"
            continue

        if current is None:
            continue

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
        m = RE_ADDRESS.match(ln)
        if m:
            current["generalAddress"] = m.group(1).strip(); last_field = "generalAddress"; continue

        if last_field == "generalAddress" and current.get("generalAddress") and not is_metadata(ln):
            current["generalAddress"] += " " + ln; continue
        if last_field == "name" and current.get("name") and not RE_VOTER_NO.match(ln) and not is_metadata(ln):
            current["name"] += " " + ln; continue
        if last_field in ("fatherName", "motherName") and not is_metadata(ln):
            if not RE_MOTHER.match(ln) and not RE_VOTER_NO.match(ln) and not RE_OCC_DOB.match(ln):
                current[last_field] = (current.get(last_field) or "") + " " + ln
            continue

    flush()
    return rows


def extract_pdf(pdf_path):
    doc = fitz.open(pdf_path)
    all_text = ""
    for page in doc:
        all_text += page.get_text("text") + "\n"
    doc.close()
    return parse_text(all_text)


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
