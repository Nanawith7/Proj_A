# NodeView 仕様書（nodeviewシステム完全把握）

## 1. 概要

NodeViewはObsidianのマークダウンノートに適用される**視覚テンプレート**システム。
各ノードタイプ(character, scenario, event等)が1つのnodeviewテンプレートにマッピングされる。

## 2. データフロー

```
Obsidian Vault (.md + YAML frontmatter)
    ↓ (extractor.py: BFS wiki-link走査)
NoteNode { stem, file_path, title, node_type, properties, wikilinks }
    ↓ (pipeline.py: 7段階処理)
PositionedNode { ... , x, y, width, height }
    ↓ (writer.py: Canvas JSON出力)
Obsidian Canvas (.canvas)
    ↓ (viewer/server.py: HTTP配信)
Viewer (viewer.js: SVGレンダリング + パン/ズーム/展開)
```

## 3. NodeView JSON スキーマ（現状）

### 3.1 トップレベルプロパティ

| プロパティ | 型 | 既定値 | 説明 |
|---|---|---|---|
| `shape` | `"rect"` \| `"circle"` \| `"round"` | `"rect"` | 形状。round=rx18、circle=円 |
| `rx` | number | `4` | 角半径（circleでは無視） |
| `stroke` | string (hex) | `"#fff6"` | 枠線色 |
| `strokeWidth` | number | `0.5` | 枠線幅 |
| `fontSize` | number | `12` | デフォルトフォントサイズ |
| `titleY` | `"center"` \| `"top"` | `"center"` | タイトル垂直位置 |
| `boldTitle` | boolean | `false` | タイトル太字 |
| `titleWrap` | boolean | `false` | タイトル折り返し |
| `titlePad` | number | `6` | レガシーパディング |
| `background` | string | `""` | 背景画像ファイル名（_viewbg/配下） |

### 3.2 layoutオブジェクト

| プロパティ | 型 | 既定値 | 説明 |
|---|---|---|---|
| `contentPadX` | number | `8` | コンテンツ左右パディング |
| `contentPadY` | number | `8` | コンテンツ上下パディング |
| `titlePadX` | number | `6` | タイトル左右パディング |
| `titlePadY` | number | `6` | タイトル上下パディング |
| `collapsedFillOpacity` | number | `1` | 折りたたみ時の塗りつぶし不透明度 |
| `expandedFillOpacity` | number | `1` | 展開時の塗りつぶし不透明度 |
| `backgroundOpacity` | number | `0.15` | 背景画像の不透明度 |
| `expandMinW` | number | `300` | 展開時の最小幅 |
| `expandMinH` | number | `200` | 展開時の最小高さ |
| `titleColor` | string (hex) | `"#e94560"` | タイトルテキスト色 |
| `bodyColor` | string (hex) | `"#ddd"` | ボディテキスト色 |
| `titlePosition` | `{x, y}` | 自動 | タイトル位置（%またはpx） |
| `bodyPosition` | `{x, y}` | 自動 | ボディ位置（%またはpx） |
| `iconAnchorX` | `"left"` \| `"center"` \| `"right"` | `"center"` | アイコン水平アンカー |
| `iconAnchorY` | `"top"` \| `"center"` \| `"bottom"` | `"center"` | アイコン垂直アンカー |
| `iconPadX` | number | `0` | アイコン水平パディング |
| `iconPadY` | number | `0` | アイコン垂直パディング |
| `expandedIconAnchorX` | string | 継承 | 展開時アイコン水平アンカー |
| `expandedIconAnchorY` | string | 継承 | 展開時アイコン垂直アンカー |
| `expandedIconPadX` | number | 継承 | 展開時アイコン水平パディング |
| `expandedIconPadY` | number | 継承 | 展開時アイコン垂直パディング |
| `expandedIconSize` | number | 自動 | 展開時アイコンサイズ |

### 3.3 propertiesオブジェクト

各プロパティはノートのfrontmatterキーに対応。

```json
{
  "propertyName": {
    "style": "pill" | "text",     // ピルまたはプレーンテキスト
    "shape": "round" | "diamond" | "rect",  // ピルの形状
    "bg": "#ffffff44",             // ピルの背景色（RGBA hex）
    "textColor": "#ffffffcc",      // テキスト色
    "position": {                  // 絶対/パーセント位置
      "x": "10%",                  // または数値px
      "y": "30"                    // または数値px
    }
  }
}
```

## 4. 描画システム（viewer.js）

### 4.1 コールプド状態
- shapeで指定された矩形/円を描画
- fillはtype_definitions.ymlのcolorを使用
- stroke/strokeWidth/wxを適用
- タイトルを中央配置（titleY="top"の場合は上）
- アイコンがあれば配置（layoutのiconAnchor系で位置制御）

### 4.2 展開状態
1. `buildBodyLines()`でfrontmatterから平坦なライン配列を生成
2. テキストサイズを`measureText()`で測定
3. `expandMinW/H`とコンテンツサイズから展開サイズを計算（アスペクト比維持）
4. 背景画像（background）を描画
5. タイトル、ボディテキスト、ピルを順次描画
6. position指定があれば絶対配置、なければフロー配置

### 4.3 テキスト測定
```javascript
const _measureCtx = document.createElement('canvas').getContext('2d');
function measureText(text, fontSize, fontFamily) {
  _measureCtx.font = `${fontSize}px ${fontFamily||'sans-serif'}`;
  return _measureCtx.measureText(text).width;
}
```

### 4.4 位置解決（resolvePos）
```javascript
function resolvePos(raw, total){
  if(raw===undefined||raw===null||raw==='')return -1;
  if(typeof raw==='string'&&raw.endsWith('%'))return parseFloat(raw)/100*total;
  return parseFloat(raw);
}
```
- `%`付き文字列 → パーセント換算（例: "30%" → total*0.3）
- 数値文字列/数値 → 絶対px

## 5. 既存nodeviewテンプレート例

### character_card.json
- shape: rect, rx:4
- titleY: center, boldTitle: true
- background: char_bg.png
- properties: tags, ally, rival, dislikes, likes, mentor, family, affiliation（全てpill）
- 位置指定付き（x:10,y:8等）

### scenario_card.json
- shape: rect, rx:4
- titleY: top, boldTitle: true
- properties: tags, characters, related（全てpill、位置指定なし→フロー配置）

### era_circle.json
- shape: circle, stroke:#fffd
- collapsedFillOpacity: 0.2, expandedFillOpacity: 0（透明）
- backgroundOpacity: 1
- iconAnchorX/Y: center
- titleWrap: true

### plain.json
- 最小限の設定。shape:rect, titleY:centerのみ

## 6. childrenシステム（実装済み）

### 6.1 要素構造

```json
{
  "shape": "rect",
  "rx": 8,
  "stroke": "#fff6",
  "strokeWidth": 1.5,
  "fill": "#ffffff22",
  "fontSize": 12,
  "textColor": "#ffffffcc",
  "text": "任意のテキスト",
  "bgImage": "bg_image.png",
  "bgImgWidth": 0,
  "bgImgHeight": 0,
  "children": [
    {
      "shape": "rect",
      "rx": 4,
      "fill": "#00000088",
      "stroke": "#fff4",
      "text": "内側のテキスト",
      "xRel": "left-10",
      "yRel": "top-5",
      "children": [ ... ]
    }
  ]
}
```

### 6.2 children要素の全仕様

| プロパティ | 型 | 既定値 | 説明 |
|---|---|---|---|
| `id` | number | 自動インクリメント | 要素一意ID |
| `type` | `"box"` \| `"circle"` | `"box"` | 要素タイプ |
| `shape` | `"rect"` \| `"circle"` | `"rect"` | 形状。circle=円形(rx無視) |
| `rx` | number | 6(box) / 999(circle) | 角半径 |
| `fill` | string (RGBA hex) | `"#ffffff22"` | 塗りつぶし色 |
| `stroke` | string (hex) | `"#ffffff88"` | 枠線色 |
| `strokeWidth` | number | 1.5 | 枠線幅 |
| `text` | string | `""` | この要素に表示するテキスト |
| `fontSize` | number | 11 | フォントサイズ |
| `textColor` | string (hex) | `"#ffffffcc"` | テキスト色 |
| `textAlign` | `"start"` \| `"middle"` \| `"end"` | `"start"` | テキスト水平配置 |
| `bgImage` | string | `null` | 背景画像パス |
| `bgImgWidth` | number | 0 | 背景画像実測幅 |
| `bgImgHeight` | number | 0 | 背景画像実測高さ |
| `w` | number \| `null` | `null` | 幅。null=auto(コンテンツ計算)、数値=固定px |
| `h` | number \| `null` | `null` | 高さ。同上 |
| `wRel` | string \| `null` | `null` | 相対幅（後述） |
| `hRel` | string \| `null` | `null` | 相対高さ（後述） |
| `xRel` | string \| `null` | `null` | X相対位置（後述）。null=中央寄せ |
| `yRel` | string \| `null` | `null` | Y相対位置（後述）。null=自動スタック |
| `gapY` | number | 5 | 兄弟要素間の垂直ギャック |
| `textOverflow` | `"shrink"` \| `"clip"` | `"shrink"` | 両固定時テキストが収まらない時の動作 |
| `children` | array | `[]` | 子要素（再帰可能） |
| `expanded` | boolean | `true` | ツリービューの展開状態 |
| `_cw` | number | 0 | **内部** 実測幅 |
| `_ch` | number | 0 | **内部** 実測高さ |
| `_ax` | number | 0 | **内部** 絶対X座標 |
| `_ay` | number | 0 | **内部** 絶対Y座標 |
| `_isManual` | boolean | `false` | **内部** 手動配置フラグ |

### 6.3 相対位置指定（xRel / yRel）

```
親ボックス: x=0, y=0, w=400, h=300

「left-N」    : 親の左線から右へ Npx（N>0）
「right-N」   : 親の右線から左へ Npx（N>0）。親縁に固定され、親サイズに影響しない
「top-N」     : 親の上線から下へ Npx（N>0）
「bottom-N」  : 親の下線から上へ Npx（N>0）。親縁に固定され、親サイズに影響しない
「left--N」   : 親の左線から左へ Npx（外にはみ出し、isOutside=true）
「right--N」  : 親の右線から右へ Npx（外にはみ出し、isOutside=true）
「top--N」    : 親の上線から上へ Npx（外にはみ出し）
「bottom--N」 : 親の下線から下へ Npx（外にはみ出し）
「-N」        : 親の左/上から左/上へ Npx（絶対座標）
「N」         : 親の左/上から右/下へ Npx（絶対座標）
null          : 親の中央寄せ（xRel）/ 自動垂直スタック（yRel）
```

**計算式:**
```
xRel="right-10" → x = parent.w - 10 - child.w（親右縁から10px内側）
xRel="right--20" → x = parent.w + 20（親右縁から20px外側）
yRel="bottom-5" → y = parent.h - 5 - child.h（親下縁から5px内側）
yRel=null → y = curY（自動スタック、gapY適用）
xRel=null → x = (parent.w - child.w) / 2（中央寄せ）
```

### 6.4 相対サイズ指定（wRel / hRel）

```
"parent"        : 親と同じサイズ
"parent-N%"     : 親の N%（例: "parent-50%" → 親の半分）
"child-ラベル"   : ラベル一致要素と同じサイズ（親スコープ内検索）
"sibling-ラベル" : 同上（エイリアス）
```

**検索スコープ:** `findElementByLabel()` は `parent` 配下の `children` から検索（`root` 全体ではない）。これにより兄弟要素間の相対サイズ指定が可能。

### 6.5 レイアウト計算アルゴリズム

**computeLayout()** — 最大5イテレーションの収束チェック付き:

```
for (iter = 0; iter < 5; iter++) {
  measureElement(root);       // Pass 1: 下位互換測定（ボトムアップ）
  resolvePositionsTree(root); // Pass 2: 相対位置解決（トップダウン）
  if (rootサイズが不変) break;
}
```

#### Pass 1: measureElement（ボトムアップ、葉→根）

各要素の `_cw` / `_ch` をコンテンツサイズから計算:

1. **両固定** (`w`, `h` 数値): `_cw=w`, `_ch=h`。テキストは `textOverflow` モードで描画
2. **auto**:
   - children があれば: `maxChildW`（最大幅）, `maxChildHForHeight`（最大高さ、合計ではない）
   - テキスト: `measureText()` で幅測定
   - `w = max(maxChildW, textW) + 20`（padX=10×2）
   - `h = max(maxChildHForHeight + 16, textH)`（padY=8×2）
3. **固定幅 + auto高さ**: テキスト折り返し → `lines.length * (fontSize+4) + 16`
4. **auto幅 + 固定高さ**: テキスト折り返しなし → 全幅測定
5. **両auto**: 全幅測定、`lineHeight + 16`

**テキスト折り返し（wrapText）:**
- ワード単位で折り返し。単語が maxWidth を超える場合は文字単位で分割
- `lineHeight = fontSize + 4`（ヒューリスティック）

**フォント縮小（fitFontSize）:**
- 両固定で `textOverflow="shrink"` の場合
- バイナリサーチ（6px〜72px）でボックスに収まる最大フォントサイズを探索
- `textOverflow="clip"` の場合はフォントサイズ固定、テキスト切り捨て（`...`）

#### Pass 2: resolvePositions（トップダウン、根→葉）

各親要素の children を2パスで配置:

**Pass 2a — "inside" 子要素（正のオフセット / auto）:**
1. `_isManual=true` の子をスキップ（ドラッグ済み）
2. `xRel=null` → 中央寄せ、`yRel=null` → 自動スタック（`curY` 位置に gapY 適用）
3. `xRel="left-N"` → 左から Npx
4. `xRel="right-N"` → `parent.w - N - child.w`（**親サイズに影響しない**）
5. `yRel="top-N"` → 上から Npx
6. `yRel="bottom-N"` → `parent.h - N - child.h`（**親サイズに影響しない**）
7. `maxRight` / `maxBottom` を追跡

**親サイズ再計算:**
```
parent._cw = max(maxRight, parentTextW) + 20（w=null の場合）
parent._ch = max(maxBottom, 1) + 16（h=null の場合）
```

> **注意:** `maxChildW` は Pass 2 再計算ブロックで未定義。子要素の右端最大値(`maxRight`)および親テキスト幅(`parentTextW`)の最大値を使用。`maxChildW` を含めると `NaN` が発生する（BUG#7）。

**相対サイズ解決:** `wRel` / `hRel` を親サイズに基づいて解決し、子要素の `w` / `h` を上書き

**Pass 2b — "outside" 子要素（負のオフセット）:**
- `isOutside=true` のみを対象
- Pass 2a で確定した親サイズを使用
- 親サイズ計算から除外

### 6.6 _isManual フラグの仕様

| 状態 | `_isManual` | 挙動 |
|---|---|---|
| 初期 | `false` | `resolvePositions()` で自動配置される |
| ドラッグ開始（mousedown） | 設定しない | クリックのみの場合、自動配置維持 |
| ドラッグ中（mousemove） | 変更しない | 座標のみ更新 |
| ドラッグ終了（mouseup） | 実移動量>1px のみ `true` | 移動あり → 手動配置固定。移動なし → 自動配置継続 |
| 相対入力変更 | `false` にリセット | xRel/yRel 変更で自動配置に戻る |

**重要:** `resolvePositions()` は `_isManual=true` の子を配置から除外し、座標のみ `maxRight`/`maxBottom` に反映する。これによりドラッグ位置を維持しつつ親サイズを再計算できる。

### 6.7 テキスト描画

**パディング:** `padX=10`, `padY=8`（要素両端）

**Y座標計算:**
```
y + padY + lineHeight * (i + 1)  // i=0,1,2...（行インデックス）
lineHeight = fontSize + 4
```

**3つのモード:**
1. **両固定** (`w`,`h` 数値): `textOverflow` で shrink/clip 制御
2. **固定幅** (`w` 数値): テキスト折り返し、高さは自動
3. **両auto**: 折り返しなし、単一行

### 6.8 背景画像

- 各要素に個別に指定可能（`bgImage`）
- 形状描画の前に描画（形状が上に重なる）
- `pointerEvents=none` でクリック透過

## 7. テストエディタ（children_layout.html）

### 7.1 UI構成

```
┌──────── sidebar (340px) ────────┬────────── canvas-wrap ─────────┐
│  h2: Recursive NodeView Layout  │                                 │
│  tree-container (flex:1)        │  SVG canvas (responsive)        │
│  ├─ Root Canvas                 │  ├─ el-group (各要素の<g>)      │
│  │  ├─ Auto-Size Container      │  │  ├─ rect/ellipse (形状)      │
│  │  │  ├─ Centered Child        │  │  ├─ text (テキスト)          │
│  │  │  │  └─ Small Circle       │  │  └─ rect (選択枠+リサイズ)   │
│  │  │  └─ Right-Aligned Child   │  └─ viewBox: root._cw x root._ch│
│  │  └─ ...                      │                                 │
│  toolbar: [+ Box] [+ Circle]    │  hover-info: 座標/サイズ表示     │
│  props-panel: 属性編集           │  info-bar: ヘルプテキスト        │
└─────────────────────────────────┴─────────────────────────────────┘
```

### 7.2 インタラクション

| アクション | 動作 |
|---|---|
| **クリック** | 要素選択（tree + props 更新）。`_isManual` は設定しない |
| **ドラッグ** | 座標更新（`_ax`/`_ay`）。`render(true)` でレイアウトスキップ |
| **ドラッグ解放** | 実移動量>1px → `_isManual=true`。`render()` で再レイアウト |
| **Deleteキー** | 選択要素を削除（root以外） |
| **Escapeキー** | 選択解除 |
| **+ Box / + Circle** | 選択要素に子要素を追加 |
| **ツリー▼** | 展開/折りたたみ |
| **ツリー✕** | 要素削除 |
| **プロパティ編集** | 即座に `render()` で反映 |

### 7.3 プロパティエディタ

選択要素の全プロパティを編集可能:
- `label`, `shape`, `rx`, `fill`, `stroke`, `strokeWidth`
- `text`, `fontSize`, `textColor`, `textAlign`
- `w`, `h`, `xRel`, `yRel`, `wRel`, `hRel`
- `gapY`, `textOverflow`
- `bgImage`（ファイル選択）

### 7.4 SVG描画

```
各要素の <g> グループ:
  1. <image> (bgImageがある場合、pointerEvents=none)
  2. <rect> (形状。circleならrx=999)
     - 選択時は stroke=#e94560, strokeWidth=2.5
  3. <text> (1〜n行。textAlign対応)
     - 両固定 + shrink: fitFontSize バイナリサーチ
     - 両固定 + clip: 切り捨て + "..."
  4. <rect> (選択枠。hs=6のリサイズハンドル4つ)
```

### 7.5 ユニットテスト（runPositionTests()）

ブラウザコンソールで実行:
- `parseRelative()` — 全位置指定パターン（正/負/abs/null）
- `resolveRelX/Y()` — 座標解決計算
- 2パス配置 — inside/outside子要素の分離検証
- テキスト測定 — wrapText, fitFontSize, measureElement
- 全レイアウト — 実データでの最終検証

## 8. 既知のバグと回避策（Critical Pitfalls）

### 8.1 二重パディング（修正済み）

**症状:** テキスト幅が `+ padX*2` 二重カウントされ、右端でテキストがはみ出る
**原因:** `textW = measureText() + 20` → `w = textW + 20`
**修正:** `textW = measureText()`（パディングなし）、`w = textW + 20`（1回のみ）

### 8.2 _cw 上書きバグ（修正済み）

**症状:** `resolvePositions` が親のテキスト幅を無視し `_cw` を小さくする
**原因:** `maxRight` のみ考慮、`parentTextW` が含まれていない
**修正:** `childContentW = max(maxRight, maxChildW, parentTextW)`

### 8.3 縦幅計算バグ（修正済み）

**症状:** `autoStackY - gap` で gap が未定義変数、plus 合計高さ方式
**原因:** gap 変数のスコープエラー、子の重なりを考慮していない
**修正:** `parent._ch = max(maxBottom) + padY*2`（子 bottom edge の最大値）

### 8.4 _isManual 即時設定バグ（修正済み）

**症状:** 子要素クリックで親接続が切り、レイアウトが破綻
**原因:** `mousedown` で即時 `_isManual=true` → ドラッグなしクリックでも自動配置がスキップされる
**修正:** `mouseup` で実移動量>1px の場合のみ `_isManual=true` を設定

### 8.5 right-N / bottom-N 循環依存

**症状:** `right-10` 子 → `childRight = parent.w - 10` → `parent.w = childRight + 20` → 無限ループ
**回避策:** `right-N`(正) / `bottom-N`(正) の子は親サイズ計算から除外（`continue`）

### 8.6 外部子要素（isOutside）

**症状:** `right--20` などが親サイズに含まれ、親が過大化
**回避策:** `isOutside=true` の子は `maxRight`/`maxBottom` 計算から完全に除外

### 8.7 findElementByLabel スコープ

**症状:** `wRel: "sibling-Label"` で親スコープ外の要素が検索される
**回避策:** `findElementByLabel(label, parent)` — `parent` 配下の children のみ検索

## 9. デバッグ手法（Critical Rules）

### 数値計算
- **常に** bash/python/node スクリプトを使用。暗算禁止。
- 中間値は `console.log` またはブラウザ eval で確認。

### 停滞ルール
- 15分以上解決できない場合はユーザーに相談。

### デバッグ優先事項
1. **バグの再現** — 具体的な数値测量で現象を特定
2. **計算経路の検証** — 間違った値を生む計算パスを追跡
3. **中間値の検査** — ブラウザeval/console.log/shellスクリプト
4. **暗算による修正禁止** — 測定値に基づいた修正のみ
