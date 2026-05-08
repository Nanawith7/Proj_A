# 探索段階1結果：問題領域のマッピング

## 概要

canvas viewerのレンダリング異常6問題について、データフローを追跡し、原因となりうるコードパスを特定した。

---

## 問題マッピング表

| No | 問題 | 主要原因パス | 詳細 |
|----|------|-------------|------|
| P1 | 縦に極端に長いノード | `render()` サイズミューテート + `toggleExpand()` lineH暴走 | `n.height` が毎レンダリングでCOLLAPSED_HEIGHT(35)または展開後の高い値に上書きされ、蓄積される |
| P2 | 展開→縮小で異常に小さい | `collapseAll()` → `applyNodeView()` | 元サイズ復元時に `node.width || 200` を使うが、既にミューテート済みの値を使う |
| P3 | テキスト未描画 | `drawElement()` 条件分岐 | `parentEl.w === null` が事前計算済みchildrenでfalse（cwが設定済み） |
| P4 | アイコン位置ズレ | Path A vs Path B の計算基準点不一致 | Path A: `nx + child.ax`, Path B: `children._ax`（=0リセット後） |
| P5 | 横幅が極端に広い | `n.width` ミューテート蓄積 | 展開後の `n.width` が縮小時に復元されず、次の描画でその値を使う |
| P6 | SVG viewBox/minWidth暴走 | `render()` viewBox計算 | `maxX += 400`, `maxY += 400` の追加 + ミューテート済みwidthの使用 |

---

## 詳細分析

### P1: 縦に極端に長いノード

**原因チェーン**:
```
1. render() Path A (viewer.js:136-144):
   childH = (expanded) ? n.height : COLLAPSED_HEIGHT
   n.height = childH  ← 毎レンダリングでミューテート

2. toggleExpand() (viewer.js:434-473):
   lineH += lc * (fs + 4)  ← 二重計算のリスク
   expH = Math.max(minH, neededH)
   applyNodeView(rect, node, {width: expW, height: expH})
   → node.height = expH  ← さらにミューテート

3. 結果:
   - 展開→縮小サイクルで n.height が COLLAPSED_HEIGHT(35) に
   - 次展開: n.height=35 → expH計算が崩壊
   - または lineH 蓄積で expH が異常に大きい
```

**関連コード**:
- `viewer.js:144` — `n.height = childH` (常時ミューテート)
- `viewer.js:434-456` — `lineH` 蓄積ループ
- `viewer.js:480` — `applyNodeView()` で size 設定

**影響を受けるパス**: Path A, Path B

---

### P2: 展開→縮小で異常に小さい

**原因チェーン**:
```
1. 展開後: n.width=500, n.height=400 (toggleExpandで設定)
2. 縮小: collapseAll() → applyNodeView(rect, node, false)
3. applyNodeView() (viewer.js:391-408):
   nw = node.width || 200  ← 500 !
   nh = node.height || 120 ← 400 !
   → 元サイズ(160x120)ではなくミューテート値を使う
```

**関連コード**:
- `viewer.js:619-643` — `collapseAll()`
- `viewer.js:391-408` — `applyNodeView()`
- `viewer.js:393-394` — `nw=node.width||200, nh=node.height||120`

**影響を受けるパス**: 全パス（`applyNodeView()` は共通）

---

### P3: テキスト未描画

**原因チェーン**:
```
1. 事前計算済みchildren (Path A):
   n.children = [{ax:10, ay:8, cw:160, ch:22, text:'...'}, ...]

2. drawElement() (viewer.js:940):
   if (parentEl.text && (parentEl.w === null || !parentEl.children)) {
     // テキスト描画
   }

3. 事前計算済みchildrenは cw が設定済み:
   parentEl.w === null → false (cwがある)
   → テキスト描画がスキップされる
```

**関連コード**:
- `viewer.js:940` — テキスト描画条件
- `canvas_gen/writer.py:65-76` — `_serialize_children()` で `_cw` → `cw`

**影響を受けるパス**: Path A の children 描画

**補足**: Path Aではchildrenが事前計算済みなので`drawElement()`が呼ばれるが、`cw`が設定されているためテキストが描画されない可能性がある。

---

### P4: アイコン位置ズレ

**原因チェーン**:
```
Path A (viewer.js:186-191):
  for (const child of canvasChildren) {
    drawElement(child, g, nx + (child.ax || 0), ny + (child.ay || 0));
  }
  → ox = nx + ax, oy = ny + ay

Path B (viewer.js:253-274):
  // アイコン計算:
  let ix, iy;
  if (anchorX === 'left') ix = children._ax + ipx;
  else if (anchorX === 'right') ix = children._ax + children._cw - isz - ipx;
  else ix = children._ax + (children._cw - isz) / 2;
  → children._ax = nx (set at line 201)

Path B-2 (viewer.js:326-345):
  if (anchorX === 'left') ix = nx + ipx;
  → 直接 nx を使用
```

**差異**:
- Path A: `nx + child.ax` (axは相対座標)
- Path B: `children._ax` (これはnxそのもの)
- Path B-2: `nx` (直接)

**関連コード**:
- `viewer.js:186-191` — Path A children描画
- `viewer.js:253-274` — Path B アイコン
- `viewer.js:326-345` — Path B-2 アイコン

**影響を受けるパス**: 全パス（アイコン描画部分）

---

### P5: 横幅が極端に広い

**原因チェーン**:
```
1. 展開: toggleExpand() → n.width = expW (例: 500)
2. 縮小: applyNodeView() → n.width = n.width || 200 = 500 (復元されない!)
3. 次描画: childW = n.width = 500
4. 結果: ノードが500pxの幅で描画される
```

**関連コード**:
- `viewer.js:144` — `n.width = childW`
- `viewer.js:393` — `nw = node.width || 200`
- `viewer.js:845-852` — `resolvePositions()` maxRight計算

**影響を受けるパス**: Path A, Path B

---

### P6: SVG viewBox/minWidth暴走

**原因チェーン**:
```
1. render() (viewer.js:102-107):
   currentNodes.forEach(n => {
     const r = (n.x||0) + (n.width||200), b = (n.y||0) + (n.height||120);
     if (r > maxX) maxX = r;
     if (b > maxY) maxY = b;
   });
   maxX += 400; maxY += 400;  ← 追加オフセット

2. ミューテート済み n.width/nheight を使用:
   n.width = 500 (展開後) → r = x + 500 → maxX が暴走
```

**関連コード**:
- `viewer.js:102-107` — viewBox計算

**影響を受けるパス**: 全パス

---

## 根本原因の分類

### 根本原因A: `n.width` / `n.height` のミューテート蓄積
**影響**: P1, P2, P5, P6
**詳細**: `render()` 内の `n.width = childW; n.height = childH;` が常に実行され、元の型定義サイズが失われる。`toggleExpand()` でも同様のミューテートが発生する。

### 根本原因B: `applyNodeView()` の復元不備
**影響**: P2
**詳細**: `applyNodeView()` が `node.width || 200` を使うが、`node.width` が既にミューテート済みのため、元サイズが復元されない。

### 根本原因C: `drawElement()` の条件分岐
**影響**: P3
**詳細**: 事前計算済みchildrenは `cw` が設定されているため、`parentEl.w === null` がfalseになりテキスト描画がスキップされる。

### 根本原因D: Path間での計算基準点不一致
**影響**: P4
**詳細**: Path A/B/B-2でアイコンの座標計算基準点が異なり、同じノードでも描画パスによって位置が異なる。

---

## 優先度付け

| 優先度 | 問題 | 理由 |
|--------|------|------|
| **P0** | P1 (縦長ノード) | 画面が完全に崩壊。即時修正必要 |
| **P0** | P5 (横幅広すぎる) | 画面が完全に崩壊。即時修正必要 |
| **P1** | P2 (縮小サイズ壊れ) | 展開→縮小でUIが壊れる |
| **P2** | P3 (テキスト未描画) | 情報が見えない |
| **P2** | P4 (アイコンズレ) | UIの品質問題 |

---

## 次回探索で確認すべき点

1. **実際のビューアで問題現象を再現する**
   - ブラウザツールを使用して実際のレンダリングを監視
   - `n.width` / `n.height` の値をレンダリングサイクル間で追跡

2. **`lineH` 蓄積の詳細**
   - `toggleExpand()` の `lineH` が本当に二重計算されているか
   - `mode='wrap'` と `mode='flow'` でどのくらい差が出るか

3. **Python推定 vs ブラウザ測定の差**
   - `_estimate_text_w_v2()` と `measureText()` の差が大きいケース
   - 日本語テキストで特に差が出ないか

4. **COLLAPSED_HEIGHT = 35の適切性**
   - タイトルと pills が収まる最小高さ
   - 実際のコンテンツ高さとの比較

---

## 仮説まとめ

**主要仮説**: `render()` 内の `n.width = childW; n.height = childH;` が毎レンダリングで実行され、元の型定義サイズが失われることで、サイズ暴走（P1, P5）と縮小時のサイズ壊れ（P2）が発生している。

**二次仮説**: `toggleExpand()` の `lineH` 計算が正しくない値を生み、展開後のサイズが異常に大きくなる（P1の副原因）。

**三次仮説**: `drawElement()` の条件分岐が事前計算済みchildrenでテキスト描画をスキップする（P3）。
