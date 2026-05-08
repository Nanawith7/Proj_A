# 探索計画（Exploration Plan）

## 概要
viewer_envのstart.bat起動後、http://127.0.0.1:8765/において、type era, type bmptest、type organization、type tagを除いて、一切ノードが描画されていないバグを特定するためのコードベース探索計画。

## 段階一覧

### フェーズ0-コードベース探索段階-1：サーバー起動フローの追跡 [完了]
**目的**：`start.bat` → viewerサーバー起動 → `http://127.0.0.1:8765/` 描画までの完全なパスを特定
**結果**：
- `viewer_env/start.bat` が `python -m canvas_gen.main --serve-viewer` を実行していることを確認
- `canvas_gen\viewer\server.py` がHTTPサーバー実装（/api/data, /api/filter, /api/typedefs, /api/nodeview/* エンドポイント）
- `canvas_gen\viewer\viewer.js` がクライアント描画ロジック
- `canvas_gen\viewer\index.html` がフロントエンド

### フェーズ0-コードベース探索段階-2：ノード描画ロジックの解析 [完了]
**目的**：描画パスの特定（Path A / Path Bの分岐構造）
**結果**：
- Path A（136-193行目）：`n.children` が存在する場合 → Pre-computed children描画（appendChildあり）
- Path B（194-346行目）：`n.children` が存在しない場合 → フォールバック
  - 分岐1（199-285行目）：`nodeViewToChildren()` でchildren生成成功案例 → **appendChild漏れ**
  - 分岐2（287-346行目）：children生成失敗或いはなし → **appendChildあり**
- **バグ原因特定**：分岐1に`mainG.appendChild(g)`がない

### フェーズ0-コードベース探索段階-3：除外対象4タイプの特定 [完了]
**目的**：描画される4タイプ（era, bmptest, organization, tag）の共通点と描画されない3タイプ（character, scenario, event）の違いを特定
**結果**：
- `nodeViewToChildren()` の処理経路と描画結果を完全対応
- 描画されない条件：templateに`properties`Keyがあり、かつ`style:"pill"`を持つkeyがvault propsに存在する

### フェーズ0-コードベース探索段階-4：パイプライン処理とJSON出力の検証 [未着手]
**目的**：サーバーが返すJSONと実際の描画の不整合の特定
**対象**：
- `canvas_gen/pipeline.py` のパイプライン処理（layoutステップ以降）
- `canvas_gen/children.py` のchildren計算処理
- viewerサーバーが返す実際のJSON構造

### フェーズ0-コードベース探索段階-5：フィルター動作の検証 [未着手]
**目的**：フィルターが動作しているという情報から描画不全の原因を特定
**対象**：
- viewer.jsのフィルター関連コード
- フィルター通過後の描画処理の再接続部

## 現在の状態
- 段階1〜3完了
- 段階2と3でバグ原因を特定済み
- 段階4, 5は追加確認が必要な場合に実行

## 修正方針（仮）
`viewer.js` 284行目（`rendered = true;` の前または後）に `mainG.appendChild(g);` を追加する必要がある。
