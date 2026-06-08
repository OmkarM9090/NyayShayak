# Nyay-Sahayak - Complete Documentation
## AI-Powered Legal Document Analyzer with Privacy Protection

---

## 📋 Table of Contents

1. [System Overview](#system-overview)
2. [Complete Data Flow](#complete-data-flow)
3. [Architecture](#architecture)
4. [API Endpoints](#api-endpoints)
5. [Code Explanation](#code-explanation)
6. [Setup Instructions](#setup-instructions)
7. [Testing Guide](#testing-guide)
8. [Troubleshooting](#troubleshooting)

---

## 🎯 System Overview

**Nyay-Sahayak** is an AI-powered legal document analyzer that helps users understand contracts, agreements, and legal documents by:

1. **Protecting Privacy** - Automatically masks sensitive information (Aadhaar, PAN, Phone, Email, Names)
2. **Document Identification** - Uses ML to identify document type
3. **Risk Analysis** - Uses AI to identify unfavorable clauses and potential risks
4. **Comprehensive Reporting** - Combines all insights into actionable report

---

## 🔄 Complete Data Flow

### Visual Flow Diagram

```
┌─────────────────────────────────────────────────────┐
│  USER UPLOADS: rental_agreement.pdf                 │
└────────────────────┬────────────────────────────────┘
                     │
                     ↓
┌─────────────────────────────────────────────────────┐
│  STEP 1: OCR EXTRACTION (Existing Feature)         │
│  PDF/Image → Plain Text                             │
│  Library: Tesseract.js                              │
└────────────────────┬────────────────────────────────┘
                     │
                     ↓
        OUTPUT: "This agreement between Rajesh Kumar
                 (Aadhaar: 1234-5678-9012)
                 Phone: 9876543210..."
                     │
                     ↓
┌─────────────────────────────────────────────────────┐
│  STEP 2: DATA MASKING (Privacy Protection) 🔒      │
│  File: backend/utils/dataMasking.js                 │
│  Masks: Aadhaar, PAN, Phone, Email, Names          │
└────────────────────┬────────────────────────────────┘
                     │
                     ↓
        OUTPUT: "This agreement between [NAME_1]
                 (Aadhaar: [AADHAAR_1])
                 Phone: [PHONE_1]..."
                     │
                     ↓
        ┌────────────┴────────────┐
        │                         │
        ↓                         ↓
┌─────────────────────┐  ┌──────────────────────┐
│  STEP 3A:           │  │  STEP 3B:            │
│  DATASET CHECK 📊   │  │  GEMINI AI 🤖        │
│  (TF-IDF)           │  │  (Risk Analysis)     │
└────────┬────────────┘  └──────────┬───────────┘
         │                          │
         ↓                          ↓
    "89% match to             "Found 3 risks:
     Rental Agreement"         - HIGH: Section 5
                               - HIGH: Section 8
                               - MEDIUM: Section 3"
         │                          │
         └─────────┬────────────────┘
                   │
                   ↓
┌─────────────────────────────────────────────────────┐
│  STEP 4: COMBINE RESULTS                            │
│  Privacy Info + Dataset Match + AI Insights         │
└────────────────────┬────────────────────────────────┘
                     │
                     ↓
┌─────────────────────────────────────────────────────┐
│  FINAL REPORT (JSON Response to Frontend)           │
│  {                                                   │
│    privacy: { masked: 3 fields },                   │
│    datasetAnalysis: { match: 89% },                 │
│    aiAnalysis: { risks: [...] }                     │
│  }                                                   │
└─────────────────────────────────────────────────────┘
```

---

## 🏗️ Architecture

### Folder Structure

```
backend/
├── config/
│   └── gemini.js                 # Gemini AI configuration
│
├── controllers/
│   ├── analysisController.js     # Main analysis logic
│   ├── ocrController.js          # OCR handling
│   └── pdfController.js          # PDF processing
│
├── routes/
│   ├── analysisRoutes.js         # Analysis endpoints
│   ├── ocrRoutes.js              # OCR endpoints
│   └── pdfRoutes.js              # PDF endpoints
│
├── services/
│   └── aiService.js              # Gemini AI service
│
├── utils/
│   └── dataMasking.js            # Privacy protection utility
│
├── uploads/                      # Temporary file storage
│
├── .env                          # Environment variables (API keys)
├── package.json                  # Dependencies
└── server.js                     # Main server file
```

### Technology Stack

| Component | Technology | Purpose |
|-----------|-----------|---------|
| **Backend** | Node.js + Express | REST API server |
| **OCR** | Tesseract.js | Extract text from images/PDFs |
| **ML Dataset** | Python + scikit-learn | TF-IDF + Cosine Similarity |
| **AI Analysis** | Google Gemini API | Intelligent risk assessment |
| **Privacy** | Custom Regex Patterns | Mask sensitive data |
| **Frontend** | React + Vite | User interface |

---

## 🔌 API Endpoints

### 1. Comprehensive Analysis (RECOMMENDED)

**The complete all-in-one endpoint with privacy protection.**

```http
POST /api/comprehensive-analysis
Content-Type: application/json

{
  "documentText": "RENTAL AGREEMENT\n\nThis agreement between Rajesh Kumar..."
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "privacy": {
      "protected": true,
      "totalFieldsMasked": 3,
      "maskedDataTypes": ["name", "aadhaar", "phone"],
      "summary": {
        "name": 2,
        "aadhaar": 1, 
        "phone": 1
      },
      "message": "✅ 3 sensitive field(s) protected"
    },
    
    "datasetAnalysis": {
      "similarDocuments": [
        {
          "text": "Standard Residential Lease Agreement...",
          "similarity": 0.89
        }
      ],
      "topMatch": {
        "text": "Standard Residential Lease Agreement...",
        "similarity": 0.89
      },
      "confidence": 0.89,
      "message": "Found 3 similar document(s) in database"
    },
    
    "aiAnalysis": {
      "summary": "This is a residential rental agreement with several tenant-unfavorable clauses...",
      "risks": [
        {
          "clause": "Section 5 - Maintenance Obligations",
          "severity": "HIGH",
          "reason": "Tenant responsible for ALL repairs including structural damage..."
        },
        {
          "clause": "Section 8 - Termination Notice",
          "severity": "HIGH",
          "reason": "Only 7-day notice required. Standard is 30 days."
        },
        {
          "clause": "Section 3 - Late Payment Penalty",
          "severity": "MEDIUM",
          "reason": "10% penalty may be excessive."
        }
      ],
      "riskDistribution": {
        "high": 2,
        "medium": 1,
        "low": 0
      },
      "totalRisks": 3,
      "chunksProcessed": 1,
      "message": "⚠️ Identified 3 potential risk(s)"
    },
    
    "metadata": {
      "processingSteps": [
        "✅ Step 1: Data masking completed",
        "✅ Step 2: Dataset analysis completed",
        "✅ Step 3: AI analysis completed",
        "✅ Step 4: Report generation completed"
      ],
      "documentSize": 5432,
      "maskedDocumentSize": 5200,
      "timestamp": "2026-03-03T10:30:45.123Z",
      "processingVersion": "v1.0.0"
    }
  },
  "message": "Comprehensive analysis completed successfully"
}
```

---

### 2. Gemini AI Only (No Privacy Protection)

**Use this if you want ONLY AI analysis without masking.**

```http
POST /api/analyze-with-gemini
Content-Type: application/json

{
  "documentText": "Your document text here..."
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "summary": "Brief document summary...",
    "risks": [
      {
        "clause": "Section name",
        "severity": "HIGH|MEDIUM|LOW",
        "reason": "Explanation..."
      }
    ],
    "chunksProcessed": 1,
    "totalRisksFound": 3
  },
  "message": "Document analysis completed successfully"
}
```

---

### 3. Dataset Analysis Only (Python ML)

**Use this for quick document type identification.**

```http
POST /api/analyse
Content-Type: application/json

{
  "text": "Your document text here..."
}
```

**Response:**

```json
{
  "results": [
    {
      "text": "Similar document text...",
      "similarity": 0.89
    }
  ]
}
```

---

## 💻 Code Explanation

### File 1: `utils/dataMasking.js`

**Purpose:** Protect user privacy by masking sensitive information.

**What it does:**
- Finds Aadhaar numbers, PAN cards, phone numbers, emails, names
- Replaces with placeholders like `[AADHAAR_1]`, `[PHONE_1]`
- Keeps track of replacements for potential unmasking
- Returns clean, privacy-safe text

**Example:**

```javascript
import { maskSensitiveData } from './utils/dataMasking.js';

const original = "Contact Rajesh Kumar at 9876543210 or rajesh@email.com";

const result = maskSensitiveData(original);

console.log(result.maskedText);
// Output: "Contact [NAME_1] at [PHONE_1] or [EMAIL_1]"

console.log(result.hasSensitiveData);
// Output: true

console.log(result.summary);
// Output: { name: 1, phone: 1, email: 1 }
```

**Key Functions:**

| Function | Purpose |
|----------|---------|
| `maskSensitiveData(text)` | Main masking function |
| `unmaskData(maskedText, replacements)` | Restore original values |
| `hasAadhaar(text)` | Check if text contains Aadhaar |
| `hasPAN(text)` | Check if text contains PAN |
| `hasPhone(text)` | Check if text contains phone |

---

### File 2: `services/aiService.js`

**Purpose:** Handle all Gemini AI interactions.

**What it does:**
- Splits large documents into chunks (10KB each)
- Sends each chunk to Gemini API
- Removes markdown formatting from response
- Safely parses JSON
- Combines results from all chunks
- Removes duplicate risks

**Key Functions:**

```javascript
// Main function - analyze complete document
analyzeDocument(documentText)
  → Returns: { summary, risks, chunksProcessed }

// Helper - analyze single chunk
analyzeTextChunk(textChunk)
  → Sends to Gemini, gets JSON response

// Helper - split large text
chunkText(text, chunkSize)
  → Splits into array of chunks

// Helper - clean Gemini output
removeMarkdownFormatting(text)
  → Removes ```json``` wrappers

// Helper - parse JSON safely
parseJSONResponse(responseText)
  → Handles malformed JSON gracefully
```

**Why Chunking?**

```javascript
// Document: 50,000 characters
// Gemini limit: ~10,000 characters per request

// Without chunking: ❌ API Error "Token limit exceeded"
// With chunking:    ✅ Split into 5 chunks, analyze each

// Example:
const text = "Very long document..."; // 50KB
const chunks = chunkText(text);
// Result: ["chunk1 (10KB)", "chunk2 (10KB)", ... "chunk5 (10KB)"]

// Analyze each separately, then combine results
```

---

### File 3: `controllers/analysisController.js`

**Purpose:** Handle HTTP requests and orchestrate analysis flow.

**What it does:**

#### Function: `comprehensiveAnalysis(req, res)`

This is the main controller that runs the complete flow:

```javascript
1. Receive documentText from frontend
2. Call maskSensitiveData() → Get masked text
3. Call callPythonMLService() → Get dataset matches
4. Call analyzeDocument() → Get Gemini AI analysis
5. Combine all results into report
6. Send JSON response to frontend
```

**Step-by-step breakdown:**

```javascript
// STEP 1: Validate input
if (!documentText) {
  return res.status(400).json({ error: "Text required" });
}

// STEP 2: Mask sensitive data
const { maskedText, replacements } = maskSensitiveData(documentText);
// Now: "Rajesh Kumar" → "[NAME_1]"

// STEP 3: Check dataset (Python ML service)
const datasetResult = await callPythonMLService(maskedText);
// Returns: { results: [{ similarity: 0.89, text: "..." }] }

// STEP 4: Gemini AI analysis
const geminiAnalysis = await analyzeDocument(maskedText);
// Returns: { summary: "...", risks: [...] }

// STEP 5: Build comprehensive report
const report = {
  privacy: { masked: 3 fields },
  datasetAnalysis: { match: 89% },
  aiAnalysis: { risks: [...] }
};

// STEP 6: Send to frontend
res.json({ success: true, data: report });
```

---

### File 4: `config/gemini.js`

**Purpose:** Initialize Gemini AI client (one time setup).

```javascript
import { GoogleGenerativeAI } from "@google/generative-ai";

// Initialize with API key from .env
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Get model instance
const geminiModel = genAI.getGenerativeModel({
  model: "gemini-1.5-flash"  // Fast and cost-effective
});

export { geminiModel };
```

**Why separate config file?**
- Single point of configuration
- Reusable across multiple services
- Easy to switch models (`gemini-1.5-flash` vs `gemini-1.5-pro`)
- Keeps environment variables in one place

---

### File 5: `routes/analysisRoutes.js`

**Purpose:** Define API endpoints and route requests to controllers.

```javascript
import express from "express";
import { comprehensiveAnalysis } from "../controllers/analysisController.js";

const router = express.Router();

// Route definition
router.post("/comprehensive-analysis", comprehensiveAnalysis);
//         ↑                            ↑
//     URL path                    Controller function

export default router;
```

**How routes work:**

```
Frontend Request:
POST http://localhost:5000/api/comprehensive-analysis

Express Server receives it:
1. Matches route: /api/comprehensive-analysis
2. Calls: comprehensiveAnalysis() function
3. Function processes request
4. Returns JSON response
```

---

## 🚀 Setup Instructions

### Step 1: Install Dependencies

```bash
cd backend
npm install
```

This installs:
- `express` - Web server
- `@google/generative-ai` - Gemini API client
- `tesseract.js` - OCR library
- `multer` - File upload handling
- `cors` - Cross-origin requests

### Step 2: Get Gemini API Key

1. Go to: https://makersuite.google.com/app/apikey
2. Click "Create API Key"
3. Copy the key (looks like: `AIzaSyA...`)

### Step 3: Create `.env` File

Create a file named `.env` in the `backend/` folder:

```bash
# backend/.env
GEMINI_API_KEY=AIzaSyA_your_actual_api_key_here
NODE_ENV=development
PORT=5000
```

**⚠️ IMPORTANT:** Never commit `.env` file to Git! Add it to `.gitignore`.

### Step 4: Start Server

```bash
npm start
```

You should see:
```
Server running on port 5000
```

### Step 5: Test the API

Use Postman, Thunder Client, or curl:

```bash
curl -X POST http://localhost:5000/api/comprehensive-analysis \
  -H "Content-Type: application/json" \
  -d '{"documentText":"This is a rental agreement between Rajesh Kumar (Aadhaar: 1234-5678-9012)"}'
```

---

## 🧪 Testing Guide

### Test 1: Privacy Protection (Data Masking)

**Goal:** Verify that sensitive data is masked correctly.

**Test Case:**

```javascript
// Test input
const testText = `
RENTAL AGREEMENT

This agreement is between:
Landlord: Rajesh Kumar (Aadhaar: 1234-5678-9012)
Phone: 9876543210
Email: rajesh@email.com
PAN: ABCDE1234F
`;

// Expected output (masked)
// Should contain: [NAME_1], [AADHAAR_1], [PHONE_1], [EMAIL_1], [PAN_1]
```

**How to test:**

```bash
curl -X POST http://localhost:5000/api/comprehensive-analysis \
  -H "Content-Type: application/json" \
  -d @test-document.json
```

**Check response:**
```json
{
  "privacy": {
    "protected": true,
    "totalFieldsMasked": 5,  // ✅ Should be > 0
    "maskedDataTypes": ["name", "aadhaar", "phone", "email", "pan"]
  }
}
```

---

### Test 2: Dataset Analysis

**Goal:** Verify ML service returns similar documents.

**Prerequisites:**
- Python installed
- `ml-service/dataset/final_chunk.json` exists
- scikit-learn installed

**Test:**

```bash
cd ml-service
python test_search.py "rental agreement between landlord and tenant"
```

**Expected output:**

```json
{
  "results": [
    {
      "text": "Standard Rental Agreement...",
      "similarity": 0.85
    }
  ]
}
```

---

### Test 3: Gemini AI Analysis

**Goal:** Verify Gemini returns risks correctly.

**Test Case:**

```javascript
// Document with obvious risks
const riskyDocument = `
EMPLOYMENT CONTRACT

Employee will work 18 hours per day, 7 days a week.
No overtime payment will be provided.
Company can terminate without notice.
Employee cannot work for competitors for 10 years after leaving.
`;

// Expected: HIGH severity risks identified
```

**How to test:**

```bash
curl -X POST http://localhost:5000/api/analyze-with-gemini \
  -H "Content-Type: application/json" \
  -d '{"documentText":"Employee will work 18 hours per day..."}'
```

**Check response:**

```json
{
  "aiAnalysis": {
    "risks": [
      {
        "clause": "Working Hours",
        "severity": "HIGH",  // ✅ Should detect as HIGH
        "reason": "18 hours per day violates labor laws"
      }
    ]
  }
}
```

---

### Test 4: Complete Flow

**Goal:** Test entire comprehensive analysis flow.

**Test Script:**

```javascript
// Save as: test-comprehensive.js
const axios = require('axios');

async function testComprehensive() {
  const response = await axios.post('http://localhost:5000/api/comprehensive-analysis', {
    documentText: `
      RENTAL AGREEMENT
      
      This agreement is between Rajesh Kumar (Aadhaar: 1234-5678-9012) and Priya Sharma.
      
      Terms:
      1. Rent: Rs. 10,000 per month
      2. Tenant responsible for ALL repairs
      3. Landlord can terminate with 7 days notice
      4. Late payment penalty: 10% per day
    `
  });

  console.log('✅ Privacy Protected:', response.data.data.privacy.protected);
  console.log('✅ Fields Masked:', response.data.data.privacy.totalFieldsMasked);
  console.log('✅ Dataset Matches:', response.data.data.datasetAnalysis.similarDocuments.length);
  console.log('✅ Risks Found:', response.data.data.aiAnalysis.totalRisks);
  console.log('✅ HIGH Risks:', response.data.data.aiAnalysis.riskDistribution.high);
}

testComprehensive();
```

**Run:**

```bash
node test-comprehensive.js
```

**Expected output:**

```
✅ Privacy Protected: true
✅ Fields Masked: 3
✅ Dataset Matches: 2
✅ Risks Found: 3
✅ HIGH Risks: 2
```

---

## 🐛 Troubleshooting

### Issue 1: "GEMINI_API_KEY is not defined"

**Cause:** Environment variable not set.

**Solution:**

1. Check `.env` file exists in `backend/` folder
2. Verify key format: `GEMINI_API_KEY=AIzaSyA...`
3. Restart server after adding `.env`

```bash
# Stop server: Ctrl+C
npm start  # Start again
```

---

### Issue 2: "Python process exited with code 1"

**Cause:** Python ML service failed.

**Solutions:**

1. **Check Python installed:**
   ```bash
   python --version  # Should show Python 3.x
   ```

2. **Install dependencies:**
   ```bash
   cd ml-service
   pip install scikit-learn numpy
   ```

3. **Check dataset exists:**
   ```bash
   ls ml-service/dataset/final_chunk.json  # Should exist
   ```

4. **Test Python script directly:**
   ```bash
   cd ml-service
   python test_search.py "test query"
   ```

---

### Issue 3: "Gemini API error: 429 Too Many Requests"

**Cause:** API rate limit exceeded.

**Solutions:**

1. **Wait 1 minute** - Free tier has rate limits
2. **Add delay between requests:**
   ```javascript
   await new Promise(resolve => setTimeout(resolve, 2000)); // 2 sec delay
   ```
3. **Upgrade to paid plan** for higher limits

---

### Issue 4: No risks detected (empty risks array)

**Possible causes:**

1. **Document too generic** - Gemini found no issues
2. **Prompt needs tuning** - Adjust prompt in `aiService.js`
3. **Chunk too small** - Increase `MAX_CHUNK_SIZE`

**Debug:**

```javascript
// In aiService.js, add logging
console.log('Raw Gemini response:', responseText);
console.log('Cleaned text:', cleanedText);
console.log('Parsed JSON:', parsedResponse);
```

---

### Issue 5: Masking not working

**Check:**

1. **Regex patterns match your data:**
   ```javascript
   // Test patterns directly
   const pattern = /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/gi;
   const test = "Aadhaar: 1234-5678-9012";
   console.log(test.match(pattern)); // Should match
   ```

2. **Input format is correct:**
   ```javascript
   // Aadhaar must be: 1234-5678-9012 or 123456789012
   // PAN must be: ABCDE1234F (uppercase)
   ```

---

## 📊 Performance & Best Practices

### Performance Metrics

| Operation | Time (Approx) | Notes |
|-----------|--------------|-------|
| Data Masking | < 100ms | Regex matching is fast |
| Dataset Check | 1-3 seconds | Depends on dataset size |
| Gemini AI Call | 2-5 seconds | Network + processing |
| Total Flow | 5-10 seconds | Complete analysis |

### Best Practices

1. **Use chunking for large documents:**
   ```javascript
   // Good: Document split into chunks
   MAX_CHUNK_SIZE = 10000;
   
   // Bad: Send 100KB document at once → API error
   ```

2. **Always mask before external API:**
   ```javascript
   // ✅ CORRECT
   const { maskedText } = maskSensitiveData(text);
   await analyzeDocument(maskedText);
   
   // ❌ WRONG - Sends personal data to Google!
   await analyzeDocument(text);
   ```

3. **Handle errors gracefully:**
   ```javascript
   try {
     const result = await analyzeDocument(text);
   } catch (error) {
     // Return partial results instead of total failure
     return { success: false, fallbackData: datasetResult };
   }
   ```

4. **Cache Gemini responses (optional):**
   ```javascript
   // Save analysis results to database
   // Avoid re-analyzing same document
   const cached = await cache.get(documentHash);
   if (cached) return cached;
   ```

---

## 🎓 Key Concepts Explained

### What is TF-IDF?

**TF-IDF = Term Frequency - Inverse Document Frequency**

Think of it like **finding important words**:

```javascript
Document 1: "rent rent rent lease agreement"
Document 2: "the the the rent"

TF-IDF says:
- "rent" appears a lot in Doc1 → Important word → High score
- "the" appears everywhere → Common word → Low score

Result: Doc1 is about "rent", Doc2 is generic
```

**In code:**

```python
from sklearn.feature_extraction.text import TfidfVectorizer

vectorizer = TfidfVectorizer()
vectors = vectorizer.fit_transform(documents)

# Converts text → numbers
# "rental agreement" → [0.5, 0.3, 0.8, 0.1, ...]
```

---

### What is Cosine Similarity?

**Measures how similar two documents are (0% to 100%).**

```javascript
Document A: [0.5, 0.3, 0.8]  (vector of word importance)
Document B: [0.6, 0.2, 0.7]  (another vector)

Calculate angle between vectors:
- Small angle → Similar documents → High score (0.9)
- Large angle → Different documents → Low score (0.1)
```

**Example:**

```
Doc 1: "rental agreement landlord tenant"
Doc 2: "lease agreement property owner occupant"
Similarity: 0.85 (85% similar - same concept, different words)

Doc 1: "rental agreement"
Doc 3: "chocolate cake recipe"
Similarity: 0.05 (5% similar - totally different)
```

---

### How Gemini AI Works

**Gemini is a Large Language Model (LLM)** - like ChatGPT but from Google.

```
You send:
"Analyze this legal document: [document text]
Return JSON with summary and risks."

Gemini thinks:
- Reads entire document
- Understands legal concepts
- Identifies problematic clauses
- Generates structured response

You receive:
{
  "summary": "...",
  "risks": [...]
}
```

**Why it's smart:**

```javascript
// Traditional code: Can only match keywords
if (text.includes("terminate immediately")) {
  risk = "HIGH";
}

// Gemini AI: Understands context
"Landlord can terminate with 7 days notice"
→ AI knows: This is bad! Standard is 30 days.
→ Returns: {severity: "HIGH", reason: "Too short notice period"}
```

---

## 🔐 Security Considerations

### 1. API Key Security

**❌ NEVER do this:**

```javascript
// Hardcoded in code
const apiKey = "AIzaSyA12345...";

// Committed to Git
// Exposed in frontend code
```

**✅ ALWAYS do this:**

```javascript
// Store in .env file
GEMINI_API_KEY=AIzaSyA...

// Access via process.env
const apiKey = process.env.GEMINI_API_KEY;

// Add .env to .gitignore
```

---

### 2. Data Privacy

**What we mask:**

- ✅ Aadhaar numbers
- ✅ PAN cards
- ✅ Phone numbers
- ✅ Email addresses
- ✅ Names (basic detection)

**What we DON'T mask yet (can be added):**

- Addresses (too complex - many formats)
- Bank account numbers (conflicts with other numbers)
- Passport numbers (needs better pattern)

---

### 3. Rate Limiting

**Protect your API from abuse:**

```javascript
// Install: npm install express-rate-limit
import rateLimit from 'express-rate-limit';

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // Max 100 requests per IP
});

app.use('/api/', limiter);
```

---

## 🎯 Production Checklist

Before deploying to production:

- [ ] Environment variables configured (`GEMINI_API_KEY`)
- [ ] `.env` file added to `.gitignore`
- [ ] Error handling implemented for all endpoints
- [ ] Rate limiting enabled
- [ ] CORS configured correctly
- [ ] Logging implemented (use Winston or similar)
- [ ] Dataset file exists and is accessible
- [ ] Python dependencies installed on server
- [ ] HTTPS enabled (SSL certificate)
- [ ] API keys encrypted at rest
- [ ] Tested with real documents
- [ ] Load testing performed
- [ ] Backup strategy for uploaded files

---

## 📝 Summary

### What We Built:

1. **Privacy Protection System** (`dataMasking.js`)
   - Automatically masks sensitive information
   - Supports Indian IDs (Aadhaar, PAN, etc.)
   - Prevents data leaks to external APIs

2. **Dataset Analysis** (Python ML Service)
   - TF-IDF vectorization
   - Cosine similarity matching
   - Document type identification

3. **AI-Powered Risk Analysis** (`aiService.js`)
   - Google Gemini integration
   - Intelligent clause analysis
   - Structured risk reporting

4. **Comprehensive API** (`analysisController.js`)
   - Complete analysis flow
   - Error handling
   - Well-documented code

### The Flow:

```
Upload PDF → OCR → Mask Data → Check Dataset + Gemini AI → Combined Report
```

### Key Benefits:

- 🔒 **Privacy First** - Sensitive data never leaves your control
- ⚡ **Fast & Efficient** - Chunking handles large documents
- 🤖 **Intelligent** - AI understands legal context
- 📊 **Comprehensive** - Multiple analysis methods
- 🛡️ **Production Ready** - Error handling, logging, validation

---

## 🆘 Need Help?

If you encounter issues:

1. Check this documentation first
2. Review error logs in terminal
3. Test components individually
4. Check environment variables
5. Verify all dependencies installed

**Common Commands:**

```bash
# Check logs
npm start  # Watch terminal output

# Test Python service
cd ml-service
python test_search.py "test"

# Verify API key
echo $GEMINI_API_KEY  # Should show key

# Restart with clean cache
rm -rf node_modules
npm install
npm start
```

---

## 📚 Additional Resources

- [Google Gemini API Docs](https://ai.google.dev/docs)
- [Express.js Guide](https://expressjs.com/en/guide/routing.html)
- [TF-IDF Explanation](https://en.wikipedia.org/wiki/Tf%E2%80%93idf)
- [Regex Testing Tool](https://regex101.com/)

---

**End of Documentation**

*Last Updated: March 3, 2026*
*Version: 1.0.0*
*Project: Nyay-Sahayak - AI-Powered Legal Document Analyzer*
