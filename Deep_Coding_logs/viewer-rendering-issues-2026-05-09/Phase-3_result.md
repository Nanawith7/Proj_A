# 探索段階3結果：toggleExpand()比率計算修正 + expandMinW/H追加

## 概要

`toggleExpand()` の比率計算を型定義サイズ基準に修正（P0-C5）し、5つのノード型に `expandMinW/expandMinH` を追加（P0-C6）した。

---

## 発見1: `toggleExpand()` の比率計算が COLLAPSED_HEIGHT を使っていた

### 問題コード
`viewer.js:486-487`:
```javascript
const ow=nv.shape==='circle'?minW:(node.width||200);
const oh=nv.shape==='circle'?minH:(node.height||120);
```

### 問題
- `node.width` は既にミューテート済み（展開後のサイズなど）
- `node.height` は COLLAPSED_HEIGHT (35px) の場合がある
- 比率計算が崩れ、展開サイズが異常に大きくなる

### 修正内容
`viewer.js:486-487`:
```javascript
const ow=nv.shape==='circle'?minW:(td.node_width||minW);
const oh=nv.shape==='circle'?minH:(td.node_height||minH);
```

- `td.node_width/td.node_height` を使用（型定義サイズ）
- 比率計算が正常化: 160/120 = 1.33

---

## 発見2: 5つのノード型が expandMinW/expandMinH を未定義

### 確認結果
| ノード型 | expandMinW | expandMinH | 型定義サイズ | 問題 |
|----------|-----------|-----------|-------------|------|
| character_card | なし | なし | 160x120 | ⚠️ デフォルト300x200使用 |
| scenario_card | なし | なし | 280x160 | ⚠️ デフォルト300x200使用 |
| event_card | なし | なし | 220x140 | ⚠️ デフォルト300x200使用 |
| plain | なし | なし | 200x120 | ⚠️ デフォルト300x200使用 |
| tag_bubble | なし | なし | 100x80 | ⚠️ デフォルト300x200使用 |

### 修正内容
各ノード型ファイルに `expandMinW/expandMinH` を追加:

| ノード型 | expandMinW | expandMinH | ファイル |
|----------|-----------|-----------|----------|
| character_card | 160 | 120 | nodeview/character_card.json |
| scenario_card | 280 | 160 | nodeview/scenario_card.json |
| event_card | 220 | 140 | nodeview/event_card.json |
| plain | 200 | 120 | nodeview/plain.json |
| tag_bubble | 100 | 80 | nodeview/tag_bubble.json |

---

## テスト結果

### 展開後サイズ
```javascript
// 展開後
主人公: {width: 596, height: 447}
```
- アスペクト比: 596/447 = 1.33 → 型定義の 160/120 = 1.33 と一致 ✅

### 縮小後サイズ
```javascript
// 縮小後
主人公: {width: 160, height: 35}
```
- COLLAPSED_HEIGHT に復元 ✅

### 3回展開→縮小サイクル後
```javascript
// 3回サイクル
expand: {width: 596, height: 447}
collapse: {width: 160, height: 35}
expand: {width: 596, height: 447}
collapse: {width: 160, height: 35}
expand: {width: 596, height: 447}
collapse: {width: 160, height: 35}
```
- ✅ サイズが完全に安定している！

### `render()` 呼び出し後も
```javascript
// beforeRender: {width: 596, height: 447}
// afterRender: {width: 596, height: 447}
```
- ✅ `render()` 呼び出し後もサイズが保持されている！

---

## 根本原因の分類

| 原因 | 影響する問題 | 深刻度 | 状態 |
|------|-------------|--------|------|
| **C5**: `toggleExpand()` の比率計算が COLLAPSED_HEIGHT を使う | P1 | P0 | ✅ 修正完了 |
| **C6**: 5つのノード型で `expandMinW/expandMinH` が未定義 | P1 | P1 | ✅ 修正完了 |

---

## 次回フェーズへの引き渡し

段階3完了。以下の問題が修正された:
1. `toggleExpand()` の比率計算が COLLAPSED_HEIGHT を使う（P0-C5）
2. 5つのノード型で `expandMinW/expandMinH` が未定義（P0-C6）

次の段階では、P2軽微修正（COLLAPSED_HEIGHT調整・padX*2修正・透過率追加）を実装する。

---

## 参照文献

- `canvas_gen/viewer/viewer.js` — メインレンダリングコード（Line 486-487: 比率計算）
- `Obsidian_test/vault/nodeview/*.json` — NodeView テンプレート（5ファイル修正）
