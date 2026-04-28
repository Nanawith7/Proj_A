# Nodeview Editor

GUI editor for nodeview JSON visual templates.

## Start

```bash
# Start viewer first (port 8765)
python -m canvas_gen.main --vault "Obsidian_test/vault" --serve-viewer "Obsidian_test/vault/timeline.canvas:8765" &

# Start editor (port 8766, proxies to 8765)
cd nodeview_editor && python server.py
```

Open `http://127.0.0.1:8766/` in browser.

## Features

- Load templates from viewer server
- Live SVG preview (collapsed + expanded, aspect ratio matched)
- Drag markers: title (red), body (green), properties (blue)
- All params editable: shape, opacity, colors, padding, icons, background
- Per-property positioning with px or % values
- Copy JSON to clipboard

## Files

| File | Purpose |
|---|---|
| `server.py` | HTTP server (port 8766, proxies to viewer) |
| `index.html` | Editor UI |
| `editor.css` | Styles |
| `editor-core.js` | Data management + form binding + JSON output |
| `editor-preview.js` | SVG preview + drag system + BG images |
| `editor.js` | Entry point (init) |
