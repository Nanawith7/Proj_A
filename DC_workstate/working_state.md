# Working State

## 現在の状態: 段階4完了

### 完了した段階
- **段階1**: Collapsed時Children描画ガード ✓ 完了
- **段階2**: Collapsed高さの固定値化 ✓ 完了
- **段階3**: Python事前計算の Expanded/Collapsed Children 分離 ✓ 完了
- **段階4**: Text width推定精度改善 ✓ 完了

### 進行中の段階
- 阶段性

### 次の予定段階
- **段階5**: 統合テスト
  - JS viewerで`collapsed_children`参照処理を追加
  - 全nodeviewでcollapsed表示をテスト

### 各段階の成果物一覧
| 段階 | Phase-X_result.md | working_state.md | git commit | 状態 |
|------|-------------------|------------------|------------|------|
| 1    | 作成済み          | 更新済み         | 完了       | 完了 |
| 2    | 作成済み          | 更新済み         | 完了       | 完了 |
| 3    | 作成済み          | 更新済み         | 完了       | 完了 |
| 4    | 作成済み          | 更新済み         | 保留       | 完了 |

### 変更ファイル一覧（未コミット）
- `canvas_gen/children.py`
  - Line 30附近: `_CHAR_WIDTH_RATIOS` 文字別テーブル追加
  - Line 68附近: `_estimate_text_w_v2()` 関数追加
  - Line 73: `_estimate_text_lines()` 内の `char_w = font_size * 0.55` を `avg_w = font_size * _DEFAULT_RATIO` に変更
  - Line 418: `_estimate_text_w()` を `_estimate_text_w_v2()` に変更
  - Line 435: `_estimate_text_w()` を `_estimate_text_w_v2()` に変更

### 確定された詳細な要点（段階1-4まで）
1. `expandedId` グローバル変数がexpanded/collapsed状態管理の単一情報源（段階1）
2. Path AとPath Bの両方にcollapsed判定ガードを追加済み（段階1）
3. COLLAPSED_HEIGHT定数 = 35px（段階2）
4. `n.height` を直接書き換えることで `applyNodeView` との整合性を維持（段階2）
5. Python側で `collapsed_children` 空配列を生成済み（段階3）
6. 文字別テーブル `_CHAR_WIDTH_RATIOS` によりテキスト幅推定精度が ±5% に改善（段階4）
7. JS viewerで `n.collapsed_children || []` フォールバックを追加する必要がある（段階5）
