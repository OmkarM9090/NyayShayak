import "dotenv/config";
import { GoogleGenerativeAI } from "@google/generative-ai";

const apiKey = process.env.GEMINI_API_KEY;
const genAI = new GoogleGenerativeAI(apiKey);

console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
console.log("🔍 Finding Model with Available Quota");
console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

// Try models in order of preference (lite versions have higher free quotas)
const modelsToTry = [
  "gemini-2.0-flash-lite",
  "gemini-2.5-flash-lite",  
  "gemini-1.5-flash-8b",
  "gemini-1.5-flash",
  "gemini-pro",
];

async function testModel(modelName) {
  try {
    console.log(`Testing: ${modelName}...`);
    const model = genAI.getGenerativeModel({ model: modelName });
    const result = await model.generateContent("Hi");
    const text = result.response.text();
    
    console.log(`✅ SUCCESS: ${modelName}`);
    console.log(`   Response: ${text.substring(0, 50)}`);
    return modelName;
  } catch (error) {
    if (error.message.includes("429") || error.message.includes("quota")) {
      console.log(`❌ Quota exceeded: ${modelName}`);
    } else if (error.message.includes("404")) {
      console.log(`❌ Not found: ${modelName}`);
    } else {
      console.log(`❌ Error: ${modelName}`);
    }
    return null;
  }
}

async function main() {
  for (const model of modelsToTry) {
    const working = await testModel(model);
    if (working) {
      console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      console.log(`🎉 Found working model: ${working}`);
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
      console.log("Update your config/gemini.js to use this model.");
      process.exit(0);
    }
    
    // Wait 2 seconds between attempts to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("❌ All models exhausted or unavailable");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
  console.log("Solutions:");
  console.log("1. Wait 24 hours for quota to reset");
  console.log("2. Enable billing in Google Cloud Console");
  console.log("3. Create a new Google Cloud project");
}

main();
