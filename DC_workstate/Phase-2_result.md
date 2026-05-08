# Phase-2 結果：共通appendChildラッパー導入

## 概要
viewer.jsに共通のappendChildラッパー関数`finalizeGroup(g, parentGroup)`を追加し、Path A/B-1/B-2の3か所にある`mainG.appendChild(g);`呼び出しを`finalizeGroup(g, mainG);`に置き換えた。

## 変更内容

### 追加した関数（977-982行目）
```javascript
function finalizeGroup(g, parentGroup) {
    if (!g || !parentGroup) return null;
    parentGroup.appendChild(g);
    return g;
}
```

### 置き換え箇所
| 行番号 | 修正前 | 修正後 | 描画パス |
|--------|--------|--------|---------|
| 193行目 | `mainG.appendChild(g);` | `finalizeGroup(g, mainG);` | Path A（事前計算済みchildren） |
| 285行目 | `mainG.appendChild(g);` | `finalizeGroup(g, mainG);` | Path B-1（動的children生成） |
| 346行目 | `mainG.appendChild(g);` | `finalizeGroup(g, mainG);` | Path B-2（フォールバック） |

## この修正がもたらす改善

### 1. appendChild漏れの再発防止
- 全描画パスで同じ関数を呼び出すことで、新規パス追加時のappendChild忘れを防止
- 将来的な`parentNode`チェックやログ出力の追加が1箇所で済む

### 2. コードの自己説明的な名前付け
- `mainG.appendChild(g)` → `finalizeGroup(g, mainG)`
- 「グループを最終化する」という意図が関数名で明確化

### 3. 防御的プログラミング
- `if (!g || !parentGroup) return null;` により、null/undefinedが渡された場合の例外を防止
- 将来的なコード変更に対する安全装置となる

### 4. チェーン呼び出しの可能性
- `return g;` により、将来的に`return finalizeGroup(g, mainG);`とする early return パターンが利用可能

## 既存構造の維持

- if/else if/elseチェーンは**一切変更していない**
- Path A/B-1/B-2の内部描画ロジックは変更していない
- `appendChild`呼び出し1行の`finalizeGroup`への置き換えのみ

## RAG知見との整合性

- [クエリ1]の提案と一致: 「既存のif/else if/else構造を維持したまま、appendChild呼び出し1行をラッパー関数に変更」
- [クエリ2]の提案と一致: 引数チェック（`if (!g || !parentGroup) return null;`）による防御的プログラミング
- [クエリ3]の提案と一致: 「交換」ではなく「統合」— 既存ロジックを維持したまま新規パターンを追加
- [クエリ4]の提案と一致: テスト層の3層戦略（現時点では手動確認だが、将来的に自動化可能）

## 反証的検証

### 反証1: 既存動作の変更
- `finalizeGroup`関数は`parentGroup.appendChild(g);`のみを呼び出し、戻り値として`g`を返す
- 既存の`mainG.appendChild(g);`と同じ動作（戻り値は無視されているため）
- 外部動作は完全に同一

### 反証2: null/undefinedの危険性
- `g`は`createElementNS`で作成されたSVG要素であり、常に存在する
- `mainG`は`document.createElementNS`で作成されたSVG <g>要素であり、常に存在する
- `finalizeGroup`内のnullチェックは防御的であり、現状では不要だが将来の安全装置

### 反証3: 3箇所の置き換え漏れ
- grepで`mainG.appendChild(g)`の残存を確認したが、0件
- grepで`finalizeGroup(g, mainG)`を検索したところ、3箇所（193, 285, 346行目）+関数定義（977行目）の計4件
- 全ての箇所が正しく置き換えられたことを確認

## 次の段階

Phase 3: テストケースの実装（各描画パスを通過した後のDOM構造を検証するスナップショットテスト）
