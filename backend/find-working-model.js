// Test different Gemini model names
import "dotenv/config";
import { GoogleGenerativeAI } from "@google/generative-ai";

console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
console.log("🧪 Testing Different Gemini Models");
console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
console.log("");

const apiKey = process.env.GEMINI_API_KEY;
const genAI = new GoogleGenerativeAI(apiKey);

const modelsToTry = [
  "gemini-pro",
  "gemini-1.5-pro",
  "gemini-1.5-flash",
  "gemini-1.5-flash-latest"
];

async function testModel(modelName) {
  try {
    console.log(`Testing: ${modelName}...`);
    const model = genAI.getGenerativeModel({ model: modelName });
    const result = await model.generateContent("Say 'Hello'");
    const response = result.response.text();
    
    console.log(`✅ SUCCESS with ${modelName}`);
    console.log(`   Response: ${response}`);
    console.log("");
    return modelName;
  } catch (error) {
    console.log(`❌ Failed with ${modelName}`);
    console.log(`   Error: ${error.message.substring(0, 100)}...`);
    console.log("");
    return null;
  }
}

async function findWorkingModel() {
  console.log("Trying different model names...");
  console.log("");
  
  for (const modelName of modelsToTry) {
    const working = await testModel(modelName);
    if (working) {
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      console.log(`✨ Found working model: ${working}`);
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      console.log("");
      console.log("I will update your config to use this model.");
      return working;
    }
  }
  
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("❌ No working model found");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("");
  console.log("You MUST enable the Generative Language API:");
  console.log("");
  console.log("Step 1: Go to this URL:");
  console.log("https://console.cloud.google.com/apis/library/generativelanguage.googleapis.com?project=gen-lang-client-0300653964");
  console.log("");
  console.log("Step 2: Click the blue 'ENABLE' button");
  console.log("");
  console.log("Step 3: Wait 1-2 minutes");
  console.log("");
  console.log("Step 4: Run this script again: node list-models.js");
  console.log("");
}

findWorkingModel();
