import { Router, type IRouter } from "express";
import { eq, ilike, and, count, or } from "drizzle-orm";
import { db, votersTable } from "@workspace/db";
import {
  SearchVotersQueryParams,
  GetVoterParams,
  UpdateVoterParams,
  UpdateVoterBody,
  DeleteVoterParams,
  CreateVoterBody,
  PublicApiSearchVoterQueryParams,
} from "@workspace/api-zod";
import { transliterateSearchQuery } from "../lib/bengali";

const router: IRouter = Router();

/** Convert Bengali digits to ASCII for voter number search */
function normDigits(s: string): string {
  return s.replace(/[০-৯]/g, d => String("০১২৩৪৫৬৭৮৯".indexOf(d)));
}

function buildSearchConditions(params: {
  voterNo?: string;
  name?: string;
  fatherName?: string;
  motherName?: string;
  dob?: string;
  district?: string;
  thana?: string;
  ward?: string;
  region?: string;
  cityCorp?: string;
  postOffice?: string;
  postCode?: string;
  voterAreaName?: string;
  generalAddress?: string;
}) {
  const conditions = [];

  if (params.voterNo) {
    // Match both Bengali digit and ASCII digit variants of voter number
    const ascii = normDigits(params.voterNo);
    conditions.push(ilike(votersTable.voterNo, `%${ascii}%`));
  }

  // For text fields: if query is ASCII (English), try transliteration first
  const q = (raw?: string) => {
    if (!raw) return null;
    const bn = transliterateSearchQuery(raw);
    // If transliteration produced Bengali text, search that; otherwise original
    return bn !== raw ? `%${bn}%` : `%${raw}%`;
  };

  const name = q(params.name);
  if (name) conditions.push(ilike(votersTable.name, name));

  const father = q(params.fatherName);
  if (father) conditions.push(ilike(votersTable.fatherName, father));

  const mother = q(params.motherName);
  if (mother) conditions.push(ilike(votersTable.motherName, mother));

  if (params.dob)           conditions.push(ilike(votersTable.dob, `%${params.dob}%`));

  const dist = q(params.district);
  if (dist) conditions.push(ilike(votersTable.district, dist));

  const thana = q(params.thana);
  if (thana) conditions.push(ilike(votersTable.upazilaThana, thana));

  if (params.ward)          conditions.push(ilike(votersTable.ward, `%${params.ward}%`));

  const region = q(params.region);
  if (region) conditions.push(ilike(votersTable.region, region));

  const cityCorp = q(params.cityCorp);
  if (cityCorp) conditions.push(ilike(votersTable.cityCorp, cityCorp));

  if (params.postOffice)    conditions.push(ilike(votersTable.postOffice, `%${params.postOffice}%`));
  if (params.postCode)      conditions.push(ilike(votersTable.postCode, `%${params.postCode}%`));

  const area = q(params.voterAreaName);
  if (area) conditions.push(ilike(votersTable.voterAreaName, area));

  if (params.generalAddress)conditions.push(ilike(votersTable.generalAddress, `%${params.generalAddress}%`));

  return conditions;
}

router.get("/voters/search", async (req, res): Promise<void> => {
  const parsed = SearchVotersQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const {
    voterNo, name, fatherName, motherName, dob,
    district, thana, ward, region, cityCorp,
    postOffice, postCode, voterAreaName, generalAddress,
    page, limit,
  } = parsed.data;

  const conditions = buildSearchConditions({
    voterNo, name, fatherName, motherName, dob,
    district, thana, ward, region, cityCorp,
    postOffice, postCode, voterAreaName, generalAddress,
  });

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
  const effectiveLimit = limit ?? 20;
  const effectivePage = page ?? 1;
  const offset = (effectivePage - 1) * effectiveLimit;

  const [voters, totalResult] = await Promise.all([
    db.select().from(votersTable)
      .where(whereClause)
      .limit(effectiveLimit)
      .offset(offset)
      .orderBy(votersTable.id),
    db.select({ count: count() }).from(votersTable).where(whereClause),
  ]);

  const total = Number(totalResult[0]?.count ?? 0);
  res.json({ voters, total, page: effectivePage, limit: effectiveLimit });
});

router.get("/voters/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = GetVoterParams.safeParse({ id: parseInt(raw, 10) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [voter] = await db.select().from(votersTable).where(eq(votersTable.id, params.data.id));
  if (!voter) {
    res.status(404).json({ error: "ভোটার পাওয়া যায়নি" });
    return;
  }

  res.json(voter);
});

router.patch("/voters/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = UpdateVoterParams.safeParse({ id: parseInt(raw, 10) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateVoterBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [voter] = await db.update(votersTable).set(parsed.data).where(eq(votersTable.id, params.data.id)).returning();
  if (!voter) {
    res.status(404).json({ error: "ভোটার পাওয়া যায়নি" });
    return;
  }

  res.json(voter);
});

router.delete("/voters/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = DeleteVoterParams.safeParse({ id: parseInt(raw, 10) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [deleted] = await db.delete(votersTable).where(eq(votersTable.id, params.data.id)).returning();
  if (!deleted) {
    res.status(404).json({ error: "ভোটার পাওয়া যায়নি" });
    return;
  }

  res.sendStatus(204);
});

router.post("/voters", async (req, res): Promise<void> => {
  const parsed = CreateVoterBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [voter] = await db.insert(votersTable).values(parsed.data).returning();
  res.status(201).json(voter);
});

router.get("/v1/search-voter", async (req, res): Promise<void> => {
  const parsed = PublicApiSearchVoterQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { voterNo, name, district, thana } = parsed.data;
  const conditions = buildSearchConditions({ voterNo, name, district, thana });
  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const voters = await db.select().from(votersTable).where(whereClause).limit(50);
  res.json({ voters, total: voters.length, page: 1, limit: 50 });
});

export default router;
