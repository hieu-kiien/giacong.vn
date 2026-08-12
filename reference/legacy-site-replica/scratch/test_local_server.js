const http = require('http');
const fs = require('fs');
const path = require('path');

const VALID_PATHS_FILE = path.join(__dirname, 'valid_paths.json');
const PAGES_DIR = path.join(__dirname, '..', 'frontend', 'src', 'data', 'pages');

function get(url) {
  return new Promise((resolve) => {
    http.get(url, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          length: body.length
        });
      });
    }).on('error', (err) => {
      resolve({
        statusCode: 0,
        error: err.message
      });
    });
  });
}

function pathToLocalFile(normalizedPath) {
  let cleanPath = normalizedPath;
  if (cleanPath.startsWith('/')) {
    cleanPath = cleanPath.slice(1);
  }
  if (cleanPath === '' || cleanPath === 'home') {
    return path.join(PAGES_DIR, 'home.ejs');
  }
  return path.join(PAGES_DIR, cleanPath + '.ejs');
}

async function testAll() {
  if (!fs.existsSync(VALID_PATHS_FILE)) {
    console.error('valid_paths.json not found!');
    process.exit(1);
  }

  const validPaths = JSON.parse(fs.readFileSync(VALID_PATHS_FILE, 'utf8'));
  console.log(`Starting local server test for ${validPaths.length} paths...`);

  const results = {
    local200: 0,
    local404: 0,
    local404List: [],
    mismatches: []
  };

  for (let i = 0; i < validPaths.length; i++) {
    const p = validPaths[i];
    const url = `http://localhost:3002${p}`;
    
    const ejsExists = fs.existsSync(pathToLocalFile(p));
    const res = await get(url);
    
    if (res.statusCode === 200) {
      results.local200++;
    } else {
      results.local404++;
      results.local404List.push({
        path: p,
        statusCode: res.statusCode,
        ejsExists: ejsExists
      });
      if (ejsExists) {
        results.mismatches.push({
          path: p,
          statusCode: res.statusCode,
          ejsFileExists: true
        });
      }
    }
  }

  console.log('\n--- LOCAL SERVER TEST RESULTS ---');
  console.log(`Total checked: ${validPaths.length}`);
  console.log(`Local 200: ${results.local200}`);
  console.log(`Local 404: ${results.local404}`);
  console.log('Local 404 Paths:');
  results.local404List.forEach(item => {
    console.log(`  - ${item.path} (EJS file exists: ${item.ejsExists})`);
  });
  console.log(`Mismatches (EJS exists but server 404): ${results.mismatches.length}`);

  fs.writeFileSync(
    path.join(__dirname, 'local_test_report.json'),
    JSON.stringify(results, null, 2),
    'utf8'
  );
}

testAll();
