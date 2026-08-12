import { test, expect } from '@playwright/test';

const backendUrl = 'http://127.0.0.1:8002';

test.describe('Adversarial Security & Logic Tests (Tier 5)', () => {

  test.describe('Configurations API Unauthorized Access', () => {
    test('Attempt to POST to /api/configurations/brand_settings/draft anonymously should be blocked (401/403)', async ({ request }) => {
      const response = await request.post(`${backendUrl}/api/configurations/brand_settings/draft`, {
        data: {
          value: {
            company_name: 'Hacked Net Food Co',
            theme_color_primary: '#ff0000'
          }
        }
      });
      // We expect the response to be 401 Unauthorized or 403 Forbidden
      const status = response.status();
      console.log(`[Config Draft] Anonymous POST returned status: ${status}`);
      expect([401, 403]).toContain(status);
    });

    test('Attempt to POST to /api/configurations/brand_settings/publish anonymously should be blocked (401/403)', async ({ request }) => {
      const response = await request.post(`${backendUrl}/api/configurations/brand_settings/publish`);
      // We expect the response to be 401 Unauthorized or 403 Forbidden
      const status = response.status();
      console.log(`[Config Publish] Anonymous POST returned status: ${status}`);
      expect([401, 403]).toContain(status);
    });
  });

  test.describe('Contact Form Rate Limiter Bypass & Thresholds', () => {
    test('Rate Limiter: Threshold should be reasonably low (<= 10) to prevent DB bloat/spam', async ({ request }) => {
      const testPayload = {
        'text-508': 'Threshold Check',
        'tel-991': '0987654321',
        'textarea-859': 'Checking rate limit threshold.',
        'path': '/lien-he'
      };

      const response = await request.post(`${backendUrl}/api/contact`, {
        data: testPayload
      });
      
      const limitHeader = response.headers()['x-ratelimit-limit'];
      expect(limitHeader).toBeDefined();
      
      const limit = parseInt(limitHeader, 10);
      console.log(`[Rate Limit] Configured per-minute limit: ${limit}`);
      
      // A limit of 1000 is way too high for a contact form and constitutes a logic gap.
      expect(limit).toBeLessThanOrEqual(10);
    });

    test('Rate Limiter: X-Forwarded-For spoofing should not bypass rate limiting', async ({ request }) => {
      const testPayload = {
        'text-508': 'Spoofing Check 1',
        'tel-991': '0987654321',
        'textarea-859': 'Checking if X-Forwarded-For bypasses rate limit.',
        'path': '/lien-he'
      };

      // Request 1 with IP spoofed as 1.1.1.1
      const res1 = await request.post(`${backendUrl}/api/contact`, {
        headers: {
          'X-Forwarded-For': '1.1.1.1'
        },
        data: testPayload
      });
      expect(res1.status()).toBe(201);
      
      const remaining1Header = res1.headers()['x-ratelimit-remaining'];
      expect(remaining1Header).toBeDefined();
      const remaining1 = parseInt(remaining1Header, 10);

      // Request 2 with IP spoofed as 2.2.2.2
      const res2 = await request.post(`${backendUrl}/api/contact`, {
        headers: {
          'X-Forwarded-For': '2.2.2.2'
        },
        data: testPayload
      });
      expect(res2.status()).toBe(201);
      
      const remaining2Header = res2.headers()['x-ratelimit-remaining'];
      expect(remaining2Header).toBeDefined();
      const remaining2 = parseInt(remaining2Header, 10);

      console.log(`[Rate Limit Spoofing] Remaining (IP 1.1.1.1): ${remaining1}, Remaining (IP 2.2.2.2): ${remaining2}`);

      // If they are tracked separately, remaining2 will be equal to remaining1 (typically 999).
      // If they are tracked under the same client IP (e.g. 127.0.0.1 because proxy headers are ignored),
      // then remaining2 will be less than remaining1 (typically 998).
      // We expect the system to be secure against spoofing, meaning the rate limit is NOT bypassed.
      // So remaining2 should be less than remaining1.
      expect(remaining2).toBeLessThan(remaining1);
    });
  });

});
