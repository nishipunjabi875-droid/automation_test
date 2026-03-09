const { chromium } = require('playwright');

(async () => {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();

    // Listen for console logs and errors
    page.on('console', msg => console.log('PAGE LOG:', msg.text()));

    console.log('Navigating to collection page...');
    await page.goto('https://www.woodenstreet.com/collection/veda-collection', { waitUntil: 'domcontentloaded' });

    console.log('Waiting for elements to load...');
    // We don't know the exact selector, wait for body and a bit
    await page.waitForTimeout(3000);

    // Find the first product container. We'll find a link that contains a price symbol.
    const firstProductHTML = await page.evaluate(() => {
        // Let's find an element that contains 'Vedic'
        const matches = Array.from(document.querySelectorAll('*')).filter(el =>
            el.textContent && el.textContent.includes('Vedic 3+1+1 Sofa Set') && el.tagName === 'A'
        );
        if (matches.length > 0) {
            // Find its closest container, maybe li or div
            const container = matches[0].closest('li, .product-card, div') || matches[0].parentElement;
            return container ? container.outerHTML : "Container not found";
        }
        return "Not found";
    });

    console.log("------------------- PRODUCT HTML -------------------");
    console.log(firstProductHTML);
    console.log("--------------------------------------------------");

    await browser.close();
})();
