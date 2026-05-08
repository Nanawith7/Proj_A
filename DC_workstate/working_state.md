# Working State

## 現在の状態: 段階2完了

### 完了した段階
- **段階1**: Collapsed時Children描画ガード ✓ 完了
- **段階2**: Collapsed高さの固定値化 ✓ 完了

### 進行中の段階
- 阶段性

### 次の予定段階
- **段階3**: Python事前計算の分離
  - collapsed用children配列の生成
  - `pn.children` (expanded用) と `pn.collapsedChildren` (collapsed用) の2系統
- **段階4**: Text width推定精度改善
- **段階5**: 統合テスト

### 各段階の成果物一覧
| 段階 | Phase-X_result.md | working_state.md | git commit | 状態 |
|------|-------------------|------------------|------------|------|
| 1    | 作成済み          | 更新済み         | 完了       | 完了 |
| 2    | 作成済み          | 更新済み         | 保留       | 完了 |
| 3    | 保留              | 保留             | 保留       | 未着手 |

### 変更ファイル一覧（未コミット）
- `canvas_gen/viewer/viewer.js`
  - Line 6: `const COLLAPSED_HEIGHT = 35;` 追加
  - Line 138-142: Path Aにcollapsed高さ分岐追加
  - Line 205-209: Path Bにcollapsed高さ分岐追加

### 確定された詳細な要点（段階1-2まて）
1. `expandedId` グローバル変数がexpanded/collapsed状態管理の単一情報源
2. Path AとPath Bの両方にcollapsed判定ガードを追加済み（段階1）
3. COLLAPSED_HEIGHT定数 = 35px（段階2）
4. `n.height` を直接書き換えることで `applyNodeView` との整合性を維持
5. 段階3では、Python側でcollapsed用children配列を生成する
