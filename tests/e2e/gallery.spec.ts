// "Play a stack" gallery: play any example at once without touching your own stack.
import { expect, test, type Page } from "@playwright/test";
import { cardCount, forbidNativeDialogs, skipWelcome } from "./helpers";

const openGallery = async (page: Page) => {
  await page.getByRole("button", { name: "Play an example stack" }).click();
  const dlg = page.getByRole("dialog", { name: "Play a stack" });
  await expect(dlg.locator(".tile[data-template]")).toHaveCount(5);
  return dlg;
};

const setTitle = async (page: Page, t: string): Promise<void> => {
  const box = page.getByLabel("Stack title");
  await box.fill(t);
  await box.blur();
};

test.beforeEach(async ({ page }) => { await skipWelcome(page); });

test("the gallery lists every example with a picture, its size and what it is", async ({ page }) => {
  await page.goto("/");
  const dlg = await openGallery(page);
  for (const [id, title] of [["haunted-house", "Haunted House Escape Room"], ["ghost-story", "The Lantern Road"], ["pumpkin-tutorial", "How to Carve a Pumpkin"], ["midnight-train", "The Midnight Train"], ["bestiary", "The Halloween Bestiary"]] as const) {
    const cards = cardCount(id);
    const tile = dlg.locator(`.tile[data-template="${id}"]`);
    await expect(tile).toContainText(`${title} · ${cards} cards`);
    await expect(tile.locator(".tile-pic .sy-obj").first()).toBeVisible(); // a real picture of the first card
    await expect(tile.getByRole("button", { name: /^Play / })).toBeVisible();
    await expect(tile.getByRole("button", { name: /^Edit a copy of / })).toBeVisible();
  }
  await expect(dlg.getByRole("searchbox", { name: "Search stacks" })).toBeFocused(); // desktop starts in the search box
});

test("Play opens an example full screen and leaves your own stack alone", async ({ page }) => {
  const native = forbidNativeDialogs(page);
  await page.goto("/");
  await setTitle(page, "My own stack");
  const dlg = await openGallery(page);
  await dlg.getByRole("button", { name: "Play Choose-your-path Ghost Story" }).click();

  // No "replace your stack?" question: nothing is being replaced.
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const overlay = page.locator(".play-overlay");
  await expect(overlay).toHaveAttribute("aria-label", "Playing “The Lantern Road”");
  await overlay.locator(".sy-btn", { hasText: "Follow the lights" }).click();
  await expect(overlay.getByText("A voice").first()).toBeVisible();

  // Restart restarts the example, not your stack.
  await page.getByRole("button", { name: "Restart" }).click();
  await expect(overlay.locator(".sy-btn", { hasText: "Follow the lights" })).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(overlay).toHaveCount(0);
  await expect(page.getByLabel("Stack title")).toHaveValue("My own stack");
  await expect(page.getByRole("button", { name: "Play an example stack" })).toBeFocused();
  // And the editor's Play button still plays YOUR stack.
  await page.getByRole("button", { name: "▶ Play" }).click();
  await expect(page.locator(".play-overlay")).toHaveAttribute("aria-label", "Playing “My own stack”");
  expect(native).toEqual([]);
});

test("Edit a copy asks first, then loads the example into the editor", async ({ page }) => {
  await page.goto("/");
  await setTitle(page, "Keep me");
  let dlg = await openGallery(page);
  await dlg.getByRole("button", { name: "Edit a copy of Tutorial: How to Carve a Pumpkin" }).click();
  const ask = page.getByRole("dialog", { name: "Replace your current stack?" });
  await ask.getByRole("button", { name: "Cancel" }).click();
  await expect(page.getByLabel("Stack title")).toHaveValue("Keep me");

  dlg = await openGallery(page);
  await dlg.getByRole("button", { name: "Edit a copy of Tutorial: How to Carve a Pumpkin" }).click();
  await ask.getByRole("button", { name: "Replace", exact: true }).click();
  await expect(page.getByLabel("Stack title")).toHaveValue("How to Carve a Pumpkin");
  await expect(page.locator(".card-item")).toHaveCount(cardCount("pumpkin-tutorial"));
});

test("Play yours plays your own stack from the gallery", async ({ page }) => {
  await page.goto("/");
  await setTitle(page, "Mine");
  const dlg = await openGallery(page);
  await dlg.getByRole("button", { name: "▶ Play yours" }).click();
  await expect(page.locator(".play-overlay")).toHaveAttribute("aria-label", "Playing “Mine”");
});

test("first-run welcome offers the examples", async ({ browser }) => {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto("/");
  await page.getByRole("dialog", { name: /first card in 30 seconds/i }).getByRole("button", { name: "Play an example stack" }).click();
  await expect(page.getByRole("dialog", { name: "Play a stack" }).locator(".tile[data-template]")).toHaveCount(5);
  await ctx.close();
});

test.describe("searching the gallery", () => {
  const visible = async (page: Page): Promise<string[]> =>
    page.locator(".tile[data-template]:visible").evaluateAll((els) => els.map((e) => e.getAttribute("data-template") ?? ""));

  test("filters as you type, by title, description, tag, or anything inside a stack", async ({ page }) => {
    await page.goto("/");
    const dlg = await openGallery(page);
    const box = dlg.getByRole("searchbox", { name: "Search stacks" });
    await expect(dlg.getByRole("status")).toHaveText("5 stacks");

    await box.fill("train");
    expect(await visible(page)).toEqual(["midnight-train"]);
    await expect(dlg.getByRole("status")).toHaveText("1 of 5 stacks");

    await box.fill("QUIZ");                      // case does not matter
    expect(await visible(page)).toEqual(["pumpkin-tutorial"]);

    await box.fill("escape room");               // a tag
    expect(await visible(page)).toEqual(["haunted-house"]);

    await box.fill("dog");                       // only inside the stack: says where
    expect(await visible(page)).toEqual(["midnight-train"]);
    await expect(dlg.locator('.tile[data-template="midnight-train"] .why')).toHaveText("Found on the card “The Luggage Van”") // the first card that mentions the dog;

    await box.fill("eleanor");                   // a character in two stacks
    expect((await visible(page)).sort()).toEqual(["ghost-story", "haunted-house"]);

    await box.fill("");
    expect(await visible(page)).toHaveLength(5);
    await expect(dlg.locator(".why:visible")).toHaveCount(0);
  });

  test("no results shows a way back, Esc clears before it closes, Enter goes to the first Play", async ({ page }) => {
    await page.goto("/");
    const dlg = await openGallery(page);
    const box = dlg.getByRole("searchbox", { name: "Search stacks" });

    await box.fill("submarine");
    expect(await visible(page)).toEqual([]);
    await expect(dlg.getByText("No stack matches that.")).toBeVisible();
    await dlg.getByRole("button", { name: "Clear search" }).click();
    expect(await visible(page)).toHaveLength(5);
    await expect(box).toBeFocused();

    await box.fill("pumpkin");
    await page.keyboard.press("Escape");
    await expect(dlg).toBeVisible();             // first Esc only clears the search
    await expect(box).toHaveValue("");

    await box.fill("five endings");             // only the ghost story says that
    expect(await visible(page)).toEqual(["ghost-story"]);
    await page.keyboard.press("Enter");
    await expect(dlg.getByRole("button", { name: "Play Choose-your-path Ghost Story" })).toBeFocused();
    await page.keyboard.press("Enter");          // and plays it
    await expect(page.locator(".play-overlay")).toHaveAttribute("aria-label", "Playing “The Lantern Road”");
  });

  test("an empty box and Esc closes the gallery", async ({ page }) => {
    await page.goto("/");
    const dlg = await openGallery(page);
    await page.keyboard.press("Escape");
    await expect(dlg).toHaveCount(0);
  });

  test("an untitled stack is named as such, not as empty quotes", async ({ page }) => {
    await page.goto("/");
    await setTitle(page, "");
    const dlg = await openGallery(page);
    await expect(dlg.locator(".mine")).toContainText("Untitled stack");
  });
});

test("the search box is readable: light text on the dark field, and results keep their size", async ({ page }) => {
  await skipWelcome(page);
  await page.goto("/");
  const dlg = await openGallery(page);
  const box = dlg.getByRole("searchbox", { name: "Search stacks" });
  const [fg, bg] = await box.evaluate((el) => [getComputedStyle(el).color, getComputedStyle(el).backgroundColor]);
  const lum = (c: string): number => {
    const [r, g, b] = (c.match(/\d+/g) ?? []).map(Number) as [number, number, number];
    const f = (v: number): number => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };
  const ratio = (Math.max(lum(fg), lum(bg)) + 0.05) / (Math.min(lum(fg), lum(bg)) + 0.05);
  expect(ratio, `contrast of ${fg} on ${bg}`).toBeGreaterThan(7);
  const before = (await dlg.locator(".tile[data-template]").first().boundingBox())!.width;
  await box.fill("eleanor");
  const after = (await dlg.locator(".tile[data-template]:visible").first().boundingBox())!.width;
  expect(Math.abs(after - before)).toBeLessThan(2);
});
