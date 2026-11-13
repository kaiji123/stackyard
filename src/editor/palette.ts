// The drawing tool's colours: the same shared palette the built-in art uses (scripts/art/grid.ts), so
// what people draw matches the templates. A test keeps the two lists identical.
export const PALETTE: readonly { readonly name: string; readonly hex: string }[] = [
  { name: "Ink", hex: "#0d0814" }, { name: "Night", hex: "#1b1426" }, { name: "Panel", hex: "#241a35" },
  { name: "Panel light", hex: "#2d2142" }, { name: "Slate", hex: "#2a2633" }, { name: "Stone", hex: "#4a4458" },
  { name: "Stone light", hex: "#7d7590" }, { name: "Violet dark", hex: "#4a3470" }, { name: "Violet", hex: "#6a4fa0" },
  { name: "Lilac", hex: "#b79cff" }, { name: "White", hex: "#f1e9ff" }, { name: "Cream", hex: "#fff3c4" },
  { name: "Yellow", hex: "#ffd66b" }, { name: "Orange", hex: "#ff9d3c" }, { name: "Rust", hex: "#c4621a" },
  { name: "Wood dark", hex: "#3d2a1a" }, { name: "Wood", hex: "#6b4a2b" }, { name: "Green dark", hex: "#1d4a30" },
  { name: "Green", hex: "#2f7a4a" }, { name: "Mint", hex: "#6be08f" }, { name: "Red", hex: "#8a2b3a" },
  { name: "Red light", hex: "#ff6b6b" }, { name: "Navy", hex: "#262850" }, { name: "Navy light", hex: "#454a85" },
  { name: "Velvet", hex: "#4e1626" }, { name: "Wood light", hex: "#9c6b3c" }, { name: "Mist", hex: "#cfc6e6" },
];
