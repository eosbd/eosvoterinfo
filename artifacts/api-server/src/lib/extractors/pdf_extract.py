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
    "\u01a3": "\u0995",             # ƣ  → ক    (ka — চাকরি, কুটির; was wrongly শ)
    "\u015b": "\u09b6",             # ś  → শ    (sha)
    "\u0144": "\u0982",             # ń  → ং    (anusvara)
    "\u017f": "\u09a8\u09cd\u09a4", # ſ  → ন্ত  (nt)
    "\u017d": "\u09b6\u09cd\u09b0\u09c0", # Ž → শ্রী
    "\u017e": "\u09b6\u09cd\u09b0\u09c0", # ž → শ্রী
    "\u014c": "\u09b2\u09cd\u09b2",  # Ō  → ল্ল (ll — ফতুল্লা, তল্লা, আব্দুল্লাহ, মোল্লা; was wrongly মো)
    "\u014d": "\u09b2\u09cd\u09b2",  # ō  → ল্ল (ll variant)
    "\u0132": "\u09dc",             # Ĳ  → ড়   (da dot below)
    "\u0133": "\u09dc",             # ĳ  → ড়
    "\u012f": "\u099c\u09cd\u099e", # į  → জ্ঞ  (gn conjunct)
    "\u0184": "\u09ac\u09cd\u09af", # Ƅ  → ব্য  (bya)
    "\u0158": "\u09b6\u09cd\u09b0", # Ř  → শ্র  (shra — শ্রমিক; was wrongly just ্র)
    "\u0159": "\u09b6\u09cd\u09b0", # ř  → শ্র  (shra variant)
    "\u0147": "\u09ae\u09cd\u09ae", # Ň  → ম্ম  (mm, মোহাম্মদ) — was wrongly ণ্ড
    "\u015e": "\u09b7",             # Ş  → ষ    (retroflex sha)
    "\u015f": "\u09b7",             # ş  → ষ
    "\xfb": "\u099e\u09cd\u099a",  # û  → ঞ্চ  (ncha — অঞ্চল; was wrongly অ)
    "\xd7": "\u0995\u09cd\u09a4",  # ×  → ক্ত  (kta, ডাক্তার) — was wrongly ক্ষ
    "\xd9": "\u0995\u09cd\u09b7",  # Ù  → ক্ষ  (ksha, শিক্ষক)
    "\xc1": "\u0995\u09cd\u09b7",  # Á  → ক্ষ  (ksha variant)
    "\u012e": "\u0997\u09cd",       # Į  → গ্
    "\u0139": "\u09b2\u09cd\u09b2", # Ĺ  → ল্ল (ll)
    "\u0160": "\u09b6",             # Š  → শ    (sha, alternate position)
    "\u015a": "\u09b6",             # Ś  → শ    (sha, alternate position)
    "\u0161": "\u09b6\u09cd\u09b0", # š  → শ্র  (shra, শ্রমিক)
    "\u0114": "\u09a4\u09cd\u09b0", # Ĕ  → ত্র  (tra — ছাত্র, চিত্রকর; was missing)
    "\u0148": "\u099e\u09cd\u099a", # ň  → ঞ্চ  (ncha)
    "\u014b": "\u09ae\u09cd\u09aa", # ŋ  → ম্প  (mpa)
    "\u013e": "\u09b2\u09cd\u0995", # ľ  → ল্ক  (lka)
    "\u0137": "\u0995\u09cd\u09a4", # ķ  → ক্ত  (kta, alternate)
    "\u0135": "\u099c\u09cd\u09ac", # ĵ  → জ্ব  (jba)
    "\u0130": "\u09aa\u09cd\u09a4", # İ  → প্ত  (pta — অবসরপ্রাপ্ত)
    "\u0103": "\u09a1\u09cd\u09b0", # ă  → ড্র  (dra — ড্রাইভার; U+0103 not U+0102)
    "\u00d4": "\u0995\u09cd\u09b8", # Ô  → ক্স  (ksa — রিক্সা)
    "\u0186": "\u09b9\u09c1",       # Ɔ  → হু   (hu — হুমায়ুন)
    "\u00d8": "\u0995\u09cd\u09b0", # Ø  → ক্র  (kra — চক্রবর্তী)
    "\u00ea": "\u0999\u09cd\u0997", # ê  → ঙ্গ  (nga — জাহাঙ্গীর, গঙ্গা)
    "\u00e8": "\u0999\u09cd\u0995", # è  → ঙ্ক  (ngk — শঙ্কর, বঙ্কিম)
    "\u0145": "\u0999\u09cd\u0995", # Ņ  → ঙ্ক  (ngk alt — শঙ্কু নাথ)
    "\u00f5": "\u099c\u09cd\u099c", # õ  → জ্জ  (jj — মোয়াজ্জেম, রাজ্জাক)
    "\u00e5": "\u0997\u09cd\u09b0", # å  → গ্র  (gra — মাইগ্রেট)
    "\u0113": "\u09a4\u09cd\u09a4", # ē  → ত্ত  (tt — উত্তম, সাত্তার)
    "\u011b": "\u09a6",             # ě  → দ    (da — জগদীশ, দীরেন্দ্র)
    "\u0124": "\u09a8\u09cd\u09a6", # Ĥ  → ন্দ  (nd — গোবিন্দ, চন্দন)
    "\u013d": "\u09ac\u09cd\u09b0", # Ľ  → ব্র  (bra — ইব্রাহীম, ব্রাঞ্চ)
    "\u0150": "\u09b2\u09cd\u09aa", # Ő  → ল্প  (lpa — কল্পনা)
    "\u015d": "\u09b7\u09cd\u09a3", # ŝ  → ষ্ণ  (sna — কৃষ্ণ, বিষ্ণু)
    "\u0169": "\u09b8\u09cd\u09a4", # ũ  → স্ত  (sta — মোস্তফা)
    "\u016b": "\u09b8\u09cd\u09a8", # ū  → স্ন  (sna — জ্যোৎস্না)
    "\u016e": "\u09b8\u09cd\u09ac", # Ů  → স্ব  (svā — সরস্বতী, স্বপন)
    "\u0171": "\u09b8\u09cd\u09a4\u09cd\u09b0", # ű → স্ত্র (stra — মিস্ত্রী)
    "\u0185": "\u0989",             # ƅ  → উ    (u — উদয়, উত্তম)
    "\u00fa": "\u099c\u09cd\u09ac", # ú  → জ্ব  (jva — আলহাজ্ব)
    "\u00d0": "\u09c8",             # Ð  → ৈ    (ai-matra pre-base: সৈয়দ, খৈয়াম)
    "\u00ff": "\u099f\u09cd\u099f", # ÿ  → ট্ট  (tt — ভট্টাচার্য)
    "\u00da": "\u0995\u09cd\u09b7\u09cd\u09ae", # Ú → ক্ষ্ম (ksma — লক্ষ্মী)
    "\u00f8": "\u099c\u09cd\u099e", # ø  → জ্ঞ  (gna — জ্ঞানেন্দ্র)
    "\u011a": "\u09a6\u09cd\u09ae", # Ě  → দ্ম  (dma — পদ্মা)
    "\u011c": "\u09a6\u09cd\u09a7", # Ĝ  → দ্ধ  (ddha — মুক্তিযোদ্ধা)
    "\u0129": "\u09a8\u09cd\u09b8", # ĩ  → ন্স  (ns — মুন্সী)
    "\u0142": "\u09a7",             # ł  → ধ    (dha — সুধা)
    "\u018f": "\u09a8\u09cd\u09a7\u09c1", # Ə → ন্ধু (ndhu — দীনবন্ধু)
    "\u0131": "\u09bf",             # ı  → ি   (i-matra; বিবি, বিশ্ব)
    "\u00d6": "\u0995\u09cd\u09b2", # Ö  → ক্ল  (kla — ক্লাব)
    "\u0154": "\u09b6\u09cd\u099a", # Ŕ  → শ্চ  (shcha — পশ্চিম)
    "\u0166": "\u09b8\u09cd\u0995", # Ŧ  → স্ক  (ska — স্কুল, ইস্কান্দার)
    "\u0123": "\u09a8",             # ģ  → ন    (na — লেন/lane)
    "\u00d1": "\u0995",             # Ñ  → ক    (ka — বকর/Bakar, আবু বÑর সিদ্দিক)
    "\u00e1": "\u0997\u09cd\u09a8", # á  → গ্ন  (gna — সংলগ্ন/adjacent)
    "\u0100": "\u09be\u09a5",       # Ā  → াথ  (aatha — নাথ/Nath surname)
    "\u00ee": "\u09ac",             # î  → ব    (ba — বাবু, common name mid-position variant)
    "\u00d2": "\u0995\u09cd\u099f", # Ò  → ক্ট  (kTa — ফ্যাক্টরী/factory)
    "\u25cc": "",                   # ◌  → ""   (dotted circle = combining base artifact, remove)
    "\u00cc": "",                   # Ì  → ""   (null glyph, silent variant)
    "\u00a1": "\u09a4",             # ¡  → ত    (ta — ¡Ōা = তল্লা)
    "\x8c": "",                     # control char → remove
    "\x8d": "",                     # control char → remove
    "\x8e": "",                     # control char → remove
    "\x98": "",                     # control char → remove
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


def fix_reph_position(text):
    """
    In SutonnyMJ visual encoding, the reph marker Î (U+00CE) appears AFTER
    the consonant cluster it belongs to.  In Unicode logical order, র্
    (ra + virama) must come BEFORE the cluster.

    Pattern (applied before fix_suton_chars so Î is still the raw glyph):
      (consonant cluster) + Î  →  র্ + (consonant cluster)

    Example:  বÎা  →  র্বা  (giving নির্বাচন from িনবÎাচন)
    """
    CONS_BASE = r"[\u0995-\u09b9\u09dc-\u09df\u09f0\u09f1]"
    CLUSTER   = CONS_BASE + r"(?:\u09cd" + CONS_BASE + r")*"
    text = re.sub(
        r"(" + CLUSTER + r")\xce",
        "\u09b0\u09cd" + r"\1",   # র্ + cluster
        text,
    )
    return text


def fix_visual_order(text):
    """
    Pre-base vowel signs appear BEFORE their base consonant in visual/PDF order.
    Move them AFTER the full consonant cluster (Unicode logical order).
      ি  (U+09BF) + C(্C)*  →  C(্C)* + ি
      ে  (U+09C7) + C(্C)*  →  C(্C)* + ে
      ৈ  (U+09C8) + C(্C)*  →  C(্C)* + ৈ

    Handles clusters like দ্দ, ক্ত, ম্ম so that:
      উিদ্দন → উদ্দিন  (not উদিদ্দন)

    Then fix compound vowel marks that only form correctly after reordering:
      ে (U+09C7) + া (U+09BE)  →  ো (U+09CB)   [o-matra]
      ৈ (U+09C8) + া (U+09BE)  →  ৌ (U+09CC)   [ou-matra]
    """
    I_MARK  = "\u09bf"   # ি
    E_MARK  = "\u09c7"   # ে  (e-matra, pre-base in visual order)
    AI_MARK = "\u09c8"   # ৈ
    # Match a full consonant cluster: C followed by zero or more (্ + C)
    CONS_BASE = r"[\u0995-\u09b9\u09dc-\u09df\u09f0\u09f1]"
    CLUSTER   = r"(" + CONS_BASE + r"(?:\u09cd" + CONS_BASE + r")*)"
    text = re.sub(I_MARK  + CLUSTER, lambda m: m.group(1) + I_MARK,  text)
    text = re.sub(E_MARK  + CLUSTER, lambda m: m.group(1) + E_MARK,  text)
    text = re.sub(AI_MARK + CLUSTER, lambda m: m.group(1) + AI_MARK, text)
    # After reordering, ে+া forms ো and ৈ+া forms ৌ
    text = text.replace("\u09c7\u09be", "\u09cb")   # ে + া → ো
    text = text.replace("\u09c8\u09be", "\u09cc")   # ৈ + া → ৌ
    return text


def clean_text(text):
    # Order matters:
    # 1. Move Î reph before its cluster (while clusters are still raw Unicode consonants)
    text = fix_reph_position(text)
    # 2. Replace ALL SutonnyMJ conjunct glyphs → Unicode Bengali
    #    (must happen BEFORE fix_visual_order so ি/ে can match full Unicode clusters)
    text = fix_suton_chars(text)
    # 3. Now all consonant clusters are Unicode — reorder pre-base vowels correctly
    text = fix_visual_order(text)
    # 4. Handle Ï (pre-base ো/ে marker) last — it uses single Bengali consonants
    text = fix_pre_base_e(text)
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
