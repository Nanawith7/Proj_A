# Phase-1 結果：最小修正によるバグ修正

## 概要
`viewer.js` Path B-1（動的children生成パス）の末尾に `mainG.appendChild(g);` を追加し、character/scenario/eventノードの描画不全を修正。

## 修正内容

**ファイル**: `canvas_gen/viewer/viewer.js`
**行番号**: 285行目（追加）
**変更差分**:
```diff
         rendered = true;
+        mainG.appendChild(g);
       }
```

## 修正箇所詳細

```
// Before (line 283-285)
         rendered = true;
       }

// After (line 284-286)
         rendered = true;
         mainG.appendChild(g);
       }
```

## この修正が働く理由

Path B-1 は以下の条件で通过する:
- `n.children` が存在しない（事前計算済みchildrenなし）
- `nodeViewToChildren(nv, v)` が `children.children.length > 0` を返す
  → テンプレートに properties キーがあり、vault props に一致する key の中に style="pill" が存在

このパスでは g 要素に子要素（rect, title, icon, children要素）が追加されていたが、`mainG.appendChild(g)` が呼ばれていなかったため、g が DOM ツリーに接続されず画面に表示されなかった。

## 修正後の状態

| 描画パス | 内容 | appendChild | 結果 |
|---------|------|-------------|------|
| Path A | 事前計算済みchildren | あり（193行目） | ✅ 変更なし |
| Path B-1 | 動的children生成 | **追加済**（285行目） | ✅ 修正済み |
| Path B-2 | フォールバック | あり（346行目） | ✅ 変更なし |

## 影響を受けるノードタイプ

| Type | 修正後 |
|------|--------|
| character | ✅ 描画される |
| scenario | ✅ 描画される |
| event | ✅ 描画される |
| era | ✅ 描画される（変更なし） |
| bmptest | ✅ 描画される（変更なし） |
| organization | ✅ 描画される（変更なし） |
| tag | ✅ 描画される（変更なし） |

## 検証方法

viewerサーバーを再起動し、以下を手動で確認:
1. ブラウザで `http://127.0.0.1:8765/` にアクセス
2. character/card のノードが表示されることを確認
3. scenario / event のノードが表示されることを確認
4. DevTools Consoleで以下のコマンドを実行し、DOMチェーンを確認:
   ```javascript
   const g = document.querySelector('g[data-node-id="主人公"]');
   console.log(g.parentNode); // mainGであるべき
   ```

## RAG知見との整合性

- [クエリ1]の提案と一致: 「二重追加防止チェックは不要」。`mainG.innerHTML = ''` により毎回流れがクリアされるため安全。
- [クエリ4]の提案と一致: 「appendChildはcreateElementNS後の最終段階で実行」。今回の修正は既にgが構築された後のappendChildであるため問題なし。

## 反証的検証

### 反証1：二重追加の可能性
- viewer.jsでは`render()`関数冒頭で`mainG.innerHTML = ''`を呼び出すため、前回の描画で追加されたg要素は常に削除される
- したがって、appendChildが二重に呼ばれることはない

### 反証2：appendChildが失敗する可能性
- gは`createElementNS('http://www.w3.org/2000/svg', 'g')`で作成された純粋SVG要素
- 現在parentNodeはnull（mainGに追加されていない）
- 正常に追加される

### 反証3：Path B-2との衝突
- Path B-1で`rendered = true`がセットされた後、`if (!rendered)` ブロック（288行目）は実行されない
- Path B-2のappendChildは実行されないため、重複しない

## 次の段階

Phase 2: 共通appendChildラッパー `finalizeGroup()` の導入による構造的改善
