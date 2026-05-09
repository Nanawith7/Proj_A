# Viewer Rendering Fix — Pitfalls

## 既知の問題点

### P1: `render()` 内の `n.width/n.height` ミューテート蓄積

**原因**: `render()` 関数内で `n.width = childW; n.height = childH;` が常時実行されていた。

**影響**:
- 初期描画: `n.height = COLLAPSED_HEIGHT` (35)
- 展開: `toggleExpand()` → `expH` 計算 → `applyNodeView()` → `n.height = expH`
- `render()` 再呼び出し: `n.height = COLLAPSED_HEIGHT` (35) ← 元サイズが失われる
- 次回展開: `node.height=35` → `ratio=160/35=4.57` → `expH` 計算が崩壊

**修正**: `viewer.js:144, 211` の代入を削除。描画は `childW`/`childH` ローカル変数のみを使用。

---

### P2: `render()` 最後で `expandedId=null` リセット

**原因**: `render()` 関数の最後で `expandedId=null;` が設定されていた。

**影響**:
- `toggleExpand()` で `expandedId=nid` を設定 → DOM更新
- `render()` が再呼び出しされると `expandedId=null` にリセット
- 次回描画で全てのノードが `COLLAPSED_HEIGHT` になる

**修正**: `viewer.js:351` の `expandedId=null;` を削除。

---

### P3: `applyNodeView()` がミューテート済み `node.width` を使う

**原因**: `applyNodeView()` で `nw=node.width||200` を使っていた。

**影響**:
- 展開後: `n.width=500, n.height=400`
- 縮小: `applyNodeView()` → `nw = node.width || 200 = 500`
- 元サイズ(160x120)ではなくミューテート値を使う

**修正**: `viewer.js:389-391` で `td.node_width/td.node_height` を使用し、`expanded=false` 時に `COLLAPSED_HEIGHT` を設定。

---

### P4: Path A にアイコン描画コードが欠落

**原因**: Path A（事前計算済みchildren）には親rect、タイトル、childrenのみの描画コードしか存在しなかった。

**影響**: character型ノード（Path A使用）にはアイコンが描画されなかった。era型ノード（Path B/B-2使用）にはアイコンが表示されていた。

**修正**: `viewer.js:184-205` にアイコン描画コードを追加。Path B（Line 249-270）と同一パターンで実装。

---

### P5: `toggleExpand()` の比率計算が COLLAPSED_HEIGHT を使う

**原因**: `toggleExpand()` の比率計算で `node.width/height` を使っていた。

**影響**:
- `node.height=35`（COLLAPSED_HEIGHT）
- `ratio = 160/35 = 4.57`（本来は 160/120 = 1.33）
- `expW = expH * ratio` → 展開サイズが異常に大きくなる

**修正**: `viewer.js:486-487` で `td.node_width/td.node_height` を使用。

---

### P6: 5つのノード型で `expandMinW/expandMinH` が未定義

**原因**: character_card, scenario_card, event_card, plain, tag_bubble の5つのノード型に `expandMinW/expandMinH` が定義されていなかった。

**影響**: デフォルトの 300x200 が使用され、型定義サイズ（例: 160x120）と一致しなかった。

**修正**: 5つのnodeview JSONファイルに `expandMinW/expandMinH` を追加。

---

### P7: Pillow `getlength()` はブラウザと完全に一致しない

**原因**: Pillowの`getlength()`は単一のフォルトファイルのみを使用。ブラウザの`measureText()`はシステムフォルトチェーンを使用して最適なフォルトを選択。

**影響**: Pillowベースの計測はブラウザ測定値と最大-23%の誤差を生じた。

**修正**: Pillowベースの計測を断念し、CJK対応の文字別テーブル方式に統一。CJK文字に `font_size * 1.0` 係数を適用。

---

### P8: `+4px` の追加が誤差を拡大していた

**原因**: `_estimate_text_w_v2()` で `max(total + 4, ...)` としていた。

**影響**: 誤差が+4%程度増加していた。

**修正**: `+4px` の追加を削除。`max(total, ...)` に変更。

---

### P9: `platform.system()` 使用によるフォルト検出

**原因**: `_find_system_font()` で `os.name` を使っていたが、Windowsでは "nt" を返す。

**影響**: フォルトファイルが見つからず、Pillow計測が機能しなかった。

**修正**: `platform.system()` を使用し、"Windows" をキーとして使用。

---

### P10: `resolvePositions()` の padX * 2 二重加算

**原因**: `el._cw = Math.max(maxRight, el._cw) + padX * 2;` で `_cw` が既にpaddingを含む場合、`padX * 2` が二重に加算される。

**修正**: `el._cw = Math.max(maxRight, el._cw - padX * 2) + padX * 2;` に変更。

---

### P11: `drawElement()` テキスト条件の厳密比較

**原因**: `parentEl.w === null` では `undefined` を検出できない。

**修正**: `parentEl.w == null` に変更。`== null` は `null` と `undefined` の両方を検出するJavaScriptのイディオム。

---

### P12: 展開→縮小サイクルでのサイズ安定性

**事実**: 5回の展開→縮小サイクル後もサイズが完全に安定している（width=160/596, height=40/447）。

**確認**: `render()` 呼び出し後もサイズが保持されている。
