---
title: "Nodeview Editor 技術仕様"
description: "Technical specification for the GUI-based nodeview JSON template editor with live SVG preview, form-based parameter editing, and viewer server integration."
author: "Nanawith7"
layout: default
categories: ["Knowledge Management", "Obsidian", "Data Visualization", "System Architecture"]
tags: ["Obsidian", "Canvas", "Nodeview", "GUI Editor", "SVG Preview", "Template Design"]
research-date: ["2026-04-28"]
---

# Nodeview Editor 技術仕様

## 1. 概要

nodeview JSONテンプレートをGUIで編集するスタンドアロンのWebアプリケーション。Viewerサーバーと連携して既存テンプレートを読み込み、フォームで全パラメータを編集し、SVGライブプレビューで確認しながらJSONを出力する。

```mermaid
flowchart TD
    subgraph "Editor (port 8766)"
        E1[フォームUI]
        E2[SVGプレビュー]
        E3[JSON出力]
    end
    subgraph "Viewer (port 8765)"
        V1[/api/typedefs]
        V2[/api/nodeview/]
    end
    E1 --> E2
    E1 --> E3
    E1 -.->|proxy| V1
    E1 -.->|proxy| V2
```

## 2. アーキテクチャ

### 2.1 サーバー

`server.py` — Python stdlib HTTPサーバー（port 8766、デフォルト）。

- **静的配信**: `index.html`, `editor.css`, `editor.js`
- **APIプロキシ**: Viewerサーバー（port 8765）の `/api/typedefs`, `/api/nodeview/` を中継
- **保存**: `POST /api/save` でテンプレート名とJSONを受け取り、整形して返す

### 2.2 ファイル構成

```
nodeview_editor/
├── server.py        # HTTPサーバー
├── index.html       # エディタUI
├── editor.css       # スタイル
└── editor.js        # エディタロジック
```

### 2.3 起動

```bash
# 先にViewerサーバーを起動
python -m canvas_gen.main --vault "Obsidian_test/vault" \
    --serve-viewer "Obsidian_test/vault/characters.canvas:8765" &

# エディタを起動
cd nodeview_editor && python server.py [8766] [8765]

# ブラウザで http://127.0.0.1:8766/ を開く
```

## 3. UI構成

3ペインのレイアウト。

### 3.1 左ペイン: テンプレート一覧

- Viewerサーバーから `/api/typedefs` を取得し、全type名とnodeview名をリスト表示
- クリックでテンプレート読み込み（`/api/nodeview/{name}.json`）
- 「+ New」で空テンプレートを新規作成
- 「Import JSON」でクリップボードからJSONを直接読み込み

### 3.2 中央ペイン: プレビュー + 出力

| 領域 | 内容 |
|---|---|
| 縮小プレビュー | 120×80px SVG。タイトル・形状・opacityを反映 |
| 展開プレビュー | 380×280px SVG。背景・プロパティ配置・opacityを反映 |
| 下部 | Copy JSONボタン、Saveボタン、ステータス表示 |

プレビューはフォーム変更のたびにリアルタイム更新される。

### 3.3 右ペイン: パラメータ編集

フォームは以下のグループに分割されている。

**Shape & Style**:

| フィールド | 型 | デフォルト |
|---|---|---|
| shape | select (rect/round/circle) | rect |
| rx | number | 4 |
| strokeWidth | number | 1 |
| stroke | text (color) | #fff6 |
| fontSize | number (8-24) | 12 |

**Title**:

| フィールド | 型 | デフォルト |
|---|---|---|
| titleY | select (center/top) | center |
| titleWrap | checkbox | false |
| titlePadX | number | 10 |
| titlePadY | number | 10 |

**Opacity**:

| フィールド | 型 | デフォルト |
|---|---|---|
| collapsed | range (0-1) | 1 |
| expanded | range (0-1) | 1 |
| background opacity | range (0-1) | 0.15 |
| background image | text | (空) |

**Expand Size**:

| フィールド | 型 | デフォルト |
|---|---|---|
| minW | number | 300 |
| minH | number | 200 |

**Content Padding**:

| フィールド | 型 | デフォルト |
|---|---|---|
| padX | number | 10 |
| padY | number | 10 |
| body Y | number | 0 (auto) |

**Icon**:

| フィールド | 型 | デフォルト |
|---|---|---|
| anchorX | select (center/left/right) | center |
| anchorY | select (center/top/bottom) | center |
| padX | number | 0 |
| padY | number | 0 |

**Properties**:

動的行追加UI。各行に以下を設定：

| フィールド | 型 |
|---|---|
| key | text（プロパティ名） |
| style | select（pill / text） |
| x | number（絶対位置。空=flow） |
| y | number（絶対位置。空=flow） |

各行に削除ボタンあり。「+ Add Property」で行追加。

## 4. プレビューエンジン

### 4.1 computeLP

`layoutParams` のJS移植。shapeに応じてcontent領域を計算する。

- **circle**: `diameter = min(w, h)`。contentを直径から算出。titleAnchor=middle
- **rect/round**: 全幅からpaddingを引く。titleY=topの場合はcontentYにタイトル高を加算

### 4.2 縮小プレビュー

120×80pxの矩形に以下を描画：
1. background（展開時のみ、opacity適用）
2. shapeに従ったrect（rx, fill, stroke, opacity適用）
3. タイトルテキスト（fontSize, titleAnchor, titleYに従い配置）

### 4.3 展開プレビュー

380×280pxの矩形に以下を描画：
1. 背景色（backgroundOpacity適用）
2. shapeに従ったrect
3. プロパティ行（設定されたpositionまたはautoフローで配置）

## 5. JSON出力

`buildNV()` 関数がフォームの全値を読み取り、nodeview JSONオブジェクトを構築する。

- デフォルト値と等しいパラメータは出力から除外（クリーンなJSON）
- `properties` は空でなければ出力
- `layout` は空でなければ出力

出力は画面下部のテキストエリアにリアルタイム表示され、「Copy JSON」ボタンでクリップボードにコピー可能。

## 6. 保存

「Save」ボタンで `POST /api/save` にテンプレート名とJSONを送信。サーバーは整形されたJSONを返す。実際のファイル保存が必要な場合は、返却されたJSONを手動で `vault/nodeview/` に配置する。

## 7. 拡張性

### 7.1 パラメータ追加

フォームに新しい入力要素を追加し、`applyToForm()` / `buildNV()` に対応するget/setを追加するだけで良い。

### 7.2 プレビュー精度向上

`computeLP` と `drawPreview` に nodeviewの全layoutパラメータを反映させることで、実際のviewerと同一のレンダリングが可能。

### 7.3 直接保存

`POST /api/save` の実装を拡張し、ViewerサーバーのVaultに直接 `.json` ファイルを書き込むことも可能（セキュリティ上の配慮が必要）。

### 7.4 プロパティ色設定

text-styleプロパティ・pill-styleプロパティの両方で `textColor` が設定可能。`buildNV()` が常にkeyを持つプロパティを出力する（空スタイルの `{}` も省略されない）。

## 8. 最新の変更

### 8.1 ファイル分割

エディタは3ファイルに分割：
- `editor-core.js` — データ管理・フォームバインディング・JSON構築
- `editor-preview.js` — SVGプレビュー・ドラッグシステム・背景画像
- `editor.js` — `init()` 呼出しのみ

### 8.2 縦積みレイアウト

右サイドバー（300px）は全フォームを `label + input` の縦積みで表示。`.row` flex圧縮レイアウトは廃止。

### 8.3 プロパティ行2段構造

各プロパティはカード内に2行で表示：
- 上段: 番号 + key + pill/text切替 + 削除
- 下段: pill時はshape/bg/textColor + x/y位置、text時はtextColor + x/y位置

### 8.4 タイトル/本文色

`layout.titleColor` / `layout.bodyColor` の入力欄をサイドバーに追加。プレビュー・ビューア両方で反映。

### 8.5 プレビューアスペクト比

プレビューの展開サイズが `expandMinW/H` の値に動的追従。380x280固定を廃止し、常に実際の展開比率と一致。

### 8.6 ドラッグシステム

`data-mode`/`data-idx` 属性によるマーカー式ドラッグ。JS変数（`_titlePos`/`_bodyPos`）による状態管理でDOM再描画の影響を受けない。マウスアップ時のみプレビュー更新。

### 8.7 プロパティテキスト色プレビュー

エディタプレビューでプロパティの `textColor` が反映される（未設定時 `#fff`）。

## 9. 結論

Nodeview Editorは、Viewerサーバーと連携して既存テンプレートを読み込み、全パラメータをフォームで編集し、SVGライブプレビューで即時確認できるGUIツールである。テキストエディタでのJSON手書きに比べ、形状・opacity・背景・プロパティ配置を視覚的に設計できる。
