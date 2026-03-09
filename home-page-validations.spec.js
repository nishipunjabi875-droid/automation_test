const { test, expect } = require('@playwright/test');

test.describe('WoodenStreet Home Page Validations', () => {

    test('Verify home page loads successfully and key elements are present', async ({ page }) => {
        const homeUrl = 'https://www.woodenstreet.com/';
        console.log(`Navigating to home page: ${homeUrl}`);

        // Navigate to the home page
        const response = await page.goto(homeUrl, { waitUntil: 'domcontentloaded' });

        // Verify the page loaded successfully (status 200)
        expect(response.status()).toBe(200);

        // Verify the title of the home page
        const title = await page.title();
        console.log(`Page Title: ${title}`);
        expect(title.length).toBeGreaterThan(0);

        // Verify that the main navigation or logo is visible
        // You can update this selector based on the exact header logo or navigation class
        const logo = page.locator('img[alt*="Woodenstreet"], .logo, header img').first();
        await expect(logo).toBeVisible({ timeout: 15000 });

        console.log('Home page validated successfully!');
    });

    // You can add more tests here, for example:
    // test('Verify all header links return 200 status', async ({ page }) => { ... });

});
