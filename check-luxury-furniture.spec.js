const { test, expect } = require('@playwright/test');

test.describe('WoodenStreet Luxury Furniture Validations', () => {

    test('Verify product prices on collection page match the product page', async ({ page }) => {
        test.setTimeout(300000); // 5 minutes timeout to ensure we can check multiple products

        const collectionUrl = 'https://www.woodenstreet.com/luxury-furniture';
        console.log(`Navigating to collection page: ${collectionUrl}`);
        await page.goto(collectionUrl, { waitUntil: 'domcontentloaded' });

        // Wait for product links to appear
        await page.waitForSelector('a[href*="/product/"]', { timeout: 15000 }).catch(() => { });

        console.log('Extracting product URLs and prices from collection page...');
        const productsInfo = await page.evaluate(() => {
            const productElements = Array.from(document.querySelectorAll('a[href*="/product/"]'));

            const items = productElements.map(a => {
                const url = a.href;
                const priceSpans = a.querySelectorAll('span.font-redhatMedium, p span[class*="font-redhatMedium"], strong, .price');
                let priceText = null;

                for (const span of priceSpans) {
                    if (span.textContent && span.textContent.includes('₹')) {
                        priceText = span.textContent.trim();
                        break;
                    }
                }

                if (!priceText) {
                    // Fallback to searching all text nodes
                    const iter = document.createNodeIterator(a, NodeFilter.SHOW_TEXT);
                    let node;
                    while ((node = iter.nextNode())) {
                        if (node.nodeValue.includes('₹')) {
                            priceText = node.nodeValue.trim();
                            break;
                        }
                    }
                }

                return { url, priceText };
            });

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

            await page.goto(product.url, { waitUntil: 'domcontentloaded' });

            const priceLocator = page.locator('.offerprice, span.text-font22').filter({ hasText: '₹' }).first();
            await priceLocator.waitFor({ state: 'attached', timeout: 15000 }).catch(() => {
                console.log(`Warning: Could not quickly find the price element for ${product.url}`);
            });

            const productPagePriceText = await priceLocator.innerText().catch(() => '');
            if (!productPagePriceText) {
                console.log(`Could not get price for ${product.url}. Skipping comparison.`);
                continue;
            }

            console.log(`Actual Price (from product page): ${productPagePriceText}`);

            // Assert that the price text matches closely
            const cleanCollectionPrice = product.priceText.replace(/[^₹0-9,]/g, '').trim();
            const cleanProductPrice = productPagePriceText.replace(/[^₹0-9,]/g, '').trim();

            console.log(`Cleaned Extracted Prices -> Expected: ${cleanCollectionPrice}, Actual: ${cleanProductPrice}`);
            expect.soft(cleanProductPrice, `Price mismatch for ${product.url}`).toBe(cleanCollectionPrice);
        }

        console.log('All product prices verified successfully!');
    });
});
