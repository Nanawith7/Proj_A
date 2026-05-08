# Phase-1_result: Collapsed時Children描画ガード

## 1. 段階概要

- **段階番号**: 段階1
- **目的**: collapsed状態のノードにおいて、children配列の描画を抑制する
- **結果**: 完了

## 2. 実施内容

### 2.1 調査
- `viewer.js` の2つの描画パス(Path A, Path B)でchildrenが無条件に描画されていることを確認
- `expandedId` グローバル変数が状態管理に使用可能であることを確認

### 2.2 修正対象
- **ファイル**: `canvas_gen/viewer/viewer.js`
- **修正箇所**: 2箇所

#### 修正1: Path A (事前計算children描画)
- **場所**: Line 180-185
- **変更前**:
  ```javascript
  // Draw children directly (positions are relative to parent origin)
  for (const child of canvasChildren) {
    drawElement(child, g, nx + (child.ax || 0), ny + (child.ay || 0));
  }
  ```
- **変更後**:
  ```javascript
  // Draw children directly (positions are relative to parent origin)
  if (expandedId === n.id) {
    for (const child of canvasChildren) {
      drawElement(child, g, nx + (child.ax || 0), ny + (child.ay || 0));
    }
  }
  ```

#### 修正2: Path B (動的計算children描画)
- **場所**: Line 266-273
- **変更前**:
  ```javascript
  // Children via drawElement()
  children._ax = 0;
  children._ay = 0;
  for (const child of children.children) {
    drawElement(child, g, nx, ny);
  }
  rendered = true;
  ```
- **変更後**:
  ```javascript
  // Children via drawElement()
  children._ax = 0;
  children._ay = 0;
  if (expandedId === n.id) {
    for (const child of children.children) {
      drawElement(child, g, nx, ny);
    }
  }
  rendered = true;
  ```

## 3. 設計判断

### 3.1 ガード条件の選択
- 推奨パターン: `expandedId === n.id` による条件分岐
- RAG検索結果により、ループ全体を条件で囲むアプローチ(推奨度★★★)を採用
- 描画ループ自体が実行されないため、children数が多い場合のCPU負荷が最小限

### 3.2 `drawElement()` 関数内変更なし
- RAG推奨により、呼び出し側で状態制御するアプローチを採用
- 関数の責務が単一のまま維持される

### 3.3 既存機能との互換性
- `expandedId` は既存の変数で、`toggleExpand()` と `collapseAll()` により管理済み
- 変更は描画ループの条件追加のみ。既存ロジックに影響なし

## 4. 影響範囲

### 4.1 修正ファイル
- `canvas_gen/viewer/viewer.js`

### 4.2 影響を受ける要素
- 全nodeviewテンプレート(character_card, scenario_card, event_card等)
- 事前計算childrenを使用するノ(Path A)
- 動的計算childrenを使用するノ(Path B)

### 4.3 影響を受けない要素
- `toggleExpand()` (Line 405-578) 本体
- `collapseAll()` (Line 604-628) 本体
- `drawElement()` 関数本体 (Line 886-944)

## 5. テスト方針

### 5.1 手動テスト
- canvas viewerで複数のノードをcollapsed表示
- childrenが描画されないことを確認
- ノードをクリックしてexpanded表示
- childrenが正しく描画されることを確認

### 5.2 エッジケース
- 初期状態で全てcollapsedの場合
- 展開→縮小→再展開のサイクル
- childrenの無いノードの表示(影響なし)

## 6. 次の段階へ

段階1完了。段階2(collapsed高さの固定値化)に進む。
