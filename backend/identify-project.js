import "dotenv/config";

const apiKey = process.env.GEMINI_API_KEY;

console.log("╔═══════════════════════════════════════════════════════════════╗");
console.log("║            API KEY PROJECT IDENTIFIER                         ║");
console.log("╚═══════════════════════════════════════════════════════════════╝\n");

console.log("Your API Key Info:");
console.log("─────────────────");
console.log(`Full Key: ${apiKey}`);
console.log(`Length: ${apiKey.length} characters`);
console.log(`First 20: ${apiKey.substring(0, 20)}`);
console.log(`Last 10: ${apiKey.substring(29)}`);
console.log();

console.log("═══════════════════════════════════════════════════════════════\n");
console.log("📋 ACTION REQUIRED:\n");
console.log("1. Go to: https://aistudio.google.com/app/apikey");
console.log("2. Look for a key that matches:");
console.log(`   Ends with: ...${apiKey.substring(35)}`);
console.log("3. Check which PROJECT it belongs to");
console.log("4. That's the project where you need to enable the API!\n");
console.log("═══════════════════════════════════════════════════════════════\n");

async function testAPIKeyWithProjects() {
  console.log("Testing API key with direct request...\n");
  
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1/models?key=${apiKey}`
  );
  
  const data = await response.json();
  
  console.log(`Status: ${response.status} ${response.statusText}\n`);
  
  if (response.ok) {
    console.log("✅ API KEY WORKS! Models available:");
    console.log("──────────────────────────────────");
    if (data.models && data.models.length > 0) {
      data.models.forEach(model => {
        console.log(`  • ${model.name.replace('models/', '')}`);
      });
      console.log("\n🎉 SUCCESS! Your setup is working!");
    } else {
      console.log("  No models found");
    }
  } else {
    console.log("❌ ERROR:");
    console.log("──────────────────────────────────");
    console.log(JSON.stringify(data, null, 2));
    console.log("\n💡 This means:");
    
    if (response.status === 403 || response.status === 400) {
      console.log("   → API key is invalid or project doesn't have API enabled");
      console.log("   → Check the project at aistudio.google.com");
      console.log("   → Enable 'Generative Language API' in that project");
    } else if (response.status === 404) {
      console.log("   → Generative Language API NOT enabled in your project");
      console.log("   → Follow steps above to find and enable it");
    }
  }
}

testAPIKeyWithProjects().catch(console.error);
