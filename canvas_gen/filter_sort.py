"""Filtering, exclusion, and sorting logic for candidate node lists.

Supports AND/OR logic via a `$or` special key:
  - Top-level keys are AND-evaluated.
  - `$or: [...]` takes a list of condition dicts; at least one must match.
  - Repeated keys in key=value format are OR-evaluated for that key.
"""

from __future__ import annotations

from typing import Any

from .models import NoteNode


def _match_condition(node: NoteNode, key: str, expected: Any) -> bool:
    """Check if a node satisfies a single condition.

    Special key:
      $or: expected is a list of {key: value} dicts.
           Returns True if at least one sub-condition fully matches.

    Regular key:
      - List actual: checks expected in list, also tries [[expected]] (wiki link).
      - List expected: checks actual in expected (OR).
      - Scalar: exact equality, also tries stripping [[ ]] from actual.
    """
    if key == "$or":
        if isinstance(expected, list):
            return any(
                all(_match_condition(node, k, v) for k, v in cond.items())
                for cond in expected
            )
        return False

    actual = node.properties.get(key)
    if actual is None:
        return False

    if isinstance(actual, list):
        if expected in actual:
            return True
        return f"[[{expected}]]" in actual

    if isinstance(expected, list):
        if actual in expected:
            return True
        # Also check wiki-link-normalized actual
        if actual.startswith("[[") and actual.endswith("]]"):
            return actual[2:-2] in expected
        return False

    if actual == expected:
        return True
    # Compare stripped wiki link
    if isinstance(actual, str) and actual.startswith("[[") and actual.endswith("]]"):
        return actual[2:-2] == expected
    if isinstance(expected, str) and expected.startswith("[[") and expected.endswith("]]"):
        return actual == expected[2:-2]
    return False


def apply_filter(
    nodes: list[NoteNode],
    conditions: dict[str, Any],
) -> list[NoteNode]:
    """Apply AND-evaluated filter conditions.

    Keys are ANDed.  `$or` nested conditions are ORed internally.
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

    Nodes matching ALL conditions are removed.
    """
    if not conditions:
        return nodes

    return [
        n for n in nodes
        if not all(_match_condition(n, k, v) for k, v in conditions.items())
    ]


def _parse_sort_spec(sort_by: Any) -> list[dict[str, Any]]:
    if isinstance(sort_by, str):
        return [{"key": sort_by, "order": "asc"}]
    if isinstance(sort_by, list):
        return sort_by
    return []


def _sort_key_func(specs: list[dict[str, Any]]):
    def key_func(node: NoteNode) -> tuple:
        values: list[Any] = []
        for spec in specs:
            key = spec.get("key", "")
            order = spec.get("order", "asc")
            val = node.properties.get(key, "")
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
    """Apply filter, exclude, and sort in order."""
    result = apply_filter(nodes, filter_conditions)
    result = apply_exclude(result, exclude_conditions)
    result = apply_sort(result, sort_by)
    return result


def include_matching(
    nodes: list[NoteNode],
    vault_index: dict[str, NoteNode],
    conditions: dict[str, Any],
) -> list[NoteNode]:
    """Add vault nodes matching conditions that are not already in the list."""
    if not conditions:
        return nodes
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
    return nodes
