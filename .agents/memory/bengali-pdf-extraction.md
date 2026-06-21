---
name: Bengali PDF Extraction
description: How BD EC voter list PDFs are extracted with correct Bengali text using PyMuPDF and SutonnyMJ→Unicode mapping.
---

## The Problem
Bangladesh Election Commission PDFs use SutonnyMJ custom font encoding. `pdftotext` extracts garbled text — vowel markers displaced, ligatures broken, district names truncated (e.g. `নারায়ণগ` instead of `নারায়ণগঞ্জ`).

## Solution
Python script `artifacts/api-server/src/lib/extractors/pdf_extract.py` using PyMuPDF (`fitz`):
1. Extract text with `page.get_text("text")`
2. Apply character mapping (SutonnyMJ→Unicode): ý→ঞ্জ, Î→র্, Ë→্য, etc.
3. `fix_visual_order` FIRST: move pre-base ি/ে/ৈ from before consonant to after
4. `fix_pre_base_e` SECOND: convert Ï + consonant + [া] → consonant + ো/ে
5. `fix_suton_chars` THIRD: replace remaining conjunct glyphs

**Why order matters:** `fix_visual_order` must run BEFORE `fix_pre_base_e` — otherwise Ï-generated ো gets incorrectly re-shuffled back before the next consonant (e.g. `ভোটার` becomes `ভটোার`).

## Metadata Label Patterns (after char mapping)
The PDF header labels come out with SutonnyMJ artifacts even after mapping:
- `জোলা:` (not `জেলা:`) → RE_DISTRICT = `^জ[েো]লা:`
- `উপেজলা/থানা:` → RE_THANA = `^উপ[েো]?জলা/থানা:`
- `পোশা:` (not `পেশা:`) → RE_OCC_DOB = `^প[েো]শা:`
- `ওয়াডর্ নং-১১` → RE_WARD_EMBED = `ওয়াড[রর্]*\s*নং-`
- `পোষেকাড:` → RE_POST_CODE = `^পো[ষস][েো]?কাড?:`
- `অঅল:` (region) → RE_REGION = `^অ[ঞঅ][চ্ছ]?ল:`

## TypeScript Integration
`pdfExtractor.ts` calls `python3 pdf_extract.py <path>` via `execFileSync` and parses JSON output.
The Python output records use field names matching `KNOWN_FIELDS` in `bengali.ts` so `buildVoterRecord` passes them through directly (Format A: pre-mapped keys).

## Admin Reprocess
`POST /api/admin/reprocess` — clears voters table and re-extracts all ZIPs from uploads dir.
Dashboard has "Re-process Data (Fix Bengali)" button.
