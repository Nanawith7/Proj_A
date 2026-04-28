"""Filtering, exclusion, and sorting logic for candidate node lists."""

from __future__ import annotations

from typing import Any, Optional

from .models import NoteNode


def _match_condition(node: NoteNode, key: str, expected: Any) -> bool:
    """Check if a node satisfies a single condition.

    For scalar values (str, int), performs exact equality match.
    For list values (tags, etc.), performs membership check.
    """
    actual = node.properties.get(key)
    if actual is None:
        return False

    if isinstance(actual, list):
        return expected in actual
    if isinstance(expected, list):
        return actual in expected
    return actual == expected


def apply_filter(
    nodes: list[NoteNode],
    conditions: dict[str, Any],
) -> list[NoteNode]:
    """Apply AND-evaluated filter conditions.

    Args:
        nodes: Candidate node list.
        conditions: Key-value pairs that must all match (AND).

    Returns:
        Filtered node list.
    """
    if not conditions:
        return nodes

    return [
        n for n in nodes
        if all(_match_condition(n, k, v) for k, v in conditions.items())
    ]


def apply_exclude(
    nodes: list[NoteNode],
    conditions: dict[str, Any],
) -> list[NoteNode]:
    """Apply AND-evaluated exclusion conditions.

    Args:
        nodes: Candidate node list.
        conditions: Key-value pairs. Nodes matching ALL are removed.

    Returns:
        Filtered node list with excluded nodes removed.
    """
    if not conditions:
        return nodes

    return [
        n for n in nodes
        if not all(_match_condition(n, k, v) for k, v in conditions.items())
    ]


def _parse_sort_spec(sort_by: Any) -> list[dict[str, Any]]:
    """Normalize the sort specification into a list of {key, order} dicts.

    Accepts:
        - A single string: {"key": "date"} (default order "asc")
        - A list of dicts: [{"key": "date", "order": "asc"}, ...]
    """
    if isinstance(sort_by, str):
        return [{"key": sort_by, "order": "asc"}]
    if isinstance(sort_by, list):
        return sort_by
    return []


def _sort_key_func(specs: list[dict[str, Any]]):
    """Return a sort key function for multi-key sorting."""

    def key_func(node: NoteNode) -> tuple:
        values: list[Any] = []
        for spec in specs:
            key = spec.get("key", "")
            order = spec.get("order", "asc")
            val = node.properties.get(key, "")
            # Normalize: None/empty sorts last in ascending, first in descending
            if val is None or val == "":
                val = (1, "") if order == "asc" else (0, "")
            else:
                val = (0, val) if order == "asc" else (1, val)
            values.append(val)
        return tuple(values)

    return key_func


def apply_sort(
    nodes: list[NoteNode],
    sort_by: Any,
) -> list[NoteNode]:
    """Sort nodes by the specified key(s).

    Args:
        nodes: Node list to sort.
        sort_by: Sort specification (string or list of dicts).

    Returns:
        Sorted node list (stable sort).
    """
    if not sort_by:
        return nodes

    specs = _parse_sort_spec(sort_by)
    if not specs:
        return nodes

    result = list(nodes)
    result.sort(key=_sort_key_func(specs))
    return result


def run_filter_pipeline(
    nodes: list[NoteNode],
    filter_conditions: dict[str, Any],
    exclude_conditions: dict[str, Any],
    sort_by: Any,
) -> list[NoteNode]:
    """Apply filter, exclude, and sort in order.

    Order: filter -> exclude -> sort.
    """
    result = apply_filter(nodes, filter_conditions)
    result = apply_exclude(result, exclude_conditions)
    result = apply_sort(result, sort_by)
    return result
