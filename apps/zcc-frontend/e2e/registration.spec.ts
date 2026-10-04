import { expect, Page, test } from '@playwright/test';

const config = {
  selfRegistrationEnabled: true,
  registrationTypes: ['ORGANIZATION_MEMBER', 'INDIVIDUAL', 'CREATE_ORGANIZATION'],
  requireEmailVerification: true,
  supportEmail: 'support@zellavora.com',
  passwordPolicy: {
    minLength: 12,
    maxLength: 128,
    requireUppercase: true,
    requireLowercase: true,
    requireDigit: true,
    requireSymbol: true,
  },
};

async function mockRegistration(page: Page, outcome: string) {
  await page.route('**/api/v1/auth/config', (route) => route.fulfill({ json: config }));
  await page.route('**/api/v1/auth/registration/organizations', (route) =>
    route.fulfill({ json: { tenants: [{ id: 'org-1', name: 'Acme', clientCode: 'ACME' }] } })
  );
  await page.route('**/api/v1/auth/registration/organization-code**', (route) =>
    route.fulfill({ json: { code: 'new-co', available: true } })
  );
  await page.route('**/api/v1/auth/register', async (route) => {
    const body = route.request().postDataJSON();
    expect(body.registrationType).toBeTruthy();
    await route.fulfill({ status: 202, json: { registrationType: body.registrationType, outcome } });
  });
}

async function security(page: Page, submitName: RegExp) {
  await page.getByLabel('Password', { exact: true }).fill('SecurePass123!');
  await page.getByLabel('Confirm password').fill('SecurePass123!');
  await page.getByLabel(/I agree to the/i).check();
  await page.getByRole('button', { name: submitName }).click();
}

test.describe('Self-registration types', () => {
  test('organization member submits for approval', async ({ page }) => {
    await mockRegistration(page, 'PENDING_APPROVAL');
    await page.goto('/#/auth/register?type=organization-member');
    await page.getByLabel('Organization').click();
    await page.getByText(/Acme \(ACME\)/).click();
    await page.getByLabel('First name').fill('Mira');
    await page.getByLabel('Last name').fill('Patel');
    await page.getByLabel('Work email').fill('mira@example.com');
    await page.getByRole('button', { name: 'Continue' }).click();
    await security(page, /Create account/);
    await expect(page.getByText(/Awaiting approval/i)).toBeVisible();
  });

  test('individual reaches email verification', async ({ page }) => {
    await mockRegistration(page, 'PENDING_EMAIL_VERIFICATION');
    await page.goto('/#/auth/register?type=individual');
    await page.getByLabel('First name').fill('Asha');
    await page.getByLabel('Last name').fill('Rao');
    await page.getByLabel('Email', { exact: true }).fill('asha@example.com');
    await page.getByRole('button', { name: 'Continue' }).click();
    await security(page, /Create account/);
    await expect(page.getByText(/Verify your email/i)).toBeVisible();
  });

  test('organization owner sees code availability and submits', async ({ page }) => {
    await mockRegistration(page, 'PENDING_APPROVAL');
    await page.goto('/#/auth/register?type=create-organization');
    await page.getByLabel('Organization name').fill('New Co');
    const code = page.getByLabel('Organization code');
    await code.fill('new-co');
    await code.blur();
    await expect(page.getByText('new-co is available.')).toBeVisible();
    await page.getByLabel('Business email').fill('billing@example.com');
    await page.getByRole('button', { name: 'Continue' }).click();
    await page.getByLabel('First name').fill('Nila');
    await page.getByLabel('Last name').fill('Shah');
    await page.getByLabel('Work email').fill('nila@example.com');
    await page.getByRole('button', { name: 'Continue' }).click();
    await security(page, /Create organization/);
    await expect(page.getByText(/Organization submitted/i)).toBeVisible();
  });
});
