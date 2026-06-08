import "dotenv/config";
import { GoogleGenerativeAI } from "@google/generative-ai";

const apiKey = process.env.GEMINI_API_KEY;

console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
console.log("Testing Latest Gemini Models");
console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
console.log(`API Key: ${apiKey.substring(0, 15)}...`);
console.log();

const genAI = new GoogleGenerativeAI(apiKey);

// Modern model names that should work
const models = [
  "gemini-1.5-flash",
  "gemini-1.5-flash-latest",
  "gemini-1.5-pro",
  "gemini-1.5-pro-latest",
  "gemini-2.0-flash",
  "gemini-pro",
];

async function testModel(modelName) {
  try {
    console.log(`📝 Testing: ${modelName}`);
    const model = genAI.getGenerativeModel({ model: modelName });
    const result = await model.generateContent("Say 'Hello' in one word");
    const text = result.response.text();
    console.log(`✅ SUCCESS: ${modelName}`);
    console.log(`   Response: ${text.substring(0, 50)}`);
    console.log();
    return true;
  } catch (error) {
    const errorMsg = error.message || String(error);
    if (errorMsg.includes("404")) {
      console.log(`❌ NOT FOUND: ${modelName}`);
    } else if (errorMsg.includes("API key")) {
      console.log(`❌ API KEY ERROR: ${modelName}`);
    } else {
      console.log(`❌ ERROR: ${modelName}`);
      console.log(`   ${errorMsg.substring(0, 80)}`);
    }
    console.log();
    return false;
  }
}

async function main() {
  for (const model of models) {
    const success = await testModel(model);
    if (success) {
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      console.log("🎉 Found working model!");
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      console.log(`\nUpdate your aiService.js to use: "${model}"`);
      process.exit(0);
    }
  }

  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("❌ No models working!");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("\nPossible solutions:");
  console.log("1. Verify your API key is correct");
  console.log("2. Check https://aistudio.google.com - try getting a fresh key");
  console.log("3. Go to Cloud Console → Enable 'Generative Language API'");
  console.log("4. Wait 5-10 minutes for new API key to fully activate");
  process.exit(1);
}

main();
