const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

/**
 * 📸 Dynamic Before and After Screenshot Comparison 📸
 * 
 * This script will:
 * 1. Navigate to a "Before" state (e.g., Production URL) and capture a screenshot in memory.
 * 2. Navigate to an "After" state (e.g., Staging URL, or perform an action like a click) and capture a screenshot.
 * 3. Save both screenshots to disk for manual viewing.
 * 4. Automatically compare the two screenshots using Playwright's strict visual comparison.
 */

test.describe('Dynamic Before and After Visual Regression', () => {

    test('Capture and Compare Before vs After states', async ({ page }, testInfo) => {

        // ============================================================
        // 1. CAPTURE "BEFORE" STATE
        // ============================================================
        const beforeUrl = 'https://www.woodenstreet.com/product/shriyam-modern-6-seater-sheesham-wood-dining-table-set-with-quartz-table-top-cane-brass-accents-teak-finish'; // <-- Change to your Production/Base URL
        console.log(`Navigating to BEFORE state: ${beforeUrl}`);
        await page.goto(beforeUrl, { waitUntil: 'domcontentloaded' });

        // (Optional) hide dynamic things like carousels before taking the screenshot
        // await page.evaluate(() => { document.querySelector('.carousel')?.remove(); });

        const beforeBuffer = await page.screenshot({
            fullPage: true,
            animations: 'disabled' // Disabling animations reduces flakiness
        });


        // ============================================================
        // 2. CAPTURE "AFTER" STATE
        // ============================================================
        // You can either change this to your Staging URL or perform actions (e.g., clicking a button).
        // const afterUrl = 'https://www.woodenstreet.com/furniture-store-bangalore'; // <-- Change to your Staging/New URL
        const afterUrl = 'https://beta.teamwoodenstreet.com/product/shriyam-modern-6-seater-sheesham-wood-dining-table-set-with-quartz-table-top-cane-brass-accents-teak-finish'; // <-- Change to your Staging/New URL

        console.log(`Navigating to AFTER state: ${afterUrl}`);
        await page.goto(afterUrl, { waitUntil: 'domcontentloaded' });

        const afterBuffer = await page.screenshot({
            fullPage: true,
            animations: 'disabled'
        });


        // ============================================================
        // 3. SAVE IMAGES TO DISK (For debugging / manual check)
        // ============================================================
        const screenshotsDir = path.join(__dirname, 'screenshots');
        if (!fs.existsSync(screenshotsDir)) {
            fs.mkdirSync(screenshotsDir, { recursive: true });
        }

        const beforeFilePath = path.join(screenshotsDir, 'auto-before.png');
        const afterFilePath = path.join(screenshotsDir, 'auto-after.png');

        fs.writeFileSync(beforeFilePath, beforeBuffer);
        fs.writeFileSync(afterFilePath, afterBuffer);
        console.log(`Saved screenshots for reference inside the 'screenshots' folder.`);


        // ============================================================
        // 4. COMPARE "BEFORE" AND "AFTER" AUTOMATICALLY
        // ============================================================
        console.log('Comparing the two screenshots...');

        // Define the snapshot name and let Playwright resolve where it expects the baseline snapshot.
        const snapshotName = 'dynamic-comparison.png';
        const expectedSnapshotPath = testInfo.snapshotPath(snapshotName);

        // We write our "Before" screenshot directly into the Playwright snapshot baseline directory.
        // This makes Playwright think this is the approved baseline.
        fs.mkdirSync(path.dirname(expectedSnapshotPath), { recursive: true });
        fs.writeFileSync(expectedSnapshotPath, beforeBuffer);

        // Now we take the "After" buffer and tell Playwright to compare it against the baseline.
        // If there are visual differences, the test will fail and generate a diff image in the playwright-report!
        expect(afterBuffer).toMatchSnapshot(snapshotName, {
            maxDiffPixels: 100, // Tolerance: Allow up to 100 pixels to be different to prevent extreme flakiness. 
            // you can change this to 0 if you want it to be STRICT
        });

        console.log('✅ Automated Visual Comparison Passed! The pages are identical.');
    });

});
