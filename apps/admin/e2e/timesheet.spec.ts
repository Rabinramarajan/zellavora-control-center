import { test, expect, Page } from '@playwright/test';

/**
 * Fill a month, submit it, approve it as a manager, and confirm the grid
 * locks. Credentials come from the environment so the suite can run against
 * a seeded local stack or a review deployment without edits.
 *
 *   E2E_EMPLOYEE_EMAIL / E2E_EMPLOYEE_PASSWORD
 *   E2E_MANAGER_EMAIL  / E2E_MANAGER_PASSWORD   (needs `timesheet:approve`)
 */
const EMPLOYEE = {
  email: process.env['E2E_EMPLOYEE_EMAIL'] ?? 'employee@zellavora.com',
  password: process.env['E2E_EMPLOYEE_PASSWORD'] ?? 'Password123!',
};

const MANAGER = {
  email: process.env['E2E_MANAGER_EMAIL'] ?? 'owner@zellavora.com',
  password: process.env['E2E_MANAGER_PASSWORD'] ?? 'Password123!',
};

/** A period far enough out that repeated runs do not collide with real data. */
const PERIOD = '2030-04';

const signIn = async (page: Page, user: { email: string; password: string }) => {
  await page.goto('/#/auth/login');
  await page.getByLabel(/email/i).fill(user.email);
  await page.getByLabel(/password/i).fill(user.password);
  await page.getByRole('button', { name: /sign in|log ?in/i }).click();
  await page.waitForURL(/#\/(dashboard|timesheets)/);
};

const openPeriod = async (page: Page) => {
  await page.goto(`/#/timesheets/${PERIOD}`);
  await expect(page.getByRole('heading', { name: /April 2030/i })).toBeVisible();
};

test.describe('Timesheet approval flow', () => {
  test('an employee fills and submits a month, a manager approves it', async ({ browser }) => {
    const employeeContext = await browser.newContext();
    const employeePage = await employeeContext.newPage();

    await signIn(employeePage, EMPLOYEE);
    await openPeriod(employeePage);

    // The month is generated server-side: 30 days in April.
    const rows = employeePage.locator('tbody tr');
    await expect(rows).toHaveCount(30);

    // Auto-fill every blank weekday, then check the totals bar reacts.
    await employeePage.getByRole('button', { name: 'Auto-fill weekdays' }).click();
    await employeePage.getByRole('button', { name: 'Apply' }).click();

    const totals = employeePage.getByText(/hours$/);
    await expect(totals).not.toHaveText(/^0\.00 hours$/);

    await employeePage.getByRole('button', { name: 'Submit for approval' }).click();
    await expect(employeePage.getByText(/awaiting approval/i)).toBeVisible();

    // Locked: the hours inputs are no longer editable.
    await expect(employeePage.locator('tbody tr').first().locator('input').first()).toBeDisabled();

    const managerContext = await browser.newContext();
    const managerPage = await managerContext.newPage();

    await signIn(managerPage, MANAGER);
    await openPeriod(managerPage);

    await managerPage.getByRole('button', { name: 'Approve' }).click();
    await expect(managerPage.getByText(/Approved/i).first()).toBeVisible();

    // The employee sees the approval and stays locked out of edits.
    await employeePage.reload();
    await expect(employeePage.getByText(/Approved/i).first()).toBeVisible();
    await expect(employeePage.getByRole('button', { name: 'Submit for approval' })).toBeDisabled();

    await employeeContext.close();
    await managerContext.close();
  });
});
