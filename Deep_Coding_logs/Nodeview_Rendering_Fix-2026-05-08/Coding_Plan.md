# Deep Coding — NodeView Rendering Fix

**開始日**: 2026-05-08
**テーマ**: server-side viewer (http://127.0.0.1:8765/) において、type era/bmptest/organization/tag 以外のノード（character/scenario/event）が一切描画されない問題の修正

---

## バグ概要

### 現象
- `start.bat` 起動後の viewer で、type era/bmptest/organization/tag のノードは描画される
- type character/scenario/event のノードは一切描画されない
- エッジは正しく描画されている
- フィルターも動作している

### 原因
`canvas_gen/viewer/viewer.js` の描画関数 `render()` 内に複数の描画パスがあり、そのうち Path B 分岐1（動的children生成パス）の末尾に `mainG.appendChild(g)` が欠落している。

### 技術的問題
- Path A（事前計算済みchildren）: 193行目で `mainG.appendChild(g)` あり
- Path B-1（動的孩子生成、children.length > 0）: **284行目に `mainG.appendChild(g)` なし**
- Path B-2（フォールバック、childrenなし/失敗）: 345行目で `mainG.appendChild(g)` あり

### 詳細
```
テンプレートに properties がある？
  ├─ あり
  │   └─ vault props に一致する key があり、かつ style="pill"？
  │       ├─ はい → children 生成 → Path B-1 → 描画されない（appendChild漏れ）
  │       └─ いいえ → children なし → Path B-2 → 描画される
  └─ なし → children なし → Path B-2 → 描画される
```

---

## 計画フェーズ一覧

| 段階 | タイトル | 目的 | 想定アプローチ | 期待成果 |
|------|----------|------|----------------|---------|
| **1** | バグ確認と最小修正 | `viewer.js:284` に `mainG.appendChild(g)` を追加し、character/scenario/event の描画を復元 | 修正候補の調査 → 最小修正実装 → 動作確認 | character/scenario/event ノードが描画される |
| **2** | 共通appendChildラッパー導入 | 全描画パスで共通の `finalizeGroup()` 関数を用い、appendChild漏れの再発を防ぐ | 既存Path A/B-1/B-2のロジック維持＋ラッパー挿入 | リファクタリング版viewer.js |
| **3** | テストケース実装 | 各描画パスを通過した後のDOM構造を検証するスナップショットテストを追加 | `test_children/children_layout.html` にテスト関数追記 | 全パス確認が自動化される |
| **4** | 最終統合とドキュメント | 修正内容をまとめ、最終記録を出力 | 全フェーズ結果の統合 | 最終レポート |

---

## 重要な設計原則

1. **既存ロジック尊重**: if/else if/else連鎖を大幅に書き換えず、最小限の修正に留める
2. **「交換」ではなく「統合」**: 既存のPath A/B-1/B-2のロジックは維持し、appendChild部分のみ対象とする
3. **スタンドアラン維持**: ビルドシステムなしのスタンドアランHTML/JS体制を維持
4. **出力言語**: 日本語
5. **RAG知見の位置付け**: 参考データとして参考にしつつ、既存要件（最小修正）と矛盾する場合は既存要件を優先

---

## 現在状態

- 探索フェーズ（フェーズ0-1〜5）完了。原因特定済み。
- DC_workstate フォルダ作成済み
- Coding_Plan.md 作成中
