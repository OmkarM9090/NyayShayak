import { jest } from "@jest/globals";
import request from "supertest";
import Message from "../models/Message.js";
import { connectTestDb, clearTestDb, closeTestDb } from "./helpers/testDb.js";
import { createUserAndToken } from "./helpers/auth.js";

jest.unstable_mockModule("../services/geminiChat.js", () => ({
  generateLegalChatResponse: async () => ({
    reply: "Safe response",
    suggestions: [],
    contextUsed: false,
    isError: false,
  }),
}));

jest.unstable_mockModule("../services/aiService.js", () => ({
  analyzeDocument: async () => ({
    documentType: "Agreement",
    detectedType: "legal",
    summary: "OK",
    legacyRisks: [],
    chunksProcessed: 1,
    contextUsed: false,
    contextCount: 0,
    structured: {
      document_type: "Agreement",
      classification: "NORMAL",
      decision: "SAFE_TO_USE",
      risk_level: "LOW",
      confidence_score: 90,
      key_warning: "",
      simple_explanation: "OK",
      smart_explanation: "OK",
      top_risks: [],
      detected_risks: [],
      what_user_should_do: [],
      law_reference: [],
    },
  }),
  analyzeLegalQuery: async () => ({
    topic: "Legal Guidance",
    simple_explanation: "OK",
    rules: [],
    penalties: [],
    user_guidance: [],
    contextUsed: false,
    contextCount: 0,
  }),
  detectDocumentType: () => "legal",
  extractTextFromDocx: async () => ({ text: "docx", method: "mammoth-docx" }),
  generateFirDraft: async () => "FIR DRAFT TEXT",
  extractNumericTokens: () => [],
  hasMissingNumericTokens: () => false,
  hasPlaceholders: () => false,
  isLanguageMismatch: () => false,
  isMixedLanguage: () => false,
  parseJSONResponse: (value) => JSON.parse(value),
  removeMarkdownFormatting: (value) => value,
  translateStructuredOutput: async (value) => value,
}));

jest.unstable_mockModule("pdf-parse", () => (
  async () => ({
    text: "Mock PDF text",
    numpages: 1,
  })
));

let app;

beforeAll(async () => {
  process.env.RATE_LIMIT_MAX = "3";
  const { createTestApp } = await import("./helpers/createTestApp.js");
  app = createTestApp();
  await connectTestDb();
});

afterEach(async () => {
  await clearTestDb();
});

afterAll(async () => {
  await closeTestDb();
});

test("Private mode does not store chat messages", async () => {
  const { token } = await createUserAndToken();
  const sessionId = crypto.randomUUID();

  await request(app)
    .post("/api/chat")
    .set("Authorization", `Bearer ${token}`)
    .send({
      sessionId,
      message: "Private mode message",
      language: "en",
      mode: "private",
    })
    .expect(200);

  const messages = await Message.find({ sessionId }).lean();
  expect(messages.length).toBe(0);
});

test("Invalid guest userId is rejected", async () => {
  const response = await request(app)
    .post("/api/chat")
    .send({
      userId: "invalid",
      sessionId: crypto.randomUUID(),
      message: "Hello",
      language: "en",
      mode: "save",
    })
    .expect(400);

  expect(response.body.error).toBe("GUEST_ID_REQUIRED");
});

test("Rate limiting returns 429", async () => {
  const response = await request(app)
    .get("/api/document/health")
    .expect(200);

  await request(app)
    .get("/api/document/health")
    .expect(200);

  await request(app)
    .get("/api/document/health")
    .expect(200);

  const limitedResponse = await request(app)
    .get("/api/document/health")
    .expect(429);

  expect(limitedResponse.body.error).toBe("RATE_LIMITED");
});

test("Chat does not log raw message content", async () => {
  const { token } = await createUserAndToken();
  const spy = jest.spyOn(console, "log").mockImplementation(() => {});
  const secret = "SECRET123";

  await request(app)
    .post("/api/chat")
    .set("Authorization", `Bearer ${token}`)
    .send({
      sessionId: crypto.randomUUID(),
      message: secret,
      language: "en",
      mode: "private",
    })
    .expect(200);

  const logged = spy.mock.calls.some((call) => call.join(" ").includes(secret));
  expect(logged).toBe(false);
  spy.mockRestore();
});
