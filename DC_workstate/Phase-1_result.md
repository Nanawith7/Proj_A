# 探索段階1結果：n.width/n.height ミューテート停止 + expandedId保持

## 概要

`render()` 関数内の `n.width/n.height` ミューテート（P0-C1）と `expandedId=null` リセット（P0-C2）を修正し、ノードサイズ暴走を停止し展開状態を保持した。

---

## 発見1: `render()` 内の `n.height` ミューテート蓄積

### 原因コード
`viewer.js:144` (Path A):
```javascript
n.width = childW; n.height = childH;  // ← 常に実行！
```

`viewer.js:211` (Path B):
```javascript
n.width = childW; n.height = childH;  // ← 常に実行！
```

### 問題チェーン
```
1. 初期描画: n.height = COLLAPSED_HEIGHT (35)
2. 展開: toggleExpand() → expH計算 → applyNodeView() → n.height = expH
3. render()再呼び出し: n.height = COLLAPSED_HEIGHT (35) ← 元サイズが失われる
4. 次回展開: node.height=35 → ratio=160/35=4.57 → expH計算が崩壊
```

### 修正内容
- `viewer.js:144` — `n.width = childW; n.height = childH;` を削除
- `viewer.js:211` — `n.width = childW; n.height = childH;` を削除
- 描画は `childW`/`childH` ローカル変数のみを使用

---

## 発見2: `render()` の最後で `expandedId=null` が設定される

### 原因コード
`viewer.js:351`:
```javascript
svg.appendChild(mainG);graph.appendChild(svg);expandedId=null;
```

### 問題
- `toggleExpand()` で `expandedId=nid` を設定 → DOM更新
- `render()` が再呼び出しされると `expandedId=null` にリセット
- 次回描画で全てのノードが `COLLAPSED_HEIGHT` になる

### 修正内容
- `viewer.js:351` — `expandedId=null;` を削除

---

## 発見3: `applyNodeView()` で `expanded=false` 時に `COLLAPSED_HEIGHT` を使用しない

### 原因コード
`viewer.js:389-390`:
```javascript
let nw=node.width||200,nh=node.height||120;
if(expanded) { nw=expanded.width; nh=expanded.height; }
```

### 問題
- `expanded=false` の時、`node.width/height` を使う
- `node.width/height` が既にミューテート済み（展開後のサイズなど）
- 縮小時に元のサイズ（型定義サイズ）に戻らない

### 修正内容
- `viewer.js:389-391`: `expanded=false` 時に `COLLAPSED_HEIGHT` を使用
```javascript
let nw=td.node_width||200,nh=td.node_height||120;
if(expanded && expanded.width) { nw=expanded.width; nh=expanded.height; }
else { nh=COLLAPSED_HEIGHT; }
```

---

## テスト結果

### 初期描画状態
```javascript
// render() 後
盗賊: {width: 160, height: 35}
魔王: {width: 160, height: 35}
```
✅ 全ノード height=35（COLLAPSED_HEIGHT）

### 展開後
```javascript
// 展開後（render() なし）
魔王: {width: 636, height: 477}
```
✅ 展開サイズが正しく設定

### 縮小後
```javascript
// 縮小後（render() なし）
魔王: {width: 160, height: 35}
```
✅ COLLAPSED_HEIGHT に復元

### `render()` 呼び出し後も
```javascript
// render() 呼び出し後
魔王: {width: 160, height: 35}
```
✅ `render()` 再呼び出し後も COLLAPSED_HEIGHT を保持

### 3回展開→縮小サイクル後
```javascript
// 3回展開→縮小後
魔王: {width: 160, height: 35}
```
✅ サイズが安定（ミューテート蓄積なし）

---

## 根本原因の分類

| 原因 | 影響する問題 | 深刻度 |
|------|-------------|--------|
| **C1**: `render()` 内の `n.height` ミューテート（常時実行） | P1, P2, P5, P6 | **P0** |
| **C2**: `render()` 最後で `expandedId=null` | P2 | **P0** |
| **C3**: `applyNodeView()` が `expanded=false` 時に `COLLAPSED_HEIGHT` を使用しない | P2 | **P0** |

---

## 次回フェーズへの引き渡し

段階1完了。以下の問題が修正された:
1. `render()` 内の `n.width/n.height` ミューテート蓄積（P0）
2. `render()` 最後で `expandedId=null`（P0）
3. `applyNodeView()` が `expanded=false` 時に `COLLAPSED_HEIGHT` を使用しない（P0）

次の段階では、`applyNodeView()` の修正（P0-C3）と Path A のアイコン描画追加（P0-C4）を実装する。

---

## 参照文献

- `canvas_gen/viewer/viewer.js` — メインレンダリングコード
