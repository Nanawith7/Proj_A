// ═══════════════════════════════════════════════════════
// INTERACTION (Drag, Select, Keyboard, Hover)
// ═══════════════════════════════════════════════════════

const canvasWrap = document.getElementById('canvas-wrap');

function getSVGPoint(e) {
  const rect = window._svgCanvas_get().getBoundingClientRect();
  const vb = window._svgCanvas_get().viewBox.baseVal;
  const scaleX = vb.width / rect.width;
  const scaleY = vb.height / rect.height;
  return {
    x: (e.clientX - rect.left) * scaleX,
    y: (e.clientY - rect.top) * scaleY,
  };
}

function findElementAt(x, y, el) {
  // Check children first (first data-tree child = on-top in SVG render order)
  if (el.children) {
    for (let i = 0; i < el.children.length; i++) {
      const child = el.children[i];
      if (child._ax !== undefined && x >= child._ax && x <= child._ax + (child._cw || 0) &&
          child._ay !== undefined && y >= child._ay && y <= child._ay + (child._ch || 0)) {
        const found = findElementAt(x, y, child);
        if (found) return found;
      }
    }
  }
  // Check this element only if no child matched
  if (el._ax !== undefined && x >= el._ax && x <= el._ax + (el._cw || 0) &&
      el._ay !== undefined && y >= el._ay && y <= el._ay + (el._ch || 0)) {
    return el;
  }
  return null;
}

window._svgCanvas_get().addEventListener('mousedown', (e) => {
  if (e.button !== 0) return;
  const pt = getSVGPoint(e);

  const el = findElementAt(pt.x, pt.y, window.root);
  if (el) {
    window.selectedId = el.id;
    window.dragState = {
      id: el.id,
      startAx: el._ax || 0,
      startAy: el._ay || 0,
      mouseX: pt.x,
      mouseY: pt.y,
    };
    window._renderTree();
    window._renderProps();
    e.preventDefault();
  } else {
    window.selectedId = null;
    window._renderTree();
    window._renderProps();
    window._render();
  }
});

window.addEventListener('mousemove', (e) => {
  if (!window.dragState) return;
  const pt = getSVGPoint(e);
  const el = window._findElement(window.dragState.id);
  if (!el) { window.dragState = null; return; }

  const dx = pt.x - window.dragState.mouseX;
  const dy = pt.y - window.dragState.mouseY;
  el._ax = window.dragState.startAx + dx;
  el._ay = window.dragState.startAy + dy;

  window._render(true); // skip layout during drag
});

window.addEventListener('mouseup', () => {
  if (window.dragState) {
    const el = window.findElement(window.dragState.id);
    if (el) {
      const dx = Math.abs(el._ax - window.dragState.startAx);
      const dy = Math.abs(el._ay - window.dragState.startAy);
      if (dx > 1 || dy > 1) {
        el._isManual = true;
      }
    }
    window.dragState = null;
    window._render(); // recompute layout after drag
  }
});

// Hover info
const hoverInfo = document.getElementById('hover-info');
window._svgCanvas_get().addEventListener('mousemove', (e) => {
  if (window.dragState) return;
  const pt = getSVGPoint(e);
  const el = findElementAt(pt.x, pt.y, window.root);
  if (el && el._cw > 0) {
    hoverInfo.style.display = 'block';
    hoverInfo.textContent = `${el.label}\nx:${Math.round(el._ax)} y:${Math.round(el._ay)}\nw:${Math.round(el._cw)} h:${Math.round(el._ch)}\nxRel:${el.xRel ?? 'auto'} yRel:${el.yRel ?? 'auto'}`;
  } else {
    hoverInfo.style.display = 'none';
  }
});

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
  if (e.key === 'Delete' && window.selectedId !== null && window.selectedId !== window.root.id) {
    window._removeElement(window.selectedId);
  }
  if (e.key === 'Escape') {
    window.selectedId = null;
    window._renderTree();
    window._renderProps();
    window._render();
  }
});

window.interactionModule = { getSVGPoint, findElementAt };

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    window._getSVGPoint = getSVGPoint;
    window._findElementAt = findElementAt;
    window._dragState_get = () => window.dragState;
    window._dragState_set = (v) => { window.dragState = v; };
  });
} else {
  window._getSVGPoint = getSVGPoint;
  window._findElementAt = findElementAt;
  window._dragState_get = () => window.dragState;
  window._dragState_set = (v) => { window.dragState = v; };
}
