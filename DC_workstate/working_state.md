# Working State

## 現在の状態: 段階3完了

### 完了した段階
- **段階1**: Collapsed時Children描画ガード ✓ 完了
- **段階2**: Collapsed高さの固定値化 ✓ 完了
- **段階3**: Python事前計算の Expanded/Collapsed Children 分離 ✓ 完了

### 進行中の段階
- 阶段性

### 次の予定段階
- **段階4**: Text width推定精度改善
  - `_estimate_text_w()` の係数 `0.55` をプロポーショナル用に再調整
  - 許容誤差: 5%以内
- **段階5**: 統合テスト
  - JS viewerで`collapsed_children`参照処理を追加
  - 全nodeviewでcollapsed表示をテスト

### 各段階の成果物一覧
| 段階 | Phase-X_result.md | working_state.md | git commit | 状態 |
|------|-------------------|------------------|------------|------|
| 1    | 作成済み          | 更新済み         | 完了       | 完了 |
| 2    | 作成済み          | 更新済み         | 完了       | 完了 |
| 3    | 作成済み          | 更新済み         | 保留       | 完了 |

### 変更ファイル一覧（未コミット）
- `canvas_gen/pipeline.py`
  - Line 93: `pn.collapsed_children = []` 追加
- `canvas_gen/writer.py`
  - Line 60-61: `collapsed_children` シリアライズ追加

### 確定された詳細な要点（段階1-3まで）
1. `expandedId` グローバル変数がexpanded/collapsed状態管理の単一情報源（段階1）
2. Path AとPath Bの両方にcollapsed判定ガードを追加済み（段階1）
3. COLLAPSED_HEIGHT定数 = 35px（段階2）
4. `n.height` を直接書き換えることで `applyNodeView` との整合性を維持（段階2）
5. Python側で `collapsed_children` 空配列を生成済み（段階3）
6. JS viewerで `n.collapsed_children || []` フォールバックを追加する必要がある（段階4-5）
