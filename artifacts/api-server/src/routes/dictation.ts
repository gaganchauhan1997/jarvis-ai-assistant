import { Router } from "express";
  import { getDb, dictationsTable } from "@workspace/db";
  import { desc, sql } from "drizzle-orm";
  import {
    ProcessDictationBody,
    SaveDictationBody,
    DeleteDictationParams,
  } from "@workspace/api-zod";
  import { GoogleGenerativeAI } from "@google/generative-ai";

  if (!process.env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY must be set.");
  }
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

  const router = Router();

  const MODE_PROMPTS: Record<string, string> = {
    clean: `You are a voice dictation assistant. Clean up the following raw speech transcript by removing filler words, fixing grammar and punctuation, and making it flow naturally. Return ONLY the cleaned text.`,
    rephrase: `You are a writing assistant. Rephrase the following text to be more polished and professional. Return ONLY the rephrased text.`,
    bullets: `Convert the following spoken text into clear bullet points starting with "•". Return ONLY the bullet points.`,
    assistant: `You are Jarvis, a helpful AI assistant. Respond helpfully and concisely to the user. Return ONLY your response.`,
  };

  router.post("/dictation/process", async (req, res) => {
    const parsed = ProcessDictationBody.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: "Invalid input" }); return; }
    const { rawText, mode } = parsed.data;
    const prompt = MODE_PROMPTS[mode] ?? MODE_PROMPTS.clean;
    try {
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
      const result = await model.generateContent(`${prompt}\n\nText: ${rawText}`);
      const processedText = result.response.text() || rawText;
      res.json({ processedText, mode });
    } catch (err) {
      req.log.error({ err }, "Failed to process dictation");
      res.status(500).json({ error: "AI processing failed" });
    }
  });

  router.get("/dictation/history", async (req, res) => {
    try {
      const db = getDb();
      const entries = await db.select().from(dictationsTable).orderBy(desc(dictationsTable.createdAt)).limit(50);
      res.json(entries.map((e) => ({ id: e.id, rawText: e.rawText, processedText: e.processedText, mode: e.mode, createdAt: e.createdAt.toISOString() })));
    } catch (err) { req.log.error({ err }, "Failed to fetch history"); res.status(500).json({ error: "Failed to fetch history" }); }
  });

  router.post("/dictation/history", async (req, res) => {
    const parsed = SaveDictationBody.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: "Invalid input" }); return; }
    const { rawText, processedText, mode } = parsed.data;
    const wordCount = processedText.split(/\s+/).filter(Boolean).length;
    try {
      const db = getDb();
      const [entry] = await db.insert(dictationsTable).values({ rawText, processedText, mode, wordCount }).returning();
      res.status(201).json({ id: entry.id, rawText: entry.rawText, processedText: entry.processedText, mode: entry.mode, createdAt: entry.createdAt.toISOString() });
    } catch (err) { req.log.error({ err }, "Failed to save dictation"); res.status(500).json({ error: "Failed to save dictation" }); }
  });

  router.delete("/dictation/history/:id", async (req, res) => {
    const parsed = DeleteDictationParams.safeParse(req.params);
    if (!parsed.success) { res.status(400).json({ error: "Invalid id" }); return; }
    try {
      const db = getDb();
      await db.delete(dictationsTable).where(sql`${dictationsTable.id} = ${parsed.data.id}`);
      res.status(204).send();
    } catch (err) { req.log.error({ err }, "Failed to delete dictation"); res.status(500).json({ error: "Failed to delete" }); }
  });

  router.get("/dictation/stats", async (req, res) => {
    try {
      const db = getDb();
      const [totals] = await db.select({ totalDictations: sql<number>`count(*)::int`, totalWords: sql<number>`coalesce(sum(${dictationsTable.wordCount}), 0)::int` }).from(dictationsTable);
      const [todayRow] = await db.select({ todayDictations: sql<number>`count(*)::int` }).from(dictationsTable).where(sql`${dictationsTable.createdAt} >= current_date`);
      const modeRows = await db.select({ mode: dictationsTable.mode, count: sql<number>`count(*)::int` }).from(dictationsTable).groupBy(dictationsTable.mode).orderBy(desc(sql`count(*)`)).limit(1);
      res.json({ totalDictations: totals.totalDictations ?? 0, totalWords: totals.totalWords ?? 0, todayDictations: todayRow.todayDictations ?? 0, mostUsedMode: modeRows[0]?.mode ?? "clean" });
    } catch (err) { req.log.error({ err }, "Failed to fetch stats"); res.status(500).json({ error: "Failed to fetch stats" }); }
  });

  export default router;
  