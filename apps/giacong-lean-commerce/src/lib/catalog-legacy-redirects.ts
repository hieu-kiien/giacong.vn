interface LegacyProductRedirect {
  parentSlug: string;
  variantSku: string;
}

export const legacyProductRedirects: Readonly<Record<string, LegacyProductRedirect>> = {
  "b2b-demo-bot-dinh-duong-vi-vani": {
    parentSlug: "b2b-demo-bot-dinh-duong",
    variantSku: "B2B-DEMO-BOT-VANI",
  },
  "b2b-demo-bot-dinh-duong-vi-it-ngot": {
    parentSlug: "b2b-demo-bot-dinh-duong",
    variantSku: "B2B-DEMO-BOT-IT-NGOT",
  },
  "b2b-demo-thuc-uong-dinh-duong-lua-mach": {
    parentSlug: "b2b-demo-thuc-uong-dinh-duong",
    variantSku: "B2B-DEMO-LUA-MACH",
  },
  "b2b-demo-sua-hat-pha-san": {
    parentSlug: "b2b-demo-thuc-uong-dinh-duong",
    variantSku: "B2B-DEMO-SUA-HAT",
  },
  "b2b-demo-ngu-coc-dinh-duong-hat": {
    parentSlug: "b2b-demo-ngu-coc-dinh-duong",
    variantSku: "B2B-DEMO-NGU-COC-HAT",
  },
  "b2b-demo-bot-yen-mach-hoa-tan": {
    parentSlug: "b2b-demo-ngu-coc-dinh-duong",
    variantSku: "B2B-DEMO-YEN-MACH",
  },
};
