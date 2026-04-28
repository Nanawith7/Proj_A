# Test Cases - Canvas Generator

Run from `E:\LLLLMS\Proj_A`. Open `Obsidian_test/vault` as Obsidian vault.
Generate: `python -m canvas_gen.main --vault "Obsidian_test/vault" --output "Obsidian_test/vault/<name>.canvas" [options]`

---

## TC-01: Character-only Grid

**Method**: `--filter type=character --sort-by title --icon-size 50`

**Expected**:
- 11 characters, 3 subrows (lining=3, 4+4+3 column-major)
- 42 edges (ally/rival/likes/dislikes/mentor/family between characters)
- 11 per-node custom icons at varied sizes (40x40 ~ 80x70)
- Global centering grid active

---

## TC-02: Full Timeline by Year

**Method**: `--x-axis-key year --sort-by year --icon-size 50`

**Expected**:
- 57 nodes total, 152 edges
- 6 containers sorted numerically (years 80, 100, 110, 140, 150, 160...)
- 28 nodes in uncategorized area (no year: characters, orgs, tags)
- Mutual centering: containers + uncategorized share center axis
- Auto row_height=250, column_width=350

---

## TC-03: Era Timeline

**Method**: `--x-axis-key era --sort-by year --icon-size 50 --include-types "type=era"`

**Expected**:
- 3 era containers: era_080_120, era_120_150, era_150_180
- Era nodes appear inside their own containers (self-referencing `era:` property)
- Events/scenarios grouped by era, sorted by year within
- era nodes protected from orphan pruning

---

## TC-04: BFS - Devil 2-Hop + Exclude + Prune

**Method**: `--base-node "魔王" --depth 2 --x-axis-key year --sort-by year --exclude "tags=human" --icon-size 50 --prune-orphans "type=tag"`

**Expected**:
- BFS from 魔王 (bidirectional), depth=2 → ~32 nodes
- Exclude nodes with `[[human]]` tag → ~26 nodes
- Prune orphaned tags only → ~23 nodes
- Wiki-link normalization: `--exclude tags=human` matches `[[human]]` values

---

## TC-05: BFS - Thief 1-Hop + Era Containers

**Method**: `--base-node "盗贼" --depth 1 --x-axis-key era --sort-by year --icon-size 50 --include-types "type=era"`

**Expected**:
- Bidirectional BFS: 盗贼 links + nodes linking TO 盗贼 → 9 nodes
- Include 3 era nodes → 12 total
- Era containers with era nodes and connected events
- Characters/tags in uncategorized area (no era property)

---

## TC-06: BFS - Human Tag Network

**Method**: `--base-node "human" --depth 1 --icon-size 50`

**Expected**:
- human tag node + nodes it links to + nodes linking TO it → 8 nodes
- 30 edges between human-tagged characters
- Validates tag node as valid BFS starting point

---

## TC-07: Multi-Type Filter with OR

**Method**: `--filter "type=character|tag" --sort-by title --icon-size 50`

**Expected**:
- 11 characters + 15 tags = 26 nodes
- 68 edges (character↔character + character↔tag)
- Tag type: lining=2, 2 subrows (8+7)
- Pipe `|` OR syntax in key=value format

---

## TC-08: Exclude by Type

**Method**: `--x-axis-key year --sort-by year --exclude "type=tag" --icon-size 50`

**Expected**:
- 57 - 15 = 19 nodes (tags excluded)
- 78 edges (no tag-related edges remain)
- $or via `|`: `--exclude "type=tag"` works as expected

---

## TC-09: Stress Test - Giant Icons

**Method**: Set `icon_size: "2000x2000"` on 魔王, regenerate timeline

**Expected**:
- row_height auto-scales: 250 → 2164
- column_width auto-scales to max(icon_w, node_w)
- No horizontal or vertical overlaps

---

## TC-10: Include-Types Protected from Pruning

**Method**: `--base-node "盗贼" --depth 1 --x-axis-key era --sort-by year --include-types "type=era" --prune-orphans`

**Expected**:
- era nodes NEVER pruned even if zero-edged
- Other orphaned nodes pruned normally

---

## TC-11: Era Node Self-Reference

**Method**: Verify era nodes have `era: "era_080_120"` self-reference

**Expected**:
- Era nodes appear inside their own era containers
- Without self-reference, era nodes land in uncategorized area

---

## TC-12: YAML Wiki-Link Quoting

**Method**: Inspect new event/scenario YAML frontmatter

**Expected**:
- `[[value]]` is quoted: `- "[[value]]"` (not bare `- [[value]]`)
- Multiple wiki-links on separate lines, not merged as `"[[a]] [[b]]"`
