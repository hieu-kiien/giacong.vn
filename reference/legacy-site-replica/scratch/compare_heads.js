const fs = require('fs');
const path = require('path');

const htmlDir = path.join(__dirname, '..', 'html');
const files = fs.readdirSync(htmlDir).filter(f => f.endsWith('.html'));

function cleanHead(headContent) {
    // Remove title, description, canonical, and og/twitter meta tags
    return headContent
        .replace(/<title>[\s\S]*?<\/title>/gi, '')
        .replace(/<meta\s+name="description"\s+content="[^"]*"/gi, '')
        .replace(/<meta\s+content="[^"]*"\s+name="description"/gi, '')
        .replace(/<link\s+rel="canonical"\s+href="[^"]*"/gi, '')
        .replace(/<link\s+href="[^"]*"\s+rel="canonical"/gi, '')
        .replace(/<meta\s+property="og:[^"]+"\s+content="[^"]*"/gi, '')
        .replace(/<meta\s+name="twitter:[^"]+"\s+content="[^"]*"/gi, '')
        .replace(/\s+/g, ' '); // normalize whitespace
}

const firstFile = files[0];
const firstHead = cleanHead(fs.readFileSync(path.join(htmlDir, firstFile), 'utf8').match(/<head>([\s\S]*?)<\/head>/i)[1]);

console.log(`Comparing all heads against ${firstFile}...`);
let allMatch = true;

files.forEach(file => {
    const headContent = fs.readFileSync(path.join(htmlDir, file), 'utf8').match(/<head>([\s\S]*?)<\/head>/i)[1];
    const cleaned = cleanHead(headContent);
    if (cleaned !== firstHead) {
        console.log(`File ${file} has different cleaned head! Cleaned length = ${cleaned.length}, firstHead length = ${firstHead.length}`);
        allMatch = false;
        // let's print characters diff
        if (Math.abs(cleaned.length - firstHead.length) < 500) {
            // print first different character index
            let diffIndex = -1;
            for (let i = 0; i < Math.min(cleaned.length, firstHead.length); i++) {
                if (cleaned[i] !== firstHead[i]) {
                    diffIndex = i;
                    break;
                }
            }
            console.log(`Diff at index ${diffIndex}:`);
            console.log(`Cleaned: ${cleaned.substring(diffIndex, diffIndex + 100)}`);
            console.log(`First  : ${firstHead.substring(diffIndex, diffIndex + 100)}`);
        }
    }
});

if (allMatch) {
    console.log('All cleaned heads are 100% identical!');
}
