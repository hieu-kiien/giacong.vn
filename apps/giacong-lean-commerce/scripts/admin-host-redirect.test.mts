import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getStagingAdminEntryRedirect } from '../src/lib/admin-host-redirect.ts';

test('staging admin root opens the admin entry and retains query state', () => {
  for (const method of ['GET', 'HEAD']) {
    assert.equal(getStagingAdminEntryRedirect(new Request('https://admin-staging.kienhieu.id.vn/?next=products', { method })), 'https://admin-staging.kienhieu.id.vn/admin/?next=products');
  }
});
test('redirect leaves storefront, production, API, admin paths and writes untouched', () => {
  for (const url of ['https://staging.kienhieu.id.vn/', 'https://admin.kienhieu.id.vn/', 'https://kienhieu.id.vn/', 'https://admin-staging.kienhieu.id.vn/admin/', 'https://admin-staging.kienhieu.id.vn/api/admin/session', 'https://admin-staging.kienhieu.id.vn/tai-khoan/dang-nhap/']) {
    assert.equal(getStagingAdminEntryRedirect(new Request(url)), null);
  }
  assert.equal(getStagingAdminEntryRedirect(new Request('https://admin-staging.kienhieu.id.vn/', { method: 'POST' })), null);
});
