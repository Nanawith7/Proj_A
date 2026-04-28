"""Edge generation from wiki links extracted from note properties.

Edges are created exclusively between nodes that are present in the
canvas node set. If a linked target is not among the canvas nodes,
no edge is generated for that link — the canvas remains self-contained.

Edges are created per unique (source, target, key_name) tuple.
Duplicate links from the same key to the same target are collapsed.
Links from different keys to the same target produce separate edges.
Labels are transformed via an external label mapping file.
"""

from __future__ import annotations

from pathlib import Path

from .models import EdgeData, NoteNode, RESERVED_KEYS


def generate_edges(
    canvas_nodes: list[NoteNode],
    vault_index: dict[str, NoteNode],
    label_map: dict[str, str],
    reserved_keys: set[str] | None = None,
) -> list[EdgeData]:
    """Generate edge objects from canvas nodes' wiki links.

    For each canvas node, iterates over its non-reserved properties,
    extracts wiki link targets, and creates an edge for each unique
    (source_stem, target_stem, property_key) combination.

    Target nodes must exist in the vault index AND be in the canvas
    node set to produce a valid edge.

    Args:
        canvas_nodes: The nodes currently in the canvas.
        vault_index: Full vault node index (stem -> NoteNode).
        label_map: Mapping from property key to display label.
        reserved_keys: Property keys excluded from edge generation.
                       Defaults to {"type", "title"}.

    Returns:
        A list of deduplicated EdgeData objects.
    """
    if reserved_keys is None:
        reserved_keys = RESERVED_KEYS

    canvas_stems = {n.stem for n in canvas_nodes}
    edge_index: dict[tuple[str, str, str], EdgeData] = {}

    for node in canvas_nodes:
        for key, links in node.wikilinks.items():
            if key in reserved_keys:
                continue
            for link in links:
                target_stem = _resolve_target(link, vault_index)
                if target_stem is None:
                    continue
                if target_stem not in canvas_stems:
                    continue

                label = label_map.get(key, key)
                edge_key = (node.stem, target_stem, label)
                if edge_key not in edge_index:
                    edge_index[edge_key] = EdgeData(
                        from_node=node.stem,
                        to_node=target_stem,
                        label=label,
                    )

    return list(edge_index.values())


def _resolve_target(link: str, index: dict[str, NoteNode]) -> str | None:
    """Resolve a wiki link target string to a vault stem."""
    target = link.split("|")[0].strip()
    target_stem = Path(target).stem
    if target_stem in index:
        return target_stem
    return None
