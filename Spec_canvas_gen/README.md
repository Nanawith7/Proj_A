# Canvas Generator - Bottom-Up Obsidian Canvas Generation

Vault内のMarkdownノートのメタデータを源泉とし、フィルタ・ソート・レイアウトを経てJSON Canvasファイルを動的生成するPythonツール。

## Quick Start

```bash
# 全ノートを年表形式で出力（childrenなし）
python -m canvas_gen.main --vault ./my_vault --output timeline.canvas --x-axis-key year --sort-by year

# 全ノートをchildren付きで出力
python -m canvas_gen.main --vault ./my_vault --output timeline.canvas --x-axis-key year --sort-by year --node-views

# キャラクターのみ抽出
python -m canvas_gen.main --vault ./my_vault --output chars.canvas --filter type=character --sort-by title

# 特定ノードからのBFS + 除外 + 孤立剪定
python -m canvas_gen.main --vault ./my_vault --output out.canvas \
    --base-node 魔王 --depth 2 --x-axis-key year \
    --exclude tags=human --prune-orphans type=tag
```

## Vault構成

```
vault/
├── _types/type_definitions.yml   # type別レイアウト・色・サイズ
├── _config/label_mappings.yml    # エッジラベル・色の変換
├── _icons/                       # 自動生成アイコン (PNG)
├── character/  (.md)
├── scenario/   (.md)
├── event/      (.md)
├── organization/(.md)
├── tag/        (.md)
├── era/        (.md)
└── *.canvas                       # 生成物
```

## 設定ファイル

### type_definitions.yml
```yaml
character:
  lining: 3          # サブ行数 (column-major分配)
  centering: true    # グリッド内センタリング
  color: "#2196F3"   # ノード背景色
  node_width: 160    # ノード幅
  node_height: 120   # ノード高さ
```

### label_mappings.yml
```yaml
ally:
  label: "味方"
  color: "#4CAF50"   # エッジ色
rival:
  label: "敵対"
  color: "#F44336"
# 文字列のみも可:  tags: "タグ"
```

## ノートのfrontmatter

```yaml
---
type: character
title: 主人公
icon: "_icons/hero.png"      # アイコン画像パス
icon_size: "80x60"           # アイコン表示寸法 (WxH)
tags:
  - "[[main]]"               # wikiリンク→エッジ化
  - "[[human]]"
ally:
  - "[[騎士団長]]"
related:
  - "[[冒険の始まり]]"
year: 100                     # 年表X軸
era: "era_080_120"           # 時代区分子測
---
```

## CLI パラメータ

| フラグ | 説明 |
|---|---|
| `--vault` | Vaultルートディレクトリ (必須) |
| `--output` | 出力 `.canvas` パス |
| `--base-node` | BFS起点ノード名 |
| `--depth` | BFS探索深度 |
| `--filter` | フィルタ条件 (key=value or JSON) |
| `--exclude` | 除外条件 |
| `--sort-by` | ソートキー |
| `--x-axis-key` | X軸コンテナのプロパティ名 |
| `--column-width` | 列間隔 (default: 350) |
| `--row-height` | 行間隔 (default: 250) |
| `--icon-size` | アイコン寸法 (0で無効, default: 50) |
| `--icon-gap` | アイコン-ノード間隔 (default: 4) |
| `--include-types` | 常時描画するノード条件（剪定保護） |
| `--prune-orphans` | 孤立ノード剪定 (type指定可) |
| `--node-width` | デフォルトノード幅 (default: 300) |
| `--node-height` | デフォルトノード高 (default: 200) |
| `--node-views` | childrenレイアウトを有効化（nodeviewテンプレートを適用） |

**フィルタ構文**:
```bash
--filter type=character|tag          # OR (|)
--filter type=character,tags=main    # AND (,)
--exclude tags=human                 # wiki-link正規化マッチ
--filter '{"$or":[{"type":"event"},{"tags":"main"}]}'  # クロスキーOR
```

## モジュール構成

```
canvas_gen/
├── main.py         # CLIエントリポイント
├── pipeline.py     # 7ステップ統括（include→sort→layout→icons→edges→prune→write）
├── models.py       # データクラス
├── config.py       # YAML設定読込
├── extractor.py    # Vault走査・YAML解析・双方向BFS
├── filter_sort.py  # フィルタ/ソート/include（$or/|/wiki-link正規化）
├── edges.py        # エッジ生成・孤立剪定
├── layout.py       # レイアウト計算・パラメータ自動算定
├── children.py     # children配置計算（server-side）
├── writer.py       # JSON Canvas出力
└── icons.py        # アイコン画像生成・per-node解決
```

## レイアウトアルゴリズム

- **column-major分配**: `lining=N` → N行に巡回配置 (0,N,2N... / 1,N+1... / ...)
- **コンテナ**: `x_axis_key`値でX軸分割。数値優先ソート。`era`で時代別年表も可能
- **未分類領域**: x_axis_key値なしのノードをコンテナ下方に配置
- **グローバルセンタリング**: 全type行が共通の最大列幅内で独立センタリング
- **相互センタリング**: コンテナと未分類領域が共通中心軸を共有
- **自動スケーリング**: 最大icon/node寸法からrow_height/column_widthを計算
- **双方向BFS**: outgoing + incoming wikiリンクを両方向追跡
- **構造ノード**: `--include-types` で常時描画ノード指定・剪定保護

## パイプライン処理順

1. include-types（条件指定ノードの強制追加）
2. filter → exclude → sort
3. layout params計算（icon/nodeサイズからrow/col自動算定）
4. per-node icon解決
5. edge生成（canvas内ノード間のみ）
6. prune-orphans（孤立ノード剪定、include-types保護）
7. layout計算・JSON出力
7b. children-calculate（nodeviewテンプレート→children配列変換 + 配置計算）

## テストVault

`Obsidian_test/vault/` に57ノートのテスト用Vaultあり:
- 11 characters, 13 scenarios, 13 events, 15 tags, 3 eras, 2 organizations
- 複数Canvasファイル: timeline, era_timeline, characters, characters_tags, devil_timeline 等

```bash
cd Obsidian_test && run_canvas.bat
```

## Childrenレイアウトシステム

`--node-views` フラグを指定すると、各ノードの `nodeview` テンプレートに従って `children` が計算され、Canvas JSONに埋め込まれる。

### 動作フロー
1. **type → nodeview マッピング**: `_types/type_definitions.yml` の `nodeview` キーで紐付け
2. **properties → children変換**: `nodeViewToChildren()` がテンプレートの `properties` を children配列に変換
3. **配置計算**: `compute_children()` が2パスのレイアウト計算（内側children → 親サイズ算出 → 外側children）
4. **シリアライズ**: `_serialize_children()` が内部キーを除去してJSON出力

### Canvas JSON Format
```json
{
  "id": "protagonist",
  "x": 0, "y": 0, "width": 160, "height": 120,
  "children": [
    {"label": "tags", "text": "...", "ax": 10, "ay": 8, "cw": 160, "ch": 22},
    {"label": "ally", "text": "...", "ax": 10, "ay": 30, "cw": 157, "ch": 22}
  ]
}
```

### ブラウザ描画
`viewer.js` は2つの描画パスを持つ：
- **Path A（pre-computed）**: `n.children` を直接使用
- **Path B（fallback）**: `nodeViewToChildren()` → `computeChildrenLayout()` で動的計算
