const { chromium } = require('playwright');

(async () => {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();

    console.log('Navigating to product page...');
    await page.goto('https://www.woodenstreet.com/product/vedic-3-1-1-wooden-sofa-set-with-cane-and-brass-detail-teak-finish-jade-ivory', { waitUntil: 'domcontentloaded' });

    console.log('Waiting for elements to load...');
    await page.waitForTimeout(3000);

    const priceHTML = await page.evaluate(() => {
        // Collect all elements containing the text "1,01,999" (the sale price we saw on the collection page)
        const matches = Array.from(document.querySelectorAll('*')).filter(el =>
            el.textContent && el.textContent.includes('1,01,999') && el.children.length === 0
        );
        if (matches.length > 0) {
            // Return outerHTML of the parent or the element itself
            return matches.map(m => m.closest('div, p, span, h1, h2, h3').outerHTML).join('\\n\\n');
        }
        return "Not found";
    });

    console.log("------------------- PRODUCT PRICE HTML -------------------");
    console.log(priceHTML);
    console.log("----------------------------------------------------------");

    await browser.close();
})();
