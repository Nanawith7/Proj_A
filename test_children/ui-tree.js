// ═══════════════════════════════════════════════════════
// EDITOR UI - Tree View
// ═══════════════════════════════════════════════════════

const treeContainer = document.getElementById('tree-container');

function renderTree() {
  treeContainer.innerHTML = '';
  _renderTreeNode(root, treeContainer);
}

function _renderTreeNode(el, parentDiv) {
  const nodeDiv = document.createElement('div');
  nodeDiv.classList.add('tree-node');

  const header = document.createElement('div');
  header.classList.add('tree-node-header');
  if (el.id === window.selectedId) header.classList.add('selected');

  // Toggle arrow
  const toggle = document.createElement('span');
  toggle.classList.add('tree-toggle');
  toggle.textContent = el.children && el.children.length > 0 ? (el.expanded ? '\u25bc' : '\u25b6') : ' ';
  if (el.children && el.children.length > 0) {
    toggle.onclick = (e) => { e.stopPropagation(); el.expanded = !el.expanded; renderTree(); };
  }
  header.appendChild(toggle);

  // Color indicator
  const icon = document.createElement('span');
  icon.classList.add('tree-icon');
  icon.style.background = el.fill;
  header.appendChild(icon);

  // Label with position info
  let label = el.label;
  if (el.xRel || el.yRel) {
    label += ` [${el.xRel || 'auto'},${el.yRel || 'auto'}]`;
  } else if (el.w === null && el.h === null) {
    label += ' [auto]';
  }
  const labelEl = document.createElement('span');
  labelEl.classList.add('tree-label');
  labelEl.textContent = label;
  header.appendChild(labelEl);

  // Delete button (not for root)
  if (el.id !== window.root.id) {
    const delBtn = document.createElement('button');
    delBtn.classList.add('tree-delete');
    delBtn.textContent = '\u00d7';
    delBtn.onclick = (e) => { e.stopPropagation(); window._removeElement(el.id); };
    header.appendChild(delBtn);
  }

  // Click to select
  header.onclick = () => {
    window.selectedId = el.id;
    renderTree();
    window._renderProps();
    window._render();
  };

  nodeDiv.appendChild(header);

  // Children
  if (el.children && el.children.length > 0 && el.expanded) {
    for (const child of el.children) {
      _renderTreeNode(child, nodeDiv);
    }
  }

  parentDiv.appendChild(nodeDiv);
}

window.uiTreeModule = { renderTree };

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    window._renderTree = renderTree;
  });
} else {
  window._renderTree = renderTree;
}
