# Canvas Viewer - HTTP Server

VaultとCanvasファイルを読み込み、ブラウザでインタラクティブに表示するHTTPサーバー。

## 起動

```bash
# デフォルト (Obsidian_testのtimeline)
.\start.bat

# 任意のVault + Canvas
.\start.bat "C:\my_vault" "C:\my_vault\timeline.canvas"

# ポート指定
.\start.bat "..\Obsidian_test\vault" "..\Obsidian_test\vault\characters.canvas" 8765
```

PowerShell:
```powershell
.\start.ps1 -Vault "..\Obsidian_test\vault" -Canvas "..\Obsidian_test\vault\characters.canvas"
```

## 使い方

1. ブラウザで `http://127.0.0.1:8765/` を開く
2. SVGグラフが表示される（スクロール可）
3. ノードをクリック → 右下に展開（frontmatter + 本文）
4. 右サイドバーでフィルタを設定 → Apply で再描画

## フィルタ構文

```
type=character           # 単一条件
type=character|tag       # OR (|)
type=character,tags=main # AND (,)
exclude: tags=human      # 除外
sort: year               # ソート
prune: checkbox ON       # 孤立ノード削除
```

## 構成

```
viewer_env/
├── start.bat            # Windows起動
├── start.ps1            # PowerShell起動
└── README.md
```

サーバー実体は `../canvas_gen/viewer/server.py` + `index.html`。
