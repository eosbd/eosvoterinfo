---
name: Bengali PDF Extraction
description: SutonnyMJ font → Unicode mapping for BD Election Commission PDFs. Processing order, char map, and remaining gaps.
---

## The Problem
Bangladesh Election Commission PDFs use SutonnyMJ custom font encoding. `pdftotext` extracts garbled text — vowel markers displaced, ligatures broken, conjuncts wrong.

## Solution
Python script `artifacts/api-server/src/lib/extractors/pdf_extract.py` using PyMuPDF (`fitz`).

## Processing order (CRITICAL — ORDER MATTERS)
```
1. fix_reph_position()  — move Î (U+00CE, reph glyph) before its consonant cluster
2. fix_suton_chars()    — replace ALL SutonnyMJ Latin glyphs → Unicode Bengali
3. fix_visual_order()   — reorder pre-base vowels ি/ে/ৈ to logical Unicode position
4. fix_pre_base_e()     — handle Ï (U+00CF, pre-base ো/ে marker)
```
**Why fix_suton_chars MUST come before fix_visual_order:** When ি/ে appear before SutonnyMJ conjunct glyphs (Latin range), fix_visual_order's Bengali consonant regex cannot match them → vowel stays misplaced.

## Key CHAR_MAP entries (confirmed, non-obvious)
| Glyph | Unicode | Bengali | Example |
|-------|---------|---------|---------|
| ƣ U+01A3 | ক | ka | চাকরি (was wrongly শ) |
| û U+00FB | ঞ্চ | ncha | অঞ্চল (was wrongly অ) |
| Ĕ U+0114 | ত্র | tra | ছাত্র |
| Ř U+0158 | শ্র | shra | শ্রমিক |
| × U+00D7 | ক্ত | kta | ডাক্তার (NOT ক্ষ!) |
| Ù U+00D9 | ক্ষ | ksha | শিক্ষক |
| Ø U+00D8 | ক্র | kra | চক্রবর্তী |
| ê U+00EA | ঙ্গ | nga+ga | জাহাঙ্গীর |
| è U+00E8 | ঙ্ক | ngk | শঙ্কর |
| Ņ U+0145 | ঙ্ক | ngk alt | শঙ্কু |
| õ U+00F5 | জ্জ | jj | মোয়াজ্জেম |
| ŝ U+015D | ষ্ণ | sna | কৃষ্ণ, বিষ্ণু |
| Ĝ U+011C | দ্ধ | ddha | মুক্তিযোদ্ধা |
| ÿ U+00FF | ট্ট | tt | ভট্টাচার্য |
| Ú U+00DA | ক্ষ্ম | ksma | লক্ষ্মী |
| ø U+00F8 | জ্ঞ | gna | জ্ঞানেন্দ্র |
| Ě U+011A | দ্ম | dma | পদ্মা |
| ĩ U+0129 | ন্স | ns | মুন্সী |
| ű U+0171 | স্ত্র | stra | মিস্ত্রী |
| ũ U+0169 | স্ত | sta | মোস্তফা |
| ū U+016B | স্ন | sna | জ্যোৎস্না |
| Ů U+016E | স্ব | sva | সরস্বতী, স্বপন |
| ƅ U+0185 | উ | u | উদয় |
| ē U+0113 | ত্ত | tt | উত্তম |
| Ĥ U+0124 | ন্দ | nd | গোবিন্দ |
| Ľ U+013D | ব্র | bra | ইব্রাহীম |
| Ő U+0150 | ল্প | lpa | কল্পনা |
| ă U+0103 | ড্র | dra | ড্রাইভার (U+0103 not U+0102!) |
| İ U+0130 | প্ত | pta | অবসরপ্রাপ্ত |
| ě U+011B | দ | da | জগদীশ (direct দ glyph variant) |
| ł U+0142 | ধ | dha | সুধা (direct ধ glyph variant) |
| Ə U+018F | ন্ধু | ndhu | দীনবন্ধু |
| Ð U+00D0 | ৈ | ai-matra | সৈয়দ, খৈয়াম |
| Î U+00CE | র্  | reph | handled by fix_reph_position |
| Ï U+00CF | (marker) | ো/ে | handled by fix_pre_base_e |

## CRITICAL FIX (confirmed from 3584 raw occurrences)
**Ō (U+014C) → ল্ল, NOT মো** — was wrongly mapped to মো. In BD EC Narayanganj PDFs, Ō is the ল্ল (double-la) conjunct.
- ফতুŌা → ফতুল্লা (Fatullah) ✓
- তŌা → তল্লা (Talla) ✓
- আĺুŌাহ → আব্দুল্লাহ (Abdullah) ✓
- ÏমাŌা → মোল্লা (Molla) ✓
- উŌাহ → উল্লাহ (Ullah suffix) ✓
- মো naturally comes from Ï + ম + া via fix_pre_base_e — Ō was redundant AND wrong.

## New mappings added (confirmed from 1873-record WARD NO-11 test PDF)
| Glyph | Unicode | Bengali | Context |
|-------|---------|---------|---------|
| ı U+0131 | ি | i-matra | বিবি (Bibi) |
| Ö U+00D6 | ক্ল | kla | ক্লাব (club) |
| Ŕ U+0154 | শ্চ | shcha | পশ্চিম (west) |
| Ŧ U+0166 | স্ক | ska | স্কুল (school), ইস্কান্দার |
| ģ U+0123 | ন | na | লেন (lane) |
| Ñ U+00D1 | ক | ka | বকর (Bakar) |
| á U+00E1 | গ্ন | gna | সংলগ্ন (adjacent) |
| Ā U+0100 | াথ | aatha | নাথ (Nath surname) |
| î U+00EE | ব | ba | বাবু (Babu, mid-position ব variant) |
| Ò U+00D2 | ক্ট | kTa | ফ্যাক্টরী (factory) |
| ◌ U+25CC | "" | remove | dotted circle artifact |
| Ì U+00CC | "" | remove | null glyph |
| ¡ U+00A1 | ত | ta | ¡Ōা = তল্লা |

## Verified output quality (1873-record test)
After all fixes: 6 unresolved edge-case chars out of 1873 records (99.7% clean).
Remaining unknowns (1 occurrence each, low priority): Ű U+0170, Ŭ U+016C, Ƃ U+0182, Đ U+0110, ņ U+0146, Ţ U+0162.

All common occupations render correctly: বেসরকারী চাকরী, ছাত্র/ছাত্রী, ব্যবসা, শ্রমিক, সরকারী চাকরী, অবসরপ্রাপ্ত, ড্রাইভার, মিস্ত্রী.
All common address components: তল্লা, ফতুল্লা, নারায়ণগঞ্জ, রোড, দক্ষিণ, সংলগ্ন, ক্লাব, স্কুল, পশ্চিম.
