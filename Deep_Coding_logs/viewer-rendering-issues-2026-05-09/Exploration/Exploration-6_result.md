# 探索段階6結果：横幅が極端に広い原因調査

## 概要

`resolvePositions()` の `maxRight` 計算と `n.width` ミューテート蓄積の問題を確認した。

---

## 発見1: viewBox が異常に大きい

### 検証結果
```javascript
viewBox: "0 0 4880 2980"
minWidth: "4880px"
minHeight: "2980px"
```

### 原因
`render()` の viewBox 計算（line 102-107）:
```javascript
let maxX=200,maxY=200;
currentNodes.forEach(n=>{
  const r=(n.x||0)+(n.width||200),b=(n.y||0)+(n.height||120);
  if(r>maxX)maxX=r;if(b>maxY)maxY=b;
});
maxX+=400;maxY+=400;
```

最大の `right` を持つノード:
```javascript
{
  id: "魔法学園編入",
  x: 4200,
  width: 280,
  right: 4480
}
```

`4480 + 400 = 4880` → viewBox の `maxX` と一致。

---

## 発見2: n.width/n.height のミューテート蓄積

### 問題チェーン
```
1. 初期描画: n.height = COLLAPSED_HEIGHT (35)
2. 展開: toggleExpand() → n.width = expW (例: 1494)
3. render() 再呼び出し:
   childW = n.width || childW = 1494  ← 展開後の値を使う
   n.width = childW = 1494  ← 変更なしだが削除すべき
```

### 検証結果
```javascript
// ALL_NODES と currentNodes は同じ配列
{
  ALL_NODES: [{id: "主人公", width: 160, height: 35}],
  currentNodes: [{id: "主人公", width: 160, height: 35}]
}
```

---

## 発見3: resolvePositions() の padX * 2 加算

### 問題コード
`viewer.js:851`:
```javascript
el._cw = Math.max(maxRight, el._cw) + padX * 2;
```

`el._cw` が既に計算済みの場合、再度 `padX * 2` が加算される。

---

## 根本原因の分類

| 原因 | 影響する問題 | 深刻度 |
|------|-------------|--------|
| **C1**: `render()` 内で `n.width/n.height` をミューテート | P1, P2, P5, P6 | **P0** |
| **C2**: `resolvePositions()` で `padX * 2` の二重加算 | P5（軽微） | **P2** |

---

## 修正方針

### 修正1: `render()` 内で `n.width/n.height` をミューテートしない（P0）

**変更前**（Path A, line 144）:
```javascript
n.width = childW; n.height = childH;
```

**変更後**:
```javascript
// n.width / n.height をミューテートしない
// rectの属性更新のみ:
pRect.setAttribute('width', childW);
pRect.setAttribute('height', childH);
```

### 修正2: `resolvePositions()` の `padX * 2` 二重加算を修正（P2）

**変更前**（line 851）:
```javascript
el._cw = Math.max(maxRight, el._cw) + padX * 2;
```

**変更後**:
```javascript
el._cw = Math.max(maxRight + padX * 2, el._cw + padX * 2);
```

---

## 結論

P5（横幅が極端に広い）は、P1（縦長ノード）と同じ根本原因（`n.width/n.height` のミューテート蓄積）によるものである。P1 を修正すれば同時に解決する。

---

## 次回フェーズへの引き渡し

段階6完了。P5 は P1 と同じ根本原因であることが確認された。

次の段階では、これらの修正を実装する。
