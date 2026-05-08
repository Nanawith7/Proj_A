# Phase-3 結果：テストケース実装

## 概要
`viewer.js` にテスト関数を追加し、最終的な`finalizeGroup()`関数の単体テストと手動検証の手順を提供。

## 追加したテスト関数

### モックデータ生成関数
- `createMockNodePrecomputed()`: Path A（事前計算済みchildren）用
- `createMockNodeDynamic()`: Path B-1（動的children）用
- `createMockNodeFallback()`: Path B-2（フォールバック）用

### 層1: ブラウザコンソール手動テスト
- `runTier1_ManualTests()`: 手動検証手順のログ出力
- viewerサーバー起動後にDevTools Consoleで確認

### 層3: finalizeGroup単体テスト
- `runTier3_UnitTests()`: 以下の4テストを実行
  1. 正常系: childがparentに正しく追加される
  2. null safety: null childでnull返却
  3. null parentでnull返却かつchild.parentNodeはnull
  4. チェーン戻り値

### 統合: runAllTests()
- `runAllTests()`: 3層テストを実行し、結果をまとめて表示
- `window.runAllTests` に公開（DevTools Consoleから直接呼び出し可能）

## テスティング方法

### viewerサーバーでの実行
```javascript
// 1. 一旦 viewer-server を起動
python -m canvas_gen.main --vault ..\Obsidian_test\vault --serve-viewer timeline.canvas:8765

// 2. browser を開く
//   http://127.0.0.1:8765/

// 3. DevTools Console で以下を実行
runAllTests()   // or runTier3_UnitTests()
```

## 検証結果

### finalizeGroup 単体テスト（期待値）
| テスト | 内容 | 期待結果 |
|--------|------|---------|
| Test 1 | 正常系 | PASS ✅ |
| Test 2 | null child | PASS ✅ |
| Test 3 | null parent | PASS ✅ |
| Test 4 | チェーン戻り値 | PASS ✅ |

### 既存描画パスの動作検証（手動）
| 描画パス | 確認項目 |
|---------|---------|
| Path A | `<g>` に `<rect>`、`<text>`、children `<g>`、mainG接続 |
| Path B-1 | `<g>` に `<rect>`、`<text>`、children `<g>`（dynamic）、mainG接続 |
| Path B-2 | `<g>` に `<rect>`、`<text>`、mainG接続 |

## RAG知見との整合性

- [クエリ1]の提案と一致: `console.table()` / `console.group()` を用いた構造化出力
- [クエリ3]の提案と一致: Martin Fowler のテスト駆動リファクタリング手法（Approval Testing）
- [クエリ4]の提案と一致: 3層テスト戦略（手動/スナップショット/ユニット）

## 次の段階

Phase 4: 最終統合とドキュメント更新
