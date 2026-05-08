# 探索段階4結果：テキスト未描画の原因調査

## 概要

`drawElement()` の条件分岐が事前計算済みchildrenでテキスト描画をスキップする問題を確認した。

---

## 発見1: タイトルテキストは描画されている

### 検証結果
```javascript
// SVG内のtext.node-title要素
{
  titleCount: 61,
  titles: [
    {text: "主人公", x: "1585", y: "271.5", fill: "#fff"},
    {text: "四天王A", x: "1935", y: "271.5", fill: "#fff"},
    ...
  ]
}
```

タイトルテキストは正しく描画されている。

---

## 発見2: `drawElement()` のテキスト描画条件

### 条件コード
`viewer.js:940`:
```javascript
if (parentEl.text && (parentEl.w === null || !parentEl.children)) {
```

### 事前計算済みchildrenのデータ構造
```json
{
  "label": "tags",
  "text": "[[main]], [[human]], [[knight]]",
  "pill": true,
  "cw": 160,
  "ch": 22,
  "ax": 10,
  "ay": 8
}
```

### 条件評価
- `parentEl.text` → true（"[[main]], [[human]], [[knight]]"）
- `parentEl.w` → undefined（w は設定されていない）
- `parentEl.w === null` → `false`（`undefined === null` は false）
- `parentEl.children` → undefined
- `!parentEl.children` → `true`
- 全体: `true && (false || true)` = `true` → テキスト描画される

### 結論
条件自体は通る。ただし潜在的な問題がある:
- `parentEl.children` が空配列 `[]` の場合、`![]` は `false`
- `parentEl.w === null` も `false`
- 全体: `false` → テキスト描画されない！

---

## 発見3: 実際のテキスト未描画の原因

### 原因
P3 の「テキスト未描画」は **独立したバグではなく、P1/P2（サイズ暴走/縮小）の結果** である。

### 原因チェーン
```
1. render() で n.height = COLLAPSED_HEIGHT (35)
2. ノードが非常に小さくなる（160x35）
3. children は expandedId===n.id の時のみ描画される
4. expandedId=null なので children は描画されない
5. 結果: テキスト（children の pill 要素）が見えない
```

---

## 根本原因の分類

| 原因 | 影響する問題 | 深刻度 |
|------|-------------|--------|
| **C1**: `expandedId=null` で children が描画されない | P3 | **P0**（P2の結果） |
| **C2**: `parentEl.w === null` の厳密比較 | 潜在的バグ | **P2** |

---

## 修正方針

### 修正1: `drawElement()` の条件を緩い比較に変更（P2）

**変更前**:
```javascript
if (parentEl.text && (parentEl.w === null || !parentEl.children)) {
```

**変更後**:
```javascript
if (parentEl.text && (parentEl.w == null || !parentEl.children)) {
  // == で緩く比較（undefined も null も true）
}
```

### 修正2: P2（expandedId リセット停止）で同時に修正

`expandedId=null` を修正すれば、children の描画も正常化される。

---

## 結論

P3 の「テキスト未描画」は独立したバグではなく、P1/P2 の結果として発生している。
P2（縮小時に異常に小さくなる）を修正すれば同時に解決する。

---

## 次回フェーズへの引き渡し

段階4完了。P3 は独立したバグではないことが確認された。

次の段階では、これらの修正を実装する。
