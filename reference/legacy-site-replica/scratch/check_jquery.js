const fs = require('fs');
const path = require('path');

const htmlDir = path.join(__dirname, '..', 'html');
const files = fs.readdirSync(htmlDir).filter(f => f.endsWith('.html'));

files.forEach(file => {
    const filePath = path.join(htmlDir, file);
    const content = fs.readFileSync(filePath, 'utf8');

    const hasRemote = content.includes('jquery.min.js');
    const hasLocal = content.includes('jquery_min');
    console.log(`${file}: hasRemoteJquery=${hasRemote}, hasLocalJquery=${hasLocal}`);
});
