const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../frontend/src/data/pages/home.ejs');
const content = fs.readFileSync(filePath, 'utf8');

const index = content.indexOf('id="main-menu"');
if (index !== -1) {
  console.log("Snippet from main-menu:", content.substring(index, index + 3500));
} else {
  console.log("Not found.");
}
