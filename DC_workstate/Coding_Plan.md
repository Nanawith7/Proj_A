# Deep Coding — Viewer Rendering Fix Coding Plan

**Project**: brave-knight (Canvas Generator + NodeView Editor for Obsidian)  
**Date**: 2026-05-09  
**Goal**: 修正キャンバスビュアの5つの描画異常（縦長ノード、縮小サイズ壊れ、テキスト未描画、アイコンズレ、横幅広すぎる）  
**Exploration Phases Completed**: 7 phases (Viewer Rendering Issues Exploration)  
**RAG Queries Completed**: 6 queries (SVG rendering patterns, state management, coordinate consistency, text measurement, performance, NodeView templates)

---

## 問題リスト

| No | 問題 | 深刻度 | 根本原因 |
|----|------|--------|----------|
| P1 | ノードが縦に極端に長い | P0（画面崩壊） | `render()` 内で `n.height` が毎レンダリングで COLLAPSED_HEIGHT(35) に上書きされ、蓄積される |
| P2 | 展開→縮小で異常に小さい | P0（UI崩壊） | `applyNodeView()` がミューテート済み `node.width` を使い、元サイズが復元されない |
| P3 | テキスト未描画 | P2（P1/P2の結果） | `expandedId=null` で children が描画されない（P2修正で同時に解決） |
| P4 | アイコン未表示（character型） | P0（機能欠落） | Path A（事前計算済みchildren）にアイコン描画コードが欠落 |
| P5 | 横幅が極端に広い | P0（画面崩壊） | `n.width` ミューテート蓄積（P1と同じ根本原因） |
| P6 | SVG viewBox/minWidth暴走 | P0（画面崩壊） | ミューテート済み `n.width` が viewBox 計算に使われる |

---

## 根本原因分類

| 原因ID | 原因 | 影響問題 | 修正優先度 |
|--------|------|----------|-----------|
| **C1** | `render()` 内で `n.width/n.height` をミューテート | P1, P2, P5, P6 | P0 |
| **C2** | `render()` 最後で `expandedId=null` にリセット | P2, P3 | P0 |
| **C3** | `applyNodeView()` がミューテート済み `node.width` を使う | P2 | P0 |
| **C4** | Path A にアイコン描画コードが欠落 | P4 | P0 |
| **C5** | `toggleExpand()` 比率計算が COLLAPSED_HEIGHT(35) を使う | P1 | P1 |
| **C6** | 5つのノード型で `expandMinW/expandMinH` が未定義 | P1 | P1 |

---

## 実装フェーズ計画

### 段階1: `render()` ミューテート停止 + expandedId保持（P0-C1/C2）

**目的**: ノードサイズ暴走の根本原因を停止し、展開状態が保持されるようにする

**対象ファイル**: `canvas_gen/viewer/viewer.js`

**修正内容**:
1. `viewer.js:144`（Path A）: `n.width = childW; n.height = childH;` の代入を削除
2. `viewer.js:211`（Path B）: 同様の代入を削除
3. `viewer.js:351`: `expandedId=null;` の削除
4. 描画は `childW`/`childH` ローカル変数のみを使用

**RAG統合ポイント**:
- Mike Bostockの「描画ロジックとデータの分離」パターンに従い、描画用ローカル変数と永続データを明確に分離
- Excalidrawの `Scene` パターンを参考：描画パイプラインは要素を「読むだけ」で変更しない

**検証方法**:
- ブラウザDevToolsで `n.width`/`n.height` が初期値（160x120）を保持することを確認
- `expandedId` が `render()` 再呼び出し後も保持することを確認
- viewBoxサイズが暴走しないことを確認

---

### 段階2: `applyNodeView()`修復 + Path Aアイコン追加（P0-C3/C4）

**目的**: 縮小時に型定義サイズを正しく復元し、character型ノードのアイコンを表示する

**対象ファイル**: `canvas_gen/viewer/viewer.js`

**修正内容**:
1. `viewer.js:391-408`: `applyNodeView()` で `expanded=false` 時に `td.node_width`/`td.node_height` を使用
2. `viewer.js:136-194`（Path A）: タイトル描画後・children描画前にアイコン描画コードを追加
3. 共通ヘルパー関数 `resolveIconAnchor()` の導入（Path A/B/B-2 で統一）

**RAG統合ポイント**:
- D3.jsの `<g>` transformパターンとExcalidrawのレンダリングパイプラインを参考
- Icon配置の基準点を `resolveIconAnchor()` に抽出し全パス共通化

**検証方法**:
- character型ノードにアイコンが表示されることを確認
- 縮小時に元の型定義サイズ（160x120）が復元されることを確認

---

### 段階3: `toggleExpand()`比率計算修正 + expandMinW/H追加（P0-C5/C6）

**目的**: 展開時サイズが型定義の宽高比を維持し、5つのノード型で正しい展開サイズになる

**対象ファイル**: `canvas_gen/viewer/viewer.js`, `nodeview/*.json`（5ファイル）

**修正内容**:
1. `viewer.js:466-473`: `toggleExpand()` の比率計算で `node.width/height` の代わりに `typeDef.node_width/height` を使用
2. `nodeview/character_card.json` 他5ファイル: `layout.expandMinW`/`expandMinH` を型定義サイズと一致させて追加

**RAG統合ポイント**:
- D3.jsの `_children`/`children` パターンを参考にした状態管理
- React Flowのデフォルト値フォールバックチェーン（型定義→テンプレート→ハードコード）

**検証方法**:
- character型（160x120）の展開サイズが適切な値になることを確認
- 比率計算が COLLAPSED_HEIGHT(35) の影響を受けないことを確認

---

### 段階4: P2軽微修正（COLLAPSED_HEIGHT調整・padX*2修正・透過率追加）

**目的**: UI品質を改善する軽微な修正

**対象ファイル**: `canvas_gen/viewer/viewer.js`, `nodeview/*.json`（5ファイル）

**修正内容**:
1. `viewer.js:6`: `COLLAPSED_HEIGHT = 35` → `40` に調整
2. `viewer.js:851`: `resolvePositions()` の `padX * 2` 二重加算修正
3. `viewer.js:940`: `drawElement()` テキスト条件の緩い比較（`===` → `==`）
4. `nodeview/*.json` 5ファイル: `collapsedFillOpacity`/`expandedFillOpacity` を追加

**検証方法**:
- 縮小時のタイトルが見やすくなることを確認
- テキスト条件の厳密比較による潜在的バグが修正されることを確認

---

### 段階5: Python側テキスト幅推定精度向上（fontTools統合）

**目的**: Python `_estimate_text_w_v2()` とブラウザ `measureText()` の差（最大18%）を縮める

**対象ファイル**: `canvas_gen/children.py`

**修正内容**:
1. `fontTools.ttLib.TTFont` を使用した正確なグリフ幅計測を `_estimate_text_w_v2()` に追加
2. フォントファイルのパスは `_icons/` またはシステムフォルトから検索
3. CJK文字（日本語）の advance width を `hmtx` テーブルから取得
4. 安全マージン（2-5%）を適用

**RAG統合ポイント**:
- fontToolsの `cmap` → `glyphSet` → `hmtx` による正確なグリフ幅取得パターン
- Pillowの `get_length()` との精度比較

**検証方法**:
- 日本語テキストの `cw` 値がブラウザ実測値に10%以内で一致することを確認

---

### 段階6: 統合テスト・スクリーンショット検証

**目的**: 全修正が意図通り動作することを実証

**検証方法**:
- ブラウザで `--serve-viewer` 起動
- 各問題（P1-P5）が修正されたことをスクリーンショットで検証
- 展開→縮小サイクルを複数回実行し、サイズが安定することを確認
- character型/era型の両方でアイコンが表示されることを確認

---

## 修正優先度まとめ

| 優先度 | 段階 | 修正内容 | 影響する問題 |
|--------|------|----------|-------------|
| **P0** | 段階1 | ミューテート停止 + expandedId保持 | P1, P2, P5, P6, P3 |
| **P0** | 段階2 | applyNodeView修復 + Path Aアイコン追加 | P2, P4 |
| **P1** | 段階3 | 比率計算修正 + expandMinW/H追加 | P1 |
| **P2** | 段階4 | 軽微修正 | P3（テキスト表示品質） |
| **P1** | 段階5 | テキスト幅精度向上 | 全children表示品質 |
| - | 段階6 | 統合テスト | 全問題 |

---

## 参照文献（探索フェーズ）

- `Deep_Coding_logs/viewer-rendering-issues-2026-05-09/Exploration/exploration_summary.md`
- `Deep_Coding_logs/viewer-rendering-issues-2026-05-09/Exploration/Exploration-1_result.md`
- `Deep_Coding_logs/viewer-rendering-issues-2026-05-09/Exploration/Exploration-2_result.md`
- `Deep_Coding_logs/viewer-rendering-issues-2026-05-09/Exploration/Exploration-2.5_result.md`
- `Deep_Coding_logs/viewer-rendering-issues-2026-05-09/Exploration/Exploration-3_result.md`
- `Deep_Coding_logs/viewer-rendering-issues-2026-05-09/Exploration/Exploration-4_result.md`
- `Deep_Coding_logs/viewer-rendering-issues-2026-05-09/Exploration/Exploration-5_result.md`
- `Deep_Coding_logs/viewer-rendering-issues-2026-05-09/Exploration/Exploration-6_result.md`
- `Deep_Coding_logs/viewer-rendering-issues-2026-05-09/Exploration/Exploration-7_result.md`

## 参照文献（RAGクエリ）

- クエリ1: SVGベースビュアでのノード状態ミューテート回避パターン
- クエリ2: SVGトグル展開/縮小の状態管理ベストプラクティス
- クエリ3: SVG複数描画パスの座標計算整合性
- クエリ4: Python推定 vs ブラウサmeasureText()の差を埋めるテキスト幅計算
- クエリ5: SVGキャンバスビュアのパフォーマンス最適化（大規模ノード）
- クエリ6: NodeViewテンプレートベースのノードビジュアル定義パターン
