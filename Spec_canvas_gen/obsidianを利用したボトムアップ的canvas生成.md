---
title: "obsidianを利用したボトムアップ的canvas生成"
description: "A technical specification for dynamically generating Obsidian Canvas files from structured note metadata using bottom-up data extraction, configurable filtering, and deterministic layout algorithms."
author: "Nanawith7"
layout: default
categories: ["Knowledge Management", "Obsidian", "Data Visualization", "System Architecture"]
tags: ["Obsidian", "Canvas", "Dataview", "Markdown", "YAML", "JSON Canvas", "Bottom-up Generation", "Dynamic Filtering"]
research-date: ["2026-04-19"]
---

# obsidianを利用したボトムアップ的canvas生成

## 1. 概要

Obsidian Vault内のMarkdownノートに埋め込まれた構造化メタデータを源泉とし、ユーザーが指定する動的パラメータに基づいてCanvasファイルを都度生成するシステムの技術仕様を示す。ノートは`type`、`tags`、`date`などのプロパティによって分類され、それらの値に応じてCanvas上のノード配置が決定される。生成プロセスは、データ抽出、フィルタリング、ソート、座標計算、JSONシリアライズの順に進行する。ソート順やレイアウトの細部は、別途定義された**type定義ファイル**によって動的に制御され、エッジの表示ラベルと色は**ラベルマッピングファイル**によって置換される。ノードの背景色もtype定義ファイルから一括指定される。

```mermaid
flowchart TD
    subgraph "ユーザー入力"
        U1[起点ノード]
        U2[フィルタ条件<br>filter / exclude]
        U3[ソート条件<br>sort_by]
        U4[X軸キー]
    end
    subgraph "データ抽出"
        D[Dataview API / ファイル読み込み]
    end
    subgraph "フィルタ & ソート"
        F[条件に合致するノードを選別]
        S[指定キーでソート]
    end
    subgraph "座標計算"
        C[X軸キー値からコンテナ生成<br>type定義に基づいて行配置<br>コンテナ幅を内包ノード数で決定<br>キー未指定時はcenteringを適用]
    end
    subgraph "Canvas生成"
        G[ノードとエッジをJSON化]
    end
    U1 & U2 & U3 & U4 --> D --> F --> S --> C --> G --> O[.canvasファイル]
```

## 2. データ層：ノートとメタデータ

### 2.1 ノートのプロパティ定義

各ノートのYAMLフロントマターは、そのノートの**分類（type）**、**表示名（title）**、および他のノートとの関係性情報のみを保持する。レイアウトに関する設定（行分割や水平位置など）は、ノートには一切記述されず、後述のtype定義ファイルに一元化される。これにより、同じtypeに属するノート群は常に同一のレイアウト規則で描画される。

```yaml
---
type: "character"
title: "主人公"
tags:
  - "main"
  - "human"
date: "2026-04-19"
related:
  - "[[Scenario A]]"
  - "[[Organization X]]"
---
```

`type` はCanvasのY軸方向の行を決定する唯一の識別子である。`title` はCanvasノードの表示ラベルとして利用される（省略時はファイル名が用いられる）。その他のプロパティ（`tags`, `date`, `related` など）は、後述のルールに従ってエッジの源泉となる。

### 2.2 X軸コンテナ

ノードが持つ任意のプロパティを`x_axis_key`として指定すると、そのキーの値に基づいてX軸上にコンテナが生成される。スクリプトは、フィルタされた全ノードから指定キーの一意な値を収集する。キー値のソートはまず数値として試行され、数値変換できない値については文字列の辞書順にフォールバックする。これにより、年号など数値を含むキーが自然な昇順で並ぶ。各コンテナのX方向の幅は、そのコンテナに属するtypeの中で最大のノード数（後述のtype定義に含まれる`lining`によるサブ行分割後）によって決定される。コンテナ内部では、ノードは左端から順に配置される。あるコンテナに特定のtypeのノードが存在しない場合、そのtype行の当該コンテナ内は空領域となる。

なお、フィルタされたノードの中に`x_axis_key`の値を持たないノードが存在する場合、それらは全コンテナの右方かつ下方の「未分類領域」にまとめて配置される（グリッドレイアウト）。この領域ではtype行が再構成され、コンテナ軸とは独立した縦並びとなる。

### 2.3 関係性の表現とエッジ生成ルール

ノート間の関係は、以下のルールに従ってCanvas上のエッジに変換される。各エッジには、関係の種類を表す**ラベル**が自動的に付与される。

- **レイアウト予約プロパティの扱い**  
  `type` および `title` はノードの配置・表示にのみ用いられ、関係性を意味しないため、エッジ生成の対象から除外される。将来、個別ノートに対して追加される表示専用プロパティ（例：`color`, `icon`）も同様に予約キーとして扱われる。

- **エッジ抽出とラベル付与**  
  予約プロパティ以外のすべてのYAMLキーの値から、Wikiリンク（`[[ノート名]]`）の形で記述されたリンクを抽出する。  
  - リンク先のノートが**Canvasノード群に含まれている場合に限り**エッジを生成し、**エッジのラベルには抽出元のキー名を設定する**（例：`date` キーから生成されたエッジのラベルは `"date"`）。Canvasノード群は、フィルタ・ソートを通過したノードのみで構成される。これによりCanvasは自己完結し、フィルタ条件から外れた外部ノードへのエッジは一切描画されない。  
  - 同一のキーから同一ターゲットへのリンクが複数ある場合は、一つのエッジにまとめられる（重複除去）。  
  - 異なるキーから同一ターゲットへのリンクは、**別々のエッジ**として扱う。これにより、例えば `related: [[A]]` と `characters: [[A]]` はそれぞれ `"related"` と `"characters"` のラベルを持つ別エッジとして描画される。  
  - リンク先のノートがCanvasノード群に存在しない場合、エッジは一切生成されない（仮想的なノードやプレースホルダは作成されない）。

- **ラベルの外部マッピング**  
  キー名をそのまま表示する代わりに、ユーザー定義の表示用ラベルに置き換えることができる。これは次節（2.4 ラベルマッピングファイル）で指定する。マッピングが存在しないキーについては、キー名がそのままエッジのラベルとして用いられる。

この設計により、`date`や`tags`といったプロパティに含まれる文字列は、同名のノートがCanvasノード群に含まれている場合にのみエッジとして可視化される。たとえば、`date: "2026-04-25"` を持つノートが複数Canvasに描画され、かつ `2026-04-25.md` 自身もCanvasノード群に含まれていれば、それらはラベル `"date"`（またはマッピング後のラベル）のエッジで日付ノートと結ばれる。

```yaml
---
type: "scenario"
title: "はじめての冒険"
characters:
  - "[[主人公]]"
  - "[[賢者]]"
date: "2026-04-19"
tags:
  - "battle"
  - "beginner"
---
```

上記の例では、`characters`に列挙された2つのノートがCanvasノード群に含まれていれば、ラベル `"characters"` のエッジが生成される。`date`や`tags`の値は、対応するノート（`2026-04-19.md`、`battle.md` など）がCanvasノード群に含まれていない限りエッジ化されない。

### 2.4 ラベルマッピングファイル

キー名からエッジ表示用ラベルと色への変換は、**ラベルマッピングファイル**（例：`_config/label_mappings.yml`）によって行われる。各エントリは以下の二形式のいずれかで記述できる。

```yaml
# _config/label_mappings.yml
# 形式A: 文字列のみ（ラベルのみ、色なし）
date: "日付"
tags: "タグ"

# 形式B: ネストdict（ラベル + エッジ色）
related:
  label: "関連"
  color: "#9E9E9E"
ally:
  label: "味方"
  color: "#4CAF50"
rival:
  label: "敵対"
  color: "#F44336"
```

`color` にはCSS互換の16進数カラーコード（例：`"#F44336"`）またはJSON Canvas仕様のプリセット番号（`"1"` 〜 `"6"`）を指定できる。省略時はエッジに色が付与されない。

マッピングに存在しないキーに対しては、キー名自体がラベルとして用いられる（色なし）。この仕組みにより、ユーザーはエッジのラベルをローカライズしつつ、関係種別ごとに色分けすることが可能となる。

### 2.5 type定義ファイル

Canvas上のレイアウト規則（サブ行分割、センタリングなど）は、ノート自身ではなく、**type定義ファイル**によって動的に与えられる。このファイルはVault内の特定の場所（デフォルト：`_types/type_definitions.yml`）に配置され、各type名をキーとして、そのtypeに属する全ノートに適用される描画パラメータを保持する。

`lining` はそのtypeに割り当てられる**横列（サブ行）の数**を指定する。ノードは column-major 方式で各サブ行に振り分けられる。すなわち、全ノードをソート順に並べたとき、1番目はサブ行0、2番目はサブ行1、…、L番目はサブ行 L-1、L+1番目は再びサブ行0、という具合に巡回配置される。

`color` はそのtypeに属する全ノードの背景色を指定する。CSS互換の16進数カラーコード（`"#2196F3"`）またはJSON Canvas仕様のプリセット番号（`"1"` 〜 `"6"`）で指定する。

```yaml
# _types/type_definitions.yml
character:
  lining: 3
  centering: true
  color: "#2196F3"
scenario:
  lining: 1
  centering: false
  color: "#FF9800"
event:
  lining: 2
  color: "#E91E63"
  # centering未指定はfalse
```

定義されていないtypeが出現した場合、`lining: 1`, `centering: false`, `color: ""` のデフォルト値が適用される。この機構により、新たなtypeの追加時にも、type定義ファイルにエントリを追加するだけでレイアウトと配色が制御され、ノート側の修正は一切不要である。

## 3. データ抽出層

### 3.1 Dataviewクエリによる動的抽出

DataviewプラグインのAPIを用いて、起点ノードを中心とした関連ノート群を抽出する。抽出後のノードリストに対して、ユーザー指定の `filter` および `exclude` 条件が適用される。

```dataview
TABLE date, type, tags
FROM "path/to/vault"
WHERE contains(type, "scenario")
SORT date ASC
```

具体的なフィルタパイプラインは、パラメータ駆動型生成（4.3節）で定義される。

### 3.2 外部スクリプトによるファイル直接解析

Obsidian外部のスクリプト（Python、Node.js）を用いる場合、Vault内のMarkdownファイルを直接走査し、YAMLフロントマターとリンクを解析する。この手法はDataview APIへの依存を排除し、より複雑な座標計算やバッチ処理を可能にする。

## 4. Canvas生成層

### 4.1 レイアウトアルゴリズム

ノードの座標は以下の決定論的ルールに従って計算される。座標系は、**Y軸が垂直方向（type行の縦並び）、X軸が水平方向（コンテナの横並びとコンテナ内でのノードの位置）** として定義される。

ノードのtypeに応じた `lining` および `centering` の値は、type定義ファイル（2.5節）から取得される。あるtypeが定義ファイルに存在しない場合は、デフォルト値（`lining: 1`, `centering: false`）が用いられる。

`x_axis_key`が指定されていない場合、ノードは単一のグリッドに配置され、type定義の`centering`に従って水平方向のセンタリングが行われる。`x_axis_key`が指定された場合、レイアウトは以下の層で決定される。
1.  **コンテナの生成**: 全ノードから`x_axis_key`の一意な値を収集し、数値優先の昇順ソートで順序を確定する。この順序に従い、X軸上に各コンテナの始点を設定する。
2.  **コンテナ幅の決定**: 各コンテナの最終的な幅は、そのコンテナに属する全typeの中で最大の「サブ行あたりノード数」（= `ceil(そのtypeのノード数 / lining)`）によって決定される。コンテナ内に1つもノードを持たないtype行は幅の計算から除外される。
3.  **ノードの配置**: ノードは column-major 方式でサブ行に振り分けられる。すなわち `lining=3` の場合、ソート順1番目→サブ行0、2番目→サブ行1、3番目→サブ行2、4番目→サブ行0 …という巡回配置となる。各サブ行内では左端から順に等間隔で配置される。typeのY方向の占有高さは `lining × row_height` で固定される。

`x_axis_key`が指定されている場合、各コンテナの幅がデータ駆動で決定されるため、type定義の`centering`は無視される（コンテナ内では常に左詰め）。

- **X座標**: 各コンテナの始点X座標に、ノードのコンテナ内インデックスと`column_width`を乗じた値を加えたもの。コンテナの始点は、その前方にある全コンテナの幅の合計で決定される。

- **Y座標（type行の位置）**: 各ノードの`type`に基づき割り当てられる行のインデックスに`row_height`を乗じたもの。type定義の`lining`の値がそのままサブ行数となり、ノードは column-major で各サブ行に巡回配置される。typeのY方向占有高さは `lining × row_height` で固定され、ノード数に依存しない。

- **未分類領域**: `x_axis_key`の値を持たないノードはコンテナに属さないため、全コンテナの右方かつ下方に別途グリッド配置される（2.2節参照）。この領域では独自にtype行が構成され、コンテナ行とのY座標重複は生じない。

- **エッジ**: 2.3節のルールに従い、予約プロパティを除くすべてのYAMLキーの値から抽出されたWikiリンクに基づいて、ラベル付きで生成される。同一キー内の重複は除去され、異なるキーからのリンクは別エッジとして保持される。ラベルはラベルマッピングファイル（2.4節）で変換される。

#### 配置の視覚的イメージ

`year`を`x_axis_key`として、以下のノード群を配置した結果を示す。

- **2024年**: 2024, EVENT-A, STORY-1, STORY-2, STORY-3 を内包する。STORYのノード数3が最大のため、この年のコンテナ幅は3となる。
- **2025年**: 2025, EVENT-B, EVENT-C, STORY-4, STORY-5, STORY-6 を内包する。STORYのノード数3が最大のため、この年のコンテナ幅は3となる。
- **2026年**: 2026, EVENT-D, EVENT-E, STORY-7 を内包する。EVENTのノード数2が最大のため、この年のコンテナ幅は2となる。
- **2027年**: 2027, STORY-8, STORY-9 を内包する。STORYのノード数2が最大のため、この年のコンテナ幅は2となる。

```
YEAR-ROW  | 2024   | (空)   | (空)   || 2025   | (空)   | (空)   || 2026   | (空)   || 2027   | (空)   |
EVENT-ROW | A      | (空)   | (空)   || B      | C      | (空)   || D      | E      || (空)   | (空)   |
STORY-ROW | 1      | 2      | 3      || 4      | 5      | 6      || 7      | (空)   || 8      | 9      |
```

全typeのノードが同一の時間軸に沿って整列し、一部のtypeでデータが存在しないコンテナ内は空領域となる。コンテナの幅は内包する最大ノード数に応じて変化し、情報密度の高い年ほど広いスペースが割り当てられる。type定義で`lining`が指定されたtype行では、各コンテナ内でさらに細分化されたサブ行にノードが配置される。

`x_axis_key`の値を持たないノード（例：長期間にわたって存在するキャラクターや組織）は、全コンテナの右方かつ下方に未分類領域として配置される。この領域内ではtype行が再構成され、コンテナとは独立した縦並びとなるため、コンテナ内type行とのY座標の衝突は発生しない。

### 4.2 JSON Canvas仕様への変換

生成されたノードリストとエッジリストは、JSON Canvas仕様（バージョン1.0）に準拠したオブジェクトに変換され、`.canvas`拡張子を持つファイルとして出力される。ノードにはtype定義から取得した`color`が、エッジにはラベルマッピングから取得した`label`および`color`が付与される。

```json
{
  "nodes": [
    {
      "id": "node1",
      "type": "file",
      "file": "character/主人公.md",
      "x": 0,
      "y": 0,
      "width": 300,
      "height": 200,
      "color": "#2196F3"
    },
    {
      "id": "node2",
      "type": "file",
      "file": "character/賢者.md",
      "x": 0,
      "y": 250,
      "width": 300,
      "height": 200,
      "color": "#2196F3"
    }
  ],
  "edges": [
    {
      "id": "edge1",
      "fromNode": "node1",
      "toNode": "node2",
      "label": "師弟",
      "color": "#FF9800"
    }
  ]
}
```

### 4.3 パラメータ駆動型生成

生成スクリプトは以下のパラメータを実行時引数または設定ファイルから受け取る。すべてのパラメータは任意であり、省略時はデフォルト動作となる。type定義ファイルおよびラベルマッピングファイルのパスも指定可能だが、固定のデフォルトパスが存在することを前提とする。

| パラメータ | 型 | 説明 |
|:---|:---|:---|
| `base_node` | string | 起点となるノートのファイル名またはパス。 |
| `filter` | dict | ノードがCanvasに含まれるために**満たすべき**条件（例: `{"type": "character", "tags": "main"}`）。AND評価。 |
| `exclude` | dict | ノードを除外する条件（例: `{"title": "draft"}`）。AND評価。 |
| `sort_by` | string or list of dict | ソートキー。単一文字列（例: `"date"`）または `[{"key": "date", "order": "asc"}]`。 |
| `depth` | integer | 起点ノードからのリンク探索深度。 |
| `x_axis_key` | string | X軸コンテナを生成するプロパティ名。 |
| `type_def_path` | string（省略可） | type定義ファイルのパス。デフォルト: `_types/type_definitions.yml`。 |
| `label_mapping_path` | string（省略可） | ラベルマッピングファイルのパス。デフォルト: `_config/label_mappings.yml`。 |
| `column_width` | integer | ノード間のX方向間隔（ピクセル相当）。 |
| `row_height` | integer | 行間のY方向間隔。 |

`filter`と`exclude`の両方が指定された場合、まず`filter`条件で候補を絞り込み、その結果に対して`exclude`条件で不要なノードを除去する。

## 5. 拡張性と保守性

### 5.1 動的type行追加

新しい`type`値が出現すると、生成スクリプトはそのtypeに対応する行を自動的に割り当てる。type定義ファイルに対応するエントリが存在しない場合は、デフォルトレイアウト（`lining: 1`, `centering: false`）が即座に適用される。

### 5.2 動的lining調整

同一typeに属するノードのサブ行分割数は、type定義ファイルの`lining`値によって一括制御される。値を変更しスクリプトを再実行するだけで、すべての該当ノードの配置が更新される。ノート自身の修正は一切不要である。

### 5.3 Centering制御

水平方向のセンタリングもtype定義ファイルの`centering`フラグによってtype単位で指定される。`x_axis_key`未指定時に有効となり、グリッド全体の最大列幅に対して中央に配置される。`lining`によるサブ行分割時も、各サブ行内でセンタリングが正しく適用される。

### 5.4 データ駆動のコンテナ

`x_axis_key`が指定された場合、X軸上の区切りとその幅はデータによってのみ決定される。特定のコンテナ内のノード数に応じてコンテナ幅が変化するため、情報の密度に応じた視覚的なスペース配分が自動的に行われる。

### 5.5 データと表現の分離

ノートの内容およびメタデータは、Canvasの視覚的表現から完全に独立している。同一のデータセットに対して、異なるtype定義ファイル、フィルタ条件、ソート条件、X軸分割を適用した複数のCanvasビューを生成できる。エッジのラベルもマッピングファイルによって外部から自由に置換可能である。Canvasはフィルタされたノード群の内部でのみエッジを張るため、表示範囲の異なる複数のCanvasを独立して生成・管理でき、一つのCanvasが別のCanvasの内容に依存することはない。

### 5.6 バージョン管理親和性

ノート（Markdown）、type定義ファイル（YAML）、ラベルマッピングファイル（YAML）、生成スクリプトはいずれもテキストベースであり、Git等のバージョン管理で完全に追跡可能である。Canvasファイルは生成物として扱い、リポジトリから除外できる。

### 5.7 配色の外部制御

ノードの背景色はtype定義ファイルの `color` フィールドでtype単位に一括指定される。同一typeの全ノードが同一色で描画されるため、Canvas上でのtype識別が直感的になる。エッジの色はラベルマッピングファイルの `color` フィールドで関係種別ごとに指定され、たとえば「味方」を緑、「敵対」を赤、というように関係の性質を色で表現できる。いずれも16進数カラーコードまたはプリセット番号で指定し、ノート側の修正は一切不要である。

## 6. 実装例

以下はPythonによる生成スクリプトの擬似コードである。type定義の読み込み、ラベルマッピングの適用、キー別のエッジ管理が中心となる。

```python
def generate_canvas(base_node, filter, exclude, sort_by, depth, x_axis_key,
                    type_def_path, label_mapping_path, column_width, row_height):
    # 1. 設定ファイルの読み込み
    type_defs = load_yaml(type_def_path) if type_def_path else {}
    label_map = load_yaml(label_mapping_path) if label_mapping_path else {}
    
    # 2. ノード抽出とフィルタ
    nodes = extract_nodes(base_node, depth)
    if filter:
        nodes = [n for n in nodes if all(n.props.get(k) == v for k, v in filter.items())]
    if exclude:
        nodes = [n for n in nodes if not all(n.props.get(k) == v for k, v in exclude.items())]
    
    # 3. ソート
    if sort_by:
        if isinstance(sort_by, str):
            nodes = sort_nodes_single_key(nodes, sort_by)
        else:
            nodes = sort_nodes_multi_key(nodes, sort_by)
    
    # 4. エッジ生成（canvas内ノード間のみ、キー別、ラベル+色付き）
    reserved_keys = {"type", "title"}
    canvas_stems = {n.id for n in nodes}
    edge_dict = {}
    for node in nodes:
        for key, value in node.metadata.items():
            if key in reserved_keys:
                continue
            links = extract_wikilinks(value)
            for target in links:
                if target not in canvas_stems:
                    continue
                edge_key = (node.id, target, key)
                if edge_key not in edge_dict:
                    info = label_map.get(key, {})
                    edge_dict[edge_key] = {
                        "from": node.id,
                        "to": target,
                        "label": info.get("label", key),
                        "color": info.get("color", ""),
                    }
    edges = list(edge_dict.values())
    
    # 5. レイアウト計算 (type定義を参照, column-major分配, 色付与)
    def get_lining(node_type):
        return type_defs.get(node_type, {}).get("lining", 1)
    def get_color(node_type):
        return type_defs.get(node_type, {}).get("color", "")
    def get_centering(node_type):
        return type_defs.get(node_type, {}).get("centering", False)
    
    if x_axis_key:
        containers = build_containers(nodes, x_axis_key, get_lining)
        # Yオフセット: typeのlining値で固定高さを割当て
        type_y = assign_y_offsets_by_lining(node_types, row_height, get_lining)
        all_canvas_nodes = []
        for container in containers:
            for type_name, type_nodes in container.nodes_by_type.items():
                lining = get_lining(type_name)
                y_base = type_y[type_name]
                for sub_row in range(lining):
                    # column-major: サブ行に等間隔でノードを巡回配置
                    sub_nodes = type_nodes[sub_row::lining]
                    sub_y = y_base + sub_row * row_height
                    node_x = container.start_x
                    node_color = get_color(type_name)
                    for node in sub_nodes:
                        node.x = node_x
                        node.y = sub_y
                        node.color = node_color
                        node_x += column_width
                        all_canvas_nodes.append(node)
    else:
        all_canvas_nodes = []
        type_y = assign_y_offsets_by_lining(node_types, row_height, get_lining)
        for type_name, type_nodes in nodes_by_type.items():
            lining = get_lining(type_name)
            y_base = type_y[type_name]
            max_cols = math.ceil(len(type_nodes) / lining)
            node_color = get_color(type_name)
            for sub_row in range(lining):
                sub_nodes = type_nodes[sub_row::lining]
                if not sub_nodes:
                    continue
                sub_y = y_base + sub_row * row_height
                if get_centering(type_name):
                    x_pos = (max_cols - len(sub_nodes)) * column_width / 2
                else:
                    x_pos = 0
                for node in sub_nodes:
                    node.x = x_pos
                    node.y = sub_y
                    node.color = node_color
                    x_pos += column_width
                    all_canvas_nodes.append(node)
    
    # 6. JSON出力
    canvas_json = build_canvas_json(all_canvas_nodes, edges)
    write_file("output.canvas", canvas_json)
```

## 7. 結論

本システムは、Obsidian Vaultのノートに記述された構造化メタデータを源泉とし、type定義ファイルによる統一的なレイアウト制御と配色、柔軟なフィルタ・ソート機構、さらにラベルマッピングによるエッジの意味的明示と色分けを組み合わせることで、データの一貫性と表現の自由度を極限まで高めている。エッジはCanvasノード群の内部でのみ生成されるため、各Canvasは自己完結したビューとなる。ノートは純粋なデータと関係性のみを保持し、それらがどう視覚化されるかは外部の定義ファイルと動的パラメータに委ねられる。このアーキテクチャにより、複雑な知識ネットワークをあらゆる角度から直感的に俯瞰できるCanvasが、メンテナンス負荷なしに実現される。