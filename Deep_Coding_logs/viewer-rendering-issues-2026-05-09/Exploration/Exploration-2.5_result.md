# 探索段階2.5結果：Nodeviewスタイルと型定義のサイズ整合性調査

## 概要

Nodeviewテンプレートに定義されているcollapse時/expanded時のサイズ指定が、実際に使われているか、また型定義と整合しているかを調査した。

---

## 発見1: NodeviewテンプレートのexpandMinW/expandMinH未定義

### 問題
7つのNodeviewテンプレートの中で、`expandMinW` / `expandMinH` が定義されているのは2つだけ:

| Nodeviewテンプレート | expandMinW | expandMinH | 型定義幅 | 型定義高 | 問題 |
|---------------------|------------|------------|---------|---------|------|
| character_card | なし | なし | 160 | 120 | ⚠️ デフォルト300x200使用 |
| scenario_card | なし | なし | 280 | 160 | ⚠️ デフォルト300x200使用 |
| event_card | なし | なし | 220 | 140 | ⚠️ デフォルト300x200使用 |
| plain | なし | なし | 200 | 120 | ⚠️ デフォルト300x200使用 |
| tag_bubble | なし | なし | 100 | 80 | ⚠️ デフォルト300x200使用 |
| era_circle | 300 | 240 | 220 | 100 | ⚠️ 異なる |
| bmp_test | 380 | 280 | 220 | 100 | ⚠️ 異なる |

### 影響
- `toggleExpand()` では `expandMinW = nv.layout?.expandMinW ?? 300` (デフォルト300)
- `expandMinH = nv.layout?.expandMinH ?? 200` (デフォルト200)
- character型（160x120）の展開サイズが300x200になる → 型定義の約2倍

---

## 発見2: 実際の展開サイズが異常に大きい

### 現象
- character_card型（主人公）を展開後: `width=1494.86, height=327`
- 型定義: `160x120`
- 実際のサイズは型定義の約10倍

### 原因チェーン
```
1. 初期描画: n.height = COLLAPSED_HEIGHT (35)
2. toggleExpand():
   ow = node.width || 200 = 160
   oh = node.height || 120 = 35 (COLLAPSED_HEIGHT!)
   ratio = 160/35 = 4.57
   expW = 300 (デフォルト), expH = 200 (デフォルト)
   if (expW/expH > ratio) → 300/200=1.5 < 4.57 → false
   else → expW = expH * ratio = 200 * 4.57 = 914
   expW = Math.max(914, neededW) = 914+ (追加計算)
   expH = Math.max(327, neededH) = 327
```

検証結果:
```javascript
// 実際の計算値
linesCount: 18
maxLineW: 560
lineH: 277
neededW: 596
neededH: 313
ratio: 4.57
expW: 1494.86
expH: 327
```

---

## 発見3: collapsedFillOpacity/expandedFillOpacityの定義欠如

### 問題
`collapsedFillOpacity` / `expandedFillOpacity` が定義されているのは2つだけ:

| Nodeviewテンプレート | collapsedFillOpacity | expandedFillOpacity |
|---------------------|---------------------|---------------------|
| character_card | なし | なし |
| scenario_card | なし | なし |
| event_card | なし | なし |
| plain | なし | なし |
| tag_bubble | なし | なし |
| era_circle | 0.2 | 0 |
| bmp_test | 0.2 | 0 |

### 影響
- `applyNodeView()` で `opacity` が設定されない
- collapsed/expanded時の視覚的区別が機能しない

---

## 発見4: viewer.jsでの使用箇所

### expandMinW/expandMinH
- `viewer.js:459-460`: `toggleExpand()` の展開サイズ計算
```javascript
const minW = nv.layout?.expandMinW ?? 300;
const minH = nv.layout?.expandMinH ?? 200;
```

### collapsedFillOpacity/expandedFillOpacity
- `viewer.js:159, 226`: 縮小時の透過率設定
- `viewer.js:405`: `applyNodeView()` で透過率設定

---

## 根本原因の分類

| 原因 | 影響 | 深刻度 |
|------|------|--------|
| **C1**: character_card他5型がexpandMinW/H未定義 | 展開サイズがデフォルト300x200に | **P0** |
| **C2**: n.height=35で比率計算が崩れる | 展開サイズが1494x327に | **P0** |
| **C3**: collapsedFillOpacity/expandedFillOpacity未定義 | 透過効果が働かない | **P2** |

---

## 修正方針

### 修正1: 各NodeviewテンプレートにexpandMinW/expandMinHを追加（P0）

**character_card.json**:
```json
"layout": {
  "contentPadX": 10,
  "contentPadY": 10,
  "titlePadX": 10,
  "titlePadY": 6,
  "bodyPosition": {"x": 10, "y": 130},
  "expandMinW": 160,
  "expandMinH": 120
}
```

**scenario_card.json**:
```json
"layout": {
  ...
  "expandMinW": 280,
  "expandMinH": 160
}
```

**event_card.json**:
```json
"layout": {
  ...
  "expandMinW": 220,
  "expandMinH": 140
}
```

**plain.json**:
```json
"layout": {
  ...
  "expandMinW": 200,
  "expandMinH": 120
}
```

**tag_bubble.json**:
```json
"layout": {
  ...
  "expandMinW": 100,
  "expandMinH": 80
}
```

### 修正2: era_circle/bmptestのexpandMinW/Hを型定義と一致させる（P1）

**era_circle.json**:
```json
"expandMinW": 220,
"expandMinH": 100
```

**bmp_test.json**:
```json
"expandMinW": 220,
"expandMinH": 100
```

### 修正3: collapsedFillOpacity/expandedFillOpacityを追加（P2）

**character_card.json**:
```json
"layout": {
  ...
  "collapsedFillOpacity": 0.8,
  "expandedFillOpacity": 1.0
}
```

---

## 修正優先度

| 優先度 | 修正 | 理由 |
|--------|------|------|
| **P0** | 修正1: expandMinW/Hを追加 | 展開サイズが型定義と一致しない |
| **P1** | 修正2: era/bmptestのexpandMinW/Hを修正 | 型定義と異なる |
| **P2** | 修正3: collapsedFillOpacityを追加 | 透過効果が働かない |

---

## 次回フェーズへの引き渡し

段階2.5完了。以下の問題が特定された:
1. character_card他5型がexpandMinW/H未定義（P0）
2. n.height=35で比率計算が崩れる（P0）
3. collapsedFillOpacity/expandedFillOpacity未定義（P2）

次の段階では、これらの修正を実装する。

---

## 参照文献

- `Obsidian_test/vault/nodeview/*.json` — Nodeviewテンプレート
- `Obsidian_test/vault/_types/type_definitions.yml` — 型定義
- `canvas_gen/viewer/viewer.js` — メインレンダリングコード
