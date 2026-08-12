const fs = require('fs');
const path = require('path');

const imagesDir = path.join(__dirname, '..', 'assets', 'images');
const localImages = fs.readdirSync(imagesDir);

const testUrls = [
    "https://giacong.vn/wp-content/uploads/2025/09/dich-vu-dong-goi-khay-xop-hut-mang-co-768x1024.jpg",
    "https://giacong.vn/wp-content/uploads/2025/09/dich-vu-say-sa-300x212.jpg",
    "https://giacong.vn/wp-content/uploads/2025/09/dich-vu-say-la-bac-ha-300x198.png",
    "https://giacong.vn/wp-content/uploads/2025/04/gia-cong-bot-lam-kem-300x150.jpg",
    "https://giacong.vn/wp-content/uploads/2025/09/gia-cong-bot-matcha-300x118.jpg",
    "https://giacong.vn/wp-content/uploads/2025/09/gia-cong-bot-tao-tau-300x200.jpg",
    "https://giacong.vn/wp-content/uploads/2024/12/gia-cong-ca-phe-hoa-tan.jpg",
    "https://giacong.vn/wp-content/uploads/2024/12/gia-cong-ca-phe-hoa-tan-300x200.jpg",
    "https://giacong.vn/wp-content/uploads/2025/09/gia-cong-kem-ly-300x188.jpg",
    "https://giacong.vn/wp-content/uploads/2025/09/gia-cong-nuoc-bo-sung-khoang-chat-cho-the-thao-300x169.webp"
];

function mapImageToLocal(url) {
    const filename = path.basename(url.split('?')[0]);
    const ext = path.extname(filename).toLowerCase();
    let base = filename.replace(/\.[^.]+$/, '').toLowerCase();
    
    // Strip WP size suffix like -300x200 or -1536x1024
    base = base.replace(/-\d+x\d+$/, '');
    
    // Look for local image
    for (const img of localImages) {
        let imgBase = img.replace(/\.[^.]+$/, '').toLowerCase();
        // Remove hash from local image
        const parts = imgBase.split('_');
        if (parts.length > 1) {
            parts.pop(); // remove hash
        }
        let imgBaseNoHash = parts.join('_');
        // Strip size suffix from local image base name too if present
        imgBaseNoHash = imgBaseNoHash.replace(/-\d+x\d+$/, '');
        
        if (imgBaseNoHash === base) {
            return img;
        }
    }
    
    // Try substring matching as a fallback
    for (const img of localImages) {
        let imgBase = img.replace(/\.[^.]+$/, '').toLowerCase();
        if (imgBase.includes(base) || base.includes(imgBase.split('_')[0])) {
            return img;
        }
    }
    
    return null;
}

testUrls.forEach(url => {
    const local = mapImageToLocal(url);
    console.log(`${url}\n  => ${local ? '/assets/images/' + local : 'NOT FOUND'}`);
});
