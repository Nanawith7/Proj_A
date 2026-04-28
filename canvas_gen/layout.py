"""Deterministic layout algorithm for positioning canvas nodes.

Supports two modes:
1. Container layout (x_axis_key specified):
   Nodes are grouped into X-axis containers by their x_axis_key value.
   Container width is data-driven, based on the maximum per-type node
   count after lining-based subrow splitting.

2. Grid layout (no x_axis_key):
   Nodes are arranged in type-based rows with optional centering.

Lining semantics (column-major distribution):
  - lining = 1 (default): all nodes of a type occupy a single row.
  - lining >= 2: exactly <lining> subrows.  Nodes are distributed
    column-major: subrow 0 gets node[0], node[L], node[2L], ...
    subrow 1 gets node[1], node[1+L], ... and so on.
  - Container width contribution per type = ceil(node_count / lining).
"""

from __future__ import annotations

import math
from collections import OrderedDict

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


def _get_color(type_name: str, type_defs: dict[str, TypeDefinition]) -> str:
    td = type_defs.get(type_name)
    return td.color if td else ""


def _get_node_width(type_name: str, type_defs: dict[str, TypeDefinition], default: float) -> float:
    td = type_defs.get(type_name)
    return td.node_width if td else default


def _get_node_height(type_name: str, type_defs: dict[str, TypeDefinition], default: float) -> float:
    td = type_defs.get(type_name)
    return td.node_height if td else default


def _effective_width(node_count: int, lining: int) -> int:
    """Compute the column width a type contributes to a container.

    With column-major distribution across <lining> subrows,
    the widest subrow holds ceil(node_count / lining) nodes.
    """
    if not node_count:
        return 0
    return math.ceil(node_count / max(1, lining))


def _subrow_count(node_count: int, lining: int) -> int:
    """Return the number of subrows for a given node count.

    lining defines the exact number of subrows (column-major distribution).
    An empty type occupies 0 subrows.
    """
    if not node_count:
        return 0
    return max(1, lining)


def _column_major_slice(nodes: list[NoteNode], sub_row: int, lining: int) -> list[NoteNode]:
    """Slice a node list for a given subrow using column-major ordering.

    sub_row=0 → nodes[0], nodes[L], nodes[2L], ...
    sub_row=1 → nodes[1], nodes[1+L], ...
    """
    return nodes[sub_row::lining]


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
    type_defs: dict[str, TypeDefinition],
    row_height: float,
) -> tuple[dict[str, float], float]:
    """Determine the Y base offset for each type row.

    Y space is determined solely by the type's lining value
    (number of subrows), not by per-container node counts.
    This ensures consistent row spans across all containers.

    Returns a tuple of (type_name -> y_base dict, total_y_height).
    """
    type_order: list[str] = sorted(OrderedDict.fromkeys(
        n.node_type for n in nodes
    ))

    type_y: dict[str, float] = {}
    y_cursor = 0.0

    for type_name in type_order:
        type_y[type_name] = y_cursor
        lining = _get_lining(type_name, type_defs)
        y_cursor += max(1, lining) * row_height

    return type_y, y_cursor


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
    """Container-based layout with column-major subrow distribution."""
    container_nodes = [n for n in nodes if _has_x_axis_value(n, x_axis_key)]
    fallback_nodes = [n for n in nodes if not _has_x_axis_value(n, x_axis_key)]

    result: list[PositionedNode] = []

    if container_nodes:
        container_keys = _collect_container_keys(container_nodes, x_axis_key)
        containers = _build_containers(container_nodes, x_axis_key, container_keys)
        _compute_container_widths(containers, type_defs)
        _compute_container_start_positions(containers, column_width)
        type_y_offsets, total_container_y = _assign_y_offsets(
            container_nodes, type_defs, row_height
        )

        for c in containers:
            if c.width_columns == 0:
                continue
            for type_name, type_nodes in c.nodes_by_type.items():
                if not type_nodes:
                    continue
                lining = _get_lining(type_name, type_defs)
                y_base = type_y_offsets[type_name]

                for sub_row in range(max(1, lining)):
                    sub_nodes = _column_major_slice(type_nodes, sub_row, lining)
                    if not sub_nodes:
                        continue
                    sub_y = y_base + sub_row * row_height
                    node_color = _get_color(type_name, type_defs)
                    nw = _get_node_width(type_name, type_defs, node_width)
                    nh = _get_node_height(type_name, type_defs, node_height)
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
                            width=nw,
                            height=nh,
                            color=node_color,
                            icon_path=node.icon_path,
                            icon_width=node.icon_width,
                            icon_height=node.icon_height,
                        ))

        total_container_width = sum(c.width_columns for c in containers) * column_width
        fallback_y_offset = total_container_y + row_height
    else:
        total_container_width = 0.0
        fallback_y_offset = 0.0

    if fallback_nodes:
        if container_nodes:
            print(f"[WARN] {len(fallback_nodes)} node(s) lack '{x_axis_key}' -- placed in uncategorized area.")

        fallback_positions = _compute_grid_layout(
            fallback_nodes, type_defs, column_width, row_height,
            node_width, node_height, y_base=fallback_y_offset
        )
        fallback_width = max((pn.x + pn.width for pn in fallback_positions), default=0)

        # Mutual centering: both sections share a common vertical center
        common_center = max(total_container_width, fallback_width) / 2
        container_shift = common_center - total_container_width / 2
        fallback_shift = common_center - fallback_width / 2

        for pn in result:
            pn.x += container_shift
        for pn in fallback_positions:
            pn.x += fallback_shift
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
    y_base: float = 0.0,
) -> list[PositionedNode]:
    """Grid layout grouped by type, with column-major lining and centering.

    Args:
        y_base: Base Y offset (used when embedding grid below a container region).
    """
    type_order: list[str] = sorted(OrderedDict.fromkeys(
        n.node_type for n in nodes
    ))

    nodes_by_type: dict[str, list[NoteNode]] = {}
    for node in nodes:
        nodes_by_type.setdefault(node.node_type, []).append(node)

    # Compute global max subrow width for unified centering grid
    global_max_width = 0
    for type_nodes in nodes_by_type.values():
        lining = _get_lining(type_nodes[0].node_type if type_nodes else "", type_defs)
        w = _effective_width(len(type_nodes), lining)
        if w > global_max_width:
            global_max_width = w

    result: list[PositionedNode] = []
    y_cursor = y_base

    for type_name in type_order:
        type_nodes = nodes_by_type.get(type_name, [])
        if not type_nodes:
            continue

        centering = _get_centering(type_name, type_defs)
        lining = _get_lining(type_name, type_defs)
        subrows = max(1, lining)

        for sub_row in range(subrows):
            sub_nodes = _column_major_slice(type_nodes, sub_row, lining)
            if not sub_nodes:
                continue
            sub_y = y_cursor + sub_row * row_height

            if centering and global_max_width > 0:
                offset_x = (global_max_width - len(sub_nodes)) * column_width / 2.0
            else:
                offset_x = 0.0

            node_color = _get_color(type_name, type_defs)
            nw = _get_node_width(type_name, type_defs, node_width)
            nh = _get_node_height(type_name, type_defs, node_height)
            for col, node in enumerate(sub_nodes):
                result.append(PositionedNode(
                    stem=node.stem,
                    file_path=node.file_path,
                    title=node.title,
                    node_type=node.node_type,
                    properties=node.properties,
                    x=offset_x + col * column_width,
                    y=sub_y,
                    width=nw,
                    height=nh,
                    color=node_color,
                    icon_path=node.icon_path,
                    icon_width=node.icon_width,
                    icon_height=node.icon_height,
                ))

        y_cursor += subrows * row_height

    return result
