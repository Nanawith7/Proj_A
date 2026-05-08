# 探索段階5結果：アイコン位置ズレの原因調査

## 概要

Path A/B/B-2でアイコン座標計算の基準点が異なる問題を特定した。

---

## 発見1: Path Aにはアイコン描画コードが欠落している

### 問題
`viewer.js` の Path A（line 136-194）には、**アイコン描画コードが全く存在しない**。

**Path A が描画する要素**:
1. 親rect（line 147-165）
2. タイトル（line 167-184）
3. Children（line 186-191）

**Path A が描画しない要素**:
- ❌ アイコン（描画コードなし）

### 検証結果
```javascript
// SVG内のimage.node-icon-img要素
{
  iconCount: 3,
  icons: [
    {href: "node_era_080_120.png", x: "1837.5", y: "1027.5"},
    {href: "node_era_120_150.png", x: "2187.5", y: "1027.5"},
    {href: "node_era_150_180.png", x: "2537.5", y: "1027.5"}
  ]
}
```

3つのアイコンは全て `era_*` ノード（`era_circle` nodeview使用）。
character型ノード（主人公など）にはアイコンが描画されていない。

### VAULTデータ確認
```javascript
// 主人公のvaultデータ
{
  icon: "_icons/node_主人公.png",
  icon_size: "80x70"
}
```
VAULTデータにはiconが設定されているが、Path Aで描画されない。

---

## 発見2: 各パスのアイコン計算比較

| パス | アイコンサイズ計算 | アイコン基準座標 | デフォルトanchor |
|------|-------------------|------------------|------------------|
| **Path A** | なし（描画なし） | なし | - |
| **Path B** (line 253-274) | `Math.min(children._cw, children._ch) * 0.45` | `children._ax`, `children._ay` | center/center |
| **Path B-2** (line 326-345) | `Math.min(nw, nh) * 0.45` | `nx`, `ny` | center/center |
| **ToggleExpand** (line 484-507) | `Math.min(40, node.width||200)` | `nx`, `ny`, `expW`, `expH` | **left/top** |

### 不一致ポイント

1. **Path A**: アイコン描画なし
2. **Path B vs Path B-2**: 計算基準が異なる
   - Path B: `children._ax`（=nx）、`children._cw`
   - Path B-2: `nx`、`nw`
3. **ToggleExpand**: デフォルトanchorが `left/top`（Path B/B-2は `center/center`）

---

## 発見3: 実際のアイコン描画確認

### 描画されているアイコン
- `era_*` ノード（3つ）のみ描画
- character型ノード（主人公、四天王Aなど）は描画されていない

### 原因
- character型は `character_card` nodeviewを使用 → Path A（pre-computed childrenあり）
- Path Aにはアイコン描画コードがない → アイコンが描画されない
- era型は `era_circle` nodeviewを使用 → Path BまたはB-2（childrenなし）
- Path B/B-2にはアイコン描画コードがある → アイコンが描画される

---

## 根本原因の分類

| 原因 | 影響する問題 | 深刻度 |
|------|-------------|--------|
| **C1**: Path Aにアイコン描画コードが欠落 | character型ノードのアイコン未表示 | **P0** |
| **C2**: ToggleExpandのデフォルトanchorがleft/top | 展開時アイコン位置がPath B/B-2と異なる | **P1** |

---

## 修正方針

### 修正1: Path Aにアイコン描画コードを追加（P0）

**対象**: `viewer.js` line 136-194（Path A）

**追加位置**: タイトル描画後（line 184）、children描画前（line 186-191）

**実装内容**:
```javascript
// Icon (added to Path A)
const iconPath = v?.props?.icon;
if (iconPath) {
  const isz = Math.min(childW, childH) * 0.45;
  const anchorX = nv.layout?.iconAnchorX || 'center';
  const anchorY = nv.layout?.iconAnchorY || 'center';
  const ipx = nv.layout?.iconPadX || 0, ipy = nv.layout?.iconPadY || 0;
  let ix, iy;
  if (anchorX === 'left') ix = nx + ipx;
  else if (anchorX === 'right') ix = nx + childW - isz - ipx;
  else ix = nx + (childW - isz) / 2;
  if (anchorY === 'top') iy = ny + ipy;
  else if (anchorY === 'bottom') iy = ny + childH - isz - ipy;
  else iy = ny + (childH - isz) / 2;
  const img = document.createElementNS(svgNS, 'image');
  img.setAttribute('href', '/_icons/' + iconPath.split('/').pop());
  img.setAttribute('x', ix); img.setAttribute('y', iy);
  img.setAttribute('width', isz); img.setAttribute('height', isz);
  img.setAttribute('class', 'node-icon-img');
  img.style.pointerEvents = 'none';
  g.appendChild(img);
}
```

### 修正2: ToggleExpandのデフォルトanchorをcenter/centerに変更（P1）

**対象**: `viewer.js` line 488-489

**変更前**:
```javascript
const ax = nv.layout?.expandedIconAnchorX || nv.layout?.iconAnchorX || 'left';
const ay = nv.layout?.expandedIconAnchorY || nv.layout?.iconAnchorY || 'top';
```

**変更後**:
```javascript
const ax = nv.layout?.expandedIconAnchorX || nv.layout?.iconAnchorX || 'center';
const ay = nv.layout?.expandedIconAnchorY || nv.layout?.iconAnchorY || 'center';
```

---

## 修正優先度

| 優先度 | 修正 | 理由 |
|--------|------|------|
| **P0** | 修正1: Path Aにアイコン描画コードを追加 | character型ノードのアイコンが未表示 |
| **P1** | 修正2: ToggleExpandのデフォルトanchorを修正 | 展開時アイコン位置がPath B/B-2と異なる |

---

## 次回フェーズへの引き渡し

段階5完了。以下の問題が特定された:
1. Path Aにアイコン描画コードが欠落（P0）
2. ToggleExpandのデフォルトanchorがleft/top（P1）

次の段階では、これらの修正を実装する。

---

## 参照文献

- `canvas_gen/viewer/viewer.js` — メインレンダリングコード
- `Obsidian_test/vault/nodeview/character_card.json` — character_card nodeview
- `Obsidian_test/vault/nodeview/era_circle.json` — era_circle nodeview
