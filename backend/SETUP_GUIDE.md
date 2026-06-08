# Nyay-Sahayak - Quick Start Guide

## 🚀 What We Just Implemented

Complete AI-powered legal document analysis system with:

- ✅ **Privacy Protection** - Masks Aadhaar, PAN, Phone, Email, Names
- ✅ **Dataset Analysis** - TF-IDF + Cosine Similarity (Python ML)
- ✅ **AI Analysis** - Google Gemini for intelligent risk assessment
- ✅ **Comprehensive API** - All features in one endpoint

---

## 📁 New Files Created

```
backend/
├── config/
│   └── gemini.js                      ✅ NEW - Gemini AI config
├── services/
│   └── aiService.js                   ✅ NEW - Gemini integration
├── utils/
│   └── dataMasking.js                 ✅ NEW - Privacy protection
├── controllers/
│   └── analysisController.js          ✅ UPDATED - Added comprehensive endpoint
├── routes/
│   └── analysisRoutes.js              ✅ UPDATED - Added new route
└── test-comprehensive.js              ✅ NEW - Test script

COMPLETE_DOCUMENTATION.md              ✅ NEW - Complete guide
```

---

## ⚡ Quick Setup (5 Steps)

### Step 1: Install Dependencies

```bash
cd backend
npm install
```

**Installs:** `@google/generative-ai`, `express`, `tesseract.js`, etc.

---

### Step 2: Get Gemini API Key

1. Go to: https://makersuite.google.com/app/apikey
2. Click **"Create API Key"**
3. Copy the key (format: `AIzaSyA...`)

---

### Step 3: Create `.env` File

Create `backend/.env`:

```env
GEMINI_API_KEY=your_actual_key_here
NODE_ENV=development
PORT=5000
```

---

### Step 4: Start Server

```bash
npm start
```

**Expected output:**
```
Server running on port 5000
```

---

### Step 5: Test the API

```bash
# Install axios for test script
npm install axios

# Run test
node test-comprehensive.js
```

**Or use curl:**

```bash
curl -X POST http://localhost:5000/api/comprehensive-analysis \
  -H "Content-Type: application/json" \
  -d '{"documentText":"This is a rental agreement between Rajesh Kumar (Aadhaar: 1234-5678-9012)"}'
```

---

## 🎯 API Endpoints

### 1. Comprehensive Analysis (RECOMMENDED)

**Complete flow with all features:**

```http
POST http://localhost:5000/api/comprehensive-analysis
Content-Type: application/json

{
  "documentText": "Your document text here..."
}
```

**Returns:**
- Privacy protection info
- Dataset similarity matches
- Gemini AI risk analysis
- Processing metadata

---

### 2. Gemini AI Only

**Just AI analysis (no privacy masking):**

```http
POST http://localhost:5000/api/analyze-with-gemini

{
  "documentText": "Your document text here..."
}
```

---

### 3. Dataset Only (Python ML)

**Just similarity matching:**

```http
POST http://localhost:5000/api/analyse

{
  "text": "Your document text here..."
}
```

---

## 🔄 Data Flow

```
1. User uploads PDF
   ↓
2. OCR extracts text
   ↓
3. Data masking (Privacy!)
   "Rajesh Kumar" → "[NAME_1]"
   "1234-5678-9012" → "[AADHAAR_1]"
   ↓
4. Dataset check (TF-IDF)
   Find similar documents
   ↓
5. Gemini AI analysis
   Identify risks
   ↓
6. Combine results
   Return comprehensive report
```

---

## 📊 Example Response

```json
{
  "success": true,
  "data": {
    "privacy": {
      "protected": true,
      "totalFieldsMasked": 6,
      "summary": {
        "name": 2,
        "aadhaar": 2,
        "phone": 2
      }
    },
    "datasetAnalysis": {
      "topMatch": {
        "similarity": 0.89
      }
    },
    "aiAnalysis": {
      "summary": "This is a rental agreement...",
      "risks": [
        {
          "clause": "Section 5 - Maintenance",
          "severity": "HIGH",
          "reason": "Tenant liable for all repairs..."
        }
      ],
      "riskDistribution": {
        "high": 2,
        "medium": 1,
        "low": 0
      }
    }
  }
}
```

---

## 🧪 Testing

### Quick Test

```bash
node test-comprehensive.js
```

**Expected output:**
```
✅ Privacy Protection: WORKING
✅ Dataset Analysis: WORKING  
✅ Gemini AI: WORKING
✅ Processing Time: 5.2s
🎉 ALL TESTS PASSED!
```

---

### Manual Test with Postman

1. Open Postman
2. Create new POST request
3. URL: `http://localhost:5000/api/comprehensive-analysis`
4. Headers: `Content-Type: application/json`
5. Body (raw JSON):
   ```json
   {
     "documentText": "RENTAL AGREEMENT\n\nBetween Rajesh Kumar..."
   }
   ```
6. Click **Send**

---

## 🐛 Troubleshooting

### Issue: "GEMINI_API_KEY is not defined"

**Solution:**
1. Check `.env` file exists
2. Restart server after creating `.env`
3. Verify key format: `GEMINI_API_KEY=AIzaSyA...`

---

### Issue: Python ML service fails

**Solution:**
```bash
# Check Python installed
python --version

# Install dependencies
cd ml-service
pip install scikit-learn numpy

# Test directly
python test_search.py "test query"
```

---

### Issue: No risks detected

**Possible causes:**
- Document is genuinely safe
- Gemini prompt needs tuning
- Document too short

**Debug:**
Check logs in terminal for detailed output.

---

## 📚 Documentation

**Complete guide:** [COMPLETE_DOCUMENTATION.md](../COMPLETE_DOCUMENTATION.md)

Contains:
- Detailed architecture explanation
- Code walkthrough with examples
- TF-IDF and Cosine Similarity explained
- Security best practices
- Production deployment checklist

---

## 🔒 Security Notes

### ✅ What's Protected

- Aadhaar numbers (masked as `[AADHAAR_1]`)
- PAN cards (masked as `[PAN_1]`)
- Phone numbers (masked as `[PHONE_1]`)
- Email addresses (masked as `[EMAIL_1]`)
- Names (masked as `[NAME_1]`)

### ⚠️ Important

1. **Never commit `.env`** to Git
2. **Keep API keys secret**
3. **Use HTTPS in production**
4. **Enable rate limiting** for public APIs

---

## 🎓 How It Works

### Data Masking

```javascript
// Before masking
"Contact Rajesh Kumar at 9876543210"

// After masking (sent to Gemini)
"Contact [NAME_1] at [PHONE_1]"
```

**Result:** Personal data never reaches Google! ✅

---

### TF-IDF (Dataset Analysis)

```python
# Converts text to numbers
"rental agreement" → [0.5, 0.3, 0.8, ...]

# Compares with 100 documents
# Returns similarity scores

Result: 89% similar to "Standard Rental Agreement"
```

---

### Gemini AI (Risk Analysis)

```javascript
// Sends prompt to Gemini
"Analyze this legal document for risks..."

// Gemini understands context
- Identifies unfavorable clauses
- Assesses severity (HIGH/MEDIUM/LOW)
- Explains each risk

// Returns structured JSON
{
  "summary": "...",
  "risks": [...]
}
```

---

## 📞 Support

If you encounter issues:

1. Check [COMPLETE_DOCUMENTATION.md](../COMPLETE_DOCUMENTATION.md)
2. Review server logs in terminal
3. Run `node test-comprehensive.js` for diagnostics
4. Verify all dependencies installed

---

## ✨ Features Summary

| Feature | Status | Description |
|---------|--------|-------------|
| **Privacy Protection** | ✅ | Masks sensitive data automatically |
| **OCR Integration** | ✅ | Extract text from PDFs/images |
| **Dataset Analysis** | ✅ | Find similar documents (TF-IDF) |
| **AI Risk Analysis** | ✅ | Intelligent Gemini-powered insights |
| **Comprehensive API** | ✅ | All-in-one endpoint |
| **Error Handling** | ✅ | Graceful failures |
| **Documentation** | ✅ | Complete guide included |
| **Test Suite** | ✅ | Automated testing |

---

## 🎉 You're Ready!

Everything is set up and ready to use. Run the test script to verify:

```bash
node test-comprehensive.js
```

**Happy coding! 🚀**

---

*Last Updated: March 3, 2026*
*Version: 1.0.0*
*Project: Nyay-Sahayak*
