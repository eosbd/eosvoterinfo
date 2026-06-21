import { Router, type IRouter } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { eq, desc } from "drizzle-orm";
import { db, uploadJobsTable, votersTable } from "@workspace/db";
import { logger } from "../lib/logger";
import { buildVoterRecord } from "../lib/bengali";
import { extractRowsFromCsvFile } from "../lib/extractors/csvExtractor";
import { extractRowsFromXlsxFile } from "../lib/extractors/xlsxExtractor";
import { extractRowsFromPdfFile } from "../lib/extractors/pdfExtractor";
import { extractRowsFromDocxFile } from "../lib/extractors/docxExtractor";
import { extractRowsFromZipFile } from "../lib/extractors/zipExtractor";

const router: IRouter = Router();

const workspaceRoot = process.cwd().endsWith(path.join("artifacts", "api-server"))
  ? path.resolve(process.cwd(), "../..")
  : process.cwd();

const uploadsDir = path.resolve(workspaceRoot, "artifacts/api-server/uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${unique}-${file.originalname}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 500 * 1024 * 1024 }, // 500 MB — full BD files can be large
  fileFilter: (_req, file, cb) => {
    const allowed = [".zip", ".pdf", ".xlsx", ".xls", ".docx", ".doc", ".csv"];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error(`File type not supported: ${ext}. Allowed: ZIP, PDF, XLSX, XLS, DOCX, DOC, CSV`));
    }
  },
});

/** Extract raw rows from any supported file type */
async function extractRows(filePath: string, originalName: string): Promise<Record<string, string>[]> {
  const ext = path.extname(originalName).toLowerCase();
  switch (ext) {
    case ".csv":
      return extractRowsFromCsvFile(filePath);
    case ".xlsx":
    case ".xls":
      return extractRowsFromXlsxFile(filePath);
    case ".pdf":
      return extractRowsFromPdfFile(filePath);
    case ".docx":
    case ".doc":
      return extractRowsFromDocxFile(filePath);
    case ".zip":
      return extractRowsFromZipFile(filePath);
    default:
      return [];
  }
}

/** Insert rows in batches of 200 for performance */
async function batchInsertVoters(
  rows: Record<string, string>[],
): Promise<{ processed: number; failed: number }> {
  let processed = 0;
  let failed = 0;

  const BATCH = 200;
  for (let i = 0; i < rows.length; i += BATCH) {
    const chunk = rows.slice(i, i + BATCH);
    const records = chunk
      .map((r) => buildVoterRecord(r))
      .filter((r): r is NonNullable<typeof r> => r !== null);

    if (records.length === 0) {
      failed += chunk.length;
      continue;
    }

    try {
      await db.insert(votersTable).values(records);
      processed += records.length;
      failed += chunk.length - records.length;
    } catch (err) {
      // Batch failed — try one-by-one so we salvage good rows
      for (const record of records) {
        try {
          await db.insert(votersTable).values(record);
          processed++;
        } catch (rowErr) {
          logger.warn({ rowErr, voterNo: record.voterNo }, "Row insert failed");
          failed++;
        }
      }
    }
  }

  return { processed, failed };
}

async function processUploadJob(
  jobId: number,
  filePath: string,
  originalName: string,
): Promise<void> {
  try {
    logger.info({ jobId, originalName }, "Starting file extraction");
    const rows = await extractRows(filePath, originalName);
    logger.info({ jobId, rowCount: rows.length }, "Extraction complete, inserting rows");

    const { processed, failed } = await batchInsertVoters(rows);
    logger.info({ jobId, processed, failed }, "Import complete");

    await db
      .update(uploadJobsTable)
      .set({ status: "done", recordsProcessed: processed, recordsFailed: failed })
      .where(eq(uploadJobsTable.id, jobId));
  } catch (err) {
    logger.error({ err, jobId }, "Upload processing failed");
    await db
      .update(uploadJobsTable)
      .set({ status: "failed", errorMessage: String(err) })
      .where(eq(uploadJobsTable.id, jobId));
  }
}

// Single file upload
router.post("/admin/upload", upload.single("file"), async (req, res): Promise<void> => {
  if (!req.file) {
    res.status(400).json({ error: "No file uploaded" });
    return;
  }

  const [job] = await db
    .insert(uploadJobsTable)
    .values({ filename: req.file.originalname, status: "processing" })
    .returning();

  processUploadJob(job.id, req.file.path, req.file.originalname).catch((err) => {
    logger.error({ err }, "Background upload error");
  });

  res.json({
    jobId: job.id,
    status: "processing",
    message: "File received. Extraction started in background.",
    recordsProcessed: null,
    recordsFailed: null,
  });
});

// Multiple files upload (up to 20 at once)
router.post("/admin/upload-multiple", upload.array("files", 20), async (req, res): Promise<void> => {
  const files = req.files as Express.Multer.File[] | undefined;
  if (!files || files.length === 0) {
    res.status(400).json({ error: "No files uploaded" });
    return;
  }

  const jobs = await Promise.all(
    files.map((file) =>
      db
        .insert(uploadJobsTable)
        .values({ filename: file.originalname, status: "processing" })
        .returning()
        .then(([j]) => ({ job: j, file })),
    ),
  );

  for (const { job, file } of jobs) {
    processUploadJob(job.id, file.path, file.originalname).catch((err) => {
      logger.error({ err, jobId: job.id }, "Background upload error");
    });
  }

  res.json({
    jobs: jobs.map(({ job }) => ({
      jobId: job.id,
      filename: job.filename,
      status: "processing",
    })),
    message: `${files.length} file(s) received. Extraction started in background.`,
  });
});

// Job status check
router.get("/admin/uploads/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid job ID" });
    return;
  }
  const [job] = await db.select().from(uploadJobsTable).where(eq(uploadJobsTable.id, id));
  if (!job) {
    res.status(404).json({ error: "Job not found" });
    return;
  }
  res.json(job);
});

router.get("/admin/uploads", async (_req, res): Promise<void> => {
  const jobs = await db
    .select()
    .from(uploadJobsTable)
    .orderBy(desc(uploadJobsTable.createdAt))
    .limit(100);
  res.json(jobs);
});

export default router;
