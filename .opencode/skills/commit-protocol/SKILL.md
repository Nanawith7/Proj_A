---
name: commit-protocol
description: Each task completion commits with user order + implementation summary. 各指示の作業完了時にユーザー意図と実装内容を明記したコミットメッセージで git commit する。
license: MIT
compatibility: opencode
metadata:
  audience: developer
  workflow: git
---

## What I do

- ユーザー指示ごとの作業終了時に `git add -A && git commit` を実行する
- コミットメッセージは以下の形式に従う:

```
<type>: <要約>

user order:
  - <ユーザーが要求した内容>

implementation:
  - <実際に行った実装内容>
```

## When to use me

- ユーザーから明示的なコード変更指示を受けた後、その作業が完了した時
- テストやデバッグのみの指示ではコミットをスキップしてもよい
- 細かい変更が連続する場合は2〜3指示分をまとめてもよい

## Commit message rules

1. 1行目: 英語の命令形 (`feat:`, `fix:`, `refactor:`, `docs:`, `chore:`, `test:`)
2. 2行目: 空行
3. `user order:` セクション: ユーザーの意図を日本語で1〜3行の箇条書き
4. `implementation:` セクション: 実装内容を具体的に（ファイル名、ロジック変更、数値を含む）
5. 両セクションとも `  - ` の箇条書き形式
6. コミット前に必ず `git add -A` を実行する

## Example

```
feat: add bidirectional BFS traversal

user order:
  - 盗賊を起点に1ホップで地下迷宮出現が含まれない問題を修正
  - incoming方向のwiki-linkも追跡すべき

implementation:
  - extractor.py: build reverse index (target -> sources)
  - collect_related_nodes() now follows outgoing + incoming links
  - thief_network BFS: 6 -> 9 nodes, 15 -> 21 edges
```
