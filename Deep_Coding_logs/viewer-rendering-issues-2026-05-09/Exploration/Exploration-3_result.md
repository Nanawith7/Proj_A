# 探索段階3結果：展開→縮小で異常に小さくなる原因調査

## 概要

`collapseAll()` → `applyNodeView()` のサイズ復元不備を特定した。

---

## 発見1: applyNodeView()のサイズ復元ロジックに問題がある

### 問題コード
`viewer.js:391-408`:
```javascript
function applyNodeView(rect, node, expanded) {
  const type=nodeType(node),td=TYPEDEFS[type]||{},nvName=td.nodeview||'plain',nv=NODEVIEWS[nvName]||{shape:'rect',rx:4};
  let nw=node.width||200,nh=node.height||120;  // ← 既にミューテート済みの値を使う！
  if(expanded) { nw=expanded.width; nh=expanded.height; }
  rect.setAttribute('width',nw);rect.setAttribute('height',nh);
  ...
}
```

### 問題点
1. `nw=node.width||200` — `node.width` が既にミューテート済み（1494など）
2. `if(expanded)` — `expanded=false` の場合、ミューテート済みの `node.width` を使う
3. 元サイズ（型定義のサイズ）が復元されない

---

## 発見2: collapseAll()の呼び出しチェーン

### 呼び出し元
`collapseAll()` は `toggleExpand()` からしか呼ばれない:
- `toggleExpand()` line 422: 別のノードをクリックした時に既存ノードをcollapse
- `toggleExpand()` line 423: 同じノードをクリックした時にcollapse（トグル）

### 問題チェーン
```
1. 展開: applyNodeView(rect, node, {width:expW, height:expH})
   → node.width = expW (例: 1494)
   
2. 縮小: collapseAll() → applyNodeView(rect, node, false)
   → nw = node.width || 200 = 1494 ← 元サイズ(160)ではない！
```

---

## 発見3: render()最後でexpandedId=null

### 問題コード
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
// 展開直後
expandedId: "主人公"
主人公: {width: 160, height: 35} ← heightが35にリセットされている

// render()再呼び出し後
expandedId: null
主人公: {width: 160, height: 35} ← 常にCOLLAPSED_HEIGHT
```

---

## 根本原因の分類

| 原因 | 影響する問題 | 深刻度 |
|------|-------------|--------|
| **C1**: `applyNodeView()` がミューテート済み `node.width` を使う | P2 | **P0** |
| **C2**: `render()` 最後で `expandedId=null` | P2 | **P0** |

---

## 修正方針

### 修正1: applyNodeView()でexpanded=falseの時に型定義サイズを使う（P0）

**変更前**:
```javascript
function applyNodeView(rect, node, expanded) {
  const type=nodeType(node),td=TYPEDEFS[type]||{};
  let nw=node.width||200,nh=node.height||120;
  if(expanded) { nw=expanded.width; nh=expanded.height; }
  ...
}
```

**変更後**:
```javascript
function applyNodeView(rect, node, expanded) {
  const type=nodeType(node),td=TYPEDEFS[type]||{};
  // expanded=falseの時は型定義サイズを使う
  let nw=td.node_width||200,nh=td.node_height||120;
  if(expanded && expanded.width) { nw=expanded.width; nh=expanded.height; }
  ...
}
```

### 修正2: render()最後でexpandedId=nullをリセットしない（P0）

**変更前**:
```javascript
svg.appendChild(mainG);graph.appendChild(svg);expandedId=null;
```

**変更後**:
```javascript
svg.appendChild(mainG);graph.appendChild(svg);
// expandedIdはリセットしない
```

---

## 修正優先度

| 優先度 | 修正 | 理由 |
|--------|------|------|
| **P0** | 修正1: applyNodeView()で型定義サイズを使用 | 縮小時に元サイズが復元されない |
| **P0** | 修正2: expandedIdリセット停止 | 展開状態が保持されない |

---

## 次回フェーズへの引き渡し

段階3完了。以下の問題が特定された:
1. `applyNodeView()` がミューテート済み `node.width` を使う（P0）
2. `render()` 最後で `expandedId=null`（P0）

次の段階では、これらの修正を実装する。

---

## 参照文献

- `canvas_gen/viewer/viewer.js` — メインレンダリングコード
- `Obsidian_test/vault/_types/type_definitions.yml` — 型定義
