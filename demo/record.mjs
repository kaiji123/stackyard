// Records the real app for the demo video. Every clip is scripted, so a re-run gives the same footage.
//
//   npm run dev                      (the editor on http://localhost:5173)
//   node demo/record.mjs [clip ...]  (all clips, or just the named ones)
//
// Frames come from the Chrome DevTools screencast as PNG (lossless: the pixel art stays sharp, which
// Playwright's own VP9 recorder smears), then ffmpeg turns them into constant-30fps H.264 clips in
// demo/video/assets/. A drawn cursor is added to the page during recording only; the app has none.
import { chromium } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, "video", "assets");
const TMP = join(HERE, ".frames");
const APP = process.env.APP_URL ?? "http://localhost:5173/";
const FPS = 30;
mkdirSync(OUT, { recursive: true });

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
/** Named moments in the clip being captured, saved next to it so captions can line up with the footage. */
let marks = [];
const mark = (label) => marks.push([label, Date.now() / 1000]);

/** The demo cursor: a pixel arrow (ours, not any OS cursor) or a tap dot, kept above dialogs and fullscreen. */
function cursorScript(mode) {
  const install = () => {
    if (document.getElementById("__demo_cursor")) return;
    const c = document.createElement("div");
    c.id = "__demo_cursor";
    c.setAttribute("popover", "manual");
    const arrow = mode === "arrow";
    c.style.cssText = [
      "position:fixed", "inset:auto", "left:0", "top:0", "margin:0", "padding:0", "border:0", "background:transparent",
      "pointer-events:none", "overflow:visible", "width:40px", "height:40px", "transform:translate(-100px,-100px)",
    ].join(";");
    c.innerHTML = arrow
      ? '<svg width="34" height="40" viewBox="0 0 17 20" shape-rendering="crispEdges"><path fill="#0d0814" d="M0 0h2v1h1v1h1v1h1v1h1v1h1v1h1v1h1v1h1v1h1v1h1v2H8v1h1v2h1v2H8v1H6v-2H5v-2H4v1H3v1H2v1H0z"/><path fill="#ffd66b" d="M2 2h1v1h1v1h1v1h1v1h1v1h1v1h1v1h1v1h1v1H7v2h1v2h1v1H8v-1H7v-2H6v-2H5v1H4v1H3v1H2z"/></svg><i></i>'
      : "<i></i>";
    // Static, trusted markup written by this script (no user content).
    const ring = c.querySelector("i");
    ring.style.cssText = `position:absolute;left:${arrow ? -14 : -22}px;top:${arrow ? -14 : -22}px;width:${arrow ? 28 : 44}px;height:${arrow ? 28 : 44}px;border:4px solid #ff9d3c;border-radius:50%;opacity:${arrow ? 0 : 0};transition:opacity .25s, transform .25s;transform:scale(.5)`;
    document.documentElement.append(c);
    const raise = () => { try { c.hidePopover(); c.showPopover(); } catch { /* not supported */ } };
    raise();
    let x = -100, y = -100;
    const place = () => { c.style.transform = `translate(${x}px,${y}px)`; };
    addEventListener("pointermove", (e) => { x = e.clientX; y = e.clientY; place(); }, true);
    addEventListener("pointerdown", (e) => {
      x = e.clientX; y = e.clientY; place(); raise();
      ring.style.transition = "none"; ring.style.opacity = "1"; ring.style.transform = "scale(.5)";
      requestAnimationFrame(() => { ring.style.transition = "opacity .35s, transform .35s"; ring.style.opacity = "0"; ring.style.transform = "scale(1.4)"; });
    }, true);
    new MutationObserver(raise).observe(document.documentElement, { subtree: true, attributes: true, attributeFilter: ["open", "class"], childList: true });
    document.addEventListener("fullscreenchange", raise);
  };
  if (document.readyState === "loading") addEventListener("DOMContentLoaded", install); else install();
}

/** One recording session on a page: smooth pointer moves, visible clicks, human-speed typing. */
function director(page) {
  let mx = 960, my = 540;
  const glide = async (x, y, ms = 420) => {
    const steps = Math.max(6, Math.round(ms / 16));
    const sx = mx, sy = my;
    for (let i = 1; i <= steps; i++) {
      const t = i / steps, e = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
      await page.mouse.move(sx + (x - sx) * e, sy + (y - sy) * e);
      await wait(14);
    }
    mx = x; my = y;
  };
  const centre = async (loc) => {
    await loc.scrollIntoViewIfNeeded({ timeout: 1500 }).catch(() => undefined); // moving objects are never "stable"
    const b = await loc.boundingBox();
    if (!b) throw new Error(`not visible: ${loc}`);
    return [b.x + b.width / 2, b.y + b.height / 2];
  };
  const to = async (loc, ms) => { const [x, y] = await centre(loc); await glide(x, y, ms); };
  return {
    page, glide, to,
    pos: () => [mx, my],
    async click(loc, { before = 140, after = 380 } = {}) {
      await to(loc); await wait(before);
      await page.mouse.down(); await wait(60); await page.mouse.up();
      await wait(after);
    },
    async type(loc, text, { delay = 55, after = 300 } = {}) {
      await this.click(loc, { after: 120 });
      await page.keyboard.press("ControlOrMeta+A");
      await page.keyboard.press("Backspace");
      await page.keyboard.type(text, { delay });
      await page.keyboard.press("Tab");
      await wait(after);
    },
    async choose(loc, value, { after = 450 } = {}) {
      await to(loc); await wait(140);
      await page.mouse.down(); await wait(60); await page.mouse.up(); // the ring shows; the native list never renders headless
      await loc.selectOption(value);
      await wait(after);
    },
    async drag(from, [x, y], ms = 600) {
      await to(from); await wait(120);
      await page.mouse.down();
      await glide(x, y, ms);
      await page.mouse.up(); await wait(300);
    },
    async tap(loc, after = 700) { // phone: a tap dot, no gliding arrow
      const [x, y] = await centre(loc);
      await page.mouse.move(x, y); mx = x; my = y; await wait(250);
      await page.mouse.down(); await wait(60); await page.mouse.up();
      await wait(after);
    },
  };
}

/** Screencast `fn` into demo/video/assets/<name>.mp4 (constant frame rate, H.264, lossless-looking). */
async function capture(page, name, fn, size, up = 1, speed = 1) {
  const dir = join(TMP, name);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  const cdp = await page.context().newCDPSession(page);
  const stamps = [];
  let writes = Promise.resolve();
  cdp.on("Page.screencastFrame", ({ data, metadata, sessionId }) => {
    const i = stamps.length;
    stamps.push(metadata.timestamp ?? Date.now() / 1000);
    writes = writes.then(() => writeFileSync(join(dir, `${String(i).padStart(5, "0")}.png`), Buffer.from(data, "base64")));
    cdp.send("Page.screencastFrameAck", { sessionId }).catch(() => undefined);
  });
  marks = [];
  await cdp.send("Page.startScreencast", { format: "png", maxWidth: size.w, maxHeight: size.h, everyNthFrame: 1 });
  await wait(300);
  const t0 = Date.now();
  try { await fn(); } catch (e) { await page.screenshot({ path: join(TMP, `${name}-failed.png`) }); throw e; }
  await wait(400);
  const end = Date.now() / 1000;
  await cdp.send("Page.stopScreencast");
  await writes;
  await cdp.detach();
  if (stamps.length === 0) throw new Error(`${name}: no frames`);

  // Concat list with each frame held until the next one: real timing, then resampled to 30 fps.
  const lines = [];
  stamps.forEach((t, i) => {
    const next = stamps[i + 1] ?? end;
    lines.push(`file '${join(dir, `${String(i).padStart(5, "0")}.png`)}'`, `duration ${Math.max(0.001, next - t).toFixed(4)}`);
  });
  lines.push(`file '${join(dir, `${String(stamps.length - 1).padStart(5, "0")}.png`)}'`);
  writeFileSync(join(dir, "list.txt"), lines.join("\n"));
  const zero = stamps[0];
  writeFileSync(join(OUT, `${name}.marks.json`), JSON.stringify({
    speed, duration: +((end - zero) / speed).toFixed(2), marks: Object.fromEntries(marks.map(([k, t]) => [k, +((t - zero) / speed).toFixed(2)])) }, null, 1));
  const mp4 = join(OUT, `${name}.mp4`);
  execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", join(dir, "list.txt"),
    "-vf", `setpts=PTS/${speed},fps=${FPS},scale=trunc(iw*${up}/2)*2:trunc(ih*${up}/2)*2:flags=neighbor,format=yuv420p`,
    "-c:v", "libx264", "-preset", "slow", "-crf", "12", "-tune", "animation", "-g", String(FPS), "-movflags", "+faststart", mp4]);
  const secs = end - t0 / 1000;
  console.log(`${name}: ${stamps.length} frames over ${secs.toFixed(1)} s (${(stamps.length / secs).toFixed(1)} fps captured) -> ${mp4}`);
  rmSync(dir, { recursive: true, force: true });
}

// ---------------------------------------------------------------------------------------------------
const browser = await chromium.launch();
const desktop = async (opts = {}) => {
  const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 }, acceptDownloads: true, ...opts });
  await ctx.addInitScript(() => { try { localStorage.setItem("stackyard:welcomed", "1"); } catch { /* file:// */ } });
  await ctx.addInitScript(cursorScript, "arrow");
  // Headless fullscreen resizes the captured surface mid-clip. Refuse it, so Play uses its full-window
  // overlay, which looks the same as real fullscreen at this window size.
  await ctx.addInitScript(() => { Element.prototype.requestFullscreen = function () { return Promise.reject(new Error("demo recording")); }; });
  const page = await ctx.newPage();
  return { ctx, page };
};
const replaceWith = async (page, id) => {
  await page.getByLabel("New from template").selectOption(id);
  await page.getByRole("dialog", { name: "Replace your current stack?" }).getByRole("button", { name: "Replace", exact: true }).click();
};
const ready = (page) => page.evaluate(() => document.fonts.ready.then(() => undefined));

/** Export a template from the editor and return the file path (used by the hook and export clips). */
async function exportTemplate(id) {
  const { ctx, page } = await desktop();
  await page.goto(APP);
  await replaceWith(page, id);
  const [dl] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: /self-contained/ }).click()]);
  const file = join(TMP, `${id}.html`);
  mkdirSync(TMP, { recursive: true });
  await dl.saveAs(file);
  await ctx.close();
  return file;
}

/** Open an exported file fully offline on a device-sized screen. */
async function offline(file, { w, h }) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, offline: true, hasTouch: false });
  await ctx.addInitScript(cursorScript, "tap");
  const page = await ctx.newPage();
  const net = [];
  page.on("request", (r) => { if (!/^(file|data|blob):/.test(r.url())) net.push(r.url()); });
  await page.goto(`file://${file}`);
  await ready(page);
  return { ctx, page, net };
}

const clips = {
  // 0:00 hook: the exported escape room on a phone, offline.
  async phone() {
    const file = await exportTemplate("haunted-house");
    const { ctx, page, net } = await offline(file, { w: 844, h: 390 }); // a phone on its side
    const d = director(page);
    await capture(page, "phone", async () => {
      await wait(1200);
      for (const label of ["Step inside", "Find a light", "Light lamp", "Study", "Open drawer"]) {
        await d.tap(page.locator(".sy-btn", { hasText: label }), 1500);
      }
      await wait(1200);
    }, { w: 844, h: 390 }, 2);
    if (net.length) throw new Error(`phone made requests: ${net}`);
    await ctx.close();
  },

  // 0:35 build live: a two-card escape room with a drawn, animated key and an if-action.
  async build() {
    const { ctx, page } = await desktop();
    await page.goto(APP);
    await replaceWith(page, "blank");
    await ready(page);
    const d = director(page);
    const stage = page.locator(".sy-stage.edit");
    const at = async (x, y) => { const b = await stage.boundingBox(); return [b.x + (x / 800) * b.width, b.y + (y / 600) * b.height]; };
    // Inspector fields are <label><span>name</span><input></label>; match the span exactly ("text" vs "text style").
    const field = (name) => page.locator("label.field").filter({ has: page.locator("span", { hasText: new RegExp(`^${name}$`) }) }).locator("input, select, textarea").first();

    await capture(page, "build", async () => {
      await wait(500);
      mark("title");
      await d.type(page.getByLabel("Stack title"), "The Cellar");
      await d.choose(page.getByLabel("look"), "haunted");
      await d.type(field("name"), "Cellar");

      // A line of story.
      mark("text");
      await d.click(page.getByRole("button", { name: "Add text" }));
      await d.type(field("text"), "A locked door. Something glints in the dust.", { delay: 35 });
      await d.drag(stage.locator(".sy-text").last(), await at(400, 90));

      // Draw a key, two frames so it glints.
      mark("draw");
      await d.click(page.getByRole("button", { name: "Draw a picture or background" }), { after: 600 });
      const dlg = page.getByRole("dialog", { name: "Draw" });
      await d.click(dlg.getByRole("radio", { name: "Small sprite 16×16" }));
      const cell = async (cx, cy) => {
        const b = await dlg.locator("canvas.paint-canvas").boundingBox();
        return [b.x + ((cx + 0.5) * b.width) / 16, b.y + ((cy + 0.5) * b.height) / 16];
      };
      const box = async (a, b) => {
        await d.glide(...(await cell(...a)), 260); await page.mouse.down();
        await d.glide(...(await cell(...b)), 260); await page.mouse.up(); await wait(150);
      };
      await d.click(dlg.getByRole("radio", { name: "Yellow", exact: true }));
      await d.click(dlg.getByRole("button", { name: "Box" }));
      await box([1, 5], [5, 10]);   // bow
      await box([6, 7], [14, 8]);   // shaft
      await box([11, 9], [12, 11]); // teeth
      await box([14, 9], [14, 10]);
      await d.click(dlg.getByRole("radio", { name: "Orange", exact: true }));
      await d.click(dlg.getByRole("button", { name: "Pen" }));
      for (const c of [[1, 10], [2, 10], [3, 10], [4, 10], [5, 10], [5, 9], [5, 8]]) { await d.glide(...(await cell(...c)), 70); await page.mouse.down(); await page.mouse.up(); }
      await d.click(dlg.getByRole("radio", { name: "Ink", exact: true }));
      for (const c of [[3, 7], [3, 8]]) { await d.glide(...(await cell(...c)), 120); await page.mouse.down(); await page.mouse.up(); }
      mark("frames");
      await d.click(dlg.getByText("Animation: add frames to make it move"));
      await d.click(dlg.getByRole("button", { name: "＋ Frame" }));
      await d.click(dlg.getByRole("radio", { name: "White", exact: true }));
      for (const c of [[9, 4], [8, 5], [10, 5], [9, 6], [9, 5]]) { await d.glide(...(await cell(...c)), 90); await page.mouse.down(); await page.mouse.up(); }
      mark("preview");
      await d.click(dlg.getByRole("button", { name: "▶ Preview" }), { after: 1600 });
      await d.type(dlg.getByRole("textbox", { name: /Describe your picture/ }), "a brass key", { delay: 45 });
      await d.click(dlg.getByRole("button", { name: "Add to card" }), { after: 700 });
      await d.type(field("w"), "128", { delay: 80 });
      await d.type(field("h"), "128", { delay: 80 });
      await d.drag(page.locator(".sy-stage.edit img.sy-obj").last(), await at(190, 470));
      mark("float");
      await d.choose(field("movement"), "float");

      // Clicking the key picks it up.
      mark("pickup");
      await d.choose(page.getByLabel("Add action").last(), "addItem");
      await d.type(page.getByPlaceholder("item name").last(), "key");
      await d.choose(page.getByLabel("Add action").last(), "hide");

      // The second card.
      mark("card2");
      await d.click(page.getByRole("button", { name: "Add card" }), { after: 600 });
      await d.type(field("name"), "Exit");
      await d.click(page.getByRole("button", { name: "Add text" }));
      await d.type(field("text"), "You escaped!", { delay: 50 });
      await d.click(page.locator(".card-item").first(), { after: 600 });

      // A hidden message and the door button with an if-action.
      mark("hidden");
      await d.click(page.getByRole("button", { name: "Add text" }));
      await d.type(field("text"), "It's locked.", { delay: 50 });
      await d.drag(stage.locator(".sy-text").last(), await at(560, 330));
      await d.click(page.getByLabel("visible at start"));
      await d.click(page.getByRole("button", { name: "Add button" }));
      await d.type(field("label"), "Open the door");
      await d.drag(stage.locator(".sy-btn").last(), await at(560, 470));
      mark("if");
      await d.choose(page.getByLabel("Add action").last(), "if");
      const ifBlock = page.locator(".if-block").last();
      await d.choose(ifBlock.locator(".arow select").first(), "item");
      await d.type(ifBlock.getByPlaceholder("item name").first(), "key");
      await d.choose(ifBlock.locator(".branch").nth(0).getByLabel("Add action"), "goto");
      const exitId = await page.evaluate(() => [...document.querySelectorAll(".if-block .branch select option")].find((o) => o.textContent === "Exit")?.value ?? "");
      await d.choose(ifBlock.locator(".branch").nth(0).locator(".arow select").nth(1), exitId);
      await d.choose(ifBlock.locator(".branch").nth(1).getByLabel("Add action"), "show");
      const lockedId = await page.evaluate(() => [...document.querySelectorAll(".if-block .branch select option")].find((o) => /It's locked/.test(o.textContent ?? ""))?.value ?? "");
      await d.choose(ifBlock.locator(".branch").nth(1).locator(".arow select").nth(1), lockedId, { after: 2000 });
    }, { w: 1920, h: 1080 }, 1, 1.6); // played back 1.6x faster: "sped up" in the storyboard

    // Same session, next clip: play it, then the map.
    await capture(page, "play-map", async () => {
      mark("play");
      await d.click(page.getByRole("button", { name: "▶ Play" }), { after: 1200 });
      const host = page.locator(".play-host");
      await d.click(host.locator(".sy-btn", { hasText: "Open the door" }), { after: 1300 });
      mark("key");
      await d.click(host.locator("img.sy-obj").last(), { after: 1000 });
      await d.click(host.locator(".sy-btn", { hasText: "Open the door" }), { after: 1800 });
      await page.keyboard.press("Escape");
      await wait(800);
      mark("map");
      await d.click(page.getByRole("button", { name: "Map", exact: true }), { after: 2600 });
    }, { w: 1920, h: 1080 });
    await ctx.close();
  },

  // The map of a bigger stack: every card, every link, and the doctor.
  async map() {
    const { ctx, page } = await desktop();
    await page.goto(APP);
    await replaceWith(page, "haunted-house");
    await ready(page);
    const d = director(page);
    await capture(page, "map", async () => {
      await wait(500);
      await d.click(page.getByRole("button", { name: "Map", exact: true }), { after: 1500 });
      const nodes = page.locator("svg .node");
      for (const i of [2, 5, 9]) await d.to(nodes.nth(i), 700).then(() => wait(500));
      await wait(1200);
    }, { w: 1920, h: 1080 });
    await ctx.close();
  },

  // 1:35 export: the button, then the same file on desktop, tablet and phone, offline.
  async export() {
    const { ctx, page } = await desktop();
    await page.goto(APP);
    await replaceWith(page, "midnight-train");
    await ready(page);
    const d = director(page);
    let file = "";
    await capture(page, "export-click", async () => {
      await wait(600);
      const [dl] = await Promise.all([page.waitForEvent("download"), d.click(page.getByRole("button", { name: /self-contained/ }), { after: 1400 })]);
      file = join(TMP, "the-midnight-train.html");
      await dl.saveAs(file);
    }, { w: 1920, h: 1080 });
    await ctx.close();

    for (const [name, size] of [["file-desktop", { w: 1280, h: 800 }], ["file-tablet", { w: 820, h: 1180 }], ["file-phone", { w: 390, h: 844 }]]) {
      const s = await offline(file, size);
      const dd = director(s.page);
      await capture(s.page, name, async () => {
        await wait(1000);
        await dd.tap(s.page.locator(".sy-btn", { hasText: "Watch the light" }), 1600);
        const next = s.page.locator(".sy-btn").first();
        await dd.tap(next, 1600);
      }, { w: size.w, h: size.h });
      if (s.net.length) throw new Error(`${name} made requests: ${s.net}`);
      await s.ctx.close();
    }
  },

  // Re-import: the exported file is the save file.
  async reimport() {
    const file = existsSync(join(TMP, "the-midnight-train.html")) ? join(TMP, "the-midnight-train.html") : await exportTemplate("midnight-train");
    const { ctx, page } = await desktop();
    await page.goto(APP);
    await replaceWith(page, "blank");
    await ready(page);
    const d = director(page);
    await capture(page, "reimport", async () => {
      await wait(500);
      await d.click(page.getByRole("button", { name: "Import an exported .html" }), { after: 200 });
      await page.keyboard.press("Escape").catch(() => undefined);
      await page.locator('input[type=file][accept*=".html"]').setInputFiles(file);
      await wait(500);
      await d.click(page.getByRole("dialog", { name: "Replace your current stack?" }).getByRole("button", { name: "Replace", exact: true }), { after: 1800 });
    }, { w: 1920, h: 1080 });
    await ctx.close();
  },

  // 2:35 close: the gallery, search, and a few cards of two stacks.
  async gallery() {
    const { ctx, page } = await desktop();
    await page.goto(APP);
    await ready(page);
    const d = director(page);
    await capture(page, "gallery", async () => {
      await wait(400);
      await d.click(page.getByRole("button", { name: "Play an example stack" }), { after: 1400 });
      const dlg = page.getByRole("dialog", { name: "Play a stack" });
      const search = dlg.getByRole("searchbox", { name: "Search stacks" });
      await d.click(search, { after: 100 });
      await page.keyboard.type("dog", { delay: 120 });
      await wait(1600);
      await page.keyboard.press("ControlOrMeta+A"); await page.keyboard.press("Backspace");
      await wait(900);
      await d.click(dlg.getByRole("button", { name: /^Play Wiki: The Halloween Bestiary/ }), { after: 1500 });
      const host = page.locator(".play-host");
      await d.click(host.locator(".sy-btn", { hasText: "A to Z" }), { after: 1400 });
      await d.click(host.getByText("» Kitsune"), { after: 2400 });
      await page.keyboard.press("Escape");
      await wait(600);
    }, { w: 1920, h: 1080 });
    await ctx.close();
  },

  async train() {
    const { ctx, page } = await desktop();
    await page.goto(APP);
    await ready(page);
    const d = director(page);
    await capture(page, "train", async () => {
      await d.click(page.getByRole("button", { name: "Play an example stack" }), { after: 600 });
      await d.click(page.getByRole("dialog", { name: "Play a stack" }).getByRole("button", { name: /^Play The Midnight Train/ }), { after: 1800 });
      const host = page.locator(".play-host");
      await d.click(host.locator(".sy-btn", { hasText: "Watch the light" }), { after: 2200 });
      await d.click(host.locator(".sy-btn").first(), { after: 2200 });
      await d.click(host.locator(".sy-btn").first(), { after: 2200 });
    }, { w: 1920, h: 1080 });
    await ctx.close();
  },
};

const want = process.argv.slice(2);
for (const name of want.length ? want : Object.keys(clips)) {
  if (!clips[name]) throw new Error(`unknown clip ${name}; have ${Object.keys(clips).join(", ")}`);
  await clips[name]();
}
await browser.close();
