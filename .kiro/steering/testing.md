---
inclusion: fileMatch
fileMatchPattern: ["src/core/**", "src/export/**", "tests/**"]
---
# Testing rules

- Every behavior change in `src/core` or `src/export` comes with a fast-check property test.
- Use the shared generators in `tests/arbitraries.ts` (random valid stacks, edit sequences,
  nasty strings like `</script>`, `<img onerror>`, emoji, RTL text, U+2028/U+2029).
- Never hard-code a seed in committed tests. On failure, fast-check prints the seed and the shrunk
  counterexample; copy both into the bug note in `KIRO_LOG.md` and add the counterexample as a
  regular regression test.
- Properties tracked (see PLAN.md): export round trip, no script injection, referential integrity,
  undo is an inverse, player never crashes, migrations idempotent, graph agrees with play,
  layout stays in canvas.
