import { jest } from "@jest/globals";
import request from "supertest";
import Analysis from "../models/Analysis.js";
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
    text: "This is a test PDF document with enough text.",
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

const MINIMAL_PDF = Buffer.from(`%PDF-1.1\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 200] /Contents 4 0 R >>\nendobj\n4 0 obj\n<< /Length 96 >>\nstream\nBT\n/F1 12 Tf\n72 120 Td\n(This is a test PDF document with enough text.) Tj\nET\nendstream\nendobj\nxref\n0 5\n0000000000 65535 f\n0000000010 00000 n\n0000000060 00000 n\n0000000117 00000 n\n0000000220 00000 n\ntrailer\n<< /Root 1 0 R /Size 5 >>\nstartxref\n320\n%%EOF`);

function makeGuestId() {
  return `guest_${crypto.randomUUID()}`;
}

test("POST /api/document/analyze succeeds for guest", async () => {
  const response = await request(app)
    .post("/api/document/analyze")
    .field("userId", makeGuestId())
    .field("sessionId", crypto.randomUUID())
    .field("language", "en")
    .field("mode", "save")
    .attach("document", MINIMAL_PDF, { filename: "sample.pdf", contentType: "application/pdf" })
    .expect(200);

  expect(response.body.success).toBe(true);
  expect(response.body.data.analysis.documentType).toBe("Agreement");
});

test("Guest limit allows 1 document analysis", async () => {
  const guestId = makeGuestId();

  await request(app)
    .post("/api/document/analyze")
    .field("userId", guestId)
    .field("sessionId", crypto.randomUUID())
    .field("language", "en")
    .field("mode", "save")
    .attach("document", MINIMAL_PDF, { filename: "sample.pdf", contentType: "application/pdf" })
    .expect(200);

  const response = await request(app)
    .post("/api/document/analyze")
    .field("userId", guestId)
    .field("sessionId", crypto.randomUUID())
    .field("language", "en")
    .field("mode", "save")
    .attach("document", MINIMAL_PDF, { filename: "sample.pdf", contentType: "application/pdf" })
    .expect(429);

  expect(response.body.error).toBe("LIMIT_EXCEEDED");
});

test("Analysis history returns user-specific structured data", async () => {
  const { token } = await createUserAndToken();
  const sessionId = crypto.randomUUID();

  await request(app)
    .post("/api/document/analyze-text")
    .set("Authorization", `Bearer ${token}`)
    .send({
      userId: "ignored",
      sessionId,
      text: "Sample text describing obligations between parties in plain language.",
      language: "en",
      mode: "save",
    })
    .expect(200);

  const sessions = await request(app)
    .get("/api/document/sessions")
    .set("Authorization", `Bearer ${token}`)
    .expect(200);

  expect(sessions.body.some((item) => item.sessionId === sessionId)).toBe(true);

  const history = await request(app)
    .get(`/api/document/${sessionId}`)
    .set("Authorization", `Bearer ${token}`)
    .expect(200);

  const aiEntry = history.body.find((item) => item.role === "ai");
  expect(aiEntry.structured).toBeTruthy();
});

test("Analysis stored content is encrypted", async () => {
  const { token } = await createUserAndToken();
  const sessionId = crypto.randomUUID();

  await request(app)
    .post("/api/document/analyze-text")
    .set("Authorization", `Bearer ${token}`)
    .send({
      sessionId,
      text: "Confidential text about obligations between parties and delivery terms.",
      language: "en",
      mode: "save",
    })
    .expect(200);

  const record = await Analysis.findOne({ sessionId }).lean();
  expect(record.encryptedContent.startsWith("v2:")).toBe(true);
  expect(record.encryptedContent).not.toContain("Confidential document text.");
});
