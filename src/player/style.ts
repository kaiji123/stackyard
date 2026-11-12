/** Player CSS. Inlined into exported files and into the editor. Own pixel look, system fonts only. */
export const PLAYER_CSS = `
.sy-root{position:fixed;inset:0;display:flex;align-items:center;justify-content:center;background:#1b1426;overflow:hidden}
.sy-root.sy-embedded{position:absolute}
.sy-stage{position:relative;width:800px;height:600px;flex:none;transform-origin:center center;background:#fbf3dd;
  background-image:repeating-linear-gradient(transparent 0 31px,#cfe0ee 31px 32px);box-shadow:0 0 0 4px #0d0814,0 12px 0 4px #0d0814;
  font-family:ui-monospace,"SF Mono",Menlo,Consolas,monospace;color:#1d1630;overflow:hidden}
.sy-stage:before{content:"";position:absolute;left:56px;top:0;bottom:0;border-left:2px solid #f0a0a0;pointer-events:none}
.sy-obj{position:absolute;box-sizing:border-box;margin:0;overflow:hidden}
.sy-text{white-space:pre-wrap;overflow-wrap:anywhere;line-height:1.25}
.sy-img{object-fit:contain;display:block}
.sy-btn{font:inherit;font-weight:bold;font-size:20px;color:#fff;background:#6b3fa0;border:3px solid #1d1630;
  box-shadow:4px 4px 0 #1d1630;cursor:pointer;padding:4px 8px}
.sy-btn:hover{background:#8250bf}.sy-btn:active{transform:translate(3px,3px);box-shadow:1px 1px 0 #1d1630}
.sy-click{cursor:pointer}
.sy-click:focus-visible,.sy-btn:focus-visible{outline:4px solid #ffb000;outline-offset:2px}
.sy-err{color:#fff;font:16px ui-monospace,Menlo,monospace;padding:24px;white-space:pre-wrap}
`;
