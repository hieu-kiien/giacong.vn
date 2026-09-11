import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  listAdminLeads,
  readAdminLead,
  type D1DatabaseLike,
  type D1PreparedStatementLike,
} from "../src/lib/admin-data.ts";

const root = new URL("../", import.meta.url);

async function read(relativePath: string): Promise<string> {
  return readFile(new URL(relativePath, root), "utf8");
}

type LeadRow = Record<string, unknown>;

class FakeLeadStatement implements D1PreparedStatementLike {
  private values: unknown[] = [];
  private readonly rows: LeadRow[];
  private readonly query: string;

  constructor(rows: LeadRow[], query: string) {
    this.rows = rows;
    this.query = query;
  }

  bind(...values: unknown[]): D1PreparedStatementLike {
    this.values = values;
    return this;
  }

  async all<T = Record<string, unknown>>(): Promise<{ results: T[] }> {
    void this.values;
    if (this.query.includes("COUNT")) return { results: [] };
    return { results: this.rows as T[] };
  }

  async first<T = Record<string, unknown>>(): Promise<T | null> {
    if (this.query.includes("COUNT")) return { total: this.rows.length } as T;
    return (this.rows[0] ?? null) as T | null;
  }

  async run(): Promise<unknown> {
    return undefined;
  }
}

class FakeLeadDatabase implements D1DatabaseLike {
  private readonly rows: LeadRow[];

  constructor(rows: LeadRow[]) {
    this.rows = rows;
  }

  prepare(query: string): D1PreparedStatementLike {
    return new FakeLeadStatement(this.rows, query);
  }
}

const failedRow: LeadRow = {
  assigned_to: null,
  company_name: "Cong ty ABC",
  country: "VN",
  created_at: "2026-08-30T01:00:00.000Z",
  delivered_at: null,
  delivery_attempts: 5,
  delivery_error: "secondary_sink_http_502",
  delivery_status: "failed",
  email: "demo@example.com",
  full_name: "Nguyen Demo",
  id: "11111111-1111-4111-8111-111111111111",
  message: "Can bao gia",
  phone: "0912345678",
  public_reference: "LEAD-1111111111",
  revision: 3,
  source: "request_form",
  status: "new",
  updated_at: "2026-08-30T02:00:00.000Z",
  webhook_reference: null,
};

const deliveredRow: LeadRow = {
  assigned_to: null,
  company_name: null,
  country: null,
  created_at: "2026-08-29T01:00:00.000Z",
  delivered_at: "2026-08-29T01:05:00.000Z",
  delivery_attempts: 1,
  delivery_error: null,
  delivery_status: "delivered",
  email: null,
  full_name: "Tran Khach",
  id: "22222222-2222-4222-8222-222222222222",
  message: null,
  phone: "0987654321",
  public_reference: "LEAD-2222222222",
  revision: 2,
  source: "request_form",
  status: "contacted",
  updated_at: "2026-08-29T01:05:00.000Z",
  webhook_reference: "YC-2026-0007",
};

test("danh sach lead giu hop dong cu va tra them 5 truong giao hang", async () => {
  const database = new FakeLeadDatabase([failedRow, deliveredRow]);
  const { leads, total } = await listAdminLeads(database, { page: 1, pageSize: 20 });

  assert.equal(total, 2);
  assert.equal(leads.length, 2);
  // Hop dong cu: cac truong hien co van con.
  assert.equal(leads[0]?.fullName, "Nguyen Demo");
  assert.equal(leads[0]?.deliveryStatus, "failed");
  assert.equal(leads[0]?.revision, 3);
  // 5 truong bo sung cho man Yeu cau bao gia.
  assert.equal(leads[0]?.publicReference, "LEAD-1111111111");
  assert.equal(leads[0]?.webhookReference, null);
  assert.equal(leads[0]?.deliveryError, "secondary_sink_http_502");
  assert.equal(leads[0]?.deliveryAttempts, 5);
  assert.equal(leads[0]?.deliveredAt, null);

  assert.equal(leads[1]?.webhookReference, "YC-2026-0007");
  assert.equal(leads[1]?.deliveryAttempts, 1);
  assert.equal(leads[1]?.deliveredAt, "2026-08-29T01:05:00.000Z");
});

test("doc mot lead tra them 5 truong giao hang", async () => {
  const database = new FakeLeadDatabase([failedRow]);
  const lead = await readAdminLead(database, "11111111-1111-4111-8111-111111111111");

  assert.ok(lead);
  assert.equal(lead.publicReference, "LEAD-1111111111");
  assert.equal(lead.webhookReference, null);
  assert.equal(lead.deliveryError, "secondary_sink_http_502");
  assert.equal(lead.deliveryAttempts, 5);
  assert.equal(lead.deliveredAt, null);
});

test("type client AdminLead co du 5 truong giao hang optional", async () => {
  const client = await read("src/lib/admin-client.ts");

  assert.match(client, /publicReference\?: string \| null/);
  assert.match(client, /webhookReference\?: string \| null/);
  assert.match(client, /deliveryError\?: string \| null/);
  assert.match(client, /deliveryAttempts\?: number;/);
  assert.match(client, /deliveredAt\?: string \| null/);
});

test("modal chi tiet hien Ma don va Chi tiet gui dung helper an toan", async () => {
  const page = await read("src/app/admin/yeu-cau/page.tsx");
  const modalStart = page.indexOf("detailLead ?");
  assert.notEqual(modalStart, -1);
  const modal = page.slice(modalStart);

  assert.match(modal, /Mã đơn/);
  assert.match(modal, /orderReference\(detailLead\)/);
  assert.match(modal, /Chi tiết gửi/);
  assert.match(modal, /deliveryDetailText\(detailLead\)/);
  assert.doesNotMatch(modal, /\{detailLead\.deliveryError\}/);
  assert.doesNotMatch(modal, /\{detailLead\.id\}/);
});

test("bang yeu cau co cot Ma don uu tien ma Google (YC-...) roi moi toi ma don (LEAD-...)", async () => {
  const page = await read("src/app/admin/yeu-cau/page.tsx");

  assert.match(page, /Mã đơn/);
  assert.match(page, /webhookReference\s*\|\|\s*[\w().]*publicReference/);
});

test("huy hieu gui loi/cho hien ly do tieng Viet don gian va so lan da thu", async () => {
  const page = await read("src/app/admin/yeu-cau/page.tsx");

  assert.match(page, /Google không nhận/);
  assert.match(page, /đã thử/);
  assert.match(page, /lần/);
  assert.match(page, /deliveryAttempts/);
});

test("man hinh khong in loi tho, UUID hay khoa bi mat ra giao dien", async () => {
  const page = await read("src/app/admin/yeu-cau/page.tsx");

  assert.doesNotMatch(page, /\{lead\.deliveryError\}/);
  assert.doesNotMatch(page, /\{lead\.id\}[^}]*Mã đơn/);
  assert.doesNotMatch(page, /GOOGLE_SHEETS_WEBHOOK_SECRET/);
  assert.doesNotMatch(page, /delivery_error/);
});
