# Canvas Viewer

HTTP server + interactive HTML viewer for `.canvas` files.

## Start

```bash
python -m canvas_gen.main --vault "path/to/vault" --serve-viewer "path/to/timeline.canvas:8765"
```

Or from `viewer_env/`:
```bash
cd viewer_env && start.bat
```

Open `http://127.0.0.1:8765/` in browser.

## Features

- SVG graph at canvas coordinates
- Click node → expand in place (420x340) with Markdown body
- Pan (drag) + zoom (wheel, 10%-500%)
- Filter sidebar: AND/OR conditions, BFS base-node, include, sort, prune
- Per-type visual templates (`nodeview/*.json`)
- Aspect ratio preserved on expand

## API

| Method | Path | Description |
|---|---|---|
| GET | `/api/data` | Full canvas + vault data |
| POST | `/api/filter` | Filtered nodes/edges |
| GET | `/api/typedefs` | Type definitions |
| GET | `/api/nodeview/{name}.json` | Visual template |
| GET | `/_icons/{name}` | Icon PNG |
| GET | `/_viewbg/{name}` | Background image |

## Files

| File | Purpose |
|---|---|
| `server.py` | Python stdlib HTTP server |
| `index.html` | Viewer frontend skeleton |
| `viewer.css` | Styles |
| `viewer.js` | SVG rendering + filter engine |
