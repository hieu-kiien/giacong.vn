import { test, expect } from '@playwright/test';
import { execSync } from 'child_process';

const backendUrl = 'http://127.0.0.1:8002';

test.describe('Adversarial Sanitization & Path Traversal (Tier 5)', () => {
  
  test('Input Sanitization & Stored XSS: Submit contact payload with XSS script path', async ({ request }) => {
    // 1. Submit a contact payload with path containing XSS payload
    const xssPayload = '<script>alert("XSS")</script>';
    const testPayload = {
      'text-508': 'XSS Challenger User',
      'tel-991': '0987654321',
      'textarea-859': 'Verifying stored XSS vulnerability on path parameter.',
      'path': xssPayload
    };

    const res = await request.post(`${backendUrl}/api/contact`, {
      data: testPayload
    });

    // Check if the submission succeeded or was rejected
    console.log(`[XSS Test] Response code: ${res.status()}`);
    expect([201, 400, 422, 403]).toContain(res.status());

    if (res.status() === 201) {
      const body = await res.json();
      const submissionId = body.data.id;
      expect(submissionId).toBeGreaterThan(0);

      // Check the stored path in SQLite via artisan tinker
      const dbRowStr = execSync(
        `php artisan tinker --execute="print(json_encode(App\\Models\\Submission::find(${submissionId})));"`,
        { cwd: './backend' }
      ).toString().trim();
      
      const dbRow = JSON.parse(dbRowStr);
      console.log(`[XSS Test] Stored path in DB: ${dbRow.path}`);
      
      // If it is stored as-is (contains the raw script tag), it indicates a stored XSS vulnerability.
      // We expect the application to have sanitized/escaped the input, hence it should NOT match the raw payload.
      expect(dbRow.path).not.toBe(xssPayload);
    } else {
      console.log(`[XSS Test] Input sanitization/XSS submission was blocked with status ${res.status()}`);
    }
  });

  test('Route Path Traversal: Query nested path segments', async ({ request }) => {
    // Query nested path segments to verify the application rejects traversal attempts and returns a standard 404
    const traversalPayloads = [
      '/....//....//package.json',
      '/%252e%252e%252fpackage.json',
      '/../package.json',
      '/..%2fpackage.json',
      '/%2e%2e/package.json',
      '/%2e%2e%2fpackage.json',
      '/%252e%252e%252fpartials%252fheader', // Point to existing EJS partial to check active traversal
    ];

    for (const payload of traversalPayloads) {
      const res = await request.get(payload);
      console.log(`[Path Traversal] Query ${payload} -> Status: ${res.status()}`);
      
      // We expect the application to reject traversal attempts and return a standard 404
      expect(res.status()).toBe(404);
    }
  });

});
