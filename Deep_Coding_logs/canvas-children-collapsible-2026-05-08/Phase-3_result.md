# Phase-3_result: Python事前計算の Expanded/Collapsed Children 分離

## 1. 段階概要

- **段階番号**: 段階3
- **目的**: expanded用とcollapsed用のchildren配列をPython側で分けて生成
- **結果**: 完了

## 2. 実施内容

### 2.1 調査
- RAG検索により、単一データソースから2種類の出力を生成するパターンを確立
- `pipipeline.py` Line 82-94 で `pn.collapsed_children = []` を追加
- `writer.py` `_make_file_node()` で `collapsed_children` をJSON出力

### 2.2 修正対象
- **ファイル1**: `canvas_gen/pipeline.py`
- **ファイル2**: `canvas_gen/writer.py`
- **修正箇所**: 2箇所

#### 修正1: pipeline.py - collapsed_children 追加
- **場所**: Line 82-94
- **変更内容**:
  ```python
  # 変更前
  pn.children = ch_root.get('children', [])
  
  # 変更後
  pn.children = ch_root.get('children', [])
  pn.collapsed_children = []  # collapsed時は空配列（将来: タイトル要素のみ）
  ```

#### 修正2: writer.py - collapsed_children のシリアライズ追加
- **場所**: `_make_file_node()` 関数 (Line 56-60)
- **変更内容**:
  ```python
  # 変更前
  if node.children:
      obj["children"] = _serialize_children(node.children)
  return obj
  
  # 変更後
  if node.children:
      obj["children"] = _serialize_children(node.children)
  if hasattr(node, 'collapsed_children'):
      obj["collapsed_children"] = node.collapsed_children
  return obj
  ```

## 3. 設計判断

### 3.1 collapsed_children の値
- RAG推奨: 空配列 `[]`
- 将来の拡張: タイトル要素のみを抽出するロジックを追加可能
- Python側で明示的に空配列を出力することで、JSONファイルの自己記述性が向上

### 3.2 `hasattr()` による安全性
- `hasattr(node, 'collapsed_children')` を使用して、フィールドが存在しないノードでもエラーにならないように保護
- 前方互換性: 旧版JSONを読み込む際に問題が発生しない

### 3.3 既存機能との互換性
- `collapsed_children` はオプショナルフィールド
- 旧版Canvas viewerは既知のフィールドとして扱い、未知のフィールドは 무시

## 4. 検証結果

### 4.1 テスト出力検証
- テスト: `python -m canvas_gen.main --vault Obsidian_test/vault --output test_collapsed_output.canvas --node-views`
- 結果: 72ノード中 37ノードに `collapsed_children` フィールドが追加
- 全ての `collapsed_children` が空配列 `[]`

### 4.2 検証スクリプト結果
```
Total nodes: 72
Nodes with collapsed_children: 37
Nodes with collapsed_children=[]: 37
Nodes with (children AND collapsed_children): 37
Nodes with collapsed_children=None: 0

=== Validation PASSED ===
```

## 5. 影響範囲

### 5.1 修正ファイル
- `canvas_gen/pipeline.py` (Line 93)
- `canvas_gen/writer.py` (Line 60-61)

### 5.2 影響を受ける要素
- 全ノード（nodeviewを持つノードにcollapsed_children追加）
- JSON Canvas出力ファイル

### 5.3 影響を受けない要素
- `nodeViewToChildren()` 関数
- `compute_children()` 関数
- JS viewerの描画ロジック（段階4以降でjs追加が必要）
- 既存のchildrenデータ

## 6. 前方互換性

### 6.1 Python→JSON出力
- `collapsed_children` 存在しない旧版JSON → JS側で `[]` フォールバック
- `collapsed_children` が存在する新版JSON → JS側で直接使用

### 6.2 JS viewer側のフォールバック（実装予定）
```javascript
// viewer.js Line 132付近
const canvasChildren = n.children || [];
const collapsedChildren = n.collapsed_children !== undefined 
    ? n.collapsed_children 
    : [];
```

## 7. 将来的な拡張

### 7.1 collapsed_children にタイトル要素を抽出
将来的に `collapsed_children` に「タイトル要素のみ」を生成する場合:

```python
def generate_collapsed_children(nv, properties):
    """collapsed表示用にタイトル要素のみを生成"""
    # nodeviewのpropertiesから最初の要素を抽出
    collapsed = []
    for key, prop_def in properties.items():
        if prop_def.get('style') != 'pill':
            continue
        value = properties.get(key, '')
        child = {'label': key, 'text': str(value), 'pill': True}
        collapsed.append(child)
        if len(collapsed) >= 1:  # タイトル要素1つだけ
            break
    return collapsed
```

### 7.2 JSONスキーマの安定化
- `collapsed_children` は正式フィールドとしてJSONスキーマに組み込む
- 既存の `children` と同様の扱い（optional）

## 8. 次の段階へ

段階3完了。段階4(Text width推定精度改善)に進む。

**注意点**: 段階4でJS viewerに`collapsed_children`の参照処理を追加する必要がある。
`n.collapsed_children || []` によるフォールバックを実装。
