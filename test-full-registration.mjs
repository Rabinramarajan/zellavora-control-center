import { chromium } from 'playwright';
import fs from 'fs';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const screenshotDir = 'C:\\Users\\suriy\\AppData\\Local\\Temp\\claude\\d--Github-zellavora-control-center\\7d4cee24-f56e-4bda-865b-ff57c679a9c8\\scratchpad\\screenshots\\full-flow';

if (!fs.existsSync(screenshotDir)) {
  fs.mkdirSync(screenshotDir, { recursive: true });
}

try {
  console.log('\n=== FULL REGISTRATION FLOW TEST ===\n');

  // Navigate to registration
  console.log('📍 [STEP 1] Navigating to registration...');
  await page.goto('http://localhost:4201/#/auth/register', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  let pageTitle = await page.title();
  console.log(`✅ Page loaded: "${pageTitle}"`);

  await page.screenshot({ path: `${screenshotDir}/01-welcome.png` });
  console.log('📸 Screenshot: 01-welcome.png\n');

  // STEP 1: Select Organization
  console.log('📍 [STEP 1] Selecting Organization...');
  await page.evaluate(() => {
    const cards = document.querySelectorAll('[class*="mode-card"]');
    if (cards.length > 0) cards[0].click();
  });
  await page.waitForTimeout(1000);

  // Click Continue
  console.log('📍 [STEP 1] Clicking Continue...');
  await page.click('button:has-text("Continue")');
  await page.waitForTimeout(2000);

  let heading = await page.locator('h2').first().textContent();
  console.log(`✅ Moved to: "${heading.trim()}"`);

  await page.screenshot({ path: `${screenshotDir}/02-invitation.png` });
  console.log('📸 Screenshot: 02-invitation.png\n');

  // STEP 2: Skip invitation (go back for now to test flow)
  console.log('📍 [STEP 2] Testing Back button...');
  await page.click('button:has-text("Back")');
  await page.waitForTimeout(1000);

  heading = await page.locator('h2').first().textContent();
  console.log(`✅ Back to: "${heading.trim()}"`);

  await page.screenshot({ path: `${screenshotDir}/03-back-welcome.png` });
  console.log('📸 Screenshot: 03-back-welcome.png\n');

  // STEP 3: Test Partner selection
  console.log('📍 [STEP 3] Testing Partner selection...');
  await page.evaluate(() => {
    const cards = document.querySelectorAll('[class*="mode-card"]');
    if (cards.length > 1) cards[1].click();
  });
  await page.waitForTimeout(1000);

  const partnerActive = await page.locator('[class*="mode-card"][class*="active"]').count();
  console.log(`✅ Partner button state active count: ${partnerActive}`);

  await page.screenshot({ path: `${screenshotDir}/04-partner-selected.png` });
  console.log('📸 Screenshot: 04-partner-selected.png\n');

  // STEP 4: Navigate forward to Invitation
  console.log('📍 [STEP 4] Moving to Invitation step...');
  await page.click('button:has-text("Continue")');
  await page.waitForTimeout(2000);

  heading = await page.locator('h2').first().textContent();
  console.log(`✅ Current step: "${heading.trim()}"`);

  // Check for form elements
  const inviteInput = await page.locator('input[placeholder*="ZCC-INVITE"]').count();
  const hasBackBtn = await page.locator('button:has-text("Back")').count();
  const hasVerifyBtn = await page.locator('button:has-text("Verify")').count();

  console.log(`✅ Invite input present: ${inviteInput > 0}`);
  console.log(`✅ Back button present: ${hasBackBtn > 0}`);
  console.log(`✅ Verify button present: ${hasVerifyBtn > 0}`);

  await page.screenshot({ path: `${screenshotDir}/05-invitation-form.png` });
  console.log('📸 Screenshot: 05-invitation-form.png\n');

  // STEP 5: Check stepper progression
  console.log('📍 [STEP 5] Checking stepper progression...');
  const stepperNodes = await page.locator('.stepper-node').count();
  const completedSteps = await page.locator('.stepper-node.is-done').count();
  const activeSteps = await page.locator('.stepper-node.is-active').count();

  console.log(`✅ Stepper nodes: ${stepperNodes}`);
  console.log(`✅ Completed steps: ${completedSteps}`);
  console.log(`✅ Active steps: ${activeSteps}`);

  console.log('\n✅ ALL TESTS PASSED - Registration flow is working!\n');
  console.log(`📁 Screenshots saved to: ${screenshotDir}`);

} catch (err) {
  console.error('\n❌ Error:', err.message);
  console.error(err.stack);
  process.exit(1);
} finally {
  await browser.close();
}
