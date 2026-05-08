# コードベース探索段階計画

## 目的
canvas viewerのレンダリング異常（縦に極端に長いノード、展開→縮小で異常に小さい、テキスト未描画、アイコン位置ズレ、横幅が極端に広い）の原因を特定するための探索計画。

## 問題リスト（スクリーンショットから特定）

1. **ノードが縦に極端に長い** — 青ノードが画面外まで延びている
2. **クリックで展開→縮小後、異常に小さい** — 縮小時にサイズが保持されない
3. **テキストが描画されていない** — ノード内に文字が表示されない
4. **アイコンの位置がズレている** — アイコンが期待位置に描画されていない
5. **横幅が妙に広い** — ノードが意図せず横に拡がっている

---

## 探索段階リスト

### 探索段階-段階1: 問題領域のマッピング（データフロー追跡）
**目的**: 各問題がコードベースのどのパスで発生するかを特定する
**対象ファイル**:
- `canvas_gen/viewer/viewer.js` — メインレンダリングパス（Path A: 事前計算済みchildren, Path B: ダイナミックchildren, Path B-2: フォールバック）
- `canvas_gen/children.py` — Python側childrenレイアウト計算
- `canvas_gen/pipeline.py` — パイプライン順序（段階7b: children計算）
- `canvas_gen/models.py` — PositionedNodeデータ構造（childrenフィールドの有無）
- `canvas_gen/viewer/server.py` — データ供給API（`/api/data`, `/api/filter`）

**確認事項**:
- `n.children` が事前計算済みデータを持っているか、Dynamic計算にフォールバックしているかの分岐
- `n.width` / `n.height` がレンダリングサイクル間でミューテートされ、蓄積していないか
- `toggleExpand()` で計算された `expW` / `expH` が次回レンダリングに引き継がれていないか

**期待される出力**: 各問題の原因となりうるコードパスの特定

---

### 探索段階-段階2: 縦に極端に長いノードの原因調査
**目的**: ノード高が暴走する根本原因を特定する
**対象コード**:
- `viewer.js:434-473` — `toggleExpand()` の内容高さ測定ループ（`lineH` 蓄積）
- `viewer.js:136-144` — Path A の `childH = n.height` 代入（ミューテートされた値を再利用）
- `viewer.js:103` — SVG viewBox計算（`maxY` 蓄積）
- `children.py:382` — Python側の `_ch` 計算（`max_bottom + pad_y * 2`）
- `layout.js:259-261` — ブラウザ側の `_ch` 計算（`maxBottom + padY * 2`）

**確認事項**:
- `lineH` が `mode='wrap'` で二重に計算されていないか
- `n.height` が `toggleExpand()` で設定され、次回 `render()` でそのまま使われていないか
- Python `compute_children()` とブラウザ `computeChildrenLayout()` で計算結果が一致していないケース

---

### 探索段階-段階3: 縮小時に異常に小さくなる原因調査
**目的**: 展開→縮小でサイズが壊れる原因を特定する
**対象コード**:
- `viewer.js:419-443` — `toggleExpand()` / `collapseAll()`
- `viewer.js:619-643` — `collapseAll()` での `applyNodeView()` 呼び出し
- `viewer.js:391-408` — `applyNodeView()` のサイズ復元ロジック
- `viewer.js:144` — `n.width = childW; n.height = childH` （縮小時にCOLLAPSED_HEIGHTを代入）

**確認事項**:
- `applyNodeView()` が元の型定義サイズ（`node_height`）を復元しているか
- `n.height = COLLAPSED_HEIGHT` 代入後、次回展開時に元のサイズが失われていないか
- `expandedId = null` のタイミングでサイズがリセットされているか

---

### 探索段階-段階4: テキスト未描画の原因調査
**目的**: テキストが描画されない条件を特定する
**対象コード**:
- `viewer.js:940` — `drawElement()` 内のテキスト描画条件 `if (parentEl.text && (parentEl.w === null || !parentEl.children))`
- `viewer.js:648-731` — `nodeViewToChildren()` での children 構築（`w: null, h: null` の設定）
- `viewer.js:770-786` — `measureElement()` 内のテキスト幅計算
- `viewer.js:11-14` — `_measureText()` / `measureText()`（Canvas 2Dコンテキストの再利用）
- `children.py:62-73` — Python側 `_estimate_text_w_v2()`（ブラウザとの差異）

**確認事項**:
- `parentEl.w === null` 条件が、事前計算済みchildrenで常にfalseにならないか
- `_wrapText()` が日本語テキストで正しく動作するか（1文字ずつ幅を測定）
- Python `_estimate_text_w_v2()` とブラウザ `measureText()` の差が大きいテキストでサイズが崩れていないか

---

### 探索段階-段階5: アイコン位置ズレの原因調査
**目的**: アイコンの座標計算がずれる原因を特定する
**対象コード**:
- `viewer.js:253-274` — Path B アイコン描画（`children._ax` / `children._ay` ベース）
- `viewer.js:326-345` — フォールバックパス アイコン描画（`nx` / `ny` ベース）
- `viewer.js:484-507` — 展開時アイコン描画（`expW` / `expH` ベース）
- `viewer.js:186-191` — Path A children描画（`nx + child.ax` / `ny + child.ay`）

**確認事項**:
- Path Bで `children._ax` が `0` にリセットされるタイミング（viewer.js:277）
- `drawElement()` の `ox, oy` パラメータが `nx, ny` と整合しているか
- 展開時アイコン位置が `expW, expH` に対して相対計算されているが、親ノード位置 `nx, ny` が加算されているか

---

### 探索段階-段階6: 横幅が極端に広い原因調査
**目的**: ノード幅が意図せず拡がる原因を特定する
**対象コード**:
- `viewer.js:845-852` — `resolvePositions()` 内の `maxRight` 計算と `_cw` 更新
- `viewer.js:789` — `measureElement()` 内の `w` 計算（`maxChildW + padX * 2`）
- `children.py:376-377` — Python側 `_cw` 計算
- `viewer.js:102-107` — SVG `viewBox` / `minWidth` 計算

**確認事項**:
- `right-N` / `bottom-N` 配置の子要素が `maxRight` / `maxBottom` に含まれていないか
- `padX * 2` が複数回加算されていないか
- SVG `viewBox` の `maxX` が全てのノードの `x + width` から計算される際、拡張されたwidthが使用されていないか

---

### 探索段階-段階7: 生データ（canvas JSON）の構造分析
**目的**: 実際のcanvas JSONデータで問題現象を再現する
**対象データ**:
- 既存の `.canvas` ファイル（如果有）
- `Obsidian_test/vault/` 内のノートと `nodeview/*.json` の組み合わせ
- Pythonパイプラインで生成される中間データ

**確認事項**:
- `n.children` に事前計算済みデータが含まれている場合の `ax/ay/cw/ch` 値
- 日本語テキストを含むプロパティの `_cw` / `_ch` 値（Python推定 vs ブラウザ測定）
- 実際のノードサイズ（`width` / `height`）が型定義と一致しているか

---

## 探索順序と依存関係

```
段階1 (問題領域マッピング)
  ├──→ 段階2 (縦長ノード)
  ├──→ 段階3 (縮小サイズ壊れ)
  ├──→ 段階4 (テキスト未描画)
  ├──→ 段階5 (アイコンズレ)
  ├──→ 段階6 (横幅広すぎる)
  └──→ 段階7 (生データ分析)
```

段階1を最優先で実行し、各問題がどのレンダリングパス（Path A / Path B / Path B-2）に関係するかを特定する。
その後、関連する段階を並列または順次で探索する。

---

## 検証方法

各探索段階で以下の手段を用いて検証する:
1. **ブラウザDevTools Console** — `window.NODEVIEWS`, `window.TYPEDEFS`, `window.VAULT` を確認
2. **Pythonスクリプト** — `canvas_gen.children` モジュールの関数を独立してテスト
3. **テストページ** — `test_children/children_layout.html` でレイアウトエンジンを検証
4. **実際のビューア** — `python -m canvas_gen.main --serve-viewer` でローカルサーバー起動

---

## 予期される発見

- **段階2**: `toggleExpand()` でミューテートされた `n.height` が `render()` で再利用され、累積暴走している
- **段階3**: `applyNodeView()` が元の型定義サイズを参照せず、ミューテート済みの `node.height` を使っている
- **段階4**: `drawElement()` の条件分岐が、事前計算済みchildrenパスでテキスト描画をスキップしている
- **段階5**: Path B と Path A でアイコン座標計算の基準点が異なっている
- **段階6**: `resolvePositions()` の `maxRight` 計算に `right-N` 配置の子が誤って含まれている
- **段階7**: Python `_estimate_text_w_v2()` とブラウザ `measureText()` の差が、日本語テキストで特に大きい
