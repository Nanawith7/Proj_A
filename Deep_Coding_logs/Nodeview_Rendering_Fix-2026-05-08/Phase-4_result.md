# Phase-4 結果：最終統合レポート

## 1. 概要

**プロジェクト**: NodeView Rendering Fix  
**開始日**: 2026-05-08  
**終了日**: 2026-05-08  
**テーマ**: server-side viewer (http://127.0.0.1:8765/) において、type era/bmptest/organization/tag 以外のノード（character/scenario/event）が一切描画されない問題の修正

---

## 2. バグ起因

### 現象
- `start.bat` 起動後の viewer で、type era/bmptest/organization/tag のノードは描画される
- **type character/scenario/event のノードは一切描画されない**
- エッジは正しく描画されている
- フィルターも動作している

### 原因特定（フェーズ0 探索）
`canvas_gen/viewer/viewer.js` の描画関数 `render()` 内に3つの描画パスがあり、そのうち Path B 分岐1（動的children生成パス）の末尾に `mainG.appendChild(g)` が欠落していた。

```
テンプレートに properties がある？
  ├─ あり
  │   └─ vault props に一致する key があり、かつ style="pill"？
  │       ├─ はい → children 生成 → Path B-1 → 描画されない（appendChild漏れ）
  │       └─ いいえ → children なし → Path B-2 → 描画される
  └─ なし → children なし → Path B-2 → 描画される
```

**描画される4タイプ**: era/bmptest/organization/tag → Path B-2（appendChildあり）  
**描画されない3タイプ**: character/scenario/event → Path B-1（appendChildなし）

---

## 3. 主要知見（段階ごと）

### Phase 1: バグ確認と最小修正
- **目的**: `viewer.js:284` に `mainG.appendChild(g)` を追加
- **実装**: 285行目に `mainG.appendChild(g);` を1行追加
- **結果**: character/scenario/event ノードが描画される前提を確立

### Phase 2: 共通appendChildラッパー導入
- **目的**: 全描画パスで共通の `finalizeGroup()` 関数を用い、appendChild漏れの再発を防ぐ
- **実装**: 
  - 977-982行目に `finalizeGroup(g, parentGroup)` 関数を追加
  - Path A/B-1/B-2 の3か所の `mainG.appendChild(g);` を `finalizeGroup(g, mainG);` に置き換え
  - 既存の if/else if/else 構造は維持（保守的リファクタリング）
- **結果**: 将来的な新規パス追加時のappendChild忘れを防止

### Phase 3: テストケース実装
- **目的**: 各描画パスを通過した後のDOM構造を検証するスナップショットテストを追加
- **実装**: 
  - viewer.js 986行目以降にテスト関数を追加
  - モックデータ生成関数（3種類）
  - Tier 1（手動検証）: `runTier1_ManualTests()`
  - Tier 3（ユニットテスト）: `runTier3_UnitTests()`
  - 統合関数: `runAllTests()`（window公開）
- **結果**: `finalizeGroup()` 関数の4ユニットテストが全PASS

### Phase 3.5: ブラウザテスト実行
- **目的**: viewerサーバーで実際にテストを実行し、全ノード正常描画を確認
- **結果**: 
  - viewerサーバー起動: http://127.0.0.1:8765/
  - SVGコンテンツ: 51383バイト（全ノード描画）
  - ノード矩形: 58+要素
  - コンソールエラー: 0件（クリーン起動）
  - テスト: 全4ユニットテスト PASS

### Phase 4: 最終統合（本次第）
- **目的**: 全段階結果を統合し、最終ドキュメントを作成
- **結果**: 本レポート

---

## 4. 統合的设计・実装

### 変更ファイル一覧
| ファイル | Phase 1 | Phase 2 | Phase 3 | 合計 |
|---------|---------|---------|---------|------|
| `canvas_gen/viewer/viewer.js` | +1行 | 3行置き換え+6行追加 | +約120行 | +約130行 |

### 修正差分サマリー
```diff
// viewer.js 共通ラッパー追加
+function finalizeGroup(g, parentGroup) {
+    if (!g || !parentGroup) return null;
+    parentGroup.appendChild(g);
+    return g;
+}

// Path A（193行目）
-old: mainG.appendChild(g);
+new: finalizeGroup(g, mainG);

// Path B-1（285行目）※バグ修正箇所
-old: ※appendChildなし
+new: finalizeGroup(g, mainG);

// Path B-2（346行目）
-old: mainG.appendChild(g);
+new: finalizeGroup(g, mainG);
```

### テスト関数一覧
| 関数名 | 層 | 内容 |
|--------|-----|------|
| `createMockNodePrecomputed()` | データ生成 | Path A用モック |
| `createMockNodeDynamic()` | データ生成 | Path B-1用モック |
| `createMockNodeFallback()` | データ生成 | Path B-2用モック |
| `runTier1_ManualTests()` | Tier 1 | 手動検証手順ログ出力 |
| `runTier3_UnitTests()` | Tier 3 | finalizeGroup 4テスト |
| `runAllTests()` | 統合 | 全テスト実行 |

---

## 5. 設計原則の遵守確認

| 設計原則 | 遵守状況 | 補足 |
|---------|---------|------|
| 既存ロジック尊重 | ✅ | if/else if/else連鎖変更なし |
| 「交換」ではなく「統合」 | ✅ | 既存ロジック維持＋ラッパー追加 |
| スタンドアラン維持 | ✅ | ビルドシステムなし、純粋JS |
| 出力言語日本語 | ✅ | 日本語 |
| RAG知見の位置付け | ✅ | 参考データとして活用、既存要件優先 |

---

## 6. テスト結果

### ユニットテスト（Tier 3）
| テスト | 内容 | 結果 |
|--------|------|------|
| Test 1 | 正常系 appendChild | ✅ PASS |
| Test 2 | null child 安全性 | ✅ PASS |
| Test 3 | null parent 安全性 | ✅ PASS |
| Test 4 | チェーン戻り値 | ✅ PASS |

### ブラウザテスト（Phase 3.5）
| 項目 | 結果 |
|------|------|
| viewerサーバー起動 | ✅ OK |
| SVGコンテンツサイズ | 51383バイト |
| ノード矩形数 | 58+ |
| コンソールエラー | 0件 |

---

## 7. 参照文献一覧

### バグ調査フェーズ
1. MDN Node/appendChild() — https://developer.mozilla.org/en-US/docs/Web/API/Node/appendChild
2. SVG DOM操作 — https://tips.recatnap.info
3. Stack Overflow SVG appendChild — https://stackoverflow.com/

### Phase 1-2 設計
4. Refactoring (Martin Fowler) — https://www.infoq.com/articles/book-review-refactoring-second-edition/
5. D3.js conditionally nest SVG — https://stackoverflow.com/questions/44873621
6. svgdom testing — https://deepwiki.com/svgdotjs/svgdom/7-testing-and-examples

### Phase 3 テスト
7. Chrome DevTools Console API — https://developer.chrome.com/docs/devtools/console
8. Approval Testing (Fowler) — https://cloudamite.com/characterization-testing
9. Testharness.js API — https://github.com/WICG/web-platform-tests

### 補足：既存の描画構造
```
render() {
    currentNodes.forEach(n => {
        if (usePrecomputed) {             // Path A
            // 事前計算 children
            finalizeGroup(g, mainG);
        } else if (children.children.length > 0) {  // Path B-1
            // 動的 children 生成
            finalizeGroup(g, mainG);      // ← ここに追加
        } else {                          // Path B-2
            // フォールバック
            finalizeGroup(g, mainG);
        }
    });
}
```

---

## 8. デプロイ手順

```bash
# viewer サーバー起動
python -m canvas_gen.main --vault Obsidian_test/vault --serve-viewer timeline.canvas:8765

# ブラウザで開く
# http://127.0.0.1:8765/

# テスト実行（DevTools Console）
runAllTests()
```

---

## 9. 次のステップ

- Phase 4完了。全計画実行終了。
- 追加要件があれば、任意の段階で継続可能。
