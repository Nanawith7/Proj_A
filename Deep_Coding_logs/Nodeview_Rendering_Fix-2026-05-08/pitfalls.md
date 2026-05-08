# Pitfalls — NodeView Rendering Fix

---

## 既に解決済みの問題

### [PR-1] Path B-1 の appendChild 漏れ
- **問題**: `render()` の Path B-1 に `mainG.appendChild(g)` が欠落
- **修正方法**: Phase 1で285行目に1行追加（最小修正）
- **状態**: Phase 1で修正済み（→ Phase 2でラッパー化済み）
- **備考**: この修正のみが本プロジェクトの主なバグ修正

### [PR-2] `mainM is not defined`（既存Pitfalls P5）
- **問題**: `mainG.appendChild(g)` が typo で `mainM.appendChild(g)` になっていた
- **修正方法**: Phase 2以前に `mainM` → `mainG` 修正済み
- **状態**: 修正済み

### [PR-3] テスト不足
- **問題**: 実装完了後にブラウザでの視覚テストを十分に行っていない（`canvas-children-collapsible` P-10）
- **修正方法**: Phase 3.5でブラウザテスト実行（58+ノード描画確認、0エラー）
- **状態**: Phase 3.5で対応済み

---

## 残存する未解決問題（既存コードに依存）

### UR-1: `window._svgCanvas_get is not a function`
- **出典**: `test_children/tests.js`
- **原因**: テストコードで参照されているが、viewer.jsには実装されていない
- **影響**: なし（既存描画には影響なし）
- **対応**: 既存Pitfalls P1で既解決として扱っている

### UR-2: `TypeError: Assignment to constant variable`（既存Pitfalls P2）
- **場所**: viewer.js line 134-135
- **原因**: `const childW/childH` を再代入しようとした
- **修正**: `let` に変更が必要（Phase 2以前に修正されている可能性がある）
- **影響**: viewerサーバー起動時にエラーが出る可能性

### UR-3: `iconPath is not defined`（既存Pitfalls P4）
- **場所**: `!rendered` ブロック内
- **原因**: `iconPath` が `rendered` ブロック内で定義されていた
- **修正**: `!rendered` ブロックの最初に `const iconPath = v?.props?.icon;` を追加
- **状態**: viewerサーバー起動時にエラーが出る可能性

### UR-4: JSON Canvas の children 計算不一致
- **出典**: `canvas-children-integration` D2, `canvas-children-collapsible` P-11
- **原因**: Pythonの `_estimate_text_w()` が `font_size * 0.55` の近似値を使用 / ブラウザの `measureText()` と1-2pxの誤差
- **影響**: childrenの配置が2-3px程度ずれる可能性
- **対応**: viewer.js Phase 3で `reconcileChildWidth()` 的な関数導入を検討（未実装）

### UR-5: gapX（横間隔）の未実装
- **出典**: `canvas-children-integration` D4
- **原因**: 既存のchildrenレイアウトでは固定5px gapYのみ
- **影響**: 横並びのピル間隔が一定
- **対応**: `gapX` の実装を追加する必要がある（Phase 6以降）

### UR-6: % position の簡易変換
- **出典**: `canvas-children-integration` D3
- **原因**: `position.x: "10%"` → `xRel: "left-10"` に簡易変換
- **影響**: 実際の10%位置にならない
- **対応**: 厳密なパーセント計算を実装する必要がある（Phase 6以降）

### UR-7: 外側children（negative offset）のテストカバレッジ不足
- **出典**: `canvas-children-integration` E5
- **原因**: 一部の外側children（`xRel: "right--10"`）のみテスト済み
- **影響**: 全パターン（top/bottom/left/rightのnegative offset）が未検証
- **対応**: 全パターンをテストする必要がある（Phase 6以降）

### UR-8: 文字別テーブルのメンテナンス
- **出典**: `canvas-children-collapsible` P-9
- **原因**: `_CHAR_WIDTH_RATIOS` テーブルに60文字以上の定義があり、メンテナンスが必要
- **影響**: 将来フォントを変更する場合、テーブル全体を更新する必要がある
- **対応**: Pillowによる自動計測へ移行を検討

### UR-9: テキスト幅推定の精度向上
- **出典**: `canvas-children-integration` E1
- **原因**: `_estimate_text_w()` = `font_size * 0.55` / char の近似値を使用
- **影響**: 横並びのピル位置が数pxずれる場合がある
- **対応**: ブラウザの `measureText()` に近いヒューリスティックを開発する

### UR-10: `COLLAPSED_HEIGHT` のフォントサイズ依存性
- **出典**: `canvas-children-collapsible` P-5
- **問題**: `COLLAPSED_HEIGHT = 35px` はフォントサイズ9-14pxを想定
- **影響**: フォントサイズが14px超の場合、タイトル表示に問題が発生する
- **対応**: `COLLAPSED_HEIGHT` を `font_size` から動的に計算する

---

## デバッグ関連

### DB-1: childrenがCanvasに埋め込まれない
- **確認点**:
  - `--node-views` フラグを付けているか
  - `_types/type_definitions.yml` に `nodeview:` キーがあるか
  - `nodeview/*.json` に `properties` キーがあるか

### DB-2: テキスト幅がブラウザ実測と異なる
- **原因**: Pythonの `_estimate_text_w()` が `font_size * 0.55` の近似値を使用
- **対応**: 厳密な実測にはブラウザの `measureText()` を使用する

### DB-3: viewer.js の冗長な分岐
- **出典**: `canvas-children-collapsible` P-8
- **問題**: 段階1と段階2のガード条件（`expandedId === n.id`）がPath AとPath Bで重複
- **対策**: 将来的には描画パスを統合するか、ガード条件を1箇所に集約
