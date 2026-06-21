/**
 * Bengali text utilities — Bijoy/ANSI to Unicode conversion and field name mapping.
 *
 * Bijoy Bayanno is the most common legacy Bengali encoding in Bangladesh.
 * Characters are stored as Latin codepoints and must be remapped to Unicode.
 */

// Complete Bijoy character-level mapping (single chars first, then digraphs)
const BIJOY_MAP: [string, string][] = [
  // Vowels / matras
  ["Av", "আ"], ["A", "অ"],
  ["B", "ই"], ["C", "ঈ"], ["D", "উ"], ["E", "ঊ"],
  ["F", "ঋ"], ["G", "এ"], ["H", "ঐ"], ["I", "ও"], ["J", "ঔ"],
  // Consonants
  ["K", "ক"], ["L", "খ"], ["M", "গ"], ["N", "ঘ"], ["O", "ঙ"],
  ["P", "চ"], ["Q", "ছ"], ["R", "জ"], ["S", "ঝ"], ["T", "ঞ"],
  ["U", "ট"], ["V", "ঠ"], ["W", "ড"], ["X", "ঢ"], ["Y", "ণ"],
  ["Z", "ত"], ["a", "থ"], ["b", "দ"], ["c", "ধ"], ["d", "ন"],
  ["e", "প"], ["f", "ফ"], ["g", "ব"], ["h", "ভ"], ["i", "ম"],
  ["j", "য"], ["k", "র"], ["l", "ল"], ["m", "শ"], ["n", "ষ"],
  ["o", "স"], ["p", "হ"], ["q", "ড়"], ["r", "ঢ়"], ["s", "য়"],
  ["t", "ৎ"], ["u", "ং"], ["v", "ঃ"], ["w", "ঁ"],
  // Digits
  ["0", "০"], ["1", "১"], ["2", "২"], ["3", "৩"], ["4", "৪"],
  ["5", "৫"], ["6", "৬"], ["7", "৭"], ["8", "৮"], ["9", "৯"],
  // Matras / vowel signs
  ["v", "ি"], ["vi", "ী"], ["y", "ু"], ["x", "ূ"],
  ["`", "্"], ["~", "্"],
  // Hasanta, anusvara, visarga
  ["&", "ঃ"], ["*", "ঁ"],
  // Punctuation → keep as-is
];

// Common broken-Unicode / corrupted sequences found in Bijoy-exported files
const CORRUPTION_PATTERNS: [RegExp, string][] = [
  // Well-known mojibake sequences
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
  // Replacement characters
  [/\uFFFD+/g, ""],
  // Null bytes
  [/\x00/g, ""],
  // Windows-1252 artifacts that map to Bengali broken chars
  [/\x8d/g, "্"],
  [/\x9d/g, ""],
];

// Bengali header names → field keys
export const BENGALI_HEADER_MAP: Record<string, string> = {
  // Serial
  "ক্রমিক": "serialNo",
  "ক্রমিক নং": "serialNo",
  "ক্রমিক নম্বর": "serialNo",
  "সিরিয়াল": "serialNo",
  "serial no": "serialNo",
  "serial": "serialNo",
  "sl": "serialNo",
  "sl.no": "serialNo",
  // Voter No
  "ভোটার নং": "voterNo",
  "ভোটার নম্বর": "voterNo",
  "ভোটার ক্রমিক নং": "voterNo",
  "voter no": "voterNo",
  "voter number": "voterNo",
  "voterno": "voterNo",
  "voter_no": "voterNo",
  "nid": "voterNo",
  // Name
  "নাম": "name",
  "ভোটারের নাম": "name",
  "name": "name",
  "voter name": "name",
  // Father
  "পিতা": "fatherName",
  "বাবার নাম": "fatherName",
  "পিতার নাম": "fatherName",
  "father": "fatherName",
  "father name": "fatherName",
  "father's name": "fatherName",
  // Mother
  "মাতা": "motherName",
  "মায়ের নাম": "motherName",
  "মাতার নাম": "motherName",
  "mother": "motherName",
  "mother name": "motherName",
  "mother's name": "motherName",
  // Occupation
  "পেশা": "occupation",
  "occupation": "occupation",
  // DOB
  "জন্ম তারিখ": "dob",
  "জন্মতারিখ": "dob",
  "জন্ম": "dob",
  "dob": "dob",
  "date of birth": "dob",
  // Address
  "ঠিকানা": "generalAddress",
  "সাধারণ ঠিকানা": "generalAddress",
  "address": "generalAddress",
  "general address": "generalAddress",
  // Region
  "অঞ্চল": "region",
  "region": "region",
  "বিভাগ": "region",
  "division": "region",
  // District
  "জেলা": "district",
  "district": "district",
  "dist": "district",
  "জেলার নাম": "district",
  // Upazila/Thana
  "উপজেলা": "upazilaThana",
  "থানা": "upazilaThana",
  "উপজেলা/থানা": "upazilaThana",
  "thana": "upazilaThana",
  "upazila": "upazilaThana",
  "upazilla": "upazilaThana",
  // City corp
  "সিটি কর্পোরেশন": "cityCorp",
  "পৌরসভা": "cityCorp",
  "city corp": "cityCorp",
  "municipality": "cityCorp",
  // Post office
  "ডাকঘর": "postOffice",
  "post office": "postOffice",
  "po": "postOffice",
  // Post code
  "পোস্টকোড": "postCode",
  "post code": "postCode",
  "postcode": "postCode",
  "zip": "postCode",
  // Voter area name
  "ভোটার এলাকার নাম": "voterAreaName",
  "ভোটার এলাকা": "voterAreaName",
  "voter area": "voterAreaName",
  "voter area name": "voterAreaName",
  "এলাকার নাম": "voterAreaName",
  // Voter area number
  "ভোটার এলাকার নম্বর": "voterAreaNumber",
  "ভোটার এলাকার নং": "voterAreaNumber",
  "voter area number": "voterAreaNumber",
  "voter area no": "voterAreaNumber",
  // Area code
  "এলাকা কোড": "areaCode",
  "area code": "areaCode",
  "areacode": "areaCode",
  // Ward
  "ওয়ার্ড": "ward",
  "ward": "ward",
  "ward no": "ward",
  "ward number": "ward",
};

/**
 * Apply corruption-pattern fixes to a string.
 * Handles Bijoy mojibake and common encoding artifacts.
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
 * Normalise a header string to a field key.
 * Tries the Bengali map first, then falls back to a normalised English match.
 */
export function headerToField(raw: string): string | null {
  const key = raw.trim().toLowerCase().replace(/\s+/g, " ");
  return BENGALI_HEADER_MAP[key] ?? BENGALI_HEADER_MAP[raw.trim()] ?? null;
}

/**
 * Build a voter record from a {header → value} map.
 * Applies encoding fixes to every value.
 */
export function buildVoterRecord(
  row: Record<string, string>
): {
  voterNo: string;
  name: string;
  [key: string]: string | undefined;
} | null {
  const record: Record<string, string | undefined> = {};

  for (const [rawKey, rawVal] of Object.entries(row)) {
    const field = headerToField(rawKey);
    if (field && rawVal) {
      record[field] = fixBengaliEncoding(String(rawVal));
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
    generalAddress: record["generalAddress"],
    region: record["region"],
    district: record["district"],
    upazilaThana: record["upazilaThana"],
    cityCorp: record["cityCorp"],
    postOffice: record["postOffice"],
    postCode: record["postCode"],
    voterAreaName: record["voterAreaName"],
    voterAreaNumber: record["voterAreaNumber"],
    areaCode: record["areaCode"],
    ward: record["ward"],
    serialNo: record["serialNo"],
  };
}
