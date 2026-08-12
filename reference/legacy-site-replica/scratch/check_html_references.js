const fs = require('fs');
const path = require('path');

const htmlDir = path.join(__dirname, '..', 'html');
const files = fs.readdirSync(htmlDir).filter(f => f.endsWith('.html'));

files.forEach(file => {
    const filePath = path.join(htmlDir, file);
    const content = fs.readFileSync(filePath, 'utf8');

    const hasRemoteWp = content.includes('giacong.vn/wp-content');
    const hasLocalAssets = content.includes('assets/js/') || content.includes('assets/css/') || content.includes('assets/images/');
    console.log(`${file}: hasRemoteWp=${hasRemoteWp}, hasLocalAssets=${hasLocalAssets}`);
});
