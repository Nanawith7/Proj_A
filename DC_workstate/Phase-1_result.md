# 段階1結果: render() ミューテート停止 + expandedId保持

## 概要

`render()` 内の `n.width/n.height` ミューテートを停止し、`expandedId=null` リセットを削除することで、ノードサイズ暴走（P1/P5/P6）と展開状態保持不全（P2/P3）の根本原因を修正した。

---

## 修正内容

### 修正1: Path A（viewer.js:144）の n.width/n.height 代入文削除

**変更前**:
```javascript
n.width = childW; n.height = childH;
```

**変更後**:
```javascript
// 削除: n.width/n.height に代入しない
// childW/childH は描画専用ローカル変数のみとして使用
```

### 修正2: Path B（viewer.js:211）の n.width/n.height 代入文削除

**変更前**:
```javascript
n.width = childW; n.height = childH;
```

**変更後**:
```javascript
// 削除: n.width/n.height に代入しない
// children._cw/_ch は描画専用ローカル変数のみとして使用
```

### 修正3: render()末尾（viewer.js:351）の expandedId=null 削除

**変更前**:
```javascript
svg.appendChild(mainG);graph.appendChild(svg);expandedId=null;
```

**変更後**:
```javascript
svg.appendChild(mainG);graph.appendChild(svg);
// expandedIdはリセットしない（ユーザー操作で明示的にcollapseされるまで保持）
```

---

## テスト結果

### テスト1: 初期値確認
```
主人公: w=160, h=120
四天王A: w=160, h=120
王女: w=160, h=120
騎士団長: w=160, h=120
```
✅ 全て型定義サイズと一致

### テスト2: 展開→縮小サイクル（3回）
```json
[
  {"cycle":1, "expandedId":"主人公", "w":160, "h":120},
  {"cycle":2, "expandedId":null, "w":160, "h":120},
  {"cycle":3, "expandedId":"主人公", "w":160, "h":120}
]
```
✅ 3サイクル全てで n.width=160, n.height=120（ミューテートされていない）
✅ expandedId が正しくトグルされている

---

## 解決した根本原因

| 原因ID | 原因 | 解決状態 |
|--------|------|----------|
| P0-C1 | `render()` 内で `n.width/n.height` をミューテート | ✅ 解決 |
| P0-C2 | `render()` 最後で `expandedId=null` にリセット | ✅ 解決 |

---

## 影響を受ける問題

- **P1**（縦長ノード）: 根本原因C1の修正により解決
- **P2**（縮小サイズ壊れ）: 根本原因C1/C2の修正により解決
- **P3**（テキスト未描画）: 根本原因C2の修正により解決
- **P5**（横幅広すぎる）: 根本原因C1の修正により解決
- **P6**（viewBox暴走）: 根本原因C1の修正により解決

---

## 次の段階

段階2: `applyNodeView()`修復 + Path Aアイコン追加（P0-C3/C4）
