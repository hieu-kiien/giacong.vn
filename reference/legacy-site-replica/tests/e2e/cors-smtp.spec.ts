import { test, expect } from '@playwright/test';
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

const backendUrl = 'http://127.0.0.1:8002';

test.describe('CORS/SMTP - Tier 1: Feature Coverage', () => {
  test('CORS: Should allow origin http://localhost:3000', async ({ request }) => {
    const res = await request.get(`${backendUrl}/api/posts`, {
      headers: { 'Origin': 'http://localhost:3000' }
    });
    expect(res.status()).toBe(200);
    expect(res.headers()['access-control-allow-origin']).toBe('http://localhost:3000');
  });

  test('CORS: Should allow origin http://localhost:3001', async ({ request }) => {
    const res = await request.get(`${backendUrl}/api/posts`, {
      headers: { 'Origin': 'http://localhost:3001' }
    });
    expect(res.status()).toBe(200);
    expect(res.headers()['access-control-allow-origin']).toBe('http://localhost:3001');
  });

  test('CORS: Should allow origin http://localhost:3002', async ({ request }) => {
    const res = await request.get(`${backendUrl}/api/posts`, {
      headers: { 'Origin': 'http://localhost:3002' }
    });
    expect(res.status()).toBe(200);
    expect(res.headers()['access-control-allow-origin']).toBe('http://localhost:3002');
  });

  test('DB Persistence: Submitting a form successfully creates a row in the submissions table', async ({ request }) => {
    const initialCountStr = execSync('php artisan tinker --execute="echo App\\Models\\Submission::count();"', { cwd: './backend' }).toString().trim();
    const initialCount = parseInt(initialCountStr, 10);

    const testPayload = {
      'text-508': 'DB Persistence Test A',
      'tel-991': '0987654321',
      'textarea-859': 'Verifying database insertion via E2E test suite.',
      'path': '/lien-he'
    };

    const res = await request.post(`${backendUrl}/api/contact`, {
      data: testPayload
    });
    if (res.status() !== 201) {
      console.error('Test 4 POST failed:', res.status(), await res.text());
    }
    expect(res.status()).toBe(201);

    const finalCountStr = execSync('php artisan tinker --execute="echo App\\Models\\Submission::count();"', { cwd: './backend' }).toString().trim();
    const finalCount = parseInt(finalCountStr, 10);
    expect(finalCount).toBeGreaterThanOrEqual(initialCount + 1);

    // Verify properties of the specific row we just created
    const body = await res.json();
    const submissionId = body.data.id;
    expect(submissionId).toBeGreaterThan(0);

    const dbRowStr = execSync(`php artisan tinker --execute="print(json_encode(App\\Models\\Submission::find(${submissionId})));"`, { cwd: './backend' }).toString().trim();
    const dbRow = JSON.parse(dbRowStr);
    expect(dbRow.form_data['text-508']).toBe('DB Persistence Test A');
    expect(dbRow.path).toBe('/lien-he');
  });

  test('SMTP Log: Submitting form triggers email/submission log capture in laravel.log', async ({ request }) => {
    const logPath = path.resolve('backend/storage/logs/laravel.log');
    
    // Clear log or check size before
    let initialLogContent = '';
    if (fs.existsSync(logPath)) {
      initialLogContent = fs.readFileSync(logPath, 'utf8');
    }

    const testPayload = {
      'text-34': 'SMTP Log Test B',
      'tel-471': '0912345678',
      'path': '/tin-tuc'
    };

    await request.post(`${backendUrl}/api/contact`, {
      data: testPayload
    });

    // Read log again
    expect(fs.existsSync(logPath)).toBe(true);
    const finalLogContent = fs.readFileSync(logPath, 'utf8');
    
    // Check if new entry is written
    const diff = finalLogContent.substring(initialLogContent.length);
    expect(diff).toContain('New form submission captured:');
    expect(diff).toContain('SMTP Log Test B');
  });
});

test.describe('CORS/SMTP - Tier 2: Boundary & Edge Cases', () => {
  test('CORS: Disallow arbitrary/unknown origin http://localhost:4000', async ({ request }) => {
    const res = await request.get(`${backendUrl}/api/posts`, {
      headers: { 'Origin': 'http://localhost:4000' }
    });
    expect(res.status()).toBe(200);
    
    const allowedOrigin = res.headers()['access-control-allow-origin'];
    if (allowedOrigin) {
      expect(allowedOrigin).not.toBe('http://localhost:4000');
    }
  });

  test('CORS: Disallow malicious origin http://evil.com', async ({ request }) => {
    const res = await request.get(`${backendUrl}/api/posts`, {
      headers: { 'Origin': 'http://evil.com' }
    });
    expect(res.status()).toBe(200);
    
    const allowedOrigin = res.headers()['access-control-allow-origin'];
    if (allowedOrigin) {
      expect(allowedOrigin).not.toBe('http://evil.com');
    }
  });

  test('CORS: Request without Origin header passes normally without CORS headers', async ({ request }) => {
    const res = await request.get(`${backendUrl}/api/posts`);
    expect(res.status()).toBe(200);
    expect(res.headers()['access-control-allow-origin']).toBeUndefined();
  });

  test('CORS: Preflight Options request returns standard Allowed Methods and Allowed Headers', async ({ request }) => {
    const res = await request.fetch(`${backendUrl}/api/posts`, {
      method: 'OPTIONS',
      headers: {
        'Origin': 'http://localhost:3000',
        'Access-Control-Request-Method': 'GET',
        'Access-Control-Request-Headers': 'Content-Type'
      }
    });
    expect(res.status()).toBe(204);
    expect(res.headers()['access-control-allow-origin']).toBe('http://localhost:3000');
    expect(res.headers()['access-control-allow-methods']).toContain('GET');
  });

  test('DB Persistence: SQLite handles missing email and nullable parameters safely', async ({ request }) => {
    const testPayload = {
      'text-34': 'Nullable Email Test',
      'tel-471': '0911223344',
      // email-81 is omitted
      'path': '/'
    };

    const res = await request.post(`${backendUrl}/api/contact`, {
      data: testPayload
    });
    if (res.status() !== 201) {
      console.error('Test 10 POST failed:', res.status(), await res.text());
    }
    expect(res.status()).toBe(201);

    const body = await res.json();
    const submissionId = body.data.id;
    expect(submissionId).toBeGreaterThan(0);

    const dbRowStr = execSync(`php artisan tinker --execute="print(json_encode(App\\Models\\Submission::find(${submissionId})));"`, { cwd: './backend' }).toString().trim();
    const dbRow = JSON.parse(dbRowStr);
    expect(dbRow.form_data['text-34']).toBe('Nullable Email Test');
    expect(dbRow.form_data['email-81']).toBeUndefined();
  });
});
