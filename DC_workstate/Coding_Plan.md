# Deep Coding: Canvas(children) Layout Fix

## 1. 概要

### 問題定義
Canvas Generator + NodeView Editorシステムにおいて、以下の2つの問題が発生している：

1. **collapsed時にchildrenが描画される**: ノードが縮小表示(collapsed)状態でも、children配列に含まれる全要素（タグpills等）が無条件に描画されている
2. **collapsed時の高さ計算が異常**: childrenの全ての要素の高さを累積計算するため、120px指定のノードが128px以上に伸びて縦長になる

### 技術スタック
- **言語**: JavaScript (viewer.js), Python (children.py, pipeline.py)
- **描画**: SVG (vanilla JS, frameworkなし)
- **レイアウト**: 自作children layout engine
- **データフロー**: Python事前計算 → JSON出力 → JS描画

---

## 2. 詳細計画（5段階）

### 段階1: collapsed時children描画ガード

**目的**: collapsed状態のノードでchildren描画を抑制

**対象ファイル**: `canvas_gen/viewer/viewer.js`

**変更箇所**:
1. Line 130-183 (Path A: 事前計算children描画)
   - Path B (Line 186-270) から `isExpanded` パラメータ伝播する方法を確立
2. Line 180-183 (Path A children描画ループ)
   - 現在のコード:
     ```javascript
     for (const child of canvasChildren) {
       drawElement(child, g, nx + (child.ax || 0), ny + (child.ay || 0));
     }
     ```
   - 修正方針: collapsed時はchildren描画をスキップ

**実装方針**:
- `n.isExpanded` フラグを既存の `expandedId` 変数で判定
- `expandedId !== n.id` ならcollapsed、条件付き描画に切り替え
- display="none" 属性によるグループ隠蔽を推奨（検索結果により）

**外部AI検索クエリ**: 参照「外部AI検索クエリ - 段階1」セクション

---

### 段階2: collapsed高さの固定値化

**目的**: collapsed状態のノード高さを固定値（30-40px）に設定

**対象ファイル**: `canvas_gen/viewer/viewer.js`

**変更箇所**:
1. Line 136-138 (Path A: childrenサイズ初期化)
   - 現在のコード:
     ```javascript
     childW = n.width || childW;
     childH = n.height || childH;
     n.width = childW; n.height = childH;
     ```
   - collapsed時はこれらの行をスキップ、または固定値で上書き

2. Line 376-393 (`applyNodeView` 関数)
   - `applyNodeView()` の引数に `isExpanded` を追加
   - collapsed時は fixedHeight を使用

**実装方針**:
- collapsed状態: `n.height = Math.max(n.height, 30)` のように最小高さを設定
- Line 147-148: `width` と `height` 属性設定時に状態分岐
- 既存の `nv.layout?.collapsedFillOpacity` と同様の構造で opacity を追加

---

### 段階3: Python事前計算の分離

**目的**: expanded用とcollapsed用のchildren配列を分けて生成

**対象ファイル**: 
- `canvas_gen/children.py`
- `canvas_gen/pipeline.py`

**変更箇所**:
1. `pipeline.py` Line 90-92
   - 現在:
     ```python
     ch_root = compute_children(ch_root, pn.width, pn.height)
     pn.children = ch_root.get('children', [])
     ```
   - 変更: `pn.children` にexpanded用、`pn.collapsedChildren` に空配列or最小要素のみを格納

2. `children.py` `compute_children()` 関数
   - 引数に `for_expanded: bool = True` を追加
   - `True`: 現在の実装（全childrenスタック）
   - `False`: 空配列、またはタイトル要素のみ

**実装方針**:
- JSONスキーマ変更: `children` (expanded用), `collapsedChildren` (collapsed表示用)
- JS側で状態に応じて切り替え

---

### 段階4: text width推定精度改善

**目的**: Python推定値とJS実測値(measureText)の乖離を修正

**対象ファイル**: `canvas_gen/children.py`

**変更箇所**:
1. Line 31-47 (`_estimate_text_w` 関数)
   - 現在の推定係数: `font_size * 0.55` (等幅フォント想定)
   - 問題: プロポーショナルフォントでは誤差が大きくなる

**実装方針**:
- 調査結果に基づき、適切な係数に調整
- 許容誤差: 5%以内を目標
- 改善候補:
  -係数0.55→0.6 (プロポーショナル用)
  - キャラクタ別の重量テーブル追加
  - Pillowベースの正確な計測（最終手段）

---

### 段階5: 統合テスト

**目的**: 全type definitionでcollapsed表示をテスト

**対象ファイル**: `test_children/children_layout.html`

**テストケース**:
1. character_card (120pxノード, 8種類のpill)
2. event_card (140pxノード)
3. scenario_card (160pxノード)
4. 展開→縮小→再展開のサイクル
5. 複数ノード同時表示時の描画順序

---

## 3. 外部AI検索クエリ（段階1）

### 検索クエリ1: collapsed時children描画制御のパターン

**技術コンテキスト:**
- バニラJavaScript + SVGによるノード描画エンジン
- 各ノードは `expandedId` 変数で展開状態を追跡（単一ノードのみ展開可能）
- `expandedId === nodeId` ならexpanded、else collapsed
- 展開時にはノード内部の`children`配列に含まれる複数の子要素（タグ、テキスト等）を描画
- 縮小時はラベル表示のみを行い、childrenを描画しない
- 現在の実装では、`drawElement()` 内で無条件に全childrenを描画
  ```javascript
  for (const child of canvasChildren) {
    drawElement(child, g, nx + (child.ax || 0), ny + (child.ay || 0));
  }
  ```
- SVG描画にフレームワークを使用していない（React/Vueなどなし）

**質問:**
1. バニラJS + SVGでexpanded/collapsed状態に応じてchildrenの描画を分岐する標準的パターンは？
2. `display="none"` 属性によるSVGグループ隠蔽 vs 描画ループの条件分岐の使い分け
3. DOM再生成コストを最小化する手法（状態切替時の最適化）
4. 単一展開ノード管理（`expandedId`パターン）における描画効率化のベストプラクティス

**出力形式:**
- 参照資料（MDNドキュメント、信頼できるソースコード例）
- 知見（箇条書き、コード snippets）
- 推奨アプローチ（上記コンテキストに即した具体的指示）

---

### 検索クエリ2: collapsed状態でのSVG描画最適化

**技術コンテキスト:**
- Canvasノード型ビューアー（Obsidian Canvas互換ツール）
- 複数のSVGノードを一度に描画、各ノードが独立した`<g>`要素で管理
- 展開状態切替時に描画全体を再構築
- children描画の条件分岐を`drawElement()`関数内で実装
- 現状の描画コード:
  ```javascript
  // viewer.js Line 180-183 (Path A: 事前計算children)
  for (const child of canvasChildren) {
    drawElement(child, g, nx + (child.ax || 0), ny + (child.ay || 0));
  }
  
  // Line 264-270 (Path B: 動的計算children)
  for (const child of children.children) {
    drawElement(child, g, nx, ny);
  }
  ```
- 縮小時にchildrenを描画しないようにするには、上記のループを条件付きに変更する必要がある

**質問:**
1. 上記コードを条件付きに変更する際、最もクリーンな実装方法は？
2. `isExpanded` 状態をどこで判定すべきか（関数引数、グローバル変数、DOM属性）
3. 描画ループを2つに分けるべきか、1つのループに条件ガードを追加すべきか
4. パフォーマンス比較（children数が多い場合の描画コスト）

**出力形式:**
- 推奨実装パターン（コード例付き）
- パフォーマンス比較表
- 保守性の観点での推奨

---

## 4. 外部AI検索クエリの出力形式

各検索クエリに対して、以下的形式で出力を期待する：

```markdown
## 検索クエリ [番号]: [テーマ]

**参照した資料:**
- [出典タイトル](URL)
- [出典タイトル](URL)

**主要知見:**
- [知見1: 具体的な実装パターン]
- [知見2: パフォーマンス特性]
- [知見3: 設計上の考慮点]

**このプロジェクトへの適用提案:**
- [具体的なコード変更指示]
- [避けるべきパターン]
- [推奨される実装順序]
```

---

## 5. 制約条件

1. **既存コードの破壊的変更を避ける**: Path AとPath Bの両方を維持
2. **外部ライブラリを追加しない**: バニラJS + SVGの制約を維持
3. **Python-JS間のデータフォーマット変更は段階3以降**: 段階1-2はJS側のみ修正
4. **Japanese comments**: コード内のコメントは日本語で記載
5. **テスト駆動変更**: 各段階で `test_children/children_layout.html` で動作確認

---

## 6. 依存関係

```
段階1 → 段階2（並列実行可能だが、段階2で段階1の変更と矛盾しないよう調整）
段階1, 段階2 → 段階3
段階3 → 段階4
段階1-4 → 段階5
```

---

## 7. 期待される成果物

**段階1完了時:**
- `viewer.js` の `drawElement()` に条件ガード追加済み
- collapsedノードのchildren描画が完全に抑制

**段階2完了時:**
- collapsedノード高さが固定値で設定
- 縦長表示の問題が解決

**段階3完了時:**
- expanded/collapsed用children配列の分離
- `pn.children` (expanded用) と `pn.collapsedChildren` (collapsed用) の2系統

**段階4完了時:**
- Python推定値とJS実測値の乖離が5%以内に収束
- `children.py` の `_estimate_text_w()` 関数が修正済み

**段階5完了時:**
- 全type definitionでテスト完了
- 展開→縮小サイクルで一貫した描画
