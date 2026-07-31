import { chromium } from 'playwright';
import fs from 'fs';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

try {
  console.log('\n=== TESTING ORGANIZATION CLICK ===\n');

  await page.goto('http://localhost:4201/#/auth/register', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  console.log('📍 Looking for mode-card elements...');

  // Log all divs with mode-card class
  const modeCards = await page.locator('div[class*="mode-card"]').count();
  console.log(`✅ Found ${modeCards} mode-card elements`);

  // Try to click using playwright evaluate
  console.log('\n📍 Attempting to set welcomeType via Angular component...');

  const result = await page.evaluate(() => {
    // Try to find the store and set it directly
    const cards = document.querySelectorAll('[class*="mode-card"]');
    console.log('Cards found:', cards.length);

    // Just simulate a click on the first card
    if (cards.length > 0) {
      cards[0].click();
      console.log('Clicked first card');
      return 'clicked';
    }
    return 'no cards';
  });

  console.log(`✅ Evaluation result: ${result}`);

  await page.waitForTimeout(1000);

  // Check the button state
  const continueBtn = page.locator('button:has-text("Continue")');
  const isDisabled = await continueBtn.evaluate(el => el.disabled);
  const isEnabled = await continueBtn.isEnabled({ timeout: 1000 }).catch(() => false);

  console.log(`\n📍 Button state:`);
  console.log(`   Disabled attribute: ${isDisabled}`);
  console.log(`   Is enabled (Playwright): ${isEnabled}`);

  // Check welcomeType in the store
  const storeData = await page.evaluate(() => {
    // Try to access Angular's component instance
    const elem = document.querySelector('app-register');
    if (!elem || !elem.__ngContext__) return 'Could not access component';

    // Try accessing the component from Angular's internal structure
    const ng = window.ng;
    if (!ng) return 'Angular not available';

    return 'Angular available';
  });

  console.log(`\n📍 Angular access: ${storeData}`);

  // Take screenshot
  await page.screenshot({ path: 'C:\\Users\\suriy\\AppData\\Local\\Temp\\claude\\d--Github-zellavora-control-center\\7d4cee24-f56e-4bda-865b-ff57c679a9c8\\scratchpad\\screenshots\\click-debug.png' });
  console.log('📸 Screenshot saved: click-debug.png');

} catch (err) {
  console.error('\n❌ Error:', err.message);
  process.exit(1);
} finally {
  await browser.close();
}
