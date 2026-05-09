# Deep Coding Working State

**Project**: brave-knight (Canvas Generator + NodeView Editor for Obsidian)
**Date**: 2026-05-09
**Current Phase**: 段階1 完了

---

## 現在の状態

### 完了したフェーズ
- **フェーズ0**: コーディングプラン立案（Coding_Plan.md 作成済み）
- **フェーズ1**: `render()` ミューテート停止 + expandedId保持

### 修正済み問題（段階1）
| 原因ID | 原因 | 修正内容 | 状態 |
|--------|------|----------|------|
| P0-C1 | `render()` 内 `n.width/n.height` ミューテート | Line 144, 211 の代入削除 | ✅ 完了 |
| P0-C2 | `render()` 最後 `expandedId=null` リセット | Line 351 の `expandedId=null;` 削除 | ✅ 完了 |
| P0-C3 | `applyNodeView()` で `expanded=false` 時 `COLLAPSED_HEIGHT` 未使用 | Line 389-391 で `expanded=false` 時に `COLLAPSED_HEIGHT` 使用 | ✅ 完了 |

### 未着手の問題
| 原因ID | 原因 | 修正予定段階 | 状態 |
|--------|------|-------------|------|
| P0-C4 | Path A にアイコン描画コードが欠落 | 段階2 | ⏳ 未着手 |
| P0-C5 | `toggleExpand()` 比率計算が COLLAPSED_HEIGHT(35) を使う | 段階3 | ⏳ 未着手 |
| P0-C6 | 5つのノード型で `expandMinW/expandMinH` が未定義 | 段階3 | ⏳ 未着手 |

---

## 確定された詳細な要点

### 1. `render()` ミューテート停止
- **Line 144** (Path A): `n.width = childW; n.height = childH;` を削除
- **Line 211** (Path B): `n.width = childW; n.height = childH;` を削除
- 描画は `childW`/`childH` ローカル変数のみを使用
- RAG知見: Mike Bostockの「描画ロジックとデータの分離」パターンに従う

### 2. `expandedId` リセット停止
- **Line 351**: `expandedId=null;` を削除
- `toggleExpand()` 内で `collapsedId=null;` のみで状態リセット
- RAG知見: ExcalidrawのSceneパターン（描画パイプラインは要素を「読むだけ」で変更しない）

### 3. `applyNodeView()` 修正
- **Line 389-391**: `expanded=false` 時に `COLLAPSED_HEIGHT` を使用
- `td.node_width/td.node_height` をフォールバックチェーンの第一候補に
- `expanded && expanded.width` の条件で安全に展開サイズを設定

---

## テスト結果サマリー

| テストケース | 期待値 | 実測値 | 結果 |
|-------------|--------|--------|------|
| 初期描画 height | 35 | 35 | ✅ |
| 展開後 魔王 height | >120 | 477 | ✅ |
| 縮小後 魔王 height | 35 | 35 | ✅ |
| render() 呼び出し後も | 35 | 35 | ✅ |
| 3回サイクル後 魔王 height | 35 | 35 | ✅ |

---

## 次回フェーズ（段階2）の目的
`applyNodeView()` の修正（P0-C3）と Path A のアイコン描画追加（P0-C4）を実装する。
