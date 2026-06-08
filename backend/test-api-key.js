// Quick test to validate Gemini API key
import "dotenv/config";
import { GoogleGenerativeAI } from "@google/generative-ai";

console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
console.log("🧪 Testing Gemini API Key");
console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
console.log("");

const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
  console.error("❌ GEMINI_API_KEY not found in .env file");
  console.error("");
  console.error("Fix: Add this to backend/.env:");
  console.error("GEMINI_API_KEY=your_actual_key_here");
  console.error("");
  process.exit(1);
}

console.log("✅ API Key loaded from .env");
console.log("   First 10 chars:", apiKey.substring(0, 10) + "...");
console.log("   Length:", apiKey.length, "characters");
console.log("");
console.log("🔄 Testing connection to Gemini API...");
console.log("");

async function testGeminiAPI() {
  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const result = await model.generateContent("Say 'Hello' if you can read this.");
    const response = result.response.text();

    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("✅ SUCCESS! Gemini API is working!");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("");
    console.log("Response from Gemini:", response);
    console.log("");
    console.log("✨ Your API key is valid and ready to use!");
    console.log("");
  } catch (error) {
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("❌ FAILED - API Key is Invalid");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("");
    console.log("Error:", error.message);
    console.log("");
    console.log("Possible reasons:");
    console.log("1. API key is incorrect or expired");
    console.log("2. API key not created from correct location");
    console.log("3. API key has restrictions that block requests");
    console.log("");
    console.log("How to fix:");
    console.log("1. Go to: https://aistudio.google.com/app/apikey");
    console.log("2. Create a NEW API key");
    console.log("3. Copy the ENTIRE key (starts with 'AIza...')");
    console.log("4. Replace in backend/.env:");
    console.log("   GEMINI_API_KEY=your_new_key_here");
    console.log("5. Make sure no extra spaces or quotes");
    console.log("");
    process.exit(1);
  }
}

testGeminiAPI();
