# Exploration-2 結果：ノード描画ロジックの解析

## 概要
`viewer.js` の描画ロジックを解析し、type character/scenario/event が描画されず、type era/bmptest/organization/tag が描画される原因を特定した。

## 発見：Path B の Dynamic children rendering path に mainG.appendChild(g) がない

### 描画構造

**Path A**（136-193行目）：`n.children` が pre-computed childrenを持つノード → `mainG.appendChild(g)` あり（193行目）

**Path B**（194-346行目）：pre-computed childrenなしの全ノードがここに流入

→ `nodeViewToChildren(nv, v)` 呼び出し（196行目）

**分岐1**：`children && children.children && children.children.length > 0`（199-285行目）
  - Parent rectを描画
  - Titleを描画
  - Iconを描画（あれば）
  - Childrenを描画（expandedな場合）
  - `rendered = true` をセット
  - **`mainG.appendChild(g)` が存在しない** ← Bug!

**分岐2**：`if (!rendered)`（287-346行目）
  - Parent rectを描画
  - Titleを描画
  - Iconを描画（あれば）
  - **`mainG.appendChild(g)` あり**（345行目）

### 各タイプの挙動

| Type | nodeview template | properties? | `nodeViewToChildren()` の結果 | 描画パス | 結果 |
|-------|------------------|-------------|------------------------------|---------|------|
| era | era_circle | なし | null | 分岐2 | ✅ 描画される |
| bmptest | bmp_test | あり | vaultに property1-4 あり → children有 | 分岐1? | ✅ 描画される（要検証、vault側がproperty1-4を持っているか） |
| organization | plain | なし | null | 分岐2 | ✅ 描画される |
| tag | tag_bubble | なし | null | 分岐2 | ✅ 描画される |
| character | character_card | あり | vaultに tags, ally, rival, likes 等 → children有 | **分岐1** | ❌ 描画されない（appendChildなし） |
| scenario | scenario_card | あり | vaultに tags, characters, related → children有 | **分岐1** | ❌ 描画されない（appendChildなし） |
| event | event_card | あり | vaultに tags, related, characters → children有 | **分岐1** | ❌ 描画されない（appendChildなし） |

### 原因と修正方針

**原因**：Path B, 分岐1（199-285行目）の末尾に `mainG.appendChild(g);` がないため、`nodeViewToChildren()` が children.children.length > 0 を返すノードが描画されない。

**修正**：284行目（`rendered = true;` の直前または直後）に `mainG.appendChild(g);` を追加する。

## 補足：フィルタ動作との関係
- フィルターはサーバーサイドの `/api/filter` で実行され、`currentNodes` と `currentEdges` を更新する
- フィルター後のエッジ減少はフィルターロジックが正常に動作している証拠
- ノード描画不全（character/scenario/event）とは無関係。フィルターは `children` 属性の有無によらず全ノードに適用される

## 推論ステップ

1. **描画フローの全体把握**：`render()` 関数 (line 98) → Path A/B の分岐
2. **全ノードの `children` 属性確認**：timeline.canvas の全ノードに `children` 属性なし → 全ノードが Path B に流入
3. **nodeViewToChildren() の実装解析** (line 647)：template に `properties` ありかつ vault に該当 key が存在 → children 生成
4. **各 template の properties 有無確認**：
   - plain: なし
   - era_circle: なし
   - tag_bubble: なし
   - bmp_test: あり (Property1-4)
   - character_card: あり (tags, ally, rival, dislikes, likes, mentor, family, affiliation)
   - scenario_card: あり (tags, characters, related)
   - event_card: あり (tags, related, characters)
5. **描画パスのappendChild有無確認**：
   - Path A: あり
   - Path B 分岐1: **なし**
   - Path B 分岐2: あり
6. **各タイプの分岐結果の対応確認**：描画されるタイプ ≒ 分岐に入るタイプ ≒ properties なし。描画されないタイプ ≒ 分岐に入るタイプ ≒ properties あり

## 推論の反証的検証

### 反証1：Path B 分岐1 の rect と title が描画されているかどうか
- 検証方法：ブラウザの DevTools で SVG 要素を確認
- 予想：`<rect>` や `<text>` は g 内に追加されているが、g が mainG に追加されていないため画面に表示されない
- 検証結果を確認する必要がある

### 反証2：character/scenario/event に vault 側に children が既に書かれている可能性
- timeline.canvas を確認したが、全ノードに children 属性なし
- Path A ではなく Path B に入ることは確定

### 反証3：Path B 分岐1 (199-285行目) の g の利用
- 214行目：`g.appendChild(pRect);`
- 250行目：`g.appendChild(txt);`
- 273行目：`g.appendChild(img);`
- 280-281行目：`drawElement(child, g, nx, ny);`
- g には子要素が追加されているが、g 自体が mainG に追加されていない

## 次の段階
フェーズ1：描画される4タイプとされない3タイプの具体的なchildren生成ロジックの検証
- browser console で `nodeViewToChildren()` を直接呼び出し、出力を確認
- character/scenario/event の VAULT データで実際に children が生成されることを確認

修正のフェーズは実行フェーズのため、今回の探索フェーズでは触れない。
