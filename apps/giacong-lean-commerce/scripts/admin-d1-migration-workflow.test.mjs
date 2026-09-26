import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const workflowUrl = new URL(
  "../../../.github/workflows/cloudflare-admin-d1-migrate-staging.yml",
  import.meta.url,
);

async function readWorkflow() {
  return (await readFile(workflowUrl, "utf8")).replace(/\r\n/g, "\n");
}

test("an already-applied D1 migration preserves existing admin audit history", async () => {
  const workflow = await readWorkflow();

  assert.match(
    workflow,
    /ALREADY_APPLIED:\s*\$\{\{\s*steps\.before\.outputs\.already_applied\s*\}\}/,
  );
  assert.match(
    workflow,
    /if \[\[ "\$ALREADY_APPLIED" != "true" \]\]; then[\s\S]*?audit_rows[\s\S]*?= "0"[\s\S]*?fi/,
  );
});

test("the PR migration preflight accepts an already-applied staging migration", async () => {
  const workflow = await readWorkflow();

  assert.match(workflow, /id: before[\s\S]*?echo "already_applied=true"/);
  assert.match(workflow, /ALREADY_APPLIED:\s*\$\{\{\s*steps\.before\.outputs\.already_applied\s*\}\}/);
  assert.match(
    workflow,
    /if \[\[ "\$ALREADY_APPLIED" == "true" \]\]; then[\s\S]*?expected=1[\s\S]*?else[\s\S]*?expected=0[\s\S]*?fi/,
  );
  assert.match(workflow, /Verify revision columns match migration state/);
});

test("the one-off workflow only runs for the admin foundation migration", async () => {
  const workflow = await readWorkflow();

  assert.equal(
    (workflow.match(/apps\/giacong-lean-commerce\/migrations\/0004_admin_foundation\.sql/g) ?? []).length,
    2,
  );
  assert.doesNotMatch(workflow, /apps\/giacong-lean-commerce\/migrations\/\*\*/);
});

test("the migration guard refuses unrelated pending files before D1 apply", async () => {
  const workflow = await readWorkflow();

  assert.match(
    workflow,
    /Verify Wrangler sees only the intended pending migration[\s\S]*?pending=.*grep -oE.*\\\.sql[\s\S]*?test "\$pending" = "\$MIGRATION_NAME"/,
  );
  assert.match(
    workflow,
    /name: Apply pending migration with Wrangler\n        id: apply[\s\S]*?BEFORE_COUNTS: \$\{\{ steps\.before\.outputs\.business_counts \}\}[\s\S]*?test "\$names" = "0001_catalog\.sql\|0002_catalog_variant_options\.sql\|0003_services\.sql"[\s\S]*?test "\$audit_count" = "0"[\s\S]*?test "\$after" = "\$BEFORE_COUNTS"[\s\S]*?test "\$pending" = "\$MIGRATION_NAME"[\s\S]*?d1 migrations apply/,
  );
  assert.match(workflow, /ALREADY_APPLIED: \$\{\{ steps\.apply\.outputs\.already_applied \|\| steps\.before\.outputs\.already_applied \}\}/);
});

const slugMigrationWorkflowUrl = new URL(
  "../../../.github/workflows/cloudflare-staging-product-slug-migration.yml",
  import.meta.url,
);
const slugMigrationWranglerWorkingDirectory = "apps/giacong-lean-commerce";

async function readSlugMigrationWorkflow() {
  return (await readFile(slugMigrationWorkflowUrl, "utf8")).replace(/\r\n/g, "\n");
}

test("product slug migration is an opt-in, staging-only workflow", async () => {
  const workflow = await readSlugMigrationWorkflow();

  assert.match(workflow, /workflow_dispatch:[\s\S]*?apply_migration:[\s\S]*?default:\s*false/);
  assert.match(workflow, /if:\s*\$\{\{\s*inputs\.apply_migration\s*\}\}/);
  assert.match(workflow, /DATABASE_NAME:\s*giacong-vn-catalog-staging/);
  assert.match(workflow, /MIGRATION_NAME:\s*0031_product_slug_redirects\.sql/);
  assert.doesNotMatch(workflow, /production|versions deploy/i);
});

test("staging D1 migration runs Wrangler from the app workspace", async () => {
  const workflow = await readSlugMigrationWorkflow();

  assert.match(workflow, /migrate:[\s\S]*?defaults:\s*\n\s*run:\s*\n\s*working-directory:\s*/);
  assert.match(workflow, new RegExp(slugMigrationWranglerWorkingDirectory.replaceAll("/", "\\/")));
});

test("product slug migration exports a backup and verifies counts before and after", async () => {
  const workflow = await readSlugMigrationWorkflow();

  const snapshotStep = workflow.indexOf("name: Capture D1 baseline and export backup");
  const applyStep = workflow.indexOf("name: Recheck state and apply only migration 0031");
  const verificationStep = workflow.indexOf("name: Verify schema, integrity, and unchanged business counts");

  assert.ok(snapshotStep >= 0 && applyStep > snapshotStep && verificationStep > applyStep);
  assert.match(workflow, /test "\$pending" = "\$MIGRATION_NAME"/);
  assert.match(workflow, /d1 export "\$DATABASE_NAME" --remote --env staging --output "\$snapshot"/);
  assert.match(workflow, /sha256sum "\$snapshot"/);
  assert.match(workflow, /test "\$current_counts" = "\$BEFORE_COUNTS"/);
  assert.match(workflow, /test "\$\(echo "\$current" \| jq -r '\.\[8\]\.results\[0\]\.redirect_table_count'\)" = "0"/);
  assert.match(workflow, /d1 migrations apply "\$DATABASE_NAME" --remote --env staging/);
  assert.match(workflow, /test "\$after_counts" = "\$BEFORE_COUNTS"/);
  assert.match(workflow, /PRAGMA integrity_check/);
  assert.match(workflow, /PRAGMA foreign_key_check/);
});

const stagingUploadWorkflowUrl = new URL(
  "../../../.github/workflows/cloudflare-staging-upload-once.yml",
  import.meta.url,
);

async function readStagingUploadWorkflow() {
  return (await readFile(stagingUploadWorkflowUrl, "utf8")).replace(/\r\n/g, "\n");
}

test("staging upload checks R2 access before installing and building the app", async () => {
  const workflow = await readStagingUploadWorkflow();

  const r2Probe = workflow.indexOf("name: Verify staging R2 cache bucket access");
  const dependencyInstall = workflow.indexOf("name: Install dependencies");
  const upload = workflow.indexOf("name: Upload new OpenNext staging version without serving traffic");

  assert.ok(r2Probe >= 0 && r2Probe < dependencyInstall && dependencyInstall < upload);
  assert.match(workflow, /WRANGLER_VERSION:\s*"4\.131\.1"/);
  assert.match(workflow, /actions\/checkout@v5/);
  assert.match(workflow, /actions\/setup-node@v5/);
  assert.match(workflow, /r2 bucket info giacong-vn-next-cache-staging --json/);
});
