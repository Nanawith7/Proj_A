# System Prompt Proposal — Repeated Mistakes Analysis

## 概要

今回のDeep Codingセッション（brave-knight Canvas Viewer修正）において、繰り返し発生したエラーとミスを分析し、システムプロンプトに組み込むべき指示を提案する。

## 分析対象

以下のファイルから分析:
- `Deep_Coding_logs/viewer-rendering-issues-2026-05-09/summary.md`
- `Deep_Coding_logs/viewer-rendering-issues-2026-05-09/pitfalls.md`
- `Deep_Coding_logs/viewer-rendering-issues-2026-05-09/Decisions.md`
- 会話履歴全体のエラーパターン

## 繰り返し発生したミットーン

### M1: `&&` チェーンコマンドの誤用

**発生回数**: 3回以上
**原因**: PowerShellでは `&&` がサポートされていない
**例**:
```powershell
# 誤: git add -A && git commit
# 正: git add -A
#     git commit -m "..."
```
**修正方法**:
- `cmd1; if ($?) { cmd2 }` または `;` を使用する
- 独立したコマンドとして別々に実行する

**システムプロンプトへの組み込み**: **組み込むべき**
```
PowerShellでは `&&` チェーンコマンドはサポートされていない。`cmd1; cmd2` または独立したコマンドとして実行すること。
```

---

### M2: Unicode文字のエンコードエラー

**発生回数**: 1回
**原因**: PowerShellの出力エンコーディング（cp932）がUnicode文字（✅, ❌等）をサポートしていない
**例**:
```python
# 誤: print(f'{status} Text: {text}')  # status = '✅'
# 正: status = 'PASS' if passed else 'FAIL'
```
**修正方法**:
- 出力文字列にUnicode文字（✅, ❌, etc.）を含めない
- ASCII文字（PASS, FAIL, OK, NG等）のみを使用

**システムプロンプトへの組み込み**: **組み込むべき**
```
PowerShell/コマンドラインの出力にUnicode文字（✅, ❌, etc.）を含めない。ASCII文字（PASS, FAIL, OK, NG）のみを使用すること。
```

---

### M3: `os.name` vs `platform.system()` の誤用

**発生回数**: 1回
**原因**: `os.name` はWindowsで "nt" を返すが、コードでは "Windows" をキーとして使用
**例**:
```python
# 誤: os.name → "nt"
# 正: platform.system() → "Windows"
```
**修正方法**:
- システム名を取得する際は `platform.system()` を使用する
- `os.name` は "posix", "nt", "java" のみ返す

**システムプロンプトへの組み込み**: **組み込むべき**
```
PythonでOS名を取得する際は `os.name` ではなく `platform.system()` を使用すること。`os.name` は "posix", "nt", "java" のみ返す。
```

---

### M4: SVG要素の `click()` 関数の誤用

**発生回数**: 1回
**原因**: SVG `<rect>` 要素は関数としての `click()` を持たない
**例**:
```javascript
// 誤: rects[i].click()
// 正: rects[i].dispatchEvent(new MouseEvent('click', {bubbles: true, cancelable: true}))
```
**修正方法**:
- SVG要素のクリックは `dispatchEvent` で `MouseEvent` を送信する

**システムプロンプトへの組み込み**: **組み込むべき**
```
SVG DOM要素のクリックは `element.click()` ではなく `element.dispatchEvent(new MouseEvent('click', {bubbles: true, cancelable: true}))` を使用すること。
```

---

### M5: `+4px` の追加による誤差拡大

**発生回数**: 1回
**原因**: `_estimate_text_w_v2()` で `max(total + 4, ...)` としていたが、誤差を拡大
**修正方法**: `max(total, ...)` に変更

**システムプロンプトへの組み込み**: **組み込まない**
**理由**: 特定のコード修正であり、一般化できない。プロジェクト固有の判断。

---

### M6: Pillow `getlength()` の精度不足

**発生回数**: 1回
**原因**: Pillow `getlength()` は単一のフォルトファイルのみを使用
**修正方法**: CJK対応の文字別テーブル方式を採用

**システムプロンプトへの組み込み**: **組み込まない**
**理由**: 特定の技術選択であり、プロジェクト固有の判断。

---

### M7: `=== null` vs `== null` の誤用

**発生回数**: 1回
**原因**: `parentEl.w === null` では `undefined` を検出できない
**修正方法**: `parentEl.w == null` に変更

**システムプロンプトへの組み込み**: **組み込まない**
**理由**: JavaScriptの一般的なイディオムであり、既に多くの開発者が知っている。

---

## 提案: システムプロンプトへの追加指示

以下の4項目をシステムプロンプトに追加することを提案する:

### 1. PowerShellコマンド実行規則
```
PowerShellでは `&&` チェーンコマンドはサポートされていない。複数のコマンドを実行する場合は `cmd1; cmd2` または独立したコマンドとして別々に実行すること。
```

### 2. 出力文字列のエンコーディング
```
PowerShell/コマンドラインの出力にUnicode文字（✅, ❌, etc.）を含めない。ASCII文字（PASS, FAIL, OK, NG）のみを使用すること。
```

### 3. PythonのOS名取得
```
PythonでOS名を取得する際は `os.name` ではなく `platform.system()` を使用すること。`os.name` は "posix", "nt", "java" のみ返す。
```

### 4. SVG DOM操作
```
SVG DOM要素のクリックは `element.click()` ではなく `element.dispatchEvent(new MouseEvent('click', {bubbles: true, cancelable: true}))` を使用すること。
```

## 推奨度評価

| 項目 | 推奨度 | 理由 |
|------|--------|------|
| M1: `&&` チェーン | **高** | 毎回の基本操作で発生するエラー |
| M2: Unicode文字 | **高** | 出力の読みやすさとエラー回避 |
| M3: `platform.system()` | **中** | Pythonコードの品質向上 |
| M4: SVG `dispatchEvent` | **中** | ブラウザテスト時のみ発生 |

## 結論

M1とM2は高頻度で発生し、基本的なコマンド実行に関わるため、システムプロンプトに組み込むことを強く推奨する。M3とM4は中程度のため、必要に応じて組み込む。
