# Exploration-5 結果：フィルター動作の検証

## 概要
フィルターから描画までのフロー、およびフィルター適用後の描画結果がchildren属性の影響を受けないことを確認した。

## 検証結果

### タスク1：viewer.jsのフィルターUIとAPI呼び出しコードの解析 [完了]

```
viewer.js:977 (apply関数)
async function apply() {
  params = {
    filter: buildFilterStr('filter-rows'),
    exclude: buildFilterStr('exclude-rows'),
    include: document.getElementById('include-types').value,
    sortKey: document.getElementById('sort-key').value,
    sortDesc: document.getElementById('sort-desc').checked,
    prune: document.getElementById('prune-orphans').checked,
    baseNode: document.getElementById('base-node').value,
    depth: document.getElementById('depth').value
  };
  const res = await fetch('/api/filter', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify(params)
  });
  const data = await res.json();
  currentNodes = data.nodes;
  currentEdges = data.edges;
  render();  // ← フィルター適用後に再描画
}

viewer.js:978 (reset関数)
function reset() {
  // フォーム初期化
  currentNodes = ALL_NODES;
  currentEdges = ALL_EDGES;
  render();  // ← 初期描画
}
```

### タスク2：apply()関数から描画までのフロー確認 [完了]

```
userがApplyボタンクリック
→ apply()実行
→ /api/filterにPOST
→ server.py:run_filter(params) ← サーバーサイドでフィルター適用
→ {nodes, edges} を返す
→ currentNodes = data.nodes, currentEdges = data.edges ← グローバル変数に代入
→ render() ← 全ノードを再描画
```

### タスク3：currentNodes/currentEdgesの更新タイミングと描画の接続確認 [完了]

```
render() 関数（98-200行目）
├── currentNodes.forEach(n => { ... })
│   ├── Path A/Bの分岐
│   ├── g.appendChild(...) ← Path AとPath B分岐2
│   └── mainG.appendChild(g) ← Path Aのみ（Bug: 分岐1は漏れ）
└── mainG.appendChild(g) ← Path A

currentNodesの各要素はserver.pyから返されたJSONノード。
server.py:FILE_NODEは_ icon なノードのみ抽出される。

フィルター適用前後でcurrentNodesのcontentは変わらない（same objects）。
children属性の有無はフィルターの結果に影響されない。
```

### タスク4：フィルター適用前のノードと適用後のノードのchildren属性変化確認 [完了]

```
timeline.canvasのノード数: 72
characterノード数: 11
eventノード数: 13

フィルター適用前の全ノード: children属性なし（全ノードPath Bに流入）
フィルター適用後: server-sideでフィルター実行されるが、children属性は変わらない

→ フィルター適用前後で描画ロジックは同じパスを踏む
→ フィルターによる描画不全とは無関係
```

### タスク5：サーバーサイドフィルターロジックの確認 [完了]

```
server.py:131-211 (run_filter関数)
├── nodes = list(FILE_NODES) ← shallow copy
├── edges = list(ALL_EDGES) ← shallow copy
├── filter/exclude条件を適用
├── nodes = _apply_filter(nodes, filter_cond)
├── nodes = _apply_exclude(nodes, exclude_cond)
├── nodes = _apply_sort(nodes, sort_key, sort_desc)
├── edges = [e for e in edges if e['fromNode'] in remaining and e['toNode'] in remaining]
└── return {'nodes': nodes, 'edges': edges}

server-sideではnodesのchildren属性は一切処理されない。
client-sideでfilter→render()→Path A/Bの分岐。
```

## 結論

1. **フィルターはサーバーサイドで実行され、client-sideのrender()で再描画される**
2. **フィルター適用前後でノードのchildren属性は不変**
3. **描画不全はフィルターの結果ではなく、Path BのBranch 1にappendChild漏れがあるため**
4. **修正箇所**: viewer.js 284行目に`mainG.appendChild(g);`を追加する必要がある

## 補足：既存のappend位置

```
// Path A: 193行目
mainG.appendChild(g);  // ← 正しい

// Path B 分岐1: 284行目
rendered = true;
// mainG.appendChild(g) ← ここに追加すべき！

// Path B 分岐2: 345行目
mainG.appendChild(g);  // ← 正しい
```
