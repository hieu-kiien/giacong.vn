const fs = require('fs');
const path = require('path');

const jsFiles = fs.readdirSync(path.join(__dirname, '..', 'assets', 'js'));

const testUrls = [
    "https://giacong.vn/wp-includes/js/jquery/jquery.min.js?ver=3.7.1",
    "https://giacong.vn/wp-includes/js/underscore.min.js?ver=1.13.7",
    "https://giacong.vn/wp-includes/js/wp-util.min.js?ver=6.9.4",
    "https://giacong.vn/wp-content/plugins/woocommerce/assets/js/jquery-blockui/jquery.blockUI.min.js?ver=2.7.0-wc.10.6.2",
    "https://giacong.vn/wp-content/plugins/woocommerce/assets/js/frontend/add-to-cart.min.js?ver=10.6.2",
    "https://giacong.vn/wp-content/plugins/woocommerce/assets/js/js-cookie/js.cookie.min.js?ver=2.1.4-wc.10.6.2",
    "https://giacong.vn/wp-content/plugins/woocommerce/assets/js/frontend/woocommerce.min.js?ver=10.6.2",
    "https://connect.facebook.net/vi_VN/bundle/sdk.js/",
    "https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js",
    "https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.es6.js?v=160607",
    "https://giacong.vn/wp-content/plugins/devvn-quick-buy/js/devvn-quick-buy.js?ver=2.1.3",
    "https://giacong.vn/wp-content/plugins/link-whisper-premium/js/frontend.min.js?ver=1742348213",
    "https://giacong.vn/wp-content/themes/flatsome/inc/extensions/flatsome-instant-page/flatsome-instant-page.js?ver=1.2.1",
    "https://giacong.vn/wp-content/plugins/woocommerce/assets/js/sourcebuster/sourcebuster.min.js?ver=10.6.2",
    "https://giacong.vn/wp-content/plugins/woocommerce/assets/js/frontend/order-attribution.min.js?ver=10.6.2",
    "https://giacong.vn/wp-includes/js/dist/vendor/wp-polyfill.min.js?ver=3.15.0",
    "https://giacong.vn/wp-includes/js/hoverIntent.min.js?ver=1.10.2",
    "https://giacong.vn/wp-content/themes/flatsome/assets/js/flatsome.js?ver=fcf0c1642621a86609ed4ca283f0db68",
    "https://giacong.vn/wp-content/themes/flatsome/inc/extensions/flatsome-lazy-load/flatsome-lazy-load.js?ver=3.16.2",
    "https://giacong.vn/wp-content/themes/flatsome/assets/js/woocommerce.js?ver=a0349779516f2e7c5703074420d5e855",
    "https://giacong.vn/wp-content/plugins/contact-form-7/includes/swv/js/index.js?ver=6.1.5",
    "https://giacong.vn/wp-content/plugins/contact-form-7/includes/js/index.js?ver=6.1.5",
    "https://giacong.vn/wp-content/plugins/wp-rocket/assets/js/wpr-beacon.min.js"
];

function mapUrlToLocal(url) {
    let cleanUrl = url.split('?')[0];
    if (cleanUrl.endsWith('/')) cleanUrl = cleanUrl.slice(0, -1);
    
    const filename = path.basename(cleanUrl);
    const base = filename.replace(/\.js$/, '');
    const normalizedBase = base.toLowerCase().replace(/[\.\-]/g, '_');
    
    // special handling for OneSignal
    if (normalizedBase === 'onesignalsdk_page') {
        return 'OneSignalSDK_page_7da17e76.js';
    }
    if (normalizedBase === 'onesignalsdk_page_es6') {
        return 'OneSignalSDK_page_es6_ef86d105.js';
    }
    // special handling for facebook sdk
    if (normalizedBase === 'sdk') {
        return 'sdk_06b0e4e0.js';
    }
    // special handling for index.js
    if (filename === 'index.js') {
        if (url.includes('/swv/')) {
            return 'index_ce3687a7.js';
        } else {
            return 'index_49a6d269.js';
        }
    }

    for (const jsFile of jsFiles) {
        const parts = jsFile.replace(/\.js$/, '').split('_');
        if (parts.length > 1) {
            parts.pop(); // remove hash
        }
        const jsBaseClean = parts.join('_').toLowerCase().replace(/[\.\-]/g, '_');
        if (jsBaseClean === normalizedBase) {
            return jsFile;
        }
    }
    
    return null;
}

testUrls.forEach(url => {
    const local = mapUrlToLocal(url);
    console.log(`${url}\n  => ${local ? '/assets/js/' + local : 'NOT FOUND'}`);
});
