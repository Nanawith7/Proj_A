// ═══════════════ Canvas Viewer ═══════════════
const API = '/api/filter';
let ALL_NODES=[], ALL_EDGES=[], VAULT={}, TYPEDEFS={}, NODEVIEWS={};
let currentNodes=[], currentEdges=[];
let panX=0, panY=0, zoom=1, dragging=false, dsX=0, dsY=0, expandedId=null;

const _measureCtx = document.createElement('canvas').getContext('2d');
function measureText(text, fontSize, fontFamily) {
  _measureCtx.font = `${fontSize}px ${fontFamily||'sans-serif'}`;
  return _measureCtx.measureText(text).width;
}

// ═══════ NodeView layout params ═══════
// Fills missing layout params with defaults from nv shape.
// When expanded=true, always uses rect-style params regardless of shape.
function layoutParams(nv, nw, nh) {
  const s = nv.shape || 'rect';
  const cpX = nv.layout?.contentPadX ?? 8;
  const cpY = nv.layout?.contentPadY ?? 8;
  const tpX = nv.layout?.titlePadX ?? (nv.titlePad ?? 6);
  const tpY = nv.layout?.titlePadY ?? (nv.titlePad ?? 6);

  if (s === 'circle') {
    const d = Math.min(nw, nh);
    const ox = Math.floor((nw - d) / 2), oy = Math.floor((nh - d) / 2);
    // Collapsed title uses tight padding; body uses contentPadY
    const titlePY = nv.layout?.titlePadY ?? cpY;
    return {
      contentX: ox + cpX, contentY: oy + cpY,
      contentW: d - 2 * cpX, contentH: d - 2 * cpY,
      titleAnchor: 'middle', titleVAlign: 'center',
      titleX: nw / 2, titleY: oy + d / 2 + (nv.fontSize || 12) / 3,
      titlePadX: tpX, titlePadY: titlePY,
      titleWrap: nv.titleWrap ?? false,
    };
  }
  // rect / round
  const tH = nv.titleY === 'top' ? tpY + (nv.fontSize || 12) : 0;
  return {
    contentX: cpX, contentY: tH + cpY,
    contentW: nw - 2 * cpX, contentH: nh - tH - 2 * cpY,
    titleAnchor: 'start', titleVAlign: nv.titleY || 'center',
    titleX: tpX,
    titleY: nv.titleY === 'top' ? tpY + (nv.fontSize || 12) : nh / 2 + (nv.fontSize || 12) / 3,
    titlePadX: tpX, titlePadY: tpY,
    titleWrap: nv.titleWrap ?? false,
  };
}

// ═══════ INIT ═══════
async function init() {
  const [d1,d2] = await Promise.all([fetch('/api/data').then(r=>r.json()),fetch('/api/typedefs').then(r=>r.json())]);
  ALL_NODES=d1.nodes; ALL_EDGES=d1.edges; VAULT=d1.vault; TYPEDEFS=d2;
  NODEVIEWS = await loadNodeViews();
  currentNodes=ALL_NODES; currentEdges=ALL_EDGES;
  const keys=new Set(); Object.values(VAULT).forEach(v=>{if(v.props)Object.keys(v.props).forEach(k=>keys.add(k));});
  const sel=document.getElementById('sort-key');
  [...keys].sort().forEach(k=>{const o=document.createElement('option');o.value=k;o.textContent=k;sel.appendChild(o);});
  render(); addRow('filter-rows');
}

async function loadNodeViews() {
  const map={};
  const names=Object.values(TYPEDEFS).map(td=>td.nodeview).filter(Boolean);
  for(const name of [...new Set(names)]) {
    try { map[name]=await fetch(`/api/nodeview/${name}.json`).then(r=>r.json()); }
    catch(e){ map[name]={shape:'rect',rx:4}; }
  }
  return map;
}

function nodeStem(n){return(n.file||'').replace('.md','').split('/').pop();}
function nodeType(n){const stem=nodeStem(n);return(VAULT[stem]?.props?.type)||'default';}
function nodeTitle(n){const stem=nodeStem(n);return(VAULT[stem]?.props?.title)||stem;}

// ═══════ RENDER ═══════
function render() {
  const graph=document.getElementById('graph'); graph.innerHTML='';
  const svgNS='http://www.w3.org/2000/svg';
  const svg=document.createElementNS(svgNS,'svg');
  let maxX=200,maxY=200;
  currentNodes.forEach(n=>{const r=(n.x||0)+(n.width||200),b=(n.y||0)+(n.height||120);if(r>maxX)maxX=r;if(b>maxY)maxY=b;});
  maxX+=400;maxY+=400;
  svg.setAttribute('viewBox',`0 0 ${maxX} ${maxY}`);
  svg.setAttribute('preserveAspectRatio','xMidYMid meet');
  svg.style.width='100%';svg.style.height='100%';svg.style.minWidth=maxX+'px';svg.style.minHeight=maxY+'px';
  const mainG=document.createElementNS(svgNS,'g');mainG.id='main-group';
  updateTransform(mainG);

  const nids=new Set(currentNodes.map(n=>n.id));
  currentEdges.filter(e=>nids.has(e.fromNode)&&nids.has(e.toNode)).forEach(e=>{
    const fn=currentNodes.find(n=>n.id===e.fromNode),tn=currentNodes.find(n=>n.id===e.toNode);
    if(!fn||!tn)return;
    const fw=fn.width||200,fh=fn.height||120,tw=tn.width||200,th=tn.height||120;
    const x1=(fn.x||0)+fw/2,y1=(fn.y||0)+fh/2,x2=(tn.x||0)+tw/2,y2=(tn.y||0)+th/2;
    const mx=(x1+x2)/2,my=(y1+y2)/2,ec=e.color||'#666';
    const p=document.createElementNS(svgNS,'path');
    p.setAttribute('d',`M${x1},${y1} Q${mx+30},${my-30} ${x2},${y2}`);
    p.setAttribute('stroke',ec);p.setAttribute('class','edge-path');mainG.appendChild(p);
    if(e.label){const t=document.createElementNS(svgNS,'text');t.setAttribute('x',mx);t.setAttribute('y',my-6);t.setAttribute('fill',ec);t.setAttribute('class','edge-label');t.setAttribute('text-anchor','middle');t.textContent=e.label;mainG.appendChild(t);}
  });

  currentNodes.forEach(n=>{
    const type=nodeType(n),td=TYPEDEFS[type]||{},nvName=td.nodeview||'plain',nv=NODEVIEWS[nvName]||{shape:'rect',rx:4};
    const nw=n.width||200,nh=n.height||120,nx=n.x||0,ny=n.y||0,fill=n.color||td.color||'#555',title=nodeTitle(n);
    const stem=nodeStem(n),v=VAULT[stem];
    const g=document.createElementNS(svgNS,'g');g.setAttribute('data-id',n.id);

    // ── Check if node has properties to render as children ──
    const children = nodeViewToChildren(nv, v || {});

    if (children && children.children.length > 0) {
      // ── New children rendering path ──
      children._ax = nx, children._ay = ny;
      children._cw = null, children._ch = null;
      computeChildrenLayout(children);

      // Update node size from layout
      children._cw = nw || children._cw || 200;
      children._ch = nh || children._ch || 120;

      // Draw parent rect
      const pRect = document.createElementNS(svgNS, 'rect');
      pRect.setAttribute('data-id', n.id);
      pRect.setAttribute('class', 'node-rect');
      pRect.style.cursor = 'pointer';
      pRect.setAttribute('x', children._ax);
      pRect.setAttribute('y', children._ay);
      pRect.setAttribute('width', children._cw);
      pRect.setAttribute('height', children._ch);
      const shape = nv.shape || 'rect';
      const rx = nv.rx || 4;
      pRect.setAttribute('rx', shape === 'circle' ? Math.min(children._cw, children._ch) / 2 : shape === 'round' ? 18 : rx);
      pRect.setAttribute('ry', shape === 'circle' ? Math.min(children._cw, children._ch) / 2 : shape === 'round' ? 18 : rx);
      const op = nv.layout?.collapsedFillOpacity;
      if (op !== undefined) pRect.setAttribute('opacity', op);
      pRect.setAttribute('fill', n.color || td.color || '#555');
      pRect.setAttribute('stroke', nv.stroke || '#fff6');
      pRect.setAttribute('stroke-width', nv.strokeWidth || 0.5);
      pRect.onclick = e => { e.stopPropagation(); toggleExpand(n, g, mainG); };
      g.appendChild(pRect);

      // Title
      const lp = layoutParams(nv, children._cw, children._ch);
      const fs = Math.max(9, Math.min(14, nv.fontSize || 12));
      const tText = truncateTitle(title, fs, lp);
      if (lp.titleWrap) {
        drawWrappedTitle(g, svgNS, title, fs, lp, children._ax, children._ay, nv);
      } else {
        const txt = document.createElementNS(svgNS, 'text');
        txt.setAttribute('class', 'node-title');
        txt.setAttribute('font-size', fs);
        if (nv.boldTitle) txt.setAttribute('font-weight', 'bold');
        txt.setAttribute('text-anchor', lp.titleAnchor);
        txt.setAttribute('x', children._ax + (lp.titleAnchor === 'middle' ? lp.titleX : lp.titleX));
        txt.setAttribute('y', children._ay + lp.titleY);
        txt.setAttribute('fill', '#fff');
        txt.textContent = tText || title;
        g.appendChild(txt);
      }

      // Icon
      const iconPath = v?.props?.icon;
      if (iconPath) {
        const isz = Math.min(children._cw, children._ch) * 0.45;
        const anchorX = nv.layout?.iconAnchorX || 'center';
        const anchorY = nv.layout?.iconAnchorY || 'center';
        const ipx = nv.layout?.iconPadX || 0, ipy = nv.layout?.iconPadY || 0;
        let ix, iy;
        if (anchorX === 'left') ix = children._ax + ipx;
        else if (anchorX === 'right') ix = children._ax + children._cw - isz - ipx;
        else ix = children._ax + (children._cw - isz) / 2;
        if (anchorY === 'top') iy = children._ay + ipy;
        else if (anchorY === 'bottom') iy = children._ay + children._ch - isz - ipy;
        else iy = children._ay + (children._ch - isz) / 2;
        const img = document.createElementNS(svgNS, 'image');
        img.setAttribute('href', '/_icons/' + iconPath.split('/').pop());
        img.setAttribute('x', ix); img.setAttribute('y', iy);
        img.setAttribute('width', isz); img.setAttribute('height', isz);
        img.setAttribute('class', 'node-icon-img');
        img.style.pointerEvents = 'none';
        g.appendChild(img);
      }

      // Draw children rects
      for (const child of children.children) {
        const childRect = document.createElementNS(svgNS, 'rect');
        childRect.setAttribute('class', 'node-body');
        childRect.setAttribute('x', child._ax || children._ax);
        childRect.setAttribute('y', child._ay || children._ay);
        childRect.setAttribute('width', child._cw || 0);
        childRect.setAttribute('height', child._ch || 0);
        childRect.setAttribute('rx', child.rx || 3);
        childRect.setAttribute('ry', child.rx || 3);
        childRect.setAttribute('fill', child.fill || '#fff2');
        childRect.setAttribute('stroke', child.stroke || '#fff2');
        childRect.setAttribute('stroke-width', 0.5);
        g.appendChild(childRect);

        // Child text
        if (child.text) {
          const cTxt = document.createElementNS(svgNS, 'text');
          cTxt.setAttribute('class', 'node-body');
          cTxt.setAttribute('x', (child._ax || children._ax) + (child._cw || 0) / 2);
          cTxt.setAttribute('y', (child._ay || children._ay) + (child._ch || 0) / 2 + 3);
          cTxt.setAttribute('text-anchor', 'middle');
          cTxt.setAttribute('fill', child.textColor || '#eee');
          cTxt.setAttribute('font-size', child.fontSize || 12);
          cTxt.textContent = child.text;
          g.appendChild(cTxt);
        }
      }

      mainG.appendChild(g);
    } else {
      // ── Existing rendering path (unchanged) ──
      const iconPath = v?.props?.icon;
      if (iconPath) {
        const isz = Math.min(nw, nh) * 0.45;
        const anchorX = nv.layout?.iconAnchorX || 'center';
        const anchorY = nv.layout?.iconAnchorY || 'center';
        const ipx = nv.layout?.iconPadX || 0, ipy = nv.layout?.iconPadY || 0;
        let ix, iy;
        if (anchorX === 'left') ix = nx + ipx;
        else if (anchorX === 'right') ix = nx + nw - isz - ipx;
        else ix = nx + (nw - isz) / 2;
        if (anchorY === 'top') iy = ny + ipy;
        else if (anchorY === 'bottom') iy = ny + nh - isz - ipy;
        else iy = ny + (nh - isz) / 2;
        const img = document.createElementNS(svgNS, 'image');
        img.setAttribute('href', '/_icons/' + iconPath.split('/').pop());
        img.setAttribute('x', ix); img.setAttribute('y', iy);
        img.setAttribute('width', isz); img.setAttribute('height', isz);
        img.setAttribute('class', 'node-icon-img');
        img.style.pointerEvents = 'none';
        g.appendChild(img);
      }

      const lp = layoutParams(nv, nw, nh);
      const fs = Math.max(9, Math.min(14, nv.fontSize || 12));
      const tText = truncateTitle(title, fs, lp);

      if (lp.titleWrap) {
        drawWrappedTitle(g, svgNS, title, fs, lp, nx, ny, nv);
      } else {
        const txt = document.createElementNS(svgNS, 'text');
        txt.setAttribute('class', 'node-title');
        txt.setAttribute('font-size', fs);
        if (nv.boldTitle) txt.setAttribute('font-weight', 'bold');
        txt.setAttribute('text-anchor', lp.titleAnchor);
        txt.setAttribute('x', nx + (lp.titleAnchor === 'middle' ? lp.titleX : lp.titleX));
        txt.setAttribute('y', ny + lp.titleY);
        txt.setAttribute('fill', '#fff');
        txt.textContent = tText || title;
        g.appendChild(txt);
      }
      mainG.appendChild(g);
    }
  });

  svg.appendChild(mainG);graph.appendChild(svg);expandedId=null;

  graph.onmousedown=e=>{if(e.target===svg||e.target===mainG||e.target===graph){dragging=true;dsX=e.clientX-panX;dsY=e.clientY-panY;graph.classList.add('dragging');e.preventDefault();}};
  window.onmousemove=e=>{if(!dragging)return;panX=e.clientX-dsX;panY=e.clientY-dsY;updateTransform(mainG);};
  window.onmouseup=()=>{dragging=false;graph.classList.remove('dragging');};
  graph.onwheel=e=>{e.preventDefault();const d=e.deltaY>0?.9:1.1;const mx=e.clientX-graph.getBoundingClientRect().left,my=e.clientY-graph.getBoundingClientRect().top;const nz=Math.max(.1,Math.min(5,zoom*d));panX=mx-(mx-panX)*(nz/zoom);panY=my-(my-panY)*(nz/zoom);zoom=nz;updateTransform(mainG);updateZoomInfo();};
  updateZoomInfo();
  document.getElementById('stats').textContent=`Nodes: ${currentNodes.length} | Edges: ${currentEdges.length}`;
}

function truncateTitle(title, fs, lp) {
  const maxW = lp.contentW;
  let t=title;
  while(t.length>1 && measureText(t+'..', fs, 'sans-serif') > maxW) t=t.slice(0,-1);
  return t.length<title.length ? t+'..' : title;
}

function drawWrappedTitle(g, svgNS, title, fs, lp, nx, ny, nv) {
  // For collapsed title: center vertically in the shape, use titleY as baseline
  const maxW=lp.contentW;
  const totalLines=Math.ceil(measureText(title,fs,'sans-serif')/maxW);
  if(totalLines<1)return;
  const titleBlockH=totalLines*(fs+2);
  let startY=ny+lp.titleY-titleBlockH/2+fs;
  let pos=0,line=0;
  while(pos<title.length){
    let len=1;
    while(pos+len<=title.length&&measureText(title.slice(pos,pos+len),fs,'sans-serif')<maxW)len++;
    if(len===1&&pos+1<=title.length)len=2;
    const t2=document.createElementNS(svgNS,'text');t2.setAttribute('class','node-title');
    t2.setAttribute('font-size',fs);if(nv.boldTitle)t2.setAttribute('font-weight','bold');
    t2.setAttribute('text-anchor','middle');
    t2.setAttribute('x',nx+lp.titleX);
    t2.setAttribute('y',startY+line*(fs+2));
    t2.setAttribute('fill','#fff');
    t2.textContent=title.slice(pos,pos+len-1);
    g.appendChild(t2);pos+=len-1;line++;
  }
}

function applyNodeView(rect, node, expanded) {
  const type=nodeType(node),td=TYPEDEFS[type]||{},nvName=td.nodeview||'plain',nv=NODEVIEWS[nvName]||{shape:'rect',rx:4};
  let nw=node.width||200,nh=node.height||120;
  if(expanded) { nw=expanded.width; nh=expanded.height; }
  rect.setAttribute('x',node.x||0);rect.setAttribute('y',node.y||0);
  rect.setAttribute('width',nw);rect.setAttribute('height',nh);
  const shape=nv.shape||'rect';
  const rx=nv.rx||4;
  rect.setAttribute('rx',shape==='circle'?Math.min(nw,nh)/2:shape==='round'?18:rx);
  rect.setAttribute('ry',shape==='circle'?Math.min(nw,nh)/2:shape==='round'?18:rx);
  rect.setAttribute('fill',node.color||td.color||'#555');
  rect.setAttribute('stroke',nv.stroke||'#fff6');
  rect.setAttribute('stroke-width',nv.strokeWidth||.5);
  // Apply opacity from nodeview based on state
  const op=expanded?(nv.layout?.expandedFillOpacity):(nv.layout?.collapsedFillOpacity);
  if(op!==undefined)rect.setAttribute('opacity',op);
  else rect.removeAttribute('opacity');
}

function updateTransform(g){g.setAttribute('transform',`translate(${panX},${panY}) scale(${zoom})`);}
function updateZoomInfo(){let el=document.getElementById('zoom-info');if(!el){el=document.createElement('div');el.id='zoom-info';document.getElementById('graph').appendChild(el);}el.textContent=`${Math.round(zoom*100)}%`;}

function resolvePos(raw, total){
  if(raw===undefined||raw===null||raw==='')return -1;
  if(typeof raw==='string'&&raw.endsWith('%'))return parseFloat(raw)/100*total;
  return parseFloat(raw);
}

// ═══════ EXPAND ═══════
function toggleExpand(node, g, mainG) {
  const nid=node.id,mode=document.getElementById('expand-mode')?.value||'wrap';
  if(expandedId&&expandedId!==nid)collapseAll(mainG);
  if(expandedId===nid){collapseAll(mainG);expandedId=null;return;}
  expandedId=nid;

  g.querySelectorAll('.node-title,.node-icon-img').forEach(el=>el.style.opacity='0');
  const stem=nodeStem(node),v=VAULT[stem];if(!v)return;
  const type=nodeType(node),td=TYPEDEFS[type]||{},nv=NODEVIEWS[td.nodeview||'plain']||{shape:'rect',rx:4};
  const lines=buildBodyLines(v,nv);
  const cpX=nv.layout?.contentPadX ?? 8;
  const cpY=nv.layout?.contentPadY ?? 8;

  // Measure content to compute required size
  let maxLineW=0, lineH=0;
  lines.forEach(ln=>{
    if(ln.t==='br'){lineH+=10;return;}
    if(ln.t==='hr'){lineH+=4;return;}
    if(ln.t==='code')return;
    const fs=ln.t==='h'?14:ln.t==='pill'?9:10;
    if(ln.t==='pill'){
      let pillW=cpX; ln.items.forEach(item=>{pillW+=measureText(item,fs,'sans-serif')+18;});
      if(pillW>maxLineW)maxLineW=pillW;
      lineH+=fs+10;
    }else if(ln.text){
      if(mode==='wrap'){
        let lc=Math.ceil(measureText(ln.text,fs,'sans-serif')/300);
        if(lc<1)lc=1;
        if(measureText(ln.text,fs,'sans-serif')>maxLineW)maxLineW=Math.min(measureText(ln.text,fs,'sans-serif'),600);
        lineH+=lc*(fs+4);
      }else{
        const w=measureText(ln.text,fs,'sans-serif');
        if(w>maxLineW)maxLineW=w;
        lineH+=fs+4;
      }
    }
  });

  // Compute expand size from measured content
  const minW=nv.layout?.expandMinW ?? 300;
  const minH=nv.layout?.expandMinH ?? 200;
  const neededW=maxLineW+cpX*2+16;
  const neededH=lineH+cpY*2+16;
  let expW=Math.max(minW,neededW);
  let expH=Math.max(minH,neededH);
  // Maintain ratio from expandMin (or original node)
  const ow=nv.shape==='circle'?minW:(node.width||200);
  const oh=nv.shape==='circle'?minH:(node.height||120);
  if(ow>0&&oh>0){
    const ratio=ow/oh;
    if(expW/expH>ratio)expH=expW/ratio;
    else expW=expH*ratio;
    expW=Math.max(expW,neededW);expH=Math.max(expH,neededH);
  }

  const expLP=layoutParams(nv,expW,expH);
  const bodyPadX=expLP.contentX;
  const bodyPadY=expLP.contentY;

  const rect=g.querySelector('.node-rect');
  applyNodeView(rect,node,{width:expW,height:expH});

  const nx=node.x||0,ny=node.y||0;

  // Expanded icon: position from nodeview layout
  const exIconPath=v?.props?.icon;
  if(exIconPath){
    g.querySelectorAll('.node-icon-ex').forEach(el=>el.remove());
    const ax=nv.layout?.expandedIconAnchorX||nv.layout?.iconAnchorX||'left';
    const ay=nv.layout?.expandedIconAnchorY||nv.layout?.iconAnchorY||'top';
    const px=nv.layout?.expandedIconPadX??nv.layout?.iconPadX??4;
    const py=nv.layout?.expandedIconPadY??nv.layout?.iconPadY??4;
    const isz=nv.layout?.expandedIconSize??Math.min(40,(node.width||200)>0?(node.width||200):40);
    let ix,iy;
    if(ax==='right')ix=nx+expW-isz-px;
    else if(ax==='center')ix=nx+(expW-isz)/2;
    else ix=nx+px;
    if(ay==='bottom')iy=ny+expH-isz-py;
    else if(ay==='center')iy=ny+(expH-isz)/2;
    else iy=ny+py;
    const img=document.createElementNS('http://www.w3.org/2000/svg','image');
    img.setAttribute('href','/_icons/'+exIconPath.split('/').pop());
    img.setAttribute('x',ix);img.setAttribute('y',iy);
    img.setAttribute('width',isz);img.setAttribute('height',isz);
    img.setAttribute('class','node-icon-ex');
    img.style.pointerEvents='none';
    g.appendChild(img);
  }

  // Expanded background
  g.querySelectorAll('.node-bg').forEach(el=>el.remove());
  const bgPath=nv.background;
  if(bgPath){
    const bg=document.createElementNS('http://www.w3.org/2000/svg','image');
    bg.setAttribute('href','/_viewbg/'+bgPath);
    bg.setAttribute('x',nx);bg.setAttribute('y',ny);
    bg.setAttribute('width',expW);bg.setAttribute('height',expH);
    bg.setAttribute('class','node-bg');
    bg.setAttribute('preserveAspectRatio','none');
    bg.style.opacity=nv.layout?.backgroundOpacity??0.15;
    bg.style.pointerEvents='none';
    g.insertBefore(bg,g.firstChild);
  }

  currentNodes.forEach(n=>{
    if(n.id===nid)return;
    const g2=mainG.querySelector(`g[data-id="${n.id}"]`);if(!g2)return;
    const rect2=g2.querySelector('.node-rect');if(!rect2)return;
    const ox=n.x||0,oy=n.y||0,ow=n.width||200,oh=n.height||120;
      if(nx+expW>ox&&nx<ox+ow&&ny+expH>oy&&ny<oy+oh){
        const shift=Math.max(0,(nx+expW)-ox+20);
        rect2.setAttribute('x',ox+shift);
        g2.querySelectorAll('.node-title,.node-icon-img').forEach(el=>{
          const curX=parseFloat(el.getAttribute('x')||0);
          el.setAttribute('x',curX+shift);
        });
      }
  });

  g.querySelectorAll('.node-body').forEach(el=>el.remove());
  const svgNS='http://www.w3.org/2000/svg';
  let cy=ny+bodyPadY+12;
  const bodyPos=nv.layout?.bodyPosition;
  if(bodyPos){const bpy=resolvePos(bodyPos.y,expH);if(bpy>=0)cy=ny+bpy;}
  // Title position override (renders BEFORE body, so we handle in buildBodyLines)
  lines.forEach(ln=>{
    // Absolute/percentage position override: save flow cy, restore after
    const savedCY=cy;
    if(ln.pos){
      const py=resolvePos(ln.pos.y,expH);
      if(py>=0)cy=ny+py;
    }
    if(ln.t==='br'){cy=savedCY+10;return;}
    if(ln.t==='hr'){cy=savedCY+4;return;}
    if(ln.t==='code')return;
    if(ln.t==='pill'){
      const fs=9,padX=6,padY=3;
      const posX=ln.pos?resolvePos(ln.pos.x,expW):-1;
      let bx=posX>=0?nx+posX:nx+bodyPadX;
      ln.items.forEach(item=>{
        const tw=measureText(item,fs,'sans-serif')+padX*2;
        if(posX<0&&bx+tw>nx+expW-8){bx=nx+bodyPadX;cy+=fs+padY*2+4;}
        const r=document.createElementNS(svgNS,'rect');r.setAttribute('x',bx);r.setAttribute('y',cy-fs-padY);
        r.setAttribute('width',tw);r.setAttribute('height',fs+padY*2);
        const rx=ln.shape==='diamond'?4:ln.shape==='round'?10:3;
        r.setAttribute('rx',rx);r.setAttribute('ry',rx);r.setAttribute('fill',ln.bg||'#fff2');
        r.setAttribute('stroke',ln.textColor||'#fff');r.setAttribute('stroke-width','0.5');
        r.setAttribute('class','node-body');g.appendChild(r);
        const t=document.createElementNS(svgNS,'text');t.setAttribute('x',bx+padX);t.setAttribute('y',cy);
        t.setAttribute('fill',ln.textColor||'#eee');t.setAttribute('font-size',fs);t.setAttribute('class','node-body');
        t.textContent=item;g.appendChild(t);bx+=tw+6;
      });
      cy+=fs+padY*2+6;
      if(ln.pos)cy=savedCY; // restore flow after positioned pill
      return;
    }
    let fs2=ln.t==='h'?14:10;
    let fill=(nv.layout?.titleColor||'#e94560');
    if(ln.t==='q')fill=(nv.layout?.quoteColor||'#aaa');
    else if(ln.t==='p')fill=ln.color||(nv.layout?.bodyColor||'#ddd');
    if(ln.text){
      let txt=ln.text;
      if(mode==='wrap'){
        let pos=0;
        const lx=ln.pos&&resolvePos(ln.pos.x,expW)>=0?nx+resolvePos(ln.pos.x,expW):nx+bodyPadX;
        while(pos<txt.length){if(cy>ny+expH-8)return;let len=1;while(pos+len<=txt.length&&measureText(txt.slice(pos,pos+len),fs2,'sans-serif')<expW-16)len++;if(len===1&&pos+1<=txt.length)len=2;addBodyLine(g,svgNS,lx,cy,fill,fs2,txt.slice(pos,pos+len-1));pos+=len-1;cy+=fs2+4;}
      }else{
        if(cy>ny+expH-8)return;
        const lx2=ln.pos&&resolvePos(ln.pos.x,expW)>=0?nx+resolvePos(ln.pos.x,expW):nx+bodyPadX;
        addBodyLine(g,svgNS,lx2,cy,fill,fs2,txt);cy+=fs2+4;
      }
      if(ln.pos)cy=savedCY; // restore flow after positioned text
    }
  });
}

function addBodyLine(g,ns,x,y,fill,fs,text){const t=document.createElementNS(ns,'text');t.setAttribute('x',x);t.setAttribute('y',y);t.setAttribute('fill',fill);t.setAttribute('font-size',fs);t.setAttribute('class','node-body');t.textContent=text;g.appendChild(t);}

function buildBodyLines(v,nv){
  const lines=[];
  const tp=nv.layout?.titlePosition;
  if(v.props?.title)lines.push({t:'h',text:v.props.title,pos:tp||null});
  if(v.props){
    const propStyles=nv.properties||{};
    Object.entries(v.props).forEach(([k,val])=>{
      if(k==='title'||k==='type')return;
      const ps=propStyles[k];
      const pos=ps?.position||null;
      if(ps&&ps.style==='pill'){
        const items=Array.isArray(val)?val:[val];
        const cleaned=items.map(it=>typeof it==='string'?it.replace(/^\[\[|\]\]$/g,''):it);
        lines.push({t:'pill',items:cleaned,shape:ps.shape||'round',bg:ps.bg||'#fff2',textColor:ps.textColor||'#eee',label:k,pos});
      }else{lines.push({t:'p',text:`${k}: ${Array.isArray(val)?val.join(', '):val}`,pos,color:ps?.textColor||null});}
    });
  }
  if(v.body){lines.push({t:'hr'});v.body.split('\n').forEach(l=>{const t=l.trim();if(!t){lines.push({t:'br'});return;}if(t.startsWith('#'))lines.push({t:'h',text:t.replace(/^#+\s*/,'')});else if(t.startsWith('>'))lines.push({t:'q',text:t.slice(1).trim()});else if(t.startsWith('```')){lines.push({t:'code'});return;}else lines.push({t:'p',text:t});});}
  return lines;
}

function collapseAll(mainG){
  if(!expandedId)return;
  const g=mainG.querySelector(`g[data-id="${expandedId}"]`);if(!g)return;
  const node=currentNodes.find(n=>n.id===expandedId);if(!node)return;
  const rect=g.querySelector('.node-rect');if(rect)applyNodeView(rect,node,false);
  g.querySelectorAll('.node-title,.node-icon-img').forEach(el=>el.style.opacity='1');
  g.querySelectorAll('.node-body,.node-bg,.node-icon-ex').forEach(el=>el.remove());
  // Restore collapsed icon visibility
  currentNodes.forEach(n=>{
    if(n.id===expandedId)return;
    const g2=mainG.querySelector(`g[data-id="${n.id}"]`);if(!g2)return;
    const rect2=g2.querySelector('.node-rect');if(rect2){
      const origX=n.x||0;
      const curX=parseFloat(rect2.getAttribute('x')||0);
      const shift=origX-curX;
      rect2.setAttribute('x',origX);
      if(shift!==0){
        g2.querySelectorAll('.node-title,.node-icon-img').forEach(el=>{
          el.setAttribute('x',parseFloat(el.getAttribute('x')||0)+shift);
        });
      }
    }
  });
  expandedId=null;
}

// ═══════ NodeView → Children Conversion (Stage 5) ═══════
// Converts existing nodeview properties into new children format.

function nodeViewToChildren(nv, nodeData) {
  if (!nv.properties || typeof nv.properties !== 'object') return null;
  const hasProps = Object.keys(nv.properties).some(k => nodeData.props && k in nodeData.props);
  if (!hasProps) return null;

  const padX = 10, padY = 8, gap = 5;
  const cpX = nv.layout?.contentPadX ?? padX;
  const cpY = nv.layout?.contentPadY ?? padY;

  // Build children array from properties
  const rootLabel = nodeData.props?.title || '';
  const rootFontSize = nv.fontSize || 12;
  const root = {
    label: rootLabel,
    shape: nv.shape || 'rect',
    rx: nv.rx || 4,
    stroke: nv.stroke || '#fff6',
    strokeWidth: nv.strokeWidth ?? 0.5,
    fill: '#ffffff22',
    text: rootLabel,
    fontSize: rootFontSize,
    textColor: '#ffffffcc',
    w: null, h: null, gapY: gap,
    children: []
  };

  for (const [key, propDef] of Object.entries(nv.properties)) {
    const rawVal = nodeData.props[key];
    if (rawVal === undefined || rawVal === null) continue;

    const items = Array.isArray(rawVal)
      ? rawVal.map(v => String(v).replace(/^\[\[|\]\]$/g, ''))
      : [String(rawVal).replace(/^\[\[|\]\]$/g, '')];

    if (propDef.style === 'pill' && items.length > 0) {
      const pillY = typeof propDef.position?.y === 'string' && propDef.position.y.endsWith('%')
        ? Math.round(parseFloat(propDef.position.y))
        : (Number(propDef.position?.y) ?? 0) + cpY;
      const pillX = typeof propDef.position?.x === 'string' && propDef.position.x.endsWith('%')
        ? 'center'
        : (Number(propDef.position?.x) ?? null);

      const pill = {
        label: key,
        shape: propDef.shape === 'diamond' ? 'rect' : (propDef.shape === 'round' ? 'rect' : 'rect'),
        rx: propDef.shape === 'diamond' ? 4 : (propDef.shape === 'round' ? 10 : 3),
        fill: propDef.bg || '#fff2',
        stroke: '#0000',
        strokeWidth: 0,
        text: items[0],
        textColor: propDef.textColor || '#eee',
        fontSize: propDef.fontSize ?? 12,
        w: null, h: null,
        xRel: pillX === 'center' ? null : ('left-' + (pillX !== null ? (pillX + cpX) : 10)),
        yRel: 'top-' + Math.max(pillY, cpY)
      };

      // If no x position, center it
      if (!!propDef.position?.x === false) {
        pill.xRel = null;
      }

      root.children.push(pill);
    } else if (propDef.style === 'text') {
      const text = typeof rawVal === 'string' ? rawVal : JSON.stringify(rawVal);
      root.children.push({
        label: key,
        shape: 'rect',
        fill: '#000000',
        stroke: '#0000',
        strokeWidth: 0,
        text: text,
        textColor: propDef.textColor || '#eee',
        fontSize: propDef.fontSize ?? 12,
        w: null, h: null,
        xRel: null,
        yRel: 'top-' + (cpY + 16)
      });
    }
  }

  if (root.children.length === 0) return null;
  return root;
}

// ═══════ Children Layout Engine (integrated from test_children) ═══════

function resolvePosChild(raw, total, defaultVal) {
  if (raw === null || raw === undefined || raw === '') return defaultVal;
  if (typeof raw === 'string' && raw.endsWith('%')) return parseFloat(raw) / 100 * total;
  return parseFloat(raw);
}

/**
 * Measure element's natural size based on its content.
 */
function measureElement(el) {
  if (el._cw > 0 && el._ch > 0) return;
  const padX = 10, padY = 8;
  const gap = el.gapY || 5;

  // Both fixed dimensions
  if (el.w !== null && el.h !== null) {
    el._cw = Math.max(el.w, 20);
    el._ch = Math.max(el.h, 20);
    return;
  }

  let maxChildW = 0, totalChildH = 0, maxChildHForHeight = 0;
  if (el.children && el.children.length > 0) {
    for (const child of el.children) {
      measureElement(child);
      const cw = child._cw || 0;
      const ch = child._ch || 0;
      if (cw > maxChildW) maxChildW = cw;
      if (ch > maxChildHForHeight) maxChildHForHeight = ch;
      totalChildH += ch + gap;
    }
    if (el.children.length > 0) totalChildH -= gap;
  }

  // Text size contribution
  let textW = 0, textH = 0;
  if (el.text) {
    const fontSize = el.fontSize || 12;
    let tw = _measureText(el.text, fontSize);

    if (el.w !== null && el.h !== null) {
      textW = Math.min(tw + padX * 2, Math.max(el.w - padX * 2, 20));
    } else if (el.w !== null) {
      const availW = Math.max(el.w - padX * 2, 20);
      const lines = _wrapText(el.text, availW, fontSize);
      textW = availW;
      textH = lines.length * (fontSize + 4) + padY * 2;
    } else {
      textW = tw;
      textH = (fontSize + 4) + padY * 2;
    }
  }

  // Compute size
  const w = el.w !== null ? Math.max(el.w, 20) : Math.max(maxChildW, textW) + padX * 2;
  const h = el.h !== null ? Math.max(el.h, 20) : Math.max(maxChildHForHeight + padY * 2, textH);
  el._cw = w;
  el._ch = h;
}

/**
 * Resolve positions for children.
 */
function resolvePositions(el) {
  if (!el.children || el.children.length === 0) return;

  const padX = 10, padY = 8;

  // Measure all children
  for (const child of el.children) {
    if (child._cw <= 0 && child._ch <= 0) {
      measureElement(child);
    }
  }

  // Position inside children
  let curY = el._ay !== undefined ? el._ay + padY : padY;
  for (const child of el.children) {
    // Position X
    if (child.xRel) {
      if (child.xRel === 'center') {
        child._ax = (el._cw - (child._cw || 0)) / 2;
      } else {
        child._ax = resolvePosChild(child.xRel, el._cw, 10);
      }
    } else {
      child._ax = (el._cw - (child._cw || 0)) / 2;
    }

    // Position Y
    if (child.yRel) {
      const val = resolvePosChild(child.yRel, el._ch, undefined);
      if (val !== undefined && !isNaN(val)) {
        child._ay = el._ay !== undefined ? el._ay + val : val;
      } else {
        child._ay = curY;
        curY += (child._ch || 0) + (el.gapY || 5);
      }
    } else {
      child._ay = curY;
      curY += (child._ch || 0) + (el.gapY || 5);
    }
  }

  // Expand parent to fit children
  let maxBottom = 0;
  for (const child of el.children) {
    const cb = child._ay + (child._ch || 0);
    if (cb > maxBottom) maxBottom = cb;
  }
  if (el.w === null) {
    let maxRight = 0;
    for (const child of el.children) {
      const cr = child._ax + (child._cw || 0);
      if (cr > maxRight) maxRight = cr;
    }
    el._cw = Math.max(maxRight, el._cw) + padX * 2;
  }
  if (el.h === null) {
    el._ch = Math.max(maxBottom, 1) + padY * 2;
  }

  // Resolve sizes if wRel/hRel used
  for (const child of el.children) {
    if (child.wRel) {
      const match = /(?:child|sibling)-(.+)$/.exec(child.wRel);
      if (match && el.children) {
        const sib = findElementByLabel(match[1], el);
        if (sib) child.w = sib._cw;
      }
    }
    if (child.hRel) {
      const match = /(?:child|sibling)-(.+)$/.exec(child.hRel);
      if (match && el.children) {
        const sib = findElementByLabel(match[1], el);
        if (sib) child.h = sib._ch;
      }
    }
  }
}

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
 * Compute layout for a children tree.
 */
function computeChildrenLayout(el) {
  const MAX_ITER = 3;
  for (let iter = 0; iter < MAX_ITER; iter++) {
    measureElement(el);
    resolvePositions(el);
  }
}

/**
 * Draw a child element recursively to SVG group.
 */
function drawElement(parentEl, parentGroup, ox, oy) {
  const svgNS = 'http://www.w3.org/2000/svg';
  const px = (ox || 0) + (parentEl._ax || 0);
  const py = (oy || 0) + (parentEl._ay || 0);
  const cw = parentEl._cw || 0;
  const ch = parentEl._ch || 0;
  const padX = 10, padY = 8;

  const g = document.createElementNS(svgNS, 'g');
  g.classList.add('el-group');
  g.dataset.id = parentEl.label || parentEl.id;

  // Background image (if it's the root of a nodeView)
  if (parentEl.bgImage && cw > 0 && ch > 0) {
    const img = document.createElementNS(svgNS, 'image');
    img.setAttribute('x', px); img.setAttribute('y', py);
    img.setAttribute('width', cw); img.setAttribute('height', ch);
    img.style.pointerEvents = 'none';
    g.appendChild(img);
  }

  // Shape
  const isCircle = parentEl.shape === 'circle';
  const size = isCircle ? Math.max(cw, ch) : null;
  const rect = document.createElementNS(svgNS, 'rect');
  rect.setAttribute('x', px); rect.setAttribute('y', py);
  rect.setAttribute('width', isCircle ? size : cw); rect.setAttribute('height', isCircle ? size : ch);
  rect.setAttribute('rx', isCircle ? 999 : (parentEl.rx || 4));
  rect.setAttribute('ry', isCircle ? 999 : (parentEl.rx || 4));
  rect.setAttribute('fill', parentEl.fill || '#ffffff22');
  rect.setAttribute('stroke', parentEl.stroke || '#fff6');
  rect.setAttribute('stroke-width', parentEl.strokeWidth ?? 1.5);
  g.appendChild(rect);

  // Text
  if (parentEl.text && (parentEl.w === null || !parentEl.children)) {
    const lineHeight = (parentEl.fontSize || 12) + 4;
    const txt = document.createElementNS(svgNS, 'text');
    txt.setAttribute('x', px + padX);
    txt.setAttribute('y', py + padY + lineHeight);
    txt.setAttribute('fill', parentEl.textColor || '#ffffffcc');
    txt.setAttribute('font-size', parentEl.fontSize || 12);
    txt.textContent = parentEl.text;
    g.appendChild(txt);
  }

  // Recursively draw children
  if (parentEl.children && parentEl.children.length > 0) {
    for (const child of parentEl.children) {
      drawElement(child, g, px, py);
    }
  }

  parentGroup.appendChild(g);
}

/**
 * Render a node with children (new layout system).
 */
function renderNodeWithChildren(node, nv, mainG, svgNS) {
  computeChildrenLayout(node);
  // Update node dimensions from layout
  node.width = node._cw;
  node.height = node._ch;
  // Draw using new renderer
  drawElement(node, mainG, 0, 0);
}

function addRow(cid){const div=document.getElementById(cid);const row=document.createElement('div');row.className='filter-row';const logic=document.createElement('span');logic.className='logic';logic.textContent=div.children.length?'AND':'WHERE';const sel=document.createElement('select');sel.innerHTML='<option value="$or">$or</option>';const keys=new Set();Object.values(VAULT).forEach(v=>{if(v.props)Object.keys(v.props).forEach(k=>keys.add(k));});[...keys].sort().forEach(k=>{sel.innerHTML+=`<option value="${k}">${k}</option>`;});const inp=document.createElement('input');inp.placeholder='value or val1|val2';const del=document.createElement('button');del.textContent='x';del.style.background='#533483';del.style.padding='2px 6px';del.onclick=()=>row.remove();row.appendChild(logic);row.appendChild(sel);row.appendChild(inp);row.appendChild(del);div.appendChild(row);}
function buildFilterStr(cid){const pairs=[];document.getElementById(cid).querySelectorAll('.filter-row').forEach(r=>{const s=r.querySelector('select'),i=r.querySelector('input');if(s&&i&&i.value.trim())pairs.push(s.value+'='+i.value.trim());});return pairs.join(',');}
async function apply(){const params={filter:buildFilterStr('filter-rows'),exclude:buildFilterStr('exclude-rows'),include:document.getElementById('include-types').value||'',sortKey:document.getElementById('sort-key').value,sortDesc:document.getElementById('sort-desc').checked,prune:document.getElementById('prune-orphans').checked,baseNode:document.getElementById('base-node').value||'',depth:document.getElementById('depth').value||''};const res=await fetch(API,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(params)});const data=await res.json();currentNodes=data.nodes;currentEdges=data.edges;render();}
function reset(){document.getElementById('filter-rows').innerHTML='';document.getElementById('exclude-rows').innerHTML='';document.getElementById('sort-key').value='';document.getElementById('sort-desc').checked=false;document.getElementById('prune-orphans').checked=false;currentNodes=ALL_NODES;currentEdges=ALL_EDGES;panX=0;panY=0;zoom=1;expandedId=null;render();addRow('filter-rows');}

init();
