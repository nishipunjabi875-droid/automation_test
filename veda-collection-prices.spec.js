const { test, expect } = require('@playwright/test');

test.describe('WoodenStreet Veda Collection Validations', () => {

    test('Verify product prices on collection page match the product page', async ({ page }) => {
        test.setTimeout(300000); // 5 minutes timeout to ensure we can check multiple products

        const collectionUrl = 'https://www.woodenstreet.com/collection/veda-collection';
        console.log(`Navigating to collection page: ${collectionUrl}`);
        await page.goto(collectionUrl, { waitUntil: 'domcontentloaded' });

        // Wait for product links to appear
        await page.waitForSelector('a[href*="/product/"] span.font-redhatMedium');

        console.log('Extracting product URLs and prices from collection page...');
        // Extract all product links and their corresponding displayed prices.
        // We use evaluate to safely query the DOM and return a clean array of objects.
        const productsInfo = await page.evaluate(() => {
            const productElements = Array.from(document.querySelectorAll('a[href*="/product/"]'));

            // Map over elements and find prices
            const items = productElements.map(a => {
                const url = a.href;
                // Look for the element that holds the actual selling price, which is standard in this structure.
                const priceSpans = a.querySelectorAll('span.font-redhatMedium, p span[class*="font-redhatMedium"]');
                let priceText = null;

                // Usually the first matching span has the effective price.
                for (const span of priceSpans) {
                    if (span.textContent && span.textContent.includes('₹')) {
                        priceText = span.textContent.trim();
                        break;
                    }
                }
                return { url, priceText };
            });

            // Filter out items that don't have a valid url or price, and remove duplicates just in case
            const validItems = items.filter(p => p.url && p.priceText);

            // Deduplicate by URL
            const uniqueUrls = new Set();
            const deduplicated = [];
            for (const item of validItems) {
                if (!uniqueUrls.has(item.url)) {
                    uniqueUrls.add(item.url);
                    deduplicated.push(item);
                }
            }
            return deduplicated;
        });

        console.log(`Found ${productsInfo.length} unique products on the collection page.`);
        expect(productsInfo.length).toBeGreaterThan(0);

        // Iterate through each product link to verify price consistency
        for (let i = 0; i < productsInfo.length; i++) {
            const product = productsInfo[i];
            console.log(`Checking [${i + 1}/${productsInfo.length}]: ${product.url}`);
            console.log(`Expected Price (from collection page): ${product.priceText}`);

            // Navigate to the product page
            await page.goto(product.url, { waitUntil: 'domcontentloaded' });

            // Wait for the product page price to appear
            // The product page price usually has class `.offerprice` or `text-font22`
            const priceLocator = page.locator('.offerprice, span.text-font22').filter({ hasText: '₹' }).first();
            await priceLocator.waitFor({ state: 'visible', timeout: 15000 }).catch(() => {
                console.log(`Warning: Could not quickly find the price element for ${product.url}`);
            });

            const productPagePriceText = await priceLocator.innerText();
            console.log(`Actual Price (from product page): ${productPagePriceText}`);

            // Assert that the price text matches closely. We strip out unnecessary spaces or 'incl. of all taxes' strings
            const cleanCollectionPrice = product.priceText.replace(/[^₹0-9,]/g, '').trim();
            const cleanProductPrice = productPagePriceText.replace(/[^₹0-9,]/g, '').trim();

            console.log(`Cleaned Extracted Prices -> Expected: ${cleanCollectionPrice}, Actual: ${cleanProductPrice}`);
            expect.soft(cleanProductPrice, `Price mismatch for ${product.url}`).toBe(cleanCollectionPrice);
        }

        console.log('All product prices verified successfully!');
    });
});
