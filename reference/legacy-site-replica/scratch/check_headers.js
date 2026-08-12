const fs = require('fs');
const path = require('path');

const htmlDir = path.join(__dirname, '..', 'html');
const files = fs.readdirSync(htmlDir).filter(f => f.endsWith('.html'));

files.forEach(file => {
    const filePath = path.join(htmlDir, file);
    const content = fs.readFileSync(filePath, 'utf8');

    const headerStart = content.indexOf('<header id="header"');
    if (headerStart === -1) {
        console.log(`File ${file} does not contain '<header id="header"'`);
    } else {
        const count = (content.match(/<header id="header"/g) || []).length;
        if (count > 1) {
            console.log(`File ${file} has multiple '<header id="header"' tags: ${count}`);
        }
    }
});
console.log('Done checking headers.');
