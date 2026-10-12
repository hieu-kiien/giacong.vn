import assert from 'node:assert/strict';
import test from 'node:test';
import { chromium } from 'playwright';
const { siteBrandStyles } = await import('../src/lib/site-markup.ts');

test('mobile search stays visible on the white header and has a usable touch target', async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    for (const width of [390, 768, 849, 1024]) {
      await page.setViewportSize({ width, height: 844 });
      await page.setContent(`<style>.mobile-nav a{color:rgba(255,255,255,.8);display:inline-flex} ${siteBrandStyles({primary_color:'#6cbe45',accent_color:'#bde875'})}</style><header id="header"><ul class="mobile-nav"><li class="header-search"><a aria-label="Tìm sản phẩm" href="/san-pham/#catalog-query"><i>⌕</i></a></li></ul></header>`);
      const actual = await page.getByRole('link', { name: 'Tìm sản phẩm' }).evaluate(el => ({color:getComputedStyle(el).color,width:el.getBoundingClientRect().width,height:el.getBoundingClientRect().height}));
      if (width <= 849) {
        assert.equal(actual.color, 'rgb(31, 51, 32)', `search contrast at ${width}px`);
        assert.ok(actual.width >= 44 && actual.height >= 44, `search touch target at ${width}px`);
      } else assert.equal(actual.color, 'rgba(255, 255, 255, 0.8)', 'desktop captured theme preserved');
    }
  } finally { await browser.close(); }
});
