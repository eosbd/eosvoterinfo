import { Router, type IRouter } from "express";
import { eq, ilike, and, or, count, sql } from "drizzle-orm";
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

const router: IRouter = Router();

function buildSearchConditions(params: {
  voterNo?: string;
  name?: string;
  fatherName?: string;
  district?: string;
  thana?: string;
  ward?: string;
}) {
  const conditions = [];
  if (params.voterNo) {
    conditions.push(ilike(votersTable.voterNo, `%${params.voterNo}%`));
  }
  if (params.name) {
    conditions.push(ilike(votersTable.name, `%${params.name}%`));
  }
  if (params.fatherName) {
    conditions.push(ilike(votersTable.fatherName, `%${params.fatherName}%`));
  }
  if (params.district) {
    conditions.push(ilike(votersTable.district, `%${params.district}%`));
  }
  if (params.thana) {
    conditions.push(ilike(votersTable.upazilaThana, `%${params.thana}%`));
  }
  if (params.ward) {
    conditions.push(ilike(votersTable.ward, `%${params.ward}%`));
  }
  return conditions;
}

// Public search
router.get("/voters/search", async (req, res): Promise<void> => {
  const parsed = SearchVotersQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { voterNo, name, fatherName, district, thana, ward, page, limit } = parsed.data;
  const conditions = buildSearchConditions({ voterNo, name, fatherName, district, thana, ward });

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
  const offset = ((page ?? 1) - 1) * (limit ?? 20);

  const [voters, totalResult] = await Promise.all([
    db.select().from(votersTable)
      .where(whereClause)
      .limit(limit ?? 20)
      .offset(offset)
      .orderBy(votersTable.id),
    db.select({ count: count() }).from(votersTable).where(whereClause),
  ]);

  const total = Number(totalResult[0]?.count ?? 0);
  res.json({ voters, total, page: page ?? 1, limit: limit ?? 20 });
});

// Get single voter
router.get("/voters/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = GetVoterParams.safeParse({ id: parseInt(raw, 10) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [voter] = await db.select().from(votersTable).where(eq(votersTable.id, params.data.id));
  if (!voter) {
    res.status(404).json({ error: "Voter not found" });
    return;
  }

  res.json(voter);
});

// Update voter (admin)
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
    res.status(404).json({ error: "Voter not found" });
    return;
  }

  res.json(voter);
});

// Delete voter (admin)
router.delete("/voters/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = DeleteVoterParams.safeParse({ id: parseInt(raw, 10) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [deleted] = await db.delete(votersTable).where(eq(votersTable.id, params.data.id)).returning();
  if (!deleted) {
    res.status(404).json({ error: "Voter not found" });
    return;
  }

  res.sendStatus(204);
});

// Create voter (admin)
router.post("/voters", async (req, res): Promise<void> => {
  const parsed = CreateVoterBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [voter] = await db.insert(votersTable).values(parsed.data).returning();
  res.status(201).json(voter);
});

// Public API endpoint
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
