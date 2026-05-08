# 探索段階2結果：縦に極端に長いノードの原因調査

## 概要

ブラウザツール（agent-browser）を使用したグラフィカルデバッグにより、ノード高が暴走する根本原因を特定した。

---

## 発見1: `render()` 内の `n.height` ミューテート蓄積

### 現象
- 初期状態ですでに `n.height=35`（COLLAPSED_HEIGHT）になっている
- character型（型定義: 160x120）が全て `height=35` で描画されている
- 展開後も `height=35` のままになる場合がある

### 原因コード
`viewer.js:136-144` (Path A):
```javascript
if (expandedId === n.id) {
  childH = n.height || childH;
} else {
  childH = COLLAPSED_HEIGHT;  // ← 35
}
n.width = childW; n.height = childH;  // ← 常に実行！
```

`viewer.js:206-211` (Path B):
```javascript
if (expandedId === n.id) {
  childH = !childH || childH <= 0 ? children._ch || 120 : children._ch < childH ? children._ch : childH;
} else {
  childH = COLLAPSED_HEIGHT;  // ← 35
}
n.width = childW; n.height = childH;  // ← 常に実行！
```

### 問題チェーン
```
1. 初期描画: n.height = COLLAPSED_HEIGHT (35)
2. 展開: toggleExpand() → expH計算 → applyNodeView() → n.height = expH
3. render()再呼び出し: n.height = COLLAPSED_HEIGHT (35) ← 元サイズが失われる
4. 次回展開: node.height=35 → ratio=160/35=4.57 → expH計算が崩壊
```

### 検証結果
```javascript
// 初期状態
主人公: {width: 160, height: 35, childrenCount: 8}

// 展開後計算
expW: 1430.86, expH: 313
ratio: 4.57 (160/35) ← node.height=35が比率計算を崩す
```

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

### 検証結果
```javascript
// toggleExpand後
expandedId: "主人公"
主人公: {width: 160, height: 35} ← heightが35にリセットされている

// render()再呼び出し後
expandedId: null
主人公: {width: 160, height: 35} ← 常にCOLLAPSED_HEIGHT
```

---

## 発見3: `toggleExpand()` の比率計算が崩壊する

### 原因
`toggleExpand()` の比率計算（viewer.js:466-473）:
```javascript
const ow = nv.shape === 'circle' ? minW : (node.width || 200);
const oh = nv.shape === 'circle' ? minH : (node.height || 120);
if (ow > 0 && oh > 0) {
  const ratio = ow / oh;
  if (expW / expH > ratio) expH = expW / ratio;
  else expW = expH * ratio;
  ...
}
```

`node.height=35`（COLLAPSED_HEIGHT）なので:
- `ow=160, oh=35, ratio=4.57`
- `expW/expH > 4.57` → `expH = expW/4.57`
- `expW/expH <= 4.57` → `expW = expH*4.57`

これにより、展開後のサイズが型定義の宽高比（160:120 = 1.33）と一致しなくなる。

### 検証結果
```javascript
// 実際の計算
linesCount: 18
maxLineW: 560
lineH: 277
neededW: 596
neededH: 313
minW: 300
minH: 200
ratio: 4.57
expW: 1430.86
expH: 313
```

`expH=313` は型定義の120pxの約2.6倍。比率計算が崩れている。

---

## 発見4: `COLLAPSED_HEIGHT=35` の適切性

### 検証結果
```javascript
COLLAPSED_HEIGHT: 35
fontSize: 12
titleHeight: 16
pillHeight: 19
contentPadY: 10
calculatedMinHeight: 55
fits: false
```

- collapsed状態（titleのみ）: 16 + 10*2 = 36px → 35pxは少し狭い
- 展開状態（title + pills）: 55px必要 → 35pxでは不十分

ただし、collapsed時はpillsは描画されないため、35pxは title + padding でぎりぎり許容範囲。

---

## 根本原因の分類

| 原因 | 影響する問題 | 深刻度 |
|------|-------------|--------|
| **C1**: `render()` 内の `n.height` ミューテート（常時実行） | P1, P2, P5, P6 | **P0** |
| **C2**: `render()` 最後で `expandedId=null` | P2 | **P0** |
| **C3**: `toggleExpand()` の比率計算崩壊 | P1 | **P1** |
| **C4**: `COLLAPSED_HEIGHT=35` が少し狭い | P1（軽微） | **P2** |

---

## 修正方針

### 修正1: `render()` 内の `n.width` / `n.height` ミューテート停止（P0）
**対象**: `viewer.js:144`, `viewer.js:211`

**変更前**:
```javascript
n.width = childW; n.height = childH;
```

**変更後**:
```javascript
// n.width / n.height をミューテートしない
// childW / childH はローカル変数のみとして使用
// rectの属性更新のみ:
pRect.setAttribute('width', childW);
pRect.setAttribute('height', childH);
```

**理由**: `n.width` / `n.height` を型定義の初期値として保持し、毎レンダリングで上書きしない。

### 修正2: `render()` 最後で `expandedId=null` を設定しない（P0）
**対象**: `viewer.js:351`

**変更前**:
```javascript
svg.appendChild(mainG);graph.appendChild(svg);expandedId=null;
```

**変更後**:
```javascript
svg.appendChild(mainG);graph.appendChild(svg);
// expandedIdはリセットしない（ユーザー操作で明示的にcollapseされるまで保持）
```

**理由**: `expandedId` はユーザーの展開状態を保持するもので、`render()` 再呼び出し時にリセットすべきではない。

### 修正3: `toggleExpand()` の比率計算を修正（P1）
**対象**: `viewer.js:466-473`

**変更前**:
```javascript
const ow = nv.shape === 'circle' ? minW : (node.width || 200);
const oh = nv.shape === 'circle' ? minH : (node.height || 120);
```

**変更後**:
```javascript
// 型定義のサイズを使う（ミューテート済みのnode.width/heightを使わない）
const typeDef = TYPEDEFS[nodeType(node)] || {};
const ow = typeDef.node_width || minW;
const oh = typeDef.node_height || minH;
```

**理由**: `node.width` / `node.height` がCOLLAPSED_HEIGHTに上書きされている場合、比率計算が崩れる。

### 修正4: `COLLAPSED_HEIGHT` の値調整（P2）
**対象**: `viewer.js:6`

**変更前**:
```javascript
const COLLAPSED_HEIGHT = 35;
```

**変更後**:
```javascript
const COLLAPSED_HEIGHT = 40;
```

**理由**: title(12px) + padding(8px*2) = 28px。35pxは少し狭いため、40pxに拡張。

---

## 修正優先度

| 優先度 | 修正 | 理由 |
|--------|------|------|
| **P0** | 修正1: n.width/n.heightミューテート停止 | 全問題の根本原因 |
| **P0** | 修正2: expandedIdリセット停止 | 展開状態が保持されない |
| **P1** | 修正3: 比率計算修正 | 展開後のサイズが型定義と異なる |
| **P2** | 修正4: COLLAPSED_HEIGHT調整 | 軽微な表示崩れ |

---

## 次回フェーズへの引き渡し

段階2完了。以下の問題が特定された:
1. `render()` 内の `n.width/n.height` ミューテート蓄積（P0）
2. `render()` 最後で `expandedId=null`（P0）
3. `toggleExpand()` 比率計算崩壊（P1）

次の段階では、これらの修正を実装する。

---

## 参照文献

- `canvas_gen/viewer/viewer.js` — メインレンダリングコード
- `Obsidian_test/vault/_types/type_definitions.yml` — 型定義
- `test_children.canvas` — テスト用canvasデータ
