import { chromium } from 'playwright';
import fs from 'fs';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

try {
  console.log('\n=== REGISTRATION PAGE DEBUG ===\n');

  console.log('📍 Navigating to /#/auth/register...');
  const response = await page.goto('http://localhost:4201/#/auth/register', { waitUntil: 'networkidle' });

  console.log(`✅ Response status: ${response.status()}`);
  console.log(`📍 Current URL: ${page.url()}`);

  await page.waitForTimeout(2000);

  // Get the page content
  const content = await page.content();

  // Check what component is rendered
  const hasRegister = content.includes('app-register');
  const hasLogin = content.includes('login');

  console.log(`\n📝 Page contains 'app-register': ${hasRegister}`);
  console.log(`📝 Page contains 'login': ${hasLogin}`);

  // Get all headings
  const headings = await page.locator('h1, h2, h3, h4, h5, h6').allTextContents();
  console.log('\n📄 All headings on page:');
  headings.forEach((h, i) => {
    console.log(`   [${i}] ${h.trim()}`);
  });

  // Get all visible text
  const bodyText = await page.evaluate(() => document.body.innerText);
  console.log('\n📄 First 500 chars of body text:');
  console.log(bodyText.substring(0, 500));

  // Take screenshot
  await page.screenshot({ path: 'C:\\Users\\suriy\\AppData\\Local\\Temp\\claude\\d--Github-zellavora-control-center\\7d4cee24-f56e-4bda-865b-ff57c679a9c8\\scratchpad\\screenshots\\debug-page.png' });
  console.log('\n📸 Screenshot saved: debug-page.png');

} catch (err) {
  console.error('\n❌ Error:', err.message);
  process.exit(1);
} finally {
  await browser.close();
}
