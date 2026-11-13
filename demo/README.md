# Demo video

A 2:45 video of Stackyard, made with [HyperFrames](https://hyperframes.heygen.com) (HTML compositions
rendered to MP4). The footage shows the real app: `record.mjs` drives the editor with Playwright, so the
clips can be re-recorded after any UI change.

```
npm run dev            # the editor on http://localhost:5173 (record.mjs uses it)
npm run demo:record    # all clips into demo/video/assets/ (or: node demo/record.mjs build export)
npm run demo:check     # HyperFrames lint, layout, contrast and motion checks
npm run demo:render    # demo/video/out/stackyard-demo.mp4 (1920x1080, 30 fps)
```

Needs Node 22 or later and FFmpeg. The HyperFrames CLI is pinned to 0.9.40 and runs with telemetry,
update checks and skill installs turned off.

## How it is made

- **Footage.** Frames come from the Chrome DevTools screencast as PNG, then ffmpeg encodes them as
  constant 30 fps H.264. Playwright's built-in recorder (VP9) blurs the dithered pixel art, which is why
  the script doesn't use it. During recording only, the page gets a drawn cursor (our own pixel arrow) and a
  tap dot for phone clips. The build clip plays at 1.6× speed, and the video says so on screen.
- **Offline proof.** The phone, tablet and laptop clips open the exported file in an offline browser
  context. The script fails if any of them makes a network request, so the on-screen "0 network
  requests" claim is checked on every recording.
- **Captions.** `record.mjs` writes `<clip>.marks.json` with the time of each step. Caption times in
  `video/index.html` come from those marks.
- **Composition.** `video/index.html` is a single root composition. A comment at the top maps out the
  scenes, and every element uses absolute times. GSAP is vendored in `video/vendor/`.

## Rules followed

- No third-party trademarks or trade dress. The story scene says "card-stack tools" and shows no screenshots
  of other products, no logos and no OS window chrome.
- Fonts: Silkscreen and VT323 (SIL Open Font License). Art: the project's own GIFs from `media/`.
- No music and no voice, so no licensing questions. Add a royalty-free or self-made track before
  uploading if you want sound.
- Every claim on screen is real: the 3.5 KB player (`npm run size`), 179 unit and property tests,
  232 e2e runs, and the NUL-in-title bug that the property test shrank (see `KIRO_LOG.md`, bug 3).

Recorded clips, frames and renders are gitignored. Recording all clips takes about three minutes, and
rendering takes about one.
