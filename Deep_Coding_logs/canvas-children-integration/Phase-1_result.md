# Phase 1 Result: 既存ビューアレンダリング解析

## 既存システム構造

```
既存ビューア起動フロー:
1. python -m canvas_gen.main --vault X --serve-viewer Y
2. viewer/server.py: canvas JSON読み込み → vault .mdスキャン → typedefs読み込み
3. ブラウザで index.html を開く
4. viewer.js init(): /api/data → /api/typedefs → /api/nodeview/{name}.json
5. renderGraph(): エッジ描画 → ノード描画 (rect + title + icon)
6. toggleExpand(): ボディテキスト/ピル描画
```

## 既存 `.canvas` ファイル構造（フラット）
- 各ノード: `x, y, width, height, color` のみ
- タイトル: `vault[stem].props.title` から取得
- 描画: `template.html` / `viewer.js` で直接実行

## 既存 NodeView テンプレート構造（プロパティベース）
- `properties`: フロントマターキー → ピル/テキスト変換定義（座標付きまたはフロー）
- `layout`: パディング、最小サイズ、アイコンアンカー
- `background`: 背景画像名（_viewbg/配下）

## テンプレート一覧
| テンプレート | 形状 | 特徴 |
|-------------|------|------|
| character_card.json | rect | 8プロパティ、position付きpill |
| event_card.json | rect | 3プロパティ、flow配置 |
| scenario_card.json | rect | 3プロパティ、flow配置 |
| era_circle.json | circle | iconAnchor設定、expandMin |
| tag_bubble.json | round | プロパティなし |
| bmp_test.json | circle | %位置指定、opaque |
| plain.json | rect | 最小限 |

## 差異リスト
1. 既存 `.canvas` には `children` 情報なし（フラット）
2. 描画ロジックが `template.html` にインライン埋め込み
3. 相対配置の未実装（`resolvePos()` は絶対値しか処理しない）
4. `toggleExpand()` がDOM操作を直接行っている
