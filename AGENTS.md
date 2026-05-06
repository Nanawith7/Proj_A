# AGENTS.md — brave-knight

## Repo at a glance
Canvas generator + NodeView editor for Obsidian vaults. **No build system.** All files are standalone HTML/JS/Python.

## Directory map
| Dir | Purpose |
|-----|---------|
| `canvas_gen/` | Python CLI — Obsidian vault → JSON Canvas |
| `canvas_gen/viewer/` | Standalone viewer server (`--serve-viewer`) |
| `nodeview_editor/` | JS editor for NodeView JSON templates |
| `test_children/` | Layout engine test (`children_layout.html`) |
| `Obsidian_test/vault/` | Test vault (~50 notes) |
| `Spec_canvas_gen/` | Design specs (editor, viewer, generation) |

## Canvas Generator (Python)
```bash
# Generate canvas file
python -m canvas_gen.main --vault Obsidian_test/vault --output out.canvas

# Start viewer server (port 8765 by default)
python -m canvas_gen.main --vault Obsidian_test/vault --serve-viewer timeline.canvas:8765
```

Pipeline order (`canvas_gen/pipeline.py` — changing it breaks output):
1. `include-matching` → 2. `filter/exclude/sort` → 3. `layout-params` → 4. `icons` → 5. `edges` → 6. `prune-orphans` → 7. `layout`

Vault structure: `_types/` (YAML type defs), `_config/` (label mappings), `_icons/`, `_viewbg/`, `{type}/`, `nodeview/*.json`

## NodeView Editor
```bash
# Start viewer first (port 8765), then editor (port 8766)
python -m canvas_gen.main --vault "Obsidian_test/vault" --serve-viewer "timeline.canvas:8765" &
cd nodeview_editor && python server.py
```
Open `http://127.0.0.1:8766/`. Editor proxies to viewer server for template loading.

## Layout Engine (`test_children/children_layout.html`)
Open in browser: `file:///.../test_children/children_layout.html`. Run `runPositionTests()` in console for unit tests.

### Critical layout pitfalls (do not re-break)
- **`makeEl` children**: Always use `opts.children ?? []` (line 116). Never hardcode `children: []`.
- **`_isManual` flag**: Set to `true` on mousedown, `false` on xRel/yRel input. `resolvePositions()` (line 598) skips `_isManual=true` children.
- **`right-N`/`bottom-N`**: Pinned TO parent edge — excluded from `maxRight`/`maxBottom` (lines 621–632, 669–670). Including them causes infinite parent growth.
- **Outside children**: `xRel: "right--10"` sets `isOutside=true`. Positioned in Pass 2 only, excluded from parent size.
- **Parent height in `resolvePositions`**: Use `maxBottom`, never sum child heights (children may overlap).
- **Text rendering**: `padX=10, padY=8`. Y position: `y + padY + lineHeight * (i+1)`.
- **`clip` vs `shrink`**: `clip` keeps `fontSize`, truncates lines. `shrink` runs `fitFontSize` binary search (lines 370–389).
- **`findElementByLabel`**: Search from `parent` scope (not `root`) for sibling-relative sizing (`wRel: "sibling-Label"`).

## Testing
- **Canvas gen**: `python -m canvas_gen.main --vault Obsidian_test/vault --output out.canvas`
- **Layout engine**: Open `test_children/children_layout.html`, run `runPositionTests()` in browser console
- **Editor**: Open `nodeview_editor/index.html` (viewer server required for template loading)

## Conventions
- No lint/format/typecheck. Standalone files only (`.html`, `.js`, `.py`).
- Output language: Japanese (UI strings, comments, specs).
- Git: worktree-based workflow (`.opencode/worktree/`).

## Critical rules (NEVER remove from AGENTS.md)
- **Numeric calculation**: Always use bash/python/node scripts for math. Never mental math.
- **Stalled rule**: If stuck >15 min on one issue, ask the user.
- **Debug-first methodology**: Always reproduce the bug with concrete measurements before guessing. Verify the exact calculation path that produces the wrong value. Use browser eval, console.log, or shell scripts to inspect intermediate values. Never fix based on head-reading alone.
