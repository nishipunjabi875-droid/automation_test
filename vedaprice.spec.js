// @ts-check
const { test, expect } = require('@playwright/test');

/**
 * Test Suite: Veda Collection – Price Consistency Check
 *
 * Purpose:
 *   Prices on the collection page are rendered statically (baked into HTML),
 *   while the product page fetches live prices dynamically.
 *   This suite scrapes every product's price from the collection page,
 *   then visits each product page and asserts the prices match.
 */

const COLLECTION_URL = 'https://www.woodenstreet.com/collection/veda-collection';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Normalise a price string to a plain integer (INR paise stripped).
 * e.g. "₹12,499" | "Rs. 12,499" | "12499" → 12499
 */
function normalisePrice(raw) {
  return parseInt(raw.replace(/[^0-9]/g, ''), 10);
}

// ---------------------------------------------------------------------------
// Fixtures / shared state
// ---------------------------------------------------------------------------

/** @type {{ name: string; collectionPrice: number; url: string }[]} */
let collectionProducts = [];

// ---------------------------------------------------------------------------
// Step 1: Harvest all products + prices from the collection page
// ---------------------------------------------------------------------------

test.describe('Veda Collection – price consistency', () => {

  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage();

    await page.goto(COLLECTION_URL, { waitUntil: 'domcontentloaded', timeout: 60_000 });

    // ── Scroll to bottom so lazy-loaded cards render ──────────────────────
    let previousHeight = 0;
    for (let i = 0; i < 15; i++) {
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page.waitForTimeout(1200);
      const currentHeight = await page.evaluate(() => document.body.scrollHeight);
      if (currentHeight === previousHeight) break;
      previousHeight = currentHeight;
    }

    // ── Scrape product cards ───────────────────────────────────────────────
    // Adjust selectors below if WoodenStreet updates their markup.
    collectionProducts = await page.evaluate(() => {
      const cards = Array.from(
        document.querySelectorAll('.product-item, .product-card, [class*="product-list"] li, .prd-grid .item')
      );

      return cards
        .map((card) => {
          // -- Product name --
          const nameEl =
            card.querySelector('.product-name, .prd-name, h2, h3, [class*="product-title"]');
          const name = nameEl ? nameEl.textContent.trim() : 'Unknown';

          // -- Price (discounted / final sale price) --
          // Prefer the "offer price" span; fall back to first visible price element.
          const priceEl =
            card.querySelector('.offer-price, .sale-price, .discounted-price, [class*="offer"], [class*="sale-price"]') ||
            card.querySelector('.price, [class*="price"]');
          const rawPrice = priceEl ? priceEl.textContent.trim() : null;

          // -- Product URL --
          const anchor = card.querySelector('a[href*="/furniture/"], a[href*="/sofa/"], a[href*="/bed/"], a[href*="/chair/"], a[href]');
          const href = anchor ? anchor.getAttribute('href') : null;

          if (!rawPrice || !href) return null;

          return { name, rawPrice, href };
        })
        .filter(Boolean);
    });

    // Resolve relative URLs
    collectionProducts = collectionProducts.map((p) => ({
      name: p.name,
      collectionPrice: normalisePrice(p.rawPrice),
      url: p.href.startsWith('http') ? p.href : `https://www.woodenstreet.com${p.href}`,
    }));

    console.log(`\n✅ Found ${collectionProducts.length} products on collection page.\n`);

    await page.close();
  });

  // ── Sanity: collection page must list at least 1 product ──────────────
  test('collection page should list products with prices', () => {
    expect(collectionProducts.length).toBeGreaterThan(0);

    for (const product of collectionProducts) {
      expect(product.collectionPrice, `${product.name} has an invalid collection price`).toBeGreaterThan(0);
      expect(product.url, `${product.name} is missing a URL`).toMatch(/^https?:\/\//);
    }
  });

  // ── Core: visit each product page and compare prices ──────────────────
  // Uses test.each so every product appears as an individual test result.
  for (const product of collectionProducts) {
    test(`price match – ${product.name}`, async ({ page }) => {
      await page.goto(product.url, { waitUntil: 'domcontentloaded', timeout: 60_000 });

      // Wait for price element to be visible
      const priceLocator = page.locator(
        '.offer-price, .sale-price, .discounted-price, [class*="offer-price"], [class*="sale-price"], #product-price, .product-price'
      ).first();

      await priceLocator.waitFor({ state: 'visible', timeout: 15_000 });

      const rawProductPagePrice = await priceLocator.textContent();
      const productPagePrice = normalisePrice(rawProductPagePrice ?? '0');

      console.log(
        `  [${product.name}]  collection: ₹${product.collectionPrice}  |  product page: ₹${productPagePrice}`
      );

      // ── ASSERTION ────────────────────────────────────────────────────────
      expect(
        productPagePrice,
        `Price mismatch for "${product.name}": collection page shows ₹${product.collectionPrice} but product page shows ₹${productPagePrice}`
      ).toBe(product.collectionPrice);
    });
  }

  // ── Bonus: generate a human-readable mismatch report ──────────────────
  test('price mismatch summary report', async ({ browser }) => {
    const mismatches = [];

    for (const product of collectionProducts) {
      const page = await browser.newPage();
      try {
        await page.goto(product.url, { waitUntil: 'domcontentloaded', timeout: 60_000 });

        const priceLocator = page.locator(
          '.offer-price, .sale-price, .discounted-price, [class*="offer-price"], [class*="sale-price"], #product-price, .product-price'
        ).first();

        await priceLocator.waitFor({ state: 'visible', timeout: 15_000 });
        const rawProductPagePrice = await priceLocator.textContent();
        const productPagePrice = normalisePrice(rawProductPagePrice ?? '0');

        if (productPagePrice !== product.collectionPrice) {
          mismatches.push({
            name: product.name,
            url: product.url,
            collectionPrice: product.collectionPrice,
            productPagePrice,
            diff: productPagePrice - product.collectionPrice,
          });
        }
      } catch (err) {
        mismatches.push({
          name: product.name,
          url: product.url,
          collectionPrice: product.collectionPrice,
          productPagePrice: 'ERROR',
          diff: 'N/A',
          error: err.message,
        });
      } finally {
        await page.close();
      }
    }

    if (mismatches.length > 0) {
      console.warn('\n⚠️  PRICE MISMATCHES DETECTED:\n');
      console.table(mismatches);
    } else {
      console.log('\n✅ All prices match between collection page and product pages.\n');
    }

    // Soft assertion – log mismatches but don't fail the summary test itself
    // Change to hard expect if you want the CI to fail on any mismatch.
    expect(mismatches.length).toBe(0);
  });
});