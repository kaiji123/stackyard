import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { diagnose } from "../src/core/doctor";
import { initState, click, visibleObjects } from "../src/core/engine";
import { liveTextOverlaps, staticTextOverlaps } from "../src/core/overlap";
import { validateStack } from "../src/core/validate";

const files = readdirSync("templates").filter((f) => f.endsWith(".json"));

describe("templates", () => {
  it("has the three hero templates", () => {
    expect(files.sort()).toEqual(["ghost-story.json", "haunted-house.json", "pumpkin-tutorial.json"]);
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

  it("the escape room can be won, and not without the key and lamp", () => {
    const r = validateStack(JSON.parse(readFileSync("templates/haunted-house.json", "utf8")));
    if (!r.ok) throw new Error("invalid");
    const s = r.stack;
    const press = (st: ReturnType<typeof initState>, id: string) => {
      expect(visibleObjects(s, st).some((o) => o.id === id)).toBe(true);
      return click(s, st, id);
    };
    // Cheating attempt: cellar door without the key stays in the hall.
    let st = press(press(initState(s), "gate_go"), "hall_cellar");
    expect(st.card).toBe("hall");
    // Honest run.
    st = press(press(initState(s), "gate_go"), "hall_lamp");
    st = press(press(press(st, "hall_study"), "study_desk"), "study_back");
    st = press(press(st, "hall_cellar"), "cellar_lamp");
    expect(st.card).toBe("exit");
  });
});
