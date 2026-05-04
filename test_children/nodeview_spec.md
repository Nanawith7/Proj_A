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

## 6. 現状の制限（childrenシステム未実装）

1. **再帰的ネスト**: 存在しない。propertiesは平坦な配列
2. **背景画像**: ルートの1つだけ（nv.background）。各要素ごとに個別指定不可
3. **テキスト描画**: propertiesベース。各プロパティが1つのテキスト/ピル要素
4. **相対位置**: `position.x/y`はパーセントまたは絶対pxのみ。「親の左線から-10px」のような相対指定は存在しない
5. **動的サイズ**: 展開時のみ。折りたたみ時は固定サイズ

## 7. 求める機能（childrenシステム）

### 7.1 children構造

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
  "background": "bg_image.png",
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

### 7.2 children要素の仕様

| プロパティ | 型 | 既定値 | 説明 |
|---|---|---|---|
| `shape` | `"rect"` \| `"circle"` \| `"round"` | `"rect"` | 形状 |
| `rx` | number | `4` | 角半径 |
| `fill` | string (RGBA hex) | `"#ffffff22"` | 塗りつぶし色 |
| `stroke` | string (hex) | `"#fff6"` | 枠線色 |
| `strokeWidth` | number | `1.5` | 枠線幅 |
| `text` | string | `""` | この要素に表示するテキスト |
| `fontSize` | number | `12` | フォントサイズ |
| `textColor` | string (hex) | `"#ffffffcc"` | テキスト色 |
| `textAlign` | `"start"` \| `"middle"` \| `"end"` | `"start"` | テキスト水平配置 |
| `background` | string | `""` | この要素の背景画像 |
| `w` | number \| `"auto"` | `"auto"` | 幅。数値=固定px、"auto"=コンテンツから計算 |
| `h` | number \| `"auto"` | `"auto"` | 高さ。同上 |
| `xRel` | string | `"center"` | X相対位置（後述） |
| `yRel` | string | `"top-8"` | Y相対位置（後述） |
| `gapY` | number | `5` | 兄弟要素間の垂直ギャップ |
| `children` | array | `[]` | 子要素 |
| `zIndex` | number | `0` | 描画順序（大きいほど前面） |

### 7.3 相対位置指定（xRel/yRel）

```
親ボックス: x=0, y=0, w=400, h=300

「left-N」: 親の左線から右へNpx
「right-N」: 親の右線から左へNpx
「top-N」: 親の上線から下へNpx
「bottom-N」: 親の下線から上へNpx
「-N」: 親の左/上線から左/上へNpx（外にはみ出し）
「N」: 親の左/上線から右/下へNpx

例: xRel="right-10" → x = parent.x + parent.w - 10 - child.w
例: yRel="bottom-5" → y = parent.y + parent.h - 5 - child.h
例: xRel="-5" → x = parent.x - 5（左にはみ出し）
```

### 7.4 動的サイズ計算アルゴリズム

**Pass 1（下位互換測定）**: 葉ノードから再帰的にサイズを測定
- テキスト長を`measureText()`で測定
- childrenがあればその最大幅/合計高さを計算
- `w="auto"`または`h="auto"`の場合はコンテンツサイズを使用

**Pass 2（相対位置解決）**: ルートから再帰的に位置を計算
- `xRel/yRel`を親の座標に解決
- `w/h="auto"`の場合はchildrenのサイズに基づいて親のサイズを決定

**Pass 3（アスペクト比維持）**: 必要に応じて親のサイズを拡大
- 元のアスペクト比を維持しつつ、全てのchildrenが収まるサイズに拡大

### 7.5 既存propertiesとのマッピング

既存の`properties`オブジェクトは自動的に`children[]`に変換される：

```json
// 旧形式
{ "properties": { "tags": { "style": "pill", "position": {"x": 10, "y": 8} } } }

// → 新形式に変換
{ "children": [
  { "shape": "rect", "rx": 3, "fill": "#fff2", "stroke": "#eee", "text": "tags",
    "xRel": "left-10", "yRel": "top-8", "style": "pill" }
]}
```

## 8. テスト用HTMLの要件

1. **既存ファイルに一切触れない** - test_children/配下の独立したHTMLファイル
2. **nodeviewシステムと互換性がある** - 同じJSONスキーマを使用
3. **インタラクティブなエディタ** - ドラッグ&ドロップで要素配置
4. **リアルタイムプレビュー** - JSON変更と同時にSVG描画が更新
5. **ツリー表示** - 階層構造を視覚的に表示・編集
