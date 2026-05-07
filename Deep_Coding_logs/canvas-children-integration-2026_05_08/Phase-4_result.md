# Phase 4 Result: 変換レイヤー設計

## ノードビューテンプレートの変換可能パターン

### Type A: `properties` 付き四角形（character_card/event_card/scenario_card）
```json
{"shape":"rect", "properties":{"tags":{"style":"pill","position":{"x":10,"y":8}}}}
→ 変換: propertiesの各キーを children: [{pill要素}] に
```

### Type B: 円形（era_circle/bmp_test）
```json
{"shape":"circle", "properties":{...}, "layout":{"iconAnchorX":"center"}}
→ children+iconAnchor維持
```

### Type C: `properties` なし（plain.json/tag_bubble.json）
```json
{"shape":"rect", "rx":4}
→ そのまま使用（childrenなし既存描画）
```

## nodeViewToChildren 関数設計

```javascript
function nodeViewToChildren(nv, nodeData) {
  // properties を children に変換
  // props.key  → children[i].text = value
  // position.x/y → children[i].xRel/yRel（簡易変換）
  // pill形状 → children[i].rx (diamond:4, round:10, rect:3)
  // fill/bg  → children[i].fill
  // 戻り値: { label, shape, rx, stroke, strokeWidth, fill, text, fontSize, textColor, w, h, gapY, children: [...] }
}
```

## 変換後の構造
```json
{
  "shape": "rect",
  "children": [
    {
      "label": "tags",
      "shape": "rect",
      "rx": 3,
      "fill": "#fff1",
      "text": "tag1",
      "textColor": "#eee",
      "fontSize": 11,
      "w": null, "h": null,
      "xRel": "left-20",  // position.x 簡易変換
      "yRel": "top-18"    // position.y 簡易変換
    }
  ]
}
```

## 変換関数の注意点
- xRel の絶対値変換: `position.x:10` → `xRel='left-10'`
- % 位置: `position.x: "10%"` → `xRel='left-10'`（簡易変換）
- プロパティ値の埋め込み: `nodeData.props[key]` → `children[].text`
- 展開時のボディ描画: `toggleExpand()` は既存を維持

## テストケース
| テスト項目 | input | expected children |
|------------|-------|-------------------|
| pill with 1 property | `{"properties": {"tag": {"style": "pill"}}}` | `[label: "tag", text: value, yRel: "top-16"]` |
| pill with position | `{"properties": {"tag": {"position": {"x": 10, "y": 8}}}}` | `[xRel: "left-10", yRel: "top-8"]` |
| pill with % position | `{"properties": {"tag": {"position": {"x": "10%", "y": "5%"}}}}` | `[xRel: "left-10", yRel: "top-5"]`（簡易変換） |
| no properties | `{"shape": "rect"}` | `children: []`（既存描画） |

## 変換関数のリスク評価
| 項目 | リスク | 対応 |
|------|--------|------|
| % position の変換 | 簡易変換では正確でない | 厳密なパーセント計算は次回更新で対応 |
| 既存ピルの横並び | 縦積みになる | `gapX` 対応を次回追加 |
| テキストスタイルのプロパティ | テキストが折り返さない可能性 | `textOverflow: "shrink"` 適用 |
