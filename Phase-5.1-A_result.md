# Phase 5.1-A Result: viewer.js コア修正

## 修正対象
`canvas_gen/viewer/viewer.js`

## 実施した変更

### 1. children描画パスのリファクタリング（render関数 line 112-197）
**問題**: 手動ループでchildrenを描画（line 185-212）し、`drawElement()`が未使用

**修正後**:
```javascript
// children._ax/_ay are relative to the children root; set them to 0
// so that drawElement adds (nx, ny) from ox/oy for correct absolute positioning.
children._ax = 0;
children._ay = 0;
for (const child of children.children) {
  drawElement(child, g, nx, ny);
}
```

### 2. computeChildrenLayout結果の上書き防止（render関数 line 118-123）
**問題**: `computeChildrenLayout` 実行後、children._cw/_ch が上書きされていた

**修正後**:
```javascript
// Update node dimensions from computed layout
if (!nw || nw <= 0) nw = children._cw || 200;
if (!nh || nh <= 0) nh = children._ch || 120;
if (children._cw > 0 && children._cw < nw) nw = children._cw;
if (children._ch > 0 && children._ch < nh) nh = children._ch;
n.width = nw; n.height = nh;
```

### 3. _wrapText/_measureText関数の追加（ファイル先頭 line 7-19）
**問題**: `measureElement` 内部で `_wrapText` が参照されていたが未定義

**修正後**:
```javascript
const _measureText = measureText;

function _wrapText(text, maxW, fontSize) {
  const lines = [];
  let pos = 0;
  while (pos < text.length) {
    let len = 1;
    while (pos + len <= text.length && measureText(text.slice(pos, pos + len), fontSize, 'sans-serif') < maxW) len++;
    if (len === 1 && pos + 1 <= text.length) len = 2;
    lines.push(text.slice(pos, pos + len - 1));
    pos += len - 1;
  }
  return lines;
}
```

### 4. renderNodeWithChildren関数の更新（line 854-865）
**問題**: 関数が `computeChildrenLayout` を再実行し、不要な重複処理

**修正後**:
```javascript
function renderNodeWithChildren(node, nv, g, mainG, svgNS, nx, ny, iconPath, fill, title, td) {
  node.width = node._cw;
  node.height = node._ch;
  drawElement(node, g, 0, 0);
}
```

## 検証結果
- JavaScript構文バリデーション: **合格** (node --check)
- 括弧バランス: **OK** (全閉じ括弧が閉じられている)
- ファイルサイズ: 883行, 37865文字

## 既知の課題（次回修正）
- template.html で同様の変更が必要
- template.html で `loadNodeViewsAsync()` 実装が必要
- template.html で `_wrapText` 関数が必要

## 重要な設計決定
1. children._ax/_ay を 0 にリセットし、drawElement() の ox/oy で絶対位置を計算する方式を採用
2. nw/nh が存在し、computed layout より小さい場合は nw/nh を優先（既存Canvasとの互換性）
3. _wrapText は改行なしの折り返みロジックのみ（既存 drawWrappedTitle と統合しない）
