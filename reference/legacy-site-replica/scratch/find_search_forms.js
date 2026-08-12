const fs = require('fs');
const path = require('path');

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach((file) => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat && stat.isDirectory()) {
      if (!['node_modules', '.next', '.git'].includes(file)) {
        results = results.concat(walk(filePath));
      }
    } else {
      results.push(filePath);
    }
  });
  return results;
}

const rootDir = path.join(__dirname, '..');
const files = walk(rootDir);

console.log('Scanning for search forms or inputs...');
files.forEach((file) => {
  const ext = path.extname(file);
  if (['.ejs', '.html', '.tsx', '.ts', '.js'].includes(ext)) {
    try {
      const content = fs.readFileSync(file, 'utf8');
      if (content.includes('type="search"') || content.includes('class="searchform"') || content.includes('name="s"')) {
        // Skip scratch files
        if (file.includes('scratch\\') || file.includes('scratch/')) return;
        console.log(`Match in: ${path.relative(rootDir, file)}`);
        // Find line numbers
        const lines = content.split('\n');
        lines.forEach((line, index) => {
          if (line.includes('type="search"') || line.includes('class="searchform"') || line.includes('name="s"')) {
            console.log(`  Line ${index + 1}: ${line.trim()}`);
          }
        });
      }
    } catch (e) {
      // Ignore errors
    }
  }
});
