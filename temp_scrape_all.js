const { chromium } = require('playwright');

(async () => {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();

    const urls = [
        'https://www.woodenstreet.com/luxury-furniture',
        'https://www.woodenstreet.com/collection/udaipur',
        'https://www.woodenstreet.com/collection/tarash',
        'https://www.woodenstreet.com/collection/aligne'
    ];

    for (const url of urls) {
        console.log(`\\n--- Testing URL: ${url} ---`);
        try {
            await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
            await page.waitForTimeout(3000); // Wait for potential dynamic loads

            const productsInfo = await page.evaluate(() => {
                const productElements = Array.from(document.querySelectorAll('a[href*="/product/"]'));
                const items = productElements.map(a => {
                    const href = a.href;
                    // For luxury furniture it might be different, let's look for standard price markers
                    // including the current site span and strong elements 
                    const priceSpans = a.querySelectorAll('span.font-redhatMedium, p span[class*="font-redhatMedium"], strong, .price');
                    let priceText = null;

                    for (const span of priceSpans) {
                        if (span.textContent && span.textContent.includes('₹')) {
                            priceText = span.textContent.trim();
                            break;
                        }
                    }
                    // For luxury-furniture, sometimes prices are directly in text nodes or div
                    if (!priceText) {
                        const parentHTML = a.innerHTML;
                        if (parentHTML.includes('₹')) {
                            priceText = "has_rupee"; // Fallback to indicate found
                        }
                    }

                    return { href, priceText };
                });

                return items.filter(p => p.priceText); // Return only items where price was found
            });
            console.log(`Found ${productsInfo.length} products with a price format.`);
            if (productsInfo.length > 0) {
                console.log(`Sample: ${productsInfo[0].href} -> ${productsInfo[0].priceText}`);
            }
        } catch (e) {
            console.log(`Error checking ${url}: ${e.message}`);
        }
    }

    await browser.close();
})();
