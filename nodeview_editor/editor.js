// ═══════════ Nodeview Editor ═══════════
let templates={}, currentName='', propRows=[], previewBG=null;
let dragMode='', dragIdx=null;
const SVGNS='http://www.w3.org/2000/svg';

async function init(){
  try{const r=await fetch('/api/templates');templates=await r.json();}
  catch(e){templates={character:{shape:'rect',rx:4,nodeview:'character_card'}};}
  renderTemplateList();
  if(Object.keys(templates).length)loadTemplate(Object.keys(templates)[0]);
}
function renderTemplateList(){
  const div=document.getElementById('template-list');div.innerHTML='';
  Object.entries(templates).forEach(([name,td])=>{
    const btn=document.createElement('button');
    btn.textContent=`${name} (${td.nodeview||'none'})`;
    btn.onclick=()=>loadTemplate(name);
    if(name===currentName)btn.classList.add('active');
    div.appendChild(btn);
  });
}
async function loadTemplate(name){
  currentName=name; const td=templates[name]||{}; const nvName=td.nodeview||'plain'; let nv={};
  try{const r=await fetch(`/api/nodeview/${nvName}.json`);nv=await r.json();}
  catch(e){nv={shape:'rect',rx:4};}
  applyToForm(nv); renderTemplateList(); update();
}
function newTemplate(){currentName='untitled'; applyToForm({shape:'rect',rx:4}); renderTemplateList(); update();}
function importJSON(){const raw=prompt('Paste nodeview JSON:');if(!raw)return;try{applyToForm(JSON.parse(raw));update();}catch(e){alert('Invalid JSON');}}

function applyToForm(nv){
  const l=nv.layout||{};
  setVal('nv-shape',nv.shape||'rect');setVal('nv-rx',nv.rx||4);setVal('nv-sw',nv.strokeWidth||1);
  setVal('nv-stroke',nv.stroke||'#fff6');setVal('nv-fs',nv.fontSize||12);setVal('nv-ty',nv.titleY||'center');
  setVal('nv-tw',nv.titleWrap||false);setVal('nv-tpx',l.titlePadX??10);setVal('nv-tpy',l.titlePadY??10);
  setVal('nv-cfop',l.collapsedFillOpacity??1);setVal('nv-efop',l.expandedFillOpacity??1);
  setVal('nv-bgop',l.backgroundOpacity??0.15);setVal('nv-bg',nv.background||'');
  setVal('nv-ew',l.expandMinW??300);setVal('nv-eh',l.expandMinH??200);
  setVal('nv-cpx',l.contentPadX??10);setVal('nv-cpy',l.contentPadY??10);
  setVal('nv-bdx',l.bodyPosition?.x??'');setVal('nv-bdy',l.bodyPosition?.y??'');
  setVal('nv-tdx',l.titlePosition?.x??'');setVal('nv-tdy',l.titlePosition?.y??'');
  setVal('nv-iax',l.iconAnchorX||'center');setVal('nv-iay',l.iconAnchorY||'center');
  setVal('nv-ipx',l.iconPadX??0);setVal('nv-ipy',l.iconPadY??0);
  setVal('nv-eiax',l.expandedIconAnchorX||'');setVal('nv-eiay',l.expandedIconAnchorY||'');
  setVal('nv-eipx',l.expandedIconPadX??'');setVal('nv-eipy',l.expandedIconPadY??'');
  setVal('nv-eisz',l.expandedIconSize??'');
  propRows=[]; const props=nv.properties||{};
  Object.entries(props).forEach(([k,v])=>{
    propRows.push({key:k,style:v.style||'text',shape:v.shape||'round',bg:v.bg||'#fff2',textColor:v.textColor||'#eee',px:v.position?.x||'',py:v.position?.y||''});
  });
  renderProps();
}
function setVal(id,val){const el=document.getElementById(id);if(!el)return;if(el.type==='checkbox')el.checked=val;else el.value=val??'';}
function getVal(id){return document.getElementById(id)?.value||'';}
function getNum(id){return parseFloat(document.getElementById(id)?.value)||0;}

function renderProps(){
  const div=document.getElementById('props-editor');div.innerHTML='';
  propRows.forEach((pr,i)=>{
    const row=document.createElement('div');row.className='prop-row';const isPill=pr.style==='pill';
    let extraHTML='';
    if(isPill)extraHTML=`<select onchange="propRows[${i}].shape=this.value;update()" style="width:60px"><option ${pr.shape==='round'?'selected':''}>round</option><option ${pr.shape==='diamond'?'selected':''}>diamond</option><option ${pr.shape==='rect'?'selected':''}>rect</option></select><input value="${pr.bg}" placeholder="bg" style="width:60px" oninput="propRows[${i}].bg=this.value;update()"><input value="${pr.textColor}" placeholder="fg" style="width:60px" oninput="propRows[${i}].textColor=this.value;update()">`;
    row.innerHTML=`<span>${i+1}</span><input value="${pr.key}" placeholder="key" oninput="propRows[${i}].key=this.value;update()"><select onchange="propRows[${i}].style=this.value;renderProps();update()"><option ${pr.style==='pill'?'selected':''}>pill</option><option ${pr.style==='text'?'selected':''}>text</option></select>${extraHTML}<input value="${pr.px}" placeholder="x" style="width:40px" oninput="propRows[${i}].px=this.value;update()"><input value="${pr.py}" placeholder="y" style="width:40px" oninput="propRows[${i}].py=this.value;update()"><button onclick="propRows.splice(${i},1);renderProps();update()" style="background:#533483;padding:2px 6px;font-size:10px">x</button>`;
    div.appendChild(row);
  });
}
function addProp(){propRows.push({key:'newKey',style:'text',shape:'round',bg:'#fff2',textColor:'#eee',px:'',py:''});renderProps();update();}

function buildNV(){
  const props={};
  propRows.forEach(pr=>{const p={};if(pr.style==='pill'){p.style='pill';p.shape=pr.shape;p.bg=pr.bg;p.textColor=pr.textColor;}if(pr.px||pr.py){p.position={};if(pr.px)p.position.x=pr.px;if(pr.py)p.position.y=pr.py;}if(Object.keys(p).length)props[pr.key]=p;});
  const layout={};
  if(getNum('nv-tpx')!==10)layout.titlePadX=getNum('nv-tpx');if(getNum('nv-tpy')!==10)layout.titlePadY=getNum('nv-tpy');
  if(getNum('nv-cfop')!==1)layout.collapsedFillOpacity=getNum('nv-cfop');if(getNum('nv-efop')!==1)layout.expandedFillOpacity=getNum('nv-efop');
  if(getNum('nv-bgop')!==0.15)layout.backgroundOpacity=getNum('nv-bgop');
  if(getNum('nv-ew')!==300)layout.expandMinW=getNum('nv-ew');if(getNum('nv-eh')!==200)layout.expandMinH=getNum('nv-eh');
  if(getNum('nv-cpx')!==10)layout.contentPadX=getNum('nv-cpx');if(getNum('nv-cpy')!==10)layout.contentPadY=getNum('nv-cpy');
  const bdx=getNum('nv-bdx'),bdy=getNum('nv-bdy'),tdx=getNum('nv-tdx'),tdy=getNum('nv-tdy');
  if(bdx||bdy){layout.bodyPosition={};if(bdx)layout.bodyPosition.x=bdx;if(bdy)layout.bodyPosition.y=bdy;}
  if(tdx||tdy){layout.titlePosition={};if(tdx)layout.titlePosition.x=tdx;if(tdy)layout.titlePosition.y=tdy;}
  if(getVal('nv-iax')!=='center')layout.iconAnchorX=getVal('nv-iax');if(getVal('nv-iay')!=='center')layout.iconAnchorY=getVal('nv-iay');
  if(getNum('nv-ipx'))layout.iconPadX=getNum('nv-ipx');if(getNum('nv-ipy'))layout.iconPadY=getNum('nv-ipy');
  if(getVal('nv-eiax'))layout.expandedIconAnchorX=getVal('nv-eiax');if(getVal('nv-eiay'))layout.expandedIconAnchorY=getVal('nv-eiay');
  if(getVal('nv-eipx')!=='')layout.expandedIconPadX=getNum('nv-eipx');if(getVal('nv-eipy')!=='')layout.expandedIconPadY=getNum('nv-eipy');
  if(getVal('nv-eisz')!=='')layout.expandedIconSize=getNum('nv-eisz');
  const nv={shape:getVal('nv-shape'),rx:getNum('nv-rx')};
  if(getNum('nv-sw')!==0.5)nv.strokeWidth=getNum('nv-sw');if(getVal('nv-stroke')!=='#fff6')nv.stroke=getVal('nv-stroke');
  if(getNum('nv-fs')!==12)nv.fontSize=getNum('nv-fs');if(getVal('nv-ty')!=='center')nv.titleY=getVal('nv-ty');
  if(getVal('nv-tw')==='true')nv.titleWrap=true;if(getVal('nv-bg'))nv.background=getVal('nv-bg');
  if(Object.keys(props).length)nv.properties=props;if(Object.keys(layout).length)nv.layout=layout;
  return nv;
}

// ═══════ Preview ═══════
function update(){
  const nv=buildNV();
  document.getElementById('json-output').value=JSON.stringify(nv,null,2);
  const lp=computeLP(nv,120,80),eLP=computeLP(nv,380,280);
  drawPreview('prev-collapsed',120,80,nv,lp,false);
  drawPreview('prev-expanded',380,280,nv,eLP,true);
}
function computeLP(nv,nw,nh){
  const s=nv.shape||'rect',cpX=nv.layout?.contentPadX??8,cpY=nv.layout?.contentPadY??8;
  const tpX=nv.layout?.titlePadX??(nv.titlePad??6),tpY=nv.layout?.titlePadY??(nv.titlePad??6);
  if(s==='circle'){const d=Math.min(nw,nh),ox=Math.floor((nw-d)/2),oy=Math.floor((nh-d)/2);return{contentX:ox+cpX,contentY:oy+cpY,contentW:d-2*cpX,contentH:d-2*cpY,titleAnchor:'middle',titleX:nw/2,titleY:oy+d/2+(nv.fontSize||12)/3,titlePadX:tpX,titlePadY:tpY};}
  const tH=nv.titleY==='top'?tpY+(nv.fontSize||12):0;return{contentX:cpX,contentY:tH+cpY,contentW:nw-2*cpX,contentH:nh-tH-2*cpY,titleAnchor:'start',titleX:tpX,titleY:nv.titleY==='top'?tpY+(nv.fontSize||12):nh/2+(nv.fontSize||12)/3,titlePadX:tpX,titlePadY:tpY};
}
function toPctX(v,w){return String(v).endsWith('%')?parseFloat(v)/100*w:parseInt(v)||-1;}
function toPctY(v,h){return String(v).endsWith('%')?parseFloat(v)/100*h:parseInt(v)||-1;}

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
    const by=nv.layout?.bodyPosition?.y||(lp.contentY+12),bx=nv.layout?.bodyPosition?.x||lp.contentX;
    const ty=nv.layout?.titlePosition?.y||by,tx=nv.layout?.titlePosition?.x||bx;
    const t1=document.createElementNS(SVGNS,'text');t1.setAttribute('x',tx+10);t1.setAttribute('y',ty+6);t1.setAttribute('fill','#e94560');t1.setAttribute('font-size','13');t1.setAttribute('font-weight','bold');t1.textContent='Title';g.appendChild(t1);
    const t2=document.createElementNS(SVGNS,'text');t2.setAttribute('x',bx+10);t2.setAttribute('y',by+6);t2.setAttribute('fill','#aaa');t2.setAttribute('font-size','9');t2.textContent='Body text ...';g.appendChild(t2);
    propRows.forEach((pr,i)=>{if(!pr.key||!pr.px||!pr.py)return;const x=toPctX(pr.px,w),y=toPctY(pr.py,h);if(x<0||y<0)return;const t=document.createElementNS(SVGNS,'text');t.setAttribute('x',x+10);t.setAttribute('y',y+6);t.setAttribute('fill','#fff');t.setAttribute('font-size','9');t.textContent=pr.key;g.appendChild(t);});
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
  if(dragMode==='title'){setVal('nv-tdx',pX+'%');setVal('nv-tdy',pY+'%');}
  else if(dragMode==='body'){setVal('nv-bdx',pX+'%');setVal('nv-bdy',pY+'%');}
  else if(dragMode==='prop'){const i=parseInt(dragIdx);if(i>=0&&i<propRows.length){propRows[i].px=pX+'%';propRows[i].py=pY+'%';renderProps();}}
  document.getElementById('json-output').value=JSON.stringify(buildNV(),null,2);
});
window.addEventListener('mouseup',()=>{if(dragMode)update();dragMode='';dragIdx=null;});

// ═══════ BG ═══════
function loadBGFile(input){const f=input.files[0];if(!f)return;const r=new FileReader();r.onload=()=>{previewBG=r.result;update();};r.readAsDataURL(f);}
function loadBGURL(url){if(!url){previewBG=null;update();return;}const img=new Image();img.crossOrigin='anonymous';img.onload=()=>{const c=document.createElement('canvas');c.width=img.width;c.height=img.height;c.getContext('2d').drawImage(img,0,0);previewBG=c.toDataURL();update();};img.onerror=()=>{previewBG=null;update();};img.src=url;}
function copyJSON(){navigator.clipboard.writeText(document.getElementById('json-output').value).then(()=>{document.getElementById('status').textContent='Copied!';setTimeout(()=>document.getElementById('status').textContent='',2000);});}
async function saveTemplate(){const nv=buildNV(),name=prompt('Template name:',currentName||'untitled');if(!name)return;try{const r=await fetch('/api/save',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name,nodeview:nv})});const d=await r.json();document.getElementById('json-output').value=d.json;document.getElementById('status').textContent=`Saved: ${name}`;setTimeout(()=>document.getElementById('status').textContent='',3000);}catch(e){document.getElementById('status').textContent='Save failed';}}
init();
