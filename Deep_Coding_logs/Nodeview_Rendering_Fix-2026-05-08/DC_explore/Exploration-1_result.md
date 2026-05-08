# Exploration-1 結果：サーバー起動フローの追跡

## 概要
start.bat → viewerサーバー起動 → http://127.0.0.1:8765/ 描画までの完全なパスを特定した。

## 起動フロー

### 1. start.bat
```
viewer_env/start.bat
├── VAULT=..\Obsidian_test\vault
├── CANVAS=..\Obsidian_test\vault\timeline.canvas
├── PORT=8765
└── python -m canvas_gen.main --vault "%VAULT%" --serve-viewer "%CANVAS%:%PORT%"
```

### 2. server.py 初期化
```
canvas_gen/viewer/server.py:29-62 (init_server函数)
├── CANVAS_DATA = JSONファイル読み込み (line 36-37)
├── FILE_NODES = _icon なしノードのみ抽出 (line 41-42)
├── ALL_EDGES = 全エッジ取得 (line 43-44)
└── VAULT_CONTENT = vault/*.md ファイル解析 (line 47-61)
```

### 3. エンドポイント定義
```
canvas_gen/viewer/server.py:261-288 (do_GET方法)
├── GET / → index.html (266行目)
├── GET /viewer.css → viewer.css (267行目)
├── GET /viewer.js → viewer.js (268行目)
├── GET /api/data → {nodes, edges, vault} (270-275行目)
├── GET /api/typedefs → 型定義YAML (280-281行目)
├── GET /api/nodeview/* → nodeview JSON (282-284行目)
└── GET /api/icon → アイコン画像 (276-279行目)

POSTエンドポイント
├── POST /api/filter → フィルター結果 {nodes, edges} (292-297行目)
```

### 4. クライアント描画ロジック
```
canvas_gen/viewer/viewer.js:68-81 (init函数)
├── フォーク処理
│   ├── /api/data → ALL_NODES, ALL_EDGES, VAULT
│   └── /api/typedefs → TYPEDEFS
├── loadNodeViews() → NODEVIEWS（型定義からテンプレート読み込み）
├── currentNodes = ALL_NODES, currentEdges = ALL_EDGES
├── render() 描画呼び出し
└── addRow('filter-rows') フィルターUI初期化

描画関数：render() (98-200行目)
├── SVG作成
├── エッジ描画
└── ノード描画（currentNodes.forEach）
```

## viewer.js 描画ロジック概要

```
render() 内のノード描画 (124-348行目)
├── 各ノードに対して：
│   ├── type = VAULT[stem].props.type または 'default'
│   ├── td = TYPEDEFS[type]
│   ├── nvName = td.nodeview || 'plain'
│   ├── nv = NODEVIEWS[nvName] || {shape:'rect', rx:4}
│   ├── g = <g>要素作成
│   ├── usePrecomputed = n.children && length > 0
│   │
│   ├── Path A: usePrecomputed === true (136-193行目)
│   │   ├── parent rect描画
│   │   ├── title描画
│   │   ├── children描画（expandedの場合）
│   │   └── mainG.appendChild(g) ← あり
│   │
│   └── Path B: usePrecomputed === false (194-346行目)
│       ├── children = nodeViewToChildren(nv, v)
│       │
│       ├── 分岐1: children && children.children.length > 0 (199-285行目)
│       │   ├── parent rect描画
│       │   ├── title描画
│       │   ├── icon描画
│       │   ├── children描画（expandedの場合）
│       │   ├── rendered = true
│       │   └── mainG.appendChild(g) ← **なし** ← Bug!
│       │
│       └── 分岐2: !rendered (287-346行目)
│           ├── parent rect描画
│           ├── title描画
│           ├── icon描画
│           └── mainG.appendChild(g) ← あり
```

## 重要ファイル一覧

| パス | 役割 |
|------|------|
| `viewer_env/start.bat` | 起動スクリプト |
| `canvas_gen/viewer/server.py` | HTTPサーバー実装 |
| `canvas_gen/viewer/viewer.js` | クライアント描画ロジック |
| `canvas_gen/viewer/index.html` | フロントエンドHTML |
| `canvas_gen/viewer/viewer.css` | スタイルシート |
| `canvas_gen/main.py` | CLIエントリーポイント |
| `canvas_gen/pipeline.py` | パイプライン処理 |
| `canvas_gen/children.py` | children計算処理 |
| `Obsidian_test/vault/timeline.canvas` | テスト用Canvasファイル |

## ノード描画条件

Path Bで分岐する条件：
- `nodeViewToChildren(nv, v)` の戻り値
  - templateに`properties`キーなし → null
  - vault propsにtemplateのpropertiesキーが一つも一致しない → null
  - vault propsにtemplateのproperties keyが存在し、かつ`style:"pill"`がある → children有

## APIレスポンス例 /api/data
```json
{
  "nodes": [
    {"id": "era_080_120", "type": "file", "file": "era/era_080_120.md", 
     "x": 0, "y": 0, "width": 220, "height": 100, "color": "#9C27B0"},
    ...
  ],
  "edges": [...],
  "vault": {
    "era_080_120": {"file": "era/era_080_120.md", 
                    "props": {"type": "era", "title": "80-120年代", ...},
                    "body": "# 80-120年代\n..."}
  }
}
```

## 補足

全ノードの `type` は `"file"`（canvasファイル側）。ノードの実際の型はVAULT[stem].props.typeから取得。
全ノードに `children` 属性なし → 全ノードがPath Bに入ることになる。
