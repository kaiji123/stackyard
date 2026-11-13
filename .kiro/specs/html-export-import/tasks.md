# Tasks: HTML export and import

- [x] Builder with CSP hash, escaping, asset pruning
- [x] Importer with migration and validation
- [x] Properties 1 and 2 (jsdom), CSP hash test, nasty-string test
- [x] Fonts embedded; `font-src data:` in CSP; offline font test
- [x] Playwright: offline `file://` on Chromium, Firefox, WebKit; injected script blocked by CSP
- [x] Export smoke test for each template; `npm run examples` writes /examples
- [x] Unicode-safe file names (`export/filename.ts`, property test)
- [x] Player keyboard focus, live region, Tab order; e2e on Chromium, Firefox, WebKit
- [x] Tricky titles (`</script>`, `<img onerror>`, CJK, Arabic, U+2028, emoji, empty) exported, opened offline, re-imported
- [ ] Real-device check of the exported file (iOS Files app, Android)
- [ ] Optional: save progress (flags + card) to localStorage in the player
- [ ] Sound action and data: audio assets
