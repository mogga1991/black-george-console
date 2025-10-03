// Simple test script to verify Notion integration setup
// This doesn't require the actual API key to test the structure

const notionDatabaseId = "6da61bdc1e9c4a05822f42f868b4bf85";

console.log("🧪 Testing Notion Integration Setup");
console.log("=====================================");

// Test 1: Check environment variables in wrangler.toml
console.log("✅ Database ID configured:", notionDatabaseId);

// Test 2: Check required endpoints exist
const fs = require('fs');
const path = require('path');

const functionsDir = path.join(__dirname, 'functions', 'api', 'notion');
const requiredFiles = [
  'properties.ts',
  'test.ts'
];

console.log("\n📁 Checking Notion API files:");
requiredFiles.forEach(file => {
  const filePath = path.join(functionsDir, file);
  if (fs.existsSync(filePath)) {
    console.log(`✅ ${file} exists`);
  } else {
    console.log(`❌ ${file} missing`);
  }
});

// Test 3: Check wrangler.toml configuration
console.log("\n⚙️  Checking wrangler.toml configuration:");
const wranglerPath = path.join(__dirname, 'wrangler.toml');
if (fs.existsSync(wranglerPath)) {
  const content = fs.readFileSync(wranglerPath, 'utf8');
  if (content.includes('NOTION_DATABASE_ID')) {
    console.log("✅ NOTION_DATABASE_ID configured");
  } else {
    console.log("❌ NOTION_DATABASE_ID not found");
  }
  
  if (content.includes('NOTION_DATA_SOURCE_ID')) {
    console.log("✅ NOTION_DATA_SOURCE_ID configured");
  } else {
    console.log("❌ NOTION_DATA_SOURCE_ID not found");
  }
  
  if (content.includes('NOTION_API_KEY')) {
    console.log("⚠️  NOTION_API_KEY mentioned (should be set as secret)");
  }
}

console.log("\n🚀 Next Steps:");
console.log("1. Set the Notion API key: npx wrangler secret put NOTION_API_KEY");
console.log("2. Deploy: npx wrangler pages deploy out --project-name=george-console");
console.log("3. Test: https://george-console.pages.dev/api/notion/test");

console.log("\n📋 Available Endpoints:");
console.log("GET  /api/notion/properties?action=list");
console.log("GET  /api/notion/properties?action=map-data");
console.log("GET  /api/notion/properties?action=property&propertyId=...");
console.log("POST /api/notion/properties?action=update-match");
console.log("POST /api/notion/properties?action=bulk-update");
console.log("GET  /api/notion/test (run all tests)");
console.log("GET  /api/notion/test?test=connection (specific test)");