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
// Fills missing layout params with defaults from nv shape
function layoutParams(nv, nw, nh) {
  const s=nv.shape||'rect';
  if(s==='circle'){
    const d=Math.min(nw,nh);
    const ox=Math.floor((nw-d)/2), oy=Math.floor((nh-d)/2);
    return {
      contentX: ox + (nv.layout?.contentPadX ?? 8),
      contentY: oy + (nv.layout?.contentPadY ?? 8),
      contentW: d - 2*(nv.layout?.contentPadX ?? 8),
      contentH: d - 2*(nv.layout?.contentPadY ?? 8),
      titleAnchor: 'middle',
      titleVAlign: 'center',
      titleX: nw/2,
      titleY: oy + d/2 + (nv.fontSize||12)/3,
      titlePadX: nv.layout?.titlePadX ?? (nv.titlePad ?? 6),
      titlePadY: nv.layout?.titlePadY ?? (nv.titlePad ?? 6),
      titleWrap: nv.titleWrap ?? false,
    };
  }
  // rect / round
  return {
    contentX: nv.layout?.contentPadX ?? 8,
    contentY: nv.layout?.contentPadY ?? (nv.titleY==='top' ? (nv.titlePad||6)+14 : 8),
    contentW: nw - 2*(nv.layout?.contentPadX ?? 8),
    contentH: nh - 2*(nv.layout?.contentPadY ?? (nv.titleY==='top' ? (nv.titlePad||6)+14 : 8)),
    titleAnchor: 'start',
    titleVAlign: nv.titleY || 'center',
    titleX: nv.layout?.titlePadX ?? Math.max(nv.titlePad||6, 6),
    titleY: nv.titleY==='top' ? (nv.titlePad||6)+(nv.fontSize||12) : nh/2+(nv.fontSize||12)/3,
    titlePadX: nv.layout?.titlePadX ?? Math.max(nv.titlePad||6, 6),
    titlePadY: nv.layout?.titlePadY ?? (nv.titlePad||6),
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
    const g=document.createElementNS(svgNS,'g');g.setAttribute('data-id',n.id);
    const rect=document.createElementNS(svgNS,'rect');
    rect.setAttribute('data-id',n.id);rect.setAttribute('class','node-rect');rect.style.cursor='pointer';
    rect.onclick=e=>{e.stopPropagation();toggleExpand(n,g,mainG);};
    applyNodeView(rect,n,false);
    g.appendChild(rect);

    const lp=layoutParams(nv,nw,nh);
    const fs=Math.max(9,Math.min(14,nv.fontSize||12));
    const tText=truncateTitle(title,fs,lp);

    if(lp.titleWrap){
      drawWrappedTitle(g,svgNS,title,fs,lp,nx,ny,nv);
    }else{
      const txt=document.createElementNS(svgNS,'text');txt.setAttribute('class','node-title');
      txt.setAttribute('font-size',fs);if(nv.boldTitle)txt.setAttribute('font-weight','bold');
      txt.setAttribute('text-anchor',lp.titleAnchor);
      txt.setAttribute('x',nx+(lp.titleAnchor==='middle'?lp.titleX:lp.titleX));
      txt.setAttribute('y',ny+lp.titleY);
      txt.setAttribute('fill','#fff');
      txt.textContent=tText||title;
      g.appendChild(txt);
    }
    mainG.appendChild(g);
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
  const maxH=lp.contentH, startY=ny+lp.contentY+fs;
  let pos=0,line=0;
  while(pos<title.length && (line+1)*(fs+2)<=maxH){
    let len=1;
    while(pos+len<=title.length&&measureText(title.slice(pos,pos+len),fs,'sans-serif')<lp.contentW)len++;
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
  const rx=nv.rx||4;
  rect.setAttribute('rx',nv.shape==='circle'?Math.min(nw,nh)/2:nv.shape==='round'?18:rx);
  rect.setAttribute('ry',nv.shape==='circle'?Math.min(nw,nh)/2:nv.shape==='round'?18:rx);
  rect.setAttribute('fill',node.color||td.color||'#555');
  rect.setAttribute('stroke',nv.stroke||'#fff6');
  rect.setAttribute('stroke-width',nv.strokeWidth||.5);
}

function updateTransform(g){g.setAttribute('transform',`translate(${panX},${panY}) scale(${zoom})`);}
function updateZoomInfo(){let el=document.getElementById('zoom-info');if(!el){el=document.createElement('div');el.id='zoom-info';document.getElementById('graph').appendChild(el);}el.textContent=`${Math.round(zoom*100)}%`;}

// ═══════ EXPAND ═══════
function toggleExpand(node, g, mainG) {
  const nid=node.id,mode=document.getElementById('expand-mode')?.value||'wrap';
  if(expandedId&&expandedId!==nid)collapseAll(mainG);
  if(expandedId===nid){collapseAll(mainG);expandedId=null;return;}
  expandedId=nid;

  g.querySelectorAll('.node-title').forEach(el=>el.style.opacity='0');
  const stem=nodeStem(node),v=VAULT[stem];if(!v)return;
  const type=nodeType(node),td=TYPEDEFS[type]||{},nv=NODEVIEWS[td.nodeview||'plain']||{shape:'rect',rx:4};
  const lines=buildBodyLines(v,nv);
  const bodyPadX=nv.layout?.contentPadX ?? 8;
  const bodyPadY=nv.layout?.contentPadY ?? 14;

  let expW=420,expH=340,fontSize=10;
  const minH=bodyPadY+12+60;
  if(mode==='stretch'){
    let maxW=0,lineCount=0;
    lines.forEach(l=>{if(l.t==='br'){lineCount++;return;} if(l.t==='hr'||l.t==='code')return; const fs=l.t==='h'?14:10; if(l.text){const w=measureText(l.text,fs,'sans-serif');if(w>maxW)maxW=w;lineCount++;}});
    expW=Math.max(420,maxW+bodyPadX*2+16);
    expH=Math.max(minH,lineCount*16+bodyPadY+20);
  }

  const rect=g.querySelector('.node-rect');
  applyNodeView(rect,node,{width:expW,height:expH});

  const nx=node.x||0,ny=node.y||0;
  currentNodes.forEach(n=>{
    if(n.id===nid)return;
    const g2=mainG.querySelector(`g[data-id="${n.id}"]`);if(!g2)return;
    const rect2=g2.querySelector('.node-rect');if(!rect2)return;
    const ox=n.x||0,oy=n.y||0,ow=n.width||200,oh=n.height||120;
    if(nx+expW>ox&&nx<ox+ow&&ny+expH>oy&&ny<oy+oh){
      const shift=Math.max(0,(nx+expW)-ox+20);
      rect2.setAttribute('x',ox+shift);
    }
  });

  g.querySelectorAll('.node-body').forEach(el=>el.remove());
  const svgNS='http://www.w3.org/2000/svg';
  let cy=ny+bodyPadY+12;
  lines.forEach(ln=>{
    if(ln.t==='br'){cy+=10;return;} if(ln.t==='hr'){cy+=4;return;} if(ln.t==='code')return;
    if(ln.t==='pill'){
      const fs=9,padX=6,padY=3; let bx=nx+bodyPadX;
      ln.items.forEach(item=>{
        const tw=measureText(item,fs,'sans-serif')+padX*2;
        if(bx+tw>nx+expW-8){bx=nx+bodyPadX;cy+=fs+padY*2+4;}
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
      cy+=fs+padY*2+6;return;
    }
    let fs=ln.t==='h'?14:10,fill=ln.t==='h'?'#e94560':ln.t==='q'?'#aaa':'#ddd';
    if(ln.text){
      let txt=ln.text;
      if(mode==='wrap'){
        let pos=0;
        while(pos<txt.length){if(cy>ny+expH-8)return;let len=1;while(pos+len<=txt.length&&measureText(txt.slice(pos,pos+len),fs,'sans-serif')<expW-16)len++;if(len===1&&pos+1<=txt.length)len=2;addBodyLine(g,svgNS,nx+bodyPadX,cy,fill,fs,txt.slice(pos,pos+len-1));pos+=len-1;cy+=fs+4;}
      }else{if(cy>ny+expH-8)return;addBodyLine(g,svgNS,nx+bodyPadX,cy,fill,fs,txt);cy+=fs+4;}
    }
  });
}

function addBodyLine(g,ns,x,y,fill,fs,text){const t=document.createElementNS(ns,'text');t.setAttribute('x',x);t.setAttribute('y',y);t.setAttribute('fill',fill);t.setAttribute('font-size',fs);t.setAttribute('class','node-body');t.textContent=text;g.appendChild(t);}

function buildBodyLines(v,nv){
  const lines=[];
  if(v.props?.title)lines.push({t:'h',text:v.props.title});
  if(v.props){
    const propStyles=nv.properties||{};
    Object.entries(v.props).forEach(([k,val])=>{
      if(k==='title'||k==='type')return;
      const ps=propStyles[k];
      if(ps&&ps.style==='pill'){
        const items=Array.isArray(val)?val:[val];
        const cleaned=items.map(it=>typeof it==='string'?it.replace(/^\[\[|\]\]$/g,''):it);
        lines.push({t:'pill',items:cleaned,shape:ps.shape||'round',bg:ps.bg||'#fff2',textColor:ps.textColor||'#eee',label:k});
      }else{lines.push({t:'p',text:`${k}: ${Array.isArray(val)?val.join(', '):val}`});}
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
  g.querySelectorAll('.node-title').forEach(el=>el.style.opacity='1');
  g.querySelectorAll('.node-body').forEach(el=>el.remove());
  currentNodes.forEach(n=>{
    if(n.id===expandedId)return;
    const g2=mainG.querySelector(`g[data-id="${n.id}"]`);if(!g2)return;
    const rect2=g2.querySelector('.node-rect');if(rect2)rect2.setAttribute('x',n.x||0);
  });
  expandedId=null;
}

// ═══════ GUI ═══════
function addRow(cid){const div=document.getElementById(cid);const row=document.createElement('div');row.className='filter-row';const logic=document.createElement('span');logic.className='logic';logic.textContent=div.children.length?'AND':'WHERE';const sel=document.createElement('select');sel.innerHTML='<option value="$or">$or</option>';const keys=new Set();Object.values(VAULT).forEach(v=>{if(v.props)Object.keys(v.props).forEach(k=>keys.add(k));});[...keys].sort().forEach(k=>{sel.innerHTML+=`<option value="${k}">${k}</option>`;});const inp=document.createElement('input');inp.placeholder='value or val1|val2';const del=document.createElement('button');del.textContent='x';del.style.background='#533483';del.style.padding='2px 6px';del.onclick=()=>row.remove();row.appendChild(logic);row.appendChild(sel);row.appendChild(inp);row.appendChild(del);div.appendChild(row);}
function buildFilterStr(cid){const pairs=[];document.getElementById(cid).querySelectorAll('.filter-row').forEach(r=>{const s=r.querySelector('select'),i=r.querySelector('input');if(s&&i&&i.value.trim())pairs.push(s.value+'='+i.value.trim());});return pairs.join(',');}
async function apply(){const params={filter:buildFilterStr('filter-rows'),exclude:buildFilterStr('exclude-rows'),sortKey:document.getElementById('sort-key').value,sortDesc:document.getElementById('sort-desc').checked,prune:document.getElementById('prune-orphans').checked};const res=await fetch(API,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(params)});const data=await res.json();currentNodes=data.nodes;currentEdges=data.edges;render();}
function reset(){document.getElementById('filter-rows').innerHTML='';document.getElementById('exclude-rows').innerHTML='';document.getElementById('sort-key').value='';document.getElementById('sort-desc').checked=false;document.getElementById('prune-orphans').checked=false;currentNodes=ALL_NODES;currentEdges=ALL_EDGES;panX=0;panY=0;zoom=1;expandedId=null;render();addRow('filter-rows');}

init();
