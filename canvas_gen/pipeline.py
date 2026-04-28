"""Pipeline orchestration for canvas generation.

The canonical execution order:
  1. Determine candidate nodes (BFS or full vault scan)
  2. Include additional nodes (--include-types)
  3. Filter / Exclude / Sort
  4. Parse per-node icon sizes, compute effective layout params
  5. Generate per-node icons
  6. Generate edges
  7. Prune orphans (--prune-orphans, respecting --include-types)
  8. Compute layout
  9. Write canvas JSON
"""

from __future__ import annotations

from pathlib import Path
from typing import Any

from .edges import generate_edges
from .filter_sort import _match_condition, apply_filter, run_filter_pipeline
from .icons import generate_node_icon
from .layout import compute_layout
from .models import NoteNode, TypeDefinition, LabelInfo, PositionedNode, EdgeData


def run(
    nodes: list[NoteNode],
    vault_index: dict[str, NoteNode],
    type_defs: dict[str, TypeDefinition],
    label_map: dict[str, LabelInfo],
    *,
    include_types: str | None = None,
    filter_conditions: dict[str, Any] | None = None,
    exclude_conditions: dict[str, Any] | None = None,
    sort_by: Any = None,
    x_axis_key: str | None = None,
    column_width: int = 350,
    row_height: int = 250,
    node_width: int = 300,
    node_height: int = 200,
    icon_size: int = 50,
    icon_gap: int = 4,
    prune_orphans: str | None = None,
    vault_path: str = "",
) -> tuple[list[PositionedNode], list[EdgeData], dict[str, str], int, int, int, int]:
    """Execute the full pipeline and return positioned nodes + edges.

    Returns:
        (positioned_nodes, edges, icon_map, effective_row_height,
         effective_column_width, icon_size, max_icon_h)
    """
    # --- Step 2: Include additional nodes ---
    if include_types:
        conditions = {}
        raw = include_types.strip()
        if raw.startswith("{"):
            import json
            conditions = json.loads(raw)
        else:
            for pair in raw.split(","):
                if "=" in pair:
                    k, _, v = pair.partition("=")
                    conditions[k.strip()] = v.strip().strip("\"'")
        stems = {n.stem for n in nodes}
        added = 0
        for stem, vn in vault_index.items():
            if stem not in stems:
                if all(_match_condition(vn, k, v) for k, v in conditions.items()):
                    nodes.append(vn)
                    stems.add(stem)
                    added += 1
        if added:
            print(f"[INFO] Added {added} node(s) via --include-types.")

    # --- Step 3: Filter / Exclude / Sort ---
    nodes = run_filter_pipeline(nodes, filter_conditions or {}, exclude_conditions or {}, sort_by)
    print(f"[INFO] Canvas node set: {len(nodes)} nodes.")
    if not nodes:
        return [], [], {}, row_height, column_width, icon_size, icon_size

    # --- Step 4: Parse per-node icon sizes, compute effective layout params ---
    max_icon_h = icon_size
    max_icon_w = icon_size
    type_heights = [td.node_height for td in type_defs.values()]
    type_widths = [td.node_width for td in type_defs.values()]
    max_type_height = max(type_heights) if type_heights else node_height
    max_type_width = max(type_widths) if type_widths else node_width

    for node in nodes:
        iw, ih = _parse_icon_size(node.properties.get("icon_size"), icon_size)
        node.icon_width = iw
        node.icon_height = ih
        if ih > max_icon_h:
            max_icon_h = ih
        if iw > max_icon_w:
            max_icon_w = iw

    effective_row_height = row_height
    effective_column_width = column_width
    if icon_size > 0:
        icon_row_height = max_icon_h + icon_gap + max_type_height
        effective_row_height = max(row_height, icon_row_height)
        effective_column_width = max(column_width, max_icon_w, max_type_width)
    print(f"[INFO] Row height: {effective_row_height} (max_icon_h={max_icon_h}, max_node_h={max_type_height})")
    if effective_column_width != column_width:
        print(f"[INFO] Column width: {effective_column_width} (max_icon_w={max_icon_w}, max_node_w={max_type_width})")

    # --- Step 5: Generate per-node icons ---
    icon_map: dict[str, str] = {}
    if icon_size > 0 and vault_path:
        icons_dir = Path(vault_path) / "_icons"
        custom_count = 0
        for node in nodes:
            icon_val = node.properties.get("icon")
            if isinstance(icon_val, str):
                node.icon_path = icon_val
                custom_count += 1
            elif isinstance(icon_val, dict):
                node.icon_path = generate_node_icon(
                    str(icons_dir), node.stem, node.node_type, icon_val, size=icon_size
                )
                custom_count += 1
        if custom_count:
            print(f"[INFO] {custom_count} node(s) have custom icons.")

    # --- Step 6: Generate edges ---
    edges = generate_edges(nodes, vault_index, label_map)
    print(f"[INFO] Generated {len(edges)} edges.")

    # --- Step 7: Prune orphans ---
    if prune_orphans is not None:
        prune_conditions = None
        if prune_orphans != "*":
            prune_conditions = {}
            raw = prune_orphans.strip()
            if raw.startswith("{"):
                import json
                prune_conditions = json.loads(raw)
            else:
                for pair in raw.split(","):
                    if "=" in pair:
                        k, _, v = pair.partition("=")
                        prune_conditions[k.strip()] = v.strip().strip("\"'")
        connected_stems: set[str] = set()
        for edge in edges:
            connected_stems.add(edge.from_node)
            connected_stems.add(edge.to_node)
        # Nodes matching --include-types are protected
        if include_types:
            inc_raw = include_types.strip()
            inc_cond = {}
            if inc_raw.startswith("{"):
                import json
                inc_cond = json.loads(inc_raw)
            else:
                for pair in inc_raw.split(","):
                    if "=" in pair:
                        k, _, v = pair.partition("=")
                        inc_cond[k.strip()] = v.strip().strip("\"'")
            for node in nodes:
                if inc_cond and all(_match_condition(node, k, v) for k, v in inc_cond.items()):
                    connected_stems.add(node.stem)
        before = len(nodes)
        if prune_conditions:
            orphaned = [n for n in nodes if n.stem not in connected_stems]
            pruned_stems = {n.stem for n in apply_filter(orphaned, prune_conditions) if n.stem not in connected_stems}
            nodes = [n for n in nodes if n.stem not in pruned_stems]
        else:
            nodes = [n for n in nodes if n.stem in connected_stems]
        pruned = before - len(nodes)
        if pruned:
            print(f"[INFO] Pruned {pruned} orphaned node(s).")

    # --- Step 8: Compute layout ---
    positioned = compute_layout(
        nodes=nodes,
        x_axis_key=x_axis_key,
        type_defs=type_defs,
        column_width=effective_column_width,
        row_height=effective_row_height,
        node_width=node_width,
        node_height=node_height,
    )
    print(f"[INFO] Layout computed: {len(positioned)} positioned nodes.")

    return positioned, edges, icon_map, effective_row_height, effective_column_width, icon_size, max_icon_h


def _parse_icon_size(raw: Any, default: int) -> tuple[int, int]:
    """Parse icon_size value into (width, height)."""
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
