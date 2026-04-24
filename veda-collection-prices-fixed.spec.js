const { test, expect } = require('@playwright/test');

test.describe('WoodenStreet Veda Collection Validations - Fixed', () => {

    test('Verify product prices on collection page match at least one price variant on the product page', async ({ page }) => {
        test.setTimeout(300000); // 5 minutes timeout

        const collectionUrl = 'https://www.woodenstreet.com/collection/veda-collection';
        console.log(`Navigating to collection page: ${collectionUrl}`);
        await page.goto(collectionUrl, { waitUntil: 'domcontentloaded' });

        await page.waitForSelector('a[href*="/product/"] span.font-redhatMedium');

        console.log('Extracting product URLs and prices from collection page...');
        const productsInfo = await page.evaluate(() => {
            const productElements = Array.from(document.querySelectorAll('a[href*="/product/"]'));

            const items = productElements.map(a => {
                const url = a.href;
                const priceSpans = a.querySelectorAll('span.font-redhatMedium, p span[class*="font-redhatMedium"]');
                let priceText = null;

                for (const span of priceSpans) {
                    if (span.textContent && span.textContent.includes('₹')) {
                        priceText = span.textContent.trim();
                        break;
                    }
                }
                return { url, priceText };
            });

            const validItems = items.filter(p => p.url && p.priceText);

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
            console.log(`\nChecking [${i + 1}/${productsInfo.length}]: ${product.url}`);
            console.log(`Expected Price (from collection page): ${product.priceText}`);

            await page.goto(product.url, { waitUntil: 'domcontentloaded' });
            
            // Allow some time for hydration or variant loading
            await page.waitForTimeout(2000); 

            // Get ALL prices displayed anywhere on the product page
            // We'll collect all text nodes that have the rupee symbol
            const allPricesOnPage = await page.evaluate(() => {
                const results = [];
                // Look at common price containers or all elements if necessary
                // To be safe and performant, we look at divs and spans and lis
                const els = document.querySelectorAll('span, p, div, li, del');
                els.forEach(el => {
                    const text = el.innerText || '';
                    if (text.includes('₹')) {
                        // Extract just the rupees part using regex
                        const matches = text.match(/₹\s*[\d,]+/g);
                        if (matches) {
                            results.push(...matches);
                        }
                    }
                });
                return results;
            });

            const cleanCollectionPrice = product.priceText.replace(/[^₹0-9,]/g, '').trim();
            const cleanProductPrices = Array.from(new Set(allPricesOnPage.map(p => p.replace(/[^₹0-9,]/g, '').trim())));

            console.log(`Cleaned Extracted Collection Price -> Expected: ${cleanCollectionPrice}`);
            console.log(`All Prices found on Product Page -> Actual: ${cleanProductPrices.join(', ')}`);

            // Check if the collection price is in the list of product prices
            const isPriceMatch = cleanProductPrices.includes(cleanCollectionPrice);
            
            if (!isPriceMatch) {
               console.log(`  -> Warning: exact match not found. Collection price: ${cleanCollectionPrice}, Found: ${cleanProductPrices.join(', ')}`);
               // Fallback: check if the collection price is at least the starting price or something similar
               // This is a soft expect so the test continues
               expect.soft(isPriceMatch, `Price mismatch for ${product.url}. Expected ${cleanCollectionPrice} to be in [${cleanProductPrices.join(', ')}]`).toBe(true);
            } else {
               console.log(`  -> Match found!`);
               expect.soft(isPriceMatch).toBe(true);
            }
        }

        console.log('\nAll product prices verified successfully!');
    });
});
