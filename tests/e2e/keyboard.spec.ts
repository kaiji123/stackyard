// Keyboard and screen-reader behaviour of the exported player.
import { expect, test, type Page } from "@playwright/test";
import { ESCAPE_IDS, UNTIL_NOTE, openOffline, pressTab, skipWelcome } from "./helpers";

async function exportHaunted(page: Page, out: (n: string) => string): Promise<string> {
  await skipWelcome(page);
  await page.goto("/");
  const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: /self-contained/ }).click()]);
  const file = out("kb.html");
  await download.saveAs(file);
  return file;
}

const focused = (p: Page) => p.evaluate(() => {
  const el = document.activeElement as HTMLElement | null;
  return { tag: el?.tagName ?? "", id: el?.dataset["id"] ?? "", cls: el?.className ?? "", inStage: !!el?.closest(".sy-stage") };
});

test("Tab, Enter, Tab lands on a button of the NEW card; the card name is announced", async ({ page, browser }, info) => {
  const file = await exportHaunted(page, (n) => info.outputPath(n));
  const { ctx, page: p } = await openOffline(browser, file);
  await expect(p.locator(".sy-stage")).toBeVisible();

  await pressTab(p, info.project.name);
  expect((await focused(p)).id).toBe("gate_go");                 // "Step inside"
  await p.keyboard.press("Enter");
  await expect(p.locator(".sy-stage")).toHaveAttribute("aria-label", "The Front Door");
  expect((await focused(p)).id).toBe("foyer_go");                // focus followed onto the next card
  await p.keyboard.press("Enter");

  // Focus moved into the new card instead of dropping to <body>.
  await expect(p.locator(".sy-stage")).toHaveAttribute("aria-label", "The Hall");
  const afterEnter = await focused(p);
  expect(afterEnter.tag).toBe("BUTTON");
  expect(afterEnter.inStage).toBe(true);
  expect(afterEnter.id).toBe("hall_lamp");                       // first interactive object of the Hall

  await pressTab(p, info.project.name);
  expect((await focused(p)).id).toBe("hall_study");              // continues from there, not from the page top

  // A screen reader hears the card name.
  await expect(p.locator('[aria-live="polite"]')).toHaveText("The Hall");
  await ctx.close();
});

test("Tab cycles only through clickable objects, never the whole card", async ({ page, browser }, info) => {
  const file = await exportHaunted(page, (n) => info.outputPath(n));
  const { ctx, page: p } = await openOffline(browser, file);
  await pressTab(p, info.project.name);
  await p.keyboard.press("Enter"); // the front door...
  await p.keyboard.press("Enter"); // ...now on the Hall: lamp, study, garden, cellar door, the portrait
  const seen: string[] = [];
  for (let i = 0; i < 10; i++) {
    const f = await focused(p);
    // <body> is fine: after the last control, Tab leaves the page and wraps. The card itself and
    // its static text must never be tab stops.
    expect(f.cls).not.toContain("sy-stage");
    if (f.id !== "hall_portrait") expect(f.cls).not.toContain("sy-text"); // the portrait label is clickable text
    expect(f.cls).not.toContain("sy-root");
    seen.push(f.id);
    await pressTab(p, info.project.name);
  }
  const clickable = new Set(["hall_lamp", "hall_study", "hall_garden", "hall_cellar", "hall_portrait"]);
  for (const id of seen) expect(clickable.has(id) || id === "", `unexpected tab stop "${id}"`).toBe(true);
  expect(new Set(seen.filter(Boolean))).toEqual(clickable);     // every clickable object is reachable
  await ctx.close();
});

test("keyboard-only play wins the escape room", async ({ page, browser }, info) => {
  const file = await exportHaunted(page, (n) => info.outputPath(n));
  const { ctx, page: p } = await openOffline(browser, file);
  const press = async (id: string): Promise<void> => {
    for (let i = 0; i < 10 && (await focused(p)).id !== id; i++) await pressTab(p, info.project.name);
    expect((await focused(p)).id).toBe(id);
    await p.keyboard.press("Enter");
  };
  for (const id of ESCAPE_IDS.slice(0, UNTIL_NOTE)) await press(id);
  await expect(p.getByText("You found a torn note!")).toBeVisible();
  for (const id of ESCAPE_IDS.slice(UNTIL_NOTE)) await press(id);
  await expect(p.getByText("You escaped!")).toBeVisible();
  await ctx.close();
});
