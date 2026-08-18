import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";

const adminOrigin = requiredEnv("ADMIN_STAGING_ORIGIN").replace(/\/$/, "");
const publicOrigin = requiredEnv("STAGING_ORIGIN").replace(/\/$/, "");
const database = process.env.STAGING_DATABASE?.trim() || "giacong-vn-catalog-staging";
const accessClientId = requiredEnv("CLOUDFLARE_ACCESS_CLIENT_ID");
const accessClientSecret = requiredEnv("CLOUDFLARE_ACCESS_CLIENT_SECRET");
const serviceSubject = `service:${accessClientId}`;
const qaMemberId = "staging-news-media-qa-service";
const evidencePath = process.env.G2_EVIDENCE_PATH?.trim() || "";
const accessHeaders = {
  "CF-Access-Client-Id": accessClientId,
  "CF-Access-Client-Secret": accessClientSecret,
};
const onePixelPng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64",
);

let articleId = null;
let articleSlug = null;
let firstAsset = null;
let secondAsset = null;
let qaMembershipOwned = false;
let acceptanceSucceeded = false;
let evidence = null;

console.log(`G2 News media operator QA admin target: ${adminOrigin}`);
console.log(`G2 News media operator QA public target: ${publicOrigin}`);

try {
  qaMembershipOwned = ensureQaAdminMembership();

  const runSuffix = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
  articleSlug = `g2-news-media-${runSuffix}`;
  const created = await expectAdminSuccess("/api/admin/news", {
    method: "POST",
    json: {
      categoryId: null,
      contentText: "Bài kiểm tra staging có kiểm soát cho vòng đời News media G2.",
      excerpt: "Staging-only G2 News media acceptance.",
      featured: false,
      publishedAt: null,
      seoDescription: "",
      seoTitle: "",
      slug: articleSlug,
      status: "draft",
      thumbnailUrl: null,
      title: `G2 News media acceptance ${runSuffix}`,
    },
  }, 201);
  const article = created.data?.article;
  assert.ok(article?.id && article?.revision, "Created News article did not expose id/revision.");
  articleId = Number(article.id);

  firstAsset = await uploadPng(articleId, `g2-first-${runSuffix}.png`, "G2 first thumbnail");
  secondAsset = await uploadPng(articleId, `g2-second-${runSuffix}.png`, "G2 replacement thumbnail");
  assert.notEqual(firstAsset.id, secondAsset.id, "G2 uploads must create distinct media assets.");
  assert.notEqual(firstAsset.publicUrl, secondAsset.publicUrl, "G2 uploads must expose distinct public URLs.");

  const publishedAt = new Date(Date.now() - 60_000).toISOString();
  const published = await expectAdminSuccess(`/api/admin/news/${articleId}`, {
    method: "PATCH",
    json: {
      publishedAt,
      revision: article.revision,
      status: "published",
      thumbnailUrl: firstAsset.publicUrl,
    },
  });
  let currentArticle = published.data?.article;
  assert.equal(currentArticle?.thumbnailUrl, firstAsset.publicUrl, "First thumbnail did not persist.");
  assert.equal(currentArticle?.status, "published", "G2 article did not publish.");

  await waitForPublicThumbnail(articleSlug, firstAsset.publicUrl);
  await expectMediaStatus(firstAsset.publicUrl, 200);

  const inUseResponse = await adminFetch(`/api/admin/news/${articleId}/media/${encodeURIComponent(firstAsset.id)}`, {
    method: "DELETE",
  });
  const inUseBody = await readJson(inUseResponse);
  assert.equal(inUseResponse.status, 409, `Persisted thumbnail delete returned HTTP ${inUseResponse.status}.`);
  assert.equal(inUseBody?.code, "MEDIA_IN_USE", "Persisted thumbnail delete did not return MEDIA_IN_USE.");

  const replaced = await expectAdminSuccess(`/api/admin/news/${articleId}`, {
    method: "PATCH",
    json: {
      revision: currentArticle.revision,
      thumbnailUrl: secondAsset.publicUrl,
    },
  });
  currentArticle = replaced.data?.article;
  assert.equal(currentArticle?.thumbnailUrl, secondAsset.publicUrl, "Replacement thumbnail did not persist.");

  await waitForPublicThumbnail(articleSlug, secondAsset.publicUrl, firstAsset.publicUrl);

  const deleted = await expectAdminSuccess(
    `/api/admin/news/${articleId}/media/${encodeURIComponent(firstAsset.id)}`,
    { method: "DELETE" },
    200,
  );
  assert.equal(deleted.data?.storageDeleted, true, "Old thumbnail was tombstoned but R2 cleanup did not complete.");

  const postCondition = readPostCondition(articleId, firstAsset.id, secondAsset.id);
  assert.equal(postCondition.article?.thumbnail_url, secondAsset.publicUrl, "D1 article thumbnail does not point to replacement asset.");
  assert.equal(postCondition.first?.status, "deleted", "Old News media row is not tombstoned.");
  assert.equal(postCondition.second?.status, "active", "Replacement News media row is not active.");
  assert.equal(postCondition.first?.storage_key, firstAsset.storageKey, "Old News media storage key drifted.");
  assert.equal(postCondition.second?.storage_key, secondAsset.storageKey, "Replacement News media storage key drifted.");

  await expectMediaStatus(firstAsset.publicUrl, 404);
  await expectMediaStatus(secondAsset.publicUrl, 200);
  await waitForPublicThumbnail(articleSlug, secondAsset.publicUrl, firstAsset.publicUrl);

  evidence = {
    articleId,
    articleSlug,
    firstAssetId: firstAsset.id,
    firstAssetPublicUrl: firstAsset.publicUrl,
    firstAssetStorageKey: firstAsset.storageKey,
    mediaInUseStatus: 409,
    mediaInUseCode: "MEDIA_IN_USE",
    oldAssetD1Status: postCondition.first.status,
    oldAssetR2HttpStatus: 404,
    replacementAssetId: secondAsset.id,
    replacementAssetPublicUrl: secondAsset.publicUrl,
    replacementAssetStorageKey: secondAsset.storageKey,
    replacementD1Status: postCondition.second.status,
    replacementR2HttpStatus: 200,
    publicArticleHttpStatus: 200,
    publicThumbnail: secondAsset.publicUrl,
    observedAt: new Date().toISOString(),
  };
  acceptanceSucceeded = true;
  console.log(`G2 News media operator acceptance passed for article ${articleId} (${articleSlug}).`);
} finally {
  const cleanup = await cleanupQaState().catch((error) => ({
    ok: false,
    error: error instanceof Error ? error.message : String(error),
  }));
  if (evidence) evidence.cleanup = cleanup;
  if (evidencePath && evidence) {
    writeFileSync(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
  }
  if (!acceptanceSucceeded) {
    console.error("G2 News media operator acceptance did not complete successfully.");
  }
}

function requiredEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required for G2 News media operator QA.`);
  return value;
}

function ensureQaAdminMembership() {
  const existing = d1Results(`
    SELECT id, access_subject, role, is_active
    FROM admin_members
    WHERE access_subject = ${sqlString(serviceSubject)}
    LIMIT 1;
  `)[0] ?? null;

  if (existing) {
    assert.equal(Number(existing.is_active), 1, "Existing G2 service admin membership is inactive.");
    assert.ok(
      existing.role === "owner" || existing.role === "content_manager",
      `Existing G2 service admin membership has insufficient role: ${existing.role}`,
    );
    console.log(`Using existing staging admin membership ${existing.id} for Access service identity.`);
    return existing.id === qaMemberId;
  }

  d1Execute(`
    INSERT INTO admin_members (id, access_subject, email, display_name, role, is_active)
    VALUES (
      ${sqlString(qaMemberId)},
      ${sqlString(serviceSubject)},
      NULL,
      'Staging News media QA service',
      'content_manager',
      1
    );
  `);
  const inserted = d1Results(`
    SELECT id, access_subject, role, is_active
    FROM admin_members
    WHERE id = ${sqlString(qaMemberId)}
    LIMIT 1;
  `)[0] ?? null;
  assert.equal(inserted?.access_subject, serviceSubject, "G2 service admin membership insert did not persist.");
  assert.equal(inserted?.role, "content_manager", "G2 service admin membership role drifted.");
  console.log(`Created temporary staging admin membership ${qaMemberId}.`);
  return true;
}

async function uploadPng(targetArticleId, filename, altText) {
  const form = new FormData();
  form.append("file", new Blob([onePixelPng], { type: "image/png" }), filename);
  form.append("altText", altText);
  const body = await expectAdminSuccess(`/api/admin/news/${targetArticleId}/media`, {
    method: "POST",
    body: form,
  }, 201);
  const media = body.data?.media;
  assert.ok(media?.id && media?.publicUrl && media?.storageKey, `Upload ${filename} did not expose media metadata.`);
  return media;
}

async function waitForPublicThumbnail(slug, expectedUrl, forbiddenUrl = null) {
  let lastStatus = 0;
  let lastHtml = "";
  for (let attempt = 1; attempt <= 12; attempt += 1) {
    const response = await publicFetch(`/tin-tuc/${encodeURIComponent(slug)}`);
    lastStatus = response.status;
    lastHtml = await response.text();
    if (
      response.status === 200
      && lastHtml.includes(expectedUrl)
      && (!forbiddenUrl || !lastHtml.includes(forbiddenUrl))
    ) {
      return;
    }
    await sleep(1000);
  }
  throw new Error(
    `Public News thumbnail did not converge for ${slug}: HTTP ${lastStatus}, expected ${expectedUrl}, forbidden ${forbiddenUrl ?? "none"}.`,
  );
}

async function expectMediaStatus(publicUrl, expectedStatus) {
  const response = await publicFetch(publicUrl);
  assert.equal(response.status, expectedStatus, `${publicUrl} returned HTTP ${response.status}, expected ${expectedStatus}.`);
  if (expectedStatus === 200) {
    assert.match(response.headers.get("content-type") ?? "", /^image\/png/i, `${publicUrl} did not return image/png.`);
    assert.ok((await response.arrayBuffer()).byteLength > 0, `${publicUrl} returned an empty media object.`);
  }
}

function readPostCondition(targetArticleId, firstAssetId, secondAssetId) {
  const payload = d1Execute(`
    SELECT id, thumbnail_url, revision, archived_at
    FROM articles
    WHERE id = ${Number(targetArticleId)}
    LIMIT 1;

    SELECT id, status, storage_key
    FROM news_media_assets
    WHERE id IN (${sqlString(firstAssetId)}, ${sqlString(secondAssetId)})
    ORDER BY id ASC;
  `);
  assert.ok(Array.isArray(payload) && payload.length >= 2, "G2 D1 post-condition query returned an unexpected shape.");
  const article = payload[0]?.results?.[0] ?? null;
  const rows = payload[1]?.results ?? [];
  return {
    article,
    first: rows.find((row) => row.id === firstAssetId) ?? null,
    second: rows.find((row) => row.id === secondAssetId) ?? null,
  };
}

async function cleanupQaState() {
  const cleanup = {
    articleArchived: false,
    membershipRemoved: false,
    mediaDeleteStatuses: [],
    ok: true,
  };

  if (articleId) {
    let current = await getAdminArticle(articleId);
    if (current && !current.archivedAt && current.thumbnailUrl) {
      const cleared = await expectAdminSuccess(`/api/admin/news/${articleId}`, {
        method: "PATCH",
        json: { revision: current.revision, thumbnailUrl: null },
      });
      current = cleared.data?.article ?? current;
    }

    for (const media of [firstAsset, secondAsset].filter(Boolean)) {
      const response = await adminFetch(`/api/admin/news/${articleId}/media/${encodeURIComponent(media.id)}`, {
        method: "DELETE",
      });
      cleanup.mediaDeleteStatuses.push({ assetId: media.id, status: response.status });
      if (![200, 202, 404].includes(response.status)) {
        const body = await readJson(response);
        throw new Error(`Cleanup delete for ${media.id} failed with HTTP ${response.status}: ${JSON.stringify(body)}`);
      }
    }

    current = await getAdminArticle(articleId);
    if (current && !current.archivedAt) {
      await expectAdminSuccess(`/api/admin/news/${articleId}`, {
        method: "DELETE",
        json: { revision: current.revision },
      });
      cleanup.articleArchived = true;
    } else if (current?.archivedAt) {
      cleanup.articleArchived = true;
    }
  }

  if (qaMembershipOwned) {
    d1Execute(`
      DELETE FROM admin_members
      WHERE id = ${sqlString(qaMemberId)}
        AND access_subject = ${sqlString(serviceSubject)};
    `);
    const remaining = d1Results(`
      SELECT COUNT(*) AS total
      FROM admin_members
      WHERE id = ${sqlString(qaMemberId)}
        AND access_subject = ${sqlString(serviceSubject)};
    `)[0]?.total;
    assert.equal(Number(remaining ?? -1), 0, "Temporary G2 service admin membership cleanup failed.");
    cleanup.membershipRemoved = true;
  }

  return cleanup;
}

async function getAdminArticle(targetArticleId) {
  const response = await adminFetch(`/api/admin/news/${targetArticleId}`);
  if (response.status === 404) return null;
  const body = await readJson(response);
  assert.ok(response.ok && body?.ok === true, `Admin article read failed with HTTP ${response.status}: ${JSON.stringify(body)}`);
  return body.data?.article ?? null;
}

async function expectAdminSuccess(pathname, options = {}, expectedStatus = 200) {
  const response = await adminFetch(pathname, options);
  const body = await readJson(response);
  assert.equal(response.status, expectedStatus, `${pathname} returned HTTP ${response.status}, expected ${expectedStatus}: ${JSON.stringify(body)}`);
  assert.equal(body?.ok, true, `${pathname} did not return an admin success envelope.`);
  return body;
}

async function adminFetch(pathname, options = {}) {
  const url = new URL(pathname, `${adminOrigin}/`);
  const headers = new Headers(options.headers ?? {});
  for (const [key, value] of Object.entries(accessHeaders)) headers.set(key, value);
  if (["DELETE", "PATCH", "POST", "PUT"].includes((options.method ?? "GET").toUpperCase())) {
    headers.set("Origin", adminOrigin);
  }

  let body = options.body;
  if (Object.prototype.hasOwnProperty.call(options, "json")) {
    headers.set("Content-Type", "application/json");
    body = JSON.stringify(options.json);
  }

  return fetch(url, {
    method: options.method ?? "GET",
    headers,
    body,
    redirect: "follow",
    signal: AbortSignal.timeout(25000),
  });
}

async function publicFetch(pathname) {
  const url = new URL(pathname, `${publicOrigin}/`);
  return fetch(url, {
    headers: accessHeaders,
    redirect: "follow",
    signal: AbortSignal.timeout(25000),
  });
}

async function readJson(response) {
  return response.json().catch(() => null);
}

function d1Results(command) {
  const payload = d1Execute(command);
  assert.ok(Array.isArray(payload) && payload.length >= 1, "D1 query returned an unexpected payload.");
  return payload[0]?.results ?? [];
}

function d1Execute(command) {
  const output = execFileSync(
    "npx",
    [
      "--yes",
      "wrangler@4.115.0",
      "d1",
      "execute",
      database,
      "--remote",
      "--json",
      `--command=${command}`,
    ],
    { encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] },
  );
  return JSON.parse(output);
}

function sqlString(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
