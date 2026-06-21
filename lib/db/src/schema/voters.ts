import { pgTable, serial, text, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const votersTable = pgTable("voters", {
  id: serial("id").primaryKey(),
  serialNo: text("serial_no"),
  voterNo: text("voter_no").notNull(),
  name: text("name").notNull(),
  fatherName: text("father_name"),
  motherName: text("mother_name"),
  occupation: text("occupation"),
  dob: text("dob"),
  generalAddress: text("general_address"),
  region: text("region"),
  district: text("district"),
  upazilaThana: text("upazila_thana"),
  cityCorp: text("city_corp"),
  postOffice: text("post_office"),
  postCode: text("post_code"),
  voterAreaName: text("voter_area_name"),
  voterAreaNumber: text("voter_area_number"),
  areaCode: text("area_code"),
  ward: text("ward"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertVoterSchema = createInsertSchema(votersTable).omit({ id: true, createdAt: true });
export type InsertVoter = z.infer<typeof insertVoterSchema>;
export type Voter = typeof votersTable.$inferSelect;
