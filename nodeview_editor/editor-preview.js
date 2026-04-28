// ═══════════ Nodeview Editor - Preview (SVG + drag) ═══════════
let previewBG=null;
let dragMode='', dragIdx=null;
const SVGNS='http://www.w3.org/2000/svg';

function computeLP(nv,nw,nh){
  const s=nv.shape||'rect',cpX=nv.layout?.contentPadX??8,cpY=nv.layout?.contentPadY??8;
  const tpX=nv.layout?.titlePadX??(nv.titlePad??6),tpY=nv.layout?.titlePadY??(nv.titlePad??6);
  if(s==='circle'){const d=Math.min(nw,nh),ox=Math.floor((nw-d)/2),oy=Math.floor((nh-d)/2);return{contentX:ox+cpX,contentY:oy+cpY,contentW:d-2*cpX,contentH:d-2*cpY,titleAnchor:'middle',titleX:nw/2,titleY:oy+d/2+(nv.fontSize||12)/3};}
  const tH=nv.titleY==='top'?tpY+(nv.fontSize||12):0;return{contentX:cpX,contentY:tH+cpY,contentW:nw-2*cpX,contentH:nh-tH-2*cpY,titleAnchor:'start',titleX:tpX,titleY:nv.titleY==='top'?tpY+(nv.fontSize||12):nh/2+(nv.fontSize||12)/3};
}
function toPctX(v,w){return String(v).endsWith('%')?parseFloat(v)/100*w:parseInt(v)||-1;}
function toPctY(v,h){return String(v).endsWith('%')?parseFloat(v)/100*h:parseInt(v)||-1;}

function updatePreview(){
  const nv=buildNV();
  document.getElementById('json-output').value=JSON.stringify(nv,null,2);
  const lp=computeLP(nv,120,80);
  const ew=nv.layout?.expandMinW||300, eh=nv.layout?.expandMinH||200;
  drawPreview('prev-collapsed',120,80,nv,lp,false);
  drawPreview('prev-expanded',ew,eh,nv,computeLP(nv,ew,eh),true);
}

function drawPreview(svgId,w,h,nv,lp,expanded){
  const svg=document.getElementById(svgId);svg.innerHTML='';
  svg.setAttribute('viewBox',`0 0 ${w} ${h}`);svg.style.width=w+'px';svg.style.height=h+'px';
  const g=document.createElementNS(SVGNS,'g');
  if(expanded&&previewBG){const b=document.createElementNS(SVGNS,'image');b.setAttribute('href',previewBG);b.setAttribute('width',w);b.setAttribute('height',h);b.setAttribute('preserveAspectRatio','xMidYMid slice');b.setAttribute('opacity',nv.layout?.backgroundOpacity??1);g.appendChild(b);}
  else if(expanded&&nv.background){const b=document.createElementNS(SVGNS,'rect');b.setAttribute('width',w);b.setAttribute('height',h);b.setAttribute('fill','#9C27B0');b.setAttribute('opacity',(nv.layout?.backgroundOpacity??0.15));g.appendChild(b);}
  const rect=document.createElementNS(SVGNS,'rect');rect.setAttribute('width',w);rect.setAttribute('height',h);
  const rx=nv.rx||4,shape=nv.shape||'rect';rect.setAttribute('rx',shape==='circle'?Math.min(w,h)/2:shape==='round'?18:rx);rect.setAttribute('ry',shape==='circle'?Math.min(w,h)/2:shape==='round'?18:rx);
  rect.setAttribute('fill','#555');rect.setAttribute('stroke',nv.stroke||'#fff6');rect.setAttribute('stroke-width',nv.strokeWidth||0.5);
  const op=expanded?(nv.layout?.expandedFillOpacity):(nv.layout?.collapsedFillOpacity);if(op!==undefined)rect.setAttribute('opacity',op);g.appendChild(rect);
  if(!expanded){const fs=nv.fontSize||12,txt=document.createElementNS(SVGNS,'text');txt.setAttribute('x',lp.titleAnchor==='middle'?lp.titleX:lp.titleX+4);txt.setAttribute('y',lp.titleY+fs/2);txt.setAttribute('fill','#fff');txt.setAttribute('font-size',fs);txt.setAttribute('text-anchor',lp.titleAnchor==='middle'?'middle':'start');txt.textContent='Title';g.appendChild(txt);}
  if(expanded){
    const by0=_bodyPos.y||nv.layout?.bodyPosition?.y||(lp.contentY+12);
    const bx0=_bodyPos.x||nv.layout?.bodyPosition?.x||lp.contentX;
    const ty0=_titlePos.y||nv.layout?.titlePosition?.y||(lp.contentY+12);
    const tx0=_titlePos.x||nv.layout?.titlePosition?.x||lp.contentX;
    const by=toPctY(by0,h),bx=toPctX(bx0,w),ty=toPctY(ty0,h),tx=toPctX(tx0,w);
    const tc=nv.layout?.titleColor||'#e94560';
    const bc=nv.layout?.bodyColor||'#ddd';
    const t1=document.createElementNS(SVGNS,'text');t1.setAttribute('x',tx+10);t1.setAttribute('y',ty+6);t1.setAttribute('fill',tc);t1.setAttribute('font-size','13');t1.setAttribute('font-weight','bold');t1.textContent='Title';g.appendChild(t1);
    const t2=document.createElementNS(SVGNS,'text');t2.setAttribute('x',bx+10);t2.setAttribute('y',by+6);t2.setAttribute('fill',bc);t2.setAttribute('font-size','9');t2.textContent='Body text ...';g.appendChild(t2);
    propRows.forEach((pr,i)=>{if(!pr.key||!pr.px||!pr.py)return;const x=toPctX(pr.px,w),y=toPctY(pr.py,h);if(x<0||y<0)return;const tc=pr.textColor||'#fff';const t=document.createElementNS(SVGNS,'text');t.setAttribute('x',x+10);t.setAttribute('y',y+6);t.setAttribute('fill',tc);t.setAttribute('font-size','9');t.textContent=pr.key;g.appendChild(t);});
    addMarker(g,tx,ty,'#e94560','title');addMarker(g,bx,by,'#4CAF50','body');
    propRows.forEach((pr,i)=>{if(!pr.key||!pr.px||!pr.py)return;const x=toPctX(pr.px,w),y=toPctY(pr.py,h);if(x<0||y<0)return;addMarker(g,x,y,'#2196F3','prop',i);});
  }
  svg.appendChild(g);svg.onmousedown=handleMarkerDown;
}
function addMarker(g,x,y,color,mode,idx){
  const m=document.createElementNS(SVGNS,'rect');m.setAttribute('x',x-5);m.setAttribute('y',y-5);
  m.setAttribute('width',10);m.setAttribute('height',10);m.setAttribute('fill',color);m.setAttribute('rx','2');
  m.setAttribute('cursor','grab');m.setAttribute('data-mode',mode);m.setAttribute('data-idx',idx??-1);g.appendChild(m);
}
function handleMarkerDown(e){
  const t=e.target,mode=t.getAttribute('data-mode'),idx=t.getAttribute('data-idx');
  if(!mode)return;e.stopPropagation();e.preventDefault();dragMode=mode;dragIdx=idx;
}
window.addEventListener('mousemove',e=>{
  if(!dragMode||dragIdx===null||dragIdx===undefined)return;
  const svg=document.getElementById('prev-expanded');if(!svg||!svg.viewBox)return;
  const vb=svg.viewBox.baseVal,r=svg.getBoundingClientRect(),sx=vb.width/r.width,sy=vb.height/r.height;
  const pX=Math.max(0,Math.min(100,(e.clientX-r.left)*sx/vb.width*100)).toFixed(1);
  const pY=Math.max(0,Math.min(100,(e.clientY-r.top)*sy/vb.height*100)).toFixed(1);
  if(dragMode==='title'){
    _titlePos.x=pX+'%';_titlePos.y=pY+'%';
    document.getElementById('nv-tdx').value=_titlePos.x;
    document.getElementById('nv-tdy').value=_titlePos.y;
  }else if(dragMode==='body'){
    _bodyPos.x=pX+'%';_bodyPos.y=pY+'%';
    document.getElementById('nv-bdx').value=_bodyPos.x;
    document.getElementById('nv-bdy').value=_bodyPos.y;
  }else if(dragMode==='prop'){const i=parseInt(dragIdx);if(i>=0&&i<propRows.length){propRows[i].px=pX+'%';propRows[i].py=pY+'%';renderProps();}}
  document.getElementById('json-output').value=JSON.stringify(buildNV(),null,2);
});
window.addEventListener('mouseup',()=>{if(dragMode)updatePreview();dragMode='';dragIdx=null;});

function loadBGFile(input){const f=input.files[0];if(!f)return;const r=new FileReader();r.onload=()=>{previewBG=r.result;updatePreview();};r.readAsDataURL(f);}
function loadBGURL(url){if(!url){previewBG=null;updatePreview();return;}const img=new Image();img.crossOrigin='anonymous';img.onload=()=>{const c=document.createElement('canvas');c.width=img.width;c.height=img.height;c.getContext('2d').drawImage(img,0,0);previewBG=c.toDataURL();updatePreview();};img.onerror=()=>{previewBG=null;updatePreview();};img.src=url;}
