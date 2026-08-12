const http = require('http');
const fs = require('fs');
const path = require('path');

const metadataPath = path.join(__dirname, '..', 'metadata.json');
if (!fs.existsSync(metadataPath)) {
  console.error('metadata.json not found!');
  process.exit(1);
}

const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));

// Helper to make GET requests
function get(url) {
  return new Promise((resolve) => {
    const start = Date.now();
    http.get(url, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          time: Date.now() - start,
          length: body.length
        });
      });
    }).on('error', (err) => {
      resolve({
        statusCode: 0,
        time: Date.now() - start,
        error: err.message
      });
    });
  });
}

// Helper to make POST requests
function post(url, data) {
  return new Promise((resolve) => {
    const start = Date.now();
    const payload = JSON.stringify(data);
    const parsedUrl = new URL(url);
    
    const req = http.request({
      hostname: parsedUrl.hostname,
      port: parsedUrl.port,
      path: parsedUrl.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      }
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          time: Date.now() - start,
          body: body
        });
      });
    });

    req.on('error', (err) => {
      resolve({
        statusCode: 0,
        time: Date.now() - start,
        error: err.message
      });
    });

    req.write(payload);
    req.end();
  });
}

async function runTests() {
  console.log('==================================================');
  console.log('STARTING INTEGRATION TEST FOR NEXT.JS & LARAVEL');
  console.log('==================================================\n');

  const frontendPort = 3002;
  const backendPort = 8002;

  console.log('1. Testing Laravel Backend APIs...');
  
  // Test Laravel Search API
  const searchRes = await get(`http://localhost:${backendPort}/api/search?s=sua`);
  if (searchRes.statusCode === 200) {
    console.log(`[PASS] Laravel GET /api/search?s=sua - Status: ${searchRes.statusCode} (${searchRes.time}ms)`);
  } else {
    console.log(`[FAIL] Laravel GET /api/search?s=sua - Status: ${searchRes.statusCode} (Error: ${searchRes.error || 'Server error'})`);
  }

  // Test Laravel Contact Form API
  const contactRes = await post(`http://localhost:${backendPort}/api/contact`, {
    name: 'Kiểm thử viên',
    phone: '0987654321',
    message: 'Nội dung kiểm thử tự động toàn bộ trang web'
  });
  if (contactRes.statusCode === 201) {
    console.log(`[PASS] Laravel POST /api/contact - Status: ${contactRes.statusCode} (${contactRes.time}ms)`);
  } else {
    console.log(`[FAIL] Laravel POST /api/contact - Status: ${contactRes.statusCode} (Error: ${contactRes.error || 'Server error'})`);
  }

  console.log('\n2. Testing Next.js Frontend Pages...');
  let passedCount = 0;
  let failedCount = 0;
  const results = [];

  // Test Homepage
  const homeRes = await get(`http://localhost:${frontendPort}/`);
  results.push({ slug: '(home)', status: homeRes.statusCode, time: homeRes.time });
  if (homeRes.statusCode === 200) {
    passedCount++;
    console.log(`[PASS] Page: / - Status: 200 (${homeRes.time}ms)`);
  } else {
    failedCount++;
    console.log(`[FAIL] Page: / - Status: ${homeRes.statusCode} (Error: ${homeRes.error || 'Check server'})`);
  }

  // Test all dynamic routes
  for (const page of metadata.pages) {
    if (page.slug === 'home') continue;
    const url = `http://localhost:${frontendPort}/${page.slug}`;
    const res = await get(url);
    results.push({ slug: page.slug, status: res.statusCode, time: res.time });
    
    if (res.statusCode === 200) {
      passedCount++;
      console.log(`[PASS] Page: /${page.slug} - Status: 200 (${res.time}ms)`);
    } else {
      failedCount++;
      console.log(`[FAIL] Page: /${page.slug} - Status: ${res.statusCode} (Error: ${res.error || 'Check server'})`);
    }
  }

  console.log('\n==================================================');
  console.log('SUMMARY REPORT');
  console.log('==================================================');
  console.log(`Total Pages Tested: ${results.length}`);
  console.log(`Passed: ${passedCount}`);
  console.log(`Failed: ${failedCount}`);
  console.log('==================================================');
  
  if (failedCount > 0) {
    console.log('Some pages failed. Please check if Next.js server is running on port 3002.');
    process.exit(1);
  } else {
    console.log('All tests passed successfully!');
    process.exit(0);
  }
}

// Start tests after 1s delay
setTimeout(runTests, 1000);
