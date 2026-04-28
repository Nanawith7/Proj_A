"""Generate icon PNG images for canvas nodes.

Supports two modes:
1. Per-type icons: one icon per type (character → blue circle + triangle, etc.)
2. Per-node icons: unique icon per node when the note has an `icon` field in
   its frontmatter (e.g. icon: {shape: diamond, color: "#FF0000"}).

The outer shape/color comes from the type definition, the inner shape/color
can be overridden per-node via the `icon` frontmatter property.
"""

from __future__ import annotations

import math
from pathlib import Path


def _ensure_pillow() -> None:
    try:
        from PIL import Image, ImageDraw  # noqa: F401
    except ImportError:
        raise ImportError("Pillow is required for icon generation. Install with: pip install Pillow")


def _draw_circle(draw, cx: int, cy: int, r: int, fill: str, outline: str = "") -> None:
    draw.ellipse([cx - r, cy - r, cx + r, cy + r], fill=fill, outline=outline or fill, width=2)


def _draw_triangle(draw, cx: int, cy: int, size: int, fill: str) -> None:
    h = int(size * math.sqrt(3) / 2)
    points = [(cx, cy - h // 2), (cx - size // 2, cy + h // 2), (cx + size // 2, cy + h // 2)]
    draw.polygon(points, fill=fill)


def _draw_diamond(draw, cx: int, cy: int, size: int, fill: str) -> None:
    points = [(cx, cy - size // 2), (cx + size // 2, cy), (cx, cy + size // 2), (cx - size // 2, cy)]
    draw.polygon(points, fill=fill)


def _draw_square(draw, cx: int, cy: int, size: int, fill: str) -> None:
    half = size // 2
    draw.rectangle([cx - half, cy - half, cx + half, cy + half], fill=fill)


def _draw_star(draw, cx: int, cy: int, size: int, fill: str) -> None:
    points = []
    outer_r = size // 2
    inner_r = outer_r // 2
    for i in range(10):
        angle = math.pi / 2 + i * math.pi / 5
        r = outer_r if i % 2 == 0 else inner_r
        points.append((cx + r * math.cos(angle), cy - r * math.sin(angle)))
    draw.polygon(points, fill=fill)


_SHAPES = {"triangle": _draw_triangle, "diamond": _draw_diamond, "square": _draw_square, "star": _draw_star, "circle": _draw_circle}


TYPE_SPECS = {
    "character":    {"outer_shape": "circle",   "default_inner": "triangle", "color": "#2196F3"},
    "scenario":     {"outer_shape": "square",   "default_inner": "diamond",  "color": "#FF9800"},
    "event":        {"outer_shape": "triangle", "default_inner": "star",     "color": "#E91E63"},
    "organization": {"outer_shape": "circle",   "default_inner": "square",   "color": "#4CAF50"},
}


def _draw_shape(draw, shape_name: str, cx: int, cy: int, size: int, fill: str, color: str) -> None:
    fn = _SHAPES.get(shape_name)
    if fn is None:
        return
    if shape_name == "circle":
        fn(draw, cx, cy, size // 2 - 2, fill, color)
    else:
        fn(draw, cx, cy, size, fill)


def _make_icon_png(
    output_path: Path,
    size: int,
    outer_shape: str,
    outer_color: str,
    inner_shape: str,
    inner_color: str,
) -> None:
    from PIL import Image, ImageDraw

    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    cx, cy = size // 2, size // 2
    outer_r = size // 2 - 4
    inner_sz = size // 3

    # Outer
    _draw_shape(draw, outer_shape, cx, cy, outer_r * 2, outer_color, outer_color)

    # Inner
    if inner_shape == "circle":
        _draw_circle(draw, cx, cy, inner_sz // 2, inner_color)
    else:
        _draw_shape(draw, inner_shape, cx, cy, inner_sz, inner_color, inner_color)

    img.save(output_path, "PNG")


def generate_type_icons(output_dir: str | Path, size: int = 50) -> dict[str, str]:
    """Generate one icon per type. Returns {type_name: icon_path}."""
    _ensure_pillow()

    out = Path(output_dir)
    out.mkdir(parents=True, exist_ok=True)

    icon_map: dict[str, str] = {}
    for type_name, spec in TYPE_SPECS.items():
        filename = f"type_{type_name}.png"
        _make_icon_png(
            out / filename, size,
            outer_shape=spec["outer_shape"],
            outer_color=spec["color"],
            inner_shape=spec["default_inner"],
            inner_color="#FFFFFF",
        )
        icon_map[type_name] = f"_icons/{filename}"

    # Default icon
    _make_icon_png(out / "type_default.png", size, "circle", "#9E9E9E", "circle", "#FFFFFF")
    icon_map["default"] = "_icons/type_default.png"

    return icon_map


def generate_node_icon(
    output_dir: str | Path,
    stem: str,
    node_type: str,
    icon_override: dict[str, str] | None,
    size: int = 50,
) -> str:
    """Generate a per-node icon PNG.

    Args:
        output_dir: Directory for icon files.
        stem: Note stem (used for filename).
        node_type: The note's type (determines outer shape/color).
        icon_override: Optional dict with 'shape' and/or 'color' for the inner icon.
        size: Icon size in pixels.

    Returns:
        Relative path to the generated icon file.
    """
    _ensure_pillow()

    out = Path(output_dir)
    out.mkdir(parents=True, exist_ok=True)

    spec = TYPE_SPECS.get(node_type, {"outer_shape": "circle", "default_inner": "circle", "color": "#9E9E9E"})
    inner_shape = spec["default_inner"]
    inner_color = "#FFFFFF"

    if icon_override:
        if "shape" in icon_override:
            inner_shape = icon_override["shape"]
        if "color" in icon_override:
            inner_color = icon_override["color"]

    filename = f"node_{stem}.png"
    _make_icon_png(out / filename, size, spec["outer_shape"], spec["color"], inner_shape, inner_color)
    return f"_icons/{filename}"
