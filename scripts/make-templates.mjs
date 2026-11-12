// Generates templates/*.json. Run: node scripts/make-templates.mjs
import { mkdirSync, writeFileSync } from "node:fs";

const T = (id, x, y, w, h, text, o = {}) => ({
  kind: "text", id, x, y, w, h, visible: o.visible ?? true, actions: o.actions ?? [],
  text, fontSize: o.size ?? 24, bold: o.bold ?? false, align: o.align ?? "left",
});
const B = (id, x, y, w, h, label, actions, o = {}) => ({
  kind: "button", id, x, y, w, h, visible: o.visible ?? true, actions, label,
});
const card = (id, name, objects) => ({ id, name, objects });
const go = (c) => ({ type: "goto", card: c });
const show = (o) => ({ type: "show", object: o });
const hide = (o) => ({ type: "hide", object: o });
const stack = (title, start, cards) => ({ schemaVersion: 1, title, start, cards, assets: {} });

const title = (id, s) => T(id, 72, 28, 680, 70, s, { size: 40, bold: true });
const body = (id, s, y = 120, h = 220) => T(id, 72, y, 660, h, s, { size: 26 });

// 1. Haunted House Escape Room: lamp -> key -> cellar -> exit.
const haunted = stack("Haunted House Escape Room", "gate", [
  card("gate", "The Gate", [
    title("gate_t", "The Haunted House"),
    body("gate_b", "The door slams shut behind you.\n\nFind the key, face the ghost,\nand get out before midnight."),
    B("gate_go", 72, 440, 260, 64, "Step inside", [go("hall")]),
  ]),
  card("hall", "The Hall", [
    title("hall_t", "The Hall"),
    body("hall_b", "It is dark. You feel a lamp on a table,\na study to the left, and a cellar door\nwith a heavy lock.", 120, 180),
    T("hall_lit", 72, 310, 660, 50, "The lamp glows. Shapes appear on the walls.", { size: 22, visible: false }),
    T("hall_locked", 72, 360, 660, 50, "The cellar door is locked.", { size: 22, visible: false }),
    B("hall_lamp", 72, 450, 200, 64, "Light lamp", [
      { type: "setFlag", flag: "lampOn", value: true }, show("hall_lit"), hide("hall_lamp"),
    ]),
    B("hall_study", 292, 450, 200, 64, "Study", [go("study")]),
    B("hall_cellar", 512, 450, 220, 64, "Cellar door", [
      { type: "if", cond: { item: "key" }, then: [go("cellar")], else: [show("hall_locked")] },
    ]),
  ]),
  card("study", "The Study", [
    title("study_t", "The Study"),
    body("study_b", "A dusty desk. Something glints\nin the top drawer.", 120, 140),
    T("study_dark", 72, 290, 660, 50, "Too dark to see anything.", { size: 22, visible: false }),
    T("study_key", 72, 290, 660, 50, "You found a rusty key!", { size: 22, bold: true, visible: false }),
    B("study_desk", 72, 450, 220, 64, "Open drawer", [
      { type: "if", cond: { flag: "lampOn" },
        then: [{ type: "addItem", item: "key" }, show("study_key"), hide("study_desk")],
        else: [show("study_dark")] },
    ]),
    B("study_back", 512, 450, 220, 64, "Back to hall", [go("hall")]),
  ]),
  card("cellar", "The Cellar", [
    title("cellar_t", "The Cellar"),
    body("cellar_b", "A pale ghost floats in front of the\nladder. \"Show me a light,\" it whispers.", 120, 160),
    T("cellar_no", 72, 300, 660, 50, "The ghost laughs. It is too dark to find the ladder.", { size: 22, visible: false }),
    B("cellar_lamp", 72, 450, 280, 64, "Raise the lamp", [
      { type: "if", cond: { flag: "lampOn" }, then: [go("exit")], else: [show("cellar_no")] },
    ]),
    B("cellar_up", 512, 450, 220, 64, "Go upstairs", [go("hall")]),
  ]),
  card("exit", "Escaped!", [
    title("exit_t", "You escaped!"),
    body("exit_b", "The ghost fades. Cold air, then dawn.\n\nThe end."),
    B("exit_again", 72, 450, 260, 64, "Play again", [go("gate")]),
  ]),
]);

// 2. Choose-your-path Ghost Story.
const ending = (id, name, heading, text) => card(id, name, [
  title(`${id}_t`, heading), body(`${id}_b`, text),
  B(`${id}_again`, 72, 450, 260, 64, "Start over", [go("road")]),
]);
const story = stack("The Lantern Road", "road", [
  card("road", "The Road", [
    title("road_t", "The Lantern Road"),
    body("road_b", "Night. The fog is thick. Far ahead,\nlanterns float above the road.\n\nWhat do you do?"),
    B("road_a", 72, 450, 320, 64, "Follow the lights", [go("lights")]),
    B("road_b2", 420, 450, 312, 64, "Turn back home", [go("home")]),
  ]),
  card("lights", "The Lights", [
    title("lights_t", "The Lights"),
    body("lights_b", "The lanterns lead to an iron gate.\nBehind it, someone is humming."),
    B("lights_a", 72, 450, 320, 64, "Open the gate", [go("gate")]),
    B("lights_b2", 420, 450, 312, 64, "Run!", [go("run")]),
  ]),
  card("gate", "The Gate", [
    title("gate_t", "The Gate"),
    body("gate_b", "A girl in a grey dress turns around.\n\"You are the first to stay,\" she says."),
    B("gate_a", 72, 450, 320, 64, "Take her hand", [go("friend")]),
    B("gate_b2", 420, 450, 312, 64, "Step back", [go("run")]),
  ]),
  ending("home", "Ending: Home", "Safe at home", "You lock the door. The lanterns outside\nflicker out one by one. You never find\nout what they wanted.\n\nThe end."),
  ending("run", "Ending: Lost", "Lost in the fog", "You run until the road disappears.\nThe lanterns circle you, patient and\nsilent.\n\nThe end."),
  ending("friend", "Ending: Friend", "A new friend", "Her hand is cold, but she smiles.\nFrom then on, the lanterns light your way.\n\nThe end."),
]);

// 3. Tutorial: How to Carve a Pumpkin.
const step = (id, name, n, heading, text, last) => card(id, name, [
  T(`${id}_n`, 72, 28, 200, 40, `Step ${n} of 6`, { size: 20 }),
  T(`${id}_t`, 72, 70, 680, 70, heading, { size: 38, bold: true }),
  body(`${id}_b`, text, 160, 230),
  ...(n > 1 ? [B(`${id}_prev`, 72, 450, 200, 64, "Back", [{ type: "prev" }])] : []),
  last ? B(`${id}_next`, 512, 450, 220, 64, "Start over", [go("pick")])
       : B(`${id}_next`, 512, 450, 220, 64, "Next", [{ type: "next" }]),
]);
const tutorial = stack("How to Carve a Pumpkin", "pick", [
  step("pick", "Pick", 1, "Pick your pumpkin", "Choose one with a flat bottom and a\nstrong green stem. Smooth skin is\neasiest to carve."),
  step("lid", "Lid", 2, "Cut the lid", "Cut a circle around the stem, angled\ninward so the lid will not fall in.\nAsk a grown-up to help with the knife."),
  step("scoop", "Scoop", 3, "Scoop it out", "Use a big spoon to pull out the seeds\nand strings. Scrape the inside wall\nuntil it is about 3 cm thick."),
  step("draw", "Draw", 4, "Draw the face", "Sketch eyes, a nose and a grin with a\nmarker. Keep shapes simple: triangles\nand squares are the safest."),
  step("carve", "Carve", 5, "Carve slowly", "Use a small saw. Cut with short, gentle\nstrokes and push the pieces out from\nthe inside."),
  step("light", "Light", 6, "Light it up", "Put in a battery candle and replace the\nlid. Place your pumpkin by the door.\nHappy Halloween!", true),
]);

mkdirSync("templates", { recursive: true });
const out = { "haunted-house": haunted, "ghost-story": story, "pumpkin-tutorial": tutorial };
for (const [name, s] of Object.entries(out)) writeFileSync(`templates/${name}.json`, JSON.stringify(s, null, 2) + "\n");
console.log("wrote", Object.keys(out).join(", "));
