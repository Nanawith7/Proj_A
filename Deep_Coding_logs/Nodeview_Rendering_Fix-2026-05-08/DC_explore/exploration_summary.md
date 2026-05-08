# Exploration Summary — NodeView Rendering Fix (2026-05-08)

## 目的
Canvas viewer (http://127.0.0.1:8765/) において、type era/bmptest/organization/tag 以外のノード（character/scenario/event）が一切描画されないバグの調査および原因特定。

## 探索フェーズ：フェーズ0-1〜5（全5段階）

### 段階一覧

| 段階 | タイトル | 状態 | 主要知見 |
|------|----------|------|---------|
| 1 | サーバー起動フロー追跡 | 完了 | start.bat → server.py（pipeline未通過）→ viewer.js |
| 2 | ノード描画ロジック解析 | 完了 | Path B 分岐1にappendChild漏れを特定 |
| 3 | 除外4タイプの特定 | 完了 | properties+style="pill"ノードが分岐1に進む |
| 4 | パイプライン処理検証 | 完了 | serve-viewerはpipelineを完全にスキップ |
| 5 | フィルター動作検証 | 完了 | フィルターは描画不全と無関係 |

## バグ原因

**location**: `canvas_gen/viewer/viewer.js` line 284（`rendered = true;` の直前または直後）

**problem**: Path B, 分岐1（Dynamic children rendering path: lines 199-285）の末尾に `mainG.appendChild(g);` が存在しない。

**cause**: `nodeViewToChildren(nv, v)` が `children.children.length > 0` を持つオブジェクトを返す場合、分岐1に入るが、gがmainGに追加されずSVGツリーに接続されないため、画面上に描画されない。

**condition**: Templateに`properties`キーが含まれ、その中に`style: "pill"`を持つkeyがvault propsに存在する場合→children生成→分岐1→描画されない。

## 修正案

`viewer.js` 284行目に `mainG.appendChild(g);` を追加する。

```javascript
// Before (line 283-284)
        }
        rendered = true;
      }

// After
        }
        mainG.appendChild(g);
        rendered = true;
      }
```

## 影響ノード

| Type | Template | Properties | vault props match? | Children generated? | Rendered? |
|------|----------|-----------|-------------------|-------------------|-----------|
| character | character_card | あり (style="pill") | あり (tags, ally, rival...) | はい | ❌ されない |
| scenario | scenario_card | あり (style="pill") | あり (tags, characters, related) | はい | ❌ されない |
| event | event_card | あり (style="pill") | あり (tags, related, characters) | はい | ❌ されない |
| era | era_circle | なし | - | いいえ | ✅ される |
| bmptest | bmp_test | あり (styleなし) | あり (Property1-4) | いいえ | ✅ される |
| organization | plain | なし | - | いいえ | ✅ される |
| tag | tag_bubble | なし | - | いいえ | ✅ される |

## 補足知見（フェーズ4）

serve-viewerはpipeline.run()を呼び出さないため、canvasファイルのchildren属性はそのままAPIに渡される。start.batで--node-viewsフラグを使わない場合、pipeline step 7b（children pre-computation）が実行されない。

## 反証的検証

1. Path A（pre-computed children）にはappendChildがあるため、children属性付きノードは正しく描画される
2. timeline.canvasにはchildren属性なしの全ノード → 全ノードがPath Bに流入
3. 分岐1（appendChildなし）と分岐2（appendChildあり）の条件は明確
