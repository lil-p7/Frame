import { expect, test, type Locator, type Page } from "@playwright/test";

const appBaseUrl = process.env.FRAME_TEST_BASE_URL ?? "http://localhost:4321";

async function dragTo(page: Page, source: Locator, target: Locator): Promise<void> {
  const sourceBox = await source.boundingBox();
  const targetBox = await target.boundingBox();
  if (sourceBox === null || targetBox === null) throw new Error("Drag source or target is not visible");
  const startX = sourceBox.x + 12;
  const startY = sourceBox.y + sourceBox.height / 2;
  const targetX = Math.min(Math.max(targetBox.x + targetBox.width / 2, 2), (await page.evaluate(() => innerWidth)) - 2);
  const targetY = Math.min(Math.max(targetBox.y + targetBox.height / 2, 2), (await page.evaluate(() => innerHeight)) - 2);
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(startX + 8, startY, { steps: 2 });
  await page.waitForTimeout(100);
  await page.mouse.move(targetX, targetY, { steps: 20 });
  await page.waitForTimeout(100);
  await page.mouse.up();
}

test("critical journey: dashboard → create project → edit → preview → export", async ({ page }) => {
  await page.goto(`${appBaseUrl}/`);
  await expect(page).toHaveTitle(/Frame/);
  await page.getByRole("button", { name: /create your first project/i }).click();
  await page.getByPlaceholder("Portfolio Website").fill("Test Portfolio");
  await page.getByRole("button", { name: /create project/i }).click();

  await expect(page.getByRole("button", { name: "Test Portfolio" })).toBeVisible();
  const componentsTab = page.getByRole("tab", { name: "Components" });
  await componentsTab.click();
  const sectionLibraryItem = page.getByRole("button", { name: "Insert Section" });
  const documentViewport = page.getByTestId("document-viewport");
  await dragTo(page, sectionLibraryItem, documentViewport);
  const sectionNodes = page.locator('[data-testid="canvas-node"][data-node-type="section"]');
  await expect(sectionNodes).toHaveCount(1);
  const firstSectionId = await sectionNodes.first().getAttribute("data-node-id");
  if (firstSectionId === null) throw new Error("Inserted section has no node ID");

  // A second real library drag verifies root insertion, then dragging its
  // layer handle before the first row verifies reorder uses the same tree.
  await dragTo(page, sectionLibraryItem, documentViewport);
  await expect(sectionNodes).toHaveCount(2);
  const secondSectionId = await sectionNodes.nth(1).getAttribute("data-node-id");
  if (secondSectionId === null) throw new Error("Second section has no node ID");

  await page.getByRole("tab", { name: "Layers" }).click();
  const firstSectionRow = page.locator(`[data-testid="layer-row"][data-node-id="${firstSectionId}"]`);
  const secondSectionRow = page.locator(`[data-testid="layer-row"][data-node-id="${secondSectionId}"]`);
  const secondGrip = secondSectionRow.getByTestId("layer-drag-handle");
  await secondGrip.hover();
  const gripBox = await secondGrip.boundingBox();
  const firstSectionRowBox = await firstSectionRow.boundingBox();
  if (gripBox === null || firstSectionRowBox === null) {
    throw new Error("Section layer rows are not visible");
  }
  // Grab the row's dedicated grip handle (rows themselves only select).
  const gripX = gripBox.x + gripBox.width / 2;
  const gripY = gripBox.y + gripBox.height / 2;
  await page.mouse.move(gripX, gripY);
  await page.mouse.down();
  await page.mouse.move(gripX + 4, gripY, { steps: 2 });
  await page.waitForTimeout(80);
  // Drop at the top edge of the first row: "before" this sibling (§15).
  await page.mouse.move(firstSectionRowBox.x + 40, firstSectionRowBox.y + 3, { steps: 12 });
  await page.waitForTimeout(80);
  await page.mouse.up();
  await expect.poll(() =>
    page.locator('[data-testid="layer-row"][aria-level="2"]').evaluateAll((rows) =>
      rows.map((row) => row.getAttribute("data-node-id")),
    ),
  ).toEqual([secondSectionId, firstSectionId]);

  await page.getByRole("tab", { name: "Components" }).click();
  const sectionNode = page.locator(`[data-testid="canvas-node"][data-node-id="${firstSectionId}"]`);
  const headingLibraryItem = page.getByRole("button", { name: "Insert Heading" });
  await dragTo(page, headingLibraryItem, sectionNode);

  const headingNode = page.locator('[data-testid="canvas-node"][data-node-type="heading"]');
  await expect(headingNode).toBeVisible();
  await headingNode.click();
  await page.getByLabel("Text", { exact: true }).fill("My Portfolio");
  await expect(page.locator('h2[data-component="heading"]')).toContainText("My Portfolio");
  await expect(page.getByTestId("save-status")).toHaveText("Saved", { timeout: 10_000 });

  await componentsTab.click();
  await page.getByRole("button", { name: "Insert Button" }).click();
  const canvasButton = page.locator('[data-testid="canvas-node"][data-node-type="button"]');
  await expect(canvasButton).toBeVisible();
  await page.getByTestId("undo").click();
  await expect(canvasButton).toHaveCount(0);
  await page.getByTestId("redo").click();
  await expect(canvasButton).toBeVisible();

  await page.getByRole("button", { name: "Tablet viewport" }).click();
  await expect(page.getByTestId("document-viewport")).toHaveAttribute("data-breakpoint", "tablet");
  await expect(page.getByTestId("save-status")).toHaveText("Saved", { timeout: 10_000 });

  await page.reload();
  await expect(page).toHaveURL(/\/editor\//);
  await expect(page.locator('h2[data-component="heading"]')).toContainText("My Portfolio");
  await expect(page.locator('[data-testid="canvas-node"][data-node-type="button"]')).toBeVisible();

  await page.getByTestId("preview-button").click();
  await expect(page).toHaveURL(/\/preview\//);
  await expect(page.getByTestId("preview-canvas")).toBeVisible();
  await expect(page.getByRole("heading", { name: "My Portfolio", level: 2 })).toBeVisible();
  await expect(page.getByTestId("undo")).toHaveCount(0);
  await page.getByTestId("back-to-editor").click();
  await expect(page).toHaveURL(/\/editor\//);

  const downloadPromise = page.waitForEvent("download");
  await page.getByTestId("export-button").click();
  await expect(page.getByTestId("export-validation-ready")).toBeVisible({ timeout: 10_000 });
  await page.getByTestId("export-confirm").click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/\.zip$/);
  await download.saveAs("test-results/frame-export.zip");
  await expect(page.getByRole("status").filter({ hasText: "Downloaded" })).toBeVisible();
});
