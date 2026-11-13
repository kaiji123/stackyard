// Data-safety and file-handling checks: import/replace, delete card, exact size, tricky titles.
import { expect, test, type Page } from "@playwright/test";
import { statSync } from "node:fs";
import { chooseTemplate, forbidNativeDialogs, HAUNTED_CARDS, openOffline, pressTab, skipWelcome } from "./helpers";

async function exportTo(page: Page, path: (name: string) => string) {
  const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: /self-contained/ }).click()]);
  const file = path(download.suggestedFilename());
  await download.saveAs(file);
  return { file, name: download.suggestedFilename() };
}

const setTitle = async (page: Page, t: string): Promise<void> => {
  const box = page.getByLabel("Stack title");
  await box.fill(t);
  await box.blur();
};

test.beforeEach(async ({ page }) => { await skipWelcome(page); });

test("importing asks first, can be cancelled, is undoable and recoverable", async ({ page }, info) => {
  const native = forbidNativeDialogs(page);
  await page.goto("/");
  const { file } = await exportTo(page, (n) => info.outputPath(n));
  await setTitle(page, "My unsaved work");

  const importFile = (): Promise<void> => page.locator('input[type=file][accept*=".html"]').setInputFiles(file);
  const dlg = page.getByRole("dialog", { name: "Replace your current stack?" });

  // Cancel keeps everything.
  await importFile();
  await expect(dlg).toBeVisible();
  await expect(dlg).toContainText("My unsaved work");
  await dlg.getByRole("button", { name: "Cancel" }).click();
  await expect(page.getByLabel("Stack title")).toHaveValue("My unsaved work");

  // Esc also cancels.
  await importFile();
  await expect(dlg).toBeVisible(); // the dialog opens after the file is read
  await page.keyboard.press("Escape");
  await expect(dlg).toHaveCount(0);
  await expect(page.getByLabel("Stack title")).toHaveValue("My unsaved work");

  // Replace, then undo brings the work back.
  await importFile();
  await expect(dlg).toBeVisible();
  await dlg.getByRole("button", { name: "Replace", exact: true }).click();
  await expect(page.getByLabel("Stack title")).toHaveValue("Haunted House Escape Room");
  await page.getByRole("button", { name: "Undo (Ctrl+Z)" }).click();
  await expect(page.getByLabel("Stack title")).toHaveValue("My unsaved work");
  await page.getByRole("button", { name: "Redo (Ctrl+Shift+Z)" }).click();

  // And after a reload the replaced stack is still available under "Previous".
  await expect(page.getByRole("button", { name: /Restore the stack you replaced/ })).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: /Restore the stack you replaced/ }).click();
  await expect(page.getByLabel("Stack title")).toHaveValue("My unsaved work");
  expect(native).toEqual([]);
});

test("a bad file is explained in the app's own dialog, not a browser popup", async ({ page }) => {
  const native = forbidNativeDialogs(page);
  await page.goto("/");
  await page.locator('input[type=file][accept*=".html"]').setInputFiles({ name: "nope.html", mimeType: "text/html", buffer: Buffer.from("<p>not a stack</p>") });
  const dlg = page.getByRole("dialog", { name: "Could not import that file" });
  await expect(dlg).toContainText("No Stackyard data");
  await page.keyboard.press("Enter"); // OK is focused
  await expect(dlg).toHaveCount(0);
  await expect(page.getByLabel("Stack title")).toHaveValue("Haunted House Escape Room");
  expect(native).toEqual([]);
});

test("dialogs keep keyboard focus inside while open", async ({ page }, info) => {
  await page.goto("/");
  await page.getByRole("button", { name: /About Stackyard/ }).click();
  const dlg = page.getByRole("dialog", { name: "About Stackyard" });
  for (let i = 0; i < 6; i++) {
    await pressTab(page, info.project.name);
    expect(await page.evaluate(() => !!document.activeElement?.closest("dialog"))).toBe(true);
  }
  await pressTab(page, info.project.name, true); // and backwards
  expect(await page.evaluate(() => !!document.activeElement?.closest("dialog"))).toBe(true);
  await page.keyboard.press("Escape");
  await expect(dlg).toHaveCount(0);
});

test("deleting a card shows who links to it, predicts the damage, and can redirect the links", async ({ page }) => {
  const native = forbidNativeDialogs(page);
  await page.goto("/");
  await page.locator(".card-item").filter({ has: page.locator(".card-name", { hasText: /^\d+\. The Hall$/ }) }).click();
  await page.getByRole("button", { name: "Delete card" }).click();
  const dlg = page.getByRole("dialog", { name: /Delete “The Hall”/ });
  await expect(dlg).toContainText("Find a light");     // the front door leads here
  await expect(dlg).toContainText("Back to hall");     // so does the Study's
  await expect(dlg).toContainText("Back inside");      // and the Garden's
  await expect(dlg).toContainText("will become unreachable");
  await expect(dlg.getByRole("button", { name: "Cancel" })).toBeFocused(); // risky action: Cancel first

  // Redirecting the links to the Study keeps those buttons working.
  await dlg.getByLabel("Send those buttons to").selectOption({ label: "The Study" });
  await expect(dlg.locator(".impact")).not.toContainText("will do nothing");
  await dlg.getByRole("button", { name: "Delete card" }).click();
  await expect(page.locator(".card-item")).toHaveCount(HAUNTED_CARDS - 1);
  await expect(page.locator(".issues")).not.toContainText("does nothing");

  // One undo restores the card AND the original links.
  await page.getByRole("button", { name: "Undo (Ctrl+Z)" }).click();
  await expect(page.locator(".card-item")).toHaveCount(HAUNTED_CARDS);
  expect(native).toEqual([]);
});

test("the size meter shows the real exported file size", async ({ page }, info) => {
  await page.goto("/");
  const { file } = await exportTo(page, (n) => info.outputPath(n));
  const bytes = statSync(file).size;
  const shown = bytes > 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
  await expect(page.locator(".status")).toContainText(`Export size ${shown}`); // no "≈": it is measured
});

const TITLES = [
  "</script><script>window.__pwned=1</script>",
  "<img src=x onerror=window.__pwned=1>",
  "幽霊の家",
  "مرحبا",
  "a\u2028b",
  "😀 emoji & <b>bold</b>",
  "",
];

for (const t of TITLES) {
  test(`tricky title survives export: ${JSON.stringify(t).slice(0, 40)}`, async ({ page, browser }, info) => {
    await page.goto("/");
    await setTitle(page, t);
    const { file, name } = await exportTo(page, (n) => info.outputPath(`${Math.abs(hash(t))}-${n}`));

    // File name: readable for any script, "stack" only when nothing usable is left.
    if (t === "幽霊の家") expect(name).toBe("幽霊の家.html");
    if (t === "مرحبا") expect(name).toBe("مرحبا.html");
    if (t === "") expect(name).toBe("stack.html");

    // Opened offline: no injected script runs, the page is still the player, <title> is plain text.
    const { ctx, page: p, errs, requests } = await openOffline(browser, file);
    await expect(p.locator(".sy-stage")).toBeVisible();
    expect(await p.evaluate(() => (window as unknown as { __pwned?: number }).__pwned)).toBeUndefined();
    expect(await p.locator("script").count()).toBe(2);
    const expectedTitle = t.replace(/[\u0000-\u001f\u007f\u2028\u2029]/g, " ").replace(/[ \t\n\f\r]+/g, " ").replace(/^ | $/g, "");
    expect(await p.title()).toBe(expectedTitle);
    expect(requests).toEqual([]);
    expect(errs).toEqual([]);
    await ctx.close();

    // Round trip through the editor keeps the title exactly.
    await setTitle(page, "something else");
    await page.locator('input[type=file][accept*=".html"]').setInputFiles(file);
    await page.getByRole("dialog", { name: "Replace your current stack?" }).getByRole("button", { name: "Replace", exact: true }).click();
    await expect(page.getByLabel("Stack title")).toHaveValue(t);
  });
}

function hash(s: string): number {
  let h = 0;
  for (const c of s) h = (h * 31 + c.codePointAt(0)!) | 0;
  return h;
}

test("choosing a template asks first and Cancel changes nothing", async ({ page }) => {
  await page.goto("/");
  await setTitle(page, "Keep me");
  await page.getByLabel("New from template").selectOption("ghost-story");
  await page.getByRole("dialog", { name: "Replace your current stack?" }).getByRole("button", { name: "Cancel" }).click();
  await expect(page.getByLabel("Stack title")).toHaveValue("Keep me");
  await chooseTemplate(page, "ghost-story");
  await expect(page.getByLabel("Stack title")).toHaveValue("The Lantern Road");
});
