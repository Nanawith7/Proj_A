"""Data models for the canvas generator."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Optional


@dataclass
class NoteNode:
    """Represents a parsed markdown note with its frontmatter metadata."""

    stem: str
    file_path: str
    title: str
    node_type: str
    properties: dict[str, Any] = field(default_factory=dict)
    wikilinks: dict[str, list[str]] = field(default_factory=dict)

    @property
    def node_id(self) -> str:
        return self.stem


@dataclass
class EdgeData:
    """Represents a directional edge between two nodes with a label."""

    from_node: str
    to_node: str
    label: str

    @property
    def edge_key(self) -> tuple[str, str, str]:
        return (self.from_node, self.to_node, self.label)


@dataclass
class TypeDefinition:
    """Layout rules for a single type."""

    lining: int = 1
    centering: bool = False


@dataclass
class Container:
    """An X-axis container grouping nodes by a common x_axis_key value."""

    key_value: str
    sort_order: int
    start_x: float = 0.0
    width_columns: int = 0
    nodes_by_type: dict[str, list[NoteNode]] = field(default_factory=dict)

    def effective_width(self, type_name: str, lining: int) -> int:
        """Return the effective column width for a type within this container.

        lining=1: all nodes in one row → width = node_count.
        lining>=2: nodes split across subrows → width = min(lining, node_count).
        """
        nodes = self.nodes_by_type.get(type_name, [])
        if not nodes:
            return 0
        if lining <= 1:
            return len(nodes)
        return min(lining, len(nodes))


@dataclass
class PositionedNode:
    """A NoteNode with computed canvas coordinates."""

    stem: str
    file_path: str
    title: str
    node_type: str
    properties: dict[str, Any]
    x: float
    y: float
    width: float
    height: float

    @property
    def node_id(self) -> str:
        return self.stem


class GenerationParams:
    """Collects all generation parameters into a single object."""

    def __init__(
        self,
        vault_path: str,
        output_path: str,
        base_node: Optional[str] = None,
        depth: Optional[int] = None,
        filter_conditions: Optional[dict[str, Any]] = None,
        exclude_conditions: Optional[dict[str, Any]] = None,
        sort_by: Any = None,
        x_axis_key: Optional[str] = None,
        type_def_path: Optional[str] = None,
        label_mapping_path: Optional[str] = None,
        column_width: int = 350,
        row_height: int = 250,
        node_width: int = 300,
        node_height: int = 200,
    ):
        self.vault_path = vault_path
        self.output_path = output_path
        self.base_node = base_node
        self.depth = depth
        self.filter_conditions = filter_conditions or {}
        self.exclude_conditions = exclude_conditions or {}
        self.sort_by = sort_by
        self.x_axis_key = x_axis_key
        self.type_def_path = type_def_path
        self.label_mapping_path = label_mapping_path
        self.column_width = column_width
        self.row_height = row_height
        self.node_width = node_width
        self.node_height = node_height


# Default paths relative to the vault root
DEFAULT_TYPE_DEF_PATH = "_types/type_definitions.yml"
DEFAULT_LABEL_MAPPING_PATH = "_config/label_mappings.yml"

# Properties reserved for layout/display, excluded from edge generation
RESERVED_KEYS: set[str] = {"type", "title"}
