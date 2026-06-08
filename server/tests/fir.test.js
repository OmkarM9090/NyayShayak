import { jest } from "@jest/globals";
import request from "supertest";
import FIR from "../models/FIR.js";
import { connectTestDb, clearTestDb, closeTestDb } from "./helpers/testDb.js";
import { createUserAndToken } from "./helpers/auth.js";

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

test("POST /api/generate-fir succeeds for guest", async () => {
  const response = await request(app)
    .post("/api/generate-fir")
    .send({
      userId: makeGuestId(),
      sessionId: crypto.randomUUID(),
      user_input: "Test FIR input",
      language: "en",
      mode: "save",
    })
    .expect(200);

  expect(response.body.success).toBe(true);
  expect(response.body.fir_text).toContain("FIR DRAFT TEXT");
});

test("Guest limit allows 1 FIR generation", async () => {
  const guestId = makeGuestId();

  await request(app)
    .post("/api/generate-fir")
    .send({
      userId: guestId,
      sessionId: crypto.randomUUID(),
      user_input: "Test FIR input",
      language: "en",
      mode: "save",
    })
    .expect(200);

  const response = await request(app)
    .post("/api/generate-fir")
    .send({
      userId: guestId,
      sessionId: crypto.randomUUID(),
      user_input: "Test FIR input again",
      language: "en",
      mode: "save",
    })
    .expect(429);

  expect(response.body.error).toBe("LIMIT_EXCEEDED");
});

test("FIR history returns user-specific data", async () => {
  const { token } = await createUserAndToken();
  const sessionId = crypto.randomUUID();

  await request(app)
    .post("/api/generate-fir")
    .set("Authorization", `Bearer ${token}`)
    .send({
      sessionId,
      user_input: "Test FIR input",
      language: "en",
      mode: "save",
    })
    .expect(200);

  const history = await request(app)
    .get("/api/fir/history?limit=5")
    .set("Authorization", `Bearer ${token}`)
    .expect(200);

  expect(history.body.success).toBe(true);
  expect(history.body.data[0].sessionId).toBe(sessionId);
});

test("FIR stored content is encrypted", async () => {
  const { token } = await createUserAndToken();
  const sessionId = crypto.randomUUID();

  await request(app)
    .post("/api/generate-fir")
    .set("Authorization", `Bearer ${token}`)
    .send({
      sessionId,
      user_input: "Confidential FIR text",
      language: "en",
      mode: "save",
    })
    .expect(200);

  const record = await FIR.findOne({ sessionId }).lean();
  expect(record.encryptedContent.startsWith("v2:")).toBe(true);
  expect(record.encryptedContent).not.toContain("Confidential FIR text");
});
