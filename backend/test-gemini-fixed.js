import "dotenv/config";
import { geminiModel } from "./config/gemini.js";

console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
console.log("🧪 Testing Gemini 2.0 Flash Model");
console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

async function testGemini() {
  try {
    console.log("📤 Sending test request to Gemini...\n");
    
    const result = await geminiModel.generateContent(
      "Say 'Hello! I am Gemini 2.0 Flash and I am working perfectly!' in exactly that way."
    );
    
    const response = result.response.text();
    
    console.log("✅ SUCCESS!\n");
    console.log("Response from Gemini:");
    console.log("─────────────────────");
    console.log(response);
    console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("🎉 Gemini AI is NOW WORKING!");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
    console.log("Next steps:");
    console.log("1. Start server: npm start");
    console.log("2. Test comprehensive analysis: node test-comprehensive.js\n");
    
  } catch (error) {
    console.log("❌ FAILED\n");
    console.error("Error:", error.message);
    console.log("\nIf still failing, run: node identify-project.js");
  }
}

testGemini();
