import assert from "node:assert/strict";
import test from "node:test";
import {
  createAdminSitePage,
  normalizeRoutePath,
  publishAdminSitePage,
  SitePageConflictError,
  SitePageIdempotencyConflictError,
  SitePageValidationError,
  updateAdminSitePage,
} from "../src/lib/site-pages.ts";
import {
  applyFooterNavigationToMarkup,
  applyNavigationToMarkup,
  type PublishedNavigationItem,
} from "../src/lib/site-navigation.ts";

test("custom published footer navigation is rendered into the captured footer", () => {
  const markup = '<footer><section class="section footer-section"><div class="section-content relative"><div class="row"><div class="col"><div class="col-inner">Captured footer</div></div></div></div></section></footer>';
  const result = applyFooterNavigationToMarkup(markup, [{
    id: "footer-contact",
    capturedMenuId: null,
    href: "/lien-he/",
    isActive: true,
    label: "Liên hệ <chính thức>",
    menuKey: "footer",
    sortOrder: 10,
  }, {
    id: "footer-hidden",
    capturedMenuId: null,
    href: "/khong-hien/",
    isActive: false,
    label: "Không hiển thị",
    menuKey: "footer",
    sortOrder: 20,
  }]);

  assert.match(result, /data-site-navigation="footer"/);
  assert.match(result, /href="\/lien-he\/"[^>]*>Liên hệ &lt;chính thức&gt;<\/a>/);
  assert.doesNotMatch(result, /Không hiển thị|khong-hien/);
  assert.equal((result.match(/data-site-navigation="footer"/g) ?? []).length, 1);
});

test("footer navigation does not change captured markup when no footer item is active", () => {
  const markup = '<footer><section class="section footer-section"><div class="section-content">Captured footer</div></section></footer>';
  const result = applyFooterNavigationToMarkup(markup, [{
    id: "footer-hidden",
    capturedMenuId: null,
    href: "/khong-hien/",
    isActive: false,
    label: "Không hiển thị",
    menuKey: "footer",
    sortOrder: 10,
  }, {
    id: "primary",
    capturedMenuId: null,
    href: "/",
    isActive: true,
    label: "Primary",
    menuKey: "primary",
    sortOrder: 20,
  }]);

  assert.equal(result, markup);
});

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
  last_request_id: string | null;
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
    last_request_id: null,
  };
  audits = new Map<string, { entity_key: string; operation: string; payload_sha256: string }>();

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

  async batch(statements: Array<{ run(): Promise<unknown> }>): Promise<unknown[]> {
    const results: unknown[] = [];
    for (const statement of statements) results.push(await statement.run());
    return results;
  }

  private prepareBound(query: string, read: () => unknown[]) {
    return {
      bind: (...next: unknown[]) => this.prepareBound(query, () => next),
      all: async <T,>() => ({ results: [this.row] as unknown as T[] }),
      first: async <T,>() => {
        if (query.includes("FROM admin_site_page_audit")) {
          return (this.audits.get(String(read()[0])) ?? null) as unknown as T;
        }
        return this.row as unknown as T;
      },
      run: async () => {
        const values = read();
        if (query.includes("INSERT INTO admin_site_page_audit")) {
          const isCreate = query.includes("'create', 'create'");
          this.audits.set(String(values[0]), {
            entity_key: String(isCreate ? values[2] : values[5]),
            operation: isCreate ? "create" : String(values[2]),
            payload_sha256: String(isCreate ? values[3] : values[4]),
          });
          return { meta: { changes: 1 } };
        }
        if (query.includes("INSERT INTO site_pages")) {
          this.row.page_key = String(values[0]);
          this.row.route_path = String(values[1]);
          this.row.title = String(values[2]);
          this.row.updated_by = String(values[3]);
          this.row.last_request_id = String(values[4]);
          return { meta: { changes: 1 } };
        }
        if (query.includes("published_blocks_json = draft_blocks_json")) {
          if (this.row.version !== Number(values.at(-1))) return { meta: { changes: 0 } };
          this.row.published_blocks_json = this.row.draft_blocks_json;
          this.row.published_enabled = this.row.draft_enabled;
          this.row.published_seo_title = this.row.draft_seo_title;
          this.row.published_seo_description = this.row.draft_seo_description;
          this.row.published_by = String(values[0]);
          this.row.last_request_id = String(values[2]);
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
          this.row.last_request_id = String(values[5]);
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
    requestId: "11111111-1111-4111-8111-111111111111",
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
    requestId: "22222222-2222-4222-8222-222222222222",
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
      requestId: "33333333-3333-4333-8333-333333333333",
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
    requestId: "44444444-4444-4444-8444-444444444444",
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
      requestId: "55555555-5555-4555-8555-555555555555",
      seoDescription: "",
      seoTitle: "",
    }),
    SitePageConflictError,
  );
});

test("page draft and publish retries replay once and reject request-id reuse with a different payload", async () => {
  const database = new FakePageDatabase();
  const draftRequestId = "88888888-8888-4888-8888-888888888888";
  const draftInput = {
    actorSubject: "owner",
    blocks: [{ type: "rich_text" as const, title: "Giới thiệu", body: "Nội dung đã duyệt." }],
    draftEnabled: true,
    expectedVersion: 1,
    pageKey: "home",
    requestId: draftRequestId,
    seoDescription: "Mô tả mới",
    seoTitle: "Trang chủ mới",
  };
  const firstDraft = await updateAdminSitePage(database, draftInput);
  const replayedDraft = await updateAdminSitePage(database, { ...draftInput, actorSubject: "retrying-owner" });
  assert.equal(replayedDraft.version, firstDraft.version);
  assert.equal(database.audits.size, 1);

  await assert.rejects(
    updateAdminSitePage(database, { ...draftInput, seoTitle: "Payload khác" }),
    SitePageIdempotencyConflictError,
  );

  const publishRequestId = "99999999-9999-4999-8999-999999999999";
  const firstPublish = await publishAdminSitePage(database, {
    actorSubject: "owner",
    expectedVersion: firstDraft.version,
    pageKey: "home",
    requestId: publishRequestId,
  });
  const replayedPublish = await publishAdminSitePage(database, {
    actorSubject: "retrying-owner",
    expectedVersion: firstDraft.version,
    pageKey: "home",
    requestId: publishRequestId,
  });
  assert.equal(replayedPublish.version, firstPublish.version);
  assert.equal(database.audits.size, 2);
});

test("page creation is request-idempotent and records a create audit", async () => {
  const database = new FakePageDatabase();
  const input = {
    actorSubject: "owner",
    pageKey: "about-new",
    requestId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    routePath: "/about-new",
    title: "Giới thiệu mới",
  };
  const first = await createAdminSitePage(database, input);
  const replay = await createAdminSitePage(database, { ...input, actorSubject: "retrying-owner" });
  assert.equal(first.pageKey, "about-new");
  assert.equal(replay.pageKey, first.pageKey);
  assert.equal(database.audits.size, 1);
  await assert.rejects(
    createAdminSitePage(database, { ...input, title: "Tên khác" }),
    SitePageIdempotencyConflictError,
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
      requestId: crypto.randomUUID(),
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
