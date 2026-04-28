"""Self-contained HTML viewer exporter.

Generates a single HTML file that renders a .canvas JSON in the browser
with SVG-based graph display, click-to-expand note content, and a full
filter GUI sidebar ported from filter_sort.py.

Requires no server — open the HTML file in any browser.
"""

from __future__ import annotations

import base64
import json
import re
from pathlib import Path
from typing import Any

from ..extractor import parse_frontmatter

_TEMPLATE = None


def _load_template() -> str:
    global _TEMPLATE
    if _TEMPLATE is None:
        tpl_path = Path(__file__).parent / "template.html"
        with open(tpl_path, "r", encoding="utf-8") as f:
            _TEMPLATE = f.read()
    return _TEMPLATE


def _collect_vault_content(vault_path: str) -> dict[str, dict[str, Any]]:
    """Scan vault for all .md files, return {stem: {props, body}}."""
    vault = Path(vault_path)
    content_map: dict[str, dict[str, Any]] = {}
    if not vault.is_dir():
        return content_map

    for md_file in vault.rglob("*.md"):
        try:
            text = md_file.read_text(encoding="utf-8")
        except (OSError, UnicodeDecodeError):
            continue
        props, body = parse_frontmatter(text)
        stem = md_file.stem
        # Clean up body: remove leading whitespace
        body = body.strip()
        content_map[stem] = {
            "file": str(md_file.relative_to(vault)).replace("\\", "/"),
            "props": props,
            "body": body,
        }
    return content_map


def _collect_icons(vault_path: str) -> dict[str, str]:
    """Base64-encode all icon PNGs in _icons/ directory."""
    icons_dir = Path(vault_path) / "_icons"
    icons: dict[str, str] = {}
    if not icons_dir.is_dir():
        return icons
    for png in icons_dir.glob("*.png"):
        try:
            data = png.read_bytes()
            b64 = base64.b64encode(data).decode("ascii")
            icons[png.name] = f"data:image/png;base64,{b64}"
        except OSError:
            continue
    return icons


def export_viewer(
    vault_path: str,
    canvas_path: str,
    output_path: str,
    style_config: dict[str, Any] | None = None,
) -> str:
    """Generate a self-contained HTML viewer.

    Args:
        vault_path: Path to Obsidian vault root.
        canvas_path: Path to the .canvas JSON file.
        output_path: Where to write the HTML file.
        style_config: Optional visual style overrides.

    Returns:
        Absolute path to the generated HTML file.
    """
    # Load canvas JSON
    with open(canvas_path, "r", encoding="utf-8") as f:
        canvas_data = json.load(f)

    # Collect vault content
    vault_content = _collect_vault_content(vault_path)

    # Collect icon images
    icons = _collect_icons(vault_path)

    # Build embedded data
    embedded = {
        "canvas": canvas_data,
        "vault": vault_content,
        "icons": icons,
        "style": style_config or {},
    }

    template = _load_template()
    data_json = json.dumps(embedded, ensure_ascii=False)
    html = template.replace("/*__VAULT_DATA_PLACEHOLDER__*/", data_json)

    output_file = Path(output_path)
    output_file.parent.mkdir(parents=True, exist_ok=True)
    with open(output_file, "w", encoding="utf-8") as f:
        f.write(html)

    return str(output_file.resolve())
