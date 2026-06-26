import path from "path";
import { eq } from "drizzle-orm";
import { db, uploadJobsTable, votersTable } from "@workspace/db";
import { logger } from "./logger";
import { buildVoterRecord } from "./bengali";
import { extractRowsFromCsvFile } from "./extractors/csvExtractor";
import { extractRowsFromXlsxFile } from "./extractors/xlsxExtractor";
import { extractRowsFromPdfFile } from "./extractors/pdfExtractor";
import { extractRowsFromDocxFile } from "./extractors/docxExtractor";
import { extractRowsFromZipFile } from "./extractors/zipExtractor";

const BATCH_SIZE = 500;

export async function extractRows(filePath: string, originalName: string): Promise<Record<string, string>[]> {
  const ext = path.extname(originalName).toLowerCase();
  switch (ext) {
    case ".csv":
      return await extractRowsFromCsvFile(filePath);
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

export async function batchInsertVoters(
  rows: Record<string, string>[],
  uploadJobId: number,
): Promise<{ processed: number; failed: number }> {
  let processed = 0;
  let failed = 0;

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const chunk = rows.slice(i, i + BATCH_SIZE);
    const records = chunk
      .map((r) => buildVoterRecord(r))
      .filter((r): r is NonNullable<typeof r> => r !== null)
      .map((r) => ({ ...r, uploadJobId }));

    if (records.length === 0) {
      failed += chunk.length;
      continue;
    }

    try {
      await db.insert(votersTable).values(records);
      processed += records.length;
      failed += chunk.length - records.length;
    } catch {
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

    // Log progress every 10k rows
    if (processed % 10000 < BATCH_SIZE) {
      logger.info({ uploadJobId, processed, failed }, "Import progress");
    }
  }

  return { processed, failed };
}

export async function processUploadJob(
  jobId: number,
  filePath: string,
  originalName: string,
): Promise<void> {
  try {
    logger.info({ jobId, originalName }, "Starting file extraction");
    const rows = await extractRows(filePath, originalName);
    logger.info({ jobId, rowCount: rows.length }, "Extraction complete, inserting rows");

    const { processed, failed } = await batchInsertVoters(rows, jobId);
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
