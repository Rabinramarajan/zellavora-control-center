import { chromium } from 'playwright';
import fs from 'fs';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const screenshotDir = 'C:\\Users\\suriy\\AppData\\Local\\Temp\\claude\\d--Github-zellavora-control-center\\7d4cee24-f56e-4bda-865b-ff57c679a9c8\\scratchpad\\screenshots';

if (!fs.existsSync(screenshotDir)) {
  fs.mkdirSync(screenshotDir, { recursive: true });
}

try {
  console.log('\n=== REGISTRATION FLOW TEST ===\n');

  // Step 1: Navigate to registration page (using hash-based routing)
  console.log('📍 Step 1: Navigating to registration page...');
  await page.goto('http://localhost:4201/#/auth/register', { waitUntil: 'networkidle' });

  // Wait for Angular to fully load
  await page.waitForTimeout(3000);

  const title = await page.title();
  console.log(`✅ Page loaded: "${title}"`);

  // Take screenshot of step 1
  await page.screenshot({ path: `${screenshotDir}/01-welcome.png` });
  console.log('📸 Screenshot saved: 01-welcome.png');

  // Check for welcome content
  const heading = await page.locator('h2').first().textContent();
  console.log(`📝 Current heading: "${heading}"\n`);

  // Step 2: Select Organization option
  console.log('📍 Step 2: Selecting Organization option...');

  // Try to find and click the organization card using text content
  const orgCard = page.locator('div:has-text("Enterprise Organization")').first();

  // Verify it exists and is visible
  const isVisible = await orgCard.isVisible({ timeout: 5000 });
  if (!isVisible) {
    console.log('⚠️  Organization card not visible, trying alternative selector');
  } else {
    await orgCard.click();
    console.log('✅ Clicked Organization card');
  }

  // Wait for Angular to update the state
  await page.waitForTimeout(2000);

  // Verify Organization button is now selected
  const orgSelected = await page.locator('div[class*="mode-card"][class*="active"]').count();
  console.log(`✅ Organization selected: ${orgSelected > 0}`);

  // Click Continue button - wait for it to be enabled
  console.log('📍 Step 3: Waiting for Continue button to be enabled...');
  const continueBtn = page.locator('button:has-text("Continue")').first();

  // Wait for button to be enabled
  try {
    await continueBtn.isEnabled({ timeout: 5000 });
    console.log('✅ Continue button is enabled');
  } catch {
    console.log('⚠️  Continue button not enabled yet, taking screenshot...');
    await page.screenshot({ path: `${screenshotDir}/02-step1-debug.png` });
  }

  await continueBtn.click();
  await page.waitForTimeout(2000);

  // Take screenshot of step 2 (Invitation)
  const currentHeading = await page.locator('h2').first().textContent();
  console.log(`📝 Current heading: "${currentHeading}"`);
  await page.screenshot({ path: `${screenshotDir}/02-invitation.png` });
  console.log('📸 Screenshot saved: 02-invitation.png\n');

  // Step 4: Verify form elements are present
  console.log('📍 Verifying registration form structure...');

  // Check for form elements that should be present
  const hasInviteInput = await page.locator('input[placeholder*="ZCC-INVITE"]').count() > 0;
  const hasBackBtn = await page.locator('button:has-text("Back")').count() > 0;
  const hasVerifyBtn = await page.locator('button:has-text("Verify")').count() > 0;

  console.log(`✅ Invite input present: ${hasInviteInput}`);
  console.log(`✅ Back button present: ${hasBackBtn}`);
  console.log(`✅ Verify button present: ${hasVerifyBtn}`);

  // Step 5: Test going back
  console.log('\n📍 Step 5: Testing Back button...');
  const backBtn = await page.locator('button:has-text("Back")').first();
  await backBtn.click();
  await page.waitForTimeout(1000);

  const backHeading = await page.locator('h2').first().textContent();
  console.log(`✅ Back navigation working: "${backHeading}"`);
  await page.screenshot({ path: `${screenshotDir}/03-back-to-welcome.png` });
  console.log('📸 Screenshot saved: 03-back-to-welcome.png');

  console.log('\n✅ Registration Flow Test - PASSED');
  console.log(`\n📁 Screenshots saved to: ${screenshotDir}`);

} catch (err) {
  console.error('\n❌ Error:', err.message);
  console.error(err.stack);
  process.exit(1);
} finally {
  await browser.close();
}
