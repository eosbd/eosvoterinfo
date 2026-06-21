import { Router, type IRouter } from "express";
import { eq, ilike, and, count, sql } from "drizzle-orm";
import crypto from "crypto";
import { db, votersTable, adminUsersTable, uploadJobsTable } from "@workspace/db";
import {
  AdminLoginBody,
  ListVotersAdminQueryParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

function hashPassword(password: string): string {
  return crypto.createHash("sha256").update(password + "voter_portal_salt").digest("hex");
}

// Admin login
router.post("/admin/login", async (req, res): Promise<void> => {
  const parsed = AdminLoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { username, password } = parsed.data;
  const hash = hashPassword(password);

  const [user] = await db.select().from(adminUsersTable).where(eq(adminUsersTable.username, username));

  if (!user || user.passwordHash !== hash) {
    res.status(401).json({ error: "Invalid username or password" });
    return;
  }

  (req.session as any).adminId = user.id;
  (req.session as any).adminUsername = user.username;

  res.json({ success: true, user: { id: user.id, username: user.username } });
});

// Admin logout
router.post("/admin/logout", async (req, res): Promise<void> => {
  req.session.destroy(() => {
    res.json({ success: true });
  });
});

// Get current admin session
router.get("/admin/me", async (req, res): Promise<void> => {
  const adminId = (req.session as any).adminId;
  if (!adminId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const [user] = await db.select().from(adminUsersTable).where(eq(adminUsersTable.id, adminId));
  if (!user) {
    res.status(401).json({ error: "Session invalid" });
    return;
  }

  res.json({ id: user.id, username: user.username });
});

// Dashboard stats
router.get("/admin/dashboard", async (req, res): Promise<void> => {
  const [totalResult, byDistrictRaw, byWardRaw, recentUploadsResult] = await Promise.all([
    db.select({ count: count() }).from(votersTable),
    db
      .select({ label: votersTable.district, count: count() })
      .from(votersTable)
      .groupBy(votersTable.district)
      .orderBy(sql`count(*) desc`)
      .limit(10),
    db
      .select({ label: votersTable.ward, count: count() })
      .from(votersTable)
      .groupBy(votersTable.ward)
      .orderBy(sql`count(*) desc`)
      .limit(10),
    db.select({ count: count() }).from(uploadJobsTable),
  ]);

  const totalVoters = Number(totalResult[0]?.count ?? 0);
  const recentUploads = Number(recentUploadsResult[0]?.count ?? 0);

  const byDistrict = byDistrictRaw
    .filter((r) => r.label)
    .map((r) => ({ label: r.label!, count: Number(r.count) }));

  const byWard = byWardRaw
    .filter((r) => r.label)
    .map((r) => ({ label: r.label!, count: Number(r.count) }));

  res.json({ totalVoters, byDistrict, byWard, recentUploads });
});

// Admin voter list
router.get("/admin/voters", async (req, res): Promise<void> => {
  const parsed = ListVotersAdminQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { page, limit, district, search } = parsed.data;
  const conditions = [];

  if (district) {
    conditions.push(ilike(votersTable.district, `%${district}%`));
  }
  if (search) {
    conditions.push(
      and(
        ilike(votersTable.name, `%${search}%`)
      )
    );
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
  const offset = ((page ?? 1) - 1) * (limit ?? 50);

  const [voters, totalResult] = await Promise.all([
    db.select().from(votersTable)
      .where(whereClause)
      .limit(limit ?? 50)
      .offset(offset)
      .orderBy(votersTable.id),
    db.select({ count: count() }).from(votersTable).where(whereClause),
  ]);

  const total = Number(totalResult[0]?.count ?? 0);
  res.json({ voters, total, page: page ?? 1, limit: limit ?? 50 });
});

export { hashPassword };
export default router;
