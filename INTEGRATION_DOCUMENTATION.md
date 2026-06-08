# Nyay Sahayak - Frontend-Backend Integration Documentation

## 📚 Table of Contents
1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Backend API](#backend-api)
4. [Frontend Integration](#frontend-integration)
5. [Data Flow](#data-flow)
6. [Setup Instructions](#setup-instructions)
7. [Error Handling](#error-handling)
8. [Security Features](#security-features)
9. [Testing](#testing)
10. [Troubleshooting](#troubleshooting)

---

## 🎯 Overview

**Nyay Sahayak** is an AI-powered legal document analysis platform that helps users identify risks and understand complex legal clauses. The system provides:

- **Document Upload**: Support for PDF and image files (PNG, JPEG, GIF, WEBP)
- **Text Analysis**: Direct text input for quick analysis
- **Privacy Protection**: Automatic masking of sensitive information (Aadhaar, PAN, phone numbers, etc.)
- **AI-Powered Analysis**: Google Gemini AI for intelligent risk assessment
- **User-Friendly Interface**: Chat-style interface for easy interaction

---

## 🏗️ Architecture

### Technology Stack

**Backend:**
- Node.js + Express.js
- Google Gemini AI API
- Tesseract.js (OCR)
- PDF-parse
- Multer (file upload)

**Frontend:**
- React 18
- Vite
- Tailwind CSS
- Lucide Icons

### Project Structure

```
Nyay-Sahayak/
├── backend/
│   ├── server.js                      # Main server file
│   ├── controllers/
│   │   ├── documentController.js      # 🆕 Unified document handling
│   │   ├── analysisController.js      # AI analysis endpoints
│   │   ├── ocrController.js           # OCR processing
│   │   └── pdfController.js           # PDF processing
│   ├── routes/
│   │   ├── documentRoutes.js          # 🆕 Main API routes
│   │   ├── analysisRoutes.js
│   │   ├── ocrRoutes.js
│   │   └── pdfRoutes.js
│   ├── services/
│   │   └── aiService.js               # Gemini AI integration
│   ├── utils/
│   │   └── dataMasking.js             # Privacy protection
│   ├── config/
│   │   └── gemini.js                  # Gemini configuration
│   └── uploads/
│       ├── pdfs/
│       └── images/
│
└── frontend/
    └── src/
        ├── pages/
        │   └── ChatPage.jsx           # 🆕 Updated main interface
        ├── services/
        │   └── api.js                 # 🆕 API service layer
        ├── utils/
        │   └── formatAnalysis.js      # 🆕 Response formatting
        └── components/
            ├── Header.jsx
            └── Sidebar.jsx
```

---

## 🔌 Backend API

### Base URL
```
http://localhost:5000/api
```

### Endpoints

#### 1. **Document Analysis (Recommended)**

**POST** `/document/analyze`

Upload and analyze a document (PDF or image).

**Request:**
- Method: `POST`
- Content-Type: `multipart/form-data`
- Body:
  - `document`: File (PDF/Image, max 15MB)

**Response:**
```json
{
  "success": true,
  "message": "Document analysis completed successfully",
  "data": {
    "document": {
      "fileName": "contract.pdf",
      "fileSize": 524288,
      "fileType": "application/pdf",
      "pages": 3,
      "extractionMethod": "pdf-parse",
      "textLength": 12450
    },
    "privacy": {
      "protected": true,
      "fieldsProtected": 5,
      "dataTypes": ["aadhaar", "phone", "email"],
      "summary": {
        "aadhaar": 2,
        "phone": 2,
        "email": 1
      }
    },
    "analysis": {
      "summary": "This is a rental agreement...",
      "risks": [
        {
          "clause": "Section 3.2",
          "severity": "HIGH",
          "reason": "Unfair termination clause..."
        }
      ],
      "riskStatistics": {
        "total": 3,
        "high": 1,
        "medium": 1,
        "low": 1
      }
    },
    "metadata": {
      "processedAt": "2026-03-05T10:30:00.000Z",
      "processingSteps": [...]
    }
  }
}
```

**Error Response:**
```json
{
  "success": false,
  "message": "File size exceeds 15MB limit",
  "error": "FILE_TOO_LARGE"
}
```

---

#### 2. **Text-Only Analysis**

**POST** `/document/analyze-text`

Analyze text directly without file upload.

**Request:**
```json
{
  "text": "This Agreement is entered into..."
}
```

**Response:**
```json
{
  "success": true,
  "message": "Text analysis completed successfully",
  "data": {
    "privacy": { ... },
    "analysis": { ... },
    "metadata": { ... }
  }
}
```

---

#### 3. **Health Check**

**GET** `/document/health`

Check if the API service is running.

**Response:**
```json
{
  "success": true,
  "message": "Document analysis service is running",
  "timestamp": "2026-03-05T10:30:00.000Z"
}
```

---

### Error Codes

| Code | Description | HTTP Status |
|------|-------------|-------------|
| `FILE_MISSING` | No file uploaded | 400 |
| `FILE_TOO_LARGE` | File exceeds 15MB | 400 |
| `INVALID_FILE_TYPE` | Unsupported file format | 400 |
| `INSUFFICIENT_TEXT` | Not enough text extracted | 400 |
| `TEXT_TOO_SHORT` | Text input too short | 400 |
| `SCANNED_PDF` | PDF requires OCR | 400 |
| `AI_SERVICE_ERROR` | Gemini API issue | 503 |
| `PROCESSING_ERROR` | General server error | 500 |

---

## 💻 Frontend Integration

### API Service Layer

**File:** `frontend/src/services/api.js`

```javascript
import { analyzeDocument, analyzeText } from '../services/api';

// Example: Analyze document
const result = await analyzeDocument(file);
console.log(result.data.analysis.risks);

// Example: Analyze text
const result = await analyzeText("Contract text...");
```

### Functions

#### `analyzeDocument(file, onProgress?)`

Upload and analyze a document.

**Parameters:**
- `file`: File object from input
- `onProgress`: Optional callback for progress tracking

**Returns:** Promise with analysis results

**Example:**
```javascript
const handleUpload = async (file) => {
  try {
    const result = await analyzeDocument(file, (progress) => {
      console.log(progress.stage); // "uploading", "analyzing", "completed"
    });
    
    // Display results
    console.log(result.data.analysis.summary);
    console.log(result.data.analysis.risks);
  } catch (error) {
    console.error(error.message);
  }
};
```

---

#### `analyzeText(text)`

Analyze text directly.

**Parameters:**
- `text`: String to analyze (minimum 50 characters)

**Returns:** Promise with analysis results

**Example:**
```javascript
const handleTextAnalysis = async (text) => {
  try {
    const result = await analyzeText(text);
    console.log(result.data.analysis.risks);
  } catch (error) {
    console.error(error.message);
  }
};
```

---

### Response Formatting

**File:** `frontend/src/utils/formatAnalysis.js`

```javascript
import { formatAnalysisResponse } from '../utils/formatAnalysis';

// Format for display
const formattedMessage = formatAnalysisResponse(apiResponse);

// Display in chat
addMessage(formattedMessage);
```

---

## 🔄 Data Flow

### Document Upload Flow

```
┌──────────────┐
│   User       │
│  Uploads     │
│  Document    │
└──────┬───────┘
       │
       ▼
┌──────────────────────────────────────────────────────┐
│              Frontend (ChatPage.jsx)                 │
│  - Validate file (size, type)                        │
│  - Call analyzeDocument(file)                        │
└──────────────────┬───────────────────────────────────┘
                   │
                   ▼
┌──────────────────────────────────────────────────────┐
│           API Service (api.js)                       │
│  - Create FormData                                   │
│  - POST to /api/document/analyze                     │
└──────────────────┬───────────────────────────────────┘
                   │
                   ▼
┌──────────────────────────────────────────────────────┐
│         Backend (documentController.js)              │
│  ┌────────────────────────────────────────────┐     │
│  │ Step 1: Extract Text                       │     │
│  │  - PDF: pdf-parse                          │     │
│  │  - Image: Tesseract OCR                    │     │
│  └────────────────┬───────────────────────────┘     │
│                   │                                  │
│  ┌────────────────▼───────────────────────────┐     │
│  │ Step 2: Mask Sensitive Data                │     │
│  │  - Aadhaar, PAN, Phone, Email, etc.        │     │
│  │  - dataMasking.js utility                  │     │
│  └────────────────┬───────────────────────────┘     │
│                   │                                  │
│  ┌────────────────▼───────────────────────────┐     │
│  │ Step 3: AI Analysis                        │     │
│  │  - Send to Gemini AI                       │     │
│  │  - aiService.js                            │     │
│  └────────────────┬───────────────────────────┘     │
│                   │                                  │
│  ┌────────────────▼───────────────────────────┐     │
│  │ Step 4: Build Response                     │     │
│  │  - Combine all results                     │     │
│  │  - Calculate statistics                    │     │
│  └────────────────┬───────────────────────────┘     │
└───────────────────┼───────────────────────────────────┘
                    │
                    ▼
┌──────────────────────────────────────────────────────┐
│         Response Sent to Frontend                    │
│  - Document info                                     │
│  - Privacy protection details                        │
│  - AI analysis with risks                            │
│  - Statistics and metadata                           │
└──────────────────┬───────────────────────────────────┘
                   │
                   ▼
┌──────────────────────────────────────────────────────┐
│         Frontend Displays Results                    │
│  - formatAnalysisResponse()                          │
│  - Show in chat interface                            │
│  - Highlight risks by severity                       │
└──────────────────────────────────────────────────────┘
```

---

## ⚙️ Setup Instructions

### Prerequisites

- Node.js 18+ installed
- Gemini API key from Google AI Studio

### Backend Setup

1. **Navigate to backend folder:**
   ```bash
   cd backend
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Create `.env` file:**
   ```env
   GEMINI_API_KEY=your_gemini_api_key_here
   PORT=5000
   NODE_ENV=development
   ```

4. **Create upload directories:**
   ```bash
   mkdir -p uploads/pdfs uploads/images
   ```

5. **Start the server:**
   ```bash
   npm run dev
   ```

   Server will run on `http://localhost:5000`

---

### Frontend Setup

1. **Navigate to frontend folder:**
   ```bash
   cd frontend
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Create `.env` file (optional):**
   ```env
   VITE_API_BASE_URL=http://localhost:5000/api
   ```

4. **Start development server:**
   ```bash
   npm run dev
   ```

   Frontend will run on `http://localhost:5173`

---

### Verify Installation

1. **Check backend health:**
   ```bash
   curl http://localhost:5000/api/document/health
   ```

   Expected response:
   ```json
   {
     "success": true,
     "message": "Document analysis service is running"
   }
   ```

2. **Open frontend:**
   - Navigate to `http://localhost:5173`
   - Upload a test document
   - Verify analysis results appear

---

## 🛡️ Error Handling

### Frontend Error Handling

The API service automatically formats errors for user display:

```javascript
try {
  const result = await analyzeDocument(file);
} catch (error) {
  // error.message contains user-friendly message
  // error.code contains error type
  // error.originalError contains original error
  
  console.error(error.message);
  // "Unable to connect to server. Please check if the backend is running."
}
```

### Backend Error Handling

All endpoints return consistent error format:

```json
{
  "success": false,
  "message": "User-friendly error message",
  "error": "ERROR_CODE",
  "details": "Stack trace (development only)"
}
```

### Common Error Scenarios

#### Scenario 1: File Too Large
```javascript
// Frontend validation
if (file.size > 15 * 1024 * 1024) {
  throw new Error("File size exceeds 15MB limit");
}
```

#### Scenario 2: Invalid File Type
```javascript
const allowedTypes = ["application/pdf", "image/png", "image/jpeg"];
if (!allowedTypes.includes(file.type)) {
  throw new Error("Invalid file type");
}
```

#### Scenario 3: Network Error
```javascript
catch (error) {
  if (error.message === "Failed to fetch") {
    return "Unable to connect to server";
  }
}
```

---

## 🔒 Security Features

### 1. **Data Masking (Privacy Protection)**

**File:** `backend/utils/dataMasking.js`

Automatically masks sensitive information before sending to AI:

- **Aadhaar Numbers**: `1234-5678-9012` → `[AADHAAR_1]`
- **PAN Cards**: `ABCDE1234F` → `[PAN_1]`
- **Phone Numbers**: `9876543210` → `[PHONE_1]`
- **Email Addresses**: `user@example.com` → `[EMAIL_1]`
- **Credit Cards**: `1234-5678-9012-3456` → `[CREDIT_CARD_1]`

**Example:**
```javascript
const { maskedText, replacements } = maskSensitiveData(document);
// maskedText is safe to send to external APIs
// replacements contains mapping for restoration
```

### 2. **File Validation**

- Maximum file size: 15MB
- Allowed formats: PDF, PNG, JPEG, JPG, GIF, WEBP
- MIME type verification

### 3. **File Cleanup**

Uploaded files are automatically deleted after processing:

```javascript
// Cleanup on success
fs.unlinkSync(filePath);

// Cleanup on error
if (filePath && fs.existsSync(filePath)) {
  fs.unlinkSync(filePath);
}
```

### 4. **Environment Variables**

API keys and sensitive config stored in `.env` (not committed):

```env
GEMINI_API_KEY=your_key_here  # Never commit this
```

### 5. **CORS Protection**

CORS enabled for development (configure for production):

```javascript
app.use(cors());
// Production: app.use(cors({ origin: 'https://your-domain.com' }));
```

---

## 🧪 Testing

### Manual Testing

#### Test 1: Document Upload

1. Upload a sample PDF contract
2. Verify text extraction succeeds
3. Check privacy masking (if sensitive data present)
4. Verify AI analysis returns risks
5. Confirm file is deleted from server

#### Test 2: Image OCR

1. Upload an image of a document
2. Verify OCR extracts text correctly
3. Check analysis results
4. Verify file cleanup

#### Test 3: Text-Only Analysis

1. Paste legal text in input
2. Verify analysis without file upload
3. Check risk detection

#### Test 4: Error Handling

1. Upload file > 15MB → Should show error
2. Upload unsupported file type → Should show error
3. Submit empty input → Should be disabled
4. Stop backend → Should show connection error

### API Testing (Postman/cURL)

**Test Document Upload:**
```bash
curl -X POST http://localhost:5000/api/document/analyze \
  -F "document=@/path/to/test.pdf"
```

**Test Text Analysis:**
```bash
curl -X POST http://localhost:5000/api/document/analyze-text \
  -H "Content-Type: application/json" \
  -d '{"text": "This is a sample legal document for testing purposes..."}'
```

**Test Health Check:**
```bash
curl http://localhost:5000/api/document/health
```

---

## 🔧 Troubleshooting

### Issue 1: "Unable to connect to server"

**Symptoms:** Frontend can't reach backend

**Solutions:**
1. Check if backend is running: `npm run dev` in backend/
2. Verify port 5000 is not in use
3. Check firewall settings
4. Verify API_BASE_URL in frontend

---

### Issue 2: "Gemini API error"

**Symptoms:** AI analysis fails

**Solutions:**
1. Verify GEMINI_API_KEY in `.env`
2. Check API key validity in Google AI Studio
3. Verify API quota not exceeded
4. Check internet connection

---

### Issue 3: "File upload fails"

**Symptoms:** Upload doesn't complete

**Solutions:**
1. Check file size < 15MB
2. Verify supported file format
3. Check uploads/ directories exist
4. Verify disk space available

---

### Issue 4: "OCR extraction fails"

**Symptoms:** Image text not extracted

**Solutions:**
1. Ensure image quality is sufficient
2. Check Tesseract.js is installed
3. Verify image contains readable text
4. Try different image format

---

### Issue 5: "PDF parsing fails"

**Symptoms:** PDF text not extracted

**Solutions:**
1. Check if PDF is text-based (not scanned)
2. For scanned PDFs, convert to image and use OCR
3. Verify pdf-parse dependency installed
4. Check PDF is not encrypted/password-protected

---

## 📊 Performance Considerations

### Backend Optimization

1. **Text Chunking**: Large documents split into chunks
2. **File Cleanup**: Immediate deletion after processing
3. **Error Boundaries**: Graceful failure handling
4. **Async Processing**: Non-blocking operations

### Frontend Optimization

1. **Lazy Loading**: Components loaded on demand
2. **Progress Indicators**: User feedback during long operations
3. **Error Recovery**: Clear error messages and retry options
4. **Debouncing**: Text input validation

---

## 🚀 Deployment Considerations

### Backend

1. Set NODE_ENV=production
2. Configure CORS for specific domains
3. Set up proper logging (e.g., Winston)
4. Use process manager (PM2)
5. Configure reverse proxy (nginx)
6. Set up SSL/TLS

### Frontend

1. Build for production: `npm run build`
2. Configure environment variables
3. Set up CDN for static assets
4. Enable gzip compression
5. Configure caching headers

---

## 📝 Code Quality Standards

### Comments

- All functions have JSDoc comments
- Complex logic explained inline
- Clear section separators (━━━)

### Error Handling

- Try-catch blocks for async operations
- User-friendly error messages
- Detailed logging for debugging

### Code Organization

- Modular architecture
- Single responsibility principle
- Clear file/folder structure
- Consistent naming conventions

---

## 👥 Developer Notes

### Adding New Analysis Features

1. Update `aiService.js` for AI prompts
2. Modify `documentController.js` for processing
3. Update `formatAnalysis.js` for display
4. Add error handling
5. Update documentation

### Modifying Data Masking

1. Edit patterns in `dataMasking.js`
2. Test with sample data
3. Update privacy summary
4. Document changes

---

## 📞 Support

For issues or questions:
- Check troubleshooting section
- Review error codes
- Check console logs (browser + server)
- Verify environment variables

---

## 🎉 Success Indicators

✅ Backend server running without errors  
✅ Frontend connects to backend successfully  
✅ Document upload works with progress indicator  
✅ Text extraction succeeds (PDF/OCR)  
✅ Privacy masking detects sensitive data  
✅ AI analysis returns risks  
✅ Results display in chat interface  
✅ Errors show user-friendly messages  
✅ Files cleaned up after processing  

---

**Last Updated:** March 5, 2026  
**Version:** 1.0.0  
**Authors:** Development Team
