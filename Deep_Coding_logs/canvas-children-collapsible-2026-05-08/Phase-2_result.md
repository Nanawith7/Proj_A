# Phase-2_result: Collapsed高さの固定値化

## 1. 段階概要

- **段階番号**: 段階2
- **目的**: collapsed状態のノード高さを固定値（35px）に設定
- **結果**: 完了

## 2. 実施内容

### 2.1 調査
- RAG検索により、collapsed高さの固定値化パターンを確立
- COLLAPSED_HEIGHT = 35px を推奨（最大フォントサイズ14px + titlePadY*2 + 余白）
- 既存の `applyNodeView` 関数（expandedパラメータ付き）との整合性を確認

### 2.2 修正対象
- **ファイル**: `canvas_gen/viewer/viewer.js`
- **修正箇所**: 3箇所

#### 修正1: COLLAPSED_HEIGHT定数追加
- **場所**: Line 6
- **変更内容**:
  ```javascript
  const COLLAPSED_HEIGHT = 35;
  ```

#### 修正2: Path A(Line 137-143)にcollapsed高さ分岐を追加
- **変更前**:
  ```javascript
  childW = n.width || childW;
  childH = n.height || childH;
  n.width = childW; n.height = childH;
  ```
- **変更後**:
  ```javascript
  childW = n.width || childW;
  if (expandedId === n.id) {
    childH = n.height || childH;
  } else {
    childH = COLLAPSED_HEIGHT;
  }
  n.width = childW; n.height = childH;
  ```

#### 修正3: Path B(Line 204-210)にcollapsed高さ分岐を追加
- **変更前**:
  ```javascript
  childW = !childW || childW <= 0 ? children._cw || 200 : children._cw < childW ? children._cw : childW;
  childH = !childH || childH <= 0 ? children._ch || 120 : children._ch < childH ? children._ch : childH;
  n.width = childW; n.height = childH;
  ```
- **変更後**:
  ```javascript
  childW = !childW || childW <= 0 ? children._cw || 200 : children._cw < childW ? children._cw : childW;
  if (expandedId === n.id) {
    childH = !childH || childH <= 0 ? children._ch || 120 : children._ch < childH ? children._ch : childH;
  } else {
    childH = COLLAPSED_HEIGHT;
  }
  n.height = childH;
  n.width = childH;
  ```

## 3. 設計判断

### 3.1 COLLAPSED_HEIGHTの値
- RAG推奨: 35px（最大フォントサイズ14px + titlePadY*2 + 7px余裕）
- フォントサイズ9-14pxの全範囲でタイトルが中央表示できる安全値
- ノードタイプごとに異なる値を設定するよりも、グローバル定数で統一した方が保守性が高い

### 3.2 `n.height` の直接書き換え
- RAG知見に従い、`n.width`/`n.height` を直接書き換える（再描画方式なので副作用なし）
- `applyNodeView(rect, node, false)` も `node.height` を参照するため、整合性が保たれる

### 3.3 既存機能との互換性
- `applyNodeView()` 変更なし: expanded=false時は `node.height` を使用（すでにCOLLAPSED_HEIGHT反映済み）
- `toggleExpand()` 変更なし: expandedIdの切り替えのみ
- `collapseAll()` 変更なし: applyNodeView(rect, node, false) を呼ぶ（node.heightは既にCOLLAPSED_HEIGHT）

## 4. 影響範囲

### 4.1 修正ファイル
- `canvas_gen/viewer/viewer.js`
  - Line 6: COLLAPSED_HEIGHT定数追加
  - Line 137-143: Path A 高さ分岐
  - Line 204-210: Panel B 高さ分岐

### 4.2 影響を受ける要素
- 全nodeviewテンプレート（collapsed表示の高さが35pxに固定）
- 事前計算childrenを使用するノ(Path A)
- 動的計算childrenを使用するノ(Path)

### 4.3 影響を受けない要素
- `applyNodeView()` 関数本体（既存のexpandedパラメータをそのまま使用）
- `toggleExpand()` 本体内のexpanded高さ計算(Line 448-458)
- `collapseAll()` 関数（applyNodeViewを通るので自動的にCOLLAPSED_HEIGHT適用）
- `drawElement()` 関数（段階1で追加済み）

## 5. 状態遷移図

```
初期表示 (全てcollapsed):
  → render() → n.height = COLLAPSED_HEIGHT (35px) → 親rect = 35px
  → children描画: expandedId !== n.id → スキップ（段階1）
  → 結果: 35pxのノードにタイトルのみ表示

クリックして展開:
  → toggleExpand → expandedId = nodeId
  → render() → n.height = n.height || childH → 展開高さで再計算
  → children描画: expandedId === n.id → 実行
  → 結果: 展開状態

クリックして閉じる:
  → toggleExpand → expandedId = null
  → render() → n.height = COLLAPSED_HEIGHT (35px)
  → children描画: expandedId !== n.id → スキップ
  → collapseAll → rectを更新(35px)
  → 結果: 35pxのノードにタイトルのみ表示
```

## 6. テスト方針

### 6.1 手動テスト
- canvas viewerで複数のノードを表示
- 全てcollapsed時の高さが35pxになることを確認
- ノードをクリックして展開→childrenと共に元のサイズに戻ることを確認
- 再度クリックして縮小→35pxになることを確認

### 6.2 エッジケース
- シングルノード表示（childrenのみ）でexpanded状態から縮小
- character_card（y=8からy=90まで幅広いpills）の縮小時
- tag_bubble（円形node）の縮小時 - shape='round'の場合rx=18で維持される
- era_circle（円形node）の縮小時 - shape='circle'の場合rx=Math.min(w,h)/2で歪み防止

## 7. 問題の解決状況

### 7.1 collapsed時にタグpillsが描画される問題
- **段階1で解決済み**: `if (expandedId === n.id)` ガードによりchildren描画をスキップ

### 7.2 縮小時の縦長表示問題
- **段階2で解決済み**: collapsed時はCOLLAPSED_HEIGHT(35px)で固定
- character_card(120px指定)の場合: 128px → 35px に改善

## 8. 次の段階へ

段階2完了。段階3(Python事前計算の分離)に進む。
