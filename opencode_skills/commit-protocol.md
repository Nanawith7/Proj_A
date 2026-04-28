# Skill: Incremental Commit Protocol

## Description
各ユーザー指示の作業完了時に、以下の2セクションを含むコミットメッセージでコミットする。

## Commit Message Format

```
<imperative verb>: <short summary>

user order:
  - <ユーザーが要求した内容を箇条書きで簡潔に>

implementation:
  - <実際に行った実装内容を箇条書きで具体的に>
  - <変更ファイル名やkey decisionを含める>
```

## Rules

1. コミットメッセージの1行目は英語の命令形（feat:, fix:, refactor:, docs:, chore:, test:）
2. 2行目は空行
3. "user order:" セクションにユーザーの意図を日本語で1〜3行
4. "implementation:" セクションに実装内容を具体的に（ファイル名、ロジック変更、数値）
5. 両セクションとも箇条書き（`  - `）
6. 作業完了後、必ず `git add -A` → `git commit -m "..."` を実行する

## Example

```
feat: add bidirectional BFS traversal

user order:
  - 盗賊を起点に1ホップで地下迷宮出現が含まれない問題を修正
  - 双方向の wiki-link 追跡が必要

implementation:
  - extractor.py: build reverse index (target -> sources)
  - collect_related_nodes() now follows both outgoing and incoming links
  - thief_network BFS: 6 -> 9 nodes after fix
```

## Notes

- コミットが細かくなりすぎる場合は、2〜3指示分をまとめてもよい
- テストやデバッグのみの指示ではコミットをスキップしてもよい
- pycache や .obsidian/workspace.json は自動的に含まれるが気にしない
