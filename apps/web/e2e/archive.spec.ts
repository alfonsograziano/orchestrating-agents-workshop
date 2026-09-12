import { expect, test } from '@playwright/test';
import { resetGarden } from './reset.ts';

async function plant(page: import('@playwright/test').Page, title: string, description: string) {
  await page.getByRole('button', { name: /^plant new seed$/i }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel(/title/i).fill(title);
  await dialog.getByLabel(/description/i).fill(description);
  await dialog.getByRole('button', { name: /^plant$/i }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: title })).toBeVisible();
}

async function openCard(page: import('@playwright/test').Page, title: string) {
  await page.getByRole('button', { name: new RegExp(title, 'i') }).first().click();
  await expect(page.getByRole('dialog')).toBeVisible();
}

async function headerMenu(page: import('@playwright/test').Page) {
  await page.getByRole('button', { name: /more options/i }).first().click();
}

test.describe('Idea Garden — archive (spec 004)', () => {
  // Start from an empty garden regardless of which spec file ran first.
  test.beforeEach(async ({ request }) => {
    await resetGarden(request);
  });

  test('archive → read in the archive → unarchive → water again', async ({ page }) => {
    await page.goto('/app');

    // ---------- Two ideas in the garden, one of them watered twice ----------
    await plant(page, 'Idea to archive', 'This one gets set aside.');
    await plant(page, 'Idea to keep', 'This one stays in the garden.');

    await openCard(page, 'Idea to archive');
    const dialog = page.getByRole('dialog');
    for (const note of ['first watering', 'second watering']) {
      await dialog.getByLabel(/water this idea/i).fill(note);
      await dialog.getByRole('button', { name: /^water$/i }).click();
      await expect(dialog.getByText(note)).toBeVisible();
    }
    await expect(dialog.getByLabel(/idea identity/i).getByText('Level 3')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);

    // ---------- Archive it (US1) ----------
    await openCard(page, 'Idea to archive');
    await headerMenu(page);
    // The garden offers no permanent deletion at all (FR-019).
    await expect(page.getByRole('menuitem', { name: /delete/i })).toHaveCount(0);
    await page.getByRole('menuitem', { name: /archive idea/i }).click();

    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Idea to archive' })).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Idea to keep' })).toBeVisible();

    // The count follows the grid.
    await expect(page.getByText(/^01$/)).toBeVisible();

    // ---------- It survives a reload on both sides (SC-001) ----------
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Idea to archive' })).toHaveCount(0);

    // ---------- Read it in the archive (US2) ----------
    await page.getByRole('link', { name: /^archive$/i }).click();
    await expect(page).toHaveURL(/\/app\/archive$/);
    await expect(page.getByRole('heading', { name: 'Idea to archive' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Idea to keep' })).toHaveCount(0);
    await expect(page.getByText(/frozen at level 3/i)).toBeVisible();

    await openCard(page, 'Idea to archive');
    const archivedDialog = page.getByRole('dialog');
    await expect(archivedDialog.getByText('This one gets set aside.')).toBeVisible();
    await expect(archivedDialog.getByText('first watering')).toBeVisible();
    await expect(archivedDialog.getByText('second watering')).toBeVisible();
    // Nothing on screen can change it (FR-016).
    await expect(archivedDialog.getByRole('button', { name: /^edit$/i })).toHaveCount(0);
    await expect(archivedDialog.getByRole('textbox')).toHaveCount(0);
    await expect(archivedDialog.getByRole('button', { name: /^water$/i })).toHaveCount(0);
    await expect(archivedDialog.getByText(/frozen in the archive/i)).toBeVisible();

    // ---------- Bring it back (US3) ----------
    await headerMenu(page);
    await page.getByRole('menuitem', { name: /unarchive idea/i }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.getByRole('heading', { name: /archive is empty/i })).toBeVisible();

    await page.getByRole('link', { name: /back to the garden/i }).first().click();
    await expect(page).toHaveURL(/\/app$/);
    await expect(page.getByRole('heading', { name: 'Idea to archive' })).toBeVisible();

    // Same stage, same history, waterable again (SC-004).
    await openCard(page, 'Idea to archive');
    const restored = page.getByRole('dialog');
    await expect(restored.getByLabel(/idea identity/i).getByText('Level 3')).toBeVisible();
    await expect(restored.getByText('first watering')).toBeVisible();
    await restored.getByLabel(/water this idea/i).fill('back in the garden');
    await restored.getByRole('button', { name: /^water$/i }).click();
    await expect(restored.getByLabel(/idea identity/i).getByText('Level 4')).toBeVisible();
  });

  test('delete an archived idea for good (US4)', async ({ page }) => {
    await page.goto('/app');
    await plant(page, 'Worthless idea', 'Not worth keeping.');

    await openCard(page, 'Worthless idea');
    await headerMenu(page);
    await page.getByRole('menuitem', { name: /archive idea/i }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);

    await page.getByRole('link', { name: /^archive$/i }).click();
    await openCard(page, 'Worthless idea');
    await headerMenu(page);
    await page.getByRole('menuitem', { name: /delete forever/i }).click();
    await page.getByRole('button', { name: /yes, delete forever/i }).click();

    await expect(page.getByRole('heading', { name: /archive is empty/i })).toBeVisible();

    // Gone from both sides after a reload (SC-006).
    await page.reload();
    await expect(page.getByRole('heading', { name: /archive is empty/i })).toBeVisible();
    await page.getByRole('link', { name: /back to the garden/i }).first().click();
    await expect(page.getByRole('heading', { name: 'Worthless idea' })).toHaveCount(0);
  });
});
