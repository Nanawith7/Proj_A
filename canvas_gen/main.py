"""CLI entry point for the bottom-up Canvas generator.

Parses command-line arguments, orchestrates the pipeline:
  1. Load configuration (type definitions, label mappings)
  2. Scan vault and index all notes
  3. Optionally traverse from a base node
  4. Apply filter, exclude, and sort
  5. Generate edges (only between canvas nodes)
  6. Compute layout coordinates
  7. Write JSON Canvas output file

Usage:
    python -m canvas_gen.main --vault /path/to/vault [options]
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path


from .config import (
    load_label_mappings,
    load_type_definitions,
    resolve_label_mapping_path,
    resolve_type_def_path,
)
from .edges import generate_edges
from .extractor import collect_related_nodes, scan_vault
from .filter_sort import run_filter_pipeline
from .icons import generate_type_icons, generate_node_icon
from .layout import compute_layout
from .models import DEFAULT_LABEL_MAPPING_PATH, DEFAULT_TYPE_DEF_PATH
from .writer import write_canvas


def _parse_sort_by(raw: str) -> Any:
    """Parse the --sort-by argument.

    Accepts either a plain string (single key, ascending) or a JSON
    array of {key, order} objects.
    """
    if not raw:
        return None
    raw = raw.strip()
    if raw.startswith("["):
        return json.loads(raw)
    return raw


def _parse_conditions(raw: str) -> dict[str, Any] | None:
    """Parse filter/exclude conditions.

    Accepts:
      1. JSON dict: '{"type":"character"}' or '{"$or":[{"type":"character"},{"type":"tag"}]}'
      2. Key=value:  'type=character,tags=main'
         Comma separates AND-groups.
         Pipe in value → OR list: 'type=character|tag' → {"type": ["character","tag"]}
         Repeated key → OR list: 'type=character,type=tag' → {"type": ["character","tag"]}
    """
    if not raw:
        return None
    raw = raw.strip()
    if raw.startswith("{"):
        return json.loads(raw)
    result: dict[str, Any] = {}
    for pair in raw.split(","):
        pair = pair.strip()
        if "=" in pair:
            key, _, val = pair.partition("=")
            key = key.strip()
            val_raw = val.strip().strip("\"'")
            # Split on | for OR values
            if "|" in val_raw:
                val_list = [v.strip() for v in val_raw.split("|")]
                existing = result.get(key)
                if isinstance(existing, list):
                    result[key] = existing + val_list
                elif existing is not None:
                    result[key] = [existing] + val_list
                else:
                    result[key] = val_list if len(val_list) > 1 else val_list[0]
            else:
                existing = result.get(key)
                if existing is not None:
                    if isinstance(existing, list):
                        existing.append(val_raw)
                    else:
                        result[key] = [existing, val_raw]
                else:
                    result[key] = val_raw
    return result if result else None


def _parse_icon_size(raw: Any, default: int) -> tuple[int, int]:
    """Parse icon_size value into (width, height).

    Accepts:
      - None / missing → (default, default)
      - int: 80 → (80, 80)
      - str: "80x60" → (80, 60)
    """
    if raw is None:
        return (default, default)
    if isinstance(raw, int):
        return (raw, raw)
    if isinstance(raw, str):
        parts = raw.split("x")
        if len(parts) == 2:
            return (int(parts[0]), int(parts[1]))
        return (int(parts[0]), int(parts[0]))
    return (default, default)


def _build_arg_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(
        description="Generate an Obsidian Canvas from vault metadata using bottom-up extraction.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=f"""\
Configuration files (auto-detected from vault root):
  Type definitions:    {DEFAULT_TYPE_DEF_PATH}
  Label mappings:      {DEFAULT_LABEL_MAPPING_PATH}

Example:
  python -m canvas_gen.main --vault ./my_vault --output timeline.canvas \\
      --base-node "main_char" --depth 2 --filter '{{"type":"character"}}' \\
      --sort-by date --x-axis-key year
""",
    )

    p.add_argument(
        "--vault", required=True,
        help="Path to the Obsidian vault root directory.",
    )
    p.add_argument(
        "--output", default="output.canvas",
        help="Output .canvas file path (default: output.canvas).",
    )
    p.add_argument(
        "--base-node",
        help="Starting note stem (filename without .md).",
    )
    p.add_argument(
        "--depth", type=int, default=None,
        help="BFS traversal depth from the base node (default: full vault scan).",
    )
    p.add_argument(
        "--filter", type=str, default=None,
        help='Filter (JSON or key=value). | = OR: type=character|tag. JSON: {"$or":[...]}.',
    )
    p.add_argument(
        "--exclude", type=str, default=None,
        help='Exclude (JSON or key=value). Supports | and $or like --filter.',
    )
    p.add_argument(
        "--sort-by", type=str, default=None,
        help='Sort specification: a key name or JSON array [{"key":"date","order":"asc"}].',
    )
    p.add_argument(
        "--x-axis-key",
        help="Property key used for X-axis container grouping.",
    )
    p.add_argument(
        "--type-def-path",
        help=f"Path to the type definitions YAML (default: vault/{DEFAULT_TYPE_DEF_PATH}).",
    )
    p.add_argument(
        "--label-mapping-path",
        help=f"Path to the label mappings YAML (default: vault/{DEFAULT_LABEL_MAPPING_PATH}).",
    )
    p.add_argument(
        "--column-width", type=int, default=350,
        help="X spacing between adjacent nodes in pixels (default: 350).",
    )
    p.add_argument(
        "--row-height", type=int, default=250,
        help="Y spacing between rows in pixels (default: 250).",
    )
    p.add_argument(
        "--node-width", type=int, default=300,
        help="Width of each canvas node element (default: 300).",
    )
    p.add_argument(
        "--node-height", type=int, default=200,
        help="Default height of canvas node elements (default: 200). Overridden per-type.",
    )
    p.add_argument(
        "--icon-size", type=int, default=50,
        help="Icon node size in pixels (default: 50). Set to 0 to disable icons.",
    )
    p.add_argument(
        "--icon-gap", type=int, default=4,
        help="Gap between icon and file node in pixels (default: 4).",
    )
    p.add_argument(
        "--prune-orphans", action="store_true", default=False,
        help="Remove nodes with zero edges from the final canvas.",
    )

    return p


def main(argv: list[str] | None = None) -> int:
    parser = _build_arg_parser()
    args = parser.parse_args(argv)

    vault_path = Path(args.vault).resolve()
    if not vault_path.is_dir():
        print(f"ERROR: Vault directory not found: {vault_path}", file=sys.stderr)
        return 1

    # --- Resolve config file paths ---
    type_def_path = args.type_def_path
    if not type_def_path:
        type_def_path = resolve_type_def_path(str(vault_path), None)
    label_mapping_path = args.label_mapping_path
    if not label_mapping_path:
        label_mapping_path = resolve_label_mapping_path(str(vault_path), None)

    # --- Load configurations ---
    print(f"[INFO] Vault: {vault_path}")
    print(f"[INFO] Type definitions: {type_def_path or '(defaults)'}")
    print(f"[INFO] Label mappings: {label_mapping_path or '(raw keys)'}")

    type_defs = load_type_definitions(type_def_path)
    label_map = load_label_mappings(label_mapping_path)

    # --- Generate type icons (always, for fallback) ---
    icon_size = args.icon_size
    icon_map: dict[str, str] = {}
    if icon_size > 0:
        icons_dir = Path(str(vault_path)) / "_icons"
        icon_map = generate_type_icons(str(icons_dir), size=icon_size)

    # --- Scan vault ---
    print("[INFO] Scanning vault...")
    vault_index = scan_vault(str(vault_path))
    print(f"[INFO] Found {len(vault_index)} notes.")

    # --- Determine candidate nodes ---
    filter_conditions = _parse_conditions(args.filter) or {}
    exclude_conditions = _parse_conditions(args.exclude) or {}
    sort_by = _parse_sort_by(args.sort_by)

    if args.base_node:
        base_stem = Path(args.base_node).stem
        if args.depth is not None:
            if args.depth < 0:
                print("ERROR: --depth must be >= 0", file=sys.stderr)
                return 1
            related_stems = collect_related_nodes(base_stem, vault_index, args.depth)
            nodes = [vault_index[s] for s in related_stems]
            print(f"[INFO] BFS from '{base_stem}' (depth={args.depth}): {len(nodes)} nodes.")
        else:
            # No depth specified: use all notes but anchored from base context
            nodes = list(vault_index.values())
            print(f"[INFO] Full vault scan (base node '{base_stem}' specified without depth).")
    else:
        nodes = list(vault_index.values())
        print("[INFO] No base node specified -- using full vault.")

    # --- Filter / Exclude / Sort ---
    nodes = run_filter_pipeline(nodes, filter_conditions, exclude_conditions, sort_by)
    print(f"[INFO] After filter/exclude/sort: {len(nodes)} nodes.")

    if not nodes:
        print("[WARN] No nodes match the criteria. Writing empty canvas.")
        # Still write an empty canvas file
        write_canvas(args.output, [], [], icon_map, icon_size, args.icon_gap, icon_size)
        return 0

    print(f"[INFO] Canvas node set: {len(nodes)} nodes.")

    # --- Parse per-node icon sizes and compute effective layout params ---
    max_icon_h = icon_size
    type_heights = [td.node_height for td in type_defs.values()]
    max_type_height = max(type_heights) if type_heights else args.node_height

    for node in nodes:
        iw, ih = _parse_icon_size(node.properties.get("icon_size"), icon_size)
        node.icon_width = iw
        node.icon_height = ih
        if ih > max_icon_h:
            max_icon_h = ih

    effective_row_height = args.row_height
    if icon_size > 0:
        icon_row_height = max_icon_h + args.icon_gap + max_type_height
        effective_row_height = max(args.row_height, icon_row_height)
    print(f"[INFO] Row height: {effective_row_height} (max_icon_h={max_icon_h}, max_node_h={max_type_height})")

    # --- Generate per-node icons ---
    if icon_size > 0:
        icons_dir = Path(str(vault_path)) / "_icons"
        custom_count = 0
        for node in nodes:
            icon_val = node.properties.get("icon")
            if isinstance(icon_val, str):
                # Direct path: "icon: _icons/hero.png"
                node.icon_path = icon_val
                custom_count += 1
            elif isinstance(icon_val, dict):
                # Shape spec: generate per-node icon
                node.icon_path = generate_node_icon(
                    str(icons_dir), node.stem, node.node_type, icon_val, size=icon_size
                )
                custom_count += 1
        if custom_count:
            print(f"[INFO] {custom_count} node(s) have custom icons.")

    # --- Generate edges ---
    edges = generate_edges(nodes, vault_index, label_map)
    print(f"[INFO] Generated {len(edges)} edges.")

    # --- Prune orphaned nodes (zero edges) ---
    if args.prune_orphans:
        connected_stems: set[str] = set()
        for edge in edges:
            connected_stems.add(edge.from_node)
            connected_stems.add(edge.to_node)
        before = len(nodes)
        nodes = [n for n in nodes if n.stem in connected_stems]
        pruned = before - len(nodes)
        if pruned:
            print(f"[INFO] Pruned {pruned} orphaned node(s) with no edges.")

    # --- Compute layout ---
    positioned = compute_layout(
        nodes=nodes,
        x_axis_key=args.x_axis_key,
        type_defs=type_defs,
        column_width=args.column_width,
        row_height=effective_row_height,
        node_width=args.node_width,
        node_height=args.node_height,
    )
    print(f"[INFO] Layout computed: {len(positioned)} positioned nodes.")

    # --- Write output ---
    output_path = write_canvas(
        args.output, positioned, edges,
        icon_map, icon_size, args.icon_gap, max_icon_h
    )
    print(f"[INFO] Canvas written to: {output_path}")

    return 0


if __name__ == "__main__":
    sys.exit(main())
