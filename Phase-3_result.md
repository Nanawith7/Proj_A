# Phase 3 Result: 差異分析・統合設計

## 採用アプローチ: C案（既存保持 + 新childrenオプション）の強化版

```
既存: viewer/server.py → HTML配信 → viewer.js描画 → SVGにrect/text描画
新:   test_children/ → SVG描画 → children再帰描画 → nested <g>

統合後: viewer/server.py → HTML配信 → viewer.js描画 → 既存+新しい描画を混ぜてSVG描画
```

## 具体的な設計

```
新しい描画フロー:
┌─ render(canvasData) ─────────────────────────────────┐
│ 1. 既存ノード描画（既存描画を維持）                       │
│    - childrenがないノード → 既存描画（既存と同じrect+txt）  │
│    - icon描画を統一                                       │
│ 2. childrenがあるノード描画（新children描画）              │
│    - childrenがあるノードは新layoutEngineで処理              │
│    - measureElement → resolvePositions → drawElement    │
│ 3. エッジ描画（既存維持）                                 │
│ 4. 展開（既存維持）                                       │
└────────────────────────────────────────────────────────┘
```

## メイン変更点
- `viewer.js`: テキスト処理関数を追加、children描画関数を追加
- `viewer/server.py`: 変更なし（既存のAPIを維持）
- `viewer/template.html`: 変更なし（既存のインライン描画を維持）
- `viewer/index.html`: 変更なし（既存のUIを維持）

## 設計決定
- **採用**: C案（既存+新childrenのハイブリッド）
- **理由**: 既存システムを壊さず、childrenのあるノードだけ新描画に対応可能
- **リスク低い**: 既存ノードが影響を受けない
- **将来的**: children対応ノードが増えても既存描画に影響なし

## 差異分析

| 項目 | 既存 | 新 | 統合方針 |
|------|------|------|---------|
| ノード配置 | `x,y,width,height` 固定 | `_ax,_ay` 相対→絶対変換 | 既存ノードに`_ax=x`を付与して処理 |
| 描画階層 | フラット | 子要素を再帰描画 | childrenがあるときだけ新描画を採用 |
| テキスト処理 | title+truncate | wrapText+fitFontSize | テキスト描画ルーチンを統合 |

## 必須の違い（統合にはこれらを抑える必要がある）
- 既存 `.canvas` ファイルには `children` 情報なし（フラット）
- ノードは `x,y,width,height,color` のみ
- `toggleExpand()` でボディテキストを描画
