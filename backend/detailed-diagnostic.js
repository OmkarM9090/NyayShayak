// Detailed error diagnostic
import "dotenv/config";
import { GoogleGenerativeAI } from "@google/generative-ai";

console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
console.log("🔍 Detailed Diagnostic");
console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
console.log("");

const apiKey = process.env.GEMINI_API_KEY;

console.log("API Key Info:");
console.log("  First 15 chars:", apiKey.substring(0, 15) + "...");
console.log("  Last 4 chars: ..." + apiKey.slice(-4));
console.log("  Length:", apiKey.length);
console.log("");

async function testWithFullError() {
  try {
    console.log("Testing gemini-pro model...");
    console.log("");
    
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-pro" });
    
    const result = await model.generateContent("Hello");
    const response = result.response.text();
    
    console.log("✅ SUCCESS!");
    console.log("Response:", response);
    
  } catch (error) {
    console.log("❌ FULL ERROR DETAILS:");
    console.log("");
    console.log("Error name:", error.name);
    console.log("Error message:", error.message);
    console.log("");
    console.log("Full error object:");
    console.log(JSON.stringify(error, null, 2));
    console.log("");
    
    // Check if it's a 403 (forbidden) or 404 (not found)
    if (error.message.includes("403")) {
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      console.log("⚠️  ERROR 403: API key has insufficient permissions");
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      console.log("");
      console.log("Fix: The API key might have restrictions.");
      console.log("");
      console.log("Option 1: Create NEW unrestricted key");
      console.log("  1. Go to: https://aistudio.google.com/app/apikey");
      console.log("  2. Click 'Create API key'");
      console.log("  3. Choose 'Create API key in new project'");
      console.log("  4. Copy the new key");
      console.log("  5. Replace in .env file");
      console.log("");
    } else if (error.message.includes("404")) {
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      console.log("⚠️  ERROR 404: Model not found");
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      console.log("");
      console.log("This means the Generative Language API might still be activating.");
      console.log("Wait 2-3 minutes and try again.");
      console.log("");
    } else if (error.message.includes("400")) {
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      console.log("⚠️  ERROR 400: Bad Request / Invalid API Key");
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      console.log("");
      console.log("Your API key format is correct but Google rejects it.");
      console.log("");
      console.log("SOLUTION: Create a FRESH API key:");
      console.log("");
      console.log("  1. Go to: https://aistudio.google.com/app/apikey");
      console.log("  2. Click '+ Create API key'");
      console.log("  3. Select 'Create API key in new project'");
      console.log("  4. WAIT for it to be created (30 seconds)");
      console.log("  5. Copy the ENTIRE key");
      console.log("  6. Open backend/.env");
      console.log("  7. Replace: GEMINI_API_KEY=your_new_key");
      console.log("  8. Save and run: node find-working-model.js");
      console.log("");
    }
  }
}

testWithFullError();
