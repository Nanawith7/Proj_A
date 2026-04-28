// ═══════════ Preview ═══════
function update(){
  const nv=buildNV();
  document.getElementById('json-output').value=JSON.stringify(nv,null,2);
  const lp=computeLP(nv,120,80);
  const eLP=computeLP(nv,380,280);
  drawPreview('prev-collapsed',120,80,nv,lp,false);
  drawPreview('prev-expanded',380,280,nv,eLP,true);
}

function computeLP(nv,nw,nh){
  const s=nv.shape||'rect';
  const cpX=nv.layout?.contentPadX??8;
  const cpY=nv.layout?.contentPadY??8;
  const tpX=nv.layout?.titlePadX??(nv.titlePad??6);
  const tpY=nv.layout?.titlePadY??(nv.titlePad??6);
  if(s==='circle'){
    const d=Math.min(nw,nh);
    const ox=Math.floor((nw-d)/2),oy=Math.floor((nh-d)/2);
    return{contentX:ox+cpX,contentY:oy+cpY,contentW:d-2*cpX,contentH:d-2*cpY,titleAnchor:'middle',titleX:nw/2,titleY:oy+d/2+(nv.fontSize||12)/3,titlePadX:tpX,titlePadY:tpY};
  }
  const tH=nv.titleY==='top'?tpY+(nv.fontSize||12):0;
  return{contentX:cpX,contentY:tH+cpY,contentW:nw-2*cpX,contentH:nh-tH-2*cpY,titleAnchor:'start',titleX:tpX,titleY:nv.titleY==='top'?tpY+(nv.fontSize||12):nh/2+(nv.fontSize||12)/3,titlePadX:tpX,titlePadY:tpY};
}

function toPctX(v,w){return String(v).endsWith('%')?parseFloat(v)/100*w:parseInt(v)||-1;}
function toPctY(v,h){return String(v).endsWith('%')?parseFloat(v)/100*h:parseInt(v)||-1;}

function drawPreview(svgId,w,h,nv,lp,expanded){
  const svg=document.getElementById(svgId);
  svg.innerHTML='';
  svg.setAttribute('viewBox',`0 0 ${w} ${h}`);
  svg.style.width=w+'px';svg.style.height=h+'px';
  const g=document.createElementNS(SVGNS,'g');

  // Background
  if(expanded){
    if(previewBG){
      const bgImg=document.createElementNS(SVGNS,'image');
      bgImg.setAttribute('href',previewBG);bgImg.setAttribute('width',w);bgImg.setAttribute('height',h);
      bgImg.setAttribute('preserveAspectRatio','xMidYMid slice');
      bgImg.setAttribute('opacity',nv.layout?.backgroundOpacity??1);
      g.appendChild(bgImg);
    }else if(nv.background){
      const bg=document.createElementNS(SVGNS,'rect');
      bg.setAttribute('width',w);bg.setAttribute('height',h);
      bg.setAttribute('fill','#9C27B0');bg.setAttribute('opacity',(nv.layout?.backgroundOpacity??0.15));
      g.appendChild(bg);
    }
  }

  // Rect
  const rect=document.createElementNS(SVGNS,'rect');
  rect.setAttribute('width',w);rect.setAttribute('height',h);
  const rx=nv.rx||4;
  const shape=nv.shape||'rect';
  rect.setAttribute('rx',shape==='circle'?Math.min(w,h)/2:shape==='round'?18:rx);
  rect.setAttribute('ry',shape==='circle'?Math.min(w,h)/2:shape==='round'?18:rx);
  rect.setAttribute('fill','#555');
  rect.setAttribute('stroke',nv.stroke||'#fff6');
  rect.setAttribute('stroke-width',nv.strokeWidth||0.5);
  const op=expanded?(nv.layout?.expandedFillOpacity):(nv.layout?.collapsedFillOpacity);
  if(op!==undefined)rect.setAttribute('opacity',op);
  g.appendChild(rect);

  // Collapsed title
  if(!expanded){
    const fs=nv.fontSize||12;
    const txt=document.createElementNS(SVGNS,'text');
    txt.setAttribute('x',lp.titleAnchor==='middle'?lp.titleX:lp.titleX+4);
    txt.setAttribute('y',lp.titleY+fs/2);
    txt.setAttribute('fill','#fff');txt.setAttribute('font-size',fs);
    txt.setAttribute('text-anchor',lp.titleAnchor==='middle'?'middle':'start');
    txt.textContent='Title';
    g.appendChild(txt);
  }

  // Expanded: text + draggable markers (markers appended LAST for z-order)
  if(expanded){
    const bodyY=nv.layout?.bodyPosition?.y||(lp.contentY+12);
    const bodyX=nv.layout?.bodyPosition?.x||lp.contentX;
    const titleY=nv.layout?.titlePosition?.y||bodyY;
    const titleX=nv.layout?.titlePosition?.x||bodyX;

    // Title text
    const tt=document.createElementNS(SVGNS,'text');
    tt.setAttribute('x',titleX+10);tt.setAttribute('y',titleY+6);
    tt.setAttribute('fill','#e94560');tt.setAttribute('font-size','13');tt.setAttribute('font-weight','bold');
    tt.textContent='Title';g.appendChild(tt);

    // Body text
    const bt=document.createElementNS(SVGNS,'text');
    bt.setAttribute('x',bodyX+10);bt.setAttribute('y',bodyY+6);
    bt.setAttribute('fill','#aaa');bt.setAttribute('font-size','9');
    bt.textContent='Body text ...';g.appendChild(bt);

    // Property texts
    propRows.forEach((pr,i)=>{
      if(!pr.key||!pr.px||!pr.py)return;
      const x=toPctX(pr.px,w),y=toPctY(pr.py,h);
      if(x<0||y<0)return;
      const txt=document.createElementNS(SVGNS,'text');
      txt.setAttribute('x',x+10);txt.setAttribute('y',y+6);
      txt.setAttribute('fill','#fff');txt.setAttribute('font-size','9');
      txt.textContent=pr.key;g.appendChild(txt);
    });

    // --- Drag markers (on top, with data attributes) ---

    // Title marker
    addMarker(g,titleX,titleY,'#e94560','title',-1);
    // Body marker
    addMarker(g,bodyX,bodyY,'#4CAF50','body',-1);
    // Property markers
    propRows.forEach((pr,i)=>{
      if(!pr.key||!pr.px||!pr.py)return;
      const x=toPctX(pr.px,w),y=toPctY(pr.py,h);
      if(x<0||y<0)return;
      addMarker(g,x,y,'#2196F3','prop',i);
    });
  }

  svg.appendChild(g);
  svg.onmousedown=handleMarkerDown;
}

function addMarker(g,x,y,color,mode,idx){
  const m=document.createElementNS(SVGNS,'rect');
  m.setAttribute('x',x-5);m.setAttribute('y',y-5);
  m.setAttribute('width',10);m.setAttribute('height',10);
  m.setAttribute('fill',color);m.setAttribute('rx','2');
  m.setAttribute('cursor','grab');
  m.setAttribute('data-mode',mode);
  m.setAttribute('data-idx',idx);
  g.appendChild(m);
}

function handleMarkerDown(e){
  const t=e.target;
  const mode=t.getAttribute('data-mode');
  const idx=t.getAttribute('data-idx');
  if(!mode)return;
  e.stopPropagation();e.preventDefault();
  dragMode=mode;dragIdx=idx;
}

window.addEventListener('mousemove',e=>{
  if(!dragMode||dragIdx===null||dragIdx===undefined)return;
  const svg=document.getElementById('prev-expanded');
  if(!svg||!svg.viewBox)return;
  const vb=svg.viewBox.baseVal;
  const r=svg.getBoundingClientRect();
  const sx=vb.width/r.width, sy=vb.height/r.height;
  const pctX=Math.max(0,Math.min(100,(e.clientX-r.left)*sx/vb.width*100)).toFixed(1);
  const pctY=Math.max(0,Math.min(100,(e.clientY-r.top)*sy/vb.height*100)).toFixed(1);
  if(dragMode==='title'){
    setVal('nv-tdx',pctX+'%');setVal('nv-tdy',pctY+'%');
  }else if(dragMode==='body'){
    setVal('nv-bdx',pctX+'%');setVal('nv-bdy',pctY+'%');
  }else if(dragMode==='prop'){
    const i=parseInt(dragIdx);
    if(i>=0&&i<propRows.length){
      propRows[i].px=pctX+'%';propRows[i].py=pctY+'%';
      renderProps();
    }
  }
  document.getElementById('json-output').value=JSON.stringify(buildNV(),null,2);
});

window.addEventListener('mouseup',()=>{
  if(dragMode){update();}
  dragMode='';dragIdx=null;
});
