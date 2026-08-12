const fs = require('fs');
const path = require('path');

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach((file) => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat && stat.isDirectory()) {
      results = results.concat(walk(filePath));
    } else {
      results.push(filePath);
    }
  });
  return results;
}

const srcDir = path.join(__dirname, '..', 'frontend', 'src');
if (fs.existsSync(srcDir)) {
  const files = walk(srcDir);
  files.forEach((file) => {
    const content = fs.readFileSync(file, 'utf8');
    if (content.includes('8000')) {
      console.log(`Found "8000" in: ${file}`);
    }
  });
} else {
  console.log('src directory not found');
}
