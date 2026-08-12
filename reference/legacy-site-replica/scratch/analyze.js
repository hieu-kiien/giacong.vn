const fs = require('fs');
const path = require('path');

const homePath = path.join(__dirname, '..', 'html', 'home.html');
const content = fs.readFileSync(homePath, 'utf8');

// Find head
const headStart = content.indexOf('<head>');
const headEnd = content.indexOf('</head>');
console.log('Head range:', headStart, headEnd);
if (headStart !== -1 && headEnd !== -1) {
    console.log('Head content preview (first 300 chars):');
    console.log(content.substring(headStart, headStart + 300));
    console.log('Head content preview (last 300 chars):');
    console.log(content.substring(headEnd - 300, headEnd + 7));
}

// Let's find body start
const bodyStart = content.indexOf('<body');
const bodyEnd = content.indexOf('>', bodyStart);
console.log('Body tag:', content.substring(bodyStart, bodyEnd + 1));

// Let's search for header tag
const headerStart = content.indexOf('<header');
const headerEnd = content.indexOf('</header>');
console.log('Header range:', headerStart, headerEnd);
if (headerStart !== -1 && headerEnd !== -1) {
    console.log('Header content preview (first 300 chars):');
    console.log(content.substring(headerStart, headerStart + 300));
    console.log('Header content:');
    // Let's find closing tags or size
    console.log('Header size:', headerEnd + 9 - headerStart);
}

// Let's search for footer tag
const footerStart = content.indexOf('<footer');
const footerEnd = content.indexOf('</footer>');
console.log('Footer range:', footerStart, footerEnd);
if (footerStart !== -1 && footerEnd !== -1) {
    console.log('Footer size:', footerEnd + 9 - footerStart);
}
