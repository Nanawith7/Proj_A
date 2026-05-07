# 最終統合レポート：既存canvas viewerへの新childrenシステム統合

## 1. 概要

既存のcanvas generator + viewerシステム（Python + HTML/JS）に対し、test_children/プロジェクトで開発されていたChildren Layout Engineを、後方互換性を保ちながら統合した。

### 背景
- **既存システム**: `canvas_gen/`によるVault → Canvas JSON変換、`viewer/viewer.js`によるブラウザ描画
- **新システム**: `test_children/`の開発したchildrenレイアウトエンジン（measure → resolvePositions → drawElement）
- **課題**: 既存の描画を壊さず、childrenを持つノードのみ新しい描画パスを採用する

### 総括
- **全10段階**（段階0〜10）で計画を実行
- **サーバーサイド計算**（Python）でchildren配置を事前計算し、**クライアントサイド描画**（JavaScript）で表示
- **後方互換性**を確保し、`--node-views`フラグで新旧の描画を制御可能

---

## 2. 主要知見（段階ごと）

### 段階0: 計画立案
- Canvas JSONのchildren埋め込み方式を提案（既存API破壊なし）
- 10段階計画を策定、ユーザー承認済み

### 段階1: 既存ビューアレンダリング解析
- `viewer/server.py` → `viewer.js` → SVG描画の完全把握
- 既存Canvasにはchildren情報なし（フラット配置）

### 段階2: test_children解析
- 8ファイル（layout.js, render.js, text.js等）の関係をマッピング
- 核心：`computeLayout() → measureElement() → resolvePositionsTree() → drawElement()`

### 段階3: 差異分析・統合設計
- **C案採用**（既存保持 + 新childrenオプション）
- 既存ノードは既存描画、propertiesありノードのみ新描画
- main変更：`viewer.js`のみ、`server.py`は変更なし

### 段階4: 変換レイヤー設計
- `nodeViewToChildren(nv, nodeData)`関数設計
- Type A（properties四角）、Type B（円形）、Type C（なし）の3パターン
- `position.x:10 → xRel: "left-10"`マッピング

### 段階5: レンダリングエンジン実装
- `viewer.js`にchildren描画パス追加
- `computeChildrenLayout()`を3イテレーションで収束

### 段階5.1-A: viewer.js修正
- `drawElement()`関数をchildren描画に統合
- `_wrapText`/`_measureText`を追加
- `const`→`let`修正（browser cache error対応）

### 段階5.1-B: template.html修正
- `drawElement()`関数を追加（renderGraph()ベース）
- `loadNodeViewsAsync()`を1秒フォールバック付きで実装

### 段階6: レンダリングエンジン検証
- **58ノード描画成功**: 37.rects + 166.el-groups
- 両描画パスが正常に混在して動作確認

### 段階7: テンプレートロード実装
- `window.NODEVIEWS`をグローバルにバインド
- `template.html` + `viewer.js`の両方でテンプレートロード完了

### 段階8: pipeline.py統合（children server-side計算）
- **`canvas_gen/children.py`新規作成**（419行）
  - Python版childrenレイアウトエンジン
  - `nodeViewToChildren()` + `compute_children()` 実装
- **pipeline.pyステップ7b追加**: 既存layout後、children計算を自動化
- **viewer.js Path A追加**: pre-computed childrenを直接描画
- **テスト結果**: 37ノード×（平均4.5子）= 166子要素が正しく埋め込まれることを確認

### 段階9: 統合テスト
- **JSON構造比較**: Old(42KB) vs New(110KB) で58/72ノード、152エッジ
- **ブラウザ描画**: 58親rect + 166子rect + 152エッジ = 正しく描画されることを確認
- **後方互換性**: --node-viewsなしで既存Canvasが正常に表示されることを確認

---

## 3. 統合的設計／実装

### システムアーキテクチャ
```
┌─ Vault (Obsidian Notes) ────────────────────────────────┐
│  - Frontmatter (tags, ally, rival, ...)                 │
│  - _types/type_definitions.yml (nodeview mapping)       │
│  - nodeview/*.json (properties → pill definitions)      │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─ Pipeline (Python) ─────────────────────────────────────┐
│  1. include-matching                                    │
│  2. filter/exclude/sort                                 │
│  3. layout-params                                       │
│  4. icons                                               │
│  5. edges → generate_edges(...)                         │
│  6. prune-orphans                                       │
│  7. layout → compute_layout(...) [既存]                 │
│  7b. children-calculate → nodeViewToChildren()          │
│           → compute_children() [新]                     │
│  8. write_canvas → childrenシリアライズ                 │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─ Canvas JSON ───────────────────────────────────────────┐
│  {                                                       │
│    "nodes": [                                            │
│      {                                                   │
│        "id": "protagonist",                              │
│        "x": 0, "y": 0, "width": 160, "height": 120,     │
│        "children": [                                     │
│          {"label": "tags", "ax": 10, "ay": 8,           │
│           "cw": 160, "ch": 22, "pill": true, ...},      │
│          {"label": "ally", "ax": 10, "ay": 30, ...},    │
│          ...                                             │
│        ]                                                 │
│      },                                                  │
│      { /* plain node */ }                                │
│    ],                                                    │
│    "edges": [...]                                         │
│  }                                                        │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─ Viewer (browser) ──────────────────────────────────────┐
│  viewer.js init(): /api/data fetch                      │
│  ┌────────────────────────────────────────────────────┐ │
│  │ currentNodes.forEach(n => {                         │ │
│  │   const ch = n.children;                            │ │
│  │   if (ch && ch.length > 0) {                        │ │
│  │     // Path A: Pre-computed children                │ │
│  │     drawElement(child, g, nx + ax, ny + ay);        │ │
│  │   } else {                                          │ │
│  │     // Path B: Existing or dynamic children         │ │
│  │     // ...                                           │ │
│  │   }                                                 │ │
│  │ })                                                   │ │
│  └────────────────────────────────────────────────────┘ │
│  Template HTML: /template.html (server-embedded JSON)   │
└─────────────────────────────────────────────────────────┘
```

### 主要関数一覧

#### 1. `nodeViewToChildren(nv, nodeData)` — [children.py:101]
```python
def nodeViewToChildren(nv, nodeData):
    """Convert nodeview template properties → children array."""
    # propertiesの各キーを children: [{label, text, pill, ...}] に変換
    # position.x/y → xRel: "left-10"/yRel: "top-N"
    # pill → rx: 4(diamond)/10(round)/3(default)
```

#### 2. `compute_children(child, parent_w, parent_h)` — [children.py:145]
```python
def compute_children(node_children, parent_w, parent_h):
    """Compute absolute positions for children of a parent node."""
    # Pass 1: inside children测量 + 配置 → 親サイズ算出
    # Pass 2: outside children配置
    # Return: _cw, _ch, _ax, _ay (pre-computed layout)
```

#### 3. `parse_rel(rel)` — [children.py:58]
```python
def parse_rel(raw):
    """Parse relative position string."""
    # "left-10" → {'dir': 'left', 'val': 10, 'is_outside': False}
    # "right--10" → {'dir': 'right', 'val': -10, 'is_outside': True}
```

#### 4. `drawElement(parentEl, parentGroup, ox, oy)` — [viewer.js:885]
```javascript
function drawElement(parentEl, parentGroup, ox, oy) {
    // ax/ay/cw/chをox/oyに加算して absolute 位置に配置
    // shape, rect, text, children再帰描画
}
```

### 設計決定（5つ）

1. **サーバーサイド計算方式を採用**
   - Pythonでlayout計算（ブラウザ非依存の`_estimate_text_w/`等）
   - Canvas JSONにax/ay/cw/chを埋め込む
   - ブラウザはpre-computed dataを直接描画

2. **後方互換性**
   - `--node-views`フラグで新旧の描画を制御
   - --node-viewsなし：既存の描画のみ
   - --node-viewsあり：children付き描画 + fallback Path B

3. **ハイブリッド描画パス**
   - Path A（pre-computed）：`n.children`があれば直接描画
   - Path B（fallback）：`nodeViewToChildren()`→`computeChildrenLayout()`

4. **key正規化**
   - Python: `ax/ay/cw/ch`（アンダースコアあり）
   - JS: `ax/ay/cw/ch`（アンダーストリップして出力）

5. **childrenシリアライズ**
   - `_ax`/`_ch` → `ax`/`ch`（内部キーの外部公開）
   - `writer.py`の`_serialize_children()`で自動変換

---

## 4. テスト結果サマリー

| テスト | 期待値 | 実際 | 状態 |
|--------|-------|------|------|
| JSON構造比較（ノード数） | 72/72 | 72/72 | ✅ |
| JSON構造比較（エッジ数） | 152/152 | 152/152 | ✅ |
| childrenノード有無 | 0/37 | 0/37 | ✅ |
| children要素数 | 0/166 | 0/166 | ✅ |
| ブラウザ描画（親rect） | 58 | 58 | ✅ |
| ブラウザ描画（子rect） | 166 | 166 | ✅ |
| ブラウザ描画（エッジ） | 152 | 152 | ✅ |

---

## 5. 既知の課題

1. **テキスト幅推定**: Python `_estimate_text_w()` がブラウザ実測と異なる場合あり
2. **% position**: `position.x: "10%"` は簡易変換のみ（不正確）
3. **Large SVG描画**: 4880x2980のviewBoxをブラウザが部分的にのみ描画（CSSサイズ問題）
4. **GapX**: 横間隔は未実装（fixed 5px gapYのみ）

---

## 6. 変更ファイル一覧

| ファイル | 行数 | 変更内容 |
|---------|------|---------|
| `canvas_gen/children.py` | 419 | Python版childrenレイアウトエンジン（新規） |
| `canvas_gen/models.py` | +1 | PositionedNode.children, TypeDefinition.nodeview |
| `canvas_gen/pipeline.py` | +15 | node_views追加、children計算（ステップ7b） |
| `canvas_gen/config.py` | +1 | TypeDefinition.nodeview読み込み |
| `canvas_gen/writer.py` | +10 | childrenシリアライズ |
| `canvas_gen/main.py` | +10 | --node-views CLI引数 |
| `canvas_gen/viewer/viewer.js` | +50 | pre-computed children Path A |
| `canvas_gen/viewer/template.html` | +40 | loadNodeViewsAsync, drawElement |
| `AGENTS.md` | +30 | Childrenシステム仕様書追加 |

---

## 7. 参照文献一覧

1. **test_children/layout.js** — レイアウト計算エンジン（363行）
   - `measureElement()`, `resolvePositions()`, `computeLayout()`
2. **canvas_gen/pipeline.py** — キャンバス生成パイプライン（93行）
   - `run()`, `compute_layout()`
3. **canvas_gen/children.py** — Python版childrenエンジン（419行）
   - `nodeViewToChildren()`, `compute_children()`, `parse_rel()`
