// @vitest-environment jsdom
import { createHash } from "node:crypto";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { buildHtml, pruneAssets } from "../src/export/build";
import { importStack } from "../src/export/import";
import { mount } from "../src/player/player";
import { arbStack, NASTY } from "./arbitraries";
import type { Stack } from "../src/core/types";

const PLAYER = "(function(){document.title='x'})();";
const parse = (html: string): Document => new DOMParser().parseFromString(html, "text/html");

describe("export / import", () => {
  // Property 1: export round trip.
  it("import(export(s)) deep-equals s (minus unused assets)", async () => {
    await fc.assert(fc.asyncProperty(arbStack, async (s) => {
      const r = importStack(await buildHtml(s, PLAYER));
      expect(r.ok).toBe(true);
      if (r.ok) expect(r.stack).toEqual(pruneAssets(s));
    }));
  });

  // Property 2: no script injection.
  it("never adds scripts or elements no matter what the user typed", async () => {
    await fc.assert(fc.asyncProperty(arbStack, async (s) => {
      const html = await buildHtml(s, PLAYER);
      const doc = parse(html);
      expect([...doc.querySelectorAll("script")].map((x) => x.type)).toEqual(["application/json", ""]);
      expect(doc.querySelectorAll("img[onerror], [onerror], [onclick]").length).toBe(0);
      expect(doc.title).toBe(s.title.replace(/[\u0000-\u001f\u007f\u2028\u2029]/g, " ").replace(/[ \t\n\f\r]+/g, " ").replace(/^ | $/g, ""));
      expect(doc.head.querySelectorAll("title").length).toBe(1);
    }), { numRuns: 60 });
  });

  it("renders user text as text, not markup", () => {
    fc.assert(fc.property(arbStack, (s) => {
      const root = document.createElement("div");
      document.body.replaceChildren(root);
      const m = mount(root, s);
      expect(root.querySelectorAll("script, style, iframe, [onerror]").length).toBe(0);
      for (const el of root.querySelectorAll<HTMLElement>(".sy-text")) {
        const o = s.cards.flatMap((c) => c.objects).find((x) => x.id === el.dataset["id"]);
        if (o?.kind === "text") expect(el.textContent).toBe(o.text);
        expect(el.children.length).toBe(0);
      }
      m.destroy();
    }), { numRuns: 60 });
  });

  it("CSP script hash matches the inlined player and the page has no network sinks", async () => {
    const s = fc.sample(arbStack, 1)[0] as Stack;
    const html = await buildHtml({ ...s, title: "</script><b>" }, PLAYER);
    const hash = createHash("sha256").update(PLAYER).digest("base64");
    expect(html).toContain(`script-src 'sha256-${hash}'`);
    expect(html).toContain("default-src 'none'");
    expect(html).not.toMatch(/https?:\/\//);
    expect(html).not.toMatch(/\btype=["']module/);
  });

  it("survives every nasty string in every text field", async () => {
    for (const bad of NASTY) {
      const s = fc.sample(arbStack, 1)[0] as Stack;
      const first = s.cards[0];
      if (!first) continue;
      const evil: Stack = { ...s, title: bad, cards: [{ ...first, name: bad }, ...s.cards.slice(1)] };
      const r = importStack(await buildHtml(evil, PLAYER));
      expect(r.ok && r.stack.title).toBe(bad);
    }
  });

  it("rejects files that are not stacks", () => {
    expect(importStack("<html></html>").ok).toBe(false);
    expect(importStack("{").ok).toBe(false);
    expect(importStack('{"schemaVersion":1}').ok).toBe(false);
  });
});
