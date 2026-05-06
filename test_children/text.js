// ═══════════════════════════════════════════════════════
// TEXT MEASUREMENT
// ═══════════════════════════════════════════════════════

const _measureCanvas = document.createElement('canvas');
_measureCanvas.style.display = 'none';
document.body.appendChild(_measureCanvas);
const _measureCtx = _measureCanvas.getContext('2d');

function measureText(text, fontSize) {
  _measureCtx.font = `${fontSize}px sans-serif`;
  return _measureCtx.measureText(text).width;
}

/**
 * Wrap text to fit within maxWidth. Returns array of lines.
 */
function wrapText(text, maxWidth, fontSize) {
  if (!text || maxWidth <= 0) return [];
  
  _measureCtx.font = `${fontSize}px sans-serif`;
  const words = text.split(' ');
  const lines = [];
  let currentLine = '';
  
  for (const word of words) {
    const testLine = currentLine ? currentLine + ' ' + word : word;
    const testWidth = _measureCtx.measureText(testLine).width;
    
    if (testWidth <= maxWidth && testLine.length > 0) {
      currentLine = testLine;
    } else {
      if (currentLine) lines.push(currentLine);
      currentLine = word;
      // If a single word is wider than maxWidth, split it
      if (measureText(word, fontSize) > maxWidth) {
        let charLine = '';
        for (const ch of word) {
          const testCharLine = charLine + ch;
          if (measureText(testCharLine, fontSize) <= maxWidth) {
            charLine = testCharLine;
          } else {
            if (charLine) lines.push(charLine);
            charLine = ch;
          }
        }
        currentLine = charLine;
      }
    }
  }
  if (currentLine) lines.push(currentLine);
  
  return lines.length > 0 ? lines : [text];
}

/**
 * Find the largest font size that fits text within maxWidth x maxHeight.
 */
function fitFontSize(text, maxWidth, maxHeight, minFontSize = 6) {
  if (!text || maxWidth <= 0 || maxHeight <= 0) return minFontSize;
  
  let lo = minFontSize, hi = 72, best = minFontSize;
  
  while (lo <= hi) {
    const mid = Math.floor((lo + hi) / 2);
    const lines = wrapText(text, maxWidth, mid);
    const neededH = lines.length * (mid + 4);
    
    if (neededH <= maxHeight) {
      best = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  
  return best;
}

window.textModule = { measureText, wrapText, fitFontSize };

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    window._measureText = measureText;
    window._wrapText = wrapText;
    window._fitFontSize = fitFontSize;
  });
} else {
  window._measureText = measureText;
  window._wrapText = wrapText;
  window._fitFontSize = fitFontSize;
}
