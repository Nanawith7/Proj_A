# Deep Coding 計画 - 既存年表システムへの新childrenシステム統合

## 概要

既存の canvas viewer（HTML + Pythonサーバー）の表示レンダリングに、test_children の新 children システムを**後方互換性**を持った状態で統合。既存のノードも新 children も混在して描画できる状態を目指す。

## 統合対象
- **既存システム**: `canvas_gen/viewer/server.py` (HTTP配信) → `viewer/*.html` (ブラウザレンダリング)
- **新システム**: `test_children/` 内のレイアウトエンジン（8ファイル）

## 全10段階計画

### 段階0: 計画立案 ✅ 完了
- 10段階計画を提案、ユーザー承認済み
- 優先: レンダリング統合のみ（サーバー/エディタは次回）

### 段階1: 既存ビューアレンダリング解析 ✅ 完了
- `viewer/server.py` + `viewer.js` + `template.html` の構造完全把握
- 既存 `.canvas` ファイル構造（フラット配置）
- NodeViewテンプレート7種（propertiesベース）
- テンプレート詳細: character_card, event_card, scenario_card, era_circle, tag_bubble, bmp_test, plain

### 段階2: test_children レイアウトエンジン解析 ✅ 完了
- 8ファイルの関係性マッピング完了
- `layout.js` (363行) + `render.js` (224行) + `text.js` (94行) + 他ファイル
- 描画フロー: measureElement() → resolvePositionsTree() → drawElement()

### 段階3: 差異分析・統合設計 ✅ 完了
- **採用方針**: C案（既存保持 + 新childrenオプション）
- 既存描画を維持しつつ、childrenがあるノードのみ新描画を採用
- メイン変更: `viewer.js` のみ。`server.py`は変更なし

### 段階4: 変換レイヤー設計 ✅ 完了
- `nodeViewToChildren(nv, nodeData)` 関数設計完了
- Type A (properties付き四角), Type B (円形), Type C (propertiesなし) の3パターン
- テストケース6種設計完了

### 段階5: レンダリングエンジン実装 ⚠ 一部完了
- **viewer.js**: 完了
  - `nodeViewToChildren`, `measureElement`, `resolvePositions`, `computeChildrenLayout` 追加
  - `render()` 関数に children描画パス統合
- **template.html**: 一部完了
  - 関数は追加済みだが、nodeview テンプレートロード未対応
  - 当面は既存描画パスのみ使用される

### 段階6: レンダリングエンジン検証 🔴 次
- viewer.js で children ノードが正しく描画されるか確認
- template.html で既存描画が壊れていないか確認
- サーバー起動テスト

### 段階7: テンプレートロード実装
- template.html で `/api/nodeview/` からテンプレートをロード
- viewer.js で `loadNodeViews()` の結果を反映

### 段階8: canvas_gen パイプライン統合
- pipeline.py に children レイアウトエンジンを接続
- 既存7段階処理の最後の `layout` ステップに新エンジン接続

### 段階9: 統合テスト
- テストボルトで両方のノードタイプを混在させて表示
- 既存 + 新 children ノード同時描画

### 段階10: ドキュメント最適化
- AGENTS.md の更新
- 統合システムの仕様書を更新

---

## 現在までの確定事項

1. **既存システムは「破壊せず」、後方互換性を維持する**
2. **レンダリング統合のみ実施（サーバー/エディタは次回フェーズ）**
3. **C案（既存保持 + 新childrenオプション）を採用**
4. **変更は主に `viewer.js` のみ**
5. **template.html での nodeview テンプレートロードは未対応**
6. **nodeViewToChildren 関数は properties → children 変換を完全実装**

## 技術的制約
1. canvas_gen/pipeline.py (Python) → canvasファイル出力 → viewer.js (JS) 描画
2. template.html はインライン描画（サーバー側で埋め込み）
3. viewer.js はクライアント側フェッチ描画
4. 両方のパスで children 描画を実装する必要がある
