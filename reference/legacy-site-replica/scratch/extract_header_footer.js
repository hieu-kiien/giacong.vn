const fs = require('fs');
const path = require('path');

const interactivePath = path.join(__dirname, '..', 'html', 'home_interactive.html');
const content = fs.readFileSync(interactivePath, 'utf8');

// Extract header
const headerStart = content.indexOf('<header id="header"');
const headerEnd = content.indexOf('</header>', headerStart) + 9;
const header = content.substring(headerStart, headerEnd);

// Extract footer
const footerStart = content.indexOf('<footer id="footer"');
const footerEnd = content.indexOf('</footer>', footerStart) + 9;
const footer = content.substring(footerStart, footerEnd);

console.log('Header length:', header.length);
console.log('Footer length:', footer.length);

// Let's create the directories if they don't exist
const viewsDir = path.join(__dirname, '..', 'views');
const partialsDir = path.join(viewsDir, 'partials');
fs.mkdirSync(partialsDir, { recursive: true });

fs.writeFileSync(path.join(partialsDir, 'header_raw.ejs'), header, 'utf8');
fs.writeFileSync(path.join(partialsDir, 'footer_raw.ejs'), footer, 'utf8');

console.log('Wrote raw header and footer partials.');
