/**
 * Bengali text utilities — Bijoy/ANSI to Unicode conversion and field name mapping.
 */

// Common broken-Unicode / corrupted sequences found in Bijoy-exported files
const CORRUPTION_PATTERNS: [RegExp, string][] = [
  [/নারায়ণগý/g, "নারায়ণগঞ্জ"],
  [/Ïজলা/g, "জেলা"],
  [/Ï/g, "জে"],
  [/ý/g, "ঞ্জ"],
  [/ÿ/g, "ষ্ট"],
  [/â/g, "আ"],
  [/ã/g, "ই"],
  [/ä/g, "ী"],
  [/å/g, "ু"],
  [/æ/g, "ূ"],
  [/ç/g, "ৃ"],
  [/è/g, "ে"],
  [/é/g, "ে"],
  [/ê/g, "ৈ"],
  [/ë/g, "ো"],
  [/ì/g, "ৌ"],
  [/î/g, "্"],
  [/ï/g, "ি"],
  [/ð/g, "ী"],
  [/ñ/g, "ু"],
  [/ò/g, "ূ"],
  [/ó/g, "ৃ"],
  [/ô/g, "ে"],
  [/õ/g, "ৈ"],
  [/ö/g, "ো"],
  [/ø/g, "ৌ"],
  [/ù/g, "্"],
  [/ú/g, "ং"],
  [/û/g, "ঃ"],
  [/ü/g, "ঁ"],
  [/\uFFFD+/g, ""],
  [/\x00/g, ""],
  [/\x8d/g, "্"],
  [/\x9d/g, ""],
];

/**
 * Exact-match header table.
 * Keys are lowercased + normalised; values are canonical field names.
 */
const EXACT_HEADER_MAP: Record<string, string> = {
  // Serial
  "ক্রমিক": "serialNo",
  "ক্রমিক নং": "serialNo",
  "ক্রমিক নম্বর": "serialNo",
  "সিরিয়াল": "serialNo",
  "serial no": "serialNo",
  "serial": "serialNo",
  "sl": "serialNo",
  "sl.no": "serialNo",
  "sl no": "serialNo",
  "no": "serialNo",
  "নং": "serialNo",
  // Voter No
  "ভোটার নং": "voterNo",
  "ভোটার নম্বর": "voterNo",
  "ভোটার ক্রমিক নং": "voterNo",
  "voter no": "voterNo",
  "voter number": "voterNo",
  "voterno": "voterNo",
  "voter_no": "voterNo",
  "nid": "voterNo",
  "voter id": "voterNo",
  "voter_id": "voterNo",
  "id no": "voterNo",
  "id number": "voterNo",
  // Name
  "নাম": "name",
  "ভোটারের নাম": "name",
  "name": "name",
  "voter name": "name",
  "full name": "name",
  "voter's name": "name",
  // Father
  "পিতা": "fatherName",
  "বাবার নাম": "fatherName",
  "পিতার নাম": "fatherName",
  "father": "fatherName",
  "father name": "fatherName",
  "father's name": "fatherName",
  "fname": "fatherName",
  "f. name": "fatherName",
  // Mother
  "মাতা": "motherName",
  "মায়ের নাম": "motherName",
  "মাতার নাম": "motherName",
  "mother": "motherName",
  "mother name": "motherName",
  "mother's name": "motherName",
  "mname": "motherName",
  "m. name": "motherName",
  // Occupation
  "পেশা": "occupation",
  "occupation": "occupation",
  "job": "occupation",
  "profession": "occupation",
  // DOB
  "জন্ম তারিখ": "dob",
  "জন্মতারিখ": "dob",
  "জন্ম": "dob",
  "dob": "dob",
  "date of birth": "dob",
  "birth date": "dob",
  "d.o.b": "dob",
  "জন্মদিন": "dob",
  // Address
  "ঠিকানা": "generalAddress",
  "সাধারণ ঠিকানা": "generalAddress",
  "address": "generalAddress",
  "general address": "generalAddress",
  "addr": "generalAddress",
  "বাসস্থান": "generalAddress",
  // Region / Division
  "অঞ্চল": "region",
  "region": "region",
  "বিভাগ": "region",
  "division": "region",
  "div": "region",
  // District
  "জেলা": "district",
  "district": "district",
  "dist": "district",
  "জেলার নাম": "district",
  "zila": "district",
  "zilla": "district",
  // Upazila / Thana
  "উপজেলা": "upazilaThana",
  "থানা": "upazilaThana",
  "উপজেলা/থানা": "upazilaThana",
  "থানা/উপজেলা": "upazilaThana",
  "thana": "upazilaThana",
  "upazila": "upazilaThana",
  "upazilla": "upazilaThana",
  "sub-district": "upazilaThana",
  "subdistrict": "upazilaThana",
  "ps": "upazilaThana",
  // Gender
  "লিঙ্গ": "gender",
  "gender": "gender",
  "sex": "gender",
  "পুরুষ": "gender",
  "মহিলা": "gender",
  // Union / Ward / Cantonment Board
  "ইউনিয়ন/ওয়ার্ড/ক্যাঃ বোঃ": "unionWardCab",
  "ইউনিয়ন": "unionWardCab",
  "union": "unionWardCab",
  "union ward": "unionWardCab",
  // Publication date
  "প্রকাশের তারিখ": "publishDate",
  "publish date": "publishDate",
  "publication date": "publishDate",
  // City corp / Municipality
  "সিটি কর্পোরেশন": "cityCorp",
  "পৌরসভা": "cityCorp",
  "city corp": "cityCorp",
  "municipality": "cityCorp",
  "pourashava": "cityCorp",
  "city corporation": "cityCorp",
  // Post office
  "ডাকঘর": "postOffice",
  "post office": "postOffice",
  "po": "postOffice",
  "post": "postOffice",
  // Post code
  "পোস্টকোড": "postCode",
  "post code": "postCode",
  "postcode": "postCode",
  "zip": "postCode",
  "zip code": "postCode",
  "postal code": "postCode",
  // Voter area name
  "ভোটার এলাকার নাম": "voterAreaName",
  "ভোটার এলাকা": "voterAreaName",
  "voter area": "voterAreaName",
  "voter area name": "voterAreaName",
  "এলাকার নাম": "voterAreaName",
  "এলাকা": "voterAreaName",
  "area name": "voterAreaName",
  "constituency": "voterAreaName",
  // Voter area number
  "ভোটার এলাকার নম্বর": "voterAreaNumber",
  "ভোটার এলাকার নং": "voterAreaNumber",
  "voter area number": "voterAreaNumber",
  "voter area no": "voterAreaNumber",
  "area number": "voterAreaNumber",
  "area no": "voterAreaNumber",
  // Area code
  "এলাকা কোড": "areaCode",
  "area code": "areaCode",
  "areacode": "areaCode",
  // Ward
  "ওয়ার্ড": "ward",
  "ward": "ward",
  "ward no": "ward",
  "ward number": "ward",
  "ward nо": "ward",
  "ওয়ার্ড নং": "ward",
  "ওয়ার্ড নম্বর": "ward",
};

/** Transliterate common Bengali district/thana names to ASCII for English search */
const TRANSLITERATION_MAP: Record<string, string> = {
  "dhaka": "ঢাকা",
  "chittagong": "চট্টগ্রাম",
  "chattogram": "চট্টগ্রাম",
  "sylhet": "সিলেট",
  "rajshahi": "রাজশাহী",
  "khulna": "খুলনা",
  "barisal": "বরিশাল",
  "barishal": "বরিশাল",
  "rangpur": "রংপুর",
  "mymensingh": "ময়মনসিংহ",
  "comilla": "কুমিল্লা",
  "cumilla": "কুমিল্লা",
  "cox's bazar": "কক্সবাজার",
  "coxsbazar": "কক্সবাজার",
  "coxbazar": "কক্সবাজার",
  "narayanganj": "নারায়ণগঞ্জ",
  "gazipur": "গাজীপুর",
  "bogura": "বগুড়া",
  "bogra": "বগুড়া",
  "jessore": "যশোর",
  "jashore": "যশোর",
  "dinajpur": "দিনাজপুর",
  "tangail": "টাঙ্গাইল",
  "jamalpur": "জামালপুর",
  "pabna": "পাবনা",
  "noakhali": "নোয়াখালী",
  "feni": "ফেনী",
  "lakshmipur": "লক্ষ্মীপুর",
  "chandpur": "চাঁদপুর",
  "brahmanbaria": "ব্রাহ্মণবাড়িয়া",
  "habiganj": "হবিগঞ্জ",
  "moulvibazar": "মৌলভীবাজার",
  "sunamganj": "সুনামগঞ্জ",
  "sirajganj": "সিরাজগঞ্জ",
  "natore": "নাটোর",
  "naogaon": "নওগাঁ",
  "chapainawabganj": "চাঁপাইনবাবগঞ্জ",
  "joypurhat": "জয়পুরহাট",
  "kurigram": "কুড়িগ্রাম",
  "gaibandha": "গাইবান্ধা",
  "lalmonirhat": "লালমনিরহাট",
  "nilphamari": "নীলফামারী",
  "panchagarh": "পঞ্চগড়",
  "thakurgaon": "ঠাকুরগাঁও",
  "chuadanga": "চুয়াডাঙ্গা",
  "meherpur": "মেহেরপুর",
  "jhenaidah": "ঝিনাইদহ",
  "jhenaidaha": "ঝিনাইদহ",
  "narail": "নড়াইল",
  "magura": "মাগুরা",
  "faridpur": "ফরিদপুর",
  "gopalganj": "গোপালগঞ্জ",
  "madaripur": "মাদারীপুর",
  "shariatpur": "শরীয়তপুর",
  "munshiganj": "মুন্সীগঞ্জ",
  "manikganj": "মানিকগঞ্জ",
  "narsingdi": "নরসিংদী",
  "kishoreganj": "কিশোরগঞ্জ",
  "netrokona": "নেত্রকোণা",
  "sherpur": "শেরপুর",
  "pirojpur": "পিরোজপুর",
  "jhalokati": "ঝালকাঠি",
  "patuakhali": "পটুয়াখালী",
  "barguna": "বরগুনা",
  "bhola": "ভোলা",
  "bandarban": "বান্দরবান",
  "rangamati": "রাঙামাটি",
  "khagrachhari": "খাগড়াছড়ি",
  "satkhira": "সাতক্ষীরা",
  "bagerhat": "বাগেরহাট",
  "kushtia": "কুষ্টিয়া",
  "rajbari": "রাজবাড়ী",
};

/**
 * If a search query is in English (ASCII only), attempt to transliterate it
 * to Bengali so the DB ilike search can match Bengali text.
 * Returns the Bengali equivalent, or the original string if not transliterable.
 */
export function transliterateSearchQuery(query: string): string {
  if (!query) return query;
  // If query contains Bengali characters, return as-is
  if (/[\u0980-\u09FF]/.test(query)) return query;
  const lower = query.toLowerCase().trim();
  return TRANSLITERATION_MAP[lower] || query;
}

/**
 * Substring-token match table.
 * If a header CONTAINS one of these tokens, it maps to the field.
 * Less precise — only checked when exact matching fails.
 */
const CONTAINS_MAP: Array<[string, string]> = [
  ["ভোটার নং", "voterNo"],
  ["ভোটার নম্বর", "voterNo"],
  ["voter no", "voterNo"],
  ["voter id", "voterNo"],
  ["ভোটার", "voterNo"],
  ["voter", "voterNo"],
  ["পিতা", "fatherName"],
  ["father", "fatherName"],
  ["মাতা", "motherName"],
  ["mother", "motherName"],
  ["জেলা", "district"],
  ["district", "district"],
  ["উপজেলা", "upazilaThana"],
  ["thana", "upazilaThana"],
  ["upazila", "upazilaThana"],
  ["ওয়ার্ড", "ward"],
  ["ward", "ward"],
  ["পেশা", "occupation"],
  ["জন্ম", "dob"],
  ["birth", "dob"],
  ["ঠিকানা", "generalAddress"],
  ["address", "generalAddress"],
  ["বিভাগ", "region"],
  ["division", "region"],
  ["ডাকঘর", "postOffice"],
  ["post office", "postOffice"],
  ["পোস্ট", "postCode"],
  ["post code", "postCode"],
  ["postcode", "postCode"],
  ["এলাকার নাম", "voterAreaName"],
  ["এলাকা", "voterAreaName"],
  ["নাম", "name"],
  ["name", "name"],
  ["ক্রমিক", "serialNo"],
  ["serial", "serialNo"],
];

/** Strip Bengali punctuation and normalise whitespace for matching */
function normalise(s: string): string {
  return s
    .toLowerCase()
    .replace(/[।,;:।\-_/\\().]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Apply corruption-pattern fixes to a string.
 */
export function fixBengaliEncoding(text: string): string {
  if (!text) return text;
  let result = String(text).trim();
  for (const [pattern, replacement] of CORRUPTION_PATTERNS) {
    result = result.replace(pattern, replacement);
  }
  return result.trim();
}

/**
 * Match a raw header string to a field key.
 * 1. Exact normalised match (fastest, most accurate)
 * 2. Substring/contains match (handles extra words around the key token)
 * Returns null if no match found.
 */
export function matchHeader(raw: string): string | null {
  if (!raw || !raw.trim()) return null;

  const norm = normalise(fixBengaliEncoding(raw));

  // 1. Exact match on normalised key
  if (EXACT_HEADER_MAP[norm]) return EXACT_HEADER_MAP[norm];

  // 2. Try exact match on original (un-normalised) key
  const orig = fixBengaliEncoding(raw).trim();
  if (EXACT_HEADER_MAP[orig]) return EXACT_HEADER_MAP[orig];
  if (EXACT_HEADER_MAP[orig.toLowerCase()]) return EXACT_HEADER_MAP[orig.toLowerCase()];

  // 3. Contains match — try each token
  for (const [token, field] of CONTAINS_MAP) {
    if (norm.includes(token.toLowerCase()) || orig.includes(token)) {
      return field;
    }
  }

  return null;
}

/**
 * Build a voter record from a row.
 *
 * Supports TWO row formats:
 *   A. Field-keyed rows (from new extractors): keys are already field names
 *      e.g. { name: "শামীমা", district: "নারায়ণগঞ্জ" }
 *   B. Header-keyed rows (legacy): keys are raw header text
 *      e.g. { "নাম": "শামীমা", "জেলা": "নারায়ণগঞ্জ" }
 *
 * Format A is detected when at least one key matches a known field name directly.
 */
const KNOWN_FIELDS = new Set([
  "serialNo", "voterNo", "name", "fatherName", "motherName", "occupation",
  "dob", "gender", "generalAddress", "region", "district", "upazilaThana", "cityCorp",
  "unionWardCab", "postOffice", "postCode", "voterAreaName", "voterAreaNumber",
  "areaCode", "ward", "publishDate",
]);

export function buildVoterRecord(
  row: Record<string, string>,
): {
  voterNo: string;
  name: string;
  [key: string]: string | undefined;
} | null {
  const record: Record<string, string | undefined> = {};

  // Detect format: are the keys already field names?
  const isPreMapped = Object.keys(row).some((k) => KNOWN_FIELDS.has(k));

  if (isPreMapped) {
    // Format A: keys are field names — copy directly
    for (const [field, val] of Object.entries(row)) {
      if (KNOWN_FIELDS.has(field) && val) {
        record[field] = fixBengaliEncoding(val);
      }
    }
  } else {
    // Format B: keys are raw headers — map them
    for (const [rawKey, rawVal] of Object.entries(row)) {
      const field = matchHeader(rawKey);
      if (field && rawVal) {
        record[field] = fixBengaliEncoding(String(rawVal));
      }
    }
  }

  const name = record["name"];
  const voterNo = record["voterNo"];
  if (!name && !voterNo) return null;

  return {
    voterNo: voterNo || `IMPORT-${Date.now()}`,
    name: name || "Unknown",
    fatherName: record["fatherName"],
    motherName: record["motherName"],
    occupation: record["occupation"],
    dob: record["dob"],
    gender: record["gender"],
    generalAddress: record["generalAddress"],
    region: record["region"],
    district: record["district"],
    upazilaThana: record["upazilaThana"],
    cityCorp: record["cityCorp"],
    unionWardCab: record["unionWardCab"],
    postOffice: record["postOffice"],
    postCode: record["postCode"],
    voterAreaName: record["voterAreaName"],
    voterAreaNumber: record["voterAreaNumber"],
    areaCode: record["areaCode"],
    ward: record["ward"],
    publishDate: record["publishDate"],
    serialNo: record["serialNo"],
  };
}
