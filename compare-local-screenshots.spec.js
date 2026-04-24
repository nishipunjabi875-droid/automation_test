const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

/**
 * 📸 SCREENSHOT COMPARISON SCRIPT 📸
 * 
 * This automation manually compares two existing screenshot files (Before and After).
 * It will notice every small detail like spacing, padding, buttons, and colors.
 * If any changes are found, Playwright will fail the test and generate a clear 
 * visual diff report.
 */

// =========================================================================
// ⚙️ CHANGE THESE PATHS TO YOUR SCREENSHOTS
// Provide the relative or absolute paths to your Before and After images.
// =========================================================================
const BEFORE_IMAGE_PATH = 'screenshots/before_production.png';
const AFTER_IMAGE_PATH = 'screenshots/after_production.png';
// =========================================================================

test.describe('Screenshot Comparison Tool', () => {

    test('Compare Before and After Production Screenshots', async ({ }, testInfo) => {

        // Resolve full absolute paths
        const beforePath = path.resolve(__dirname, BEFORE_IMAGE_PATH);
        const afterPath = path.resolve(__dirname, AFTER_IMAGE_PATH);

        // 1. Validation to ensure the files actually exist before we try to compare them
        expect(fs.existsSync(beforePath), `❌ Before image not found at: ${beforePath}`).toBeTruthy();
        expect(fs.existsSync(afterPath), `❌ After image not found at: ${afterPath}`).toBeTruthy();

        // 2. Read the "After" image into a buffer (this acts as the current state)
        const afterImageBuffer = fs.readFileSync(afterPath);

        // 3. Tell Playwright where to look for the baseline snapshot
        const snapshotName = 'production-comparison.png';
        const expectedSnapshotPath = testInfo.snapshotPath(snapshotName);

        // Ensure the Playwright snapshot directory exists, then copy the "Before" image there
        fs.mkdirSync(path.dirname(expectedSnapshotPath), { recursive: true });
        fs.copyFileSync(beforePath, expectedSnapshotPath);

        console.log(`🔍 Starting strict visual comparison...`);
        console.log(`   Baseline (Before): ${beforePath}`);
        console.log(`   Actual   (After) : ${afterPath}`);

        // 4. Perform the strict deep comparison
        // - maxDiffPixels: 0       => FAILS if even a SINGLE pixel is different! (Catches layout shifts, spacing, text).
        // - threshold: 0           => 0 tolerance for color variations. Perfect match only.
        // - maxDiffPixelRatio: 0   => Ensures 0% difference is allowed.
        expect(afterImageBuffer).toMatchSnapshot(snapshotName, {
            maxDiffPixels: 0,
            threshold: 0,
            maxDiffPixelRatio: 0
        });

        console.log('✅ Success! The images are completely 100% identical.');
    });

});
