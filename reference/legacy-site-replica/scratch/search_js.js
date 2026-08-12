const fs = require('fs');
const content = fs.readFileSync('frontend/public/assets/js/flatsome_7896dbf8.js', 'utf8');

const regex = /<button[^>]+class=["']toggle["'][^>]*>/g;
let match;
while ((match = regex.exec(content)) !== null) {
  console.log('Match found at index:', match.index);
  console.log(content.substring(match.index - 200, match.index + 200));
  console.log('--------------------------------------------------');
}

const regex2 = /\.append\([^)]*toggle[^)]*\)/g;
while ((match = regex2.exec(content)) !== null) {
  console.log('Append match found at index:', match.index);
  console.log(content.substring(match.index - 200, match.index + 200));
  console.log('--------------------------------------------------');
}
