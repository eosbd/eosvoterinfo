import { Router, type IRouter } from "express";
import { eq, ilike, and, count, sql } from "drizzle-orm";
import crypto from "crypto";
import path from "path";
import fs from "fs";
import { db, votersTable, adminUsersTable, uploadJobsTable } from "@workspace/db";
import {
  AdminLoginBody,
  ListVotersAdminQueryParams,
} from "@workspace/api-zod";
import { extractRowsFromZipFile } from "../lib/extractors/zipExtractor";
import { buildVoterRecord } from "../lib/bengali";
import { logger } from "../lib/logger";

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

// Delete an upload job record AND all its associated voter data
router.delete("/admin/uploads/:id", async (req, res): Promise<void> => {
  const adminId = (req.session as any).adminId;
  if (!adminId) { res.status(401).json({ error: "Not authenticated" }); return; }

  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [job] = await db.select().from(uploadJobsTable).where(eq(uploadJobsTable.id, id));
  if (!job) { res.status(404).json({ error: "Upload not found" }); return; }

  // Delete all voters imported from this job
  const deleted = await db.delete(votersTable).where(eq(votersTable.uploadJobId, id)).returning({ id: votersTable.id });
  logger.info({ uploadJobId: id, votersDeleted: deleted.length }, "Deleted voters for upload job");

  // Delete the job record itself
  await db.delete(uploadJobsTable).where(eq(uploadJobsTable.id, id));

  res.json({ success: true, votersDeleted: deleted.length });
});

// Reprocess all stored ZIPs with the corrected Bengali extractor
router.post("/admin/reprocess", async (req, res): Promise<void> => {
  const adminId = (req.session as any).adminId;
  if (!adminId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const workspaceRoot = process.cwd().endsWith(path.join("artifacts", "api-server"))
    ? path.resolve(process.cwd(), "../..")
    : process.cwd();
  const uploadsDir = path.resolve(workspaceRoot, "artifacts/api-server/uploads");

  // Find all ZIP files in uploads dir
  let zipFiles: string[] = [];
  try {
    zipFiles = fs.readdirSync(uploadsDir)
      .filter((f) => f.toLowerCase().endsWith(".zip"))
      .map((f) => path.join(uploadsDir, f));
  } catch {
    res.status(500).json({ error: "Could not read uploads directory" });
    return;
  }

  if (zipFiles.length === 0) {
    res.json({ success: true, inserted: 0, message: "No ZIP files found to reprocess." });
    return;
  }

  logger.info({ zipFiles }, "Starting reprocess of all ZIPs");

  // Fetch all upload job records so we can match ZIPs → jobId
  const allJobs = await db.select().from(uploadJobsTable);

  // Clear existing voter data
  await db.delete(votersTable);
  logger.info("Cleared existing voter records");

  let totalInserted = 0;
  const BATCH_SIZE = 200;

  for (const zipPath of zipFiles) {
    try {
      logger.info({ zipPath }, "Reprocessing ZIP");

      // Match this ZIP file to its upload_job record by filename
      const zipBasename = path.basename(zipPath);
      const matchedJob = allJobs.find((j) => zipPath.includes(j.filename) || zipBasename.includes(j.filename) || j.filename === zipBasename);
      let uploadJobId: number | null = matchedJob?.id ?? null;

      // If no job record found, create one so delete works in the future
      if (!uploadJobId) {
        const originalName = zipBasename.replace(/^\d+-\d+-/, "");
        const [newJob] = await db.insert(uploadJobsTable).values({ filename: originalName, status: "done" }).returning();
        uploadJobId = newJob.id;
        logger.info({ zipPath, uploadJobId }, "Created missing upload job record");
      }

      const rows = await extractRowsFromZipFile(zipPath);
      logger.info({ zipPath, rows: rows.length }, "ZIP extraction complete");

      const records = rows
        .map((r) => buildVoterRecord(r))
        .filter((r): r is NonNullable<typeof r> => r !== null);

      for (let i = 0; i < records.length; i += BATCH_SIZE) {
        const batch = records.slice(i, i + BATCH_SIZE);
        await db.insert(votersTable).values(
          batch.map((r) => ({
            uploadJobId,
            voterNo: r.voterNo,
            name: r.name,
            fatherName: r.fatherName,
            motherName: r.motherName,
            occupation: r.occupation,
            dob: r.dob,
            generalAddress: r.generalAddress,
            region: r.region,
            district: r.district,
            upazilaThana: r.upazilaThana,
            cityCorp: r.cityCorp,
            postOffice: r.postOffice,
            postCode: r.postCode,
            voterAreaName: r.voterAreaName,
            voterAreaNumber: r.voterAreaNumber,
            areaCode: r.areaCode,
            ward: r.ward,
            serialNo: r.serialNo,
          }))
        );
        totalInserted += batch.length;
      }
    } catch (err) {
      logger.error({ err, zipPath }, "Failed to reprocess ZIP");
    }
  }

  logger.info({ totalInserted }, "Reprocess complete");
  res.json({ success: true, inserted: totalInserted, zipsProcessed: zipFiles.length });
});

export { hashPassword };
export default router;
