// ═══════════════════════════════════════════════════════
// EDITOR UI - Properties Panel
// ═══════════════════════════════════════════════════════

const propsContent = document.getElementById('props-content');

function propRow(label, value, onChange) {
  const div = document.createElement('div');
  div.className = 'prop-row';

  const lbl = document.createElement('label');
  lbl.textContent = label;

  const input = document.createElement('input');
  input.value = value;
  input.addEventListener('input', () => onChange(input.value));

  div.appendChild(lbl);
  div.appendChild(input);
  return div;
}

function renderProps() {
  const el = window._findElement(window.selectedId);
  if (!el) {
    propsContent.innerHTML = '<span style="color:#666;font-size:11px">Select an element</span>';
    return;
  }

  propsContent.innerHTML = '';

  // Label
  propsContent.appendChild(propRow('Label', el.label, (v) => { el.label = v; window._renderTree(); window._render(); }));

  // Type
  const typeRow = document.createElement('div');
  typeRow.className = 'prop-row';
  typeRow.innerHTML = `<label>Type</label><span style="color:#e94560;font-size:11px">${el.shape}</span>`;
  propsContent.appendChild(typeRow);

  // Size
  const wInput = propRow('Width', el.w !== null ? el.w : 'auto', (v) => { el.w = v === 'auto' ? null : parseInt(v) || 0; window._render(); });
  propsContent.appendChild(wInput);
  const hInput = propRow('Height', el.h !== null ? el.h : 'auto', (v) => { el.h = v === 'auto' ? null : parseInt(v) || 0; window._render(); });
  propsContent.appendChild(hInput);

  // Relative size
  const wRelRow = document.createElement('div');
  wRelRow.className = 'prop-row';
  const wRelLbl = document.createElement('label');
  wRelLbl.textContent = 'W Rel';
  const wRelInput = document.createElement('input');
  wRelInput.value = el.wRel ?? '';
  wRelInput.placeholder = 'parent, parent-50%, child-Label';
  wRelInput.addEventListener('input', () => { el.wRel = wRelInput.value || null; el._isManual = false; window._render(); });
  wRelRow.appendChild(wRelLbl);
  wRelRow.appendChild(wRelInput);
  propsContent.appendChild(wRelRow);

  const hRelRow = document.createElement('div');
  hRelRow.className = 'prop-row';
  const hRelLbl = document.createElement('label');
  hRelLbl.textContent = 'H Rel';
  const hRelInput = document.createElement('input');
  hRelInput.value = el.hRel ?? '';
  hRelInput.placeholder = 'parent, parent-50%, child-Label';
  hRelInput.addEventListener('input', () => { el.hRel = hRelInput.value || null; el._isManual = false; window._render(); });
  hRelRow.appendChild(hRelLbl);
  hRelRow.appendChild(hRelInput);
  propsContent.appendChild(hRelRow);

  // Relative position
  const xRelRow = document.createElement('div');
  xRelRow.className = 'prop-row';
  const xRelLbl = document.createElement('label');
  xRelLbl.textContent = 'X Rel';
  const xRelInput = document.createElement('input');
  xRelInput.value = el.xRel ?? '';
  xRelInput.placeholder = 'left-10, right--10(外側), -10';
  xRelInput.addEventListener('input', () => { el.xRel = xRelInput.value || null; el._isManual = false; window._renderTree(); window._render(); });
  xRelRow.appendChild(xRelLbl);
  xRelRow.appendChild(xRelInput);
  propsContent.appendChild(xRelRow);

  const yRelRow = document.createElement('div');
  yRelRow.className = 'prop-row';
  const yRelLbl = document.createElement('label');
  yRelLbl.textContent = 'Y Rel';
  const yRelInput = document.createElement('input');
  yRelInput.value = el.yRel ?? '';
  yRelInput.placeholder = 'top-5, bottom--10(外側), -10';
  yRelInput.addEventListener('input', () => { el.yRel = yRelInput.value || null; el._isManual = false; window._renderTree(); window._render(); });
  yRelRow.appendChild(yRelLbl);
  yRelRow.appendChild(yRelInput);
  propsContent.appendChild(yRelRow);

  // Fill
  const fillRow = propRow('Fill', el.fill, (v) => { el.fill = v; window._render(); });
  propsContent.appendChild(fillRow);

  // Stroke
  const strokeRow = propRow('Stroke', el.stroke, (v) => { el.stroke = v; window._render(); });
  propsContent.appendChild(strokeRow);

  // Text properties
  const textRow = document.createElement('div');
  textRow.className = 'prop-row';
  const textLbl = document.createElement('label');
  textLbl.textContent = 'Text';
  const textInput = document.createElement('input');
  textInput.value = el.text;
  textInput.placeholder = 'text content';
  textInput.addEventListener('input', () => { el.text = textInput.value; window._renderTree(); window._render(); });
  textRow.appendChild(textLbl);
  textRow.appendChild(textInput);
  propsContent.appendChild(textRow);

  const fontSizeRow = propRow('Font Size', el.fontSize, (v) => { el.fontSize = parseInt(v) || 11; window._render(); });
  propsContent.appendChild(fontSizeRow);

  // Text overflow mode
  const overflowRow = document.createElement('div');
  overflowRow.className = 'prop-row';
  const overflowLbl = document.createElement('label');
  overflowLbl.textContent = 'Overflow';
  const overflowSelect = document.createElement('select');
  overflowSelect.style.cssText = 'flex:1;padding:3px 6px;background:#0f3460;color:#eee;border:1px solid #533483;border-radius:3px;font-size:11px';
  const shrinkOpt = document.createElement('option');
  shrinkOpt.value = 'shrink';
  shrinkOpt.textContent = 'Shrink';
  overflowSelect.appendChild(shrinkOpt);
  const clipOpt = document.createElement('option');
  clipOpt.value = 'clip';
  clipOpt.textContent = 'Clip';
  overflowSelect.appendChild(clipOpt);
  overflowSelect.value = el.textOverflow || 'shrink';
  overflowSelect.addEventListener('change', () => { el.textOverflow = overflowSelect.value; window._render(); });
  overflowRow.appendChild(overflowLbl);
  overflowRow.appendChild(overflowSelect);
  propsContent.appendChild(overflowRow);

  const textColorRow = propRow('Text Color', el.textColor, (v) => { el.textColor = v; window._render(); });
  propsContent.appendChild(textColorRow);

  // Gap
  const gapRow = propRow('Gap', el.gapY, (v) => { el.gapY = parseInt(v) || 5; window._render(); });
  propsContent.appendChild(gapRow);

  // Children count
  const childCountRow = document.createElement('div');
  childCountRow.className = 'prop-row';
  const ccLbl = document.createElement('label');
  ccLbl.textContent = 'Children';
  const ccSpan = document.createElement('span');
  ccSpan.style.cssText = 'color:#aaa;font-size:11px';
  ccSpan.textContent = el.children ? el.children.length : 0;
  childCountRow.appendChild(ccLbl);
  childCountRow.appendChild(ccSpan);
  propsContent.appendChild(childCountRow);

  if (el.id !== window.root.id) {
    const btnRow = document.createElement('div');
    btnRow.className = 'prop-row';
    const boxBtn = document.createElement('button');
    boxBtn.textContent = '+ Box\u5b50';
    boxBtn.style.cssText = 'flex:1;background:#0f3460;color:#eee;border:1px solid #533460;padding:3px 6px;border-radius:3px;cursor:pointer;font-size:10px';
    boxBtn.addEventListener('click', () => window._addSelectedChild('box'));
    const circBtn = document.createElement('button');
    circBtn.textContent = '+ Circle\u5b50';
    circBtn.style.cssText = 'flex:1;background:#0f3460;color:#eee;border:1px solid #533460;padding:3px 6px;border-radius:3px;cursor:pointer;font-size:10px';
    circBtn.addEventListener('click', () => window._addSelectedChild('circle'));
    btnRow.appendChild(boxBtn);
    btnRow.appendChild(circBtn);
    propsContent.appendChild(btnRow);
  }

  // Background image section
  const bgImgLabel = document.createElement('div');
  bgImgLabel.className = 'prop-row';
  const bgLbl = document.createElement('label');
  bgLbl.textContent = 'BgImage';
  bgImgLabel.appendChild(bgLbl);
  propsContent.appendChild(bgImgLabel);

  if (el.bgImage) {
    const bgInfoRow = document.createElement('div');
    bgInfoRow.className = 'prop-row';
    const bgSpan = document.createElement('span');
    bgSpan.style.cssText = 'color:#4ecdc4;font-size:10px;flex:1';
    let infoText = `\u2713 loaded (${Math.round(el.bgImage.length / 1024)}KB)`;
    if (el.bgImgWidth > 0) infoText += ` ${el.bgImgWidth}x${el.bgImgHeight}`;
    bgSpan.textContent = infoText;
    const bgClearBtn = document.createElement('button');
    bgClearBtn.textContent = 'Clear';
    bgClearBtn.style.cssText = 'background:#c0392b;color:#fff;border:none;padding:2px 8px;border-radius:2px;cursor:pointer;font-size:10px';
    bgClearBtn.addEventListener('click', () => { el.bgImage = null; el.bgImgWidth = 0; el.bgImgHeight = 0; renderProps(); window._render(); });
    bgInfoRow.appendChild(bgSpan);
    bgInfoRow.appendChild(bgClearBtn);
    propsContent.appendChild(bgInfoRow);
  } else {
    const bgFileRow = document.createElement('div');
    bgFileRow.className = 'prop-row';
    const bgFileInput = document.createElement('input');
    bgFileInput.type = 'file';
    bgFileInput.accept = 'image/*';
    bgFileInput.style.cssText = 'flex:1;font-size:10px';
    bgFileInput.addEventListener('change', () => window._loadBgImage(bgFileInput));
    bgFileRow.appendChild(bgFileInput);
    propsContent.appendChild(bgFileRow);
  }
}

window.uiPropsModule = { renderProps };

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    window._renderProps = renderProps;
  });
} else {
  window._renderProps = renderProps;
}
