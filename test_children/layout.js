// ═══════════════════════════════════════════════════════
// LAYOUT ENGINE
// ═══════════════════════════════════════════════════════

// ═── Layout Pass 1: Measure (bottom-up) ─────────────
/**
 * Measure an element's natural size based on its content.
 * Returns {w, h}. Children get _cw/_ch set.
 */
function measureElement(el) {
  // If both dimensions are fixed, use them
  if (el.w !== null && el.h !== null) {
    const w = Math.max(el.w, 20);
    const h = Math.max(el.h, 20);
    el._cw = w;
    el._ch = h;
    return {w, h};
  }

  let maxChildW = 0, totalChildH = 0, maxChildHForHeight = 0;
  const padX = 10, padY = 8;
  const gap = el.gapY || 5;

  if (el.children && el.children.length > 0) {
    for (const child of el.children) {
      // _isManual children (dragged/placed by user) don't affect parent size
      if (child._isManual) continue;
      const cm = measureElement(child);
      if (cm.w > maxChildW) maxChildW = cm.w;
      // Use max child height, not sum (children may be side-by-side)
      if (cm.h > maxChildHForHeight) maxChildHForHeight = cm.h;
      totalChildH += cm.h + gap;
    }
    if (el.children.length > 0) totalChildH -= gap;
  }

  // Text size contribution - 3 modes based on w/h constraints
  let textW = 0, textH = 0;
  if (el.text) {
    const fontSize = el.fontSize || 11;
    
    if (el.w !== null && el.h !== null) {
      // Both fixed: calculate max lines that fit, measure first line for width
      const availW = Math.max(el.w - padX * 2, 20);
      const availH = Math.max(el.h - padY * 2, 10);
      const lineHeight = fontSize + 4;
      const maxLines = Math.floor(availH / lineHeight);
      
      // Measure first line to determine width
      textW = Math.min(window._measureText(el.text, fontSize) + padX * 2, availW);
      textH = Math.max(maxLines * lineHeight, lineHeight) + padY * 2;
    } else if (el.w !== null && el.h === null) {
      // Fixed width, auto height: wrap text and calculate total height
      const availW = Math.max(el.w - padX * 2, 20);
      const lines = window._wrapText(el.text, availW, fontSize);
      textW = availW;
      textH = lines.length * (fontSize + 4) + padY * 2;
    } else if (el.w === null && el.h !== null) {
      // Auto width, fixed height: measure full text without wrapping
      const availH = Math.max(el.h - padY * 2, 10);
      const lineHeight = fontSize + 4;
      const maxLines = Math.floor(availH / lineHeight);
      
      // Measure full text (no wrapping) - textW is content width only
      textW = window._measureText(el.text, fontSize);
      textH = availH;
    } else {
      // Both auto: measure full text without wrapping - textW is content width only
      const lineHeight = (fontSize || 11) + 4;
      textW = window._measureText(el.text, fontSize);
      textH = lineHeight + padY * 2;
    }
  }

  // Compute element size
  let w, h;
  if (el.w !== null) {
    w = Math.max(el.w, 20);
  } else {
    w = Math.max(maxChildW, textW) + padX * 2;
  }
  if (el.h !== null) {
    h = Math.max(el.h, 20);
  } else {
    h = Math.max(maxChildHForHeight + padY * 2, textH);
  }

  el._cw = w;
  el._ch = h;
  return {w, h};
}

// ═── Layout Pass 2: Resolve Positions (top-down) ────
/**
 * Parse size relative string.
 * Returns {type, value} or null.
 * type: 'parent', 'parent-percent', 'sibling'
 */
function parseSizeRel(rel) {
  if (rel === null || rel === undefined || rel === '') return null;
  const s = String(rel);
  if (s === 'parent') return {type: 'parent', value: 1};
  const pctM = s.match(/^parent-(\d+)%$/);
  if (pctM) return {type: 'parent-percent', value: parseInt(pctM[1]) / 100};
  const sibM = s.match(/^(?:child|sibling)-(.+)$/);
  if (sibM) return {type: 'sibling', value: sibM[1]};
  return null;
}

/**
 * Find an element by label in the tree.
 */
function findElementByLabel(label, el) {
  if (el.label === label) return el;
  if (el.children) {
    for (const c of el.children) {
      const found = findElementByLabel(label, c);
      if (found) return found;
    }
  }
  return null;
}

/**
 * Parse relative position string.
 * Returns {dir, val} or null.
 */
function parseRelative(rel) {
  if (rel === null || rel === undefined || rel === '') return null;
  const s = String(rel);
  const leftM = s.match(/^left-(-?\d+)$/);
  if (leftM) { const v = parseInt(leftM[1]); return {dir: 'left', val: v, isOutside: v < 0}; }
  const rightM = s.match(/^right-(-?\d+)$/);
  if (rightM) { const v = parseInt(rightM[1]); return {dir: 'right', val: v, isOutside: v < 0}; }
  const topM = s.match(/^top-(-?\d+)$/);
  if (topM) { const v = parseInt(topM[1]); return {dir: 'top', val: v, isOutside: v < 0}; }
  const bottomM = s.match(/^bottom-(-?\d+)$/);
  if (bottomM) { const v = parseInt(bottomM[1]); return {dir: 'bottom', val: v, isOutside: v < 0}; }
  const numM = s.match(/^-?\d+$/);
  if (numM) return {dir: 'abs', val: parseInt(numM[0]), isOutside: false};
  return null;
}

function resolveRelX(parsed, parentW, childW) {
  if (!parsed) return (parentW - childW) / 2;
  const cw = childW || 0;
  switch (parsed.dir) {
    case 'left':
      return parsed.val;
    case 'right':
      return parentW - parsed.val - cw;
    case 'abs':
      return parsed.val;
    default:
      return 0;
  }
}

function resolveRelY(parsed, parentH, childH) {
  if (!parsed) return 0;
  switch (parsed.dir) {
    case 'top':
      return parsed.val < 0 ? parsed.val : parsed.val;
    case 'bottom':
      return parentH - parsed.val - childH;
    case 'abs':
      return parsed.val;
    default:
      return 0;
  }
}

/**
 * Resolve positions for all children of a parent.
 * Two-pass approach:
 *   Pass 1: Position "inside" children (positive offset or auto) → expand parent to fit
 *   Pass 2: Position "outside" children (negative offset) → use fixed parent size
 */
function resolvePositions(parent) {
  if (!parent.children || parent.children.length === 0) return;

  // Ensure all children are measured first
  for (const child of parent.children) {
    if (child._cw === 0 && child._ch === 0) {
      measureElement(child);
    }
  }

  const padX = 10, padY = 8;

  // ── Pass 1: Position "inside" children only ──
  let curY = parent._ay + padY;
  let maxX = 0, maxY = 0, maxChildW = 0, maxChildH = 0, autoStackY = 0;

   for (const child of parent.children) {
    const parsedX = parseRelative(child.xRel);
    const parsedY = parseRelative(child.yRel);

    if ((parsedX && parsedX.isOutside) || (parsedY && parsedY.isOutside)) continue;
    // _isManual children (dragged/placed by user) don't affect layout
    if (child._isManual) continue;

    // Resolve X: offset from parent origin, then add parent absolute position
    const offsetX = resolveRelX(parsedX, parent._cw || 0, child._cw || 0);
    child._ax = (parent._ax || 0) + offsetX;

    // Resolve Y: if yRel is specified, use it; otherwise stack vertically
    if (parsedY) {
      const offsetY = resolveRelY(parsedY, parent._ch || 0, child._ch || 0);
      child._ay = (parent._ay || 0) + offsetY;
    } else {
      child._ay = curY + autoStackY;
      autoStackY += (child._ch || 0) + (parent.gapY || 5);
    }

    // Track bounding box for parent expansion
    // right-N/bottom-N (positive offset) children are pinned TO parent edge, skip them
    if (parsedX && parsedX.dir === 'right' && !parsedX.isOutside) {
      autoStackY += child._ch + (parent.gapY || 5);
      const childBottom2 = (child._ay || 0) - (parent._ay || 0) + child._ch;
      if (childBottom2 > maxY) maxY = childBottom2;
      continue;
    }
    if (parsedY && parsedY.dir === 'bottom' && !parsedY.isOutside) {
      autoStackY += child._ch + (parent.gapY || 5);
      const childRight2 = (child._ax || 0) - (parent._ax || 0) + (child._cw || 0);
      if (childRight2 > maxX) maxX = childRight2;
      continue;
    }
    let childRight, childBottom;
    if (parsedX && parsedX.dir === 'left' || parsedX && parsedX.dir === 'abs') {
      childRight = parsedX.val + (child._cw || 0);
    } else {
      childRight = (child._ax || 0) - (parent._ax || 0) + (child._cw || 0);
    }
    if (parsedY && (parsedY.dir === 'top' || parsedY.dir === 'abs')) {
      childBottom = parsedY.val + (child._ch || 0);
    } else {
      childBottom = (child._ay || 0) - (parent._ay || 0) + (child._ch || 0);
    }
    if (childRight > maxX) maxX = childRight;
    if (childBottom > maxY) maxY = childBottom;
  }

  // ── Compute parent's own text width ──
  let parentTextW = 0;
  if (parent.text) {
    const fontSize = parent.fontSize || 11;
    parentTextW = window._measureCtx ? (() => { window._measureCtx.font = fontSize + 'px sans-serif'; return window._measureCtx.measureText(parent.text).width; })() : 0;
  }

  // ── Recalculate auto-sized parent dimensions ──
  let maxRight = 0, maxBottom = 0;
  for (const child of parent.children) {
    if (child._isManual) continue;
    const parsedX = parseRelative(child.xRel);
    const parsedY = parseRelative(child.yRel);
    if ((parsedX && parsedX.isOutside) || (parsedY && parsedY.isOutside)) continue;
    // right-N/bottom-N children are pinned TO parent edge, don't contribute to expansion
    if (parsedX && parsedX.dir === 'right' && !parsedX.isOutside) continue;
    if (parsedY && parsedY.dir === 'bottom' && !parsedY.isOutside) continue;
    let cr, cb;
    if (parsedX && parsedX.dir === 'left') cr = parsedX.val + (child._cw || 0);
    else if (parsedX && parsedX.dir === 'abs') cr = parsedX.val + (child._cw || 0);
    else cr = (child._ax || 0) - (parent._ax || 0) + (child._cw || 0);
    if (parsedY && parsedY.dir === 'top') cb = parsedY.val + (child._ch || 0);
    else if (parsedY && parsedY.dir === 'abs') cb = parsedY.val + (child._ch || 0);
    else cb = (child._ay || 0) - (parent._ay || 0) + (child._ch || 0);
    if (cr > maxRight) maxRight = cr;
    if (cb > maxBottom) maxBottom = cb;
  }
  if (parent.w === null) {
    let childContentW = Math.max(maxRight, maxChildW, parentTextW);
    parent._cw = childContentW + padX * 2;
  }
  if (parent.h === null) {
    parent._ch = Math.max(maxBottom, 1) + padY * 2;
  }

  // ── Resolve sibling relative sizes ──
  for (const child of parent.children) {
    const wRelParsed = parseSizeRel(child.wRel);
    const hRelParsed = parseSizeRel(child.hRel);
    if (wRelParsed) {
      let newW;
      if (wRelParsed.type === 'sibling') {
        const sib = findElementByLabel(wRelParsed.value, parent);
        newW = sib ? sib._cw : child._cw;
      } else {
        newW = wRelParsed.type === 'parent' ? parent._cw : Math.round(parent._cw * wRelParsed.value);
      }
      if (newW !== undefined && newW > 0 && newW !== child._cw) {
        child.w = newW;
        child._cw = newW;
      }
    }
    if (hRelParsed) {
      let newH;
      if (hRelParsed.type === 'sibling') {
        const sib = findElementByLabel(hRelParsed.value, parent);
        newH = sib ? sib._ch : child._ch;
      } else {
        newH = hRelParsed.type === 'parent' ? parent._ch : Math.round(parent._ch * hRelParsed.value);
      }
      if (newH !== undefined && newH > 0 && newH !== child._ch) {
        child.h = newH;
        child._ch = newH;
      }
    }
  }

  // ── Pass 2: Position "outside" children using parent size ──
  for (const child of parent.children) {
    const parsedX = parseRelative(child.xRel);
    const parsedY = parseRelative(child.yRel);
    if (!(parsedX && parsedX.isOutside) && !(parsedY && parsedY.isOutside)) continue;
    if (child._isManual) continue;

    const offsetX = resolveRelX(parsedX, parent._cw || 0, child._cw || 0);
    child._ax = (parent._ax || 0) + offsetX;

    if (parsedY) {
      const offsetY = resolveRelY(parsedY, parent._ch || 0, child._ch || 0);
      child._ay = (parent._ay || 0) + offsetY;
    } else {
      child._ay = (parent._ay || 0) + (parent._ch - (child._ch || 0)) / 2;
    }
  }
}

function resolvePositionsTree(node) {
  resolvePositions(node);
  if (node.children) {
    for (const child of node.children) {
      resolvePositionsTree(child);
    }
  }
}

function computeLayout() {
  const MAX_ITER = 5;
  let prevKey = '';
  
  for (let iter = 0; iter < MAX_ITER; iter++) {
    measureElement(window.root);
    resolvePositionsTree(window.root);
    
    let key = `${window.root._cw.toFixed(2)}x${window.root._ch.toFixed(2)}`;
    if (iter > 0 && key === prevKey) {
      break;
    }
    prevKey = key;
  }
}

window.layoutModule = { measureElement, parseRelative, parseSizeRel, resolvePositions, computeLayout };

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    window._measureElement = measureElement;
    window._parseRelative = parseRelative;
    window._parseSizeRel = parseSizeRel;
    window._resolvePositions = resolvePositions;
    window._resolvePositionsTree = resolvePositionsTree;
    window._computeLayout = computeLayout;
    window._findElementByLabel = findElementByLabel;
    window._resolveRelX = resolveRelX;
    window._resolveRelY = resolveRelY;
  });
} else {
  window._measureElement = measureElement;
  window._parseRelative = parseRelative;
  window._parseSizeRel = parseSizeRel;
  window._resolvePositions = resolvePositions;
  window._resolvePositionsTree = resolvePositionsTree;
  window._computeLayout = computeLayout;
  window._findElementByLabel = findElementByLabel;
  window._resolveRelX = resolveRelX;
  window._resolveRelY = resolveRelY;
}
