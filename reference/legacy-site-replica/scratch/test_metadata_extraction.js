const fs = require('fs');
const path = require('path');

const htmlDir = path.join(__dirname, '..', 'html');
const files = fs.readdirSync(htmlDir).filter(f => f.endsWith('.html'));

files.forEach(file => {
    const filePath = path.join(htmlDir, file);
    const content = fs.readFileSync(filePath, 'utf8');

    // Extract title
    const titleMatch = content.match(/<title>([\s\S]*?)<\/title>/i);
    const title = titleMatch ? titleMatch[1].trim() : 'No Title';

    // Extract description
    const descMatch = content.match(/<meta\s+name="description"\s+content="([^"]*)"/i) ||
                      content.match(/<meta\s+content="([^"]*)"\s+name="description"/i);
    const desc = descMatch ? descMatch[1].trim() : '';

    // Extract canonical
    const canonicalMatch = content.match(/<link\s+rel="canonical"\s+href="([^"]*)"/i) ||
                          content.match(/<link\s+href="([^"]*)"\s+rel="canonical"/i);
    const canonical = canonicalMatch ? canonicalMatch[1].trim() : '';

    console.log(`${file}:`);
    console.log(`  Title: ${title}`);
    console.log(`  Desc:  ${desc}`);
    console.log(`  Canon: ${canonical}`);
});
