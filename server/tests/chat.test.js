import { jest } from "@jest/globals";
import request from "supertest";
import Message from "../models/Message.js";
import ChatSession from "../models/ChatSession.js";
import { connectTestDb, clearTestDb, closeTestDb } from "./helpers/testDb.js";
import { createUserAndToken } from "./helpers/auth.js";

jest.unstable_mockModule("../services/geminiChat.js", () => ({
  generateLegalChatResponse: async () => ({
    reply: {
      topic: "Test",
      simple_explanation: "Test response",
      rules: [],
      penalties: [],
      user_guidance: [],
    },
    suggestions: ["See Steps"],
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

const { createTestApp } = await import("./helpers/createTestApp.js");
const app = createTestApp();

beforeAll(async () => {
  await connectTestDb();
});

afterEach(async () => {
  await clearTestDb();
});

afterAll(async () => {
  await closeTestDb();
});

function makeGuestId() {
  return `guest_${crypto.randomUUID()}`;
}

test("POST /api/chat accepts guest userId and returns AI response", async () => {
  const response = await request(app)
    .post("/api/chat")
    .send({
      userId: makeGuestId(),
      sessionId: crypto.randomUUID(),
      message: "Hello",
      language: "en",
      mode: "save",
    })
    .expect(200);

  expect(response.body.reply).toBeDefined();
  expect(response.body.suggestions).toContain("See Steps");
});

test("Guest limit enforces 3 chat requests", async () => {
  const guestId = makeGuestId();

  for (let i = 0; i < 3; i += 1) {
    await request(app)
      .post("/api/chat")
      .send({
        userId: guestId,
        sessionId: crypto.randomUUID(),
        message: `Hello ${i}`,
        language: "en",
        mode: "save",
      })
      .expect(200);
  }

  const response = await request(app)
    .post("/api/chat")
    .send({
      userId: guestId,
      sessionId: crypto.randomUUID(),
      message: "Hello 4",
      language: "en",
      mode: "save",
    })
    .expect(429);

  expect(response.body.error).toBe("LIMIT_EXCEEDED");

  const secondGuest = makeGuestId();
  await request(app)
    .post("/api/chat")
    .send({
      userId: secondGuest,
      sessionId: crypto.randomUUID(),
      message: "Hello from new guest",
      language: "en",
      mode: "save",
    })
    .expect(200);
});

test("Authenticated chat stores encrypted messages and sessions", async () => {
  const { token } = await createUserAndToken();
  const sessionId = crypto.randomUUID();
  const message = "Store this message";

  await request(app)
    .post("/api/chat")
    .set("Authorization", `Bearer ${token}`)
    .send({
      sessionId,
      userId: "ignored",
      message,
      language: "en",
      mode: "save",
    })
    .expect(200);

  const messages = await Message.find({ sessionId }).lean();
  expect(messages.length).toBeGreaterThanOrEqual(1);
  expect(messages[0].encryptedContent.startsWith("v2:")).toBe(true);
  expect(messages[0].encryptedContent).not.toContain(message);

  const sessions = await ChatSession.find({ sessionId }).lean();
  expect(sessions.length).toBe(1);
});

test("Chat history returns decrypted user content", async () => {
  const { token } = await createUserAndToken();
  const sessionId = crypto.randomUUID();
  const message = "History message";

  await request(app)
    .post("/api/chat")
    .set("Authorization", `Bearer ${token}`)
    .send({
      sessionId,
      message,
      language: "en",
      mode: "save",
    })
    .expect(200);

  const history = await request(app)
    .get(`/api/chat/${sessionId}`)
    .set("Authorization", `Bearer ${token}`)
    .expect(200);

  const userEntry = history.body.find((item) => item.role === "user");
  expect(userEntry.content).toBe(message);
});

test("Chat sessions endpoint returns user-specific sessions", async () => {
  const { token } = await createUserAndToken();
  const sessionId = crypto.randomUUID();

  await request(app)
    .post("/api/chat")
    .set("Authorization", `Bearer ${token}`)
    .send({
      sessionId,
      message: "Session test message",
      language: "en",
      mode: "save",
    })
    .expect(200);

  const sessions = await request(app)
    .get("/api/chat/sessions")
    .set("Authorization", `Bearer ${token}`)
    .expect(200);

  expect(sessions.body.some((item) => item.sessionId === sessionId)).toBe(true);
});
