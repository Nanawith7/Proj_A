# 圧縮後に実行すべきタスク

## 次のフェーズ: 段階6 - レンダリングエンジン検証

### 必須タスク
1. **viewer.js の children パス検証**
   - サーバー起動: `python -m canvas_gen.main --vault Obsidian_test/vault --serve-viewer`
   - ブラウザで `http://127.0.0.1:8765/` を開く
   - propertiesを持つノード（character_card等）が children 描画されるか確認
   - propertiesを持たないノードが既存描画されるか確認

2. **template.html の既存描画検証**
   - `template.html` の既存描画パスが壊れていないか確認
   - 既存描画が正しく動作するか目視確認

3. **template.html で nodeview テンプレートロードを実装**
   - `window._allNodeviews` を実装
   - `/api/nodeview/{name}.json` から動的ロード
   - `loadNodeViewsAsync()` 関数追加

### コマンド例
```bash
# テストボルトでサーバー起動（ポート8765）
cd E:\LLLLMS\Proj_A
python -m canvas_gen.main --vault Obsidian_test/vault --serve-viewer timeline.canvas:8765

# ブラウザで確認
# http://127.0.0.1:8765/ → Index (viewer.js)
# http://127.0.0.1:8765/template.html → Index (template.html)
```

### 期待される結果
- propertiesを持つノード → children描画でpills表示
- propertiesを持たないノード → 既存描画（ rect + title + icon ）
- 両方が混在して正しく描画される
- 既存描画が壊れていない

### 失敗する場合のデバッグ
1. ブラウザコンソールでエラー確認
2. `nodeViewToChildren` の戻り値確認
3. `computeChildrenLayout` の計算結果確認（`console.log(children._cw, children._ch)`）

---

## フェーズ7: テンプレートロード実装

### 必須タスク
1. **template.html で loadNodeViewsAsync() を実装**
   - `fetch('/api/nodeview/{name}.json')` でテンプレートを取得
   - `window._allNodeviews` にキャッシュ
   - 描画前に完遂ロード

2. **viewer.js の既存 `loadNodeViews()` を確認**
   - viewer.js は既に `loadNodeViews()` を実装済み
   - template.html でも同じロジックをコピペ

### コード例
```javascript
async function loadNodeViewsAsync() {
  const allNodeviews = {};
  const names = [...new Set(Object.values(TYPEDEFS).map(td => td.nodeview).filter(Boolean))];
  for (const name of names) {
    try {
      const resp = await fetch(`/api/nodeview/${name}.json`);
      allNodeviews[name] = await resp.json();
    } catch (e) {
      allNodeviews[name] = {shape:'rect',rx:4};
    }
  }
  return allNodeviews;
}

// renderGraph() の最初で:
window._allNodeviews = await loadNodeViewsAsync();
renderGraph(FILE_NODES, ALL_EDGES);
```

---

## フェーズ8以降

### フェーズ8: pipeline.py統合
- pipeline.py ステップ7（layout）に新childrenエンジンを接続
- 既存`compute_layout()` と新`resolvePositions()` を統合

### フェーズ9: 統合テスト
- テストボルトで両方のノードタイプ混在表示

### フェーズ10: ドキュメント最適化
- AGENTS.md + 仕様書更新

---

## 現在の作業ファイル
- `canvas_gen/viewer/viewer.js` ← children描画統合済み
- `canvas_gen/viewer/template.html` ← children描画統合済み（nodeview未対応）
- `test_children/layout.js` ← レイアウトエンジン（参照用）
- `test_children/render.js` ← 描画エンジン（参照用）
- `Obsidian_test/vault/nodeview/*.json` ← テンプレート
