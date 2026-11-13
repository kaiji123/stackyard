/** Player CSS. Inlined into exported files and into the editor. Own pixel look, system fonts only. */
export const PLAYER_CSS = `
.sy-root{position:fixed;inset:0;display:flex;align-items:center;justify-content:center;background:#1b1426;overflow:hidden}
.sy-root.sy-embedded{position:absolute}
.sy-stage{position:relative;width:800px;height:600px;flex:none;transform-origin:center center;background:#fbf3dd;
  background-image:repeating-linear-gradient(transparent 0 31px,#cfe0ee 31px 32px);box-shadow:0 0 0 4px #0d0814,0 12px 0 4px #0d0814;
  font-family:"VT323",ui-monospace,"SF Mono",Menlo,Consolas,monospace;color:#1d1630;overflow:hidden}
.sy-stage:before{content:"";position:absolute;left:56px;top:0;bottom:0;border-left:2px solid #f0a0a0;pointer-events:none}
.sy-obj{position:absolute;box-sizing:border-box;margin:0;overflow:hidden}
.sy-text{white-space:pre-wrap;overflow-wrap:anywhere;line-height:1.25}
.sy-img{object-fit:contain;display:block}
.sy-crisp{image-rendering:-moz-crisp-edges;image-rendering:crisp-edges;image-rendering:pixelated}
.sy-tone-light{color:#f1e9ff;text-shadow:2px 2px 0 #0d0814}
.sy-tone-panel{color:#f1e9ff;background:rgba(13,8,20,.84);border:3px solid #0d0814;padding:4px 10px;box-shadow:4px 4px 0 rgba(0,0,0,.45)}
.sy-btn{font-family:"Silkscreen",ui-monospace,Menlo,monospace;font-weight:normal;font-size:20px;color:#fff;background:#6b3fa0;border:3px solid #1d1630;
  box-shadow:4px 4px 0 #1d1630;cursor:pointer;padding:4px 8px}
.sy-btn:hover{background:#8250bf}.sy-btn:active{transform:translate(3px,3px);box-shadow:1px 1px 0 #1d1630}
.sy-click{cursor:pointer}
.sy-stage:focus,.sy-root:focus,.sy-text:focus{outline:none}
.sy-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
.sy-click:focus-visible,.sy-btn:focus-visible{outline:4px solid #ffb000;outline-offset:2px}
.sy-haunted{background-color:#e7e2cc;background-image:repeating-linear-gradient(transparent 0 31px,#b3c9b3 31px 32px);animation:sy-flicker 7s infinite steps(1)}
.sy-haunted:after{content:"";position:absolute;inset:0;pointer-events:none;background:radial-gradient(ellipse at center,transparent 45%,rgba(25,0,45,.5) 100%)}
.sy-haunted .sy-btn{background:#2f6b52}.sy-haunted .sy-btn:hover{background:#3f8a6a}
@keyframes sy-flicker{0%,100%{filter:none}90%{filter:brightness(.8)}91%{filter:brightness(1.08)}93%{filter:brightness(.68)}94%{filter:none}}
.sy-ghost{position:fixed;width:14px;height:18px;margin:-9px 0 0 -7px;border-radius:7px 7px 2px 2px;background:rgba(222,212,255,.65);pointer-events:none;z-index:9;animation:sy-fade .9s forwards}
@keyframes sy-fade{to{opacity:0;transform:translateY(-16px) scale(.5)}}
@media (prefers-reduced-motion:reduce){.sy-haunted{animation:none}.sy-ghost{display:none}}
.sy-m-float{animation:sy-float 3s ease-in-out infinite}.sy-m-bob{animation:sy-bob .9s ease-in-out infinite}
.sy-m-wiggle{animation:sy-wiggle .5s ease-in-out infinite}.sy-m-pulse{animation:sy-pulse 1.6s ease-in-out infinite}
.sy-m-swing{animation:sy-swing 2.4s ease-in-out infinite;transform-origin:50% 0}.sy-m-spin{animation:sy-spin 4s linear infinite}
.sy-m-flicker{animation:sy-flick 3s steps(1) infinite}
@keyframes sy-float{50%{transform:translateY(-14px)}}@keyframes sy-bob{50%{transform:translateY(-6px)}}
@keyframes sy-wiggle{25%{transform:rotate(-4deg)}75%{transform:rotate(4deg)}}@keyframes sy-pulse{50%{transform:scale(1.08)}}
@keyframes sy-swing{0%,100%{transform:rotate(-7deg)}50%{transform:rotate(7deg)}}@keyframes sy-spin{to{transform:rotate(360deg)}}
@keyframes sy-flick{0%,100%{opacity:1}20%{opacity:.55}22%{opacity:1}61%{opacity:.7}63%{opacity:1}64%{opacity:.4}66%{opacity:1}}
@media (prefers-reduced-motion:reduce){.sy-moving{animation:none!important}}
@media (max-aspect-ratio:3/4) and (max-width:700px){.sy-root:not(.sy-embedded):after{content:"\\21BB  Turn your phone sideways for a bigger card";position:absolute;left:12px;right:140px;top:max(12px,env(safe-area-inset-top));
  color:#a99bc4;font:18px/1.2 "VT323",ui-monospace,Menlo,monospace;pointer-events:none}}
.sy-err{color:#fff;font:16px ui-monospace,Menlo,monospace;padding:24px;white-space:pre-wrap}
`;
