"""JSON Canvas file output.

Converts positioned nodes and edges into the JSON Canvas 1.0 format
and writes the result as a .canvas file.
"""

from __future__ import annotations

import json
import uuid
from pathlib import Path
from typing import Any

from .models import EdgeData, PositionedNode


def _make_node_object(node: PositionedNode, node_id: str) -> dict[str, Any]:
    """Convert a PositionedNode into a JSON Canvas node object."""
    return {
        "id": node_id,
        "type": "file",
        "file": str(node.file_path),
        "x": int(node.x),
        "y": int(node.y),
        "width": int(node.width),
        "height": int(node.height),
    }


def _make_edge_object(
    edge: EdgeData,
    node_id_map: dict[str, str],
) -> dict[str, Any] | None:
    """Convert an EdgeData into a JSON Canvas edge object.

    Returns None if either endpoint is not in the node_id_map.
    """
    from_id = node_id_map.get(edge.from_node)
    to_id = node_id_map.get(edge.to_node)
    if from_id is None or to_id is None:
        return None
    edge_obj: dict[str, Any] = {
        "id": str(uuid.uuid4()),
        "fromNode": from_id,
        "toNode": to_id,
    }
    if edge.label:
        edge_obj["label"] = edge.label
    return edge_obj


def write_canvas(
    output_path: str,
    positioned_nodes: list[PositionedNode],
    edges: list[EdgeData],
) -> str:
    """Write a .canvas file.

    Assigns unique canvas node IDs (using stem names as IDs for
    consistency) and writes the JSON Canvas 1.0 structure.

    Args:
        output_path: Destination file path (should end with .canvas).
        positioned_nodes: Nodes with computed coordinates.
        edges: Edge data to include.

    Returns:
        The absolute path of the written file.
    """
    # Build stem -> canvas_node_id mapping
    stem_to_canvas_id: dict[str, str] = {}
    canvas_nodes: list[dict[str, Any]] = []

    for node in positioned_nodes:
        canvas_id = node.stem
        # If duplicate stems exist (unlikely), append a suffix
        counter = 1
        while canvas_id in stem_to_canvas_id.values():
            canvas_id = f"{node.stem}_{counter}"
            counter += 1
        stem_to_canvas_id[node.stem] = canvas_id
        canvas_nodes.append(_make_node_object(node, canvas_id))

    # Build edge objects, filtering out those with unresolvable endpoints
    canvas_edges: list[dict[str, Any]] = []
    for edge in edges:
        edge_obj = _make_edge_object(edge, stem_to_canvas_id)
        if edge_obj is not None:
            canvas_edges.append(edge_obj)

    # Handle edge id dedup if needed
    seen_edge_ids: set[str] = set()
    deduped_edges: list[dict[str, Any]] = []
    for e in canvas_edges:
        eid = e["id"]
        while eid in seen_edge_ids:
            eid = str(uuid.uuid4())
        e["id"] = eid
        seen_edge_ids.add(eid)
        deduped_edges.append(e)

    canvas_data: dict[str, Any] = {
        "nodes": canvas_nodes,
        "edges": deduped_edges,
    }

    output_file = Path(output_path)
    output_file.parent.mkdir(parents=True, exist_ok=True)
    with open(output_file, "w", encoding="utf-8") as f:
        json.dump(canvas_data, f, ensure_ascii=False, indent=2)

    return str(output_file.resolve())
