# Phase 5.1-B Result: template.html コア修正

## 修正対象
`canvas_gen/viewer/template.html`

## 実施した変更

### 1. drawElement()関数の追加（computeChildrenLayout直後）
**問題**: 手動ループでchildrenを描画していた（line 182-197）

**修正後**:
```javascript
function drawElement(parentEl, parentGroup, ox, oy) {
  const px = (ox || 0) + (parentEl._ax || 0);
  const py = (oy || 0) + (parentEl._ay || 0);
  // ... SVG矩形 + テキスト描画
  // ... 再帰的に子要素を描画
  if (parentEl.children && parentEl.children.length > 0) {
    for (const child of parentEl.children) {
      drawElement(child, g, px, py);
    }
  }
  parentGroup.appendChild(g);
}
```

### 2. _wrapText/_measureText関数の追加（resolvePosChild直後）
**問題**: `measureElement`で`_measureText`がundefined

**修正後**:
```javascript
const _measureText = function(text, fontSize) { ... };
window._measureCtx = document.createElement('canvas').getContext('2d');

function _wrapText(text, maxW, fontSize) {
  // 折り返みロジック
}
```

### 3. renderGraph()のchildren描画パスをdrawElement()ベースに変更（line 156-198）
**問題**: 手動ループでrect/text描画していた

**修正後**:
```javascript
if (children && children.children.length > 0) {
  // computeChildrenLayoutを実行する前に_cw/_chをnullにする
  children._cw = null; children._ch = null;
  computeChildrenLayout(children);
  
  // 上書き防止: 計算値より小さい場合のみ採用
  if (!nw || nw <= 0) nw = children._cw || 200;
  if (!nh || nh <= 0) nh = children._ch || 120;
  
  // 親rect描画
  // タイトル描画
  // アイコン描画
  
  // children描画をdrawElement()に委譲
  children._ax = 0; children._ay = 0;
  for (const child of children.children) {
    drawElement(child, g, nx, ny);
  }
}
```

### 4. loadNodeViewsAsync()関数の追加
**問題**: template.htmlはサーバーからnodeviewテンプレートをロードしない

**修正後**:
```javascript
async function loadNodeViewsAsync() {
  // nodeview/{name}.json をローカルからロード試行
  // 失敗時は /api/nodeview/{name}.json をフォールバック
  // 最終的には 1秒timeout後renderGraph()をfallback実行
}

// 初期化をasyncに変更
(function init() {
  loadNodeViewsAsync().then(nv => {
    window._allNodeviews = nv;
    renderGraph(FILE_NODES, ALL_EDGES);
    addFilterRow('filter-rows');
  });
  // Fallback: 1秒後にnodeviewsなしで描画
  setTimeout(() => { if (!window._allNodeviews) { ... } }, 1000);
})();
```

### 5. 上書き防止（line 158-159→新規4行）
**問題**: `children._cw = nw` で computeChildrenLayout 結果が上書き

**修正後**:
```javascript
children._ax = nx; children._ay = ny;
children._cw = null; children._ch = null;
computeChildrenLayout(children);
// Update node dimensions from computed layout (don't override if computed is bigger)
if (!nw || nw <= 0) nw = children._cw || 200;
if (!nh || nh <= 0) nh = children._ch || 120;
if (children._cw > 0 && children._cw < nw) nw = children._cw;
if (children._ch > 0 && children._ch < nh) nh = children._ch;
```

## 検証結果
- JavaScript構文バリデーション: **合格** (独自スクリプト実行)
- scriptタグ内: 21492文字, 440行
- パARENバランス: 完全閉じ
- BRACEバランス: 完全閉じ

## 重要な設計決定
1. children描画をdrawElement()に委譲（viewer.jsと同等化）
2. `_ax = 0, _ay = 0` にリセット後 drawElement(child, g, nx, ny) で相対位置計算
3. loadNodeViewsAsync() はローカルファイル /api/nodeview の両方から試行
4. 1秒timeoutで描画失敗を防ぐフォールバック実装
5. template.htmlはサーバー側埋め込みデータ + nodeview APIのハイブリッド対応

## 既知の課題
- viewer/server.py は /template.html を提供していない（現状ではindex.htmlのみ配信）
- template.htmlのサーバー側エクスポート機能（canvas_gen.main --serve-viewer）での配信が必要
- viewer.jsと異なり、template.htmlはJSONデータが埋め込み済みなのでfetch不要
