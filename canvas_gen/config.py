"""Configuration file loading: type definitions and label mappings."""

from __future__ import annotations

from pathlib import Path
from typing import Optional

import yaml

from .models import (
    DEFAULT_LABEL_MAPPING_PATH,
    DEFAULT_TYPE_DEF_PATH,
    DEFAULT_NODE_HEIGHT,
    DEFAULT_NODE_WIDTH,
    LabelInfo,
    TypeDefinition,
)


def load_type_definitions(path: Optional[str]) -> dict[str, TypeDefinition]:
    """Load type definitions from a YAML file.

    Each type entry may contain:
      lining: int (default 1)   — number of subrows
      centering: bool (default false)
      color: str (default "")   — hex color or preset number for nodes

    Args:
        path: Path to the type definitions YAML file.

    Returns:
        A mapping from type name to its TypeDefinition.
    """
    if path is None:
        return {}

    file_path = Path(path)
    if not file_path.exists():
        print(f"[WARN] Type definition file not found: {path}. Using defaults.")
        return {}

    with open(file_path, "r", encoding="utf-8") as f:
        raw = yaml.safe_load(f)

    if raw is None:
        return {}

    result: dict[str, TypeDefinition] = {}
    for type_name, config in raw.items():
        if isinstance(config, dict):
            result[str(type_name)] = TypeDefinition(
                lining=int(config.get("lining", 1)),
                centering=bool(config.get("centering", False)),
                color=str(config.get("color", "")),
                node_width=int(config.get("node_width", DEFAULT_NODE_WIDTH)),
                node_height=int(config.get("node_height", DEFAULT_NODE_HEIGHT)),
            )
        else:
            result[str(type_name)] = TypeDefinition()
    return result


def load_label_mappings(path: Optional[str]) -> dict[str, LabelInfo]:
    """Load label mappings from a YAML file.

    Supports two formats per entry:
      1. Plain string:  ally: "味方"
         → LabelInfo("味方", "")

      2. Nested dict:   ally:
                           label: "味方"
                           color: "#4CAF50"
         → LabelInfo("味方", "#4CAF50")

    Args:
        path: Path to the label mappings YAML file.

    Returns:
        A mapping from property key to LabelInfo.
    """
    if path is None:
        return {}

    file_path = Path(path)
    if not file_path.exists():
        print(f"[WARN] Label mapping file not found: {path}. Using raw key names.")
        return {}

    with open(file_path, "r", encoding="utf-8") as f:
        raw = yaml.safe_load(f)

    if raw is None:
        return {}

    result: dict[str, LabelInfo] = {}
    for key, value in raw.items():
        key_str = str(key)
        if isinstance(value, dict):
            result[key_str] = LabelInfo(
                label=str(value.get("label", key_str)),
                color=str(value.get("color", "")),
            )
        else:
            result[key_str] = LabelInfo(label=str(value))
    return result


def resolve_type_def_path(vault_root: str, user_path: Optional[str]) -> Optional[str]:
    """Resolve the type definition file path."""
    if user_path:
        return user_path
    default = Path(vault_root) / DEFAULT_TYPE_DEF_PATH
    return str(default) if default.exists() else None


def resolve_label_mapping_path(vault_root: str, user_path: Optional[str]) -> Optional[str]:
    """Resolve the label mapping file path."""
    if user_path:
        return user_path
    default = Path(vault_root) / DEFAULT_LABEL_MAPPING_PATH
    return str(default) if default.exists() else None
