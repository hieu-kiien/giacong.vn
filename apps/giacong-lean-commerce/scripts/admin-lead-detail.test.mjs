import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

async function source(path) {
  return readFile(new URL(path, root), "utf8");
}

test("Admin lead detail API remains read-only and loads canonical D1 detail", async () => {
  const [route, data] = await Promise.all([
    source("src/app/api/admin/leads/[id]/route.ts"),
    source("src/lib/admin-lead-detail-data.ts"),
  ]);

  assert.match(route, /export async function GET/);
  assert.match(route, /getAdminLeadDetail\(guard\.database, id\)/);
  assert.match(route, /requireAdmin/);
  assert.match(data, /public_reference/);
  assert.match(data, /request_id/);
  assert.match(data, /payload_json/);
  assert.match(data, /FROM lead_items/);
  assert.match(data, /snapshot_json/);
  assert.match(data, /FROM lead_events/);
  assert.match(data, /LIMIT 50/);
  assert.doesNotMatch(data, /UPDATE leads|INSERT INTO|DELETE FROM/);
});

test("Admin lead detail UI renders stored payload as text and does not mutate", async () => {
  const [page, inbox] = await Promise.all([
    source("src/app/admin/yeu-cau/[id]/page.tsx"),
    source("src/app/admin/yeu-cau/page.tsx"),
  ]);

  assert.match(inbox, /href=\{`\/admin\/yeu-cau\/\$\{lead\.id\}`\}/);
  assert.match(page, /fetchAdmin<\{ lead: LeadDetail \}>\(`\/api\/admin\/leads\/\$\{leadId\}`/);
  assert.match(page, /lead\.items/);
  assert.match(page, /lead\.events/);
  assert.match(page, /JSON\.stringify\(lead\.payload, null, 2\)/);
  assert.doesNotMatch(page, /dangerouslySetInnerHTML|__html/);
  assert.doesNotMatch(page, /mutateAdmin|method:\s*"PATCH"|method:\s*"POST"|method:\s*"DELETE"/);
});
