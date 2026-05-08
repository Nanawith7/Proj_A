# Exploration-4 結果：パイプライン処理とJSON出力の検証

## 概要
pipeline.pyのchildren計算ステップとcanvas JSON出力の関係を特定した。

## key discovery: serve-viewerはpipelineを通過しない

### main.pyの分岐

```
main.py (CLI entry point)
├── if args.export_viewer → export_viewer関数
├── if args.serve_viewer → serve()直接呼び出し ← start.batはここ
│   └── serve()はinit_server()を呼び、canvas JSONを直接読み込み
│   └── pipeline.run()を呼ばない！
│
└── else → pipeline.run() ← canvasファイル生成時のみpipelineを呼び
    ├── pipeline.step 6: Layout compute
    └── pipeline.step 7b: Compute children ← もしnode_viewsがあれば実行
```

### start.batとcanvas生成フローの違い

**start.bat (serve-viewer)**:
```
python -m canvas_gen.main --vault X --serve-viewer Y
→ main.py:238-244: serve(vault_path, canvas_file, port)
→ server.py: init_server()
  → CANVAS_DATA = json.load(canvas_file) ← 生のJSONを直接読み込む
→ FILE_NODES = CANVAS_DATA.nodes（_iconを除外）
→ ALL_EDGES = CANVAS_DATA.edges
→ viewerにAPI経由でデータを提供
→ pipeline.run()は完全にスキップ
→ children計算は行われない
```

**canvas生成 (--output)**:
```
python -m canvas_gen.main --vault X --output Y.canvas --node-views
→ main.py: pipeline.run(nodes, vault_index, type_defs, ..., node_views=nv)
→ pipeline.step 7b: nodeViewToChildren → compute_children → pn.children = ch_root.children
→ write_canvas: positioned.nodesをJSONファイルに書き出す
→ children属性がJSONに埋め込まれる（もし--node-viewsがあれば）
```

### 現状のtimeline.canvasの状態

```
全72ノードのchildren属性: 0件（全てnull）
→ start.batは--node-viewsフラグなし
→ server.pyはpipelineを呼ばない（canvas JSONを直接読み込む）
→ viewer.jsは全ノードをPath Bでレンダリング
```

### viewer.js描画フローとchildren関係

```
Path A: usePrecomputed = n.children && length > 0
  → timeline.canvasの全ノードはchildrenなし
  → usePrecomputed = false
  → 全ノードがPath Bに流入

Path B: nodeViewToChildren(nv, v)
  → templateにpropertiesがありvault propsと一致 → children生成
  → childrenがある → Branch 1（appendChildなし＝Bug）→ 描画されない
  → childrenがない → Branch 2（appendChildあり）→ 描画される
```

## pipeline.py step 7bの条件

```python
# pipeline.py:82-96
if node_views:
    for pn in positioned:
        td = type_defs.get(pn.node_type)
        nv_key = td.nodeview if td else ""
        nv = node_views.get(nv_key)
        if nv and 'properties' in nv and nv['properties']:
            ...
```

条件: `if node_views:` — main.pyがnode_views引数を受け取るのは「--node-views」フラグが渡された時のみ。
server.pyはpipelineを完全にスキップするため、この条件は常にfalse。

## children.pyとviewer.jsのnodeViewToChildrenの相違

### server-side (children.py:194-297)
- templateのpropertiesキー全てを処理
- style="pill"以外（text, image等）もchildrenとして生成
- `if prop_def.get('style', '') == 'pill'` → pill処理
- `else` → text/image処理（childrenに追加される）
- 結果: children.length > 0 → 分岐1

### client-side (viewer.js:647-730)
- templateのpropertiesのvalueがvault propsに存在するかを確認
- `if (propDef.style === 'pill' && items.length > 0)` → Pillのみ
- `else if (propDef.style === 'text')` → Textのみ
- else（styleがundefined）→ **childrenを追加しない！**
- 結果: templateにstyle="pill"がないとchildren.length=0

### 影響
server-sideとclient-sideでchildren生成ロジックが異なるが、現状はpipeline step 7bが実行されないため問題はない。ただし、もしpipeline step 7bが実行される場合、serverとclientでchildrenの生成結果が異なる可能性がある。

## 結論

1. **start.batのserve-viewerはpipelineを通過しない**ため、canvas fileのchildrenはそのままAPIに渡される
2. timeline.canvasの全ノードにchildren属性なし → viewer.jsの全ノードがPath Bに流入
3. Path BでnodeViewToChildrenがchildrenを生成 → Branch 1 → **appendChild漏れ** → 描画されない
4. **修正**: viewer.js 284行目に`mainG.appendChild(g);`を追加する
