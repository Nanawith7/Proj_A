# 段階5結果：Python側テキスト幅推定精度向上

## 概要

`_estimate_text_w_v2()` にCJK対応文字幅テーブルを追加し、ブラウザ測定値との誤差を10%以内に改善した。

---

## 発見1: Pillowのgetlength()はブラウザと完全に一致しない

### テスト結果
| フォント | テキスト | ブラウザ | Pillow | 誤差 |
|----------|---------|---------|--------|------|
| meiryo.ttc | [[騎士団長]]... | 165.7px | 191.6px | +15.7% |
| arial.ttf | [[騎士団長]]... | 165.7px | 128.0px | -22.8% |
| arial.ttf | [[main]]... | 151.1px | 133.0px | -12.0% |

### 問題
- Pillowの`getlength()`は単一のフォルトファイルのみを使用
- ブラウザの`measureText()`はシステムフォルトチェーンを使用して最適なフォルトを選択
- 両者の間に差異が生じる

### 結論
Pillowベースの計測を断念し、CJK対応の文字別テーブル方式に統一。

---

## 修正: CJK対応文字幅テーブル

### 追加コード
```python
def _is_cjk(char: str) -> bool:
    """Check if a character is CJK (Chinese/Japanese/Korean)."""
    cp = ord(char)
    return (
        0x4E00 <= cp <= 0x9FFF or  # CJK Unified Ideographs
        0x3040 <= cp <= 0x309F or  # Hiragana
        0x30A0 <= cp <= 0x30FF or  # Katakana
        0x3400 <= cp <= 0x4DBF or  # CJK Extension A
        0xAC00 <= cp <= 0xD7AF or  # Hangul
        0xFF00 <= cp <= 0xFFEF or  # Fullwidth Forms
        0x3000 <= cp <= 0x303F      # CJK Symbols
    )

def _estimate_text_w_v2(text: str, font_size: int = 11) -> float:
    """Estimate text width using CJK-aware character width table."""
    if not text:
        return 0
    total = 0.0
    for ch in text:
        if _is_cjk(ch):
            total += font_size * 1.0  # CJK: full-width (1em)
        else:
            total += font_size * _CHAR_WIDTH_RATIOS.get(ch, _DEFAULT_RATIO)
    return max(total, DEFAULT_TEXT_W * 0.6)
```

### 変更点
1. `_is_cjk()` 関数を追加 - CJK文字を判定
2. CJK文字に `font_size * 1.0` 係数を適用（全角）
3. ASCII文字は既存の文字別テーブル方式を継続
4. `+4px` の追加を削除（誤差を拡大していた）

---

## テスト結果

| テキスト | ブラウザ | 推定値 | 誤差 | 結果 |
|----------|---------|--------|------|------|
| `[[main]], [[human]], [[knight]]` | 151.1px | 157.4px | +4.2% | ✅ PASS |
| `[[騎士団長]], [[幼なじみ]], [[盗賊]]` | 165.7px | 180.0px | +8.6% | ✅ PASS |
| `[[四天王A]]` | 54.6px | 60.0px | +9.9% | ✅ PASS |
| `[[四天王B]]` | 55.1px | 60.0px | +8.9% | ✅ PASS |
| `[[幼なじみ]], [[王女]]` | 101.3px | 110.2px | +8.8% | ✅ PASS |
| `[[賢者]], [[騎士団長]]` | 101.3px | 110.2px | +8.8% | ✅ PASS |

**最大誤差: +9.9%**（10%以内の目標を達成）

---

## 次回フェーズへの引き渡し

段階5完了。Python側テキスト幅推定精度が10%以内に改善した。

次の段階（段階6: 統合テスト・スクリーンショット検証）に進む。

---

## 参照文献

- `canvas_gen/children.py` — Python側childrenレイアウト計算
- Pillow公式ドキュメント: `ImageFont.getlength()`
