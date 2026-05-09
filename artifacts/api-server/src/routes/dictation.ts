import { Router } from "express";
import { db } from "@workspace/db";
import { dictationsTable } from "@workspace/db";
import { desc, sql } from "drizzle-orm";
import {
  ProcessDictationBody,
  SaveDictationBody,
  DeleteDictationParams,
} from "@workspace/api-zod";
import { ai } from "@workspace/integrations-gemini-ai";

const router = Router();

const MODE_PROMPTS: Record<string, string> = {
  clean: `You are a voice dictation assistant. Clean up the following raw speech transcript by:
- Removing filler words (um, uh, like, you know, basically, literally, actually, right, so, just)
- Fixing grammar and punctuation
- Making it flow naturally as written text
- Preserving the original meaning and all important content
Return ONLY the cleaned text, nothing else.`,

  rephrase: `You are a writing assistant. Rephrase the following text to make it more polished, professional, and well-structured while keeping the same meaning. Return ONLY the rephrased text, nothing else.`,

  bullets: `You are a note-taking assistant. Convert the following spoken text into a clear bullet-point list. Each bullet should be concise and capture one key point. Return ONLY the bullet points starting with "•", nothing else.`,

  assistant: `You are Jarvis, a helpful AI assistant. The user has spoken to you. Respond helpfully and concisely to their message. Return ONLY your response, nothing else.`,
};

router.post("/dictation/process", async (req, res) => {
  const parsed = ProcessDictationBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input" });
    return;
  }

  const { rawText, mode } = parsed.data;
  const prompt = MODE_PROMPTS[mode] ?? MODE_PROMPTS.clean;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [
        {
          role: "user",
          parts: [{ text: `${prompt}\n\nText: ${rawText}` }],
        },
      ],
      config: { maxOutputTokens: 8192 },
    });

    const processedText = response.text ?? rawText;
    res.json({ processedText, mode });
  } catch (err) {
    req.log.error({ err }, "Failed to process dictation");
    res.status(500).json({ error: "AI processing failed" });
  }
});

router.get("/dictation/history", async (req, res) => {
  try {
    const entries = await db
      .select()
      .from(dictationsTable)
      .orderBy(desc(dictationsTable.createdAt))
      .limit(50);

    res.json(
      entries.map((e) => ({
        id: e.id,
        rawText: e.rawText,
        processedText: e.processedText,
        mode: e.mode,
        createdAt: e.createdAt.toISOString(),
      }))
    );
  } catch (err) {
    req.log.error({ err }, "Failed to fetch history");
    res.status(500).json({ error: "Failed to fetch history" });
  }
});

router.post("/dictation/history", async (req, res) => {
  const parsed = SaveDictationBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input" });
    return;
  }

  const { rawText, processedText, mode } = parsed.data;
  const wordCount = processedText.split(/\s+/).filter(Boolean).length;

  try {
    const [entry] = await db
      .insert(dictationsTable)
      .values({ rawText, processedText, mode, wordCount })
      .returning();

    res.status(201).json({
      id: entry.id,
      rawText: entry.rawText,
      processedText: entry.processedText,
      mode: entry.mode,
      createdAt: entry.createdAt.toISOString(),
    });
  } catch (err) {
    req.log.error({ err }, "Failed to save dictation");
    res.status(500).json({ error: "Failed to save dictation" });
  }
});

router.delete("/dictation/history/:id", async (req, res) => {
  const parsed = DeleteDictationParams.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  try {
    await db
      .delete(dictationsTable)
      .where(sql`${dictationsTable.id} = ${parsed.data.id}`);
    res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Failed to delete dictation");
    res.status(500).json({ error: "Failed to delete" });
  }
});

router.get("/dictation/stats", async (req, res) => {
  try {
    const [totals] = await db
      .select({
        totalDictations: sql<number>`count(*)::int`,
        totalWords: sql<number>`coalesce(sum(${dictationsTable.wordCount}), 0)::int`,
      })
      .from(dictationsTable);

    const [todayRow] = await db
      .select({
        todayDictations: sql<number>`count(*)::int`,
      })
      .from(dictationsTable)
      .where(sql`${dictationsTable.createdAt} >= current_date`);

    const modeRows = await db
      .select({
        mode: dictationsTable.mode,
        count: sql<number>`count(*)::int`,
      })
      .from(dictationsTable)
      .groupBy(dictationsTable.mode)
      .orderBy(desc(sql`count(*)`))
      .limit(1);

    res.json({
      totalDictations: totals.totalDictations ?? 0,
      totalWords: totals.totalWords ?? 0,
      todayDictations: todayRow.todayDictations ?? 0,
      mostUsedMode: modeRows[0]?.mode ?? "clean",
    });
  } catch (err) {
    req.log.error({ err }, "Failed to fetch stats");
    res.status(500).json({ error: "Failed to fetch stats" });
  }
});

export default router;
