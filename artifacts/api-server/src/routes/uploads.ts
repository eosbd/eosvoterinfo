import { Router, type IRouter } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { eq, desc } from "drizzle-orm";
import { db, uploadJobsTable, votersTable } from "@workspace/db";
import { logger } from "../lib/logger";

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
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = [".zip", ".pdf", ".xlsx", ".docx", ".csv"];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error(`File type not supported: ${ext}. Allowed: ${allowed.join(", ")}`));
    }
  },
});

function fixBengaliEncoding(text: string): string {
  if (!text) return text;
  const replacements: [RegExp, string][] = [
    [/Ï/g, "জে"],
    [/ý/g, "ঞ্জ"],
    [/ÿ/g, "ষ্ট"],
    [/â/g, "আ"],
    [/\uFFFD/g, ""],
  ];
  let result = text;
  for (const [pattern, replacement] of replacements) {
    result = result.replace(pattern, replacement);
  }
  return result.trim();
}

function parseCsvRow(row: string): string[] {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < row.length; i++) {
    const ch = row[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === "," && !inQuotes) {
      cells.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  cells.push(current.trim());
  return cells;
}

const HEADER_MAP: Record<string, string> = {
  "voter no": "voterNo",
  "voterno": "voterNo",
  "voter_no": "voterNo",
  "name": "name",
  "father": "fatherName",
  "father name": "fatherName",
  "mother": "motherName",
  "mother name": "motherName",
  "occupation": "occupation",
  "dob": "dob",
  "address": "generalAddress",
  "general address": "generalAddress",
  "region": "region",
  "district": "district",
  "thana": "upazilaThana",
  "upazila": "upazilaThana",
  "city corp": "cityCorp",
  "post office": "postOffice",
  "post code": "postCode",
  "voter area name": "voterAreaName",
  "voter area number": "voterAreaNumber",
  "area code": "areaCode",
  "ward": "ward",
  "serial no": "serialNo",
  "serial": "serialNo",
};

async function processCsvFile(filePath: string): Promise<{ processed: number; failed: number }> {
  const content = fs.readFileSync(filePath, "utf-8");
  const lines = content.split("\n").filter((l) => l.trim());
  if (lines.length < 2) return { processed: 0, failed: 0 };

  const headers = parseCsvRow(lines[0]).map((h) => h.toLowerCase().trim());
  let processed = 0;
  let failed = 0;

  for (let i = 1; i < lines.length; i++) {
    try {
      const cells = parseCsvRow(lines[i]);
      const record: Record<string, string> = {};
      headers.forEach((h, idx) => {
        const field = HEADER_MAP[h];
        if (field && cells[idx]) {
          record[field] = fixBengaliEncoding(cells[idx]);
        }
      });

      if (!record["name"] && !record["voterNo"]) {
        failed++;
        continue;
      }

      await db.insert(votersTable).values({
        voterNo: record["voterNo"] || `IMPORT-${Date.now()}-${i}`,
        name: record["name"] || "Unknown",
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
      });
      processed++;
    } catch (err) {
      logger.warn({ err, line: i }, "Failed to process CSV row");
      failed++;
    }
  }

  return { processed, failed };
}

async function processUploadJob(jobId: number, file: Express.Multer.File): Promise<void> {
  try {
    const ext = path.extname(file.originalname).toLowerCase();
    let processed = 0;
    let failed = 0;

    if (ext === ".csv") {
      const result = await processCsvFile(file.path);
      processed = result.processed;
      failed = result.failed;
    } else {
      logger.info(
        { filename: file.originalname, ext },
        "File uploaded for extraction. CSV is auto-processed; PDF/XLSX/DOCX/ZIP require the Python extraction pipeline."
      );
    }

    await db
      .update(uploadJobsTable)
      .set({ status: "done", recordsProcessed: processed, recordsFailed: failed })
      .where(eq(uploadJobsTable.id, jobId));
  } catch (err) {
    logger.error({ err }, "Upload processing failed");
    await db
      .update(uploadJobsTable)
      .set({ status: "failed", errorMessage: String(err) })
      .where(eq(uploadJobsTable.id, jobId));
  }
}

router.post("/admin/upload", upload.single("file"), async (req, res): Promise<void> => {
  if (!req.file) {
    res.status(400).json({ error: "No file uploaded" });
    return;
  }

  const [job] = await db
    .insert(uploadJobsTable)
    .values({ filename: req.file.originalname, status: "processing" })
    .returning();

  // Fire-and-forget background processing
  processUploadJob(job.id, req.file).catch((err) => {
    logger.error({ err }, "Background upload processing error");
  });

  res.json({
    jobId: job.id,
    status: "processing",
    message: "File uploaded successfully. Processing has started.",
    recordsProcessed: null,
    recordsFailed: null,
  });
});

router.get("/admin/uploads", async (_req, res): Promise<void> => {
  const jobs = await db
    .select()
    .from(uploadJobsTable)
    .orderBy(desc(uploadJobsTable.createdAt))
    .limit(50);
  res.json(jobs);
});

export default router;
