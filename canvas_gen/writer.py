"""JSON Canvas file output.

Each entity generates two canvas nodes:
  1. An icon node (type: "file") positioned above the file node
  2. A file node (type: "file") pointing to the original markdown note

The vertical icon space is uniform (max_icon_h across all nodes), but each
icon node renders at its own per-node icon size within that space.
"""

from __future__ import annotations

import json
import uuid
from pathlib import Path
from typing import Any

from .models import EdgeData, PositionedNode


def _make_icon_node(
    node: PositionedNode,
    icon_id: str,
    icon_path: str,
    icon_w: int,
    icon_h: int,
    max_icon_h: int,
    icon_gap: int,
) -> dict[str, Any]:
    """Create an icon node anchored above the file node.
    
    The Y offset uses max_icon_h (uniform row space), but width/height
    use the per-node icon dimensions.
    """
    return {
        "id": icon_id,
        "type": "file",
        "file": icon_path,
        "x": int(node.x),
        "y": int(node.y - max_icon_h - icon_gap),
        "width": icon_w,
        "height": icon_h,
    }


def _make_file_node(node: PositionedNode, node_id: str) -> dict[str, Any]:
    obj: dict[str, Any] = {
        "id": node_id,
        "type": "file",
        "file": str(node.file_path),
        "x": int(node.x),
        "y": int(node.y),
        "width": int(node.width),
        "height": int(node.height),
    }
    if node.color:
        obj["color"] = node.color
    return obj


def _make_edge_object(
    edge: EdgeData,
    node_id_map: dict[str, str],
) -> dict[str, Any] | None:
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
    if edge.color:
        edge_obj["color"] = edge.color
    return edge_obj


def write_canvas(
    output_path: str,
    positioned_nodes: list[PositionedNode],
    edges: list[EdgeData],
    icon_map: dict[str, str] | None = None,
    icon_size: int = 50,
    icon_gap: int = 4,
    max_icon_h: int | None = None,
) -> str:
    """Write a .canvas file with icon+file paired nodes.
    
    Args:
        max_icon_h: Uniform icon row height (max across all nodes).
                    Defaults to icon_size if not provided.
    """
    if icon_map is None:
        icon_map = {}
    if max_icon_h is None:
        max_icon_h = icon_size

    stem_to_canvas_id: dict[str, str] = {}
    canvas_nodes: list[dict[str, Any]] = []

    for node in positioned_nodes:
        canvas_id = node.stem
        counter = 1
        while canvas_id in stem_to_canvas_id.values():
            canvas_id = f"{node.stem}_{counter}"
            counter += 1
        stem_to_canvas_id[node.stem] = canvas_id

        icon_path = node.icon_path or icon_map.get(node.node_type, "")
        if icon_path:
            icon_id = f"{canvas_id}_icon"
            canvas_nodes.append(_make_icon_node(
                node, icon_id, icon_path,
                icon_w=node.icon_width,
                icon_h=node.icon_height,
                max_icon_h=max_icon_h,
                icon_gap=icon_gap,
            ))

        canvas_nodes.append(_make_file_node(node, canvas_id))

    canvas_edges: list[dict[str, Any]] = []
    for edge in edges:
        edge_obj = _make_edge_object(edge, stem_to_canvas_id)
        if edge_obj is not None:
            canvas_edges.append(edge_obj)

    seen_ids: set[str] = set()
    deduped: list[dict[str, Any]] = []
    for e in canvas_edges:
        eid = e["id"]
        while eid in seen_ids:
            eid = str(uuid.uuid4())
        e["id"] = eid
        seen_ids.add(eid)
        deduped.append(e)

    canvas_data: dict[str, Any] = {
        "nodes": canvas_nodes,
        "edges": deduped,
    }

    output_file = Path(output_path)
    output_file.parent.mkdir(parents=True, exist_ok=True)
    with open(output_file, "w", encoding="utf-8") as f:
        json.dump(canvas_data, f, ensure_ascii=False, indent=2)

    return str(output_file.resolve())
