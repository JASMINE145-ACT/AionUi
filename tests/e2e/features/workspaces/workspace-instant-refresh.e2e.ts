/**
 * E2E: Workspace file tree instant refresh when new files appear.
 *
 * Flow:
 *   1. open a conversation with a workspace (ChatWorkspace mounts watch lifecycle)
 *   2. backend office-watch detects new file Create
 *   3. renderer receives workspaceOfficeWatch.fileAdded
 *   4. workspace tree shows the new file without clicking refresh
 */
import fs from 'fs';
import os from 'os';
import path from 'path';
import { test, expect } from '../../fixtures';
import { goToGuid } from '../../helpers';

async function createConversationWithWorkspace(
  page: import('@playwright/test').Page,
  workspace: string
): Promise<string> {
  await goToGuid(page);

  const conversationId = await page.evaluate(
    async ({ workspacePath }) => {
      const port = (window as unknown as { __backendPort?: number }).__backendPort;
      if (!port) {
        throw new Error('window.__backendPort is not available');
      }

      const response = await fetch(`http://127.0.0.1:${port}/api/conversations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'acp',
          name: `E2E workspace instant refresh ${Date.now()}`,
          extra: {
            workspace: workspacePath,
            custom_workspace: true,
            backend: 'claude',
          },
        }),
      });

      if (!response.ok) {
        const body = await response.text();
        throw new Error(`POST /api/conversations failed (${response.status}): ${body}`);
      }

      const json = (await response.json()) as { data?: { id?: string } };
      const id = json?.data?.id;
      if (!id) {
        throw new Error('Conversation create response did not include an id');
      }

      window.location.assign(`#/conversation/${id}`);
      return id;
    },
    { workspacePath: workspace }
  );

  await page.waitForFunction((id) => window.location.hash === `#/conversation/${id}`, conversationId, {
    timeout: 15_000,
  });

  await expect(page.locator('.chat-workspace')).toBeVisible({ timeout: 30_000 });
  return conversationId;
}

async function deleteConversation(page: import('@playwright/test').Page, conversationId: string): Promise<void> {
  await page.evaluate(
    async ({ id }) => {
      const port = (window as unknown as { __backendPort?: number }).__backendPort;
      if (!port) return;

      await fetch(`http://127.0.0.1:${port}/api/conversations/${encodeURIComponent(id)}`, {
        method: 'DELETE',
      }).catch(() => {});
    },
    { id: conversationId }
  );
}

test.describe('Workspace instant file refresh', () => {
  test('root-level xlsx appears in tree without manual refresh', async ({ page }) => {
    test.setTimeout(120_000);

    const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'aionui-e2e-ws-instant-'));
    fs.writeFileSync(path.join(workspace, 'seed.txt'), 'seed');
    let conversationId: string | null = null;

    try {
      conversationId = await createConversationWithWorkspace(page, workspace);

      const tree = page.locator('.workspace-tree');
      await expect(tree).toBeVisible({ timeout: 10_000 });

      // Allow watch lifecycle + baseline to settle
      await page.waitForTimeout(2_000);

      const fileName = 'instant-report.xlsx';
      fs.writeFileSync(path.join(workspace, fileName), 'stub');

      await expect(tree.getByText(fileName)).toBeVisible({ timeout: 5_000 });
    } finally {
      if (conversationId) {
        await deleteConversation(page, conversationId);
      }
      fs.rmSync(workspace, { recursive: true, force: true });
    }
  });

  test('nested xlsx appears in tree without manual refresh', async ({ page }) => {
    test.setTimeout(120_000);

    const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'aionui-e2e-ws-instant-sub-'));
    const notesDir = path.join(workspace, 'notes');
    fs.mkdirSync(notesDir, { recursive: true });
    fs.writeFileSync(path.join(workspace, 'seed.txt'), 'seed');
    let conversationId: string | null = null;

    try {
      conversationId = await createConversationWithWorkspace(page, workspace);

      const tree = page.locator('.workspace-tree');
      await expect(tree).toBeVisible({ timeout: 10_000 });
      await page.waitForTimeout(2_000);

      const fileName = 'nested-sheet.xlsx';
      fs.writeFileSync(path.join(notesDir, fileName), 'stub');

      await expect(tree.getByText('notes')).toBeVisible({ timeout: 5_000 });
      await expect(tree.getByText(fileName)).toBeVisible({ timeout: 5_000 });
    } finally {
      if (conversationId) {
        await deleteConversation(page, conversationId);
      }
      fs.rmSync(workspace, { recursive: true, force: true });
    }
  });

  test('root-level md appears in tree without manual refresh', async ({ page }) => {
    test.setTimeout(120_000);

    const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'aionui-e2e-ws-instant-md-'));
    fs.writeFileSync(path.join(workspace, 'seed.txt'), 'seed');
    let conversationId: string | null = null;

    try {
      conversationId = await createConversationWithWorkspace(page, workspace);

      const tree = page.locator('.workspace-tree');
      await expect(tree).toBeVisible({ timeout: 10_000 });
      await page.waitForTimeout(2_000);

      const fileName = 'instant-notes.md';
      fs.writeFileSync(path.join(workspace, fileName), '# hello');

      await expect(tree.getByText(fileName)).toBeVisible({ timeout: 5_000 });
    } finally {
      if (conversationId) {
        await deleteConversation(page, conversationId);
      }
      fs.rmSync(workspace, { recursive: true, force: true });
    }
  });
});
