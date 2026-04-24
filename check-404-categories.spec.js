const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

/**
 * CSV Reference: This test uses 'categories.csv' located in the root directory.
 * The CSV should contain a list of category URLs (one per line or comma-separated).
 * Target Website: https://www.woodenstreet.com
 */

test.describe('Check for 404 Category Pages', () => {
    const csvPath = path.join(__dirname, 'oc_category.csv');

    // Helper to read URLs from CSV
    const getUrlsFromCsv = () => {
        if (!fs.existsSync(csvPath)) {
            console.warn('Warning: categories.csv not found. Using an empty list.');
            return [];
        }
        const content = fs.readFileSync(csvPath, 'utf-8');
        console.log(content);
        return content
            .split(/\r?\n/)
            .map(line => line.trim())
            .filter(line => line.length > 0 && line.startsWith('http'));
    };

    const categoryUrls = getUrlsFromCsv();

    if (categoryUrls.length === 0) {
        test('No URLs found in CSV', () => {
            console.log('Please ensure categories.csv exists and contains full URLs.');
        });
    } else {
        for (const url of categoryUrls) {
            test(`Verify status for category: ${url}`, async ({ page }) => {
                console.log(`Checking: ${url}`);

                // Navigate to the URL and capture the response
                const response = await page.goto(url, { waitUntil: 'domcontentloaded' });

                // Check if the response status is 404
                const status = response.status();
                console.log(`Status code: ${status}`);

                // If the site uses a custom 404 page that returns 200, 
                // we also check for common 404 text in the heading
                const isNotFoundText = await page.locator('h1, h2').filter({ hasText: /Page Not Found|404/i }).count() > 0;

                expect.soft(status, `URL returned 404 status: ${url}`).not.toBe(404);
                expect.soft(isNotFoundText, `Page content indicates 404 for: ${url}`).toBe(false);
            });
        }
    }
});
