const FORBIDDEN = /[\\/:*?"<>|\u0000-\u001f\u007f\u2028\u2029]/g;
const RESERVED = /^(con|prn|aux|nul|com\d|lpt\d)$/i;

/**
 * File name (without extension) for a stack title. Keeps letters and digits from every script, so
 * "幽霊の家" stays "幽霊の家", and removes only what file systems reject. Falls back to "stack".
 */
export function fileSlug(title: string): string {
  const cleaned = title
    .normalize("NFC")
    .replace(FORBIDDEN, " ")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/^[-.]+|[-.]+$/g, "");
  const name = Array.from(cleaned).slice(0, 80).join("").replace(/[-.]+$/g, "");
  if (name === "") return "stack";
  return RESERVED.test(name) ? `stack-${name}` : name;
}
