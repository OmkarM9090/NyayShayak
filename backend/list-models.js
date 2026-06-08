// List available Gemini models
import "dotenv/config";
import { GoogleGenerativeAI } from "@google/generative-ai";

console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
console.log("🔍 Checking Available Gemini Models");
console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
console.log("");

const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
  console.error("❌ GEMINI_API_KEY not found in .env file");
  process.exit(1);
}

async function listModels() {
  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    
    console.log("Fetching available models...");
    console.log("");
    
    // Try to list models
    const models = await genAI.listModels();
    
    console.log("✅ Available models:");
    console.log("");
    
    for await (const model of models) {
      console.log("  📦 Model:", model.name);
      console.log("     Display Name:", model.displayName);
      console.log("     Supported Methods:", model.supportedGenerationMethods?.join(", ") || "N/A");
      console.log("");
    }
    
  } catch (error) {
    console.log("❌ Error listing models:", error.message);
    console.log("");
    console.log("This means your API key needs the Generative Language API enabled.");
    console.log("");
    console.log("Fix steps:");
    console.log("1. Go to: https://console.cloud.google.com/apis/library/generativelanguage.googleapis.com");
    console.log("2. Select project: gen-lang-client-0300653964");
    console.log("3. Click 'ENABLE' button");
    console.log("4. Wait 1-2 minutes for activation");
    console.log("5. Run this script again");
    console.log("");
  }
}

listModels();
