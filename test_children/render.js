// ═══════════════════════════════════════════════════════
// SVG RENDERING
// ═══════════════════════════════════════════════════════

const SVG_NS = 'http://www.w3.org/2000/svg';
const svgCanvas = document.getElementById('svg-canvas');

/**
 * Render a single element and its children to SVG.
 */
function drawElement(el, parentGroup, offsetX, offsetY) {
  const x = (offsetX || 0) + (el._ax || 0);
  const y = (offsetY || 0) + (el._ay || 0);
  const w = el._cw || 0;
  const h = el._ch || 0;
  const padX = 10, padY = 8;

  const g = document.createElementNS(SVG_NS, 'g');
  g.classList.add('el-group');
  g.dataset.id = el.id;

  // Background image (underneath)
  if (el.bgImage && w > 0 && h > 0) {
    const img = document.createElementNS(SVG_NS, 'image');
    img.setAttributeNS('http://www.w3.org/1999/xlink', 'href', el.bgImage);
    img.setAttribute('x', x);
    img.setAttribute('y', y);
    img.setAttribute('width', w);
    img.setAttribute('height', h);
    img.style.pointerEvents = 'none';
    g.appendChild(img);
  }

  // Shape
  if (el.shape === 'circle') {
    const size = Math.max(w, h);
    const rect = document.createElementNS(SVG_NS, 'rect');
    rect.setAttribute('x', x + (w - size) / 2);
    rect.setAttribute('y', y + (h - size) / 2);
    rect.setAttribute('width', size);
    rect.setAttribute('height', size);
    rect.setAttribute('fill', el.fill || '#ffffff22');
    rect.setAttribute('stroke', el.stroke || '#fff6');
    rect.setAttribute('stroke-width', el.strokeWidth ?? 1.5);
    rect.setAttribute('rx', '999');
    rect.setAttribute('ry', '999');
    if (el.id === window.selectedId) {
      rect.setAttribute('stroke', '#e94560');
      rect.setAttribute('stroke-width', '2.5');
    }
    g.appendChild(rect);
  } else {
    const rect = document.createElementNS(SVG_NS, 'rect');
    rect.classList.add('el-rect');
    rect.setAttribute('x', x);
    rect.setAttribute('y', y);
    rect.setAttribute('width', w);
    rect.setAttribute('height', h);
    rect.setAttribute('fill', el.fill || '#ffffff22');
    rect.setAttribute('stroke', el.stroke || '#fff6');
    rect.setAttribute('stroke-width', el.strokeWidth ?? 1.5);
    rect.setAttribute('rx', el.rx || 4);
    rect.setAttribute('ry', el.rx || 4);
    if (el.id === window.selectedId) {
      rect.classList.add('el-drag-highlight');
      rect.setAttribute('stroke', '#e94560');
      rect.setAttribute('stroke-width', '2.5');
    }
    g.appendChild(rect);
  }

  // Text
  if (el.text) {
    let drawFontSize = el.fontSize || 11;
    const availW = w - padX * 2;
    const availH = h - padY * 2;
    
    if (el.w !== null && el.h !== null) {
      if (el.textOverflow === 'clip') {
        const lineHeight = drawFontSize + 4;
        const maxLines = Math.max(1, Math.floor(availH / lineHeight));
        let lines = window._wrapText(el.text, availW, drawFontSize);
        if (lines.length > maxLines) {
          lines = lines.slice(0, maxLines);
          if (lines.length > 0 && lines[lines.length - 1].length > 3) {
            const lastLine = lines[lines.length - 1];
            let truncated = lastLine;
            while (truncated.length > 2 && window._measureText(truncated + '...', drawFontSize) > availW) {
              truncated = truncated.slice(0, -1);
            }
            lines[lines.length - 1] = truncated + '...';
          }
        }
        for (let i = 0; i < lines.length; i++) {
          const txt = document.createElementNS(SVG_NS, 'text');
          let tx = x + padX;
          if (el.textAlign === 'middle') tx = x + w / 2;
          else if (el.textAlign === 'end') tx = x + w - padX;
          txt.setAttribute('x', tx);
          txt.setAttribute('y', y + padY + lineHeight * (i + 1));
          txt.setAttribute('fill', el.textColor || '#ffffffcc');
          txt.setAttribute('font-size', drawFontSize);
          if (el.textAlign === 'middle') txt.setAttribute('text-anchor', 'middle');
          else if (el.textAlign === 'end') txt.setAttribute('text-anchor', 'end');
          txt.textContent = lines[i];
          g.appendChild(txt);
        }
      } else {
        // Shrink mode
        drawFontSize = window._fitFontSize(el.text, availW, availH, 6);
        const lineHeight = drawFontSize + 4;
        const maxLines = Math.max(1, Math.floor(availH / lineHeight));
        let lines = window._wrapText(el.text, availW, drawFontSize);
        if (lines.length > maxLines) lines = lines.slice(0, maxLines);
        for (let i = 0; i < lines.length; i++) {
          const txt = document.createElementNS(SVG_NS, 'text');
          let tx = x + padX;
          if (el.textAlign === 'middle') tx = x + w / 2;
          else if (el.textAlign === 'end') tx = x + w - padX;
          txt.setAttribute('x', tx);
          txt.setAttribute('y', y + padY + lineHeight * (i + 1));
          txt.setAttribute('fill', el.textColor || '#ffffffcc');
          txt.setAttribute('font-size', drawFontSize);
          if (el.textAlign === 'middle') txt.setAttribute('text-anchor', 'middle');
          else if (el.textAlign === 'end') txt.setAttribute('text-anchor', 'end');
          txt.textContent = lines[i];
          g.appendChild(txt);
        }
      }
    } else if (el.w !== null) {
      // Fixed width: wrap text
      const lineHeight = drawFontSize + 4;
      const lines = window._wrapText(el.text, availW, drawFontSize);
      for (let i = 0; i < lines.length; i++) {
        const txt = document.createElementNS(SVG_NS, 'text');
        let tx = x + padX;
        if (el.textAlign === 'middle') tx = x + w / 2;
        else if (el.textAlign === 'end') tx = x + w - padX;
        txt.setAttribute('x', tx);
        txt.setAttribute('y', y + padY + lineHeight * (i + 1));
        txt.setAttribute('fill', el.textColor || '#ffffffcc');
        txt.setAttribute('font-size', drawFontSize);
        if (el.textAlign === 'middle') txt.setAttribute('text-anchor', 'middle');
        else if (el.textAlign === 'end') txt.setAttribute('text-anchor', 'end');
        txt.textContent = lines[i];
        g.appendChild(txt);
      }
    } else {
      // Auto width: no wrapping, single line
      const lineHeight = drawFontSize + 4;
      const txt = document.createElementNS(SVG_NS, 'text');
      let tx = x + padX;
      if (el.textAlign === 'middle') tx = x + w / 2;
      else if (el.textAlign === 'end') tx = x + w - padX;
      txt.setAttribute('x', tx);
      txt.setAttribute('y', y + padY + lineHeight);
      txt.setAttribute('fill', el.textColor || '#ffffffcc');
      txt.setAttribute('font-size', drawFontSize);
      if (el.textAlign === 'middle') txt.setAttribute('text-anchor', 'middle');
      else if (el.textAlign === 'end') txt.setAttribute('text-anchor', 'end');
      txt.textContent = el.text;
      g.appendChild(txt);
    }
  }

  // Selection highlight
  if (el.id === window.selectedId) {
    const selRect = document.createElementNS(SVG_NS, 'rect');
    selRect.setAttribute('x', x - 2);
    selRect.setAttribute('y', y - 2);
    selRect.setAttribute('width', w + 4);
    selRect.setAttribute('height', h + 4);
    selRect.setAttribute('fill', 'none');
    selRect.setAttribute('stroke', '#e94560');
    selRect.setAttribute('stroke-width', '2');
    selRect.setAttribute('rx', '8');
    selRect.setAttribute('pointer-events', 'none');
    g.appendChild(selRect);

    const hs = 6;
    [[x - hs/2, y - hs/2], [x + w - hs/2, y - hs/2],
     [x - hs/2, y + h - hs/2], [x + w - hs/2, y + h - hs/2]].forEach(([hx, hy]) => {
      const h2 = document.createElementNS(SVG_NS, 'rect');
      h2.setAttribute('x', hx); h2.setAttribute('y', hy);
      h2.setAttribute('width', hs); h2.setAttribute('height', hs);
      h2.setAttribute('fill', '#e94560'); h2.setAttribute('rx', '2');
      h2.setAttribute('pointer-events', 'none');
      g.appendChild(h2);
    });
  }

  // Recursively render children
  if (el.children && el.children.length > 0) {
    for (const child of el.children) {
      drawElement(child, g, offsetX || 0, offsetY || 0);
    }
  }

  parentGroup.appendChild(g);
}

/**
 * Full render: compute layout and draw SVG.
 */
function render(skipLayout) {
  if (!skipLayout) {
    window._computeLayout();
  }
  svgCanvas.innerHTML = '';
  const mainG = document.createElementNS(SVG_NS, 'g');
  drawElement(window.root, mainG, 0, 0);
  svgCanvas.appendChild(mainG);

  const vbW = window.root._cw || 400;
  const vbH = window.root._ch || 300;
  svgCanvas.setAttribute('viewBox', `0 0 ${vbW} ${vbH}`);
  svgCanvas.style.width = Math.max(vbW, 200) + 'px';
  svgCanvas.style.height = Math.max(vbH, 150) + 'px';
}

window.renderModule = { drawElement, render };
window._drawElement = drawElement;
window._render = render;
window._svgCanvas_get = () => svgCanvas;
