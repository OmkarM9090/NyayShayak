import "dotenv/config";

const apiKey = process.env.GEMINI_API_KEY;

console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
console.log("🔍 Deep Diagnostic - Check Error Details");
console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
console.log(`API Key: ${apiKey.substring(0, 15)}...${apiKey.substring(35)}`);
console.log();

async function diagnose() {
  try {
    console.log("Making request to Gemini API...\n");
    
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: "test" }] }],
        }),
      }
    );

    const data = await response.json();

    console.log(`Status Code: ${response.status}`);
    console.log(`Status Text: ${response.statusText}`);
    console.log("\nFull Response:");
    console.log(JSON.stringify(data, null, 2));

    if (!response.ok) {
      console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      console.log("⚠️  ERROR ANALYSIS");
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

      if (response.status === 404) {
        console.log("\n🔴 Status 404: Model Not Found");
        console.log("\nThis means:");
        console.log("  • The model doesn't exist in your project");
        console.log("  • OR the Generative Language API is not enabled");
        console.log("  • OR the API hasn't fully propagated yet");
        console.log("\n✅ Fix: Enable API in Google Cloud Console");
        console.log("\n  1. Go: https://console.cloud.google.com");
        console.log("  2. Check active project (top left dropdown)");
        console.log("  3. Click 'APIs & Services' in sidebar");
        console.log("  4. Click '+ Enable APIs and Services'");
        console.log("  5. Search: 'Generative Language API'");
        console.log("  6. Click 'Enable'");
        console.log("  7. Wait 5 minutes");
        console.log("  8. Try again");
      } else if (response.status === 401 || response.status === 403) {
        console.log("\n🔴 Status " + response.status + ": Authentication Error");
        console.log("\nThis means:");
        console.log("  • Your API key is invalid or expired");
        console.log("  • OR the API key doesn't have permission");
        console.log("\n✅ Fix: Create new API key");
        console.log("\n  1. Go: https://aistudio.google.com/app/apikey");
        console.log("  2. Click '+ Create API key'");
        console.log("  3. Select 'Create API key in new project'");
        console.log("  4. Copy the generated key");
        console.log("  5. Update .env file");
        console.log("  6. Try again");
      } else {
        console.log("\n🔴 Status " + response.status + ": " + data.error?.message);
      }
    }
  } catch (error) {
    console.error("Network Error:", error.message);
  }
}

diagnose();
