# Phase 5 Result: レンダリングエンジン実装

## 実装内容

### viewer.js に追加した関数
1. `nodeViewToChildren(nv, nodeData)` - nodeview properties → children変換
2. `resolvePosChild(raw, total, defaultVal)` - 位置解決（%対応）
3. `measureElement(el)` - childrenの尺寸を測定
4. `resolvePositions(el)` - childrenの配置を解決
5. `computeChildrenLayout(el)` - レイアウトを3イテレーションで計算
6. `findElementByLabel(label, el)` - ラベル検索

### render() 関数変更点
既存の描画ループ（`currentNodes.forEach(n=>{...})`）にchildren描画パスを追加:

```javascript
const children = nodeViewToChildren(nv, v||{});

if (children && children.children.length > 0) {
  // children パス
  children._ax = nx, children._ay = ny;
  computeChildrenLayout(children);
  // 1. 親rect描画
  // 2. タイトル描画
  // 3. アイコン描画
  // 4. 子pillsを再帰描画
} else {
  // 既存描画パス（変更なし）
  // rect + title + icon
}
```

### template.html に追加した関数
viewer.js と同様の関数を追加:
- `nodeViewToChildren`
- `resolvePosChild`
- `measureElement`
- `resolvePositions`
- `computeChildrenLayout`

### renderGraph() 関数変更点
`renderGraph()` 内のノード描画ループにchildren描画パスを追加（viewer.js と同等のロジック）

## 実装完了事項
- ✓ `nodeViewToChildren` 関数（properties → children変換）
- ✓ `measureElement` 関数（ボトムアップ測定）
- ✓ `resolvePositions` 関数（トップダウン配置）
- ✓ `computeChildrenLayout` 関数（3イテレーション収束）
- ✓ `render()` / `renderGraph()` でのchildren描画パス統合

## 既知の課題
- **template.html で nodeview テンプレート未ロード**: `window._allNodeviews` が未定義
  → `ts.nodeview` が指定されても、テンプレートがロードされない
  → 当面は `template.html` は既存描画パスのみ使用される
- **viewer.js**: `nodeViewToChildren` が空の `nv` には正常対応できない可能性（`nv.properties` がチェックされるため）

## コードサイズ
- `viewer.js`: 変更後約884行（追加部分約300行）
- `template.html`: 変更後約403行（追加部分约90行）
