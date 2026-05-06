// ═══════════════════════════════════════════════════════
// DATA MODEL & ELEMENT OPERATIONS
// ═══════════════════════════════════════════════════════

let nextId = 1;

/**
 * Create a new element node.
 * Every element can have text, background image, and children independently.
 */
function makeEl(type, opts = {}) {
  return {
    id: nextId++,
    type,
    label: opts.label || (type === 'box' ? 'Box' : type === 'circle' ? 'Circle' : 'Text'),
    shape: type === 'circle' ? 'circle' : 'rect',
    rx: type === 'circle' ? 999 : (opts.rx || 6),
    fill: opts.fill || '#ffffff22',
    stroke: opts.stroke || '#ffffff88',
    strokeWidth: opts.strokeWidth ?? 1.5,
    // Text on EVERY element
    text: opts.text || '',
    fontSize: opts.fontSize || 11,
    textColor: opts.textColor || '#ffffffcc',
    textAlign: opts.textAlign || 'start',
    // Background image (every element can have one)
    bgImage: opts.bgImage || null,
    bgImgWidth: opts.bgImgWidth || 0,
    bgImgHeight: opts.bgImgHeight || 0,
    // Size: null = auto (computed from content), number = fixed px
    w: opts.w ?? null,
    h: opts.h ?? null,
    // Relative size: "parent", "parent-N%", "child-Label", "child-index"
    wRel: opts.wRel ?? null,
    hRel: opts.hRel ?? null,
    // Relative position to parent: "left-N", "right-N", "top-N", "bottom-N", "-N", or null=auto
    xRel: opts.xRel ?? null,
    yRel: opts.yRel ?? null,
    // Gap between siblings (vertical)
    gapY: opts.gapY ?? 5,
    // Text overflow behavior when both dimensions are fixed and text doesn't fit
    // 'shrink' = shrink to minimum font size (default)
    // 'clip' = clip text that doesn't fit when minimum font size is reached
    textOverflow: opts.textOverflow ?? 'shrink',
    // Children (nested elements)
    children: opts.children ?? [],
    // Expanded state in tree view
    expanded: true,
    // Computed layout values (internal)
    _cw: 0, _ch: 0, _ax: 0, _ay: 0, _isManual: false,
  };
}

// Root element containing everything
window.root = makeEl('box', {
  label: 'Root Canvas',
  fill: '#1a1a2e',
  stroke: '#533483',
  w: null, h: null,
});

// Pre-populate with sample structure demonstrating nesting + relative positioning
window.root.children.push(
  makeEl('box', {
    label: 'Auto-Size Container',
    fill: '#2c3e6d',
    gapY: 5,
    children: [
      makeEl('box', {
        label: 'Centered Child (auto)',
        fill: '#34495e',
        text: 'This box auto-sizes to fit its text content',
        fontSize: 10,
        textColor: '#ffffffaa',
        children: [
          makeEl('circle', {
            label: 'Small Circle',
            fill: '#e9456044',
            stroke: '#e94560',
            text: '\u25cf',
            fontSize: 14,
          }),
        ],
      }),
      makeEl('box', {
        label: 'Right-Aligned Child',
        fill: '#8e44ad',
        xRel: 'right-10',
        text: 'Pinned to right edge',
        fontSize: 10,
        textColor: '#ffffffaa',
      }),
    ]
  }),
  makeEl('box', {
    label: 'Positioned Container',
    fill: '#3d2c6d',
    xRel: 'left-10',
    yRel: 'top-10',
    gapY: 5,
    children: [
      makeEl('circle', {
        label: 'Circle (centered)',
        fill: '#e9456044',
        stroke: '#e94560',
        text: 'Circle',
        fontSize: 10,
        textColor: '#ffffffcc',
      }),
      makeEl('box', {
        label: 'Bottom-Left Child',
        fill: '#1abc9c88',
        xRel: 'left-5',
        yRel: 'bottom-5',
        text: 'Bottom-left corner',
        fontSize: 9,
        textColor: '#ffffffcc',
      }),
    ]
  }),
  makeEl('box', {
    label: 'Outside Position Demo',
    fill: '#2d4a3e',
    xRel: 'left-10',
    yRel: 'top-10',
    gapY: 5,
    children: [
      makeEl('box', {
        label: 'Center (inside)',
        fill: '#1abc9c66',
        text: 'Inside parent',
        fontSize: 10,
        textColor: '#ffffffcc',
      }),
      makeEl('box', {
        label: 'Outside Right (right--20)',
        fill: '#e67e2288',
        xRel: 'right--20',
        text: '20px outside right',
        fontSize: 9,
        textColor: '#ffffffcc',
      }),
    ]
  }),
  makeEl('box', {
    label: 'Text Auto-Wrap Demo',
    fill: '#4a3e2c',
    xRel: 'left-10',
    yRel: 'top-10',
    w: 150,
    h: null,
    gapY: 5,
    children: [
      makeEl('box', {
        label: 'Fixed Width (auto height)',
        fill: '#6d4c2c',
        w: 150,
        text: 'This is a long sentence that should automatically wrap to multiple lines when the width is fixed.',
        fontSize: 10,
        textColor: '#ffffffcc',
      }),
      makeEl('box', {
        label: 'Both Fixed (text shrink)',
        fill: '#5c3d2e',
        w: 100,
        h: 50,
        text: 'This text is too long for this small box so the font size will be reduced to fit.',
        fontSize: 10,
        textColor: '#ffffffcc',
      }),
    ]
   }),
makeEl('box', {
    label: 'Relative Size Demo',
    fill: '#3e2c4a',
    xRel: 'left-10',
    yRel: 'top-10',
    w: 200,
    h: null,
    gapY: 5,
    children: [
      makeEl('box', {
        label: 'Parent (200px)',
        fill: '#5c2e6d',
        w: 200,
        text: 'Parent container',
        fontSize: 10,
        textColor: '#ffffffcc',
      }),
      makeEl('box', {
        label: 'Child-50% (parent-50%)',
        fill: '#8e44ad66',
        wRel: 'parent-50%',
        text: '50% of parent width',
        fontSize: 9,
        textColor: '#ffffffcc',
      }),
      makeEl('box', {
        label: 'Child-Same',
        fill: '#9b59b644',
        wRel: 'child-Parent (200px)',
        hRel: 'child-Parent (200px)',
        shape: 'circle',
        text: 'Same size',
        fontSize: 8,
        textColor: '#ffffffcc',
      }),
    ]
  }),
  makeEl('box', {
    label: 'Text Overflow Demo',
    fill: '#2c4a4a',
    xRel: 'left-10',
    yRel: 'top-10',
    w: 200,
    h: null,
    gapY: 5,
    children: [
      makeEl('box', {
        label: 'Shrink Mode (default)',
        fill: '#3d6d5c',
        w: 120,
        h: 50,
        text: 'This is very long text that will shrink to minimum font size when it does not fit in the box',
        fontSize: 11,
        textColor: '#ffffffcc',
      }),
      makeEl('box', {
        label: 'Clip Mode (truncated)',
        fill: '#4a6d3d',
        w: 120,
        h: 50,
        text: 'This is very long text that will be clipped with ellipsis when it exceeds the available space',
        fontSize: 11,
        textColor: '#ffffffcc',
        textOverflow: 'clip',
      }),
    ]
  })
);

window.selectedId = null;
window.dragState = null;

// ═── Element Operations ────────────────────────────────

function findElement(id, el = window.root) {
  if (el.id === id) return el;
  if (el.children) {
    for (const c of el.children) {
      const found = findElement(id, c);
      if (found) return found;
    }
  }
  return null;
}

function findParent(id, parent = window.root) {
  if (!parent.children) return null;
  for (const c of parent.children) {
    if (c.id === id) return parent;
    const found = findParent(id, c);
    if (found) return found;
  }
  return null;
}

function removeElement(id) {
  const parent = findParent(id);
  if (parent) {
    parent.children = parent.children.filter(c => c.id !== id);
    if (window.selectedId === id) window.selectedId = null;
    window._renderTree && window._renderTree();
    window._renderProps && window._renderProps();
    window._render && window._render();
  }
}

function addElement(type, parentEl = window.root) {
  const newEl = makeEl(type);
  if (!parentEl.children) parentEl.children = [];
  parentEl.children.push(newEl);
  window.selectedId = newEl.id;
  parentEl.expanded = true;
  window._renderTree && window._renderTree();
  window._renderProps && window._renderProps();
  window._render && window._render();
}

/**
 * Add a child to the currently selected element.
 */
function addSelectedChild(type) {
  const parent = findElement(window.selectedId);
  if (!parent || window.selectedId === window.root.id) return;
  const newEl = makeEl(type);
  if (!parent.children) parent.children = [];
  parent.children.push(newEl);
  window.selectedId = newEl.id;
  parent.expanded = true;
  window._renderTree && window._renderTree();
  window._renderProps && window._renderProps();
  window._render && window._render();
}

/**
 * Load a background image from local file.
 */
function loadBgImage(input) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    const el = findElement(window.selectedId);
    if (!el) return;
    
    const img = new Image();
    img.onload = () => {
      el.bgImage = e.target.result;
      el.bgImgWidth = img.width;
      el.bgImgHeight = img.height;
      
      if (el.w !== null && el.w > 0) {
        el.h = Math.round(el.w * (img.height / img.width));
      } else {
        el.w = img.width;
        el.h = img.height;
      }
      
      window._renderProps && window._renderProps();
      window._render && window._render();
    };
    img.onerror = () => {
      console.error('Failed to load background image');
      el.bgImage = null;
      window._renderProps && window._renderProps();
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

/**
 * Remove the background image from selected element.
 */
function clearBgImage() {
  const el = findElement(window.selectedId);
  if (el) {
    el.bgImage = null;
    window._renderProps && window._renderProps();
    window._render && window._render();
  }
}

// Export to window and trigger init after DOM load
window.dataModule = {
  makeEl,
  findElement,
  findParent,
  removeElement,
  addElement,
  addSelectedChild,
  loadBgImage,
  clearBgImage,
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    window._makeEl = makeEl;
    window._findElement = findElement;
    window._findParent = findParent;
    window._removeElement = removeElement;
    window._addElement = addElement;
    window._addSelectedChild = addSelectedChild;
    window._loadBgImage = loadBgImage;
    window._clearBgImage = clearBgImage;
    window._selectedId_get = () => window.selectedId;
    window._selectedId_set = (v) => { window.selectedId = v; };
  });
} else {
  window._makeEl = makeEl;
  window._findElement = findElement;
  window._findParent = findParent;
  window._removeElement = removeElement;
  window._addElement = addElement;
  window._addSelectedChild = addSelectedChild;
  window._loadBgImage = loadBgImage;
  window._clearBgImage = clearBgImage;
  window._selectedId_get = () => window.selectedId;
  window._selectedId_set = (v) => { window.selectedId = v; };
}
