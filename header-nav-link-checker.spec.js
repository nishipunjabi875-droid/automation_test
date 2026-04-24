// header-nav-link-checker.spec.js
// WoodenStreet — Study & Office | Outdoor | Decor & Furnishing
//
// Dropdown collection strategy:
//   1. Find the <li> in the nav that contains the category text
//   2. Hover it — its child dropdown panel opens as a sibling/child of that <li>
//   3. Collect ONLY <a> tags inside that specific <li> container
//      → This guarantees we get Study & Office links only when hovering Study & Office

import { test, expect, request as playwrightRequest } from '@playwright/test';

const BASE_URL = 'https://www.woodenstreet.com';

// ✅ Correct spelling (note: "Furnishing" not "Furnishng")
const CATEGORIES = [
  'Study & Office',
  'Outdoor',
  'Decor & Furnishing',
];

const BROWSER_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) ' +
    'AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
  'Referer': BASE_URL,
};

const sleep = ms => new Promise(r => setTimeout(r, ms));

// ─── POPUP DISMISSAL ─────────────────────────────────────────────────────────
async function dismissPopups(page) {
  try {
    const b = page.frameLocator('iframe[name="webpush-onsite"]')
                  .getByRole('button', { name: "I'll do this later" });
    await b.waitFor({ state: 'visible', timeout: 1500 });
    await b.click({ force: true });
    await sleep(300);
    console.log('      🔕 web-push dismissed');
  } catch {}

  for (const sel of [
    '[aria-label="Close"]','[aria-label="close"]','[title="Close"]',
    'button.close','.close-btn','.modal-close','.popup-close','.icon-close',
    '.btn-close','.login-popup .close','#login-popup .close',
    '.ws-modal .close','.ws-popup .close','.modal-backdrop','.popup-overlay',
  ]) {
    try {
      const el = page.locator(sel).first();
      if (await el.isVisible({ timeout: 500 })) {
        await el.click({ force: true });
        console.log(`      🔕 closed: ${sel}`);
        await sleep(400);
        break;
      }
    } catch {}
  }
  try { await page.keyboard.press('Escape'); await sleep(150); } catch {}
}

// ─── HTTP CHECK with retry + back-off ────────────────────────────────────────
async function checkUrl(client, href, cat, label, broken, visited) {
  if (visited.has(href)) return;
  visited.add(href);
  let status;
  for (let i = 1; i <= 3; i++) {
    await sleep(600 + Math.random() * 900);
    try {
      let r = await client.head(href, { timeout: 20_000 });
      if ([405, 501].includes(r.status())) {
        await sleep(300);
        r = await client.get(href, { timeout: 20_000 });
      }
      if (r.status() === 429) { await sleep(3000 * i); continue; }
      status = r.status();
      break;
    } catch (e) {
      status = `ERR: ${(e.message ?? '').split('\n')[0]}`;
      if (i < 3) { await sleep(2000 * i); status = undefined; }
    }
  }
  if (!status) status = 'ERR: all retries failed';

  if (status === 404 || String(status).startsWith('ERR')) {
    console.log(`   ❌ ${status}  [${cat} › ${label}]  ${href}`);
    broken.push({ cat, label, href, status });
  } else {
    console.log(`   ✅ ${status}  [${cat} › ${label}]`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────

test.describe('WoodenStreet — 3 Category Nav Checker', () => {

  test('Study & Office | Outdoor | Decor & Furnishing', async ({ page }) => {
    test.setTimeout(300_000);

    const broken  = [];
    const visited = new Set();

    const client = await playwrightRequest.newContext({
      ignoreHTTPSErrors: true,
      extraHTTPHeaders: BROWSER_HEADERS,
    });

    try {
      // ── 1. Open homepage ───────────────────────────────────────────────────
      console.log(`\n🌐  ${BASE_URL}`);
      await page.setExtraHTTPHeaders(BROWSER_HEADERS);
      await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 60_000 });
      await sleep(2_500);
      console.log(`   Title: "${await page.title()}"`);

      // ── 2. Initial popup dismissal ─────────────────────────────────────────
      await dismissPopups(page);
      await sleep(800);
      await dismissPopups(page);

      // ── 3. Each category ───────────────────────────────────────────────────
      for (const catName of CATEGORIES) {
        console.log(`\n${'─'.repeat(62)}`);
        console.log(`📂  CATEGORY: ${catName}`);
        console.log('─'.repeat(62));

        await dismissPopups(page);

        // ── STEP A: Find the exact <li> that wraps this category in the nav ──
        // WoodenStreet's nav HTML looks like:
        //   <ul>
        //     <li>  ← this is what we want
        //       <a>Study & Office</a>
        //       <div class="dropdown"> ← child dropdown panel
        //         <a>Study Tables</a>
        //         <a>Computer Tables</a>  ...
        //       </div>
        //     </li>
        //   </ul>
        //
        // By scoping to the <li>, we get ONLY that category's sub-links.

        const catData = await page.evaluate((name) => {
          const normalize = s => s.replace(/\s+/g, ' ').trim();

          // Find the nav <li> whose direct/shallow text matches the category
          for (const li of document.querySelectorAll('header li, nav li')) {
            // Check if this <li> has a direct child <a> with the category text
            const anchor = [...li.querySelectorAll('a')].find(
              a => normalize(a.innerText) === name
            );
            if (!anchor) continue;

            const r = anchor.getBoundingClientRect();
            // Must be in the nav bar vertical band (50–250px from top)
            if (r.top < 50 || r.top > 250) continue;

            return {
              // Hover coordinates — centre of the anchor text
              hx: r.left + r.width  / 2,
              hy: r.top  + r.height / 2,
              // The category's own href
              href: anchor.getAttribute('href'),
              // A unique attribute to re-select this <li> after hover
              // We tag it with a data attribute so we can querySelector it later
              liIndex: [...document.querySelectorAll('header li, nav li')].indexOf(li),
            };
          }
          return null;
        }, catName);

        if (!catData) {
          console.log(`   ⚠️  "${catName}" <li> not found — skipping.`);
          continue;
        }

        const hx = Math.round(catData.hx);
        const hy = Math.round(catData.hy);
        console.log(`   📍 Found at (${hx}, ${hy})`);

        // ── STEP B: Check the category landing page ────────────────────────
        if (catData.href &&
            !catData.href.startsWith('#') &&
            !catData.href.startsWith('javascript:')) {
          await checkUrl(
            client,
            new URL(catData.href, BASE_URL).href,
            catName, `${catName} (main)`,
            broken, visited
          );
        }

        // ── STEP C: Hover to open the dropdown ────────────────────────────
        await page.mouse.move(hx, hy, { steps: 10 });
        await sleep(1_200);
        console.log(`   🖱️  Hovered — dropdown open`);

        await dismissPopups(page);
        await sleep(400);

        // ── STEP D: Collect links ONLY from inside this category's <li> ───
        // We re-query the same <li> by index and grab all its child <a> tags.
        // FIX: Do NOT filter by getBoundingClientRect height/width — for large
        // dropdowns like "Decor & Furnishing", some links are rendered in the
        // DOM but sit below the visible viewport (scrolled out). They are still
        // valid links belonging to this category and must be collected.
        // Instead we check the element is attached and has non-empty text/href.
        const subLinks = await page.evaluate((liIndex) => {
          const allLis = [...document.querySelectorAll('header li, nav li')];
          const li = allLis[liIndex];
          if (!li) return [];

          const results = [];
          const seen = new Set();

          // Get every <a> inside this <li> — these are ONLY the dropdown links
          for (const a of li.querySelectorAll('a')) {
            const text = (a.innerText ?? '').replace(/\s+/g, ' ').trim();
            if (!text || text.length < 2 || text.length > 80) continue;

            const href = a.getAttribute('href') ?? '';
            if (!href || href.startsWith('#') || href.startsWith('javascript:')) continue;
            if (seen.has(href)) continue;

            // FIX: Only skip links hidden via CSS display:none or visibility:hidden
            // Do NOT skip links that are merely below the viewport scroll position
            const style = window.getComputedStyle(a);
            if (style.display === 'none' || style.visibility === 'hidden') continue;

            seen.add(href);
            results.push({ text, href });
          }
          return results;
        }, catData.liIndex);

        // Exclude the category's own top-level link (already checked above)
        const filteredSubLinks = subLinks.filter(
          l => (l.text.toLowerCase() !== catName.toLowerCase())
        );

        if (filteredSubLinks.length === 0) {
          console.log(`   ⚠️  No sub-links found inside the dropdown panel.`);
        } else {
          console.log(`   📋  ${filteredSubLinks.length} sub-link(s) in "${catName}" dropdown:`);
          filteredSubLinks.forEach(l => console.log(`       • "${l.text}"  →  ${l.href}`));
        }

        // ── STEP E: HTTP-check every sub-link ─────────────────────────────
        for (const { text, href } of filteredSubLinks) {
          const abs = (() => {
            try { return new URL(href, BASE_URL).href; } catch { return null; }
          })();
          if (!abs) continue;
          await dismissPopups(page);
          await checkUrl(client, abs, catName, text, broken, visited);
        }

        // Close dropdown — move to neutral position
        await page.mouse.move(200, 50, { steps: 10 });
        await sleep(500);
      }

    } finally {
      await client.dispose();
    }

    // ── 4. Final report ────────────────────────────────────────────────────────
    const SEP = '═'.repeat(65);
    console.log(`\n${SEP}`);
    console.log('📊  FINAL REPORT — WoodenStreet 3-Category Nav Check');
    console.log(SEP);
    console.log(`   🔗 Total URLs checked : ${visited.size}`);
    console.log(`   ✅ Working            : ${visited.size - broken.length}`);
    console.log(`   ❌ Broken (404/ERR)   : ${broken.length}`);

    if (broken.length) {
      console.log('\n❌  BROKEN LINKS:');
      broken.forEach(({ cat, label, href, status }, i) => {
        console.log(`\n   [${i + 1}] Category : ${cat}`);
        console.log(`       Link     : ${label}`);
        console.log(`       URL      : ${href}`);
        console.log(`       Status   : ${status}`);
      });
    } else {
      console.log('\n🎉  All links healthy — zero 404s!');
    }
    console.log(SEP + '\n');

    expect(broken, `${broken.length} broken link(s) found`).toHaveLength(0);
  });

});
