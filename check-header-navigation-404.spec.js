const { test, expect } = require('@playwright/test');

test.describe('Header Navigation 404 Check', () => {
    const baseUrl = 'https://www.woodenstreet.com/';
    let categoryLinks = [];

    // Capture links before running tests
    test.beforeAll(async ({ browser }) => {
        const page = await browser.newPage();
        console.log(`Navigating to: ${baseUrl}`);
        await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });

        // Wait for the header to be visible
        await page.waitForSelector('header', { timeout: 15000 });

        // Capture all unique category links present in the header navigation
        categoryLinks = await page.evaluate(() => {
            const header = document.querySelector('header');
            if (!header) return [];

            const links = Array.from(header.querySelectorAll('a[href]'));
            
            const results = links.map(a => ({
                name: a.innerText.replace(/\n/g, ' ').trim(),
                url: a.href
            })).filter(link => {
                const isHttp = link.url.startsWith('http');
                const isNotUtility = !link.url.includes('track-order') && 
                                   !link.url.includes('help-center') && 
                                   !link.url.includes('cart') && 
                                   !link.url.includes('profile');
                const hasName = link.name.length > 0;
                return isHttp && isNotUtility && hasName;
            });

            // Deduplicate by URL within the browser context
            const unique = [];
            const seen = new Set();
            for (const item of results) {
                if (!seen.has(item.url)) {
                    seen.add(item.url);
                    unique.push(item);
                }
            }
            return unique;
        });

        console.log(`Found ${categoryLinks.length} unique category links in the header.`);
        await page.close();
    });

    test('Verify all header links do not return 404 status', async ({ request }) => {
        if (categoryLinks.length === 0) {
            console.log('No links were captured to check.');
            return;
        }

        const brokenLinks = [];
        const workingLinks = [];

        console.log(`Starting status check for ${categoryLinks.length} links...`);

        // Check links one by one to avoid overwhelming the server and handle failures gracefully
        for (const link of categoryLinks) {
            try {
                // Optimized check using request context (HEAD or GET)
                const response = await request.get(link.url);
                const status = response.status();

                if (status === 404) {
                    console.log(`[BROKEN] 404 - ${link.name}: ${link.url}`);
                    brokenLinks.push(link);
                } else {
                    console.log(`[OK] ${status} - ${link.name}: ${link.url}`);
                    workingLinks.push(link);
                }
            } catch (error) {
                console.log(`[ERROR] Failed to check ${link.url}: ${error.message}`);
                brokenLinks.push({ ...link, error: error.message });
            }
        }

        // Final report to console
        console.log('\n=============================================');
        console.log('          HEADER LINKS VALIDATION REPORT       ');
        console.log('=============================================');
        console.log(`Total Links Checked: ${categoryLinks.length}`);
        console.log(`Working Links:       ${workingLinks.length}`);
        console.log(`Broken Links (404):  ${brokenLinks.length}`);
        console.log('---------------------------------------------');

        if (brokenLinks.length > 0) {
            console.log('\nLIST OF BROKEN LINKS:');
            brokenLinks.forEach((link, index) => {
                console.log(`${index + 1}. Name: ${link.name}`);
                console.log(`   URL:  ${link.url}`);
                if (link.error) console.log(`   Issue: ${link.error}`);
            });
            console.log('---------------------------------------------');
        } else {
            console.log('\nSUCCESS: All header category links are working!');
        }
        console.log('=============================================\n');

        // Fail the test if broken links were found
        expect(brokenLinks.length, `Found ${brokenLinks.length} broken links in header.`).toBe(0);
    });
});

