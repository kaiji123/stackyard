// Generates templates/*.json from the pictures in media/. Run: node scripts/make-templates.mjs
// Layout rule for the picture templates: art fills the card, a title sits on the sky, and all story text
// sits in a dark caption band at the bottom (y 444-520) with the buttons below it (y 534-590). Hidden
// messages use the strip just above the band (y 386-432). No two text boxes ever overlap.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

const png = (path) => ({ mime: "image/png", data: readFileSync(path).toString("base64") });
// Animated GIFs are embedded byte-for-byte, exactly like an upload of a small GIF.
const gif = (path) => ({ mime: "image/gif", data: readFileSync(path).toString("base64") });

const T = (id, x, y, w, h, text, o = {}) => ({
  kind: "text", id, x, y, w, h, visible: o.visible ?? true, actions: o.actions ?? [], motion: o.motion ?? "none",
  text, fontSize: o.size ?? 24, bold: o.bold ?? false, align: o.align ?? "left", tone: o.tone ?? "dark",
});
const B = (id, x, y, w, h, label, actions, o = {}) => ({
  kind: "button", id, x, y, w, h, visible: o.visible ?? true, actions, label, motion: o.motion ?? "none",
});
const I = (id, asset, x, y, w, h, alt, o = {}) => ({
  kind: "image", id, asset, alt, crisp: o.crisp ?? true, x, y, w, h, visible: o.visible ?? true, actions: o.actions ?? [], motion: o.motion ?? "none",
});
const card = (id, name, objects) => ({ id, name, objects });
const go = (c) => ({ type: "goto", card: c });
const show = (o) => ({ type: "show", object: o });
const hide = (o) => ({ type: "hide", object: o });

/** Keep only the assets some image uses, in a stable order. */
const stack = (title, start, cards, skin, assets) => {
  const used = new Set(cards.flatMap((c) => c.objects.flatMap((o) => (o.kind === "image" ? [o.asset] : []))));
  const kept = Object.fromEntries(Object.entries(assets).filter(([id]) => used.has(id)));
  const missing = [...used].filter((id) => !(id in kept));
  if (missing.length) throw new Error(`Unknown assets: ${missing.join(", ")}`);
  return { schemaVersion: 4, title, skin, start, cards, assets: kept };
};

// ---- Shared pieces for the picture templates -------------------------------------------------------
const bg = (id, asset, alt) => I(id, asset, 0, 0, 800, 600, alt);
const heading = (id, s, x = 40, w = 440) => T(id, x, 16, w, 52, s, { size: 40, bold: true, tone: "light" });
const caption = (id, s) => T(id, 24, 444, 752, 76, s, { size: 24, tone: "panel" });
const message = (id, x, w, s) => T(id, x, 386, w, 46, s, { size: 22, tone: "panel", visible: false });
const button = (id, x, w, label, actions) => B(id, x, 534, w, 56, label, actions);
/** A clickable label on a picture (e.g. "» Look closer"). Text objects with actions are clickable in play. */
// 44 px tall: 22 px text + panel padding and border, and a comfortable tap target.
const hotspot = (id, x, y, w, label, actions) => T(id, x, y, w, 44, `» ${label}`, { size: 22, tone: "panel", actions });
/**
 * A story page on the plain index card: title, text, an optional sprite on the right, and buttons in a row.
 * Used for letters, diaries and narration between the picture scenes.
 */
const page = (id, name, title, text, sprite, buttons) => card(id, name, [
  ...(sprite ? [I(`${id}_img`, sprite[0], 540, 110, 200, 200, sprite[1])] : []),
  T(`${id}_t`, 72, 40, 460, 60, title, { size: 40, bold: true }),
  T(`${id}_b`, 72, 120, sprite ? 440 : 640, 310, text, { size: 24 }),
  ...buttons.map(([bid, label, actions], i) => B(bid, 72 + i * 320, 450, 300, 64, label, actions)),
]);

const art = {
  bg_gate: png("media/backgrounds/bg-gate.png"),
  bg_hall: png("media/backgrounds/bg-hall.png"),
  bg_study: png("media/backgrounds/bg-study.png"),
  bg_cellar: png("media/backgrounds/bg-cellar.png"),
  bg_escaped: png("media/backgrounds/bg-escaped.png"),
  bg_road: png("media/backgrounds/bg-road.png"),
  bg_graveyard: png("media/backgrounds/bg-graveyard.png"),
  bat: png("media/sprites/bat.png"),
  ghost: png("media/sprites/ghost.png"),
  key: png("media/sprites/rusty-key.png"),
  lamp_lit: png("media/sprites/lamp-lit.png"),
  candle: png("media/sprites/candle.png"),
  web: png("media/sprites/spider-web.png"),
  padlock: png("media/sprites/padlock.png"),
  // Story art drawn for these templates by `npm run art` (scripts/art/).
  bg_foyer: png("media/backgrounds/bg-foyer.png"),
  bg_portrait: png("media/backgrounds/bg-portrait.png"),
  bg_cellar_open: png("media/backgrounds/bg-cellar-open.png"),
  bg_clearing: png("media/backgrounds/bg-clearing.png"),
  bg_dawn: png("media/backgrounds/bg-dawn-house.png"),
  bg_fog: png("media/backgrounds/bg-fog-road.png"),
  eleanor: png("media/sprites/eleanor.png"),
  diary: png("media/sprites/diary.png"),
  letter: png("media/sprites/letter.png"),
  gravestone: png("media/sprites/gravestone.png"),
  lantern: png("media/sprites/lantern.png"),
  tools: png("media/pumpkin-steps/0-tools.png"),
  seeds: png("media/pumpkin-steps/7-seeds.png"),
  // The Midnight Train (all drawn by `npm run art`, scripts/art/train.ts).
  t_platform: png("media/train/bg-platform.png"),
  t_arrival: png("media/train/bg-arrival.png"),
  t_carriage: png("media/train/bg-carriage.png"),
  t_window: png("media/train/bg-window.png"),
  t_corridor: png("media/train/bg-corridor.png"),
  t_dining: png("media/train/bg-dining.png"),
  t_sleeper: png("media/train/bg-sleeper.png"),
  t_luggage: png("media/train/bg-luggage.png"),
  t_bridge: png("media/train/bg-bridge.png"),
  t_home: png("media/train/bg-home.png"),
  t_last: png("media/train/bg-last-stop.png"),
  t_conductor: png("media/train/conductor.png"),
  t_pell: png("media/train/mrs-pell.png"),
  t_pip: png("media/train/pip.png"),
  t_biscuit: png("media/train/biscuit.png"),
  t_specs: png("media/train/spectacles.png"),
  t_musicbox: png("media/train/music-box.png"),
  t_ticket: png("media/train/ticket.png"),
  t_punched: png("media/train/ticket-punched.png"),
  t_clock: png("media/train/station-clock.png"),
  t_steam: gif("media/train/steam.gif"),
  t_view: gif("media/train/window-view.gif"),
  // The Halloween Bestiary (scripts/art/bestiary.ts).
  b_cover: png("media/bestiary/bg-cover.png"),
  b_wisp: gif("media/bestiary/wisp.gif"),
  ...Object.fromEntries(["ghost", "banshee", "reaper", "jack", "vampire", "zombie", "mummy", "skeleton", "witch", "werewolf",
    "goblin", "kitsune", "black-cat", "bat", "spider", "owl"].map((n) => [`b_${n.replace("-", "_")}`, png(`media/bestiary/${n}.png`)])),
  skull: png("media/sprites/skull.png"),
  gif_bats: gif("media/gifs/bats-over-moon.gif"),
  gif_lantern: gif("media/gifs/jack-o-lantern.gif"),
  // Transparent copy made by `npm run media` (the original has a dark square background).
  gif_candle: gif("media/gifs/candle-flicker-transparent.gif"),
  pumpkin1: png("media/pumpkin-steps/1-pick.png"),
  pumpkin2: png("media/pumpkin-steps/2-lid.png"),
  pumpkin3: png("media/pumpkin-steps/3-scoop.png"),
  pumpkin4: png("media/pumpkin-steps/4-draw.png"),
  pumpkin5: png("media/pumpkin-steps/5-carve.png"),
  pumpkin6: png("media/pumpkin-steps/6-light.png"),
};

// ---- 1. Haunted House Escape Room -------------------------------------------------------------------
// Story: on a dare you spend a night in the Ashby house. Eleanor Ashby, 12, was locked out by her father
// in 1910, followed the lanterns into the woods and never came home; his ghost guards the cellar.
// Puzzle chain: lamp -> drawer note (needs light) -> key in the garden (needs the note) -> cellar (needs
// the key) -> the ghost (needs light) -> the green light. Portrait, diary and graves tell the story.
const haunted = stack("Haunted House Escape Room", "gate", [
  card("gate", "The Gate", [
    bg("gate_bg", "bg_gate", "A dark house with glowing windows behind an iron fence, under a full moon"),
    I("gate_bats", "gif_bats", 512, 16, 288, 192, "Bats circle the full moon (animated)"),
    heading("gate_t", "The Haunted House"),
    caption("gate_b", "Your friends dared you to spend one night in the old Ashby house. The gate creaks open on its own."),
    button("gate_go", 24, 260, "Step inside", [go("foyer")]),
  ]),
  card("foyer", "The Front Door", [
    bg("foyer_bg", "bg_foyer", "Inside the front door: double doors bound with chains and a padlock, a grandfather clock at eleven, a coat stand"),
    heading("foyer_t", "Locked in"),
    caption("foyer_b", "The door slams behind you, then the chains rattle tight. The clock strikes eleven. One hour until midnight."),
    button("foyer_go", 24, 280, "Find a light", [go("hall")]),
  ]),
  card("hall", "The Hall", [
    bg("hall_bg", "bg_hall", "A dark hall with a doorway on the left, a portrait with red eyes, a lamp on a table and a padlocked wooden door"),
    I("hall_lamp_lit", "lamp_lit", 372, 288, 56, 56, "The lamp, now lit", { visible: false, motion: "flicker" }),
    heading("hall_t", "The Hall"),
    caption("hall_b", "It is dark. You feel a lamp on a table. Doors lead to a study, the garden, and a cellar with a heavy lock."),
    message("hall_lit", 24, 372, "The lamp glows. Shapes appear."),
    message("hall_locked", 404, 372, "The cellar door is locked."),
    button("hall_lamp", 24, 190, "Light lamp", [
      { type: "setFlag", flag: "lampOn", value: true }, show("hall_lit"), show("hall_lamp_lit"), hide("hall_lamp"),
    ]),
    button("hall_study", 230, 150, "Study", [go("study")]),
    button("hall_garden", 396, 160, "Garden", [go("garden")]),
    button("hall_cellar", 572, 204, "Cellar door", [
      { type: "if", cond: { item: "key" }, then: [go("cellar")], else: [show("hall_locked")] },
    ]),
    hotspot("hall_portrait", 320, 226, 160, "Look closer", [go("portrait")]),
  ]),
  card("portrait", "The Portrait", [
    bg("portrait_bg", "bg_portrait", "A close-up of the portrait: a girl with dark hair and a red ribbon in a grey dress, in a gold frame with a brass name plate"),
    heading("portrait_t", "The portrait", 24, 220),
    caption("portrait_b", "The brass plate reads: ELEANOR ASHBY, 1898–1910. The paint is cracked, but her eyes follow you."),
    button("portrait_back", 24, 300, "Back to the hall", [go("hall")]),
  ]),
  card("study", "The Study", [
    bg("study_bg", "bg_study", "A study with a full bookshelf, a desk with a candle and a drawer, and a moonlit window"),
    // Sized and placed to cover the candle painted on the desk exactly (base on the desk at y 368).
    I("study_candle", "gif_candle", 320, 272, 96, 96, "The candle on the desk flickers (animated)"),
    heading("study_t", "The Study", 330, 320),
    caption("study_b", "A dusty desk. Something pale is tucked into the top drawer."),
    message("study_dark", 24, 372, "Too dark to see anything."),
    message("study_found", 404, 372, "You found a torn note!"),
    button("study_desk", 24, 240, "Open drawer", [
      { type: "if", cond: { flag: "lampOn" },
        then: [{ type: "addItem", item: "note" }, hide("study_dark"), show("study_found"), hide("study_desk"), show("study_read")],
        else: [show("study_dark")] },
    ]),
    // Appears in the free slot once the note is found (its own spot, so the editor never stacks labels).
    B("study_read", 536, 534, 240, 56, "Read the note", [go("note")], { visible: false }),
    button("study_back", 280, 240, "Back to hall", [go("hall")]),
    hotspot("study_diary", 60, 300, 210, "Read a diary", [go("diary")]),
  ]),
  page("diary", "Eleanor's Diary", "A diary",
    "October 30th, 1910.\n\nPapa says if I am late again he will lock the door and I can sleep with the lanterns.\n\nThe lanterns sing to me from the woods. I think they know the way to somewhere better.",
    ["diary", "Eleanor's open diary with a red ribbon"], [["diary_back", "Back to the study", [go("study")]]]),
  card("note", "The Torn Note", [
    I("note_web", "web", 600, 0, 200, 200, "A spider web in the corner of the paper"),
    T("note_t", 72, 40, 500, 60, "A torn note", { size: 40, bold: true }),
    T("note_b", 72, 120, 520, 310,
      "If you find this, I am already gone.\n\nI buried the cellar key by the third grave in the garden.\n\nThe ghost below fears the dark. Show it a light.\n\n— E.",
      { size: 24 }),
    B("note_back", 72, 450, 300, 64, "Back to the study", [go("study")]),
  ]),
  card("garden", "The Garden", [
    bg("garden_bg", "bg_graveyard", "A moonlit garden of crooked graves behind the house, a bare tree and a small purple ghost"),
    I("garden_key", "key", 470, 310, 64, 64, "A rusty key in the fresh earth", { visible: false }),
    heading("garden_t", "The Garden"),
    caption("garden_b", "Crooked graves behind the house. A small ghost watches you from the hill."),
    message("garden_which", 24, 372, "Which grave? There are so many."),
    message("garden_found", 404, 372, "You dig up a rusty key!"),
    button("garden_dig", 24, 280, "Dig by a grave", [
      { type: "if", cond: { item: "note" },
        then: [{ type: "addItem", item: "key" }, hide("garden_which"), show("garden_found"), show("garden_key"), hide("garden_dig")],
        else: [show("garden_which")] },
    ]),
    button("garden_back", 320, 240, "Back inside", [go("hall")]),
    hotspot("garden_graves", 560, 320, 220, "Read the graves", [go("graves")]),
  ]),
  page("graves", "The Graves", "The graves",
    "HENRY ASHBY. Father. 1862–1911.\n\nThe second stone is worn smooth.\n\nThe third has no name, only words:\n\nSHE FOLLOWED THE LIGHTS.",
    ["gravestone", "A worn gravestone with a green light above it"], [["graves_back", "Back to the garden", [go("garden")]]]),
  card("cellar", "The Cellar", [
    bg("cellar_bg", "bg_cellar", "A stone cellar with stairs on the left and an iron door held by a golden padlock"),
    I("cellar_ghost", "ghost", 330, 96, 170, 170, "A pale ghost floating in front of the iron door", { motion: "float" }),
    heading("cellar_t", "The Cellar"),
    caption("cellar_b", "A pale ghost floats before the iron door. “Show me a light,” it whispers."),
    message("cellar_no", 24, 752, "The ghost laughs. It is too dark to find the way out."),
    button("cellar_lamp", 24, 280, "Raise the lamp", [
      { type: "if", cond: { flag: "lampOn" }, then: [go("confession")], else: [show("cellar_no")] },
    ]),
    button("cellar_up", 320, 240, "Go upstairs", [go("hall")]),
  ]),
  card("confession", "The Ghost Speaks", [
    bg("confession_bg", "bg_cellar_open", "The cellar wall with the iron door swung open onto the moonlit woods, the padlock on the floor"),
    I("confession_ghost", "ghost", 596, 120, 112, 112, "The ghost of Henry Ashby, shrunk small by the light"),
    I("confession_lamp", "lamp_lit", 88, 300, 80, 80, "Your lit lamp, held up high"),
    heading("confession_t", "The Ghost Speaks", 24, 520),
    caption("confession_b", "“I am Henry Ashby. I locked my daughter out, and she never came home. If you see her, tell her I am sorry.”"),
    button("confession_go", 24, 340, "Go through the door", [go("forest")]),
  ]),
  card("forest", "The Forest Fork", [
    bg("forest_bg", "bg_road", "A forest road at night with green and violet lights floating above it"),
    heading("forest_t", "The Forest Fork", 330, 440),
    caption("forest_b", "The iron door opens onto a forest road. Two lights float ahead. Behind you, a whisper: “Follow the green.”"),
    button("forest_green", 24, 300, "Follow green", [go("clearing")]),
    button("forest_violet", 340, 300, "Follow violet", [go("lost")]),
  ]),
  card("lost", "Lost in the Woods", [
    bg("lost_bg", "bg_fog", "The forest road lost in thick fog, faint lights circling"),
    heading("lost_t", "Lost in the Woods", 330, 440),
    caption("lost_b", "The violet light giggles and vanishes. You walk in circles until you find the fork again."),
    button("lost_back", 24, 300, "Back to the fork", [go("forest")]),
  ]),
  card("clearing", "The Green Light", [
    bg("clearing_bg", "bg_clearing", "A clearing in the woods ringed by mushrooms, glowing green in the middle, fireflies all around"),
    I("clearing_eleanor", "eleanor", 344, 232, 112, 112, "Eleanor, a small ghost girl in a grey dress, standing in the green light", { motion: "float" }),
    heading("clearing_t", "The Green Light", 40, 520),
    caption("clearing_b", "The green light stops and becomes a girl in a grey dress. Eleanor. “Is Papa still angry?”"),
    button("clearing_tell", 24, 340, "Tell her he is sorry", [go("farewell")]),
    button("clearing_run", 380, 300, "Run past her", [go("exit")]),
  ]),
  card("farewell", "Eleanor Goes Home", [
    bg("farewell_bg", "bg_dawn", "The Ashby house at dawn, its door open and lit, gold lights drifting up the path"),
    heading("farewell_t", "Going home", 40, 520),
    caption("farewell_b", "Eleanor smiles for the first time in a hundred years. Her light turns gold and drifts back toward the house."),
    button("farewell_go", 24, 340, "Walk into the dawn", [go("exit")]),
  ]),
  card("exit", "Escaped!", [
    bg("exit_bg", "bg_escaped", "Sunrise over green hills, with the house far behind and a small ghost waving"),
    heading("exit_t", "You escaped!"),
    caption("exit_b", "Dawn. Your friends are waiting at the gate. Nobody believes a word of your story. The end."),
    button("exit_again", 24, 260, "Play again", [go("gate")]),
  ]),
], "haunted", art);

// ---- 2. Choose-your-path Ghost Story ---------------------------------------------------------------
// Five endings. A warning voice hints that you need a light; catching a lantern and hearing Eleanor's
// story decide whether you can take her home (to the Ashby house from the escape room).
const ending = (id, name, asset, alt, heading_, text) => card(id, name, [
  bg(`${id}_bg`, asset, alt),
  heading(`${id}_t`, heading_, 40, 520),
  caption(`${id}_b`, text),
  button(`${id}_again`, 24, 260, "Start over", [go("road")]),
]);
/** Put a sprite right above an ending's background, below its text. */
const withSprite = (c, sprite) => ({ ...c, objects: [c.objects[0], sprite, ...c.objects.slice(1)] });
const GRAVEYARD = "A moonlit graveyard with crooked tombstones, a bare tree and a small purple ghost";
const ROAD = "A forest road at night with green and violet lanterns floating above it";
const story = stack("The Lantern Road", "road", [
  card("road", "The Road", [
    bg("road_bg", "bg_road", ROAD),
    I("road_bats", "gif_bats", 20, 0, 288, 192, "Bats circle the full moon (animated)"),
    heading("road_t", "The Lantern Road", 330, 440), // right of the animated moon so the title never sits on it
    caption("road_b", "Night. The fog is thick. Far ahead, lanterns float above the road. What do you do?"),
    button("road_a", 24, 320, "Follow the lights", [go("voice")]),
    button("road_b2", 360, 300, "Turn back home", [go("house")]),
  ]),
  page("voice", "A Voice", "A voice",
    "Halfway down the road, a voice speaks from the fog, close to your ear:\n\n“Don't follow them in the dark. Carry a light of your own, or they will keep you.”\n\nThen it is gone.",
    ["ghost", "A faint ghost in the fog"], [["voice_go", "Keep going", [go("lights")]], ["voice_back", "Go back", [go("road")]]]),
  card("lights", "The Lights", [
    bg("lights_bg", "bg_road", ROAD),
    I("lights_bat", "bat", 500, 150, 96, 96, "A bat flying over the forest"),
    heading("lights_t", "The Lights"),
    caption("lights_b", "The lanterns lead to an iron gate. Behind it, someone is humming. One lantern drifts close to you."),
    message("lights_got", 24, 752, "You catch it. The lantern is warm in your hand."),
    I("lights_lantern", "lantern", 640, 250, 112, 112, "The lantern you caught, glowing", { visible: false, motion: "swing" }),
    button("lights_catch", 24, 240, "Catch a lantern", [{ type: "addItem", item: "lantern" }, show("lights_got"), show("lights_lantern"), hide("lights_catch")]),
    button("lights_a", 280, 240, "Open the gate", [go("gate")]),
    button("lights_b2", 536, 240, "Run!", [go("run")]),
  ]),
  card("house", "Your House", [
    bg("house_bg", "bg_gate", "Your house at the end of the road, every window glowing, the gate open"),
    heading("house_t", "Your House"),
    caption("house_b", "Your house. Every window glows, but you live alone. The front door is open."),
    button("house_in", 24, 260, "Go inside", [go("room")]),
    button("house_back", 300, 300, "Back to the road", [go("road")]),
  ]),
  card("room", "Your Room", [
    bg("room_bg", "bg_study", "Your room, but older: a bookshelf, a desk with a candle, a moonlit window"),
    I("room_candle", "gif_candle", 320, 272, 96, 96, "A candle you did not light flickers on the desk (animated)"),
    heading("room_t", "Your Room", 330, 320),
    caption("room_b", "Your room, but older. A candle you did not light burns on the desk, next to a letter with your name on it."),
    button("room_read", 24, 280, "Read the letter", [go("letter")]),
    button("room_up", 320, 240, "Go upstairs", [go("home")]),
  ]),
  page("letter", "The Letter", "A letter",
    "The ink is brown with age. It is dated 1910.\n\n“Thank you for leaving the door open for me. I will come home soon. I only have to find the way.\n\n— E.”",
    ["letter", "An old letter sealed with red wax"], [["letter_up", "Go upstairs", [go("home")]], ["letter_out", "Run outside", [go("road")]]]),
  card("gate", "The Gate", [
    bg("gate_bg", "bg_graveyard", GRAVEYARD),
    // Covers the small ghost painted into the graveyard, so the ghost there IS Eleanor.
    I("gate_eleanor", "eleanor", 236, 232, 112, 112, "A small ghost girl in a grey dress, turning to look at you", { motion: "float" }),
    heading("gate_t", "The Gate"),
    caption("gate_b", "A girl in a grey dress turns around. “You are the first to stay,” she says."),
    button("gate_a", 24, 240, "Take her hand", [go("friend")]),
    button("gate_ask", 280, 240, "Ask her name", [go("eleanor")]),
    // Appears above the caption once you promise to help ("Ask her name" goes away).
    B("gate_lead", 24, 374, 280, 56, "Lead her home", [
      { type: "if", cond: { item: "lantern" }, then: [go("fogroad")], else: [go("fog")] },
    ], { visible: false }),
    button("gate_b2", 536, 240, "Step back", [go("run")]),
  ]),
  page("eleanor", "Eleanor", "Eleanor",
    "“My name is Eleanor. I live in the big house at the end of the road.\n\nAt least, I did. I have been out here a long time.”",
    ["eleanor", "Eleanor, a small ghost girl with a red ribbon"], [["eleanor_more", "Ask what happened", [go("past")]], ["eleanor_no", "Say nothing", [go("gate")]]]),
  page("past", "Her Story", "What happened",
    "“I came home late, and Papa locked the door. I followed the lanterns to find another way in.\n\nThey never let me go. Without a light, the road just goes round and round.\n\nWill you take me home?”",
    ["eleanor", "Eleanor, looking down at her feet"],
    [["eleanor_yes", "Promise to help", [show("gate_lead"), hide("gate_ask"), go("gate")]], ["past_no", "Say nothing", [go("gate")]]]),
  card("fogroad", "Through the Fog", [
    bg("fogroad_bg", "bg_fog", "The road swallowed by fog, only a few lights left"),
    I("fogroad_lantern", "lantern", 160, 300, 96, 96, "Your lantern, pushing back the fog", { motion: "swing" }),
    I("fogroad_eleanor", "eleanor", 264, 300, 96, 96, "Eleanor holding your sleeve"),
    heading("fogroad_t", "Through the fog", 330, 440),
    caption("fogroad_b", "Your lantern pushes the fog back, step by step. Eleanor holds your sleeve. The other lights hiss and fall behind."),
    button("fogroad_go", 24, 300, "Keep walking", [go("ashby")]),
  ]),
  card("ashby", "The Ashby House", [
    bg("ashby_bg", "bg_gate", "The old Ashby house at the end of the road, one window lit"),
    I("ashby_bats", "gif_bats", 512, 16, 288, 192, "Bats circle the full moon (animated)"),
    I("ashby_lamp", "lamp_lit", 448, 372, 48, 48, "A lamp glowing in the doorway"),
    heading("ashby_t", "The Ashby House"),
    caption("ashby_b", "The road ends at a tall dark house. A man with a lamp waits at the door. “Eleanor?” he whispers."),
    button("ashby_go", 24, 300, "Let her go to him", [go("freed")]),
  ]),
  ending("home", "Ending: Not Alone", "bg_hall", "The dark hall of your house, a portrait with red eyes on the wall", "Not alone",
    "You lock the door behind you. Upstairs, someone is humming your favourite song. The end."),
  ending("run", "Ending: Lost", "bg_graveyard", GRAVEYARD, "Lost in the fog",
    "You run until the road disappears. The lanterns circle you, patient and silent. The end."),
  withSprite(ending("friend", "Ending: Friend", "bg_graveyard", GRAVEYARD, "A new friend",
    "Her hand is cold, but she smiles. From then on, the lanterns light your way. The end."),
    I("friend_eleanor", "eleanor", 236, 232, 112, 112, "Eleanor, smiling, holding your hand")),
  ending("freed", "Ending: Home at Last", "bg_dawn", "The Ashby house at dawn, its door open and lit, gold lights drifting inside", "Home at last",
    "Father and daughter walk in together. At sunrise the house is empty and quiet. You set them free. The end."),
  ending("fog", "Ending: Lost Together", "bg_fog", "Nothing but fog and a few cold lights on the road", "Lost together",
    "Without a light, the fog closes in. You and Eleanor walk on forever, two more lanterns on the road. The end."),
], "haunted", art);

// ---- 3. Tutorial: How to Carve a Pumpkin, with a quiz ----------------------------------------------
const STEPS = 8;
const step = (id, name, n, heading_, text, asset, alt, opts = {}) => card(id, name, [
  T(`${id}_n`, 72, 28, 200, 40, `Step ${n} of ${STEPS}`, { size: 20 }),
  T(`${id}_t`, 72, 70, 680, 70, heading_, { size: 38, bold: true }),
  I(`${id}_img`, asset, 456, 150, 288, 288, alt),
  T(`${id}_b`, 72, 160, 360, 230, text, { size: 28 }),
  ...(n > 1 ? [B(`${id}_prev`, 72, 450, 200, 64, "Back", [{ type: "prev" }])] : []),
  B(`${id}_next`, 492, 450, 240, 64, opts.nextLabel ?? "Next", [{ type: "next" }]),
]);

// Each answer records its result on the results card (show one, hide the other), then moves on.
const QUIZ = [
  { id: "q1", ask: "Which way should you angle the lid cut?", art: "pumpkin2", alt: "The pumpkin with a ring of cuts around its stem",
    answers: ["Inward", "Outward", "Straight down"], right: 0, label: "1. Angle of the lid cut", fix: "No: inward" },
  { id: "q2", ask: "How thick should the wall be after scooping?", art: "pumpkin3", alt: "The open pumpkin with its lid beside it",
    answers: ["Paper thin", "About 3 cm", "As thick as possible"], right: 1, label: "2. Thickness of the wall", fix: "No: 3 cm" },
  { id: "q3", ask: "What is the safest light for a jack-o'-lantern?", art: "pumpkin6", alt: "A glowing carved pumpkin",
    answers: ["A wax candle", "A sparkler", "A battery candle"], right: 2, label: "3. Safest light inside", fix: "No: battery" },
  { id: "q4", ask: "Who should use the sharp knife?", art: "pumpkin5", alt: "The carved pumpkin with a toothy grin",
    answers: ["You, on your own", "A grown-up", "Jack the pumpkin"], right: 1, label: "4. Who uses the knife", fix: "No: grown-up" },
];
const quizCard = (q, i) => card(q.id, `Quiz ${i + 1}`, [
  T(`${q.id}_n`, 72, 28, 200, 40, `Quiz ${i + 1} of ${QUIZ.length}`, { size: 20 }),
  T(`${q.id}_t`, 72, 70, 680, 110, q.ask, { size: 34, bold: true }),
  I(`${q.id}_img`, q.art, 520, 210, 220, 220, q.alt),
  ...q.answers.map((label, a) => B(`${q.id}_a${a}`, 72, 210 + a * 84, 420, 64, label, [
    ...(a === q.right ? [show(`r_${q.id}_ok`), hide(`r_${q.id}_no`)] : [show(`r_${q.id}_no`), hide(`r_${q.id}_ok`)]),
    { type: "next" },
  ])),
]);
const results = card("results", "Results", [
  T("r_t", 72, 40, 680, 60, "Your results", { size: 40, bold: true }),
  ...QUIZ.flatMap((q, i) => [
    T(`r_${q.id}_q`, 72, 128 + i * 76, 400, 40, q.label, { size: 26 }),
    T(`r_${q.id}_ok`, 488, 128 + i * 76, 110, 40, "Right!", { size: 26, bold: true, visible: false }),
    T(`r_${q.id}_no`, 610, 128 + i * 76, 150, 40, q.fix, { size: 26, visible: false }),
  ]),
  B("r_again", 72, 450, 200, 64, "Try again", [go("q1")]),
  B("r_cert", 292, 450, 240, 64, "Certificate", [go("certificate")]),
  B("r_start", 552, 450, 180, 64, "Start over", [go("intro")]),
]);
const certificate = card("certificate", "Certificate", [
  T("cert_n", 72, 28, 400, 40, "Stackyard Pumpkin School", { size: 20 }),
  T("cert_t", 72, 70, 680, 70, "Master Pumpkin Carver", { size: 38, bold: true }),
  I("cert_img", "gif_lantern", 456, 150, 288, 288, "Jack, carved and glowing, smiles at you (animated)"),
  T("cert_b", 72, 160, 360, 230, "You can pick, cut, scoop, draw, carve and light a pumpkin, safely. Jack says thank you, and happy Halloween!", { size: 28 }),
  B("cert_start", 72, 450, 240, 64, "Start over", [go("intro")]),
]);
/** A story card in the tutorial's own style (no step number), with Back and Next like the steps. */
const scene = (id, name, heading_, text, asset, alt, w, h) => card(id, name, [
  T(`${id}_n`, 72, 28, 200, 40, "Jack's story", { size: 20 }),
  T(`${id}_t`, 72, 70, 680, 70, heading_, { size: 38, bold: true }),
  I(`${id}_img`, asset, 456, 150, w, h, alt),
  T(`${id}_b`, 72, 160, 360, 230, text, { size: 28 }),
  ...(id === "intro" ? [] : [B(`${id}_prev`, 72, 450, 200, 64, "Back", [{ type: "prev" }])]),
  B(`${id}_next`, 492, 450, 240, 64, "Next", [{ type: "next" }]),
]);

const tutorial = stack("How to Carve a Pumpkin", "intro", [
  scene("intro", "Meet Jack", "Meet Jack", "This is Jack. Tonight is Halloween, and Jack has no face yet. Follow the steps to give him one, then take the quiz.",
    "pumpkin1", "Jack, a plain orange pumpkin with no face yet", 288, 288),
  step("tools", "You Will Need", 1, "You will need", "A pumpkin, a big spoon, a marker, a small saw, a battery candle, and a grown-up to help.",
    "tools", "A big spoon, a marker and a small saw"),
  step("pick", "Pick", 2, "Pick your pumpkin", "Choose one with a flat bottom and a strong green stem. Smooth skin is easiest to carve.",
    "pumpkin1", "A whole orange pumpkin with a green stem"),
  step("lid", "Lid", 3, "Cut the lid", "Cut a circle around the stem, angled inward so the lid will not fall in. Ask a grown-up to help with the knife.",
    "pumpkin2", "The pumpkin with a ring of cuts around its stem"),
  step("scoop", "Scoop", 4, "Scoop it out", "Use a big spoon to pull out the seeds and strings. Scrape the inside wall until it is about 3\u00A0cm thick.",
    "pumpkin3", "The lid is off and lies beside the open pumpkin"),
  step("draw", "Draw", 5, "Draw the face", "Sketch eyes, a nose and a grin with a marker. Keep shapes simple: triangles and squares are the safest.",
    "pumpkin4", "The pumpkin with a face drawn on it in marker"),
  step("carve", "Carve", 6, "Carve slowly", "Use a small saw. Cut with short, gentle strokes and push the pieces out from the inside.",
    "pumpkin5", "The face is carved out, with a wide toothy grin"),
  step("light", "Light", 7, "Light it up", "Put in a battery candle and replace the lid. Place your pumpkin by the door. Happy Halloween!",
    "gif_lantern", "The carved pumpkin glows and flickers from the light inside (animated)"),
  scene("night", "Jack's Big Night", "Jack's big night", "Night falls and bats circle the moon. Jack glows on the doorstep, and every trick-or-treater stops to say: what a great pumpkin!",
    "gif_bats", "Bats circling the full moon over the street (animated)", 288, 192),
  step("seeds", "Seeds", 8, "Bonus: roast the seeds", "The next morning, rinse Jack's seeds, add a little oil and salt, and bake at 160°C for about 20 minutes. A grown-up uses the oven.",
    "seeds", "A tray of roasted pumpkin seeds, still steaming", { nextLabel: "Take the quiz" }),
  ...QUIZ.map(quizCard),
  results,
  certificate,
], "plain", art);

// ---- 4. The Midnight Train -------------------------------------------------------------------------
// Halloween. You miss the last bus; at midnight a ghost train calls at Platform 13. To get home you need
// a ticket before the last stop. A trade chain, one lock at a time: the conductor's lantern lets you
// search the dark luggage van (music box) -> Pip swaps it for Mrs. Pell's spectacles -> she gives you her
// unused 1952 ticket -> the conductor punches it HOME. Close your eyes on the way and you ride forever.
const train = stack("The Midnight Train", "platform", [
  card("platform", "Platform 13", [
    bg("platform_bg", "t_platform", "An empty station platform at night: iron columns, a clock at 11:59, a sign saying 13, a bench with a jack-o'-lantern, a gas lamp"),
    heading("platform_t", "Platform 13", 24, 300), // on the dark canopy, clear of the 13 sign
    caption("platform_b", "Halloween. You missed the last bus home. The station clock says 11:59, and far down the line, a light is coming."),
    button("platform_wait", 24, 300, "Read the timetable", [go("timetable")]),
    button("platform_track", 340, 300, "Watch the light", [go("arrival")]),
  ]),
  page("timetable", "The Timetable", "The timetable",
    "LAST BUS ........ 11:45\nLAST TRAIN ...... none\n\nUnderneath, someone has written in silver ink that seems to move:\n\nMIDNIGHT TRAIN .. 12:00\nALL STOPS. NO RETURNS.",
    ["t_clock", "The station clock, one minute to midnight"], [["timetable_back", "Back to the platform", [go("platform")]]]),
  card("arrival", "The Midnight Train", [
    bg("arrival_bg", "t_arrival", "A black steam train with lit windows stands at the platform; pale passengers look out; one door is open"),
    // The animated steam sits exactly on the chimney (grid 176–183, top at y 33).
    I("arrival_steam", "t_steam", 636, 4, 160, 136, "Steam rises from the chimney (animated)"),
    heading("arrival_t", "The Midnight Train", 24, 330),
    caption("arrival_b", "At the last stroke of twelve a black train rolls in without a sound. One door slides open. Warm light spills out."),
    button("arrival_board", 24, 280, "Climb aboard", [go("carriage")]),
    button("arrival_stay", 320, 320, "Stay on the platform", [go("platform")]),
  ]),
  card("carriage", "Carriage One", [
    bg("carriage_bg", "t_carriage", "Inside a carriage: red velvet seats down both sides, brass lamps, night outside, pale passengers in the seats"),
    heading("carriage_t", "Carriage One"),
    caption("carriage_b", "Velvet seats, brass lamps, and passengers who are not quite there. Nobody looks up. The train begins to move."),
    button("carriage_conductor", 24, 184, "Conductor", [go("conductor")]),
    button("carriage_dining", 224, 176, "Dining car", [go("dining")]),
    button("carriage_sleeper", 416, 140, "Sleeper", [go("sleeper")]),
    button("carriage_luggage", 572, 204, "Luggage van", [go("luggage")]),
    hotspot("carriage_window", 24, 300, 300, "Look out of the window", [go("window")]),
  ]),
  card("window", "The Window", [
    bg("window_bg", "t_window", "A carriage window framed in wood and red velvet curtains"),
    // The animated view fills the glass exactly (grid 30,14, 140×82).
    I("window_view", "t_view", 120, 56, 560, 328, "Hills, a village and telegraph poles slide past under the moon (animated)"),
    heading("window_t", "The Window", 24, 300),
    caption("window_b", "Your town slides past, then fields, then hills you have never seen. The train makes no sound at all. You feel sleepy."),
    button("window_back", 24, 300, "Back to your seat", [go("carriage")]),
    button("window_sleep", 340, 300, "Close your eyes", [go("last")]),
  ]),
  card("conductor", "The Conductor", [
    bg("conductor_bg", "t_corridor", "The front of the carriage: wood panels, a route map, and the door to the engine with a round window full of firelight"),
    I("conductor_img", "t_conductor", 272, 120, 256, 256, "The conductor: a tall pale ghost in a navy coat and a silver-banded cap"),
    heading("conductor_t", "The Conductor"),
    caption("conductor_b", "A tall man in a silver-banded cap blocks the door to the engine. His face is the colour of moonlight. “Tickets, please.”"),
    message("con_noticket", 24, 372, "You have no ticket. He frowns."),
    message("con_light", 404, 372, "He gave you a little lantern."),
    button("con_ticket", 24, 240, "Show a ticket", [
      { type: "if", cond: { item: "ticket" }, then: [go("punched")], else: [show("con_noticket")] },
    ]),
    button("con_ask", 280, 280, "Ask about the train", [go("mortimer")]),
    button("con_back", 576, 200, "Back", [go("carriage")]),
  ]),
  page("mortimer", "Mortimer", "Mortimer",
    "“I have run this line every Halloween for a hundred years. My passengers all lost their way home, long ago.\n\nFind a ticket before the last stop, or you will ride with us forever. Here. It is dark in the luggage van.”",
    ["t_conductor", "Mortimer the conductor"],
    [["mortimer_lantern", "Take the lantern", [{ type: "addItem", item: "lantern" }, show("con_light"), hide("mortimer_lantern"), go("conductor")]],
     ["mortimer_back", "Say nothing", [go("conductor")]]]),
  card("dining", "The Dining Car", [
    bg("dining_bg", "t_dining", "A dining car: a table with white linen, a red lamp, tea for two, and a wide window onto the night"),
    I("dining_pell", "t_pell", 8, 190, 160, 160, "Mrs. Pell, an old lady ghost in a knitted shawl, squinting"),
    I("dining_ticket", "t_ticket", 440, 236, 128, 128, "Mrs. Pell's old ticket, lying on the tablecloth", { visible: false, motion: "pulse" }),
    heading("dining_t", "The Dining Car"),
    caption("dining_b", "An old lady in a knitted shawl squints at a menu held upside down. “I can't read a thing,” she sighs."),
    message("dining_need", 24, 372, "She needs her spectacles."),
    message("dining_got", 404, 372, "She gives you her old ticket!"),
    button("dining_give", 24, 280, "Give the spectacles", [
      { type: "if", cond: { item: "specs" },
        then: [{ type: "addItem", item: "ticket" }, hide("dining_need"), show("dining_got"), show("dining_ticket"), hide("dining_give")],
        else: [show("dining_need")] },
    ]),
    button("dining_talk", 320, 240, "Talk to her", [go("pell")]),
    button("dining_back", 576, 200, "Back", [go("carriage")]),
  ]),
  page("pell", "Mrs. Pell", "Mrs. Pell",
    "“I bought this ticket in 1952 to visit my sister. I fell asleep and woke up on the wrong train.\n\nIt is no use to me now. Find my spectacles and it's yours, dear. I think the little boy was playing with them.”",
    ["t_pell", "Mrs. Pell with her knitting"], [["pell_back", "Back to the table", [go("dining")]]]),
  card("sleeper", "The Sleeper Car", [
    bg("sleeper_bg", "t_sleeper", "A sleeper compartment: two bunks with quilts, a ladder, a round window with the moon, a little night light"),
    I("sleeper_pip", "t_pip", 200, 200, 192, 192, "Pip, a ghost boy in a nightshirt, holding a pair of spectacles"),
    heading("sleeper_t", "The Sleeper Car", 440, 340), // right of the bunks, above the round window
    caption("sleeper_b", "A boy in a nightshirt sits on the bottom bunk, wide awake. Something round and glassy glints in his hands."),
    message("sleeper_need", 24, 372, "He won't swap without his music box."),
    message("sleeper_got", 404, 372, "He swaps it for the spectacles!"),
    button("sleeper_give", 24, 300, "Give the music box", [
      { type: "if", cond: { item: "musicbox" },
        then: [{ type: "addItem", item: "specs" }, hide("sleeper_need"), show("sleeper_got"), hide("sleeper_give")],
        else: [show("sleeper_need")] },
    ]),
    button("sleeper_talk", 340, 220, "Talk to him", [go("pip")]),
    button("sleeper_back", 576, 200, "Back", [go("carriage")]),
  ]),
  page("pip", "Pip", "Pip",
    "“I can't sleep without my music box. It plays the song my mum used to hum.\n\nI left it in the luggage van, but it's dark in there, and Biscuit growls at the dark.”",
    ["t_pip", "Pip, holding the spectacles"], [["pip_back", "Back to the bunks", [go("sleeper")]]]),
  card("luggage", "The Luggage Van", [
    bg("luggage_bg", "t_luggage", "A dark luggage van: a steamer trunk, a suitcase, a hatbox, a crate marked FRAGILE, an empty birdcage, moonlight through the door"),
    I("luggage_dog", "t_biscuit", 336, 236, 160, 160, "Biscuit, a ghost dog with one floppy ear, peeking out from behind the crate", { motion: "wiggle" }),
    I("luggage_box", "t_musicbox", 104, 220, 64, 64, "A small wooden music box on the trunk", { visible: false }),
    heading("luggage_t", "The Luggage Van"),
    caption("luggage_b", "Trunks and cages rattle in the dark. Two pale eyes shine from behind a crate. Something growls, softly."),
    message("luggage_dark", 24, 372, "Too dark. The growling gets louder."),
    message("luggage_got", 404, 372, "Biscuit wags. A music box!"),
    button("luggage_search", 24, 300, "Search the trunks", [
      { type: "if", cond: { item: "lantern" },
        then: [{ type: "addItem", item: "musicbox" }, hide("luggage_dark"), show("luggage_got"), show("luggage_box"), hide("luggage_search")],
        else: [show("luggage_dark")] },
    ]),
    button("luggage_back", 340, 200, "Back", [go("carriage")]),
    hotspot("luggage_pat", 316, 186, 200, "Pat the dog", [go("biscuit")]),
  ]),
  page("biscuit", "Biscuit", "Biscuit",
    "A ghost dog with one floppy ear and a brass tag that says BISCUIT.\n\nHe was the guard's dog, long ago, and he still guards everybody's luggage. He sniffs your hand, decides you are all right, and rolls over.",
    ["t_biscuit", "Biscuit, wagging"], [["biscuit_back", "Back to the trunks", [go("luggage")]]]),
  page("punched", "Ticket Punched", "Punched!",
    "Mortimer turns the old ticket over in his long fingers, and smiles for the first time.\n\nClick. HOME.\n\n“Next stop, your street. Go and say goodbye to your friends.”",
    ["t_punched", "The ticket, punched HOME"], [["punched_go", "Say goodbye", [go("bridge")]]]),
  card("bridge", "The High Bridge", [
    bg("bridge_bg", "t_bridge", "The train crosses a tall stone viaduct in front of a huge moon, every window lit, small figures waving"),
    heading("bridge_t", "The High Bridge", 24, 330),
    caption("bridge_b", "The train swings out over the high bridge. Mrs. Pell, Pip and Biscuit crowd the windows to wave goodbye."),
    button("bridge_wave", 24, 260, "Wave back", [go("home")]),
  ]),
  card("home", "Home", [
    bg("home_bg", "t_home", "Your street at dawn; the train climbs into the sky trailing gold steam above the rooftops"),
    heading("home_t", "Home"),
    caption("home_b", "At dawn the train sets you down at your own front door, then climbs into the sky. In your pocket: a ticket punched HOME. The end."),
    button("home_again", 24, 260, "Ride again", [go("platform")]),
  ]),
  card("last", "The Last Stop", [
    bg("last_bg", "t_last", "A pale station made of fog with a sign reading LAST STOP and grey figures waiting"),
    heading("last_t", "The Last Stop", 24, 330),
    caption("last_b", "You wake at a station made of fog. Mortimer tips his cap. “No ticket? Then welcome aboard, forever.” The end."),
    button("last_again", 24, 260, "Try again", [go("platform")]),
  ]),
], "haunted", art);

// ---- 5. The Halloween Bestiary: a wiki of Halloween creatures ---------------------------------------
// A field guide that a class could use: every article has a summary, a fact box (where it comes from,
// what to look for, and what is true), "see also" links, and next/back navigation inside its chapter.
// Facts are kept to well-established folklore and natural history.
const CHAPTERS = [
  { id: "spirits", name: "Spirits", intro: "Ghosts, wailing women, wandering lights and Death himself: creatures you can see through, or barely see at all." },
  { id: "undead", name: "The Undead", intro: "Things that were alive once, and did not stay politely buried." },
  { id: "magic", name: "Magic Folk", intro: "Witches, shape-shifters and tricksters: creatures who change things, including themselves." },
  { id: "animals", name: "Real Animals", intro: "Not monsters at all. Real animals that Halloween borrowed, and why." },
];
const BEASTS = [
  { id: "ghost", motion: "float", name: "Ghost", ch: "spirits", art: "b_ghost", alt: "A round white ghost with dark eyes and an open mouth", see: "banshee",
    summary: "The spirit of someone who has died, said to stay near the places they knew. Almost every culture in the world has ghost stories.",
    facts: "From: everywhere, in stories thousands of years old\nLook for: cold spots, footsteps, a figure in white\nThey want: to finish something left undone\nTrue or not: no proof, but the stories are real" },
  { id: "banshee", motion: "float", name: "Banshee", ch: "spirits", art: "b_banshee", alt: "A pale woman with long grey hair, crying out", see: "ghost",
    summary: "In Irish folklore, a woman of the fairy world whose wailing at night warns a family that one of them will soon die.",
    facts: "From: Ireland (Irish bean sí, 'woman of the fairy mound')\nListen for: a keening cry outside the house at night\nShe is: a warning, never the cause\nReal: keening was a real Irish song of mourning" },
  { id: "reaper", motion: "float", name: "The Grim Reaper", short: "Grim Reaper", ch: "spirits", art: "b_reaper", alt: "A hooded figure with glowing eyes, a scythe and an hourglass", see: "skeleton",
    summary: "Death itself, pictured as a hooded skeleton with a scythe who gathers souls the way a farmer harvests wheat.",
    facts: "From: European art, common from the 1300s\nCarries: a scythe, and often an hourglass\nWhy a scythe: death 'harvests' people like grain\nIn stories: clever heroes try to beat him at games" },
  { id: "wisp", name: "Will-o'-the-wisp", short: "The Wisp", ch: "spirits", art: "b_wisp", alt: "A floating ball of green light (animated)", see: "jack",
    summary: "A ghostly light that floats over marshes at night and leads travellers off the path. Every folk tale agrees: never follow it.",
    facts: "Also called: ignis fatuus, Latin for 'foolish fire'\nLook for: a flickering light over boggy ground\nScience says: maybe gas from rotting plants, burning\nSee it in: The Lantern Road and The Haunted House" },
  { id: "jack", name: "Stingy Jack", ch: "spirits", art: "b_jack", alt: "A sly man in a black hat holding up a glowing carved turnip", see: "wisp",
    summary: "Jack tricked the Devil, so when he died he could enter neither heaven nor hell. He wanders still, lighting his way with a coal in a turnip.",
    facts: "From: an old Irish folk tale\nFirst lanterns: carved turnips and potatoes\nPumpkins: Irish families found them in America\nHis name: gave us the word jack-o'-lantern" },
  { id: "vampire", name: "Vampire", ch: "undead", art: "b_vampire", alt: "A pale man in a high red-collared cape with red eyes and fangs", see: "bat",
    summary: "A corpse that rises at night to drink the blood of the living. The tales come from Eastern Europe; Count Dracula is from an 1897 novel.",
    facts: "From: Slavic and Balkan folklore\nWeak against: garlic, a wooden stake, running water\nSunlight: only deadly since a film of 1922\nReal: vampire bats exist, and they are tiny" },
  { id: "zombie", name: "Zombie", ch: "undead", art: "b_zombie", alt: "A green-skinned zombie in a torn grey shirt, arms out", see: "mummy",
    summary: "A dead body that walks again, without a mind of its own. The word comes from Haitian folklore; the hungry film zombie came much later.",
    facts: "From: Haiti (zonbi), from older West African beliefs\nFilm zombie: from Night of the Living Dead, 1968\nMoves: slowly... unless it is a newer film\nReal: a fungus turns some ants into 'zombie ants'" },
  { id: "mummy", name: "Mummy", ch: "undead", art: "b_mummy", alt: "A figure wrapped in linen bandages with glowing eyes and a gold scarab", see: "skeleton",
    summary: "A body preserved after death. Ancient Egyptians dried the body with salt and wrapped it in linen, so the soul would always have a home.",
    facts: "From: Ancient Egypt, over 4,000 years ago\nMade with: natron salt, oils, and lots of linen\nThe curse: newspapers spread it after 1922\nReal: the organs were kept in four special jars" },
  { id: "skeleton", name: "Skeleton", ch: "undead", art: "b_skeleton", alt: "A smiling skeleton waving, with a marigold flower", see: "reaper",
    summary: "The bones inside every one of us. At Halloween and on Mexico's Day of the Dead, skeletons remind us of the dead, often with a smile.",
    facts: "Bones: an adult has 206; a baby has about 300\nStrongest: the thigh bone, called the femur\nDay of the Dead: Mexico, 1 and 2 November\nReal: your skeleton is alive and always renewing" },
  { id: "witch", name: "Witch", ch: "magic", art: "b_witch", alt: "A green-faced witch with orange hair, a crooked hat and a broom", see: "cat",
    summary: "In old stories, a person who uses magic, often with a cat, a cauldron and a broom. In real history, innocent people were accused of it.",
    facts: "From: folklore all over the world\nTools: cauldron, broomstick, book of spells\nCompanion: a 'familiar', often a black cat\nHistory: thousands were unfairly tried, 1450–1750" },
  { id: "werewolf", name: "Werewolf", ch: "magic", art: "b_werewolf", alt: "A shaggy brown wolf-man with yellow eyes and fangs", see: "kitsune",
    summary: "A person who turns into a wolf, usually at the full moon. The idea is ancient: a Greek myth tells of a king turned into a wolf.",
    facts: "From: ancient Greece (King Lycaon) and across Europe\nThe word: 'were' is Old English for 'man'\nWeak against: silver, in later stories\nScience word: lycanthropy, 'wolf-person'" },
  { id: "goblin", name: "Goblin", ch: "magic", art: "b_goblin", alt: "A small green goblin with big ears and a stolen gold coin", see: "witch",
    summary: "A small, mischievous creature of European folklore that lives in caves and old houses, stealing food and playing tricks.",
    facts: "From: medieval European folklore\nLikes: shiny things, tricks, other people's dinner\nCousins: hobgoblins, kobolds, brownies\nThe word: maybe from Greek kobalos, 'rogue'" },
  { id: "kitsune", motion: "pulse", name: "Kitsune", ch: "magic", art: "b_kitsune", alt: "A fox spirit with nine white-tipped tails fanned out behind her", see: "werewolf",
    summary: "A fox spirit from Japanese folklore. It grows a new tail every hundred years, and can take human form to help or to trick people.",
    facts: "From: Japan; China and Korea have fox spirits too\nTails: up to nine; more tails, more wisdom and power\nServes: Inari, the Shinto spirit of rice\nIn stories: its shadow gives it away" },
  { id: "cat", name: "Black Cat", ch: "animals", art: "b_black_cat", alt: "A black cat with yellow eyes and a collar with a bell", see: "witch",
    summary: "A real cat, of course. In parts of Europe and America a black cat crossing your path is bad luck; in Britain and Japan it can be good luck.",
    facts: "Real: yes, many breeds can be black\nUnlucky: an old idea linked to witch stories\nLucky: in Scotland, a black cat at your door\nSailors: kept black cats on board for luck" },
  { id: "bat", motion: "bob", name: "Bat", ch: "animals", art: "b_bat", alt: "A brown bat with purple wings spread", see: "vampire",
    summary: "The only mammal that can truly fly. Most bats eat insects or fruit; only three kinds out of more than 1,400 drink blood.",
    facts: "Real: yes, about a fifth of all mammal species\nFinds its way by: sound echoes (echolocation)\nVampire bats: three kinds, in the Americas\nHelpers: bats eat pests and spread seeds" },
  { id: "spider", motion: "swing", name: "Spider", ch: "animals", art: "b_spider", alt: "A black spider with red markings hanging from a thread", see: "owl",
    summary: "Not an insect: spiders have eight legs and are arachnids. Almost all are harmless to people, and they eat a lot of pests.",
    facts: "Real: yes, about 50,000 known species\nLegs: eight, and most have eight eyes\nSilk: stronger than steel of the same weight\nFear of spiders: arachnophobia" },
  { id: "owl", name: "Owl", ch: "animals", art: "b_owl", alt: "A brown owl with big orange eyes on a branch", see: "bat",
    summary: "A night hunter that flies almost silently. In ancient Greece the owl meant wisdom; in other places it was a sign of bad news.",
    facts: "Real: yes, about 250 species\nHead: turns about 270 degrees\nSilent flight: soft, fringed feathers\nIn myth: the owl of Athena, goddess of wisdom" },
];
const beastOf = (id) => { const b = BEASTS.find((x) => x.id === id); if (!b) throw new Error(`no beast ${id}`); return b; };
const inChapter = (ch) => BEASTS.filter((b) => b.ch === ch);

const article = (b) => {
  const mates = inChapter(b.ch), i = mates.indexOf(b), next = mates[(i + 1) % mates.length];
  const ch = CHAPTERS.find((c) => c.id === b.ch);
  return card(b.id, b.name, [
    T(`${b.id}_ch`, 72, 24, 400, 30, `${ch.name.toUpperCase()} · ${i + 1} of ${mates.length}`, { size: 20 }),
    T(`${b.id}_t`, 72, 54, 420, 56, b.name, { size: 40, bold: true }),
    I(`${b.id}_img`, b.art, 528, 32, 224, 224, b.alt, { motion: b.motion ?? "none" }),
    T(`${b.id}_b`, 72, 120, 430, 150, b.summary, { size: 24 }),
    T(`${b.id}_facts`, 72, 276, 680, 128, b.facts, { size: 22, tone: "panel" }),
    T(`${b.id}_see`, 72, 414, 420, 44, `» See also: ${beastOf(b.see).name}`, { size: 22, actions: [go(b.see)] }),
    B(`${b.id}_back`, 72, 470, 220, 60, `« ${ch.name}`, [go(ch.id)]),
    B(`${b.id}_next`, 308, 470, 280, 60, `Next: ${next.short ?? next.name}`, [go(next.id)]),
    B(`${b.id}_home`, 604, 470, 164, 60, "Contents", [go("contents")]),
  ]);
};

const chapter = (c) => {
  const mates = inChapter(c.id), n = mates.length, step = n > 4 ? 140 : 168, img = n > 4 ? 120 : 128;
  return card(c.id, c.name, [
    T(`${c.id}_t`, 72, 40, 660, 56, c.name, { size: 40, bold: true }),
    T(`${c.id}_b`, 72, 104, 660, 60, c.intro, { size: 24 }),
    ...mates.flatMap((b, k) => [
      I(`${c.id}_${b.id}_img`, b.art, 72 + k * step + (step - 12 - img) / 2, 176, img, img, `${b.name}: open the article`, { actions: [go(b.id)] }),
      T(`${c.id}_${b.id}_name`, 72 + k * step, 310, step - 12, 52, b.name, { size: 20, align: "center", bold: true, actions: [go(b.id)] }),
    ]),
    B(`${c.id}_home`, 72, 470, 240, 60, "« Contents", [go("contents")]),
  ]);
};

const az = [...BEASTS].sort((a, b) => a.name.replace(/^The /, "").localeCompare(b.name.replace(/^The /, "")));
const bestiary = stack("The Halloween Bestiary", "cover", [
  card("cover", "The Halloween Bestiary", [
    bg("cover_bg", "b_cover", "A candlelit library: shelves of old books, a skull, a sleeping owl, and a great book open on a lectern"),
    I("cover_candle_l", "gif_candle", 196, 248, 64, 64, "A candle flickering beside the book (animated)"),
    I("cover_candle_r", "gif_candle", 540, 248, 64, 64, "A candle flickering beside the book (animated)"),
    heading("cover_t", "The Halloween Bestiary", 24, 520),
    caption("cover_b", "A field guide to the creatures of Halloween: where they come from, what they want, and which of them are real."),
    button("cover_open", 24, 280, "Open the book", [go("contents")]),
    button("cover_az", 320, 240, "A to Z", [go("az")]),
  ]),
  card("contents", "Contents", [
    T("contents_t", 72, 40, 660, 56, "Contents", { size: 40, bold: true }),
    T("contents_b", 72, 104, 660, 40, `${BEASTS.length} creatures in ${CHAPTERS.length} chapters. Click a picture to open a chapter.`, { size: 24 }),
    ...CHAPTERS.flatMap((c, k) => {
      const first = inChapter(c.id)[0];
      return [
        I(`contents_${c.id}_img`, first.art, 72 + k * 168, 164, 128, 128, `Chapter: ${c.name}`, { actions: [go(c.id)] }),
        T(`contents_${c.id}_name`, 56 + k * 168, 298, 160, 52, c.name, { size: 22, align: "center", bold: true, actions: [go(c.id)] }),
        T(`contents_${c.id}_n`, 56 + k * 168, 352, 160, 30, `${inChapter(c.id).length} creatures`, { size: 20, align: "center" }),
      ];
    }),
    B("contents_az", 72, 470, 240, 60, "A to Z", [go("az")]),
    B("contents_cover", 328, 470, 280, 60, "Close the book", [go("cover")]),
  ]),
  card("az", "A to Z", [
    T("az_t", 72, 30, 660, 56, "A to Z", { size: 40, bold: true }),
    ...az.map((b, k) => T(`az_${b.id}`, 72 + Math.floor(k / 6) * 228, 104 + (k % 6) * 56, 220, 44, `» ${b.name}`, { size: 24, actions: [go(b.id)] })),
    B("az_home", 72, 470, 240, 60, "« Contents", [go("contents")]),
  ]),
  ...CHAPTERS.map(chapter),
  ...BEASTS.map(article),
], "plain", art);

mkdirSync("templates", { recursive: true });
const out = { "haunted-house": haunted, "ghost-story": story, "pumpkin-tutorial": tutorial, "midnight-train": train, "bestiary": bestiary };
for (const [name, s] of Object.entries(out)) {
  const json = JSON.stringify(s, null, 2) + "\n";
  writeFileSync(`templates/${name}.json`, json);
  console.log(`${name}.json  ${(json.length / 1024).toFixed(0)} KB, ${Object.keys(s.assets).length} pictures`);
}
