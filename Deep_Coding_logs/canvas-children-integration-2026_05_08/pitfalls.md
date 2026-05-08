# Pitfalls — Canvas Children Integration

## 既知の問題点（既解決）

### P1: `window._svgCanvas_get is not a function`
- **出典**: `test_children/tests.js`
- **原因**: テストコードで参照されているが、viewer.jsには実装されていない
- **影響**: なし（既存描画には影響なし）
- **修正**: 無視してOK

### P2: `TypeError: Assignment to constant variable`
- **場所**: viewer.js line 134→135
- **原因**: `const childW/childH` を再代入しようとした
- **修正**: `let` に変更
- **状態**: 修正済み

### P3: `_measureText is not defined`
- **場所**: `measureElement()` 内部
- **原因**: `_wrapText()` 内で `measureText` を参照したが未定義
- **修正**: `const _measureText = measureText;` をファイル先頭追加
- **状態**: 修正済み

### P4: `iconPath is not defined`
- **場所**: `!rendered` ブロック内（既存描画パス）
- **原因**: `iconPath` が `rendered` ブロック内で定義されていた
- **修正**: `!rendered` ブロックの最初に `const iconPath = v?.props?.icon;` を追加
- **状態**: 修正済み

### P5: `mainM is not defined`
- **場所**: `mainG.appendChild(g)` のタイポ
- **修正**: `mainM` → `mainG` に修正
- **状態**: 修正済み

### P6: `children.cx/cy is not defined`
- **場所**: `drawElement(child, g, nx + child.cx, ny + child.cy)`
- **原因**: Canvas JSONのフィールドは `ax/ay` なので
- **修正**: `child.ax` / `child.ay` に修正、`drawElement()` を両対応
- **状態**: 修正済み

---

## デバッグのヒント

### D1: childrenがCanvasに埋め込まれない
```bash
# 原因の特定
python -c "
import json
with open('out.canvas') as f:
    data = json.load(f)
with_children = [n for n in data['nodes'] if 'children' in n]
print(f'nodes with children: {len(with_children)} / {len(data[\"nodes\"])}')
"
```
- **確認点**:
  - `--node-views` フラグを付けているか
  - `_types/type_definitions.yml` に `nodeview:` キーがあるか
  - `nodeview/*.json` に `properties` キーがあるか

### D2: テキスト幅がブラウザ実測と異なる
- **原因**: Pythonの `_estimate_text_w()` が `font_size * 0.55` の近似値を使用
- **影響**: 横並びのピル位置が数pxずれる場合がある
- **対応**: 厳密な実測にはブラウザの `measureText()` を使用する

### D3: % position が正確でない
- **原因**: `position.x: "10%"` → `xRel: "left-10"` に簡易変換
- **影響**: 実際の10%位置にならない
- **対応**: 厳密なパーセント計算を実装する必要がある

### D4: gapX（横間隔）が未実装
- **原因**: 既存のchildrenレイアウトでは固定5px gapYのみ
- **影響**: 横並びのピル間隔が一定
- **対応**: `gapX` の実装を追加する

---

## 将来の改善点

### E1: テキスト幅推定の精度向上
- 現在: `_estimate_text_w()` = `font_size * 0.55` / char
- 改善案: ブラウザの `measureText()` に近いヒューリスティックを開発する

### E2: % position の厳密計算
- 現在: `position.x: "10%"` → `xRel: "left-10"`
- 改善案: 親の `node_width` に応じて正確な px 値を計算する

### E3: gapX（横間隔）の実装
- 現在: 横並びのピルは縦積み
- 改善案: `gapX` パラメータを追加し、横並びを可能にする

### E4: template.html のサーバー配信
- 現在: `index.html`のみサーバー側で配信
- 改善案: `template.html` も `/template.html` で配信する

### E5: 外側children（negative offset）のテストカバレッジ
- 現在: 一部の外側children（`xRel: "right--10"`）がテスト済み
- 改善案: 全パターン（top/bottom/left/rightのnegative offset）をテストする

---

## 重要な注意点

### N1: children描画と既存描画の共存
- propertiesあり → children描画（Path AまたはB）
- propertiesなし → 既存描画（rect + title + icon）
- **両方が混在して正常に動作することを確認**（Phase 6-9）

### N2: computeChildrenLayout結果の上書き
- children._cw/_ch は `compute_children()` 実行後に上書きするとエラー
- 修正: `if (!nw || nw <= 0) nw = children._cw || 200` で上書き防止
- **Phase 5とPhase 6での修正が必須**

### N3: children._ax/_ay のリセット
- children._ax = 0, children._ay = 0 にリセット後 drawElement(child, g, nx, ny)
- **リセットしない場合、相対座標が正しく変換されない**

### N4: window.VAULT/TYPEDEFS/NODEVIES のバインド
- `viewer.js` 内で定義された変数はwindowにバインドされない
- 修正: `init()` 内で明示的に `window.VAULT = VAULT;` 等を追加
- **デバッグ時にwindowオブジェクトから値を確認できない原因**

### N5: Pythonのkey正規化
- Python: `ax/ay/cw/ch` （アンダースコア付き）
- JS出力: `ax/ay/cw/ch` （アンダーストリップ）
- `writer.py` の `_serialize_children()` が自動変換
- **直接アクセスする場合は両方の形式を許容すること**
