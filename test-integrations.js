#!/usr/bin/env node

/**
 * Integration Test Script for CRE Console
 * Tests all AI/LLM services and mobile-friendly features
 */

const readline = require('readline');
const https = require('https');
const fs = require('fs');

const BASE_URL = 'http://localhost:3000';

// Colors for console output
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m',
  bold: '\x1b[1m'
};

const log = (message, color = 'reset') => {
  console.log(`${colors[color]}${message}${colors.reset}`);
};

// Test configurations
const tests = [
  {
    name: 'AI Chat Endpoint',
    endpoint: '/api/ai/chat',
    method: 'POST',
    data: {
      messages: [
        { role: 'user', content: 'Tell me about commercial real estate lease types' }
      ]
    }
  },
  {
    name: 'OpenAI Extract (if key configured)',
    endpoint: '/api/ai/openai-extract',
    method: 'POST',
    data: {
      content: 'Request for Proposals: Office space in San Francisco, CA. Size: 3000-5000 square feet. Must have ADA compliance.',
      filename: 'test-rfp-openai.txt'
    }
  },
  {
    name: 'Perplexity Extract (if key configured)',
    endpoint: '/api/ai/perplexity-extract',
    method: 'POST',
    data: {
      content: 'Government RFP for warehouse space in Texas. Requirements: 50000+ sq ft, loading docks, security.',
      filename: 'test-rfp-perplexity.txt'
    }
  },
  {
    name: 'Property Search',
    endpoint: '/api/search',
    method: 'POST',
    data: {
      criteria: {
        locationText: 'New York, NY',
        minSqft: 1000,
        maxSqft: 5000
      },
      topK: 5
    }
  }
];

async function makeRequest(test) {
  return new Promise((resolve) => {
    const postData = JSON.stringify(test.data);
    
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: test.endpoint,
      method: test.method,
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      },
      timeout: 30000
    };

    const req = require('http').request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({
            success: res.statusCode === 200,
            status: res.statusCode,
            data: parsed,
            error: null
          });
        } catch (e) {
          resolve({
            success: false,
            status: res.statusCode,
            data: null,
            error: `Parse error: ${e.message}`
          });
        }
      });
    });

    req.on('error', (error) => {
      resolve({
        success: false,
        status: 0,
        data: null,
        error: error.message
      });
    });

    req.on('timeout', () => {
      req.destroy();
      resolve({
        success: false,
        status: 0,
        data: null,
        error: 'Request timeout'
      });
    });

    req.write(postData);
    req.end();
  });
}

async function runTests() {
  log('\n🧪 CRE Console Integration Tests\n', 'bold');
  log('Testing AI/LLM services and mobile functionality...\n', 'blue');

  let passed = 0;
  let failed = 0;

  for (const test of tests) {
    process.stdout.write(`Testing ${test.name}... `);
    
    const result = await makeRequest(test);
    
    if (result.success) {
      log('✅ PASSED', 'green');
      passed++;
      
      // Show relevant response data
      if (result.data) {
        if (result.data.analysis) {
          log(`   📊 Confidence: ${result.data.confidence || 'N/A'}`, 'blue');
          log(`   🔧 Method: ${result.data.extractionMethod || 'N/A'}`, 'blue');
        }
        if (result.data.response) {
          log(`   💬 Response: ${result.data.response.substring(0, 100)}...`, 'blue');
        }
        if (result.data.results) {
          log(`   🏢 Found ${result.data.results.length} properties`, 'blue');
        }
      }
    } else {
      log('❌ FAILED', 'red');
      failed++;
      log(`   Error: ${result.error || 'Unknown error'}`, 'red');
      log(`   Status: ${result.status}`, 'red');
      
      if (result.data?.error) {
        log(`   Details: ${result.data.error}`, 'red');
      }
    }
    console.log();
  }

  log('\n📋 Test Summary:', 'bold');
  log(`✅ Passed: ${passed}`, 'green');
  log(`❌ Failed: ${failed}`, failed > 0 ? 'red' : 'green');
  log(`📊 Total: ${passed + failed}`, 'blue');

  // Mobile-specific checks
  log('\n📱 Mobile Configuration Check:', 'bold');
  
  try {
    const layoutContent = fs.readFileSync('./app/layout.tsx', 'utf8');
    if (layoutContent.includes('viewport')) {
      log('✅ Viewport meta tag configured', 'green');
    } else {
      log('❌ Viewport meta tag missing', 'red');
    }

    const globalsContent = fs.readFileSync('./app/globals.css', 'utf8');
    if (globalsContent.includes('@media (max-width: 768px)')) {
      log('✅ Mobile CSS breakpoints configured', 'green');
    } else {
      log('❌ Mobile CSS breakpoints missing', 'red');
    }

    if (globalsContent.includes('touch-manipulation')) {
      log('✅ Touch manipulation optimized', 'green');
    } else {
      log('❌ Touch manipulation not optimized', 'red');
    }

  } catch (e) {
    log(`❌ File check error: ${e.message}`, 'red');
  }

  // Environment check
  log('\n🔧 Environment Configuration:', 'bold');
  try {
    const envContent = fs.readFileSync('./.env.local', 'utf8');
    
    const checks = [
      { key: 'NEXT_PUBLIC_GOOGLE_MAPS_API_KEY', name: 'Google Maps' },
      { key: 'NEXT_PUBLIC_SUPABASE_URL', name: 'Supabase' },
      { key: 'OPENAI_API_KEY', name: 'OpenAI' },
      { key: 'PERPLEXITY_API_KEY', name: 'Perplexity' }
    ];

    checks.forEach(check => {
      if (envContent.includes(check.key) && !envContent.includes(`${check.key}=your_`)) {
        log(`✅ ${check.name} configured`, 'green');
      } else {
        log(`⚠️  ${check.name} not configured`, 'yellow');
      }
    });

  } catch (e) {
    log(`❌ Environment file check error: ${e.message}`, 'red');
  }

  log('\n🎯 Recommendations:', 'bold');
  if (failed > 0) {
    log('- Configure missing API keys in .env.local', 'yellow');
    log('- Check server is running on http://localhost:3000', 'yellow');
    log('- Review error messages above for specific issues', 'yellow');
  }
  log('- Test on mobile devices for touch interactions', 'blue');
  log('- Verify responsive breakpoints work correctly', 'blue');
  log('- Test document upload functionality manually', 'blue');

  process.exit(failed > 0 ? 1 : 0);
}

// Check if server is running
async function checkServer() {
  try {
    const result = await makeRequest({
      endpoint: '/',
      method: 'GET',
      data: null
    });
    return result.success || result.status === 200;
  } catch {
    return false;
  }
}

async function main() {
  const serverRunning = await checkServer();
  
  if (!serverRunning) {
    log('❌ Server is not running on http://localhost:3000', 'red');
    log('Please start the development server with: npm run dev', 'yellow');
    process.exit(1);
  }

  await runTests();
}

if (require.main === module) {
  main().catch(console.error);
}