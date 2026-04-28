"""Batch update: create tag notes, update characters with icon_size + wiki-link tags."""
import os

VAULT = "Obsidian_test/vault"

# --- Create tag notes ---
os.makedirs(f"{VAULT}/tag", exist_ok=True)

TAG_ICONS = {
    "human":    "human", "demon": "demon", "knight": "knight", "mage": "mage",
    "rogue":    "rogue", "mystic": "mystic", "ancient": "ancient",
    "ruler":    "ruler", "royalty": "royalty", "civilian": "civilian",
    "leader":   "leader", "general": "general", "main": "main",
    "villain":  "villain", "wise": "wise",
}

for tag in TAG_ICONS:
    content = f"""---
type: tag
title: {tag}
---
# {tag}
"""
    with open(f"{VAULT}/tag/{tag}.md", "w", encoding="utf-8") as f:
        f.write(content)

print(f"Created {len(TAG_ICONS)} tag notes.")

# --- Character icon_size + tag-link updates ---
CHAR_DATA = {
    "主人公":   {"icon_size": "80x60", "tags": "  - \"[[main]]\"\n  - \"[[human]]\"\n  - \"[[knight]]\""},
    "賢者":     {"icon_size": "60x60", "tags": "  - \"[[wise]]\"\n  - \"[[human]]\"\n  - \"[[mage]]\""},
    "魔王":     {"icon_size": "80x70", "tags": "  - \"[[villain]]\"\n  - \"[[demon]]\"\n  - \"[[ruler]]\""},
    "騎士団長": {"icon_size": "60x50", "tags": "  - \"[[human]]\"\n  - \"[[knight]]\"\n  - \"[[leader]]\""},
    "幼なじみ": {"icon_size": "40x40", "tags": "  - \"[[human]]\"\n  - \"[[civilian]]\""},
    "四天王A":  {"icon_size": "50x50", "tags": "  - \"[[demon]]\"\n  - \"[[general]]\""},
    "四天王B":  {"icon_size": "50x50", "tags": "  - \"[[demon]]\"\n  - \"[[general]]\""},
    "王女":     {"icon_size": "55x55", "tags": "  - \"[[human]]\"\n  - \"[[royalty]]\""},
    "盗賊":     {"icon_size": "45x50", "tags": "  - \"[[human]]\"\n  - \"[[rogue]]\""},
    "予言者":   {"icon_size": "50x50", "tags": "  - \"[[human]]\"\n  - \"[[mystic]]\""},
    "元魔王":   {"icon_size": "65x65", "tags": "  - \"[[demon]]\"\n  - \"[[ancient]]\""},
}

import re
for name, data in CHAR_DATA.items():
    path = f"{VAULT}/character/{name}.md"
    with open(path, "r", encoding="utf-8") as f:
        content = f.read()

    # Replace old tags block (lines starting with "  - " between "tags:" and the next key)
    # Find the tags: ... block
    content = re.sub(
        r"(tags:\n)((?:\s+-\s+.+\n)*)",
        r"\1" + data["tags"] + "\n",
        content
    )

    # Add icon_size after icon line (if exists) or after type line
    if "icon_size:" not in content:
        if "icon:" in content:
            content = content.replace(
                "icon:",
                f"icon_size: {data['icon_size']}\nicon:",
                1
            )
        else:
            content = content.replace(
                "type: character",
                f"type: character\nicon_size: {data['icon_size']}",
                1
            )

    with open(path, "w", encoding="utf-8") as f:
        f.write(content)
    print(f"Updated: {name} (icon={data['icon_size']})")
