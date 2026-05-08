# Exploration-3 結果：除外4タイプの描画理由の特定

## 概要
`nodeViewToChildren()` がnullを返すかどうかを判定し、それが描画の有無に直接影響することを特定した。

## 判定チェーン

```
Template に properties キーがある？
  ├─ なし → nodeViewToChildren() → null → 分岐2（appendChildあり） → 描画される
  └─ あり
       └─ 各 property の key が vault props に存在し、style キーがある？
            ├─ なし／styleがない → root.children.length=0 → null → 分岐2 → 描画される
            └─ あり && style="pill" → children有 → 分岐1 → **appendChildなし** → 描画されない
```

## 各タイプの詳細分析

### era（描画される）
- Template: `era_circle.json` → `properties` キーなし
- `nodeViewToChildren()` (648行目): `if (!nv.properties || typeof nv.properties !== 'object') return null;`
- null返すため分岐2 → **描画される**

### bmptest（描画される）
- Template: `bmp_test.json` → `properties` キーあり（Property1-4）
- vault: `test.md` → `Property1: "Value 1"` etc. → 全4Keyが一致
- `nodeViewToChildren()` (73行目): `for (const [key, propDef] of Object.entries(nv.properties))` ループ
- 各propDefに `style` キーがない → `if (propDef.style === 'pill' ...)` (681行目) → false
- `else if (propDef.style === 'text')` (710行目) → false
- root.childrenは空 → 728行目: `if (root.children.length === 0) return null`
- null返すため分岐2 → **描画される**

### organization（描画される）
- Template: `plain.json` → `properties` キーなし
- null返すため分岐2 → **描画される**

### tag（描画される）
- Template: `tag_bubble.json` → `properties` キーなし
- null返すため分岐2 → **描画される**

### character（描画されない）
- Template: `character_card.json` → `properties` キーあり（tags, ally, rival, dislikes, likes, mentor, family, affiliation）
- 各keyはすべて `style: "pill"` を持つ
- vault: `主人公.md` → `tags`, `ally`, `rival`, `dislikes`, `likes`, `mentor`, `affiliation` が定義されている
- nodeViewToChildren() で root.children が生成 → children.length > 0
- 分岐1（199-285行目）に進む → **appendChildなし** → **描画されない**

### scenario（描画されない）
- Template: `scenario_card.json` → `properties` キーあり（tags, characters, related）
- 各keyは `style: "pill"` を持つ
- vault propsにも同名keyが存在
- children生成 → 分岐1 → **描画されない**

### event（描画されない）
- Template: `event_card.json` → `properties` キーあり（tags, related, characters）
- 各keyは `style: "pill"` を持つ
- vault propsにも同名keyが存在
- children生成 → 分岐1 → **描画されない**

## 結論

**描画されない条件**：`nodeViewToChildren()` が `children.children.length > 0` を持つオブジェクトを返す場合、Path Bの分岐1に入り、appendChild漏れにより描画されない。

**修正箇所**：`viewer.js` 284行目（`rendered = true;` の前または後）に `mainG.appendChild(g);` を追加する必要がある。

## 推論ステップ

1. 各templateのpropertiesキーの有無を確認
2. character_card, scenario_card, event_cardは`style: "pill"`を持つ
3. vault propsとtemplate propertiesのkeyが一致するかを確認
4.一致すれば`nodeViewToChildren()`がchildrenを生成
5. children.length > 0の場合、Path Bの分岐1に入る
6. 分岐1にはappendChildがない → 描画されない

## 反証的検証

### 反証1：bmptestが描画されないケース
- Templateにpropertiesはあるがstyleキーがないため、children生成されずnullを返す
- これが正しければ、`properties`があっても`style:"pill"`がない場合は描画されるはず

### 反証2：vault propsに一致するkeyがないtemplateの挙動
- 例：`properties` に `family` があるがvault propsにない → root.childrenに追加されない
- 全keyがvault propsと一致しない場合 → root.children.length === 0 → null返す → 描画される
- 1つでもkeyが一致すればchildが生成され、children.length > 0 → 分岐1 → 描画されない

### 反証3：Path B 分岐1 のgの状態
- rect, title, icon, children要素はg.appendChildされている（232, 250, 273, 280-281行目）
- g自体はmainGに追加されていない → 画面上に表示されない
- これはDOMツリー構造の問題：gは作成されているが親に接続されていない

## 次の段階
フェーズ4：パイプライン処理とJSON出力の検証
- サーバーが返すJSONの実際の構造と、描画結果が一致するかを確認
- children属性の付加の有無と描画結果の相関を検証
