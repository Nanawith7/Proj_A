"""Deterministic layout algorithm for positioning canvas nodes.

Supports two modes:
1. Container layout (x_axis_key specified):
   Nodes are grouped into X-axis containers by their x_axis_key value.
   Container width is data-driven, based on the maximum per-type node
   count after lining-based subrow splitting.

2. Grid layout (no x_axis_key):
   Nodes are arranged in type-based rows with optional centering.

Lining semantics:
  - lining = 1 (default): all nodes of a type occupy a single row.
    No subrow splitting occurs. Container width = node count.
  - lining >= 2: nodes are split into subrows of at most <lining>
    nodes each (row-major). Container width = min(lining, node_count).
"""

from __future__ import annotations

import math
from collections import OrderedDict
from typing import Any

from .models import (
    Container,
    NoteNode,
    PositionedNode,
    TypeDefinition,
)


def compute_layout(
    nodes: list[NoteNode],
    x_axis_key: str | None,
    type_defs: dict[str, TypeDefinition],
    column_width: float,
    row_height: float,
    node_width: float,
    node_height: float,
) -> list[PositionedNode]:
    """Compute positions for all canvas nodes.

    Args:
        nodes: Sorted list of nodes to position.
        x_axis_key: Property key for X-axis container grouping (or None).
        type_defs: Type definitions keyed by type name.
        column_width: X spacing between adjacent nodes within a container/subrow.
        row_height: Y spacing between adjacent type rows/subrows.
        node_width: Width of each canvas node element.
        node_height: Height of each canvas node element.

    Returns:
        List of PositionedNode objects with computed x, y coordinates.
    """
    if x_axis_key:
        return _compute_container_layout(
            nodes, x_axis_key, type_defs, column_width, row_height, node_width, node_height
        )
    else:
        return _compute_grid_layout(
            nodes, type_defs, column_width, row_height, node_width, node_height
        )


def _get_lining(type_name: str, type_defs: dict[str, TypeDefinition]) -> int:
    td = type_defs.get(type_name)
    return td.lining if td else 1


def _get_centering(type_name: str, type_defs: dict[str, TypeDefinition]) -> bool:
    td = type_defs.get(type_name)
    return td.centering if td else False


def _effective_width(nodes_count: int, lining: int) -> int:
    """Compute the column width a type contributes to a container.

    lining=1: all nodes in one row → width = node_count.
    lining>=2: nodes split across subrows → width = min(lining, node_count).
    """
    if lining <= 1:
        return nodes_count
    return min(lining, nodes_count)


def _placement_step(node_count: int, lining: int) -> int:
    """Return the step size for iteration over subrows.

    lining=1: single step spanning all nodes.
    lining>=2: step = lining nodes per subrow.
    """
    if lining <= 1:
        return max(1, node_count)  # all nodes in one subrow
    return lining


def _subrow_count(node_count: int, lining: int) -> int:
    """Return the number of subrows needed for a given node count."""
    if not node_count:
        return 0
    if lining <= 1:
        return 1
    return math.ceil(node_count / lining)


# ---------------------------------------------------------------------------
# Container layout (x_axis_key specified)
# ---------------------------------------------------------------------------

def _collect_container_keys(
    nodes: list[NoteNode],
    x_axis_key: str,
) -> list[str]:
    """Collect unique, sorted x_axis_key values from nodes.

    Attempts numeric sorting (integer or float) before falling back
    to lexicographic string sort.
    """
    seen: set[str] = set()
    for node in nodes:
        val = node.properties.get(x_axis_key)
        if val is not None:
            if isinstance(val, list):
                for v in val:
                    seen.add(str(v))
            else:
                seen.add(str(val))

    keys = list(seen)

    # Attempt numeric sort
    def _sort_key(k: str):
        try:
            if "." in k:
                return (0, float(k))
            return (0, int(k))
        except (ValueError, TypeError):
            return (1, k)

    return sorted(keys, key=_sort_key)


def _build_containers(
    nodes: list[NoteNode],
    x_axis_key: str,
    container_keys: list[str],
) -> list[Container]:
    """Build Container objects, grouping nodes by x_axis_key value."""
    key_order = {k: i for i, k in enumerate(container_keys)}
    containers: dict[str, Container] = {}

    for key in container_keys:
        containers[key] = Container(
            key_value=key,
            sort_order=key_order[key],
            nodes_by_type={},
        )

    for node in nodes:
        vals = node.properties.get(x_axis_key)
        node_keys: list[str] = []
        if vals is not None:
            if isinstance(vals, list):
                node_keys = [str(v) for v in vals]
            else:
                node_keys = [str(vals)]

        for nk in node_keys:
            if nk in containers:
                c = containers[nk]
                c.nodes_by_type.setdefault(node.node_type, []).append(node)

    return [containers[k] for k in container_keys]


def _compute_container_widths(
    containers: list[Container],
    type_defs: dict[str, TypeDefinition],
) -> None:
    """Compute width_columns for each container based on node counts and lining."""
    for c in containers:
        max_width = 0
        for type_name, type_nodes in c.nodes_by_type.items():
            if not type_nodes:
                continue
            lining = _get_lining(type_name, type_defs)
            effective = _effective_width(len(type_nodes), lining)
            if effective > max_width:
                max_width = effective
        c.width_columns = max_width


def _compute_container_start_positions(
    containers: list[Container],
    column_width: float,
) -> None:
    """Assign start_x to each container based on cumulative widths."""
    x_cursor = 0.0
    for c in containers:
        c.start_x = x_cursor
        x_cursor += c.width_columns * column_width


def _assign_y_offsets(
    nodes: list[NoteNode],
    containers: list[Container],
    type_defs: dict[str, TypeDefinition],
    row_height: float,
) -> dict[str, float]:
    """Determine the Y base offset for each type row.

    Returns a dict mapping type_name -> y_base.
    """
    type_order: list[str] = list(OrderedDict.fromkeys(
        n.node_type for n in nodes
    ))

    type_y: dict[str, float] = {}
    y_cursor = 0.0

    for type_name in type_order:
        type_y[type_name] = y_cursor
        lining = _get_lining(type_name, type_defs)
        max_subrows = 0
        for c in containers:
            type_nodes = c.nodes_by_type.get(type_name, [])
            if not type_nodes:
                continue
            subrows_needed = _subrow_count(len(type_nodes), lining)
            if subrows_needed > max_subrows:
                max_subrows = subrows_needed
        y_cursor += max(1, max_subrows) * row_height

    return type_y


def _has_x_axis_value(node: NoteNode, x_axis_key: str) -> bool:
    """Check whether a node has a usable value for the given x_axis_key."""
    val = node.properties.get(x_axis_key)
    return val is not None


def _compute_container_layout(
    nodes: list[NoteNode],
    x_axis_key: str,
    type_defs: dict[str, TypeDefinition],
    column_width: float,
    row_height: float,
    node_width: float,
    node_height: float,
) -> list[PositionedNode]:
    """Container-based layout.

    Nodes WITH the x_axis_key value are placed into X-axis containers.
    Nodes WITHOUT the value are placed in a trailing 'uncategorized'
    region using grid layout, shifted right to follow all containers.
    """
    # Split nodes
    container_nodes = [n for n in nodes if _has_x_axis_value(n, x_axis_key)]
    fallback_nodes = [n for n in nodes if not _has_x_axis_value(n, x_axis_key)]

    result: list[PositionedNode] = []

    if container_nodes:
        container_keys = _collect_container_keys(container_nodes, x_axis_key)
        containers = _build_containers(container_nodes, x_axis_key, container_keys)
        _compute_container_widths(containers, type_defs)
        _compute_container_start_positions(containers, column_width)
        type_y_offsets = _assign_y_offsets(container_nodes, containers, type_defs, row_height)

        for c in containers:
            if c.width_columns == 0:
                continue
            for type_name, type_nodes in c.nodes_by_type.items():
                if not type_nodes:
                    continue
                lining = _get_lining(type_name, type_defs)
                y_base = type_y_offsets[type_name]
                step = _placement_step(len(type_nodes), lining)

                for sub_idx in range(0, len(type_nodes), step):
                    sub_nodes = type_nodes[sub_idx: sub_idx + step]
                    sub_row = sub_idx // step
                    sub_y = y_base + sub_row * row_height

                    for col, node in enumerate(sub_nodes):
                        pos_x = c.start_x + col * column_width
                        result.append(PositionedNode(
                            stem=node.stem,
                            file_path=node.file_path,
                            title=node.title,
                            node_type=node.node_type,
                            properties=node.properties,
                            x=pos_x,
                            y=sub_y,
                            width=node_width,
                            height=node_height,
                        ))

        # Compute the X offset for fallback region
        total_container_width = sum(c.width_columns for c in containers) * column_width
        fallback_x_offset = total_container_width + column_width  # gap after containers
    else:
        fallback_x_offset = 0.0

    # Place fallback nodes using grid layout, shifted to the right
    if fallback_nodes:
        if container_nodes:
            print(f"[WARN] {len(fallback_nodes)} node(s) lack '{x_axis_key}' -- placed in uncategorized area.")

        fallback_positions = _compute_grid_layout(
            fallback_nodes, type_defs, column_width, row_height, node_width, node_height
        )
        for pn in fallback_positions:
            pn.x += fallback_x_offset
            result.append(pn)

    return result


# ---------------------------------------------------------------------------
# Grid layout (no x_axis_key)
# ---------------------------------------------------------------------------

def _compute_grid_layout(
    nodes: list[NoteNode],
    type_defs: dict[str, TypeDefinition],
    column_width: float,
    row_height: float,
    node_width: float,
    node_height: float,
) -> list[PositionedNode]:
    """Simple grid layout grouped by type, with lining and centering."""
    type_order: list[str] = list(OrderedDict.fromkeys(
        n.node_type for n in nodes
    ))

    nodes_by_type: dict[str, list[NoteNode]] = {}
    for node in nodes:
        nodes_by_type.setdefault(node.node_type, []).append(node)

    result: list[PositionedNode] = []
    y_cursor = 0.0

    for type_name in type_order:
        type_nodes = nodes_by_type.get(type_name, [])
        if not type_nodes:
            continue

        centering = _get_centering(type_name, type_defs)
        lining = _get_lining(type_name, type_defs)
        step = _placement_step(len(type_nodes), lining)
        max_subrow_width = _effective_width(len(type_nodes), lining)

        for sub_idx in range(0, len(type_nodes), step):
            sub_nodes = type_nodes[sub_idx: sub_idx + step]
            sub_row = sub_idx // step
            sub_y = y_cursor + sub_row * row_height

            if centering and max_subrow_width > 0:
                offset_x = (max_subrow_width - len(sub_nodes)) * column_width / 2.0
            else:
                offset_x = 0.0

            for col, node in enumerate(sub_nodes):
                result.append(PositionedNode(
                    stem=node.stem,
                    file_path=node.file_path,
                    title=node.title,
                    node_type=node.node_type,
                    properties=node.properties,
                    x=offset_x + col * column_width,
                    y=sub_y,
                    width=node_width,
                    height=node_height,
                ))

        y_cursor += _subrow_count(len(type_nodes), lining) * row_height

    return result
