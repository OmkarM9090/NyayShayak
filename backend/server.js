// Load environment variables from .env file
import "dotenv/config";
import connectDB from "./config/db.js";
import express from "express";
import cors from "cors";
import analysisRoutes from "./routes/analysisRoutes.js";
import ocrRoutes from "./routes/ocrRoutes.js";
import pdfRoutes from "./routes/pdfRoutes.js";
import documentRoutes from "./routes/documentRoutes.js";
import authRoutes from "./routes/authRoutes.js";    
import chatRoutes from "./routes/chatRoutes.js";
import firRoutes from "./routes/firRoutes.js";
import { rateLimit } from "./middleware/rateLimit.js";

// Validate environment variables on startup
if (!process.env.GEMINI_API_KEY) {
  console.error("❌ ERROR: GEMINI_API_KEY is not set in .env file");
  console.error("Please add GEMINI_API_KEY=your_key_here to backend/.env");
  process.exit(1);
}
connectDB();
const app = express();

app.use(cors());
app.use(express.json());

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// API ROUTES
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// Primary Document Analysis Route (Recommended)
app.use("/api/document", rateLimit, documentRoutes);

// Legacy routes (for backward compatibility)
app.use("/api", analysisRoutes);
app.use("/api", ocrRoutes);
app.use("/api/pdf", pdfRoutes);
app.use("/api/generate-fir", rateLimit);
app.use("/api", firRoutes);

// auth routes
app.use('/api/auth', authRoutes);
app.use("/api/chat", rateLimit, chatRoutes);

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("✅ Server running on port", PORT);
  console.log("✅ Environment:", process.env.NODE_ENV || "development");
  console.log("✅ Gemini API Key:", process.env.GEMINI_API_KEY ? "Loaded (first 10 chars: " + process.env.GEMINI_API_KEY.substring(0, 10) + "...)" : "❌ NOT SET");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
});
