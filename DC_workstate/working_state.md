# Deep Coding Working State

**Project**: brave-knight (Canvas Generator + NodeView Editor for Obsidian)
**Date**: 2026-05-09
**Current Phase**: 段階4 完了

---

## 現在の状態

### 完了したフェーズ
- **フェーズ0**: コーディングプラン立案（Coding_Plan.md 作成済み）
- **フェーズ1**: `render()` ミューテート停止 + expandedId保持
- **フェーズ2**: `applyNodeView()`修復 + Path Aアイコン追加
- **フェーズ3**: `toggleExpand()`比率計算修正 + expandMinW/H追加
- **フェーズ4**: P2軽微修正（COLLAPSED_HEIGHT調整・padX*2修正・透過率追加）

### 修正済み問題（段階1-4）
| 原因ID | 原因 | 修正内容 | 状態 |
|--------|------|----------|------|
| P0-C1 | `render()` 内 `n.width/n.height` ミューテート | Line 144, 211 の代入削除 | ✅ 完了（段階1） |
| P0-C2 | `render()` 最後 `expandedId=null` リセット | Line 351 の `expandedId=null;` 削除 | ✅ 完了（段階1） |
| P0-C3 | `applyNodeView()` で `expanded=false` 時 `COLLAPSED_HEIGHT` 未使用 | Line 389-391 で `expanded=false` 時に `COLLAPSED_HEIGHT` 使用 | ✅ 完了（段階1） |
| P0-C4 | Path A にアイコン描画コードが欠落 | Line 184-205 にアイコン描画コードを追加 | ✅ 完了（段階2） |
| P0-C5 | `toggleExpand()` 比率計算が COLLAPSED_HEIGHT(35) を使う | Line 486-487 で `td.node_width/td.node_height` を使用 | ✅ 完了（段階3） |
| P0-C6 | 5つのノード型で `expandMinW/expandMinH` が未定義 | 5ファイルに `expandMinW/expandMinH` を追加 | ✅ 完了（段階3） |
| P2-1 | `COLLAPSED_HEIGHT = 35` → `40` に調整 | Line 6 で定数値を 40 に変更 | ✅ 完了（段階4） |
| P2-2 | `resolvePositions()` の `padX * 2` 二重加算 | Line 871 で二重加算を修正 | ✅ 完了（段階4） |
| P2-3 | `drawElement()` テキスト条件の緩い比較 | Line 960 で `===` → `==` に変更 | ✅ 完了（段階4） |
| P2-4 | 各 Nodeview に `collapsedFillOpacity/expandedFillOpacity` を追加 | 5ファイルに透過率プロパティを追加 | ✅ 完了（段階4） |

### 未着手の問題
| 原因ID | 原因 | 修正予定段階 | 状態 |
|--------|------|-------------|------|
| P1 | Python側テキスト幅推定精度向上（fontTools統合） | 段階5 | ⏳ 未着手 |
| - | 統合テスト・スクリーンショット検証 | 段階6 | ⏳ 未着手 |

---

## 確定された詳細な要点

### 1. `render()` ミューテート停止（段階1）
- **Line 144** (Path A): `n.width = childW; n.height = childH;` を削除
- **Line 211** (Path B): `n.width = childW; n.height = childH;` を削除

### 2. `expandedId` リセット停止（段階1）
- **Line 351**: `expandedId=null;` を削除

### 3. `applyNodeView()` 修正（段階1）
- **Line 389-391**: `expanded=false` 時に `COLLAPSED_HEIGHT` を使用

### 4. Path A アイコン描画追加（段階2）
- **Line 184-205**: タイトル描画後・children描画前にアイコン描画コードを追加

### 5. `toggleExpand()` 比率計算修正（段階3）
- **Line 486-487**: `node.width/height` の代わりに `td.node_width/td.node_height` を使用

### 6. 5つのノード型に expandMinW/expandMinH を追加（段階3）
- `character_card.json`: expandMinW=160, expandMinH=120
- `scenario_card.json`: expandMinW=280, expandMinH=160
- `event_card.json`: expandMinW=220, expandMinH=140
- `plain.json`: expandMinW=200, expandMinH=120
- `tag_bubble.json`: expandMinW=100, expandMinH=80

### 7. COLLAPSED_HEIGHT 調整（段階4）
- **Line 6**: `COLLAPSED_HEIGHT = 35` → `40` に変更

### 8. resolvePositions() padX*2 修正（段階4）
- **Line 871**: `el._cw = Math.max(maxRight, el._cw - padX * 2) + padX * 2;`

### 9. drawElement() テキスト条件修正（段階4）
- **Line 960**: `parentEl.w === null` → `parentEl.w == null`

### 10. 透過率追加（段階4）
- 5つのnodeviewファイルに `collapsedFillOpacity: 0.8`, `expandedFillOpacity: 1.0` を追加

---

## テスト結果サマリー

| テストケース | 期待値 | 実測値 | 結果 |
|-------------|--------|--------|------|
| COLLAPSED_HEIGHT | 40 | 40 | ✅ |
| 縮小時 主人公 height | 40 | 40 | ✅ |
| 縮小時 主人公 opacity | 0.8 | 0.8 | ✅ |
| 展開後 主人公 height | 447 | 447 | ✅ |
| 展開後 主人公 opacity | 1.0 | 1 | ✅ |
| 3回サイクル後 主人公 height | 40/447 | 40/447 | ✅ |
| character型アイコン表示 | 10ノード | 10ノード | ✅ |
| era型アイコン表示 | 3ノード | 3ノード | ✅ |

---

## 次回フェーズ（段階5）の目的
Python側テキスト幅推定精度向上（fontTools統合）を実装する。
