"""Markdown note extraction from an Obsidian vault.

Scans the vault directory for .md files, parses YAML frontmatter,
extracts wiki links, and builds an indexed lookup structure.
"""

from __future__ import annotations

import re
from pathlib import Path
from typing import Any, Optional

import yaml

from .models import NoteNode

WIKILINK_PATTERN = re.compile(r"\[\[([^\]]+)\]\]")
FRONTMATTER_PATTERN = re.compile(r"^---\s*[\r\n]+(.*?)[\r\n]+---", re.DOTALL)


def parse_frontmatter(content: str) -> tuple[dict[str, Any], str]:
    """Parse YAML frontmatter from markdown content.

    Args:
        content: Raw markdown file content.

    Returns:
        A tuple of (properties_dict, body_text).
    """
    match = FRONTMATTER_PATTERN.match(content)
    if not match:
        return {}, content

    try:
        properties = yaml.safe_load(match.group(1)) or {}
    except yaml.YAMLError:
        properties = {}

    body = content[match.end():]
    return properties, body


def extract_wikilinks_from_value(value: Any) -> list[str]:
    """Extract wiki link targets from a YAML value.

    Handles strings, lists, and nested structures.

    Args:
        value: Any YAML-parsed value.

    Returns:
        A list of wiki link targets (the text inside [[...]]).
    """
    results: list[str] = []

    if isinstance(value, str):
        results.extend(WIKILINK_PATTERN.findall(value))
    elif isinstance(value, list):
        for item in value:
            results.extend(extract_wikilinks_from_value(item))
    elif isinstance(value, dict):
        for v in value.values():
            results.extend(extract_wikilinks_from_value(v))

    return results


def _node_stem(file_path: Path) -> str:
    """Return the stem (filename without extension) for a note."""
    return file_path.stem


def _build_wikilinks_map(properties: dict[str, Any], reserved_keys: set[str]) -> dict[str, list[str]]:
    """Extract wiki links from all non-reserved properties.

    Returns a mapping from property key to the list of wiki link targets.
    """
    result: dict[str, list[str]] = {}
    for key, value in properties.items():
        if key in reserved_keys:
            continue
        links = extract_wikilinks_from_value(value)
        if links:
            result[key] = links
    return result


def scan_vault(vault_path: str, reserved_keys: Optional[set[str]] = None) -> dict[str, NoteNode]:
    """Scan an Obsidian vault directory and build an index of all notes.

    Args:
        vault_path: Root directory of the Obsidian vault.
        reserved_keys: Keys excluded from edge extraction (default: {"type", "title"}).

    Returns:
        A dictionary mapping note stem to NoteNode.
    """
    if reserved_keys is None:
        reserved_keys = {"type", "title"}

    vault = Path(vault_path)
    if not vault.is_dir():
        raise FileNotFoundError(f"Vault directory not found: {vault_path}")

    index: dict[str, NoteNode] = {}

    for md_file in vault.rglob("*.md"):
        try:
            content = md_file.read_text(encoding="utf-8")
        except (OSError, UnicodeDecodeError):
            continue

        properties, _body = parse_frontmatter(content)
        stem = _node_stem(md_file)
        title = properties.get("title", stem)
        node_type = properties.get("type", "default")
        wikilinks = _build_wikilinks_map(properties, reserved_keys)

        index[stem] = NoteNode(
            stem=stem,
            file_path=str(md_file.relative_to(vault)).replace("\\", "/"),
            title=title,
            node_type=node_type,
            properties=properties,
            wikilinks=wikilinks,
        )

    return index


def _resolve_wikilink_target(link: str, index: dict[str, NoteNode]) -> Optional[str]:
    """Resolve a wiki link target to a stem in the index.

    Handles:
        [[Note Name]]        -> match by stem
        [[folder/Note Name]] -> match by stem (last component)
        [[Note Name|Alias]]  -> match the target part

    Args:
        link: The wiki link text inside [[...]].
        index: The vault index.

    Returns:
        The matching stem if found, else None.
    """
    # Remove display alias
    target = link.split("|")[0].strip()
    # Try exact stem match first
    target_stem = Path(target).stem
    if target_stem in index:
        return target_stem
    # Try matching by the full path stem
    for stem in index:
        if stem == target_stem:
            return stem
    return None


def collect_related_nodes(
    base_node_stem: str,
    index: dict[str, NoteNode],
    depth: int,
) -> set[str]:
    """BFS traversal from a base node to collect related node stems.

    Follows wiki links up to the specified depth.

    Args:
        base_node_stem: The starting node's stem.
        index: The vault index.
        depth: Maximum traversal depth (0 = base node only).

    Returns:
        A set of node stems reachable from the base node.
    """
    if base_node_stem not in index:
        raise ValueError(f"Base node not found in vault: {base_node_stem}")

    visited: set[str] = {base_node_stem}
    frontier: list[tuple[str, int]] = [(base_node_stem, 0)]

    while frontier:
        current_stem, current_depth = frontier.pop(0)
        if current_depth >= depth:
            continue

        node = index[current_stem]
        for links in node.wikilinks.values():
            for link in links:
                target_stem = _resolve_wikilink_target(link, index)
                if target_stem and target_stem not in visited:
                    visited.add(target_stem)
                    frontier.append((target_stem, current_depth + 1))

    return visited
