import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { diagnose } from "../src/core/doctor";
import { click, initState, visibleObjects, type PlayState } from "../src/core/engine";
import type { Stack } from "../src/core/types";
import { liveTextOverlaps, staticTextOverlaps } from "../src/core/overlap";
import { validateStack } from "../src/core/validate";

const files = readdirSync("templates").filter((f) => f.endsWith(".json"));

describe("templates", () => {
  it("has the five example stacks", () => {
    expect(files.sort()).toEqual(["bestiary.json", "ghost-story.json", "haunted-house.json", "midnight-train.json", "pumpkin-tutorial.json"]);
  });

  for (const f of files) {
    const doc: unknown = JSON.parse(readFileSync(`templates/${f}`, "utf8"));
    it(`${f} is valid and the doctor finds no errors or warnings`, () => {
      const r = validateStack(doc);
      expect(r.ok).toBe(true);
      if (r.ok) expect(diagnose(r.stack).filter((i) => i.severity !== "info")).toEqual([]);
    });
  }

  for (const f of files) {
    it(`${f}: no two text boxes overlap, on any card, in any state`, () => {
      const r = validateStack(JSON.parse(readFileSync(`templates/${f}`, "utf8")));
      if (!r.ok) throw new Error("invalid");
      expect(staticTextOverlaps(r.stack)).toEqual([]);
      expect(liveTextOverlaps(r.stack).overlaps).toEqual([]);
    });
  }

  for (const f of files) {
    const stackOf = () => {
      const r = validateStack(JSON.parse(readFileSync(`templates/${f}`, "utf8")));
      if (!r.ok) throw new Error("invalid");
      return r.stack;
    };

    it(`${f}: pictures are accessible, pixel-crisp and inside the card`, () => {
      const s = stackOf();
      for (const c of s.cards) for (const o of c.objects) {
        expect(o.x >= 0 && o.y >= 0 && o.x + o.w <= 800 && o.y + o.h <= 600, `${o.id} inside the canvas`).toBe(true);
        if (o.kind === "image") {
          expect(o.alt.trim().length, `${o.id} needs alt text`).toBeGreaterThan(5);
          expect(o.crisp, `${o.id} is pixel art`).toBe(true);
          expect(s.assets[o.asset], `${o.id} has its picture`).toBeDefined();
        }
      }
    });

    it(`${f}: text over a full-card picture is never dark ink, and pictures sit behind everything`, () => {
      for (const c of stackOf().cards) {
        const full = c.objects.filter((o) => o.kind === "image" && o.w === 800 && o.h === 600);
        if (full.length === 0) continue;
        expect(c.objects.indexOf(full[0] as (typeof c.objects)[number]), `${c.id}: background is the bottom layer`).toBe(0);
        for (const o of c.objects) if (o.kind === "text") expect(o.tone, `${c.id}/${o.id} must be readable on the picture`).not.toBe("dark");
      }
    });

    it(`${f}: has at least one animated picture, stored as the original GIF`, () => {
      const gifs = Object.values(stackOf().assets).filter((a) => a.mime === "image/gif");
      expect(gifs.length).toBeGreaterThan(0);
      for (const g of gifs) {
        const bytes = Buffer.from(g.data, "base64");
        expect(bytes.subarray(0, 6).toString("ascii")).toMatch(/^GIF8[79]a$/);
        expect(bytes.includes(Buffer.from("NETSCAPE2.0"))).toBe(true); // loops
        let frames = 0; // each frame has a Graphic Control Extension
        for (let i = bytes.indexOf(Buffer.from([0x21, 0xf9, 0x04])); i >= 0; i = bytes.indexOf(Buffer.from([0x21, 0xf9, 0x04]), i + 1)) frames++;
        expect(frames).toBeGreaterThan(1);
      }
    });

    it(`${f}: buttons never sit on top of each other, even hidden ones (the editor shows them all)`, () => {
      for (const c of stackOf().cards) {
        const btns = c.objects.filter((o) => o.kind === "button");
        btns.forEach((a, i) => {
          for (const b of btns.slice(i + 1)) {
            const apart = a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y;
            expect(apart, `${c.id}: ${a.id} and ${b.id} overlap`).toBe(true);
          }
        });
      }
    });

    it(`${f}: no unused pictures are stored`, () => {
      const s = stackOf();
      const used = new Set(s.cards.flatMap((c) => c.objects.flatMap((o) => (o.kind === "image" ? [o.asset] : []))));
      expect(Object.keys(s.assets).sort()).toEqual([...used].sort());
    });
  }

  const load = (name: string): Stack => {
    const r = validateStack(JSON.parse(readFileSync(`templates/${name}.json`, "utf8")));
    if (!r.ok) throw new Error(`invalid ${name}`);
    return r.stack;
  };
  /** Click object ids in order, failing if one is not on screen when it should be clicked. */
  const play = (s: Stack, ids: readonly string[], from: PlayState = initState(s)): PlayState =>
    ids.reduce((st, id) => {
      expect(visibleObjects(s, st).map((o) => o.id), `"${id}" should be clickable on ${st.card}`).toContain(id);
      return click(s, st, id);
    }, from);
  const shown = (s: Stack, st: PlayState, id: string): boolean => visibleObjects(s, st).some((o) => o.id === id);

  for (const f of files) {
    it(`${f}: every card can really be reached by playing (not only on the map)`, () => {
      const s = load(f.replace(".json", ""));
      const seen = new Set<string>(), cards = new Set<string>();
      const queue: PlayState[] = [initState(s)];
      for (let i = 0; i < queue.length && seen.size < 50_000; i++) {
        const st = queue[i] as PlayState;
        const key = JSON.stringify([st.card, st.flags, st.items, st.visibility]);
        if (seen.has(key)) continue;
        seen.add(key);
        cards.add(st.card);
        for (const o of visibleObjects(s, st)) queue.push(click(s, st, o.id));
      }
      expect([...cards].sort()).toEqual(s.cards.map((c) => c.id).sort());
    });
  }

  it("the escape room can be won, but every lock really needs its key", () => {
    const s = load("haunted-house");
    const inHall = play(s, ["gate_go", "foyer_go"]);
    expect(inHall.card).toBe("hall");
    // Locked cellar without the key.
    let st = play(s, ["hall_cellar"], inHall);
    expect(st.card).toBe("hall");
    expect(shown(s, st, "hall_locked")).toBe(true);
    // The drawer is too dark without the lamp.
    st = play(s, ["hall_study", "study_desk"], inHall);
    expect(shown(s, st, "study_dark")).toBe(true);
    expect(st.items).not.toContain("note");
    // Digging without the note finds nothing.
    st = play(s, ["hall_garden", "garden_dig"], inHall);
    expect(shown(s, st, "garden_which")).toBe(true);
    expect(st.items).not.toContain("key");

    // Honest run, reading every story page on the way.
    st = play(s, ["hall_portrait", "portrait_back", "hall_lamp", "hall_study", "study_diary", "diary_back",
      "study_desk", "study_read", "note_back", "study_back", "hall_garden", "garden_graves", "graves_back",
      "garden_dig", "garden_back", "hall_cellar", "cellar_lamp", "confession_go"], inHall);
    expect(st.card).toBe("forest");
    // The violet light is a detour, not a dead end.
    st = play(s, ["forest_violet", "lost_back", "forest_green"], st);
    expect(st.card).toBe("clearing");
    expect(play(s, ["clearing_tell", "farewell_go"], st).card).toBe("exit");
    expect(play(s, ["clearing_run"], st).card).toBe("exit"); // the quick way out skips the farewell
    expect(st.items).toEqual(["note", "key"]);
  });

  it("the ghost story has five endings, and the lantern decides the best one", () => {
    const s = load("ghost-story");
    const end = (ids: string[]): string => play(s, ids).card;
    expect(end(["road_b2", "house_in", "room_up"])).toBe("home");
    expect(end(["road_b2", "house_in", "room_read", "letter_up"])).toBe("home");
    expect(end(["road_a", "voice_go", "lights_b2"])).toBe("run");
    expect(end(["road_a", "voice_go", "lights_a", "gate_a"])).toBe("friend");
    // "Lead her home" only appears after hearing her story and promising to help.
    const promised = play(s, ["road_a", "voice_go", "lights_a", "gate_ask", "eleanor_more", "eleanor_yes"]);
    expect(shown(s, promised, "gate_lead")).toBe(true);
    expect(shown(s, promised, "gate_ask")).toBe(false);
    expect(play(s, ["gate_lead"], promised).card).toBe("fog");
    expect(end(["road_a", "voice_go", "lights_catch", "lights_a", "gate_ask", "eleanor_more", "eleanor_yes",
      "gate_lead", "fogroad_go", "ashby_go"])).toBe("freed");
  });

  it("the pumpkin quiz records each answer, and retrying replaces the old result", () => {
    const s = load("pumpkin-tutorial");
    // Press "Next" until the quiz starts: Meet Jack, 8 steps, and Jack's big night come first.
    let st = initState(s);
    let presses = 0;
    while (st.card !== "q1" && presses < 30) {
      const btn = visibleObjects(s, st).find((o) => o.id.endsWith("_next"));
      expect(btn, `a Next button on ${st.card}`).toBeDefined();
      st = click(s, st, (btn as { id: string }).id);
      presses++;
    }
    expect(presses).toBe(10);
    st = play(s, ["q1_a0", "q2_a0", "q3_a2", "q4_a1"], st); // right, wrong, right, right
    expect(st.card).toBe("results");
    const marks = (x: PlayState): string[] => ["q1", "q2", "q3", "q4"].map((q) => (shown(s, x, `r_${q}_ok`) ? "ok" : shown(s, x, `r_${q}_no`) ? "no" : "-"));
    expect(marks(st)).toEqual(["ok", "no", "ok", "ok"]);
    st = play(s, ["r_again", "q1_a1", "q2_a1", "q3_a2", "q4_a0"], st); // wrong, right, right, wrong
    expect(marks(st)).toEqual(["no", "ok", "ok", "no"]);
    expect(play(s, ["r_cert"], st).card).toBe("certificate");
    expect(play(s, ["r_cert", "cert_start"], st).card).toBe("intro");
    expect(play(s, ["r_start"], st).card).toBe("intro");
  });

  it("the midnight train: every trade needs the item before it, and dozing off is forever", () => {
    const s = load("midnight-train");
    const aboard = play(s, ["platform_track", "arrival_board"]);
    expect(aboard.card).toBe("carriage");
    // Nothing works out of order.
    let st = play(s, ["carriage_conductor", "con_ticket"], aboard);
    expect(shown(s, st, "con_noticket")).toBe(true);
    st = play(s, ["con_back", "carriage_luggage", "luggage_search"], st);
    expect(shown(s, st, "luggage_dark")).toBe(true);
    st = play(s, ["luggage_back", "carriage_sleeper", "sleeper_give"], st);
    expect(shown(s, st, "sleeper_need")).toBe(true);
    st = play(s, ["sleeper_back", "carriage_dining", "dining_give"], st);
    expect(shown(s, st, "dining_need")).toBe(true);
    expect(st.items).toEqual([]);
    // Falling asleep at the window is the other ending.
    expect(play(s, ["carriage_window", "window_sleep"], aboard).card).toBe("last");

    // The whole chain, with every story page.
    st = play(s, ["carriage_conductor", "con_ask", "mortimer_lantern", "con_back",
      "carriage_luggage", "luggage_pat", "biscuit_back", "luggage_search", "luggage_back",
      "carriage_sleeper", "sleeper_talk", "pip_back", "sleeper_give", "sleeper_back",
      "carriage_dining", "dining_talk", "pell_back", "dining_give", "dining_back",
      "carriage_conductor", "con_ticket"], aboard);
    expect(st.card).toBe("punched");
    expect(st.items).toEqual(["lantern", "musicbox", "specs", "ticket"]);
    expect(play(s, ["punched_go", "bridge_wave"], st).card).toBe("home");
  });

  it("the bestiary works like a wiki: every article is in a chapter, the A to Z, and linked both ways", () => {
    const s = load("bestiary");
    const chapters = ["spirits", "undead", "magic", "animals"];
    const fixed = new Set(["cover", "contents", "az", ...chapters]);
    const articles = s.cards.filter((c) => !fixed.has(c.id));
    expect(articles).toHaveLength(17);
    const targets = (cardId: string): string[] => s.cards.find((c) => c.id === cardId)!.objects
      .flatMap((o) => o.actions.flatMap((a) => (a.type === "goto" ? [a.card] : [])));
    const az = targets("az");
    for (const a of articles) {
      expect(az, `A to Z lists ${a.name}`).toContain(a.id);
      const home = chapters.filter((c) => targets(c).includes(a.id));
      expect(home, `${a.name} is in exactly one chapter`).toHaveLength(1);
      const out = targets(a.id);
      expect(out, `${a.name} links back to its chapter`).toContain(home[0]);
      expect(out, `${a.name} links to the contents`).toContain("contents");
      // Every article has the same parts, so the wiki reads consistently.
      const parts = a.objects.map((o) => o.id.slice(a.id.length + 1));
      expect(parts).toEqual(["ch", "t", "img", "b", "facts", "see", "back", "next", "home"]);
      const facts = a.objects.find((o) => o.id === `${a.id}_facts`);
      expect(facts?.kind === "text" && facts.text.split("\n")).toHaveLength(4);
    }
    // "Next" walks each chapter in a loop that visits every article in it exactly once.
    const nextOf = (id: string): string => {
      const btn = s.cards.find((c) => c.id === id)!.objects.find((o) => o.id === `${id}_next`)!;
      const g = btn.actions.find((x) => x.type === "goto");
      return g && g.type === "goto" ? g.card : "";
    };
    for (const ch of chapters) {
      const members = [...new Set(targets(ch).filter((t) => t !== "contents"))];
      const walk: string[] = [];
      for (let at = members[0]!; !walk.includes(at); at = nextOf(at)) walk.push(at);
      expect(walk.sort()).toEqual([...members].sort());
    }
    // Clicking a creature's picture or name opens it, and so does its line in the A to Z.
    const st = play(s, ["cover_open", "contents_animals_img", "animals_bat_img"]);
    expect(st.card).toBe("bat");
    expect(play(s, ["cover_az", "az_kitsune"]).card).toBe("kitsune");
    expect(play(s, ["bat_see"], st).card).toBe("vampire");
  });

  it("every example is a proper story: at least 16 cards each", () => {
    for (const f of files) expect(load(f.replace(".json", "")).cards.length, f).toBeGreaterThanOrEqual(16);
  });
});

describe("button labels fit on one line", () => {
  // Silkscreen 20 px is about 13 px per character; buttons have 22 px of border and padding.
  for (const f of files) {
    it(`${f}: every button label fits its button`, () => {
      const r = validateStack(JSON.parse(readFileSync(`templates/${f}`, "utf8")));
      if (!r.ok) throw new Error("invalid");
      for (const c of r.stack.cards) for (const o of c.objects) {
        if (o.kind !== "button") continue;
        expect(o.label.length * 13 + 22, `${c.id}/${o.id} "${o.label}" in ${o.w}px`).toBeLessThanOrEqual(o.w);
      }
    });
  }
});
