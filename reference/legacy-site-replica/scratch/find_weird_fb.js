const fs = require('fs');
const path = require('path');

const htmlDir = path.join(__dirname, '..', 'html');
const files = fs.readdirSync(htmlDir).filter(f => f.endsWith('.html'));

files.forEach(file => {
    const filePath = path.join(htmlDir, file);
    const content = fs.readFileSync(filePath, 'utf8');

    if (content.includes('https://connect.facebook.net..')) {
        console.log(`Found in: ${file}`);
        // Log the line containing it
        const index = content.indexOf('https://connect.facebook.net..');
        console.log(content.substring(index - 100, index + 200));
    }
});
