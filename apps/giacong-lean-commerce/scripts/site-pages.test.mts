import assert from "node:assert/strict";
import test from "node:test";
import {
  normalizeRoutePath,
  publishAdminSitePage,
  SitePageConflictError,
  SitePageValidationError,
  updateAdminSitePage,
} from "../src/lib/site-pages.ts";
import { applyNavigationToMarkup, type PublishedNavigationItem } from "../src/lib/site-navigation.ts";

type PageRow = {
  page_key: string;
  route_path: string;
  title: string;
  draft_enabled: number;
  published_enabled: number;
  draft_blocks_json: string;
  published_blocks_json: string;
  draft_seo_title: string;
  published_seo_title: string;
  draft_seo_description: string;
  published_seo_description: string;
  version: number;
  updated_by: string | null;
  updated_at: string;
  published_by: string | null;
  published_at: string | null;
};

class FakePageDatabase {
  row: PageRow = {
    page_key: "home",
    route_path: "/",
    title: "Trang chủ",
    draft_enabled: 0,
    published_enabled: 0,
    draft_blocks_json: "[]",
    published_blocks_json: "[]",
    draft_seo_title: "",
    published_seo_title: "",
    draft_seo_description: "",
    published_seo_description: "",
    version: 1,
    updated_by: null,
    updated_at: "2026-08-26T00:00:00Z",
    published_by: null,
    published_at: null,
  };
  audits: string[] = [];

  prepare(query: string) {
    let values: unknown[] = [];
    return {
      bind: (...next: unknown[]) => {
        values = next;
        return this.prepareBound(query, () => values);
      },
      all: async <T,>() => ({ results: [this.row] as unknown as T[] }),
      first: async <T,>() => this.row as unknown as T,
      run: async () => ({ meta: { changes: 1 } }),
    };
  }

  private prepareBound(query: string, read: () => unknown[]) {
    return {
      bind: (...next: unknown[]) => this.prepareBound(query, () => next),
      all: async <T,>() => ({ results: [this.row] as unknown as T[] }),
      first: async <T,>() => this.row as unknown as T,
      run: async () => {
        const values = read();
        if (query.includes("INSERT INTO audit_logs")) {
          this.audits.push(String(values[3]));
          return { meta: { changes: 1 } };
        }
        if (query.includes("published_blocks_json = draft_blocks_json")) {
          if (this.row.version !== Number(values.at(-1))) return { meta: { changes: 0 } };
          this.row.published_blocks_json = this.row.draft_blocks_json;
          this.row.published_enabled = this.row.draft_enabled;
          this.row.published_seo_title = this.row.draft_seo_title;
          this.row.published_seo_description = this.row.draft_seo_description;
          this.row.published_by = String(values[0]);
          this.row.version += 1;
          return { meta: { changes: 1 } };
        }
        if (query.includes("draft_blocks_json = ?")) {
          if (this.row.version !== Number(values.at(-1))) return { meta: { changes: 0 } };
          this.row.draft_blocks_json = String(values[0]);
          this.row.draft_enabled = Number(values[1]);
          this.row.draft_seo_title = String(values[2]);
          this.row.draft_seo_description = String(values[3]);
          this.row.updated_by = String(values[4]);
          this.row.version += 1;
          return { meta: { changes: 1 } };
        }
        return { meta: { changes: 1 } };
      },
    };
  }
}

test("page draft and publish are separate optimistic operations", async () => {
  const database = new FakePageDatabase();
  const draft = await updateAdminSitePage(database, {
    actorSubject: "owner",
    blocks: [{ type: "rich_text", title: "Giới thiệu", body: "Nội dung đã duyệt." }],
    draftEnabled: true,
    expectedVersion: 1,
    pageKey: "home",
    seoDescription: "Mô tả mới",
    seoTitle: "Trang chủ mới",
  });
  assert.equal(draft.dirty, true);
  assert.equal(draft.draftEnabled, true);
  assert.equal(draft.publishedEnabled, false);

  const published = await publishAdminSitePage(database, {
    actorSubject: "owner",
    expectedVersion: 2,
    pageKey: "home",
  });
  assert.equal(published.dirty, false);
  assert.equal(published.publishedEnabled, true);
  assert.equal(published.publishedSeoTitle, "Trang chủ mới");
});

test("page updates reject stale versions and unsafe block payloads", async () => {
  const database = new FakePageDatabase();
  await assert.rejects(
    updateAdminSitePage(database, {
      actorSubject: "editor",
      blocks: [{ type: "raw_html", html: "<script>bad</script>" }],
      draftEnabled: true,
      expectedVersion: 1,
      pageKey: "home",
      seoDescription: "",
      seoTitle: "",
    }),
    SitePageValidationError,
  );
  await updateAdminSitePage(database, {
    actorSubject: "editor-a",
    blocks: [],
    draftEnabled: false,
    expectedVersion: 1,
    pageKey: "home",
    seoDescription: "",
    seoTitle: "",
  });
  await assert.rejects(
    updateAdminSitePage(database, {
      actorSubject: "editor-b",
      blocks: [],
      draftEnabled: false,
      expectedVersion: 1,
      pageKey: "home",
      seoDescription: "",
      seoTitle: "",
    }),
    SitePageConflictError,
  );
});

test("page blocks reject unknown fields instead of dropping arbitrary payload", async () => {
  const database = new FakePageDatabase();
  await assert.rejects(
    updateAdminSitePage(database, {
      actorSubject: "editor",
      blocks: [{
        type: "rich_text",
        title: "Giới thiệu",
        body: "Nội dung đã duyệt.",
        html: `<div>${"x".repeat(48_000)}</div>`,
      }],
      draftEnabled: true,
      expectedVersion: 1,
      pageKey: "home",
      seoDescription: "",
      seoTitle: "",
    }),
    SitePageValidationError,
  );
});

test("navigation changes only trusted links and text in the captured menu", () => {
  const markup = '<ul class="header-nav-main"><li id="menu-item-2"><a href="/two">Two</a></li><li id="menu-item-1"><a href="/old"><img src="/icon.svg" />Old<i class="icon-angle-down"></i></a></li><li id="menu-item-3"><a href="/three">Three</a></li></ul>';
  const items: PublishedNavigationItem[] = [{
    id: "nav-1",
    capturedMenuId: "menu-item-1",
    href: "/new-page/",
    isActive: true,
    label: "Trang <mới>",
    menuKey: "primary",
    sortOrder: 1,
  }, {
    id: "nav-2",
    capturedMenuId: "menu-item-2",
    href: "/two/",
    isActive: false,
    label: "Two",
    menuKey: "primary",
    sortOrder: 20,
  }, {
    id: "nav-3",
    capturedMenuId: "menu-item-3",
    href: "/three/",
    isActive: true,
    label: "Three",
    menuKey: "primary",
    sortOrder: 30,
  }];
  const result = applyNavigationToMarkup(markup, items, "menu-item-1");
  assert.match(result, /href="\/new-page\/"/);
  assert.match(result, /Trang &lt;mới&gt;/);
  assert.match(result, /icon-angle-down/);
  assert.doesNotMatch(result, /<mới>/);
  assert.match(result, /id="menu-item-2"[^>]*\bhidden\b/);
  assert.match(result, /id="menu-item-1"[^>]*class="[^"]*active[^"]*current-menu-item[^"]*"[^>]*aria-current="page"/);
  assert.ok(result.indexOf('id="menu-item-1"') < result.indexOf('id="menu-item-2"'), "managed items follow published sort order");
});

test("managed page routes support safe nested paths", () => {
  assert.equal(normalizeRoutePath("/san-pham/do-uong"), "/san-pham/do-uong/");
  assert.equal(normalizeRoutePath("/san-pham/do-uong/"), "/san-pham/do-uong/");
  assert.throws(() => normalizeRoutePath("/san pham/do-uong"), SitePageValidationError);
  assert.throws(() => normalizeRoutePath("https://example.com/page"), SitePageValidationError);
});

test("custom published navigation appears in desktop and mobile menus", () => {
  const markup = '<ul class="header-nav header-nav-main"><li id="menu-item-4618"><a href="/">Home</a></li></ul><div id="main-menu"><ul class="nav nav-sidebar nav-vertical"><li id="menu-item-5465"><a href="/">Trang Chủ</a></li></ul></div>';
  const result = applyNavigationToMarkup(markup, [{
    id: "custom-contact",
    capturedMenuId: null,
    href: "/lien-he-moi/",
    isActive: true,
    label: "Liên hệ mới",
    menuKey: "primary",
    sortOrder: 15,
  }]);
  assert.equal((result.match(/managed-navigation-item/g) ?? []).length, 2);
  assert.equal((result.match(/href="\/lien-he-moi\/"/g) ?? []).length, 2);
});
