import "dotenv/config";
import axios from "axios";

const apiKey = process.env.GEMINI_API_KEY;

console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
console.log("Testing Gemini API via REST (No SDK)");
console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
console.log(`API Key: ${apiKey.substring(0, 15)}...`);
console.log();

const models = ["gemini-1.5-flash", "gemini-1.5-pro", "gemini-pro"];

async function testViaREST(modelName) {
  try {
    console.log(`🔄 Testing ${modelName} via REST...`);
    
    const url = `https://generativelanguage.googleapis.com/v1/models/${modelName}:generateContent?key=${apiKey}`;
    
    const response = await axios.post(url, {
      contents: [
        {
          parts: [
            {
              text: "Say 'Working' in one word",
            },
          ],
        },
      ],
    });

    console.log(`✅ SUCCESS: ${modelName}`);
    console.log(`   Response: ${response.data.candidates[0].content.parts[0].text}`);
    console.log();
    return true;
  } catch (error) {
    const status = error.response?.status;
    const msg = error.response?.data?.error?.message || error.message;
    
    if (status === 404) {
      console.log(`❌ Model not found: ${modelName}`);
    } else if (status === 400) {
      console.log(`❌ Bad request: ${msg}`);
    } else if (status === 401 || status === 403) {
      console.log(`❌ Auth error (API key invalid)`);
    } else {
      console.log(`❌ Error (${status}): ${msg}`);
    }
    console.log();
    return false;
  }
}

async function main() {
  let found = false;
  
  for (const model of models) {
    const success = await testViaREST(model);
    if (success) {
      found = true;
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      console.log(`✅ Working model: ${model}`);
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      break;
    }
  }

  if (!found) {
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("❌ No models accessible");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("\n📋 Troubleshooting:");
    console.log("1. Remove old API key from .env");
    console.log("2. Visit: https://aistudio.google.com/app/apikey");
    console.log("3. Click '+ Create API key'");
    console.log("4. Choose: 'Create API key in new project'");
    console.log("5. Copy new key (39 chars starting with AIzaSy)");
    console.log("6. Update .env file");
    console.log("7. Wait 5-10 minutes for propagation");
    console.log("8. Run this test again\n");
  }
}

main();
