const fs = require('fs');
const path = require('path');

const htmlDir = path.join(__dirname, '..', 'html');
const files = fs.readdirSync(htmlDir).filter(f => f.endsWith('.html'));

console.log(`Found ${files.length} HTML files.`);

const bodyTags = {};
const headerTags = {};
const footerTags = {};

files.forEach(file => {
    const filePath = path.join(htmlDir, file);
    const content = fs.readFileSync(filePath, 'utf8');

    // Body tag
    const bodyStart = content.indexOf('<body');
    const bodyEnd = content.indexOf('>', bodyStart);
    if (bodyStart !== -1) {
        const bodyTag = content.substring(bodyStart, bodyEnd + 1);
        bodyTags[file] = bodyTag;
    }

    // Header tag
    const headerStart = content.indexOf('<header');
    const headerEnd = content.indexOf('>', headerStart);
    if (headerStart !== -1) {
        headerTags[file] = content.substring(headerStart, headerEnd + 1);
    }

    // Footer tag
    const footerStart = content.indexOf('<footer');
    const footerEnd = content.indexOf('>', footerStart);
    if (footerStart !== -1) {
        footerTags[file] = content.substring(footerStart, footerEnd + 1);
    }
});

console.log('\n--- BODY TAGS (First 5 files) ---');
files.slice(0, 5).forEach(f => {
    console.log(`${f}: ${bodyTags[f]}`);
});

console.log('\n--- HEADER TAGS (First 5 files) ---');
files.slice(0, 5).forEach(f => {
    console.log(`${f}: ${headerTags[f]}`);
});

console.log('\n--- FOOTER TAGS (First 5 files) ---');
files.slice(0, 5).forEach(f => {
    console.log(`${f}: ${footerTags[f]}`);
});

// Let's check unique headers/footers
const uniqueHeaders = new Set(Object.values(headerTags));
console.log(`\nUnique header tags count: ${uniqueHeaders.size}`);
uniqueHeaders.forEach((h, i) => console.log(`Header ${i+1}: ${h}`));

const uniqueFooters = new Set(Object.values(footerTags));
console.log(`Unique footer tags count: ${uniqueFooters.size}`);
uniqueFooters.forEach((f, i) => console.log(`Footer ${i+1}: ${f}`));
