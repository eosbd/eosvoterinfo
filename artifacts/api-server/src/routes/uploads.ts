import { Router, type IRouter } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { eq, desc } from "drizzle-orm";
import { db, uploadJobsTable, votersTable } from "@workspace/db";
import { logger } from "../lib/logger";
import { buildVoterRecord } from "../lib/bengali";
import { extractRowsFromCsvFile } from "../lib/extractors/csvExtractor";
import { extractRows, processUploadJob } from "../lib/uploadProcessor";

const chunksBaseDir = path.join("/tmp", "upload_chunks");

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

const chunkStorage = multer.diskStorage({
  destination: (req, _file, cb) => {
    const uploadId = req.body?.uploadId || "unknown";
    const dir = path.join(chunksBaseDir, uploadId);
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, _file, cb) => {
    const idx = req.body?.chunkIndex ?? "0";
    cb(null, `${String(idx).padStart(6, "0")}.chunk`);
  },
});
const chunkUpload = multer({ storage: chunkStorage });

// Chunked upload — receive one chunk at a time
router.post("/admin/upload-chunk", chunkUpload.single("chunk"), async (req, res): Promise<void> => {
  const { uploadId, chunkIndex, totalChunks } = req.body;
  if (!uploadId || chunkIndex === undefined || !totalChunks) {
    res.status(400).json({ error: "uploadId, chunkIndex, totalChunks required" });
    return;
  }
  if (!req.file) {
    res.status(400).json({ error: "No chunk data received" });
    return;
  }
  res.json({ received: true, chunkIndex: Number(chunkIndex), totalChunks: Number(totalChunks) });
});

// Chunked upload — finalize: concatenate chunks → move to uploads dir → start job
router.post("/admin/upload-finalize", async (req, res): Promise<void> => {
  const adminId = (req.session as any).adminId;
  if (!adminId) { res.status(401).json({ error: "Not authenticated" }); return; }

  const { uploadId, originalname, totalChunks } = req.body;
  if (!uploadId || !originalname || !totalChunks) {
    res.status(400).json({ error: "uploadId, originalname, totalChunks required" });
    return;
  }

  const chunkDir = path.join(chunksBaseDir, uploadId);
  const n = Number(totalChunks);

  for (let i = 0; i < n; i++) {
    const chunkPath = path.join(chunkDir, `${String(i).padStart(6, "0")}.chunk`);
    if (!fs.existsSync(chunkPath)) {
      res.status(400).json({ error: `Missing chunk ${i}` });
      return;
    }
  }

  const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
  const finalName = `${unique}-${originalname}`;
  const finalPath = path.join(uploadsDir, finalName);

  try {
    const out = fs.createWriteStream(finalPath);
    for (let i = 0; i < n; i++) {
      const chunkPath = path.join(chunkDir, `${String(i).padStart(6, "0")}.chunk`);
      await new Promise<void>((resolve, reject) => {
        const rs = fs.createReadStream(chunkPath);
        rs.on("error", reject);
        rs.on("end", resolve);
        rs.pipe(out, { end: false });
      });
    }
    await new Promise<void>((resolve, reject) => {
      out.on("error", reject);
      out.on("finish", resolve);
      out.end();
    });

    fs.rmSync(chunkDir, { recursive: true, force: true });

    const [job] = await db
      .insert(uploadJobsTable)
      .values({ filename: originalname, status: "processing" })
      .returning();

    processUploadJob(job.id, finalPath, originalname).catch((err) => {
      logger.error({ err }, "Background upload error");
    });

    res.json({ jobId: job.id, status: "processing", message: "ফাইল একত্রিত হয়েছে। প্রক্রিয়াকরণ শুরু হয়েছে।" });
  } catch (err) {
    logger.error({ err }, "Chunk finalize error");
    res.status(500).json({ error: String(err) });
  }
});

/**
 * Preview endpoint — extract rows from a file and return them WITHOUT inserting.
 */
router.post("/admin/upload-preview", upload.single("file"), async (req, res): Promise<void> => {
  if (!req.file) {
    res.status(400).json({ error: "No file uploaded" });
    return;
  }

  const filePath = req.file.path;
  try {
    const rawRows = await extractRows(filePath, req.file.originalname);
    const mappedRows = rawRows
      .map((r) => buildVoterRecord(r))
      .filter((r): r is NonNullable<typeof r> => r !== null);

    res.json({
      filename: req.file.originalname,
      totalRaw: rawRows.length,
      totalMapped: mappedRows.length,
      sampleRawRows: rawRows.slice(0, 10),
      sampleMappedRows: mappedRows.slice(0, 10),
      message:
        rawRows.length === 0
          ? "No rows extracted — check logs for header detection details"
          : mappedRows.length === 0
            ? "Rows found but none could be mapped — check sampleRawRows to see what headers were detected"
            : `${mappedRows.length} of ${rawRows.length} rows successfully mapped`,
    });
  } catch (err) {
    req.log.error({ err }, "Preview extraction failed");
    res.status(500).json({ error: String(err) });
  } finally {
    try { fs.unlinkSync(filePath); } catch { /* ignore */ }
  }
});

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

// Multiple files upload (unlimited)
router.post("/admin/upload-multiple", upload.array("files"), async (req, res): Promise<void> => {
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
