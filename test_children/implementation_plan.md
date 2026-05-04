# 実装プラン: Recursive NodeView Test HTML

## フェーズ1: データモデル + レイアウトエンジン（検証用ユニット）

### 1.1 データ構造
```javascript
{
  id, type, label,          // 識別情報
  shape: 'rect'|'circle',   // 形状
  rx, fill, stroke, strokeWidth,  // スタイル
  text, fontSize, textColor, textAlign,  // テキスト（全要素に付与）
  bgImage,                   // 背景画像
  w, h,                      // サイズ: null=auto, 数値=固定px
  xRel, yRel,                // 相対位置: "left-10", "right-5", "-5", null=auto
  gapY,                      // 子要素間のギャップ
  children: [],              // 子要素
  zIndex                     // 描画順序
}
```

### 1.2 レイアウトアルゴリズム（2パス）

**Pass 1: measureElement(el)** - 下位互換測定
- fixed w/h → その値を使用
- auto → childrenの最大幅 / textの測定幅 を使用
- 再帰的にchildrenを測定

**Pass 2: resolvePositions(parent)** - 上位互換位置解決
- 各childについて:
  - w/hがautoならmeasureElementで計算
  - xRel/yRelを親のbounding boxで解決
  - autoなら横中央、縦は上からgapYでスタック
- 再帰的に子の子も解決

**Pass 3: expandAutoParents(parent)** - 自動親拡大
- w/hがautoの親について、childrenが収まるサイズに拡大

## フェーズ2: SVGレンダリング（検証用ユニット）

### 2.1 drawElement(el, svgGroup, offsetX, offsetY)
- background画像描画（bgImageがあれば）
- shape矩形/円描画（fill/stroke/rx適用）
- text描画（fontSize/textColor/textAlign適用）
- childrenがあれば再帰描画

## フェーズ3: エディタUI

### 3.1 ツリービュー
- 階層構造を再帰的に表示
- 選択状態のハイライト
- 展開/折りたたみ
- 削除ボタン

### 3.2 プロパティパネル
- 選択要素のプロパティを一括編集
- リアルタイム反映（oninput）

### 3.3 ツールバー
- Box/Circle/ImageBG/Text追加ボタン

## フェーズ4: ドラッグ＆ドロップ

### 4.1 SVGキャンバス上のドラッグ
- mousedown → 要素選択 + ドラッグ開始
- mousemove → 位置更新（xRel/yRel再計算）
- mouseup → ドラッグ終了

### 4.2 相対位置の自動変換
- ドラッグ後の絶対座標を親基準の相対座標に変換して保存

---

## デバッグ計画

各フェーズ完了後:
1. フェーズ1: `console.log`でmeasure/resolveの結果を検証
2. フェーズ2: SVGが正しく描画されるか目視確認
3. フェーズ3: UI操作でJSONが正しく更新されるか検証
4. フェーズ4: ドラッグで要素が正しく移動するか検証

## 既存nodeviewとの互換性

- 既存テンプレートのproperties → children自動変換関数を実装
- 同じJSONスキーマを使用するため、既存nodeviewファイルを読み込んで表示可能
