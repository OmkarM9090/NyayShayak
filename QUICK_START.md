# 🚀 Quick Start Guide - Nyay Sahayak

This guide will help you get the application running in under 5 minutes.

## ✅ Prerequisites

- Node.js 18+ installed ([Download](https://nodejs.org/))
- A Gemini API key ([Get one free](https://makersuite.google.com/app/apikey))
- A code editor (VS Code recommended)
- Terminal/Command Prompt

---

## 📦 Step 1: Clone & Navigate

```bash
cd "c:\MERN Practice\Nyay-Sahayak"
```

---

## 🔧 Step 2: Backend Setup (2 minutes)

### 1. Navigate to backend
```bash
cd backend
```

### 2. Install dependencies
```bash
npm install
```

### 3. Create `.env` file
Create a file named `.env` in the `backend` folder with:

```env
GEMINI_API_KEY=your_actual_api_key_here
PORT=5000
NODE_ENV=development
```

**How to get Gemini API Key:**
1. Go to https://makersuite.google.com/app/apikey
2. Sign in with Google
3. Click "Create API Key"
4. Copy and paste into `.env`

### 4. Create upload directories
```bash
mkdir uploads\pdfs
mkdir uploads\images
```

### 5. Start backend server
```bash
npm run dev
```

✅ **Success indicator:** You should see:
```
✅ Server running on port 5000
✅ Gemini API Key: Loaded
```

**Leave this terminal running!**

---

## 💻 Step 3: Frontend Setup (2 minutes)

### 1. Open a NEW terminal and navigate to frontend
```bash
cd frontend
```

### 2. Install dependencies
```bash
npm install
```

### 3. Start frontend server
```bash
npm run dev
```

✅ **Success indicator:** You should see:
```
  VITE v5.x ready in xxx ms
  ➜  Local:   http://localhost:5173/
```

**Leave this terminal running too!**

---

## 🎯 Step 4: Test the Application (1 minute)

### 1. Open browser
Visit: http://localhost:5173

### 2. Navigate to Chat
Click on the "Chat" or "Analyze" link in the sidebar

### 3. Test document upload
- Click "Upload Document"
- Select a PDF or image file (max 15MB)
- Click send (arrow button)
- Wait for analysis results

### 4. Test text analysis
- Type or paste legal text (minimum 50 characters)
- Click send
- View AI analysis

---

## ✅ Verification Checklist

- [ ] Backend running on port 5000
- [ ] Frontend running on port 5173
- [ ] Can access http://localhost:5173 in browser
- [ ] Can upload and analyze a document
- [ ] Results display with risk analysis
- [ ] No errors in browser console
- [ ] No errors in backend terminal

---

## 🐛 Quick Troubleshooting

### Issue: "GEMINI_API_KEY is not set"
**Solution:** 
- Check `.env` file exists in `backend/` folder
- Verify API key is correct
- No spaces or quotes around the key

### Issue: "Unable to connect to server"
**Solution:**
- Make sure backend is running (check terminal)
- Verify backend is on port 5000
- Check firewall isn't blocking the port

### Issue: "Module not found"
**Solution:**
```bash
# In backend:
npm install

# In frontend:
npm install
```

### Issue: "File upload fails"
**Solution:**
- Check file size < 15MB
- Verify file type (PDF or image)
- Ensure uploads folders exist

---

## 📁 Project Structure Overview

```
Nyay-Sahayak/
├── backend/              # Node.js + Express server
│   ├── .env             # 🔒 Your API keys (create this!)
│   ├── server.js        # Main server file
│   ├── controllers/     # Request handlers
│   ├── routes/          # API endpoints
│   ├── services/        # Business logic (AI service)
│   └── uploads/         # Temporary file storage
│
└── frontend/            # React + Vite app
    └── src/
        ├── pages/       # UI pages (ChatPage)
        ├── services/    # API communication
        ├── utils/       # Helper functions
        └── components/  # Reusable UI components
```

---

## 🎨 Features to Try

### 1. **Privacy Protection**
Upload a document with Aadhaar numbers, phone numbers, or email addresses. Notice how the system automatically masks them!

### 2. **Risk Detection**
Upload a legal contract. The AI will identify potentially risky clauses and explain them.

### 3. **Text Analysis**
Paste a rental agreement or terms of service. Get instant analysis without uploading a file.

---

## 📚 Next Steps

1. ✅ Successfully running? Great! Read the [full documentation](./INTEGRATION_DOCUMENTATION.md)
2. 🔍 Want to customize? Check out the code comments in each file
3. 🚀 Ready to deploy? See the deployment section in the documentation
4. 🐛 Found a bug? Check [troubleshooting guide](./INTEGRATION_DOCUMENTATION.md#troubleshooting)

---

## 💡 Pro Tips

1. **Keep both terminals open** while developing
2. **Check browser console** (F12) for frontend errors
3. **Check terminal** for backend errors
4. **Save changes and refresh** browser to see updates
5. **Use Ctrl+C** to stop servers when done

---

## 🆘 Need Help?

1. Check the comprehensive [Integration Documentation](./INTEGRATION_DOCUMENTATION.md)
2. Review error messages in browser console and terminal
3. Verify all dependencies are installed
4. Ensure API key is valid and has quota

---

## 🎉 Success!

If you can upload a document and see AI analysis results, you're all set! 

The application is now ready to analyze legal documents, detect risks, and protect sensitive information.

---

**Last Updated:** March 5, 2026  
**Version:** 1.0.0
