# Viewer Rendering Fix — Summary

## プロジェクト概要

**プロジェクト**: brave-knight (Canvas Generator + NodeView Editor for Obsidian)
**日付**: 2026-05-09
**目的**: Canvas Viewerの5つの描画異常を修正する

## 問題リスト

| No | 問題 | 深刻度 | 根本原因 |
|----|------|--------|----------|
| P1 | ノードが縦に極端に長い | P0（画面崩壊） | `render()` 内で `n.height` が毎レンダリングでCOLLAPSED_HEIGHT(35)に上書きされ、蓄積される |
| P2 | 展開→縮小で異常に小さい | P0（UI崩壊） | `applyNodeView()` がミューテート済み `node.width` を使い、元サイズが復元されない |
| P3 | テキスト未描画 | P2（P1/P2の結果） | `expandedId=null` でchildrenが描画されない |
| P4 | アイコン未表示（character型） | P0（機能欠落） | Path A（事前計算済みchildren）にアイコン描画コードが欠落 |
| P5 | 横幅が極端に広い | P0（画面崩壊） | `n.width` ミューテート蓄積 |
| P6 | SVG viewBox/minWidth暴走 | P0（画面崩壊） | ミューテート済み `n.width` がviewBox計算に使われる |

## 修正フェーズ

| フェーズ | 日付 | 内容 | 状態 |
|----------|------|------|------|
| フェーズ0 | 2026-05-09 | コーディングプラン立案 | ✅ 完了 |
| フェーズ1 | 2026-05-09 | `render()` ミューテート停止 + expandedId保持 | ✅ 完了 |
| フェーズ2 | 2026-05-09 | `applyNodeView()`修復 + Path Aアイコン追加 | ✅ 完了 |
| フェーズ3 | 2026-05-09 | `toggleExpand()`比率計算修正 + expandMinW/H追加 | ✅ 完了 |
| フェーズ4 | 2026-05-09 | P2軽微修正（COLLAPSED_HEIGHT調整・padX*2修正・透過率追加） | ✅ 完了 |
| フェーズ5 | 2026-05-09 | Python側テキスト幅推定精度向上（CJK対応） | ✅ 完了 |
| フェーズ6 | 2026-05-09 | 統合テスト・スクリーンショット検証 | ✅ 完了 |

## テスト結果サマリー

| テストケース | 期待値 | 実測値 | 結果 |
|-------------|--------|--------|------|
| 全ノード描画 | 57ノード | 57ノード | ✅ |
| character型 collapsed height | 40 | 40 | ✅ |
| character型 opacity | 0.8 | 0.8 | ✅ |
| アイコン表示 | 13ノード | 13ノード | ✅ |
| 展開後 height | 447 | 447 | ✅ |
| 5回サイクル後 height | 40 | 40 | ✅ |
| テキスト幅誤差（最大） | <10% | +9.9% | ✅ |

## 含まれるファイル

- `Coding_Plan.md` — コーディングプラン
- `Phase-1_result.md` — 段階1結果（ミューテート停止）
- `Phase-2_result.md` — 段階2結果（アイコン追加）
- `Phase-3_result.md` — 段階3結果（比率計算修正）
- `Phase-4_result.md` — 段階4結果（軽微修正）
- `Phase-5_result.md` — 段階5結果（テキスト幅精度向上）
- `Phase-6_result.md` — 段階6結果（統合テスト）
- `working_state.md` — 作業状態
- `Exploration/` — 探索フェーズ（7段階）
