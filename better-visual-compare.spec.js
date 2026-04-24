const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

test.describe('Advanced & Clear Visual Regression', () => {

    // Helper function to stabilize the page and prevent "clumsy" false positives
    async function preparePageForScreenshot(page) {
        // 1. Scroll to the very bottom to trigger lazy-loaded images
        await page.evaluate(async () => {
            await new Promise((resolve) => {
                let totalHeight = 0;
                const distance = 100;
                const timer = setInterval(() => {
                    const scrollHeight = document.body.scrollHeight;
                    window.scrollBy(0, distance);
                    totalHeight += distance;

                    if (totalHeight >= scrollHeight - window.innerHeight) {
                        clearInterval(timer);
                        resolve();
                    }
                }, 50); // fast scroll
            });
            // Scroll back to top
            window.scrollTo(0, 0);
        });

        // wait a moment for images to actually render
        await page.waitForTimeout(1500);

        // 2. Hide common sticky/dynamic elements that cause clumsy screenshots
        await page.evaluate(() => {
            const elementsToHide = [
                'header', // Often sticky and repeated
                '.header',
                '.sticky',
                '#whatsapp-widget', // Chat widgets
                'iframe', // Dynamic ads or videos
                '.carousel' // Sliders
            ];
            elementsToHide.forEach(selector => {
                document.querySelectorAll(selector).forEach(el => {
                    if (el && el.style) el.style.visibility = 'hidden';
                });
            });
            // Hide scrollbar for cleaner screenshots
            document.body.style.overflow = 'hidden';
        });
    }

    test('Generate clear before/after slider and comparison', async ({ page }, testInfo) => {

         const beforeUrl = 'https://www.woodenstreet.com/product/shriyam-modern-6-seater-sheesham-wood-dining-table-set-with-quartz-table-top-cane-brass-accents-teak-finish'; 
        // const afterUrl = 'https://www.woodenstreet.com/product/shriyam-modern-6-seater-sheesham-wood-dining-table-set-with-quartz-table-top-cane-brass-accents-teak-finish'; 
       // const beforeUrl = 'https://beta.teamwoodenstreet.com/product/shriyam-modern-6-seater-sheesham-wood-dining-table-set-with-quartz-table-top-cane-brass-accents-teak-finish'; 
        const afterUrl = 'https://beta.teamwoodenstreet.com/product/shriyam-modern-6-seater-sheesham-wood-dining-table-set-with-quartz-table-top-cane-brass-accents-teak-finish'; 
        
        const screenshotsDir = path.join(__dirname, 'visual-results');
        if (!fs.existsSync(screenshotsDir)) {
            fs.mkdirSync(screenshotsDir, { recursive: true });
        }

        // ============================================================
        // 1. CAPTURE "BEFORE" STATE
        // ============================================================
        console.log(`Navigating to BEFORE: ${beforeUrl}`);
        await page.goto(beforeUrl, { waitUntil: 'load' }); // wait for full load
        await preparePageForScreenshot(page);

        const beforeFilePath = path.join(screenshotsDir, 'before-state.png');
        const beforeBuffer = await page.screenshot({ path: beforeFilePath, fullPage: true, animations: 'disabled' });

        // ============================================================
        // 2. CAPTURE "AFTER" STATE
        // ============================================================
        console.log(`Navigating to AFTER: ${afterUrl}`);
        await page.goto(afterUrl, { waitUntil: 'load' });
        await preparePageForScreenshot(page);

        const afterFilePath = path.join(screenshotsDir, 'after-state.png');
        const afterBuffer = await page.screenshot({ path: afterFilePath, fullPage: true, animations: 'disabled' });

        // ============================================================
        // 3. GENERATE A CLEAR INTERACTIVE HTML SLIDER REPORT
        // ============================================================
        const htmlReportPath = path.join(screenshotsDir, 'slider-report.html');
        const htmlContent = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Clear Visual Comparison</title>
            <style>
                body { font-family: sans-serif; text-align: center; background: #f4f4f4; margin: 0; padding: 20px; }
                h1 { color: #333; }
                .comparison-container {
                    position: relative;
                    width: 80%;
                    max-width: 1200px;
                    margin: 20px auto;
                    border: 2px solid #ccc;
                    border-radius: 8px;
                    overflow: hidden;
                    box-shadow: 0 4px 10px rgba(0,0,0,0.1);
                    background: white;
                }
                .comparison-container img {
                    width: 100%;
                    display: block;
                }
                .img-after {
                    position: absolute;
                    top: 0;
                    left: 0;
                    width: 50%; /* Initial slider position */
                    height: 100%;
                    overflow: hidden;
                    border-right: 2px solid #ff4757;
                }
                .img-after img {
                    width: 200%; /* Important: Counteracts the container width */
                    max-width: none;
                }
                .slider {
                    position: absolute;
                    top: 0;
                    bottom: 0;
                    left: 50%;
                    width: 4px;
                    background: #ff4757;
                    cursor: ew-resize;
                    z-index: 10;
                    transform: translateX(-50%);
                }
                .slider::before {
                    content: "↔";
                    position: absolute;
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%);
                    background: #ff4757;
                    color: white;
                    border-radius: 50%;
                    width: 30px;
                    height: 30px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-weight: bold;
                    box-shadow: 0 0 5px rgba(0,0,0,0.5);
                }
            </style>
        </head>
        <body>
            <h1>📸 Interactive Visual Slider</h1>
            <p>Slide left and right to clearly see differences between Production and Staging.</p>
            <p><small>Before = Right Side | After = Left Side</small></p>
            
            <div class="comparison-container" id="container">
                <!-- Base Image (Before) -->
                <img src="before-state.png" alt="Before">
                
                <!-- Overlay Image (After) -->
                <div class="img-after" id="afterImage">
                    <img src="after-state.png" alt="After" id="innerAfterImage">
                </div>
                
                <!-- Draggable Slider -->
                <div class="slider" id="slider"></div>
            </div>

            <script>
                const container = document.getElementById('container');
                const slider = document.getElementById('slider');
                const afterImage = document.getElementById('afterImage');
                const innerAfterImage = document.getElementById('innerAfterImage');

                // Adjust inner image width to match the container exactly
                function updateDimensions() {
                    innerAfterImage.style.width = container.offsetWidth + 'px';
                }
                window.addEventListener('resize', updateDimensions);
                updateDimensions();

                let isDragging = false;
                slider.addEventListener('mousedown', () => isDragging = true);
                window.addEventListener('mouseup', () => isDragging = false);
                window.addEventListener('mousemove', (e) => {
                    if (!isDragging) return;
                    let rect = container.getBoundingClientRect();
                    let offsetX = e.clientX - rect.left;
                    if (offsetX < 0) offsetX = 0;
                    if (offsetX > rect.width) offsetX = rect.width;
                    
                    let percentage = (offsetX / rect.width) * 100;
                    slider.style.left = percentage + '%';
                    afterImage.style.width = percentage + '%';
                });
            </script>
        </body>
        </html>
        `;
        
        fs.writeFileSync(htmlReportPath, htmlContent);
        console.log(`✅ Custom clear slider report generated! Open this file in your browser to check: ${htmlReportPath}`);

        // ============================================================
        // 4. AUTOMATIC PLAYWRIGHT ASSERTION
        // ============================================================
        const expectedSnapshotPath = testInfo.snapshotPath('clear-comparison.png');
        fs.mkdirSync(path.dirname(expectedSnapshotPath), { recursive: true });
        fs.writeFileSync(expectedSnapshotPath, beforeBuffer);

        expect(afterBuffer).toMatchSnapshot('clear-comparison.png', {
            maxDiffPixels: 200, 
        });
    });
});
