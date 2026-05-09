# Viewer Rendering Fix — Decisions

## 設計判断の記録

### D1: 描画パイプラインとデータの分離

**判断**: `render()` 関数内で `n.width/n.height` をミューテートしない。

**理由**:
- Excalidrawの `Scene` パターンに従い、描画パイプラインは要素を「読むだけ」で変更しない
- Mike Bostockの「描画ロジックとデータの分離」パターンに従う
- 描画用ローカル変数（`childW`/`childH`）と永続データ（`n.width`/`n.height`）を明確に分離

**代替案**: 不変更新パターン（`newElementWith`）も検討したが、単一HTMLファイルの制約によりローカル変数での対応とした。

---

### D2: `expandedId` のリセット停止

**判断**: `render()` 最後で `expandedId=null` を設定しない。

**理由**:
- `expandedId` はユーザーの展開状態を保持するもので、`render()` 再呼び出し時にリセットすべきではない
- 状態変更は「(1) `toggleExpand()` が `expandedId` を更新、(2) `render()` を呼び出し、(3) `render()` は状態を読み取るだけ」という一方向フローで行う

**代替案**: `toggleExpand()` 内で `collapsedId=null;` のみで状態リセットとする。

---

### D3: `applyNodeView()` のフォールバックチェーン

**判断**: `expanded=false` 時に `td.node_width/td.node_height` を第一候補に使用する。

**理由**:
- ミューテート済みの `node.width/height` を使うと、元サイズが復元されない
- 型定義サイズ（`td.node_width/td.node_height`）が元サイズとして最も正確
- `COLLAPSED_HEIGHT` は縮小時の最小高さとして明示的に設定

**フォールバックチェーン**: `td.node_width/td.node_height` → `COLLAPSED_HEIGHT` → ハードコードデフォルト（200/120）

---

### D4: Path A にアイコン描画コードを追加

**判断**: Path A（事前計算済みchildren）にアイコン描画コードを追加する。

**理由**:
- character型ノードはPath Aを使用しているが、アイコンが描画されていなかった
- Path B（Line 249-270）と同一パターンで実装することで、一貫性を確保
- アイコンサイズ: `Math.min(childW, childH) * 0.45`
- anchor設定: `nv.layout?.iconAnchorX/Y` で指定（デフォルト: center）

**代替案**: 共通ヘルパー関数 `resolveIconAnchor()` を導入する案もあったが、既存コードとの統合を優先し直接追加とした。

---

### D5: 比率計算の基準値を型定義サイズに変更

**判断**: `toggleExpand()` の比率計算で `node.width/height` の代わりに `td.node_width/td.node_height` を使用する。

**理由**:
- `node.height=35`（COLLAPSED_HEIGHT）の場合、`ratio=160/35=4.57` となり崩壊する
- 型定義サイズ（160/120=1.33）を基準にすることで正常な比率計算が可能
- 展開→縮小サイクルでサイズが安定する

**代替案**: `node.height` がCOLLAPSED_HEIGHTの場合のみ型定義サイズを使用する案も検討したが、常に型定義サイズを使用する方がシンプル。

---

### D6: 5つのノード型に `expandMinW/expandMinH` を追加

**判断**: character_card, scenario_card, event_card, plain, tag_bubble に `expandMinW/expandMinH` を追加する。

**理由**:
- 型定義サイズと一致させることで、展開サイズが予測可能になる
- デフォルトの300x200を使用すると、型定義サイズ（例: 160x120）の約2倍になる

**設定値**:
| ノード型 | expandMinW | expandMinH |
|----------|-----------|-----------|
| character_card | 160 | 120 |
| scenario_card | 280 | 160 |
| event_card | 220 | 140 |
| plain | 200 | 120 |
| tag_bubble | 100 | 80 |

---

### D7: COLLAPSED_HEIGHT を 35→40 に調整

**判断**: `COLLAPSED_HEIGHT = 35` を `40` に調整する。

**理由**:
- フォントサイズ12px + titlePadY(6) * 2 + margin(14) = 40px
- コモンエディタのcollapsed最小高さ（30〜48px）の範囲内に収まる
- フォントサイズ14pxの場合も余裕を持って中央表示される

---

### D8: Python側テキスト幅推定にPillowベースの計測を採用しない

**判断**: Pillow `getlength()` による計測を断念し、CJK対応の文字別テーブル方式を採用する。

**理由**:
- Pillowの`getlength()`は単一のフォルトファイルのみを使用
- ブラウザの`measureText()`はシステムフォルトチェーンを使用して最適なフォルトを選択
- 両者の間に最大-23%の差異が生じる
- CJK対応の文字別テーブル方式（CJK: `font_size * 1.0`、ASCII: 文字別テーブル）で最大+9.9%の誤差に改善

**代替案**: fontTools `ttLib.TTFont` による正確なグリフ幅計測も検討したが、Pillowと同様にフォルトファイルの差異により精度が不安定。

---

### D9: `+4px` の追加を削除

**判断**: `_estimate_text_w_v2()` で `max(total + 4, ...)` としていたものを `max(total, ...)` に変更する。

**理由**:
- `+4px` の追加が誤差を+4%程度拡大していた
- 既存の文字別テーブルとCJK係数で十分な精度が得られる

---

### D10: CJK文字の判定に `_is_cjk()` 関数を使用

**判断**: CJK文字の判定に `_is_cjk()` 関数を追加し、`font_size * 1.0` 係数を適用する。

**理由**:
- CJK文字（日本語・中国語・韓国語）は全角（1em）として扱う
- Unicode範囲: 0x4E00-0x9FFF, 0x3040-0x309F, 0x30A0-0x30FF, 0x3400-0x4DBF, 0xAC00-0xD7AF, 0xFF00-0xFFEF, 0x3000-0x303F
- ヒューリスティック方式（0.55係数）ではCJK文字の幅が半分になる

---

### D11: `resolvePositions()` の padX * 2 二重加算を修正

**判断**: `el._cw = Math.max(maxRight, el._cw - padX * 2) + padX * 2;` に変更する。

**理由**:
- `_cw` が既にpaddingを含む場合、`padX * 2` が二重に加算される
- CSSボックスモデルにおける `content-box` と `border-box` の違いと同様に、どちらを基準にするかを明確に定義する必要がある

---

### D12: `drawElement()` テキスト条件を緩い比較に変更

**判断**: `parentEl.w === null` を `parentEl.w == null` に変更する。

**理由**:
- `=== null` では `undefined` を検出できない
- `== null` は `null` と `undefined` の両方を検出するJavaScriptのイディオム
- JSONから読み込まれたノードデータでは、未定義プロパティは `undefined` になる

---

### D13: 透過率のフォールバック値を設定

**判断**: `collapsedFillOpacity: 0.8`, `expandedFillOpacity: 1.0` を5つのnodeview JSONファイルに追加する。

**理由**:
- ユーザーにノードの状態を視覚的にフィードバックする標準的なUIパターン
- collapsed時は背景を半透明（0.8）にすることで「隠れたコンテンツがある」ことを示唆
- expanded時は完全不透明（1.0）で全コンテンツを明示
- 値が未定義の場合のフォールバックとして、コード側で `?? 0.8` / `?? 1.0` を設定
