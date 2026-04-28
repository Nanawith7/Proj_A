"""Configuration file loading: type definitions and label mappings."""

from __future__ import annotations

from pathlib import Path
from typing import Optional

import yaml

from .models import DEFAULT_LABEL_MAPPING_PATH, DEFAULT_TYPE_DEF_PATH, TypeDefinition


def load_type_definitions(path: Optional[str]) -> dict[str, TypeDefinition]:
    """Load type definitions from a YAML file.

    Args:
        path: Path to the type definitions YAML file.
              If None, returns an empty dict (all types use defaults).

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
            )
        else:
            result[str(type_name)] = TypeDefinition()
    return result


def load_label_mappings(path: Optional[str]) -> dict[str, str]:
    """Load label mappings from a YAML file.

    Args:
        path: Path to the label mappings YAML file.
              If None, returns an empty dict (keys are used as-is).

    Returns:
        A mapping from property key to display label.
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

    return {str(k): str(v) for k, v in raw.items()}


def resolve_type_def_path(vault_root: str, user_path: Optional[str]) -> Optional[str]:
    """Resolve the type definition file path.

    Uses the user-provided path if given, otherwise falls back to the
    default path relative to the vault root.
    """
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
