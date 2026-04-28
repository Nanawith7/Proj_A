# Canvas Generator

Bottom-up Obsidian Canvas generation from vault metadata.

## Quick Start

```bash
# Full timeline by year
python -m canvas_gen.main --vault ./my_vault --output timeline.canvas --x-axis-key year --sort-by year

# Characters only
python -m canvas_gen.main --vault ./my_vault --output chars.canvas --filter type=character --sort-by title

# BFS from a node + exclude + prune orphans
python -m canvas_gen.main --vault ./my_vault --output out.canvas \
    --base-node 魔王 --depth 2 --x-axis-key year \
    --exclude tags=human --prune-orphans type=tag
```

## Modules

| File | Purpose |
|---|---|
| `main.py` | CLI entry point |
| `pipeline.py` | 7-step orchestration |
| `models.py` | Data classes |
| `config.py` | YAML config loading |
| `extractor.py` | Vault scan + BFS |
| `filter_sort.py` | Filter/exclude/sort |
| `edges.py` | Edge generation + prune |
| `layout.py` | Layout computation |
| `writer.py` | JSON Canvas output |
| `icons.py` | Icon PNG generation |
| `viewer/` | HTML viewer server |

## Config Files

Place in vault root:
- `_types/type_definitions.yml` — type layouts (lining, color, node dimensions)
- `_config/label_mappings.yml` — edge label + color mappings
- `nodeview/*.json` — visual templates for viewer
