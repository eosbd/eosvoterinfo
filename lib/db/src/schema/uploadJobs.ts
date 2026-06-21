import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const uploadJobsTable = pgTable("upload_jobs", {
  id: serial("id").primaryKey(),
  filename: text("filename").notNull(),
  status: text("status").notNull().default("pending"), // pending, processing, done, failed
  recordsProcessed: integer("records_processed"),
  recordsFailed: integer("records_failed"),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertUploadJobSchema = createInsertSchema(uploadJobsTable).omit({ id: true, createdAt: true });
export type InsertUploadJob = z.infer<typeof insertUploadJobSchema>;
export type UploadJob = typeof uploadJobsTable.$inferSelect;
