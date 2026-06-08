# ⚖️ Nyay Sahayak: AI-Powered Legal Risk Analyzer
**Your AI Shield Against Legal Fraud.**

Nyay Sahayak is an intelligent, full-stack AI legal assistant designed to democratize legal comprehension. By leveraging Optical Character Recognition (OCR) and Large Language Models (LLMs), it analyzes complex legal documents, detects hidden risks, highlights unfair clauses, and translates dense legal jargon into plain, understandable language. 

---

## 🛑 The Problem
Legal documents—such as rental agreements, employment contracts, and Non-Disclosure Agreements (NDAs)—are notoriously difficult for the average person to understand. They are often filled with:
* **Complex Jargon:** Archaic language designed for lawyers, not everyday people.
* **Hidden Clauses:** Buried penalties, unfair termination conditions, or hidden fees.
* **Asymmetric Information:** Power imbalances where one party understands the contract completely, while the other signs blindly out of necessity.

## 💡 The Solution (Nyay Sahayak)
Nyay Sahayak bridges this gap by acting as a personal, unbiased legal reviewer. Users can simply upload a picture or PDF of their contract, and the system will extract the text, process it through an AI engine, and provide a comprehensive "Risk Score" alongside a plain-English summary of critical clauses.

### 🎯 Target Audience
* **Freelancers & Contractors:** Reviewing client agreements and NDAs.
* **Tenants:** Understanding rental agreements and security deposit conditions.
* **Employees:** Checking offer letters for unfair non-compete clauses.
* **Startups:** Quick, preliminary reviews of vendor contracts before sending them to expensive legal counsel.

---

## ✨ Core Features
* **Intelligent Document OCR:** Upload PDFs or images. The Python-based Flask microservice instantly extracts raw text using the Tesseract OCR engine.
* **Conversational AI Interface:** A highly polished, reactive UI built with Tailwind CSS v4, allowing users to upload documents and type specific contextual questions in a single thread.
* **Automated Risk Detection:** (Integration Pending) Connects to the Google Gemini API to scan clauses for loopholes, unfair terms, and hidden penalties.
* **Modular "Modern Juris" UI:** A bespoke, accessible color theme featuring smooth sidebar animations, auto-scrolling chat threads, and real-time loading states.
* **Secure, Decoupled Architecture:** A scalable Express.js backend utilizing ES6 modules, separating the heavy machine learning tasks from the main API gateway.

---

## 🧠 System Architecture & Data Flow

1. **Client Layer (React/Vite):** The user uploads a document or types a prompt via the conversational UI.
2. **API Gateway (Node.js/Express):** The backend receives the request via `multer` (in-memory storage).
3. **ML Microservice (Python/Flask):** The Node server forwards the file to the Flask service. `PyTesseract` runs OCR to extract the raw text and returns it to Node.
4. **AI Processing (Gemini API):** The Node server combines the extracted text with a "Master System Prompt" and sends it to the LLM for risk analysis.
5. **Response:** The plain-English analysis is returned to the React frontend and displayed in the chat interface.

---

## 🛠️ Tech Stack
This project utilizes a modern **MERN** stack alongside a dedicated Python AI service.

**Frontend:**
* React.js (Vite)
* Tailwind CSS v4 (Custom Theming)
* React Router DOM
* Lucide React (Icons)

**Backend:**
* Node.js & Express.js (ES6 Modules)
* Multer (File handling)
* Axios (Microservice communication)
* Google Gemini API 

**Machine Learning Service:**
* Python 3 & Flask
* Tesseract OCR
* PyTesseract

---

## ⚙️ Environment Variables (.env)
To run this project, you will need to add the following environment variables to your `backend/.env` file:

``` env
PORT=5000
# Database Connection
MONGODB_URI=your_mongodb_connection_string
# AI Integration
GEMINI_API_KEY=your_google_gemini_api_key
```

---

## 🚀 Local Setup Instructions

To run this project locally, you must open **three separate terminals** to run the frontend, backend, and ML service simultaneously.

### 1. The Machine Learning Service (Port 5001)
*Prerequisite: You must have Tesseract OCR installed on your operating system (e.g., `brew install tesseract` on Mac or via the UB Mannheim installer on Windows).*
```bash
cd ml_service
python -m venv venv

# Windows:
.\venv\Scripts\activate
# Mac/Linux:
source venv/bin/activate

pip install -r requirement.txt
python app.py
```

### 2. The Node.js Backend (Port 5000)
```bash
cd backend
npm install
npm run dev
```

### 3. The React Frontend (Port 5173)
```bash
cd frontend
npm install
npm run dev
```

Once all three servers are active, navigate to **\`http://localhost:5173\`** to access the application.

---

## 📚 Documentation

### 🚀 **New to the project? Start here:**
- **[Quick Start Guide](./QUICK_START.md)** - Get up and running in 5 minutes
- **[Integration Documentation](./INTEGRATION_DOCUMENTATION.md)** - Complete technical documentation

### 📖 **What's in the documentation:**
- ✅ Complete API reference for all endpoints
- ✅ Frontend-Backend integration guide
- ✅ Data flow diagrams and architecture overview
- ✅ Error handling and troubleshooting
- ✅ Security features and privacy protection
- ✅ Code examples and best practices
- ✅ Deployment considerations

---

*Disclaimer: Nyay Sahayak is an AI tool designed for educational and preliminary screening purposes. It does not constitute formal legal advice. Always consult a qualified legal professional for critical matters.*
