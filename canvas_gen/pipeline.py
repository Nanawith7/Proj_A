"""Pipeline orchestration for canvas generation.

Canonical order:
  1. Include additional nodes (--include-types)
  2. Filter / Exclude / Sort
  3. Compute effective layout params (icon sizes, row/col dimensions)
  4. Resolve per-node icons
  5. Generate edges
  6. Prune orphans (--prune-orphans)
  7. Compute layout (positions)
"""

from __future__ import annotations

from typing import Any

from .edges import generate_edges, prune_orphaned
from .filter_sort import include_matching, run_filter_pipeline
from .icons import resolve_node_icons
from .children import compute_children, nodeViewToChildren
from .layout import compute_layout, compute_layout_params
from .models import EdgeData, LabelInfo, NoteNode, PositionedNode, TypeDefinition


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
    node_views: dict[str, dict[str, Any]] | None = None,
) -> tuple[list[PositionedNode], list[EdgeData], dict[str, str], int, int, int, int]:
    """Execute full pipeline, returning positioned nodes + edges + metadata."""

    # 1. Include
    include_conds = _parse_simple(include_types) if include_types else {}
    nodes = include_matching(nodes, vault_index, include_conds)

    # 2. Filter / Exclude / Sort
    nodes = run_filter_pipeline(nodes, filter_conditions or {}, exclude_conditions or {}, sort_by)
    print(f"[INFO] Canvas node set: {len(nodes)} nodes.")
    if not nodes:
        return [], [], {}, row_height, column_width, icon_size, icon_size

    # 3. Layout params
    eff_row, eff_col = compute_layout_params(
        nodes, type_defs, column_width, row_height, node_width, node_height, icon_size, icon_gap
    )

    # 4. Icons
    if icon_size > 0 and vault_path:
        resolve_node_icons(nodes, vault_path, icon_size)
    icon_map: dict[str, str] = {}

    # 5. Edges
    edges = generate_edges(nodes, vault_index, label_map)
    print(f"[INFO] Generated {len(edges)} edges.")

    # 6. Prune
    nodes = prune_orphaned(nodes, edges, prune_orphans, include_conds)

    # 7. Layout
    positioned = compute_layout(
        nodes=nodes, x_axis_key=x_axis_key, type_defs=type_defs,
        column_width=eff_col, row_height=eff_row,
        node_width=node_width, node_height=node_height,
    )

    # 7b. Compute children positions for nodes with nodeview templates
    if node_views:
        for pn in positioned:
            td = type_defs.get(pn.node_type)
            nv_key = td.nodeview if td else ""
            nv = node_views.get(nv_key)
            if nv and 'properties' in nv and nv['properties']:
                try:
                    ch_root = nodeViewToChildren(nv, pn.properties)
                    ch_root = compute_children(ch_root, pn.width, pn.height)
                    pn.children = ch_root.get('children', [])
                except Exception:
                    pass

    print(f"[INFO] Layout computed: {len(positioned)} positioned nodes.")

    max_icon_h = max((n.icon_height for n in nodes), default=icon_size)
    return positioned, edges, icon_map, int(eff_row), int(eff_col), icon_size, max_icon_h


def _parse_simple(raw: str) -> dict[str, str]:
    """Parse key=value,key=value string into dict."""
    result: dict[str, str] = {}
    for pair in raw.split(","):
        pair = pair.strip()
        if "=" in pair:
            k, _, v = pair.partition("=")
            result[k.strip()] = v.strip().strip("\"'")
    return result
