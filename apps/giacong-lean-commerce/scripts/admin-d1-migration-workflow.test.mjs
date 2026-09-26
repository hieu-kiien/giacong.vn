import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const workflowUrl = new URL(
  "../../../.github/workflows/cloudflare-admin-d1-migrate-staging.yml",
  import.meta.url,
);

test("an already-applied D1 migration preserves existing admin audit history", async () => {
  const workflow = await readFile(workflowUrl, "utf8");

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
  const workflow = await readFile(workflowUrl, "utf8");

  assert.match(workflow, /id: before[\s\S]*?echo "already_applied=true"/);
  assert.match(workflow, /ALREADY_APPLIED:\s*\$\{\{\s*steps\.before\.outputs\.already_applied\s*\}\}/);
  assert.match(
    workflow,
    /if \[\[ "\$ALREADY_APPLIED" == "true" \]\]; then[\s\S]*?expected=1[\s\S]*?else[\s\S]*?expected=0[\s\S]*?fi/,
  );
  assert.match(workflow, /Verify revision columns match migration state/);
});

test("the one-off workflow only runs for the admin foundation migration", async () => {
  const workflow = await readFile(workflowUrl, "utf8");

  assert.equal(
    (workflow.match(/apps\/giacong-lean-commerce\/migrations\/0004_admin_foundation\.sql/g) ?? []).length,
    2,
  );
  assert.doesNotMatch(workflow, /apps\/giacong-lean-commerce\/migrations\/\*\*/);
});

test("the migration guard refuses unrelated pending files before D1 apply", async () => {
  const workflow = await readFile(workflowUrl, "utf8");

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
