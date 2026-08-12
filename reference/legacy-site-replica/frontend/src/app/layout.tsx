import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Giacong.vn - Đối Tác Gia Công OEM/ODM & Private Label Hàng Đầu",
  description: "Chuyên cung cấp dịch vụ gia công sản xuất theo yêu cầu (OEM/ODM)...",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi" prefix="og: https://ogp.me/ns#" className="js">
      <head>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />

        {/* CSS Stylesheets */}
        <link rel="stylesheet" href="/assets/css/extra_min_89677ea2.css" type="text/css" media="all" />
        <link rel="stylesheet" href="/assets/css/wc-blocks_c55eaba9.css" type="text/css" media="all" />
        <link rel="stylesheet" href="/assets/css/kk-star-ratings_min_738ad511.css" type="text/css" media="all" />
        <link rel="stylesheet" href="/assets/css/devvn-quick-buy_ff17e006.css" type="text/css" media="all" />
        <link rel="stylesheet" href="/assets/css/flatsome_1a697c57.css" type="text/css" media="all" />
        <link rel="stylesheet" href="/assets/css/flatsome-shop_1f236790.css" type="text/css" media="all" />
        <link rel="stylesheet" href="/assets/css/style_a70a3410.css" type="text/css" media="all" />
        <link rel="stylesheet" href="/assets/css/styles_a86a383a.css" type="text/css" media="all" />
        <link rel="stylesheet" href="/assets/css/OneSignalSDK_page_styles_b01bd013.css" type="text/css" media="all" />
        <link rel="stylesheet" href="/assets/css/ftoc_min_94bb5358.css" type="text/css" media="all" />

        {/* Global Gutenberg Preset Styles */}
        <style id="global-styles-inline-css" dangerouslySetInnerHTML={{ __html: `
          :root{--wp--preset--aspect-ratio--square: 1;--wp--preset--aspect-ratio--4-3: 4/3;--wp--preset--aspect-ratio--3-4: 3/4;--wp--preset--aspect-ratio--3-2: 3/2;--wp--preset--aspect-ratio--2-3: 2/3;--wp--preset--aspect-ratio--16-9: 16/9;--wp--preset--aspect-ratio--9-16: 9/16;--wp--preset--color--black: #000000;--wp--preset--color--cyan-bluish-gray: #abb8c3;--wp--preset--color--white: #ffffff;--wp--preset--color--pale-pink: #f78da7;--wp--preset--color--vivid-red: #cf2e2e;--wp--preset--color--luminous-vivid-orange: #ff6900;--wp--preset--color--luminous-vivid-amber: #fcb900;--wp--preset--color--light-green-cyan: #7bdcb5;--wp--preset--color--vivid-green-cyan: #00d084;--wp--preset--color--pale-cyan-blue: #8ed1fc;--wp--preset--color--vivid-cyan-blue: #0693e3;--wp--preset--color--vivid-purple: #9b51e0;--wp--preset--gradient--vivid-cyan-blue-to-vivid-purple: linear-gradient(135deg,rgb(6,147,227) 0%,rgb(155,81,224) 100%);--wp--preset--gradient--light-green-cyan-to-vivid-green-cyan: linear-gradient(135deg,rgb(122,220,180) 0%,rgb(0,208,130) 100%);--wp--preset--gradient--luminous-vivid-amber-to-luminous-vivid-orange: linear-gradient(135deg,rgb(252,185,0) 0%,rgb(255,105,0) 100%);--wp--preset--gradient--luminous-vivid-orange-to-vivid-red: linear-gradient(135deg,rgb(255,105,0) 0%,rgb(207,46,46) 100%);--wp--preset--gradient--very-light-gray-to-cyan-bluish-gray: linear-gradient(135deg,rgb(238,238,238) 0%,rgb(169,184,195) 100%);--wp--preset--gradient--cool-to-warm-spectrum: linear-gradient(135deg,rgb(74,234,220) 0%,rgb(151,120,209) 20%,rgb(207,42,186) 40%,rgb(238,44,130) 60%,rgb(251,105,98) 80%,rgb(254,248,76) 100%);--wp--preset--gradient--blush-light-purple: linear-gradient(135deg,rgb(255,206,236) 0%,rgb(152,150,240) 100%);--wp--preset--gradient--blush-bordeaux: linear-gradient(135deg,rgb(254,205,165) 0%,rgb(254,45,45) 50%,rgb(107,0,62) 100%);--wp--preset--gradient--luminous-dusk: linear-gradient(135deg,rgb(255,203,112) 0%,rgb(199,81,192) 50%,rgb(65,88,208) 100%);--wp--preset--gradient--pale-ocean: linear-gradient(135deg,rgb(255,245,203) 0%,rgb(182,227,212) 50%,rgb(51,167,181) 100%);--wp--preset--gradient--electric-grass: linear-gradient(135deg,rgb(202,248,128) 0%,rgb(113,206,126) 100%);--wp--preset--gradient--midnight: linear-gradient(135deg,rgb(2,3,129) 0%,rgb(40,116,252) 100%);--wp--preset--font-size--small: 13px;--wp--preset--font-size--medium: 20px;--wp--preset--font-size--large: 36px;--wp--preset--font-size--x-large: 42px;--wp--preset--spacing--20: 0.44rem;--wp--preset--spacing--30: 0.67rem;--wp--preset--spacing--40: 1rem;--wp--preset--spacing--50: 1.5rem;--wp--preset--spacing--60: 2.25rem;--wp--preset--spacing--70: 3.38rem;--wp--preset--spacing--80: 5.06rem;--wp--preset--shadow--natural: 6px 6px 9px rgba(0, 0, 0, 0.2);--wp--preset--shadow--deep: 12px 12px 50px rgba(0, 0, 0, 0.4);--wp--preset--shadow--sharp: 6px 6px 0px rgba(0, 0, 0, 0.2);--wp--preset--shadow--outlined: 6px 6px 0px -3px rgb(255, 255, 255), 6px 6px rgb(0, 0, 0);--wp--preset--shadow--crisp: 6px 6px 0px rgb(0, 0, 0);}:where(.is-layout-flex){gap: 0.5em;}:where(.is-layout-grid){gap: 0.5em;}body .is-layout-flex{display: flex;}.is-layout-flex{flex-wrap: wrap;align-items: center;}.is-layout-flex > :is(*, div){margin: 0;}body .is-layout-grid{display: grid;}.is-layout-grid > :is(*, div){margin: 0;}:where(.wp-block-columns.is-layout-flex){gap: 2em;}:where(.wp-block-columns.is-layout-grid){gap: 2em;}:where(.wp-block-post-template.is-layout-flex){gap: 1.25em;}:where(.wp-block-post-template.is-layout-grid){gap: 1.25em;}.has-black-color{color: var(--wp--preset--color--black) !important;}.has-cyan-bluish-gray-color{color: var(--wp--preset--color--cyan-bluish-gray) !important;}.has-white-color{color: var(--wp--preset--color--white) !important;}.has-pale-pink-color{color: var(--wp--preset--color--pale-pink) !important;}.has-vivid-red-color{color: var(--wp--preset--color--vivid-red) !important;}.has-luminous-vivid-orange-color{color: var(--wp--preset--color--luminous-vivid-orange) !important;}.has-luminous-vivid-amber-color{color: var(--wp--preset--color--luminous-vivid-amber) !important;}.has-light-green-cyan-color{color: var(--wp--preset--color--light-green-cyan) !important;}.has-vivid-green-cyan-color{color: var(--wp--preset--color--vivid-green-cyan) !important;}.has-pale-cyan-blue-color{color: var(--wp--preset--color--pale-cyan-blue) !important;}.has-vivid-cyan-blue-color{color: var(--wp--preset--color--vivid-cyan-blue) !important;}.has-vivid-purple-color{color: var(--wp--preset--color--vivid-purple) !important;}.has-black-background-color{background-color: var(--wp--preset--color--black) !important;}.has-cyan-bluish-gray-background-color{background-color: var(--wp--preset--color--cyan-bluish-gray) !important;}.has-white-background-color{background-color: var(--wp--preset--color--white) !important;}.has-pale-pink-background-color{background-color: var(--wp--preset--color--pale-pink) !important;}.has-vivid-red-background-color{background-color: var(--wp--preset--color--vivid-red) !important;}.has-luminous-vivid-orange-background-color{background-color: var(--wp--preset--color--luminous-vivid-orange) !important;}.has-luminous-vivid-amber-background-color{background-color: var(--wp--preset--color--luminous-vivid-amber) !important;}.has-light-green-cyan-background-color{background-color: var(--wp--preset--color--light-green-cyan) !important;}.has-vivid-green-cyan-background-color{background-color: var(--wp--preset--color--vivid-green-cyan) !important;}.has-pale-cyan-blue-background-color{background-color: var(--wp--preset--color--pale-cyan-blue) !important;}.has-vivid-cyan-blue-background-color{background-color: var(--wp--preset--color--vivid-cyan-blue) !important;}.has-vivid-purple-background-color{background-color: var(--wp--preset--color--vivid-purple) !important;}.has-black-border-color{border-color: var(--wp--preset--color--black) !important;}.has-cyan-bluish-gray-border-color{border-color: var(--wp--preset--color--cyan-bluish-gray) !important;}.has-white-border-color{border-color: var(--wp--preset--color--white) !important;}.has-pale-pink-border-color{border-color: var(--wp--preset--color--pale-pink) !important;}.has-vivid-red-border-color{border-color: var(--wp--preset--color--vivid-red) !important;}.has-luminous-vivid-orange-border-color{border-color: var(--wp--preset--color--luminous-vivid-orange) !important;}.has-luminous-vivid-amber-border-color{border-color: var(--wp--preset--color--luminous-vivid-amber) !important;}.has-light-green-cyan-border-color{border-color: var(--wp--preset--color--light-green-cyan) !important;}.has-vivid-green-cyan-border-color{border-color: var(--wp--preset--color--vivid-green-cyan) !important;}.has-pale-cyan-blue-border-color{border-color: var(--wp--preset--color--pale-cyan-blue) !important;}.has-vivid-cyan-blue-border-color{border-color: var(--wp--preset--color--vivid-cyan-blue) !important;}.has-vivid-purple-border-color{border-color: var(--wp--preset--color--vivid-purple) !important;}.has-vivid-cyan-blue-to-vivid-purple-gradient-background{background: var(--wp--preset--gradient--vivid-cyan-blue-to-vivid-purple) !important;}.has-light-green-cyan-to-vivid-green-cyan-gradient-background{background: var(--wp--preset--gradient--light-green-cyan-to-vivid-green-cyan) !important;}.has-luminous-vivid-amber-to-luminous-vivid-orange-gradient-background{background: var(--wp--preset--gradient--luminous-vivid-amber-to-luminous-vivid-orange) !important;}.has-luminous-vivid-orange-to-vivid-red-gradient-background{background: var(--wp--preset--gradient--luminous-vivid-orange-to-vivid-red) !important;}.has-very-light-gray-to-cyan-bluish-gray-gradient-background{background: var(--wp--preset--gradient--very-light-gray-to-cyan-bluish-gray) !important;}.has-cool-to-warm-spectrum-gradient-background{background: var(--wp--preset--gradient--cool-to-warm-spectrum) !important;}.has-blush-light-purple-gradient-background{background: var(--wp--preset--gradient--blush-light-purple) !important;}.has-blush-bordeaux-gradient-background{background: var(--wp--preset--gradient--blush-bordeaux) !important;}.has-luminous-dusk-gradient-background{background: var(--wp--preset--gradient--luminous-dusk) !important;}.has-pale-ocean-gradient-background{background: var(--wp--preset--gradient--pale-ocean) !important;}.has-electric-grass-gradient-background{background: var(--wp--preset--gradient--electric-grass) !important;}.has-midnight-gradient-background{background: var(--wp--preset--gradient--midnight) !important;}.has-small-font-size{font-size: var(--wp--preset--font-size--small) !important;}.has-medium-font-size{font-size: var(--wp--preset--font-size--medium) !important;}.has-large-font-size{font-size: var(--wp--preset--font-size--large) !important;}.has-x-large-font-size{font-size: var(--wp--preset--font-size--x-large) !important;}
        ` }} />

        {/* Font-Face Inline CSS */}
        <style dangerouslySetInnerHTML={{ __html: `
          @font-face {
            font-family: "fl-icons";
            font-display: block;
            src: url(/assets/fonts/icons.eot?v=3.16.2);
            src:
              url(/assets/fonts/icons.eot#iefix?v=3.16.2) format("embedded-opentype"),
              url(/assets/fonts/icons.woff2?v=3.16.2) format("woff2"),
              url(/assets/fonts/icons.ttf?v=3.16.2) format("truetype"),
              url(/assets/fonts/icons.woff?v=3.16.2) format("woff"),
              url(/assets/fonts/icons.svg?v=3.16.2#fl-icons) format("svg");
          }

          img:is([sizes=auto i],[sizes^="auto," i]){contain-intrinsic-size:3000px 1500px}

          .wp-block-button__link{color:#fff;background-color:#32373c;border-radius:9999px;box-shadow:none;text-decoration:none;padding:calc(.667em + 2px) calc(1.333em + 2px);font-size:1.125em}.wp-block-file__button{background:#32373c;color:#fff;text-decoration:none}

          .woocommerce form .form-row .required { visibility: visible; }
          .bg{opacity: 0; transition: opacity 1s; -webkit-transition: opacity 1s;} .bg-loaded{opacity: 1;}
        ` }} />

        {/* Core Scripts */}
        <script src="/assets/js/sdk_06b0e4e0.js" async={true} crossOrigin="anonymous"></script>
        <script dangerouslySetInnerHTML={{ __html: `(function(html){html.className = html.className.replace(/\\bno-js\\b/,'js')})(document.documentElement);` }} />
        <script dangerouslySetInnerHTML={{ __html: `
          window.flatsomeVars = {
            theme: { version: "3.16.2" },
            ajaxurl: "https://giacong.vn/wp-admin/admin-ajax.php",
            rtl: "",
            sticky_height: "70",
            assets_url: "https://giacong.vn/wp-content/themes/flatsome/assets/js/",
            lightbox: {
              close_markup: '<button title="%title%" type="button" class="mfp-close"><svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-x"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg></button>',
              close_btn_inside: false
            },
            user: { can_edit_pages: false },
            i18n: { mainMenu: "Main Menu", toggleButton: "Toggle" },
            options: { cookie_notice_version: "1", swatches_layout: false, swatches_box_select_event: false, swatches_box_behavior_selected: false, swatches_box_update_urls: "1", swatches_box_reset: false, swatches_box_reset_extent: false, swatches_box_reset_time: 300, search_result_latency: "0" },
            is_mini_cart_reveal: "1"
          };
          window.wc_order_attribution = {
            params: {
              lifetime: 1.0000000000000000818030539140313095458623138256371021270751953125e-5,
              session: 30,
              base64: false,
              ajaxurl: "https://giacong.vn/wp-admin/admin-ajax.php",
              prefix: "wc_order_attribution_",
              allowTracking: true
            },
            fields: {
              source_type: "current.typ",
              referrer: "current_add.rf",
              utm_campaign: "current.cmp",
              utm_source: "current.src",
              utm_medium: "current.mdm",
              utm_content: "current.cnt",
              utm_id: "current.id",
              utm_term: "current.trm",
              utm_source_platform: "current.plt",
              utm_creative_format: "current.fmt",
              utm_marketing_tactic: "current.tct",
              session_entry: "current_add.ep",
              session_start_time: "current_add.fd",
              session_pages: "session.pgs",
              session_count: "udata.vst",
              user_agent: "udata.uag"
            }
          };
          window.woocommerce_params = {
            countries: "[]",
            ajax_url: "/?wc-ajax=%%endpoint%%",
            wc_ajax_url: "/?wc-ajax=%%endpoint%%"
          };
          window.wc_add_to_cart_params = {
            ajax_url: "/?wc-ajax=%%endpoint%%",
            wc_ajax_url: "/?wc-ajax=%%endpoint%%",
            i18n_view_cart: "Xem giỏ hàng",
            cart_url: "/gio-hang",
            is_cart: "",
            cart_redirect_after_add: "no"
          };
        ` }} />
        <script type="text/javascript" src="/assets/js/jquery_min_d61ca473.js"></script>
        <script type="text/javascript" src="/assets/js/underscore_min_1a66897e.js"></script>
        <script type="text/javascript" src="/assets/js/wp-util_min_96e91945.js"></script>
        <script type="text/javascript" src="/assets/js/jquery_blockUI_min_45b1164e.js" defer={true}></script>
        <script type="text/javascript" src="/assets/js/add-to-cart_min_960c2de0.js" defer={true}></script>
        <script type="text/javascript" src="/assets/js/js_cookie_min_29d76999.js" defer={true}></script>
        <script type="text/javascript" src="/assets/js/woocommerce_min_f0c6830a.js" defer={true}></script>
        <script src="/assets/js/OneSignalSDK_page_7da17e76.js" defer={true}></script>
        <script src="/assets/js/OneSignalSDK_page_es6_ef86d105.js" defer={true}></script>
      </head>
      <body>
        {children}

        {/* Footer Scripts */}
        <script type="text/javascript" src="/assets/js/hooks_min_6d769925.js"></script>
        <script type="text/javascript" src="/assets/js/i18n_min_d826b33e.js"></script>
        <script type="text/javascript" src="/assets/js/main_40ab1139.js"></script>
        <script type="text/javascript" src="/assets/js/kk-star-ratings_min_b480b6b9.js"></script>
        <script type="text/javascript" src="/assets/js/jquery_validate_min_86f3ad8a.js"></script>
        <script type="text/javascript" src="/assets/js/add-to-cart-variation_min_2d02266a.js" defer={true}></script>
        <script type="text/javascript" src="/assets/js/devvn-quick-buy_7f7a21e7.js"></script>
        <script type="text/javascript" src="/assets/js/frontend_min_502e8e13.js"></script>
        <script type="text/javascript" src="/assets/js/flatsome-instant-page_38926d44.js"></script>
        <script type="text/javascript" src="/assets/js/sourcebuster_min_e30483b3.js"></script>
        <script type="text/javascript" src="/assets/js/wp-polyfill_min_0641df77.js"></script>
        <script type="text/javascript" src="/assets/js/hoverIntent_min_39bd34dd.js"></script>
        <script type="text/javascript" src="/assets/js/flatsome_7896dbf8.js"></script>
        <script type="text/javascript" src="/assets/js/flatsome-lazy-load_f0a89b01.js"></script>
        <script type="text/javascript" src="/assets/js/woocommerce_71083712.js"></script>
        <script dangerouslySetInnerHTML={{ __html: `window.wpcf7 = window.wpcf7 || { api: { root: "", namespace: "" }, schemas: new Map() };` }} />
        <script type="text/javascript" src="/assets/js/index_ce3687a7.js"></script>
        <script type="text/javascript" src="/assets/js/index_49a6d269.js"></script>
        <script data-name="wpr-wpr-beacon" src="/assets/js/wpr-beacon_min_68fbf729.js" async={true}></script>
      </body>
    </html>
  );
}
