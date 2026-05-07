test_cases.md
# レイアウトエンジン テストケース & バグレポート

## 概要

children_layout.html のリファクタリング後、各種テストケースでレイアウト計算の崩れを調査。

---

## BUG #1: `_isManual` 子が `measureElement` で親サイズに含められる

**状態**: 🔴 FIX REQUIRED  
**影響度**: 高 — ドラッグ配置子が親のサイズを不正に膨張させる

### 再現ステップ
1. 親要素作成（auto-size, w=null, h=null）
2. 通常子追加（w=50, h=20）
3. `_isManual=true` の子追加（w=200, h=50, _ax=300, _ay=200）
4. `measureElement(parent)`
5. 親サイズ: w=220 (期待: 70)、h=76 (期待: 36)

### 原因
`measureElement` の children ループで `_isManual` チェック未実装。  
`_isManual` 子の `_cw` / `_ch` が `maxChildW` / `maxChildHForHeight` に加算される。  
`resolvePositions` で `_isManual` を除外しようとするが、`measureElement` 時点で既に親サイズが膨張済み。

### 修正方針
- `measureElement` のchildrenループで `child._isManual === true` のケースを除外
- 除外時は `maxChildW` / `maxChildHForHeight` に加えない
- 既存の「自動レイアウトのみで親サイズを決定」の意図を維持

---

## BUG #2: `measureElement` ≠ `resolvePositions` の高さ計算不一致

**状態**: 🟡 設計上のトレードオフ  
**説明**: `measureElement` では `maxChildHForHeight`（最大子高さ）を使用するが、  
`resolvePositions` でauto-stacked子（xRel/yRel未指定）を縦積みすると  
`maxBottom`（最後のbottom位置）で親高さを計算するため、両者の値が異なる。

- `measureElement`: parent_h = `maxChildHForHeight + padY*2`（横並び可能性考慮）
- `resolvePositions`: parent_h = `maxBottom + padY*2`（縦積み確定後）

これは「auto-stack 子は縦積みされる」という設計意図に沿った動作。  
ただし `measureElement` の値と一致しないため、`computeLayout` 収束ループで1〜2回の追加 iteration が必要。

**対応**: 修正不要。既存設計の意図通り。

---

## FIX #3: 固定幅親 × auto幅子（子 > 親）

**状態**: PASS（既存設計の仕様）  
**説明**: 親 w が固定値の場合、子幅が親より大きくても親サイズを変更しない。  
`measureElement` で `w !== null` の時 `w = Math.max(el.w, 20)` を使用するため child の _cw は無視される。  
children_layout.html AGENTS.md に「固定w/hの子は親サイズに影響しない」と明記あり。

---

## テストケース一覧

### TC001: ParseRelative (基本) — PASS ✓

| 入力 | 期待値 | 結果 |
|------|--------|------|
| `left-10` | `{dir:'left', val:10, isOutside:false}` | ✓ |
| `right-5` | `{dir:'right', val:5, isOutside:false}` | ✓ |
| `top-3` | `{dir:'top', val:3, isOutside:false}` | ✓ |
| `bottom-8` | `{dir:'bottom', val:8, isOutside:false}` | ✓ |
| `-10` | `{dir:'abs', val:-10, isOutside:false}` | ✓ |
| `15` | `{dir:'abs', val:15, isOutside:false}` | ✓ |
| `null` | `null` | ✓ |
| `''` | `null` | ✓ |
| `'invalid'` | `null` | ✓ |

### TC002: ParseRelative (double-dash = outside) — PASS ✓

| 入力 | 期待値 | 結果 |
|------|--------|------|
| `left--10` | `{dir:'left', val:10, isOutside:true}` | ✓ |
| `right--10` | `{dir:'right', val:10, isOutside:true}` | ✓ |
| `top--5` | `{dir:'top', val:5, isOutside:true}` | ✓ |
| `bottom--8` | `{dir:'bottom', val:8, isOutside:true}` | ✓ |

### TC003: ResolveRelX (parentW=400) — PASS ✓

| パース結果 | 期待値 | 結果 |
|-----------|--------|------|
| `left-10` + childW=100 | 10 | ✓ |
| `right-10` + childW=100 | 290 | ✓ |
| `-5` + childW=100 | -5 | ✓ |
| `null` + childW=100 (center) | 150 | ✓ |
| `left--10` + childW=100 | -110 | ✓ |
| `right--10` + childW=100 | 410 | ✓ |

### TC004: ResolveRelY (parentH=300) — PASS ✓

| パース結果 | 期待値 | 結果 |
|-----------|--------|------|
| `top-5` + childH=30 | 5 | ✓ |
| `bottom-10` + childH=30 | 260 | ✓ |
| `null` + childH=30 | 0 | ✓ |
| `top--20` + childH=50 | -70 | ✓ |
| `bottom--20` + childH=20 | 320 | ✓ |

### TC005: Two-Pass Positioning (inside vs outside) — PASS ✓

**設定**: inside子(w=80,h=30) + outside子(w=60,h=25,xRel='right--30')

| 項目 | 結果 | 期待 |
|------|------|------|
| inside _ax | 10 | 10 |
| inside _ay | 8 | 8 |
| outside _ax | 140 | 140 (parent_cw+30) |
| parent _cw | 110 | ~110 (inside child + padding) |

### TC006: Auto-Stack Siblings — 設計どおり △

**設定**: 3子(auto-size, textあり)、gapY=5

| フェーズ | h | 備考 |
|---------|---|------|
| measureElement | 47 | maxChildHForHeight=31 + 16 |
| resolvePositions | 127 | 縦積み後 maxBottom=111 + 16 |

→ auto-stack 子は縦積み、親は最終子 bottom に拡大（AGENTS.md記載仕様）

### TC007: Right-Pinned Children — PASS ✓

**設定**: 2子 xRel='right-10' / 'right-5'、すべて yRel=null

| 項目 | 結果 |
|------|------|
| measure w | 100 |
| resolve w | 100 (unchanged) |

right-pinned 子は parent width  expansion に影響しない（仕様通り）。

### TC008: Bottom-Pinned Child — PASS ✓

**設定**: 1子 yRel='bottom-5', xRel=null

親 h=17 (bottom-pinned 子の height による expansion なし)。

### TC009: Fixed w Parent × Auto Child — PASS (仕様)

**設定**: parent w=50, child text='Hello world'

| 項目 | 結果 |
|------|------|
| parent _cw | 50 |
| child _cw | 79 |

child > parent 許容（既存仕様）。

### TC010: Fixed w + Long Text (child > parent) — PASS (仕様)

**設定**: parent w=40, child text='This text is very wide', fontSize=14

| 項目 | 結果 |
|------|------|
| parent _cw | 40 |
| child _cw | 154 |

child > parent 許容。

### TC011: Text Auto-Wrap — PASS ✓

**設定**: parent w=150, child w=150, text='This is wrapped text...'

| 項目 | 結果 |
|------|------|
| child _cw | 120 |
| child _ch | 76 |

auto-wrap 有効（fixed w で auto h）。

### TC012: Both Fixed - Text Shrink — PASS ✓

**設定**: w=80, h=40, text='Long text'

| 項目 | 結果 |
|------|------|
| _cw | 80 (fixed) |
| _ch | 40 (fixed) |

### TC013: Both Fixed - Text Clip — PASS ✓

**設定**: w=80, h=40, textOverflow='clip'

テキスト切り捨て有効。

### TC014: Sibling Relative Size (child-Label) — PASS ✓

**設定**: A: text='Hello', B: wRel='child-A'

| 項目 | 結果 |
|------|------|
| A _cw | ~47 |
| B _cw | ~47 (A matching) |

### TC015: Depth-Search for child-Label — PASS ✓

**設定**: GrandParent.children=[DeepChild[children=[Inner]]], sibling wRel='child-DeepChild'

| 項目 | 結果 |
|------|------|
| DeepChild _cw | 70 |
| Match _cw | 70 (一致) |

findElementByLabel は parent スコープから depth-first search している。

### TC016: Circular Relative Size — PASS ✓

**設定**: A(w=100), B(wRel='child-A'), C(wRel='child-B')

| 子 | w |
|----|---|
| A | 100 |
| B | 100 |
| C | 100 |

chain resolution で最終的に Aのサイズを継承。

### TC017: Negative Gap — PASS ✓

**設定**: gapY=-10, 3子 (50x30, 40x20, 30x40)

| 項目 | 結果 |
|------|------|
| parent _cw | 80 |
| parent _ch | 94 |
| children y | 8, 28, 38 (負のギャップ適用) |

### TC018: Outside Left Position — PASS ✓

**設定**: xRel='left--20'

| 項目 | 結果 |
|------|------|
| child _ax | -20 (親左端の外側) |

### TC019: Non-Existent Sibling Ref — PASS ✓

**設定**: wRel='child-NonExistent'

| 項目 | 結果 |
|------|------|
| child _cw | 36.38 (変更なし) |

findElementByLabel が null を返すため child._cw 維持。

### TC020: Deeply Nested (6 levels) — PASS ✓

**設定**: 各レベル1子、6段ネスト

| 項目 | 結果 |
|------|------|
| 計測時間 | 0ms |
| 無限ループ | なし |

### TC021: Many Siblings (20 children) — PASS ✓

**設定**: parent w=300, 20子 (80x20)

| 項目 | 結果 |
|------|------|
| parent _ch | 519 |
| 計測時間 | 0ms |

### TC022: Zero Dimensions — PASS ✓

**設定**: w=0, h=0

| 項目 | 結果 |
|------|------|
| _cw | 20 (最小値) |
| _ch | 20 (最小値) |

### TC023: No Children Property — PASS ✓

**設定**: children未定義

| 項目 | 結果 |
|------|------|
| _cw | 50 (w=50 from makeEl) |
| _ch | 50 (h=50 from makeEl) |

### TC024: Empty Children Array — PASS ✓

| 項目 | 結果 |
|------|------|
| Before measure | _cw=0, _ch=0 |
| After measure | _cw=100, _ch=100 |

w=100, h=100 固定なので適用される。

### TC025: Text-Only Width — PASS ✓

| 項目 | 結果 |
|------|------|
| textW | 317.67 |
| _cw | 337.67 (textW + padX*2) |

### TC026: Parent with Text AND Children — PASS ✓

| 項目 | 結果 |
|------|------|
| parent _cw | 230 |
| text='I have text too', child w=200 |

---

## まとめ

| カテゴリ | 件数 | 内容 |
|---------|------|------|
| 問題なし | 23 | 既存設計の意図通り動作 |
| 設計トレードオフ | 1 | auto-stack 高さ計算不一致（computeLayout収束で対応） |
| **要修正** | 1 | `_isManual` 子が measureElement で親サイズに含められる |
