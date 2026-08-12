const fs = require('fs');
const path = require('path');

function searchDir(dir, query) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      if (file !== 'node_modules' && file !== '.next' && file !== '.git') {
        searchDir(fullPath, query);
      }
    } else {
      const content = fs.readFileSync(fullPath, 'utf8');
      if (content.includes(query)) {
        console.log(`Found "${query}" in: ${fullPath}`);
      }
    }
  }
}

console.log("Searching frontend/src for 'main-menu'...");
searchDir(path.join(__dirname, '../frontend/src'), 'id="main-menu"');
searchDir(path.join(__dirname, '../frontend/src'), 'main-menu');
