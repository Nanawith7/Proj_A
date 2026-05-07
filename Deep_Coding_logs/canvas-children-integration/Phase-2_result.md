# Phase 2 Result: test_children レイアウトエンジン解析

## 8ファイルの関係性マッピング

```
children_layout.html
  ├─ data.js    (makeEl, window.root, サンプルデータ生成)
  ├─ text.js    (measureText, wrapText, fitFontSize)
  ├─ layout.js  (measureElement, resolvePositions, computeLayout, parseRelative) ← 363行
  ├─ render.js  (drawElement, render) ← text.js + layout.js を使用
  ├─ interaction.js ← layout + render を使用
  ├─ ui-tree.js ← window.root + selectedId
  ├─ ui-props.js ← window.root + selectedId
  └─ tests.js ← layout をテスト
```

## 描画フロー
```
computeLayout() → measureElement() → resolvePositionsTree() → drawElement() → viewBox = root._cw × root._ch
```

## 既存 vs 新children 比較

| 分類 | 既存 viewer.js | 新 test_children |
|------|---------------|-----------------|
| 描画単位 | 各ノードが独立SVG `<g>` | 親→子のSVG `<g>` 嵌套 |
| 描画関数 | `renderGraph(nodes, edges)` | `render → drawElement(el, parentG, ox, oy)` |
| テキスト処理 | `truncateTitle()` | `wrapText() + fitFontSize()` |
| テキストモード | 折り返し+"..." | clip / shrink / auto(折返しなし) |
| 子要素 | なし（properties→ボディ展開） | children再帰描画 |
| アイコン | `layout.iconAnchorX/Y` | 同様のanchor |
| フィルタ | server.js + viewer.js側で実行 | なし（テスト用なので不要） |

## 問題点
1. テスト用フレームワークとして完結（エディタUI含む）
2. 8ファイルが `children_layout.html` に依存
3. 描画が `test_children/svg-canvas` に固定
4. グローバル状態（`window.root`, `window.selectedId`, `nextId`）が `data.js` で定義
