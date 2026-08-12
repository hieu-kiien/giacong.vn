const fs = require('fs');
const path = require('path');

const imagesDir = path.join(__dirname, '..', 'assets', 'images');
const localImages = fs.readdirSync(imagesDir);

const unmapped = [
    "dich-vu-dong-goi-khay-xop-hut-mang-co",
    "dich-vu-say-sa",
    "dich-vu-say-la-bac-ha",
    "gia-cong-bot-lam-kem",
    "gia-cong-bot-matcha",
    "gia-cong-bot-tao-tau",
    "gia-cong-ca-phe-hoa-tan",
    "gia-cong-kem-ly",
    "gia-cong-nuoc-bo-sung-khoang-chat-cho-the-thao"
];

unmapped.forEach(name => {
    console.log(`Searching for: ${name}`);
    const matches = localImages.filter(img => img.toLowerCase().includes(name.toLowerCase()));
    if (matches.length > 0) {
        console.log(`  Matches: ${matches.join(', ')}`);
    } else {
        console.log(`  No matches found.`);
    }
});
