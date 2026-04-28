---
title: "Canvas Viewer 技術仕様"
description: "Technical specification for the interactive HTML viewer that renders Obsidian Canvas files via a Python HTTP server with SVG graph display, filter GUI, and customizable node views."
author: "Nanawith7"
layout: default
categories: ["Knowledge Management", "Obsidian", "Data Visualization", "System Architecture"]
tags: ["Obsidian", "Canvas", "JSON Canvas", "SVG", "HTTP Server", "Interactive Viewer", "Dynamic Filtering"]
research-date: ["2026-04-28"]
---

# Canvas Viewer 技術仕様

## 1. 概要

Canvas Generatorで生成された `.canvas` ファイルをブラウザ上でインタラクティブに表示するHTTPサーバーベースのビューアーシステムの技術仕様を示す。Pythonのstdlibのみで動作するHTTPサーバーがVaultデータとCanvas JSONを読み込み、軽量なHTML/CSS/JSフロントエンドにAPI経由でデータを提供する。フロントエンドはSVGによるグラフ描画、クリック展開、フィルタGUIを備える。

```mermaid
flowchart TD
    subgraph "サーバー (Python stdlib)"
        S1[Vault .md 走査]
        S2[Canvas JSON 読込]
        S3[フィルタエンジン]
    end
    subgraph "API"
        A1[GET /api/data]
        A2[POST /api/filter]
        A3[GET /api/typedefs]
        A4[GET /api/nodeview/]
    end
    subgraph "フロントエンド (SVG + JS)"
        F1[SVGグラフ描画]
        F2[クリック展開]
        F3[フィルタGUI]
        F4[nodeviewテンプレート]
    end
    S1 & S2 --> A1
    S3 --> A2
    A1 & A2 & A3 & A4 --> F1 & F2 & F3 & F4
    F1 --> O[ブラウザ表示]
```

## 2. アーキテクチャ

### 2.1 サーバー/クライアント分離

フィルタ・ソート・剪定の全ロジックはサーバー側（Python）で実行される。フロントエンドは純粋な描画とUI操作のみを担当する。これにより、Python側の `filter_sort.py` と同一のロジックをJSに移植する必要がなく、保守性とデバッグ容易性が確保される。

### 2.2 ファイル構成

```
canvas_gen/viewer/
├── server.py        # HTTPサーバー (stdlib http.server)
├── index.html       # HTMLスケルトン (Sidebar + graph領域)
├── viewer.css       # 全スタイル定義
├── viewer.js        # SVG描画・展開・フィルタGUIロジック
└── __init__.py      # パッケージ宣言

viewer_env/           # 独立起動環境
├── start.bat        # Windows起動スクリプト
├── start.ps1        # PowerShell起動スクリプト
└── README.md        # 使用手順

vault/nodeview/       # ノード描画テンプレート (Vault内)
├── plain.json
├── character_card.json
├── scenario_card.json
├── event_card.json
├── era_circle.json
└── tag_bubble.json
```

### 2.3 起動方式

```bash
# デフォルトVaultで起動
cd viewer_env && start.bat

# 任意のVault + Canvas + Port
python -m canvas_gen.main --vault "path/to/vault" \
    --serve-viewer "path/to/timeline.canvas:8765"

# ブラウザで http://127.0.0.1:8765/ を開く
```

## 3. API仕様

### 3.1 GET /api/data

Canvasの全ノード・全エッジとVault全記事のfrontmatter・本文を返す。

```json
{
  "nodes": [{"id":"主人公","type":"file","file":"character/主人公.md","x":0,"y":0,"width":160,"height":120,"color":"#2196F3"}, ...],
  "edges": [{"id":"...","fromNode":"主人公","toNode":"賢者","label":"師弟","color":"#FF9800"}, ...],
  "vault": {
    "主人公": {"file":"character/主人公.md","props":{"type":"character","title":"主人公","ally":["騎士団長"]},"body":"# 主人公\n\n王国の騎士見習い..."},
    ...
  }
}
```

### 3.2 POST /api/filter

フィルタ・ソート・剪定パラメータを受け取り、処理後のノード・エッジを返す。

**Request**:
```json
{
  "filter": "type=character",
  "exclude": "tags=human",
  "sortKey": "title",
  "sortDesc": false,
  "prune": true
}
```

**Response**: `/api/data` と同形式の `{nodes, edges}`。

フィルタ文字列は `key=value` 形式。`|` でOR、`,` でAND。wiki-link正規化マッチ対応。

### 3.3 GET /api/typedefs

Vaultの `_types/type_definitions.yml` をJSONとして返す。nodeview名の参照に使用。

### 3.4 GET /api/nodeview/{name}.json

Vaultの `nodeview/{name}.json` を返す。ノード描画テンプレート。

## 4. フロントエンド機能

### 4.1 SVGグラフ描画

- Canvas JSONの `x`, `y`, `width`, `height` をそのままSVG座標にマッピング
- ノード: `<rect>` 要素。nodeviewテンプレートで形状（rect/round/circle）・rx・色を制御
- エッジ: `<path>` 要素。二次ベジェ曲線。ラベル・色をJSONから取得
- viewBoxによる全体スケーリング。`preserveAspectRatio="xMidYMid meet"`

### 4.2 パン/ズーム

| 操作 | 動作 |
|---|---|
| ドラッグ (空領域) | 全体パン（translate移動） |
| マウスホイール | ズームイン/アウト（10%〜500%） |
| ズーム表示 | 左下に現在倍率を表示 |

パン・ズームはSVGの `<g>` 要素に `transform="translate(x,y) scale(z)"` を適用して実現。フィルタ適用（Apply）後も位置・倍率を維持。Reset時のみ初期化。

### 4.3 クリック展開（in-place）

ノードをクリックすると、その場で矩形が拡大し本文を表示する。

- **展開サイズ**: デフォルト 420×340px
- **Wrap mode**: テキストが矩形幅を超えると折り返し。実測値（Canvas2D `measureText()`）で正確に判定
- **Stretch mode**: 最長行の実測幅に合わせて矩形を拡大。縦方向も行数に追従
- **タイトル非表示**: 展開中はノードタイトルを `opacity:0` で非表示
- **近隣ノード変位**: 展開矩形と重なるノードを右方向にシフト
- **折りたたみ**: 再度クリックで元のサイズに戻り、近隣ノードも元の位置に復帰

### 4.4 フィルタGUI

右サイドバーでフィルタ・ソート・剪定を設定。

| 項目 | UI | 説明 |
|---|---|---|
| Filter | 動的行追加 | key選択 + value入力。複数行でAND |
| Exclude | 同上 | 除外条件 |
| Sort | key選択 + descチェック | ソートキー |
| Prune | チェックボックス | 孤立ノード除去 |
| Apply | ボタン | サーバーにPOSTし再描画 |
| Reset | ボタン | 全初期化 + 位置リセット |

key選択ドロップダウンはVault内の全プロパティ名から自動生成される。

### 4.5 展開時の本文表示

ノード展開時、以下をSVGテキストとして描画：

| 要素 | スタイル |
|---|---|
| タイトル (`props.title`) | 14px, `#e94560`, bold |
| 一般プロパティ | 10px, `#ddd` |
| Pills (後述) | 9px, 背景付きバッジ |
| Markdown見出し | 14px, `#e94560` |
| Markdown引用 | 10px, `#aaa` |
| Markdown本文 | 10px, `#ddd` |
| コードブロック | スキップ（非表示） |

## 5. nodeviewテンプレート

### 5.1 概要

`vault/nodeview/*.json` に配置するJSONファイル。type定義の `nodeview` キーで参照される。ノードの視覚スタイルをtype単位で完全分離する。

### 5.2 スキーマ

```json
{
  "shape": "rect|round|circle",   // 基本形状
  "rx": 4,                         // 角丸半径 (round=18, circle=w/2)
  "stroke": "#fff6",               // 枠線色
  "strokeWidth": 0.5,              // 枠線幅
  "fontSize": 12,                  // タイトル文字サイズ
  "boldTitle": false,              // タイトル太字
  "titleY": "center|top",          // タイトル垂直位置
  "titlePad": 6,                   // タイトル余白
  "titleWrap": false,              // タイトル折り返し (circle用)
  "properties": {                  // プロパティ別pill設定
    "タグ名": {
      "style": "pill",             // pill形式で描画
      "shape": "round|diamond",    // バッジ形状
      "bg": "#4CAF5044",           // 背景色 (RGBA HEX8)
      "textColor": "#8BC34A"       // 文字色
    }
  }
}
```

### 5.3 定義例

**character_card.json**: 全リレーション種別（ally, rival, likes, dislikes, mentor, family, affiliation）が色分けpill

**tag_bubble.json**: shape=round, rx=18。丸っこいタグ表示

**era_circle.json**: shape=circle, titleWrap=true。円形に時代名を折り返し表示

**event_card.json**: titleY=top。タグ・関連がpill表示

**plain.json**: 標準的な角丸矩形。全プロパティがテキスト表示

### 5.4 Pill表示ロジック

`properties` に `style: "pill"` が指定されたプロパティは、展開時に以下のように描画される：

1. 値から `[[...]]` のwiki-link括弧を除去
2. 各値を個別のバッジ（`<rect>` + `<text>`）として描画
3. バッジは左から右にフロー配置、矩形幅を超えると次の行へ
4. バッジ間隔 6px、行間隔はフォントサイズ+余白で自動計算

## 6. フィルタエンジン（サーバー側）

### 6.1 評価ルール

`canvas_gen/filter_sort.py` と同一ロジック：

- キー間 **AND** 評価
- 同一キー複数値 **OR** 評価
- `$or` ネスト対応（クロスキーOR）
- wiki-link正規化マッチ（`human` ↔ `[[human]]`）
- リスト値メンバーシップ検査

### 6.2 フィルタ文字列構文

```
type=character              # 単一条件
type=character|tag          # OR (|)
type=character,tags=main    # AND (,)
tags=human                  # wiki-link正規化マッチ
```

### 6.3 剪定（prune）

- エッジを1本も持たないノードをcanvasから除去
- `--prune-orphans` フラグに相当
- type指定による対象限定は未実装（サーバー側拡張可能）

## 7. サーバー実装詳細

### 7.1 使用ライブラリ

Python標準ライブラリのみ（`http.server`, `json`, `pathlib`, `yaml`（PyYAML））。

### 7.2 データ読み込み

起動時に以下を一括ロード：

1. Canvas JSON → `FILE_NODES`（`_icon` サフィックスを除外したノード）, `ALL_EDGES`
2. Vault内全 `.md` ファイル → `VAULT_CONTENT`（frontmatter + 本文）
3. `_types/type_definitions.yml` → API経由でフロントエンドへ

### 7.3 エンドポイント一覧

| Method | Path | 説明 |
|---|---|---|
| GET | `/` | index.html |
| GET | `/viewer.css` | スタイルシート |
| GET | `/viewer.js` | JavaScript |
| GET | `/api/data` | Canvas+Vaultフルデータ |
| POST | `/api/filter` | フィルタ実行 |
| GET | `/api/typedefs` | type定義 |
| GET | `/api/nodeview/{name}.json` | nodeviewテンプレート |

## 8. 拡張性

### 8.1 新規nodeview追加

1. `vault/nodeview/新テンプレート.json` を作成
2. `_types/type_definitions.yml` の該当typeに `nodeview: 新テンプレート` を追加
3. フロントエンドは起動時に全nodeviewを自動ロードするため再起動のみで反映

### 8.2 プロパティpill追加

nodeview JSONの `properties` に新しいキーを追加するだけで、展開時の描画が自動的にpill形式に切り替わる。サーバー側・JSロジックの変更は不要。

### 8.3 フィルタ拡張

サーバー側の `run_filter()` 関数に新しいフィルタ条件を追加することで、GUI側も自動的に対応する（key選択ドロップダウンがVaultの全プロパティを動的走査するため）。

### 8.4 データと表現の分離

ノードの描画スタイルはnodeview JSONに完全に分離されている。同一のCanvasデータに対して異なるnodeviewセットを適用することで、見た目だけを変更した複数のビューを生成できる。type_definitionsの `color`, `lining` 等のレイアウト情報はサーバー側で使用されず、フロントエンドの表示のみに影響する。

## 9. 結論

本ビューアーは、Canvas Generatorで生成されたJSON Canvasファイルを、サーバー/クライアント分離アーキテクチャによってブラウザ上でインタラクティブに表示する。フィルタ・ソートロジックをPython側に集約することでJS移植の必要を排除し、nodeviewテンプレートによってtype別・プロパティ別の描画スタイルを完全に外部化した。標準ライブラリのみで動作し、VaultとCanvasファイルさえあれば単一コマンドで起動できる。
