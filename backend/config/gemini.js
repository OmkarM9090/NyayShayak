// config/gemini.js
// Initialize Google Generative AI (Gemini) client
// This file exports a reusable Gemini model instance

import { GoogleGenerativeAI } from "@google/generative-ai";

// Initialize with API key from environment variables
// Make sure GEMINI_API_KEY is set in your .env file
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Get the Gemini model instance with safe defaults for current API availability.
const preferredModel = process.env.GEMINI_MODEL || "gemini-2.5-flash-lite";
const blockedModels = new Set(["gemini-pro", "gemini-1.5-flash"]);
const resolvedModel = blockedModels.has(preferredModel)
  ? "gemini-2.5-flash-lite"
  : preferredModel;

const geminiModel = genAI.getGenerativeModel({
  model: resolvedModel,
});

export { geminiModel, genAI };
