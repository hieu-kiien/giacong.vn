import { test, expect } from '@playwright/test';

test.describe('Form Submissions - Tier 1: Feature Coverage', () => {
  test('Should submit Form 1 (Contact Form) on /lien-he successfully with valid inputs', async ({ page }) => {
    await page.goto('/lien-he');
    await page.waitForFunction(() => typeof (window as any).wpcf7 !== 'undefined');
    await page.waitForTimeout(1500);

    // Setup dialog listener to accept success alert
    let dialogTriggered = false;
    page.on('dialog', async dialog => {
      const msg = dialog.message().toLowerCase();
      expect(msg.includes('thành công') || msg.includes('successfully')).toBe(true);
      dialogTriggered = true;
      await dialog.accept();
    });

    await page.locator('input[name="text-508"]').fill('Nguyễn Văn A');
    await page.locator('input[name="tel-991"]').fill('0987654321');
    await page.locator('input[name="email-81"]').fill('test@example.com');
    await page.locator('textarea[name="textarea-859"]').fill('Tôi muốn báo giá gia công sấy');

    // Click submit
    await page.locator('.wpcf7-submit').click();

    // Verify dialog was accepted and input fields were reset
    await expect.poll(() => dialogTriggered).toBe(true);
    await expect(page.locator('input[name="text-508"]')).toHaveValue('');
    await expect(page.locator('input[name="tel-991"]')).toHaveValue('');
  });

  test('Should submit Form 2 (Quotation Form) on homepage successfully with valid inputs', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => typeof (window as any).wpcf7 !== 'undefined');
    await page.waitForTimeout(1500);
 
    let dialogTriggered = false;
    page.on('dialog', async dialog => {
      const msg = dialog.message().toLowerCase();
      expect(msg.includes('thành công') || msg.includes('successfully')).toBe(true);
      dialogTriggered = true;
      await dialog.accept();
    });
 
    const inputName = page.locator('input[name="text-34"]:visible');
    const inputTel = page.locator('input[name="tel-471"]:visible');
    const form = inputName.locator('xpath=ancestor::form');

    await inputName.fill('Nguyễn Văn B');
    await inputTel.fill('0901234567');

    await form.locator('.wpcf7-submit').click();

    await expect.poll(() => dialogTriggered).toBe(true);
    await expect(inputName).toHaveValue('');
    await expect(inputTel).toHaveValue('');
  });

  test('Form submissions include current client-side route path in payload', async ({ page }) => {
    await page.goto('/lien-he');
    await page.waitForFunction(() => typeof (window as any).wpcf7 !== 'undefined');
    await page.waitForTimeout(1500);

    // Intercept POST request to /api/contact to inspect payload
    const [request] = await Promise.all([
      page.waitForRequest(req => req.url().includes('/api/contact') && req.method() === 'POST'),
      (async () => {
        // Accept success dialog to complete flow
        page.on('dialog', async dialog => {
          await dialog.accept();
        });
        await page.locator('input[name="text-508"]').fill('Path Verification');
        await page.locator('input[name="tel-991"]').fill('0987654321');
        await page.locator('textarea[name="textarea-859"]').fill('Checking referrer path');
        await page.locator('.wpcf7-submit').click();
      })()
    ]);

    const postData = JSON.parse(request.postData() || '{}');
    expect(postData.path).toBe('/lien-he');
  });

  test('Form 1 submit button is disabled and text is "Đang gửi..." during request', async ({ page }) => {
    // Block API route temporarily to observe loading state
    await page.route('**/api/contact', async route => {
      await new Promise(resolve => setTimeout(resolve, 1000));
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, message: 'thành công' }),
      });
    });

    await page.goto('/lien-he');
    await page.waitForFunction(() => typeof (window as any).wpcf7 !== 'undefined');
    await page.waitForTimeout(1500);
    await page.locator('input[name="text-508"]').fill('Loading Check');
    await page.locator('input[name="tel-991"]').fill('0987654321');
    await page.locator('textarea[name="textarea-859"]').fill('Checking loading spinner text');

    // Listen to dialog to accept
    page.on('dialog', async dialog => {
      await dialog.accept();
    });

    const submitBtn = page.locator('.wpcf7-submit');
    await submitBtn.click();

    // Verify disabled and text is changed to "Đang gửi..."
    await expect(submitBtn).toBeDisabled();
    const btnValue = await submitBtn.getAttribute('value');
    expect(btnValue).toBe('Đang gửi...');
  });

  test('Form 2 submit button is disabled and text is "Đang gửi..." during request', async ({ page }) => {
    await page.route('**/api/contact', async route => {
      await new Promise(resolve => setTimeout(resolve, 1000));
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, message: 'thành công' }),
      });
    });

    await page.goto('/');
    await page.waitForFunction(() => typeof (window as any).wpcf7 !== 'undefined');
    await page.waitForTimeout(1500);
    const inputName = page.locator('input[name="text-34"]:visible');
    const inputTel = page.locator('input[name="tel-471"]:visible');
    const form = inputName.locator('xpath=ancestor::form');

    await inputName.fill('Loading Check 2');
    await inputTel.fill('0901234567');

    page.on('dialog', async dialog => {
      await dialog.accept();
    });

    const submitBtn = form.locator('.wpcf7-submit');
    await submitBtn.click();

    await expect(submitBtn).toBeDisabled();
    const btnValue = await submitBtn.getAttribute('value');
    expect(btnValue).toBe('Đang gửi...');
  });
});

test.describe('Form Submissions - Tier 2: Boundary & Edge Cases', () => {
  test('Form 1 validation - Missing Họ và Tên triggers alert', async ({ page }) => {
    await page.goto('/lien-he');
    await page.waitForFunction(() => typeof (window as any).wpcf7 !== 'undefined');
    await page.waitForTimeout(1500);
    
    let alertMsg = '';
    page.on('dialog', async dialog => {
      alertMsg = dialog.message();
      await dialog.accept();
    });

    await page.locator('input[name="tel-991"]').fill('0987654321');
    await page.locator('textarea[name="textarea-859"]').fill('Checking missing name');
    await page.locator('.wpcf7-submit').click();

    expect(alertMsg).toBe('Vui lòng nhập họ và tên của bạn.');
  });

  test('Form 1 validation - Missing Số điện thoại triggers alert', async ({ page }) => {
    await page.goto('/lien-he');
    await page.waitForFunction(() => typeof (window as any).wpcf7 !== 'undefined');
    await page.waitForTimeout(1500);
    
    let alertMsg = '';
    page.on('dialog', async dialog => {
      alertMsg = dialog.message();
      await dialog.accept();
    });

    await page.locator('input[name="text-508"]').fill('Nguyễn Văn A');
    await page.locator('textarea[name="textarea-859"]').fill('Checking missing phone');
    await page.locator('.wpcf7-submit').click();

    expect(alertMsg).toBe('Vui lòng nhập số điện thoại liên hệ.');
  });

  test('Form 1 validation - Missing Nội dung yêu cầu triggers alert', async ({ page }) => {
    await page.goto('/lien-he');
    await page.waitForFunction(() => typeof (window as any).wpcf7 !== 'undefined');
    await page.waitForTimeout(1500);
    
    let alertMsg = '';
    page.on('dialog', async dialog => {
      alertMsg = dialog.message();
      await dialog.accept();
    });

    await page.locator('input[name="text-508"]').fill('Nguyễn Văn A');
    await page.locator('input[name="tel-991"]').fill('0987654321');
    await page.locator('.wpcf7-submit').click();

    expect(alertMsg).toBe('Vui lòng nhập nội dung yêu cầu.');
  });

  test('Form 2 validation - Missing Họ và Tên triggers alert', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => typeof (window as any).wpcf7 !== 'undefined');
    await page.waitForTimeout(1500);
    
    let alertMsg = '';
    page.on('dialog', async dialog => {
      alertMsg = dialog.message();
      await dialog.accept();
    });

    const inputName = page.locator('input[name="text-34"]:visible');
    const inputTel = page.locator('input[name="tel-471"]:visible');
    const form = inputName.locator('xpath=ancestor::form');

    await inputTel.fill('0901234567');
    await form.locator('.wpcf7-submit').click();

    await expect.poll(() => alertMsg).toBe('Vui lòng nhập họ và tên của bạn.');
  });

  test('Form 2 validation - Missing Số điện thoại triggers alert', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => typeof (window as any).wpcf7 !== 'undefined');
    await page.waitForTimeout(1500);
    
    let alertMsg = '';
    page.on('dialog', async dialog => {
      alertMsg = dialog.message();
      await dialog.accept();
    });

    const inputName = page.locator('input[name="text-34"]:visible');
    const form = inputName.locator('xpath=ancestor::form');

    await inputName.fill('Nguyễn Văn B');
    await form.locator('.wpcf7-submit').click();

    await expect.poll(() => alertMsg).toBe('Vui lòng nhập số điện thoại liên hệ.');
  });
});
