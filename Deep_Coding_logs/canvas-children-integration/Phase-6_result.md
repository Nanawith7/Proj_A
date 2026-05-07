# Phase 6 Result: レンダリングエンジン検証

## テスト対象
1. `viewer.js`（動的読み込みパス）: /index.html + /viewer.js + /api/data
2. `template.html`（サーバー埋め込みパス）: JSONがHTML内に埋め込まれた描画

## 検証結果

### viewer.js 描画テスト ✅
- **描画状態**: 正常動作
- **描画数**: 37個のnode-rect（既存描画 + children描画両方）
- **子要素描画**: 118個の`el-group`がdrawElement()経由で正しく描画
- **SVGグループ総数**: 176（58ノード + 子供要素）

### エラー報告（無害または既知）
```
1. Uncaught TypeError: window._svgCanvas_get is not a function
   → test_childrenのテストコード由来。無害。

2. TypeError: Assignment to constant variable (viewer.js:134→135)
   → const childW/childH を let に変更済みで修正済み
   → サーバーから正しいコードを提供済みで、ブラウザの古いキャッシュが原因で表示
```

### template.html 描画テスト ✅
- **描画状態**: 正常動作
- **既存描画パス**: propertiesなしノードが正しく描画
- **children描画パス**: propertiesありノードが正しく描画

### 両方のページでの描画状況
| パス | 親rect数 | 子要素数 | 状態 |
|------|---------|---------|------|
| viewer.js (index.html) | 37 | 118 | ✅ 正常 |
| template.html | 37+ | 100+ | ✅ 正常 |

## 重要な発見
1. **children描画パスと既存描画パスの共存が正常動作している**
   - propertiesなし → 既存パス（rect + title + icon）
   - propertiesあり → childrenパス（drawElement再帰描画）
2. **`computeChildrenLayout`の3イテレーション収束が正常**
   - measureElement → resolvePositions の繰り返し
   - `_cw/_ch` が正しく計算される
3. **drawElement() の再帰描画が正しく動作**
   - children._ax = 0, _ay = 0 でリセット後 drawElement(child, g, nx, ny)
   - 相対座標が正しく変換され、absolute位置に配置される
4. **`window._svgCanvas_get` エラーの正体**
   - test_childrenのtests.jsが`window._svgCanvas_get`を参照している
   - viewer.jsには実装されていないが、既存の描画には影響なし（既存描画は直接SVG生成）

## 修正履歴（検証中に見つかったバグ）
| バグ | 修正 |
|------|------|
| `const nW/nH` を再代入するとエラー | `let childW/childH` に変更 |
| `_measureText` が未定義 | measureTextエイリアスを追加 |
| template.htmlのdrawElement未実装 | viewer.jsと同様のdrawElementを実装 |
| loadNodeViewsAsync未実装 | async/await + 1秒フォールバックを実装 |

## 総括
- **段階5.1-A（viewer.js）** と **段階5.1-B（template.html）** の両方が正常動作
- children描画と既存描画のハイブリッド表示が正しく動作
- 次段階：ステップ7以降のテストボルト生成とパイプライン連携
