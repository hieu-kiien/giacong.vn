import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { insertCrmCustomerSchema } from "../src/lib/admin-crm-types.ts";

test("CRM Customer Payload Parser - enforces basic contract requirements", () => {
  const parsed = insertCrmCustomerSchema.safeParse({
    company_name: "Công ty Cổ phần Alpha",
    industry: "mechanical_cnc",
    phone: "0900000000",
  });
  assert.equal(parsed.success, true);
  if (parsed.success) {
    assert.equal(parsed.data.company_name, "Công ty Cổ phần Alpha");
    assert.equal(parsed.data.industry, "mechanical_cnc");
  }
});

test("CRM Customer Payload Parser - rejects invalid inputs", () => {
  const empty = insertCrmCustomerSchema.safeParse({});
  assert.equal(empty.success, false);

  const shortName = insertCrmCustomerSchema.safeParse({ company_name: "A", industry: "other" });
  assert.equal(shortName.success, false);
});

test("CRM Route capabilities - creation, timeline and concurrency locking", async () => {
  const [listRoute, detailRoute, timelineRoute] = await Promise.all([
    readFile(new URL("../src/app/api/admin/crm/customers/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/app/api/admin/crm/customers/[id]/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/app/api/admin/crm/customers/[id]/timeline/route.ts", import.meta.url), "utf8"),
  ]);

  // Customer List/Create Route
  assert.match(listRoute, /canManage\(guard\.member\.role,\s*"crm\.read"\)/, "Should enforce CRM read permission");
  assert.match(listRoute, /canManageCrm\(guard\.member\.role\)/, "Should enforce CRM manage permission");
  assert.match(listRoute, /INSERT INTO crm_customers/, "Should contain customer creation logic");
  
  // Customer Detail/Update Route
  assert.match(detailRoute, /STALE_WRITE/, "Should map concurrency collisions to STALE_WRITE");
  assert.match(detailRoute, /data\.revision !== existing\.revision/, "Should check revisions");
  assert.match(detailRoute, /revision = revision \+ 1/, "Should increment revision on write");

  // Timeline Route
  assert.match(timelineRoute, /INSERT INTO crm_timeline_events/, "Should contain timeline creation logic");
  assert.match(timelineRoute, /guard\.member\.id/, "Should track event author automatically");
});
