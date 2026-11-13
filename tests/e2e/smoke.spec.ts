// Export smoke test: every template is exported from the editor, opened over file:// while
// offline, and checked. Run with WRITE_EXAMPLES=1 to refresh the files in /examples.
import { expect, test } from "@playwright/test";
import { copyFileSync, mkdirSync } from "node:fs";
import { chooseTemplate, expectPixelFonts, openOffline, skipWelcome } from "./helpers";

const TEMPLATES = [
  ["haunted-house", "Haunted House Escape Room"],
  ["ghost-story", "The Lantern Road"],
  ["pumpkin-tutorial", "How to Carve a Pumpkin"],
  ["midnight-train", "The Midnight Train"],
  ["bestiary", "The Halloween Bestiary"],
] as const;

for (const [id, label] of TEMPLATES) {
  test(`export smoke: ${id}`, async ({ page, browser }, info) => {
    await skipWelcome(page);
    await page.goto("/");
    await chooseTemplate(page, id);
    await expect(page.getByLabel("Stack title")).toHaveValue(label);
    const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: /self-contained/ }).click()]);
    const file = info.outputPath(`${id}.html`);
    await download.saveAs(file);

    const { ctx, page: p, errs, requests } = await openOffline(browser, file, { viewport: { width: 800, height: 600 } });
    await expect(p.locator(".sy-stage .sy-obj").first()).toBeVisible();
    await expectPixelFonts(p);
    const first = await p.locator(".sy-stage .sy-btn").first();
    await first.click(); // the first button of every template leads somewhere
    expect(requests).toEqual([]);
    expect(errs).toEqual([]);
    await ctx.close();

    if (process.env["WRITE_EXAMPLES"] === "1" && info.project.name === "chromium") {
      mkdirSync("examples", { recursive: true });
      copyFileSync(file, `examples/${id}.html`);
    }
  });
}
