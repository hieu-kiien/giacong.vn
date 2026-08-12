const fs = require('fs');
const path = require('path');

const htmlDir = path.join(__dirname, '..', 'html');
const files = fs.readdirSync(htmlDir).filter(f => f.endsWith('.html'));

files.forEach(file => {
    const filePath = path.join(htmlDir, file);
    const content = fs.readFileSync(filePath, 'utf8');

    const bodyEndIndex = content.indexOf('>', content.indexOf('<body')) + 1;
    const headerStartIndex = content.indexOf('<header id="header"');

    if (bodyEndIndex !== 0 && headerStartIndex !== -1) {
        const between = content.substring(bodyEndIndex, headerStartIndex);
        console.log(`${file}: length between body and header = ${between.length}`);
        // Log first 100 characters of between
        console.log(`  Start: ${between.substring(0, 80).replace(/\s+/g, ' ')}`);
    } else {
        console.log(`${file}: could not find body end or header start`);
    }
});
