# Viewer Rendering Issues — Exploration Summary

**Project**: brave-knight (Canvas Generator + NodeView Editor for Obsidian)  
**Date**: 2026-05-09  
**Explorer**: AI Agent  
**Goal**: Investigate canvas viewer rendering anomalies and identify root causes

---

## 1. Overview

### 1.1 Problem Statement
The canvas viewer exhibits 5 rendering anomalies:
1. **P1**: Nodes rendered extremely tall (vertical overflow)
2. **P2**: Nodes become abnormally small after expand→collapse cycle
3. **P3**: Text not rendered (children content invisible)
4. **P4**: Icons positioned incorrectly
5. **P5**: Nodes rendered excessively wide

### 1.2 Investigation Method
- **Static Analysis**: Codebase walkthrough of `viewer.js`, `children.py`, `pipeline.py`
- **Browser Debugging**: agent-browser tool for live DOM inspection, DevTools Console, screenshots
- **Data Analysis**: Canvas JSON structure validation, Python vs Browser text measurement comparison

### 1.3 Exploration Phases
| Phase | Description | Key Finding |
|-------|-------------|-------------|
| 1 | Problem area mapping (data flow tracing) | Identified 4 root causes across render paths |
| 2 | Vertical overflow investigation | `n.height` mutation accumulation in `render()` |
| 2.5 | Nodeview style/size consistency | `expandMinW/H` undefined for 5 node types |
| 3 | Expand→collapse size corruption | `applyNodeView()` uses mutated `node.width` |
| 4 | Text not rendered | P3 is consequence of P1/P2, not independent bug |
| 5 | Icon position misalignment | Path A missing icon rendering code entirely |
| 6 | Excessive width investigation | Same root cause as P1 (mutation accumulation) |
| 7 | Canvas JSON structure analysis | JSON data correct; problem is in `render()` mutation |

---

## 2. Root Causes

### 2.1 P0: `n.width` / `n.height` Mutation Accumulation
**Location**: `viewer.js:144` (Path A), `viewer.js:211` (Path B)  
**Code**:
```javascript
n.width = childW; n.height = childH;  // Always executed!
```

**Impact**: Affects P1, P2, P5, P6  
**Mechanism**: 
- `render()` always mutates `node.width`/`node.height` to `childW`/`childH`
- On collapsed state: `childH = COLLAPSED_HEIGHT` (35px)
- On expanded state: `childH = expH` (can be 1494px due to ratio calculation bug)
- Next render() uses mutated values → size chaos

### 2.2 P0: `expandedId` Reset in `render()`
**Location**: `viewer.js:351`  
**Code**:
```javascript
svg.appendChild(mainG); graph.appendChild(svg); expandedId=null;
```

**Impact**: P2, P3  
**Mechanism**: 
- `toggleExpand()` sets `expandedId=nid` for expanded state
- `render()` resets `expandedId=null` on every call
- Children (pill elements) only render when `expandedId===n.id`
- Result: children never rendered after initial load

### 2.3 P0: `applyNodeView()` Uses Mutated Values
**Location**: `viewer.js:391-408`  
**Code**:
```javascript
let nw = node.width || 200, nh = node.height || 120;
```

**Impact**: P2  
**Mechanism**: 
- When `expanded=false`, uses `node.width`/`node.height`
- These values are already mutated (e.g., 1494px)
- Original type definition size (e.g., 160x120) never restored

### 2.4 P0: Path A Missing Icon Rendering
**Location**: `viewer.js:136-194` (Path A)  
**Impact**: P4 (character nodes have no icons)  
**Mechanism**: 
- Path A (pre-computed children) renders: rect, title, children
- Path A does NOT render icons
- character_card type uses Path A → no icons displayed
- era_circle type uses Path B/B-2 → icons displayed

### 2.5 P1: `toggleExpand()` Ratio Calculation Bug
**Location**: `viewer.js:466-473`  
**Code**:
```javascript
const ow = nv.shape === 'circle' ? minW : (node.width || 200);
const oh = nv.shape === 'circle' ? minH : (node.height || 120);
```

**Impact**: P1 (expanded size abnormal)  
**Mechanism**: 
- `node.height` is already COLLAPSED_HEIGHT (35px)
- `ratio = 160/35 = 4.57` (should be 160/120 = 1.33)
- `expW = expH * ratio` → expanded width becomes 1494px instead of 300px

### 2.6 P1: `expandMinW/H` Undefined for 5 Node Types
**Location**: `Obsidian_test/vault/nodeview/*.json`  
**Impact**: P1 (expanded size defaults to 300x200)  
**Affected**: character_card, scenario_card, event_card, plain, tag_bubble  
**Mechanism**: 
- `toggleExpand()` uses `nv.layout?.expandMinW ?? 300`
- character_card should use 160x120 but defaults to 300x200

---

## 3. All Fixes (Priority Order)

### P0 Fixes (Critical - Screen Corruption)
| # | Fix | Location | Related Phases |
|---|-----|----------|----------------|
| 1 | Stop `n.width/n.height` mutation in `render()` | `viewer.js:144, 211` | 1, 2, 6 |
| 2 | Stop `expandedId` reset in `render()` | `viewer.js:351` | 2, 3 |
| 3 | `applyNodeView()` uses type def size when `expanded=false` | `viewer.js:391-408` | 3 |
| 4 | Add icon rendering to Path A | `viewer.js:136-194` | 5 |

### P1 Fixes (Important - Size Mismatch)
| # | Fix | Location | Related Phases |
|---|-----|----------|----------------|
| 5 | Add `expandMinW/expandMinH` to 5 node types | `nodeview/*.json` | 2.5 |
| 6 | Fix `toggleExpand()` ratio calculation | `viewer.js:466-473` | 2 |
| 7 | Fix `toggleExpand()` icon anchor default | `viewer.js:488-489` | 5 |

### P2 Fixes (Minor - Visual Quality)
| # | Fix | Location | Related Phases |
|---|-----|----------|----------------|
| 8 | Adjust `COLLAPSED_HEIGHT` from 35 to 40 | `viewer.js:6` | 2 |
| 9 | Loosen `drawElement()` text condition | `viewer.js:940` | 4 |
| 10 | Fix `resolvePositions()` double `padX*2` | `viewer.js:851` | 6 |
| 11 | Add `collapsedFillOpacity/expandedFillOpacity` to 5 node types | `nodeview/*.json` | 2.5 |

---

## 4. Key Data Points

### 4.1 Node Type Sizes
| Type | Type Def | Nodeview expandMin | Default | Actual |
|------|----------|-------------------|---------|--------|
| character | 160x120 | undefined | 300x200 | 160x120 (canvas JSON) |
| scenario | 280x160 | undefined | 300x200 | 280x160 (canvas JSON) |
| event | 220x140 | undefined | 300x200 | 220x140 (canvas JSON) |
| era | 220x100 | 300x240 | - | 220x100 (canvas JSON) |

### 4.2 Python vs Browser Text Measurement Error
| Text | Python Est. | Browser Measured | Error |
|------|-------------|------------------|-------|
| [[main]], [[human]], [[knight]] | 161.4 | 151.1 | +6.8% |
| [[騎士団長]], [[幼なじみ]], [[盗賊]] | 135.6 | 165.7 | -18.2% |
| [[四天王A]] | 60.0 | 54.6 | +9.9% |
| [[幼なじみ]], [[王女]] | 85.2 | 101.3 | -15.9% |

**Note**: Japanese text estimated ~15-18% narrower by Python.

### 4.3 SVG ViewBox Size
- Actual: `0 0 4880 2980`
- Expected: ~`0 0 5000 3000` (reasonable)
- Cause: Mutated `n.width` values in viewBox calculation

---

## 5. File Structure

```
Deep_coding_logs/
└── viewer-rendering-issues-2026-05-09/
    └── Exploration/
        ├── Exploration_plan.md          (161 lines)
        ├── Exploration-1_result.md      (238 lines)
        ├── Exploration-2_result.md      (254 lines)
        ├── Exploration-2.5_result.md    (218 lines)
        ├── Exploration-3_result.md      (145 lines)
        ├── Exploration-4_result.md      (123 lines)
        ├── Exploration-5_result.md      (167 lines)
        ├── Exploration-6_result.md      (127 lines)
        ├── Exploration-7_result.md      (93 lines)
        └── exploration_summary.md       (this file)
```

---

## 6. Next Steps (Implementation Phase)

1. **Implement P0 fixes first** (mutation stop, expandedId, applyNodeView, icon rendering)
2. **Implement P1 fixes** (expandMinW/H, ratio calculation, icon anchor)
3. **Implement P2 fixes** (COLLAPSED_HEIGHT, text condition, padX*2, fillOpacity)
4. **Test with browser devtools** after each fix batch
5. **Verify all 5 anomalies** are resolved with screenshots

---

## 7. References

- `canvas_gen/viewer/viewer.js` — Main rendering code (1109 lines)
- `canvas_gen/children.py` — Python children layout engine (571 lines)
- `canvas_gen/pipeline.py` — Pipeline orchestration (111 lines)
- `Obsidian_test/vault/_types/type_definitions.yml` — Type definitions
- `Obsidian_test/vault/nodeview/*.json` — NodeView templates (7 files)
- `test_children.canvas` — Test canvas data (4480 lines)
