import { pgTable, text, serial, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const dictationsTable = pgTable("dictations", {
  id: serial("id").primaryKey(),
  rawText: text("raw_text").notNull(),
  processedText: text("processed_text").notNull(),
  mode: text("mode").notNull().default("clean"),
  wordCount: integer("word_count").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertDictationSchema = createInsertSchema(dictationsTable).omit({ id: true, createdAt: true });
export type InsertDictation = z.infer<typeof insertDictationSchema>;
export type Dictation = typeof dictationsTable.$inferSelect;
