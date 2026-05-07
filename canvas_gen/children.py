"""Python-side children layout engine for canvas node rendering.

This module provides server-side children positioning logic:
1. nodeViewToChildren(): Convert nodeview template properties → children array
2. parse_rel(): Parse relative position strings (e.g. "left-10", "right--5")
3. compute_children(): Compute absolute positions for children

This allows the .canvas file to contain pre-computed children data,
which the viewer can render directly without re-computing layout.
"""

from __future__ import annotations

import math
import re
from typing import Any


# ── Default dimensions (browser-independent fallbacks) ──────────────
DEFAULT_PILL_W = 80
DEFAULT_PILL_H = 22
DEFAULT_TEXT_W = 100
DEFAULT_TEXT_H = 20
DEFAULT_PAD_X = 10
DEFAULT_PAD_Y = 8
DEFAULT_GAP_Y = 5


# ── Text sizing helpers ─────────────────────────────────────────────

def _estimate_text_w(text: str, font_size: int = 11) -> float:
    """Estimate text width in pixels (browser-independent).

    Uses a rough char-width heuristic:
      - Average char ≈ font_size * 0.55
      - Space char ≈ font_size * 0.35
    """
    if not text:
        return 0
    total = 0.0
    for ch in text:
        if ch.isspace():
            total += font_size * 0.35
        else:
            total += font_size * 0.55
    # Add small padding
    return max(total + 4, DEFAULT_TEXT_W * 0.6)


def _estimate_text_h(font_size: int = 11) -> float:
    """Estimate single-line text height."""
    return font_size + 8  # line-height = font_size + 4, plus padding


def _estimate_text_lines(text: str, font_size: int = 11, max_wrap_w: float = 100) -> list[str]:
    """Wrap text into lines based on estimated char width."""
    char_w = font_size * 0.55
    max_chars = max(3, int(max_wrap_w / char_w))
    words = text.split()
    lines: list[str] = []
    current_line = ""
    for word in words:
        if current_line and len(current_line) + 1 + len(word) <= max_chars:
            current_line += " " + word
        elif current_line:
            lines.append(current_line)
            current_line = word
        else:
            if len(word) > max_chars:
                # Split long word
                for i in range(0, len(word), max_chars):
                    lines.append(word[i:i + max_chars])
                current_line = ""
            else:
                current_line = word
    if current_line:
        lines.append(current_line)
    return lines if lines else [text] if text else []


# ── Relative position parsing ───────────────────────────────────────

def parse_rel(raw: Any):
    """Parse a relative position string.

    Returns dict with:
      - dir: 'left', 'right', 'top', 'bottom', 'abs', or None
      - val: int (numeric value)
      - is_outside: bool (True for negative offsets like "right--10")

    Examples:
      "left-10"      → {'dir': 'left', 'val': 10, 'is_outside': False}
      "right--10"    → {'dir': 'right', 'val': -10, 'is_outside': True}
      "top-5"        → {'dir': 'top', 'val': 5, 'is_outside': False}
      "bottom--8"    → {'dir': 'bottom', 'val': -8, 'is_outside': True}
      "-20"          → {'dir': 'abs', 'val': -20, 'is_outside': False}
      "50"           → {'dir': 'abs', 'val': 50, 'is_outside': False}
    """
    if raw is None:
        return None
    s = str(raw).strip()
    if not s:
        return None

    # Directional: left-N, right-N, top-N, bottom-N
    for prefix in ('left-', 'right-', 'top-', 'bottom-'):
        if s.startswith(prefix):
            rest = s[len(prefix):]
            if rest.startswith('-'):
                # Negative offset = outside direction
                return {
                    'dir': prefix.rstrip('-'),
                    'val': int(rest[1:]),
                    'is_outside': True,
                }
            else:
                return {
                    'dir': prefix.rstrip('-'),
                    'val': int(rest),
                    'is_outside': False,
                }

    # Absolute integer
    if re.match(r'^-?\d+$', s):
        return {
            'dir': 'abs',
            'val': int(s),
            'is_outside': False,
        }

    return None


def resolve_rel_x(parsed: dict | None, parent_w: float, child_w: float) -> float:
    """Resolve X offset from parent origin."""
    if parsed is None:
        return (parent_w - child_w) / 2.0
    cw = child_w or 0
    d = parsed['dir']
    v = parsed['val']
    if d == 'left':
        return -(cw + v) if parsed['is_outside'] else v
    elif d == 'right':
        return parent_w + v if parsed['is_outside'] else parent_w - v - cw
    elif d == 'abs':
        return v
    return 0


def resolve_rel_y(parsed: dict | None, parent_h: float, child_h: float) -> float:
    """Resolve Y offset from parent origin."""
    if parsed is None:
        return 0
    ch = child_h or 0
    d = parsed['dir']
    v = parsed['val']
    if d == 'top':
        return -(ch + v) if parsed['is_outside'] else v
    elif d == 'bottom':
        return parent_h + v if parsed['is_outside'] else parent_h - v - ch
    elif d == 'abs':
        return v
    return 0


# ── nodeViewToChildren conversion ───────────────────────────────────

def nodeViewToChildren(nv: dict[str, Any], node_data: dict[str, Any]) -> list[dict[str, Any]]:
    """Convert nodeview template properties to a children array.

    This is the server-side equivalent of viewer.js's nodeViewToChildren().

    Args:
        nv: NodeView template (from _types/nodeview/XXX.json)
        node_data: Node properties data (from vault note frontmatter)

    Returns:
        A dict representing the children root element, with:
        - shape, rx, stroke, etc. (from template)
        - children: list of child element dicts
    """
    if not nv or not isinstance(nv, dict):
        return []

    props = nv.get('properties', {})
    if not props:
        return []

    # Build children from properties
    children = []
    for prop_key, prop_def in props.items():
        if not isinstance(prop_def, dict):
            continue

        child: dict[str, Any] = {'label': prop_key}

        # Get the property value from node_data
        value = node_data.get(prop_key, '')
        if isinstance(value, list):
            value = ', '.join(str(v) for v in value)
        child['text'] = str(value)

        # Shape and style
        is_pill = prop_def.get('style', '') == 'pill'
        if is_pill:
            child['pill'] = True
            pill_shape = prop_def.get('shape', 'round')
            if pill_shape == 'diamond':
                child['rx'] = 4
            elif pill_shape == 'round':
                child['rx'] = 10
            else:
                child['rx'] = 3
            child['fill'] = prop_def.get('bg', '#fff1')
            child['textColor'] = prop_def.get('textColor', '#eee')
        else:
            child['pill'] = False
            prop_style = prop_def.get('style', 'text')
            if prop_style == 'image':
                child['imageUrl'] = value
            else:
                child['text'] = str(value)

        # Optional pill width override
        if 'pill_width' in prop_def:
            child['w'] = int(prop_def['pill_width'])

        # Optional pill height override
        if 'pill_height' in prop_def:
            child['h'] = int(prop_def['pill_height'])

        # Position: explicit position → absolute coords
        pos = prop_def.get('position')
        if isinstance(pos, dict) and 'x' in pos and 'y' in pos:
            x_val = pos['x']
            y_val = pos['y']
            # Convert to xRel/yRel format
            x_str = str(x_val)
            y_str = str(y_val)
            if x_str.endswith('%'):
                child['xRel'] = f"left-{x_str[:-1]}"
            else:
                child['xRel'] = f"left-{int(x_str)}"
            if y_str.endswith('%'):
                child['yRel'] = f"top-{y_str[:-1]}"
            else:
                child['yRel'] = f"top-{int(y_str)}"
        else:
            # Flow-style: position from top-left
            child['xRel'] = None
            child['yRel'] = None

        # Flow direction (default: flow-down)
        flow = prop_def.get('flow', 'down')
        if flow != 'down':
            child['flow'] = flow
            child['flowSpacing'] = prop_def.get('flowSpacing', 4)
        else:
            child['flow'] = 'down'
            child['flowSpacing'] = prop_def.get('flowSpacing', 5)

        children.append(child)

    # Return children root element
    return {
        'shape': nv.get('shape', 'rect'),
        'rx': nv.get('rx', 4),
        'stroke': nv.get('stroke', '#fff6'),
        'strokeWidth': nv.get('strokeWidth', 1.5),
        'children': children,
    }


# ── Children layout computation ─────────────────────────────────────

def compute_children(node_children: dict[str, Any], parent_w: float, parent_h: float) -> dict[str, Any]:
    """Compute absolute positions for children of a positioned parent node.

    This replicates the core logic of viewer.js's computeChildrenLayout()
    but runs in Python for server-side pre-computation.

    Args:
        node_children: The children root element from nodeViewToChildren()
        parent_w: Parent canvas node width (from type definition)
        parent_h: Parent canvas node height (from type definition)

    Returns:
        The children element with:
        - _cw: computed width
        - _ch: computed height
        - _ax, _ay: absolute positions set to  for children
        - Each child has _ax, _ay computed
    """
    if not node_children or not isinstance(node_children, dict):
        return node_children

    children = node_children.get('children', [])
    if not children:
        node_children['_cw'] = int(parent_w)
        node_children['_ch'] = int(parent_h)
        return node_children

    pad_x = DEFAULT_PAD_X
    pad_y = DEFAULT_PAD_Y
    gap_y = node_children.get('gapY', DEFAULT_GAP_Y)

    # ── Pass 1: Measure children ──────────────────────────────────
    for child in children:
        if child.get('_is_manual'):
            continue
        _measure_child(child, pad_x, pad_y)

    # ── Pass 2: Resolve positions (inside children first) ─────────
    _resolve_children_positions(children, parent_w, parent_h, pad_x, pad_y, gap_y, inside_only=True)

    # ── Compute parent dimensions from children ───────────────────
    max_right = 0
    max_bottom = 0

    for child in children:
        if child.get('_is_manual'):
            continue
        cx = child.get('_ax', 0)
        cy = child.get('_ay', 0)
        cw = child.get('_cw', 0)
        ch = child.get('_ch', 0)
        parsed_x = parse_rel(child.get('xRel'))
        parsed_y = parse_rel(child.get('yRel'))

        # Skip outside children (handled in pass 3)
        if parsed_x and parsed_x.get('is_outside'):
            continue
        if parsed_y and parsed_y.get('is_outside'):
            continue

        # right-N / bottom-N children are pinned to edge, don't expand parent
        if parsed_x and parsed_x['dir'] == 'right' and not parsed_x['is_outside']:
            continue
        if parsed_y and parsed_y['dir'] == 'bottom' and not parsed_y['is_outside']:
            continue

        cr = cx - 0 + cw  # offset from parent origin
        cb = cy - 0 + ch
        if cr > max_right:
            max_right = cr
        if cb > max_bottom:
            max_bottom = cb

    # Apply computed dimensions
    if node_children.get('w') is None:
        node_children['_cw'] = max(int(parent_w), int(max_right) + pad_x * 2)
    else:
        node_children['_cw'] = int(node_children['w'])

    if node_children.get('h') is None:
        node_children['_ch'] = max(int(parent_h), int(max_bottom) + pad_y * 2)
    else:
        node_children['_ch'] = int(node_children['h'])

    # ── Pass 3: Resolve outside children ──────────────────────────
    _resolve_children_positions(children, parent_w, parent_h, pad_x, pad_y, gap_y, inside_only=False)

    # ── Resolve sibling relative sizes ────────────────────────────
    _resolve_sibling_sizes(children, parent_w, parent_h)

    # Set children absolute positions relative to parent origin (0, 0)
    node_children['_ax'] = 0
    node_children['_ay'] = 0

    return node_children


def _measure_child(child: dict, pad_x: float, pad_y: float) -> None:
    """Measure a child element and set _cw/_ch."""
    # Fixed dimensions
    if child.get('w') is not None and child.get('h') is not None:
        child['_cw'] = max(int(child['w']), 20)
        child['_ch'] = max(int(child['h']), 20)
        return

    is_pill = child.get('pill', False)
    font_size = child.get('fontSize', 11)
    text = child.get('text', '')

    # Pill dimensions
    if is_pill:
        pill_w = child.get('w')
        pill_h = child.get('h')
        if pill_w is not None:
            child['_cw'] = max(int(pill_w), 20)
        else:
            w = _estimate_text_w(str(text), font_size)
            child['_cw'] = max(min(w, DEFAULT_PILL_W * 2), 40)
        if pill_h is not None:
            child['_ch'] = max(int(pill_h), 20)
        else:
            child['_ch'] = max(_estimate_text_h(font_size), DEFAULT_PILL_H)
        return

    # Image pill
    if child.get('imageUrl'):
        child['_cw'] = child.get('w', 60)
        child['_ch'] = child.get('h', 60)
        return

    # Text element
    if text:
        h = _estimate_text_h(font_size)
        child['_cw'] = max(int(child.get('w')) if child.get('w') is not None else _estimate_text_w(text, font_size), 20)
        child['_ch'] = max(int(child['h']) if child.get('h') is not None else h, 20)
    else:
        child['_cw'] = max(int(child.get('w')) if child.get('w') is not None else 20, 20)
        child['_ch'] = max(int(child.get('h')) if child.get('h') is not None else 20, 20)


def _resolve_children_positions(
    children: list[dict],
    parent_w: float,
    parent_h: float,
    pad_x: float,
    pad_y: float,
    gap_y: float,
    inside_only: bool,
) -> None:
    """Resolve xRel/yRel positions for children.

    Pass 1 (inside_only=True): Position inside children, compute parent size.
    Pass 2 (inside_only=False): Position outside children, use computed parent size.
    """
    # Track auto-stacking Y position for non-positioned children
    auto_stack_y = 0
    cur_y = pad_y  # Start from top padding

    for child in children:
        if child.get('_is_manual'):
            continue

        parsed_x = parse_rel(child.get('xRel'))
        parsed_y = parse_rel(child.get('yRel'))

        if inside_only:
            # Skip outside children
            if parsed_x and parsed_x.get('is_outside'):
                continue
            if parsed_y and parsed_y.get('is_outside'):
                continue
        else:
            # Only process outside children in pass 2
            if not (parsed_x and parsed_x.get('is_outside')) and not (parsed_y and parsed_y.get('is_outside')):
                continue

        # Resolve X offset
        offset_x = resolve_rel_x(parsed_x, parent_w, child.get('_cw', DEFAULT_PILL_W))
        child['_ax'] = offset_x  # Relative to parent origin

        # Resolve Y offset
        if parsed_y:
            offset_y = resolve_rel_y(parsed_y, parent_h, child.get('_ch', DEFAULT_PILL_H))
            if inside_only:
                # Also consider auto-stack position if no explicit yRel
                if not child.get('yRel') or child['yRel'] is None:
                    offset_y = auto_stack_y
                elif parsed_y['dir'] == 'right' and not parsed_y['is_outside']:
                    # right-N pill: stack vertically for auto flow
                    auto_stack_y += child.get('_ch', DEFAULT_PILL_H) + gap_y
                elif parsed_y['dir'] == 'bottom' and not parsed_y['is_outside']:
                    auto_stack_y += child.get('_ch', DEFAULT_PILL_H) + gap_y
            child['_ay'] = offset_y
        else:
            # No yRel: stack vertically
            if inside_only:
                child['_ay'] = cur_y + auto_stack_y if auto_stack_y > 0 else cur_y
                auto_stack_y += child.get('_ch', DEFAULT_PILL_H) + gap_y
            else:
                # Outside children: center vertically
                child['_ay'] = (parent_h - child.get('_ch', DEFAULT_PILL_H)) / 2


def _resolve_sibling_sizes(children: list[dict], parent_w: float, parent_h: float) -> None:
    """Resolve wRel/hRel (sibling-relative sizing).

    Not fully implemented in Python version. Falls back to child's own size.
    """
    # Build label-to-element map
    label_map: dict[str, dict] = {}
    for child in children:
        label = child.get('label')
        if label:
            label_map[label] = child

    for child in children:
        w_rel = child.get('wRel')
        h_rel = child.get('hRel')

        if w_rel:
            parsed = _parse_size_rel(w_rel)
            if parsed:
                new_w: int | None = None
                if parsed['type'] == 'sibling':
                    sib = label_map.get(parsed['value'])
                    if sib:
                        new_w = sib.get('_cw', child.get('_cw'))
                    else:
                        new_w = child.get('_cw')
                elif parsed['type'] == 'parent':
                    new_w = parent_w
                else:
                    new_w = int(parent_w * parsed.get('value', 0))
                if new_w and new_w > 0:
                    child['w'] = new_w
                    child['_cw'] = new_w

        if h_rel:
            parsed = _parse_size_rel(h_rel)
            if parsed:
                new_h: int | None = None
                if parsed['type'] == 'sibling':
                    sib = label_map.get(parsed['value'])
                    if sib:
                        new_h = sib.get('_ch', child.get('_ch'))
                    else:
                        new_h = child.get('_ch')
                elif parsed['type'] == 'parent':
                    new_h = parent_h
                else:
                    new_h = int(parent_h * parsed.get('value', 0))
                if new_h and new_h > 0:
                    child['h'] = new_h
                    child['_ch'] = new_h


def _parse_size_rel(rel: Any):
    """Parse size relative string (parent, parent-80%, sibling-Label)."""
    if rel is None:
        return None
    s = str(rel).strip()
    if s == 'parent':
        return {'type': 'parent', 'value': 1.0}
    pct = re.match(r'^parent-(\d+)%$', s)
    if pct:
        return {'type': 'parent-percent', 'value': int(pct.group(1)) / 100}
    sib = re.match(r'^(?:child|sibling)-(.+)$', s)
    if sib:
        return {'type': 'sibling', 'value': sib.group(1)}
    return None
