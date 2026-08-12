const fs = require('fs');
const path = require('path');

const dirs = [
  'frontend/src/data/pages',
  'views'
];

let mismatchCount = 0;

function scanDir(dir) {
  if (!fs.existsSync(dir)) return;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      scanDir(fullPath);
    } else if (entry.isFile() && entry.name.endsWith('.ejs')) {
      const content = fs.readFileSync(fullPath, 'utf8');
      const lines = content.split('\n');
      lines.forEach((line, idx) => {
        if (line.includes('<form')) {
          const hasSearchWord = line.includes('search') || line.includes('searchform');
          const hasSearchAction = line.includes('action="/search"');
          if (hasSearchWord && !hasSearchAction) {
            console.log(`MISMATCH in ${fullPath}:${idx + 1} -> ${line.trim()}`);
            mismatchCount++;
          }
        }
      });
    }
  }
}

dirs.forEach(scanDir);
console.log(`Scan completed. Found ${mismatchCount} mismatches.`);
process.exit(mismatchCount > 0 ? 1 : 0);
