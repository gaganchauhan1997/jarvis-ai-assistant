import { GoogleGenAI } from "@google/genai";

const replitBaseUrl = process.env.AI_INTEGRATIONS_GEMINI_BASE_URL;
const replitApiKey = process.env.AI_INTEGRATIONS_GEMINI_API_KEY;
const directApiKey = process.env.GEMINI_API_KEY;

if (!replitBaseUrl && !directApiKey) {
  throw new Error(
    "Either AI_INTEGRATIONS_GEMINI_BASE_URL + AI_INTEGRATIONS_GEMINI_API_KEY (Replit) " +
    "or GEMINI_API_KEY (production) must be set.",
  );
}

export const ai = new GoogleGenAI({
  apiKey: (replitBaseUrl ? replitApiKey : directApiKey) ?? "",
  ...(replitBaseUrl
    ? {
        httpOptions: {
          apiVersion: "",
          baseUrl: replitBaseUrl,
        },
      }
    : {}),
});
