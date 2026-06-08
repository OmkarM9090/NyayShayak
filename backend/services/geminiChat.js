import { geminiModel } from "../config/gemini.js";
import {
  ensureSupportedLanguage,
  getLanguageInstruction,
  getLanguageLabel,
} from "../config/languages.js";
import {
  extractNumericTokens,
  hasMissingNumericTokens,
  hasPlaceholders,
  isLanguageMismatch,
  isMixedLanguage,
  parseJSONResponse,
  removeMarkdownFormatting,
  translateStructuredOutput,
} from "./aiService.js";
import {
  buildContextString,
  filterRelevantResults,
  runPythonSearch,
} from "./legalRag.js";

function buildSuggestions(query) {
  const normalizedQuery = query.toLowerCase();
  const suggestions = ["See Steps"];

  if (normalizedQuery.includes("chori") || normalizedQuery.includes("theft")) {
    suggestions.unshift("Generate FIR");
  }

  if (normalizedQuery.includes("agreement")) {
    suggestions.push("Analyze Document");
  }

  return [...new Set(suggestions)];
}

function inferLanguageInstruction(language) {
  const resolvedLanguage = ensureSupportedLanguage(language);
  return getLanguageInstruction(resolvedLanguage);
}

function hasImpactPhrase(text, language) {
  const normalized = String(text || "");
  const resolvedLanguage = ensureSupportedLanguage(language);

  if (resolvedLanguage === "hi") {
    return /(नुकसान|पैसे|खर्च|जुर्माना|देरी|हानि|गमाव)/.test(normalized);
  }

  if (resolvedLanguage === "mr") {
    return /(नुकसान|पैसे|खर्च|दंड|विलंब|हानी|गमाव)/.test(normalized);
  }

  return /(lose|loss|pay|penalty|delay|risk|harm|cost|money|property|time)/i.test(normalized);
}

function hasMissingImpactInRisks(topRisks, language) {
  if (!Array.isArray(topRisks) || topRisks.length === 0) {
    return false;
  }

  return topRisks.some((risk) => {
    const value = String(risk || "").trim();
    if (!value) {
      return true;
    }
    if (value.includes(":")) {
      return false;
    }
    return !hasImpactPhrase(value, language);
  });
}

function ensureRiskImpactText(risk) {
  const text = String(risk || "").trim();
  if (!text) {
    return text;
  }
  if (text.includes(":")) {
    return text;
  }
  if (/(lose|loss|pay|penalty|delay|risk|harm|cost|money|property|time)/i.test(text)) {
    return text;
  }
  return `${text}: May cause money loss, penalty, or delay.`;
}

function cleanTextForMatching(text) {
  let cleaned = String(text || "").normalize("NFKC");
  cleaned = cleaned.replace(/[\u0000-\u001f]/g, " ");
  cleaned = cleaned.replace(/[“”]/g, '"').replace(/[’‘]/g, "'");
  cleaned = cleaned.replace(/[‐‑–—]/g, "-");
  cleaned = cleaned.replace(/[^A-Za-z0-9\s]/g, " ");
  cleaned = cleaned.replace(/\s+/g, " ").trim();

  const tokens = cleaned.split(" ").map((token) => {
    if (!token) {
      return "";
    }

    let fixed = token;
    const hasDigits = /\d/.test(fixed);
    const hasLetters = /[A-Za-z]/.test(fixed);

    if (hasDigits && hasLetters) {
      fixed = fixed.replace(/[oO]/g, "0").replace(/[lI]/g, "1");
    }

    fixed = fixed.replace(/rn/gi, "m").replace(/vv/gi, "w");

    return fixed;
  });

  return tokens.filter(Boolean).join(" ");
}

function normalizeForMatching(text) {
  return cleanTextForMatching(text).toLowerCase();
}

function isRentalContext(normalized) {
  return /rental|lease|tenant|landlord|rent|premises|tenancy/i.test(normalized);
}

function hasRefundableDeposit(normalized) {
  return /refundable\s+deposit|deposit\s+is\s+refundable|fully\s+refundable|refundable\s+security\s+deposit/i.test(
    normalized
  );
}

function hasNonRefundableDeposit(normalized) {
  return /non[-\s]?refundable\s+deposit|deposit\s+is\s+non[-\s]?refundable|deposit\s+not\s+refundable|no\s+refund\s+of\s+deposit/i.test(
    normalized
  );
}

function hasAdvancePaymentBeforeService(normalized) {
  return (
    /advance\s+payment\s+(?:before|prior)\s+(?:service|joining|delivery|work|activation|possession)/i.test(
      normalized
    ) ||
    /pay(?:ment)?\s+before\s+(?:service|joining|delivery|work|activation|possession)/i.test(normalized)
  );
}

function hasUpfrontFeeDemand(normalized) {
  return /(registration\s+fee|processing\s+fee|training\s+fee|pay\s+to\s+join|fee\s+to\s+join)/i.test(
    normalized
  );
}

function hasUpfrontPaymentRisk(normalized) {
  if (hasNonRefundableDeposit(normalized) || hasAdvancePaymentBeforeService(normalized)) {
    return true;
  }

  if (hasRefundableDeposit(normalized) && isRentalContext(normalized)) {
    return false;
  }

  return hasUpfrontFeeDemand(normalized);
}

function detectFraudIndicators(text) {
  const normalized = normalizeForMatching(text);
  const upfrontPayment = hasUpfrontPaymentRisk(normalized);
  const urgency = /within\s+24\s+hours|within\s+24\s*h|urgent|immediately|limited\s+time/i.test(
    normalized
  );
  const personalData =
    /aadhaar|pan\s*card|bank\s*details|otp|cvv|password|upi\s*pin|account\s*details/i.test(
      normalized
    );
  const unrealistic =
    /guaranteed\s+job|assured\s+job|too\s+good\s+to\s+be\s+true|no\s+experience\s+required|high\s+salary\s+without\s+experience|guaranteed\s+income|double\s+your\s+money|instant\s+joining/i.test(
      normalized
    );

  return {
    upfrontPayment,
    urgency,
    personalData,
    unrealistic,
  };
}

function isFraudLikely(indicators) {
  return Boolean(
    indicators.upfrontPayment || indicators.urgency || indicators.personalData || indicators.unrealistic
  );
}

function detectBalancedAgreementSignals(text) {
  const normalized = normalizeForMatching(text);
  const equalRights = /(both\s+parties|either\s+party|mutual|equal\s+rights)/i.test(normalized);
  const equalNotice =
    /notice\s+period\s+of\s+\d+\s+days?\s+for\s+both\s+parties|either\s+party\s+may\s+terminate\s+with\s+\d+\s+days?\s+notice|mutual\s+notice\s+period|same\s+notice\s+period\s+for\s+both\s+parties/i.test(
      normalized
    );
  const noHiddenCharges = /(no\s+hidden\s+charges|no\s+extra\s+charges|no\s+additional\s+charges)/i.test(
    normalized
  );
  const balancedResponsibilities = /(responsibilities\s+of\s+both\s+parties|each\s+party\s+is\s+responsible|mutual\s+obligations|shared\s+responsibilities)/i.test(
    normalized
  );

  return equalRights && equalNotice && noHiddenCharges && balancedResponsibilities;
}

function extractMeaningfulTokens(text) {
  return normalizeForMatching(text)
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(
      (token) =>
        token.length >= 4 &&
        ![
          "this",
          "that",
          "with",
          "from",
          "will",
          "user",
          "document",
          "risk",
          "impact",
          "description",
          "agreement",
          "clause",
          "terms",
          "their",
          "should",
          "before",
        ].includes(token)
    );
}

function filterGroundedStrings(values, referenceText) {
  const normalizedReference = normalizeForMatching(referenceText);
  const list = Array.isArray(values) ? values : [];

  const uniqueItems = [...new Set(
    list
      .map((item) => {
        if (typeof item === "string") {
          return item.trim();
        }

        if (item && typeof item === "object") {
          return [item.type, item.description, item.impact]
            .filter(Boolean)
            .map((value) => String(value).trim())
            .join(" ");
        }

        return String(item || "").trim();
      })
      .filter(Boolean)
  )];

  if (!normalizedReference || normalizedReference.length < 5) {
    return uniqueItems.slice(0, 5);
  }

  return uniqueItems
    .filter((item) => {
      const tokens = extractMeaningfulTokens(item);
      if (tokens.length === 0) {
        return true;
      }

      return tokens.some((token) => normalizedReference.includes(token));
    })
    .slice(0, 5);
}

function normalizeRiskLabel(label) {
  const key = String(label || "").trim().toLowerCase();
  const overrides = {
    "penalty clause": "Penalty Clause",
    "delay clause": "Delay Clause",
    "delay without penalty": "Delay Without Penalty",
    "hidden charges": "Hidden Charges",
    "cost escalation": "Cost Escalation Risk",
    "cost escalation risk": "Cost Escalation Risk",
    "jurisdiction limitations": "Jurisdiction Limitation",
    "jurisdiction limitation": "Jurisdiction Limitation",
    "cancellation deductions": "Cancellation Deduction",
    "cancellation deduction": "Cancellation Deduction",
    "upfront payment demand": "Upfront Payment Demand",
    "job scam indicator": "Job Scam Indicator",
    "personal data risk": "Personal Data Risk",
    "urgency pressure": "Urgency Pressure",
    "salary uncertainty": "Salary Uncertainty",
  };

  return overrides[key] || label;
}

function mapDocumentTypeKey(documentType) {
  const normalized = String(documentType || "").toLowerCase();

  if (normalized.includes("ticket") || normalized.includes("railway")) {
    return "ticket";
  }

  if (normalized.includes("property") || normalized.includes("builder")) {
    return "property_document";
  }

  if (normalized.includes("rental") || normalized.includes("lease")) {
    return "rental_agreement";
  }

  if (normalized.includes("legal contract") || normalized.includes("contract")) {
    return "legal";
  }

  if (normalized.includes("job offer") || normalized.includes("employment")) {
    return "offer_letter";
  }

  if (normalized.includes("bank") || normalized.includes("financial")) {
    return "bank_financial";
  }

  if (normalized.includes("resume") || normalized.includes("cv")) {
    return "resume";
  }

  if (normalized.includes("policy") || normalized.includes("rule")) {
    return "policy";
  }

  return "unknown";
}

function isSignableDocumentKey(docTypeKey) {
  return ["legal", "property_document", "rental_agreement", "offer_letter"].includes(docTypeKey);
}

function resolveFinalDecision(docTypeKey, classification, riskLevel) {
  if (classification === "FRAUD" || classification === "ILLEGAL") {
    return "DO_NOT_SIGN";
  }

  if (docTypeKey === "ticket") {
    return "SAFE_TO_USE";
  }

  if (docTypeKey === "resume") {
    return "SAFE_TO_REVIEW";
  }

  if (isSignableDocumentKey(docTypeKey)) {
    if (classification === "UNFAIR") {
      return "REVIEW_CAUTION";
    }
    if (classification === "NORMAL") {
      return "SAFE_TO_USE";
    }
    return "REVIEW_CAUTION";
  }

  return classification === "NORMAL" ? "SAFE_TO_USE" : "REVIEW_CAUTION";
}

function resolveShouldUserSign(finalDecision) {
  switch (finalDecision) {
    case "DO_NOT_SIGN":
      return "NO";
    case "SAFE_TO_SIGN":
    case "SAFE_TO_USE":
      return "YES";
    case "SAFE_TO_REVIEW":
      return "CAUTION";
    default:
      return "CAUTION";
  }
}

function buildGuidanceForChat(docTypeKey, classification) {
  if (classification === "FRAUD") {
    return [
      "Do NOT pay any money before joining.",
      "Do NOT share personal details.",
      "Verify company authenticity from official sources.",
    ];
  }

  if (classification === "ILLEGAL") {
    return [
      "DO NOT SIGN THIS DOCUMENT",
      "Preserve a copy of the document and communications.",
      "Seek legal advice immediately to confirm enforceability.",
      "Do not accept terms that block access to courts.",
    ];
  }

  if (docTypeKey === "ticket") {
    return [
      "Start the journey within the printed validity window; for unreserved/local tickets this is often within about 1 hour.",
      "Check ticket validity date/time and class; many tickets expire by midnight if not used.",
      "Travel on the permitted route and avoid breaking the journey unless the ticket explicitly allows it.",
      "Do not exit and re-enter mid-journey; a detour may require a new ticket.",
      "Carry required ID proof and follow boarding rules.",
    ];
  }

  if (docTypeKey === "resume") {
    return [
      "Verify personal and professional details for accuracy.",
      "Ensure claims are backed by evidence or examples.",
      "Improve formatting and clarity if needed.",
    ];
  }

  if (isSignableDocumentKey(docTypeKey)) {
    if (classification === "NORMAL") {
      return [
        "Ensure details (rent, deposit, duration) are correct.",
        "Keep a signed copy safely.",
        "Follow the agreed terms.",
      ];
    }

    return [
      "Verify parties, dates, and payment schedule before signing.",
      "Check termination, penalty, and refund clauses for one-sided terms.",
      "Confirm dispute resolution/jurisdiction terms are acceptable.",
      "Negotiate one-sided or high-penalty terms.",
      "Consult a legal expert if risk is high.",
    ];
  }

  return [
    "Verify key obligations, deadlines, and penalties before acting.",
    "Keep a copy of the document and related communications.",
  ];
}

function buildLegalValidityFlags(hasIllegalSignals) {
  if (!hasIllegalSignals) {
    return [];
  }

  return [
    {
      type: "ILLEGAL",
      clause: "Restriction on legal recourse detected.",
      law: "Section 28, Indian Contract Act",
      explanation: "Clauses that block access to courts are generally unenforceable.",
    },
  ];
}

function countFraudSignals(text) {
  const indicators = detectFraudIndicators(text);
  const fakePromiseSignal = indicators.unrealistic;

  return [
    indicators.upfrontPayment,
    indicators.urgency,
    indicators.personalData,
    fakePromiseSignal,
  ].filter(Boolean).length;
}

function detectIllegalSignals(text) {
  const normalized = normalizeForMatching(text);
  const illegalPatterns = [
    /no\s+legal\s+action/i,
    /cannot\s+(?:go|approach)\s+court/i,
    /no\s+right\s+to\s+sue/i,
    /waive\s+(?:your|the)?\s*right\s+to\s+sue/i,
    /no\s+court\s+remedy/i,
    /no\s+legal\s+recourse/i,
    /only\s+arbitration\s+and\s+no\s+court/i,
  ];

  return illegalPatterns.some((pattern) => pattern.test(normalized));
}

function normalizeDocumentType(value) {
  const raw = String(value || "").trim().toLowerCase();

  // Ticket signals must be mapped first to avoid accidental contract coercion.
  if (
    raw.includes("railway") ||
    raw.includes("ticket") ||
    raw.includes("pnr") ||
    raw.includes("journey") ||
    raw.includes("train")
  ) {
    return "Railway Ticket";
  }

  // Any agreement/contract document with ANY property/builder context → Property Agreement
  if (
    (raw.includes("property") || raw.includes("builder") || raw.includes("construction") || raw.includes("flat") || raw.includes("real estate") || raw.includes("real-estate")) &&
    (raw.includes("agreement") || raw.includes("contract") || raw.includes("legal"))
  ) {
    return "Property / Builder Agreement";
  }

  if (raw.includes("rental") || raw.includes("lease")) {
    return "Rental Agreement";
  }

  // General contract/agreement (but NOT property) → Legal Contract
  if (raw.includes("agreement") || raw.includes("contract")) {
    return "Legal Contract";
  }

  if (raw.includes("job") || raw.includes("offer") || raw.includes("employment")) {
    return "Job Offer Letter";
  }

  if (raw.includes("bank") || raw.includes("financial") || raw.includes("loan")) {
    return "Bank / Financial Document";
  }

  if (raw.includes("resume") || raw.includes("cv")) {
    return "Resume";
  }

  if (raw.includes("policy") || raw.includes("rule")) {
    return "Policy / Rules";
  }

  return "Unknown";
}

function toUniqueArray(value, limit = 5) {
  if (!Array.isArray(value)) {
    return [];
  }

  return [...new Set(value.map((item) => String(item).trim()).filter(Boolean))].slice(0, limit);
}

function normalizeLawReference(rawLaw = {}, documentType, classification) {
  const laws = toUniqueArray(rawLaw.laws, 5);
  const docType = String(documentType || "").toLowerCase();

  const hasLaw = (name) => laws.some((law) => law.toLowerCase().includes(name.toLowerCase()));
  const addLaw = (name) => {
    if (!hasLaw(name)) {
      laws.push(name);
    }
  };

  if (classification === "ILLEGAL") {
    addLaw("Indian Contract Act (Section 28)");
  } else if (classification === "FRAUD") {
    addLaw("IPC 420");
    addLaw("RBI / Cyber Fraud Guidelines");
  } else {
    // Never include fraud laws for property/builder/contracts under non-fraud paths.
    for (let i = laws.length - 1; i >= 0; i -= 1) {
      if (laws[i].toLowerCase().includes("ipc 420")) {
        laws.splice(i, 1);
      }
    }

    if (docType.includes("property") || docType.includes("builder")) {
      addLaw("RERA Act");
      addLaw("Indian Contract Act");
    } else if (docType.includes("rental")) {
      addLaw("Model Tenancy Act / State Rent Act");
      addLaw("Indian Contract Act");
    } else if (docType.includes("legal contract") || docType.includes("contract")) {
      addLaw("Indian Contract Act");
    } else if (docType.includes("job offer")) {
      addLaw("Indian Contract Act");
    } else if (docType.includes("bank") || docType.includes("financial")) {
      addLaw("RBI Guidelines");
    } else if (docType.includes("ticket") || docType.includes("railway")) {
      addLaw("Indian Railways Rules");
    }
  }

  let simpleExplanation = String(rawLaw.simple_explanation || "").trim();

  if (!simpleExplanation) {
    if (classification === "ILLEGAL") {
      simpleExplanation =
        "Clauses that restrict legal remedies can be void under Section 28 of the Indian Contract Act.";
    } else if (classification === "FRAUD") {
      simpleExplanation =
        "IPC 420 addresses cheating and fraud, while cyber fraud guidelines protect users from scams and unsafe payment requests.";
    } else if (docType.includes("property") || docType.includes("builder")) {
      simpleExplanation =
        "RERA Act protects home buyers from builder-related issues, and the Indian Contract Act ensures agreements are fair and legally valid.";
    } else if (docType.includes("rental")) {
      simpleExplanation =
        "Tenancy laws protect landlord-tenant rights, and the Indian Contract Act ensures agreements are fair and legally valid.";
    } else if (docType.includes("job offer")) {
      simpleExplanation =
        "The Indian Contract Act ensures agreements are fair and legally valid, while labour laws protect employees from unfair job conditions.";
    } else if (docType.includes("bank") || docType.includes("financial")) {
      simpleExplanation =
        "RBI guidelines protect customers from unsafe banking practices and sharing OTP/CVV/password.";
    } else if (docType.includes("ticket") || docType.includes("railway")) {
      simpleExplanation = "Railway tickets are governed by Indian Railways Rules; check validity and timing conditions before travel.";
    } else {
      simpleExplanation = "Applicable law depends on document type and clause-level details.";
    }
  }

  return {
    applicable: Boolean(rawLaw.applicable ?? laws.length > 0),
    laws: toUniqueArray(laws, 5),
    simple_explanation: simpleExplanation,
  };
}

function hasAllFraudSignals(rawReply) {
  const sourceText = [
    rawReply.reason_for_decision,
    ...(Array.isArray(rawReply.suspicious_clauses) ? rawReply.suspicious_clauses : []),
    ...(Array.isArray(rawReply.top_risks) ? rawReply.top_risks : []),
    ...(Array.isArray(rawReply.warnings) ? rawReply.warnings : []),
  ]
    .join(" ")
    .toLowerCase();

  const normalized = normalizeForMatching(sourceText);
  const indicators = detectFraudIndicators(normalized);
  const paymentSignal = indicators.upfrontPayment;
  const urgencySignal = indicators.urgency;
  const sensitiveSignal = indicators.personalData;
  const fakePromiseSignal = indicators.unrealistic;

  // DEBUG: Log fraud signal detection
  console.log(`[hasAllFraudSignals] Payment: ${paymentSignal}, Urgency: ${urgencySignal}, Sensitive: ${sensitiveSignal}, FakePromise: ${fakePromiseSignal}`);
  const allSignalsPresent = paymentSignal && urgencySignal && sensitiveSignal && fakePromiseSignal;
  console.log(`[hasAllFraudSignals] Result: ${allSignalsPresent}`);

  return allSignalsPresent;
}

function normalizeQueryReply(rawReply = {}, queryText = "") {
  const documentType = normalizeDocumentType(rawReply.document_type);
  const docTypeKey = mapDocumentTypeKey(documentType);
  const isTicketType = docTypeKey === "ticket";
  const hasIllegalSignals = detectIllegalSignals(queryText);
  const fraudIndicators = detectFraudIndicators(queryText);
  const fraudLikely =
    isFraudLikely(fraudIndicators) ||
    (fraudIndicators.urgency && fraudIndicators.personalData && fraudIndicators.unrealistic);
  const hasStrongFraudSignals = fraudLikely || countFraudSignals(queryText) >= 2;
  const hasFraudSignals = hasAllFraudSignals(rawReply) || hasStrongFraudSignals;
  const balancedAgreement = detectBalancedAgreementSignals(queryText);

  let classification = String(rawReply.classification || "").trim().toUpperCase();
  if (!["FRAUD", "UNFAIR", "ILLEGAL", "NORMAL"].includes(classification)) {
    classification = "NORMAL";
  }

  // DEBUG: Log the normalization process
  console.log(`[normalizeQueryReply] Raw document_type: "${rawReply.document_type}" → Normalized: "${documentType}"`);
  console.log(`[normalizeQueryReply] Classification before override: ${classification}`);

  // CRITICAL: ILLEGAL overrides and fraud signal validation
  if (hasIllegalSignals) {
    classification = "ILLEGAL";
  } else if (classification === "FRAUD" && !fraudLikely) {
    console.log(`[normalizeQueryReply] Signals check failed - converting FRAUD to UNFAIR`);
    classification = "UNFAIR";
  }

  if (fraudLikely) {
    classification = "FRAUD";
  }

  if (balancedAgreement && classification !== "FRAUD" && classification !== "ILLEGAL") {
    classification = "NORMAL";
  }

  console.log(`[normalizeQueryReply] Classification after override: ${classification}`);

  const riskLevelFromModel = String(rawReply.risk_level || "").trim().toUpperCase();
  let risk_level = ["LOW", "MEDIUM", "HIGH"].includes(riskLevelFromModel)
    ? riskLevelFromModel
    : classification === "FRAUD"
    ? "HIGH"
    : classification === "UNFAIR"
    ? "MEDIUM"
    : "LOW";

  let warnings = toUniqueArray(rawReply.warnings, 5);
  let what_user_should_do = toUniqueArray(rawReply.what_user_should_do, 5);
  let top_risks = filterGroundedStrings(rawReply.top_risks, queryText);
  let suspicious_clauses = filterGroundedStrings(rawReply.suspicious_clauses, queryText);

  const safeWarning =
    "This agreement looks balanced. Major money loss risk appears low, but keep a copy and proof.";
  const unfairWarning =
    "One-sided clauses can cause penalties, delays, or money loss. Review carefully.";
  const fraudWarning =
    "Strong scam signs detected. You may lose money and your data can be misused. Do NOT pay or share details.";
  const fraudExplanation =
    "This is a HIGH-RISK document with fraud indicators like upfront payment or urgency. You may lose money or time.";
  const safeExplanation =
    "No major unfair or risky clauses detected. Risk of money loss appears low if you follow terms.";

  if (balancedAgreement) {
    risk_level = "LOW";
    top_risks = [];
    suspicious_clauses = [];
  }

  if (fraudLikely) {
    const fraudTopRisks = [
      "Upfront Payment Demand: You may lose money before any service is delivered.",
      "Job Scam Indicator: Fake promises can waste your time and money.",
      "Personal Data Risk: Your identity or bank account may be misused.",
      "Urgency Pressure: Rushed decisions can cause avoidable money loss.",
    ];
    top_risks = [...new Set([...fraudTopRisks, ...top_risks])].slice(0, 5);
  }

  if (classification !== "FRAUD") {
    warnings = warnings.filter(
      (item) =>
        !/this appears to be a scam|strong signs of a (job )?scam|do not make payment|do not share personal details|deposit mentioned/i.test(
          item
        )
    );
    what_user_should_do = what_user_should_do.filter(
      (item) => !/do not make payment|do not share personal details/i.test(item)
    );
  }

  if (classification === "ILLEGAL") {
    risk_level = "HIGH";
    warnings = [
      "This document may contain clauses that are legally unenforceable.",
      "Do NOT sign without legal review.",
    ];
    top_risks = [
      "Restriction on legal remedy: You may lose the right to go to court and waste time/money.",
      ...top_risks,
    ].slice(0, 5);
  }

  if (docTypeKey === "offer_letter" && hasFraudSignals) {
    classification = "FRAUD";
    risk_level = "HIGH";
    warnings = [fraudWarning];
  }

  if (isTicketType && !hasFraudSignals && classification !== "ILLEGAL") {
    classification = "NORMAL";
    risk_level = "LOW";
  }

  if (classification === "FRAUD") {
    warnings = [fraudWarning];
  }

  if (classification === "UNFAIR") {
    warnings = [unfairWarning];
  }

  if (classification === "NORMAL") {
    warnings = [safeWarning];
  }

  top_risks = top_risks.map((risk) => ensureRiskImpactText(normalizeRiskLabel(risk)));

  const final_decision = resolveFinalDecision(docTypeKey, classification, risk_level);
  const totalRisks = top_risks.length + suspicious_clauses.length;
  let resolvedDecision = final_decision;
  if (classification === "NORMAL") {
    resolvedDecision = "SAFE_TO_USE";
  }
  const should_user_sign = resolveShouldUserSign(resolvedDecision);
  warnings = [...new Set(warnings.filter(Boolean))].slice(0, 5);
  what_user_should_do = buildGuidanceForChat(docTypeKey, classification).slice(0, 5);
  const legal_validity_flags = buildLegalValidityFlags(hasIllegalSignals);
  let reason_for_decision = String(
    rawReply.reason_for_decision ||
      "Decision is based on clause risk and real-life impact on money, time, or legal rights."
  );
  if (classification === "FRAUD") {
    reason_for_decision = fraudExplanation;
  }
  if (classification === "UNFAIR") {
    reason_for_decision =
      "The agreement has one-sided clauses (penalty, delay, hidden charges) that can cause money loss or delays.";
  }
  if (classification === "NORMAL" && isSignableDocumentKey(docTypeKey)) {
    reason_for_decision = safeExplanation;
  }

  return {
    document_type: documentType,
    classification,
    final_decision: resolvedDecision,
    should_user_sign,
    risk_level,
    reason_for_decision,
    suspicious_clauses,
    top_risks,
    what_user_should_do,
    warnings,
    law_reference: normalizeLawReference(rawReply.law_reference, documentType, classification),
    quantified_impact: [],
    legal_validity_flags,
    lawyer_suggestion: String(
      rawReply.lawyer_suggestion ||
        "If this matter can impact money, property, or legal rights, consult a legal expert."
    ),
    note_for_user:
      "This is AI guidance. For serious matters, consult a legal expert.",
  };
}

function buildChatPrompt({
  query,
  context,
  language,
  enforceLanguage = false,
  enforceQuality = false,
}) {
  const safeContext =
    context ||
    "No retrieved legal context available. Give safe general advice without hallucinating.";
  const resolvedLanguage = ensureSupportedLanguage(language);
  const languageInstruction = inferLanguageInstruction(resolvedLanguage);
  const languageLabel = getLanguageLabel(resolvedLanguage);
  const languageDirective = enforceLanguage
    ? `${languageInstruction}\nIMPORTANT: Respond ONLY in ${languageLabel}. Do not use any other language.`
    : languageInstruction;

  return `
You are Nyay Sahayak, an expert legal assistant for common people in India.
You must act like a practical legal advisor, not an academic summarizer.
Selected output language: ${languageLabel}.
${languageDirective}

Retrieved legal context:
${safeContext}

User query:
${query}

Rules:
1. Use the retrieved context only if it is clearly relevant.
2. Avoid hallucinating laws or penalties.
3. If unsure, clearly suggest consulting a legal expert.
4. Keep the guidance practical and useful for a normal person.
5. Ignore context completely if it does not match the user's issue.
6. Follow the language instruction exactly and respond only in that language.
7. Return only clean JSON.
8. Never remove or alter numbers, percentages, durations, or monetary values from the input.
9. Do not use blanks or placeholders like "____".
10. Use very simple, conversational language for common/rural users.
11. Each top_risks item must include real-life impact (money/time/property loss).
12. Write naturally in ${languageLabel} (not literal translation).
${enforceQuality ? "13. Before responding, verify there are no missing numbers or mixed language. Regenerate internally if needed." : ""}
14. If any rule is violated, regenerate internally and correct it before output.

Return this STRICT JSON only:
{
  "document_type": "Property / Builder Agreement | Rental Agreement | Legal Contract | Job Offer Letter | Bank / Financial Document | Railway Ticket | Resume | Policy / Rules | Unknown",
  "classification": "FRAUD | UNFAIR | ILLEGAL | NORMAL",
  "final_decision": "DO_NOT_SIGN | REVIEW_CAUTION | SAFE_TO_SIGN | SAFE_TO_USE | SAFE_TO_REVIEW",
  "should_user_sign": "NO | CAUTION | YES",
  "risk_level": "LOW | MEDIUM | HIGH",
  "reason_for_decision": "",
  "suspicious_clauses": [],
  "top_risks": [],
  "what_user_should_do": [],
  "warnings": [],
  "law_reference": {
    "applicable": true,
    "laws": [],
    "simple_explanation": ""
  },
  "lawyer_suggestion": "",
  "note_for_user": "This is AI guidance. For serious matters, consult a legal expert."
}

Critical decision framework:
1. First detect document type correctly.
2. If any clause blocks legal remedies or access to courts, classify as ILLEGAL and set final_decision=DO_NOT_SIGN.
3. Use FRAUD if any of these appear: upfront payment demand, urgency pressure, personal data requests, or unrealistic job conditions.
4. Do not flag refundable deposits in rental agreements as risk.
5. If agreement terms are balanced (mutual rights, equal notice period, no hidden charges, balanced responsibilities), set classification=NORMAL, risk_level=LOW, final_decision=SAFE_TO_SIGN, should_user_sign=YES.
6. If multiple unfair clauses exist, classify as UNFAIR and set final_decision=REVIEW_CAUTION.
7. If document_type is Railway Ticket and no fraud signals appear, set classification=NORMAL, final_decision=SAFE_TO_USE, should_user_sign=YES.
8. If document_type is Resume, set final_decision=SAFE_TO_REVIEW.
9. If classification is NORMAL (non-ticket), set final_decision=SAFE_TO_USE and should_user_sign=YES.
10. Use law references carefully:
   - Property: RERA Act
  - Rental: Model Tenancy Act / State Rent Act
   - Employment: Indian Contract Act
   - Fraud: IPC 420 and RBI/Cyber fraud guidelines
   - Banking: RBI Guidelines
   - Consumer issues: Consumer Protection Act
  - Tickets: Indian Railways Rules
10. Max 5 items in risks/warnings arrays and avoid duplicates.
`.trim();
}

async function generateGeminiReply({ query, context, language }) {
  const resolvedLanguage = ensureSupportedLanguage(language);
  const languageInstruction = getLanguageInstruction(resolvedLanguage);
  console.log(
    `[geminiChat] language raw="${language}" resolved="${resolvedLanguage}" instruction="${languageInstruction}"`
  );

  let outputLanguage = resolvedLanguage;
  const requiredTokens = extractNumericTokens(query);

  let prompt = buildChatPrompt({ query, context, language: resolvedLanguage });
  let result = await geminiModel.generateContent(prompt);
  let responseText = result.response.text().trim();
  let parsed = parseJSONResponse(removeMarkdownFormatting(responseText));

  const rawParsedText = JSON.stringify(parsed);
  const needsRetry =
    isLanguageMismatch(rawParsedText, resolvedLanguage) ||
    isMixedLanguage(rawParsedText, resolvedLanguage) ||
    hasPlaceholders(rawParsedText) ||
    hasMissingNumericTokens(rawParsedText, requiredTokens) ||
    hasMissingImpactInRisks(parsed.top_risks, resolvedLanguage);

  if (needsRetry) {
    console.warn("[geminiChat] Quality mismatch detected. Retrying with strict enforcement.");
    prompt = buildChatPrompt({
      query,
      context,
      language: resolvedLanguage,
      enforceLanguage: true,
      enforceQuality: true,
    });
    result = await geminiModel.generateContent(prompt);
    responseText = result.response.text().trim();
    parsed = parseJSONResponse(removeMarkdownFormatting(responseText));
  }

  const retryText = JSON.stringify(parsed);
  const stillBad =
    isLanguageMismatch(retryText, resolvedLanguage) ||
    isMixedLanguage(retryText, resolvedLanguage) ||
    hasPlaceholders(retryText) ||
    hasMissingNumericTokens(retryText, requiredTokens) ||
    hasMissingImpactInRisks(parsed.top_risks, resolvedLanguage);

  if (stillBad && resolvedLanguage !== "en") {
    console.warn("[geminiChat] Quality checks failed after retry; falling back to English output.");
    outputLanguage = "en";
    prompt = buildChatPrompt({
      query,
      context,
      language: outputLanguage,
      enforceLanguage: true,
      enforceQuality: true,
    });
    result = await geminiModel.generateContent(prompt);
    responseText = result.response.text().trim();
    parsed = parseJSONResponse(removeMarkdownFormatting(responseText));
  }
  
  // DEBUG: Log what Gemini returned
  console.log(`[generateGeminiReply] Raw Gemini response document_type: "${parsed.document_type}"`);
  console.log(`[generateGeminiReply] Raw Gemini classification: "${parsed.classification}"`);
  
  let normalized = normalizeQueryReply(parsed, query);
  if (outputLanguage !== "en") {
    normalized = await translateStructuredOutput(normalized, outputLanguage);
  }
  
  console.log(`[generateGeminiReply] After normalization - classification: "${normalized.classification}"`);
  
  return normalized;
}

function shouldUseLegalContext(query) {
  return /\b(rule|rules|legal|law|agreement|fir|property|ticket|traffic|police|theft|license|notice)\b/i.test(
    query
  );
}

export async function generateLegalChatResponse(query, options = {}) {
  let context = "";
  let contextUsed = false;
  const aiQuery = options.aiQuery || query;

  try {
    if (shouldUseLegalContext(query)) {
      const retrievedResults = await runPythonSearch(query);
      const relevantResults = filterRelevantResults(retrievedResults, { queryText: query });
      context = buildContextString(relevantResults);
      contextUsed = Boolean(context);
    }
  } catch (error) {
    console.error("[geminiChat] Python RAG search failed:", error.message);
  }

  let reply;

  try {
    reply = await generateGeminiReply({ query: aiQuery, context, language: options.language });
    return {
      reply,
      suggestions: buildSuggestions(query),
      contextUsed,
      isError: false,
    };
  } catch (error) {
    console.error("[geminiChat] Gemini generation failed:", error.message);
    reply = {
      document_type: "Unknown",
      classification: "UNFAIR",
      final_decision: "REVIEW_CAUTION",
      should_user_sign: "CAUTION",
      risk_level: "MEDIUM",
      reason_for_decision:
        "Sorry, the structured legal response could not be generated right now. Please try again later.",
      suspicious_clauses: [],
      top_risks: [],
      what_user_should_do: ["If this is important, consult a legal expert."],
      warnings: [],
      law_reference: {
        applicable: false,
        laws: [],
        simple_explanation: "Model response unavailable, so law mapping could not be confirmed.",
      },
      lawyer_suggestion: "For serious legal matters, consult a qualified lawyer.",
      note_for_user: "This is AI guidance. For serious matters, consult a legal expert.",
    };
  }

  return {
    reply,
    suggestions: buildSuggestions(query),
    contextUsed,
    isError: true,
  };
}

export { buildChatPrompt, buildSuggestions };
