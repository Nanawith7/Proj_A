// ═══════════ Nodeview Editor ═══════════
let templates={};
let currentName='';
let propRows=[];
let previewBG=null; // loaded background image for preview

const SVGNS='http://www.w3.org/2000/svg';

async function init(){
  try{const r=await fetch('/api/templates');templates=await r.json();}
  catch(e){templates={character:{shape:'rect',rx:4,nodeview:'character_card'}};}
  renderTemplateList();
  if(Object.keys(templates).length)loadTemplate(Object.keys(templates)[0]);
}

function renderTemplateList(){
  const div=document.getElementById('template-list');
  div.innerHTML='';
  Object.entries(templates).forEach(([name,td])=>{
    const btn=document.createElement('button');
    btn.textContent=`${name} (${td.nodeview||'none'})`;
    btn.onclick=()=>loadTemplate(name);
    if(name===currentName)btn.classList.add('active');
    div.appendChild(btn);
  });
}

async function loadTemplate(name){
  currentName=name;
  const td=templates[name]||{};
  const nvName=td.nodeview||'plain';
  let nv={};
  try{const r=await fetch(`/api/nodeview/${nvName}.json`);nv=await r.json();}
  catch(e){nv={shape:'rect',rx:4};}
  applyToForm(nv);
  renderTemplateList();
  update();
}

function newTemplate(){
  currentName='untitled';
  applyToForm({shape:'rect',rx:4});
  renderTemplateList();
  update();
}

function importJSON(){
  const raw=prompt('Paste nodeview JSON:');
  if(!raw)return;
  try{applyToForm(JSON.parse(raw));update();}
  catch(e){alert('Invalid JSON');}
}

function applyToForm(nv){
  const l=nv.layout||{};
  setVal('nv-shape',nv.shape||'rect');
  setVal('nv-rx',nv.rx||4);
  setVal('nv-sw',nv.strokeWidth||1);
  setVal('nv-stroke',nv.stroke||'#fff6');
  setVal('nv-fs',nv.fontSize||12);
  setVal('nv-ty',nv.titleY||'center');
  setVal('nv-tw',nv.titleWrap||false);
  setVal('nv-tpx',l.titlePadX??10);
  setVal('nv-tpy',l.titlePadY??10);
  setVal('nv-cfop',l.collapsedFillOpacity??1);
  setVal('nv-efop',l.expandedFillOpacity??1);
  setVal('nv-bgop',l.backgroundOpacity??0.15);
  setVal('nv-bg',nv.background||'');
  setVal('nv-ew',l.expandMinW??300);
  setVal('nv-eh',l.expandMinH??200);
  setVal('nv-cpx',l.contentPadX??10);
  setVal('nv-cpy',l.contentPadY??10);
  setVal('nv-bdy',l.bodyPosition?.y||0);
  setVal('nv-iax',l.iconAnchorX||'center');
  setVal('nv-iay',l.iconAnchorY||'center');
  setVal('nv-ipx',l.iconPadX??0);
  setVal('nv-ipy',l.iconPadY??0);
  // Properties
  propRows=[];
  const props=nv.properties||{};
  Object.entries(props).forEach(([k,v])=>{
    propRows.push({key:k,style:v.style||'text',shape:v.shape||'round',bg:v.bg||'#fff2',textColor:v.textColor||'#eee',px:v.position?.x||'',py:v.position?.y||''});
  });
  renderProps();
  renderProps();
}

function setVal(id,val){
  const el=document.getElementById(id);
  if(!el)return;
  if(el.type==='checkbox')el.checked=val;
  else el.value=val;
}

function getVal(id){return document.getElementById(id)?.value||'';}
function getNum(id){return parseFloat(document.getElementById(id)?.value)||0;}

function renderProps(){
  const div=document.getElementById('props-editor');
  div.innerHTML='';
  propRows.forEach((pr,i)=>{
    const row=document.createElement('div');row.className='prop-row';
    const isPill=pr.style==='pill';
    let extraHTML='';
    if(isPill){
      extraHTML=`<select onchange="propRows[${i}].shape=this.value;update()" style="width:60px"><option ${pr.shape==='round'?'selected':''}>round</option><option ${pr.shape==='diamond'?'selected':''}>diamond</option><option ${pr.shape==='rect'?'selected':''}>rect</option></select><input value="${pr.bg}" placeholder="bg" style="width:60px" onchange="propRows[${i}].bg=this.value;update()"><input value="${pr.textColor}" placeholder="fg" style="width:60px" onchange="propRows[${i}].textColor=this.value;update()">`;
    }
    row.innerHTML=`<span>${i+1}</span><input value="${pr.key}" placeholder="key" onchange="propRows[${i}].key=this.value;update()"><select onchange="propRows[${i}].style=this.value;renderProps();update()"><option ${pr.style==='pill'?'selected':''}>pill</option><option ${pr.style==='text'?'selected':''}>text</option></select>${extraHTML}<input value="${pr.px}" placeholder="x" style="width:40px" onchange="propRows[${i}].px=this.value;update()"><input value="${pr.py}" placeholder="y" style="width:40px" onchange="propRows[${i}].py=this.value;update()"><button onclick="propRows.splice(${i},1);renderProps();update()" style="background:#533483;padding:2px 6px;font-size:10px">x</button>`;
    div.appendChild(row);
  });
}

function addProp(){propRows.push({key:'newKey',style:'text',shape:'round',bg:'#fff2',textColor:'#eee',px:'',py:''});renderProps();update();}

// ═══════ Build nodeview JSON ═══════
function buildNV(){
  const props={};
  propRows.forEach(pr=>{
    const p={};
    if(pr.style==='pill'){p.style='pill';p.shape=pr.shape;p.bg=pr.bg;p.textColor=pr.textColor;}
    if(pr.px||pr.py){p.position={};if(pr.px)p.position.x=parseInt(pr.px);if(pr.py)p.position.y=parseInt(pr.py);}
    props[pr.key]=p;
  });
  const layout={};
  if(getNum('nv-tpx')!==10)layout.titlePadX=getNum('nv-tpx');
  if(getNum('nv-tpy')!==10)layout.titlePadY=getNum('nv-tpy');
  if(getNum('nv-cfop')!==1)layout.collapsedFillOpacity=getNum('nv-cfop');
  if(getNum('nv-efop')!==1)layout.expandedFillOpacity=getNum('nv-efop');
  if(getNum('nv-bgop')!==0.15)layout.backgroundOpacity=getNum('nv-bgop');
  if(getNum('nv-ew')!==300)layout.expandMinW=getNum('nv-ew');
  if(getNum('nv-eh')!==200)layout.expandMinH=getNum('nv-eh');
  if(getNum('nv-cpx')!==10)layout.contentPadX=getNum('nv-cpx');
  if(getNum('nv-cpy')!==10)layout.contentPadY=getNum('nv-cpy');
  if(getNum('nv-bdy'))layout.bodyPosition={y:getNum('nv-bdy')};
  if(getVal('nv-iax')!=='center')layout.iconAnchorX=getVal('nv-iax');
  if(getVal('nv-iay')!=='center')layout.iconAnchorY=getVal('nv-iay');
  if(getNum('nv-ipx'))layout.iconPadX=getNum('nv-ipx');
  if(getNum('nv-ipy'))layout.iconPadY=getNum('nv-ipy');

  const nv={shape:getVal('nv-shape'),rx:getNum('nv-rx')};
  if(getNum('nv-sw')!==0.5)nv.strokeWidth=getNum('nv-sw');
  if(getVal('nv-stroke')!=='#fff6')nv.stroke=getVal('nv-stroke');
  if(getNum('nv-fs')!==12)nv.fontSize=getNum('nv-fs');
  if(getVal('nv-ty')!=='center')nv.titleY=getVal('nv-ty');
  if(getVal('nv-tw')==='true')nv.titleWrap=true;
  if(getVal('nv-bg'))nv.background=getVal('nv-bg');
  if(Object.keys(props).length)nv.properties=props;
  if(Object.keys(layout).length)nv.layout=layout;
  return nv;
}

// ═══════ Preview ═══════
function update(){
  const nv=buildNV();
  document.getElementById('json-output').value=JSON.stringify(nv,null,2);

  // Simple layout params calculation (JS version of layoutParams)
  const lp=computeLP(nv,120,80); // collapsed preview
  const eLP=computeLP(nv,380,280); // expanded preview

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
      bgImg.setAttribute('href',previewBG);
      bgImg.setAttribute('width',w);bgImg.setAttribute('height',h);
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

  // Title
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

  // Props (expanded) + draggable markers
  if(expanded&&propRows.length){
    const startY=nv.layout?.bodyPosition?.y||(lp.contentY+12);
    propRows.forEach((pr,i)=>{
      if(!pr.key)return;
      const y=pr.py?parseInt(pr.py):startY+i*22;
      const x=pr.px?parseInt(pr.px):lp.contentX;

      // Draggable marker at absolute position
      const marker=document.createElementNS(SVGNS,'rect');
      marker.setAttribute('x',x-3);marker.setAttribute('y',y-3);
      marker.setAttribute('width',6);marker.setAttribute('height',6);
      marker.setAttribute('fill','#e94560');marker.setAttribute('rx','2');
      marker.setAttribute('cursor','grab');marker.setAttribute('data-pi',i);
      marker.onmousedown=e=>startDragProp(e,i,svgId);
      g.appendChild(marker);

      const txt=document.createElementNS(SVGNS,'text');
      txt.setAttribute('x',x+8);txt.setAttribute('y',y+4);
      txt.setAttribute('fill','#fff');txt.setAttribute('font-size','9');
      txt.setAttribute('font-weight','bold');
      txt.textContent=pr.key;
      g.appendChild(txt);
    });
  }

  svg.appendChild(g);
}

// ═══════ Actions ═══════
function copyJSON(){
  const json=document.getElementById('json-output').value;
  navigator.clipboard.writeText(json).then(()=>{
    document.getElementById('status').textContent='Copied!';
    setTimeout(()=>document.getElementById('status').textContent='',2000);
  });
}

async function saveTemplate(){
  const nv=buildNV();
  const name=prompt('Template name:',currentName||'untitled');
  if(!name)return;
  try{
    const r=await fetch('/api/save',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name,nodeview:nv})});
    const data=await r.json();
    document.getElementById('json-output').value=data.json;
    document.getElementById('status').textContent=`Saved: ${name}`;
    setTimeout(()=>document.getElementById('status').textContent='',3000);
  }catch(e){
    document.getElementById('status').textContent='Save failed';
  }
}

function loadBGFile(input){
  const file=input.files[0];
  if(!file)return;
  const reader=new FileReader();
  reader.onload=()=>{previewBG=reader.result;update();};
  reader.readAsDataURL(file);
}

function loadBGURL(url){
  if(!url){previewBG=null;update();return;}
  const img=new Image();
  img.crossOrigin='anonymous';
  img.onload=()=>{
    const c=document.createElement('canvas');c.width=img.width;c.height=img.height;
    c.getContext('2d').drawImage(img,0,0);
    previewBG=c.toDataURL();
    update();
  };
  img.onerror=()=>{previewBG=null;update();};
  img.src=url;
}

// ═══════ Drag property positions in preview ═══════
let dragPI=-1,dragSvgId='';
function startDragProp(e,pi,svgId){
  e.stopPropagation();e.preventDefault();
  dragPI=pi;dragSvgId=svgId;
}
window.addEventListener('mousemove',e=>{
  if(dragPI<0)return;
  const svg=document.getElementById(dragSvgId);
  if(!svg)return;
  const rect=svg.getBoundingClientRect();
  const x=Math.round((e.clientX-rect.left)/(rect.width/380));
  const y=Math.round((e.clientY-rect.top)/(rect.height/280));
  propRows[dragPI].px=x>0?String(x):'';
  propRows[dragPI].py=y>0?String(y):'';
  renderProps();update();
});
window.addEventListener('mouseup',()=>{dragPI=-1;});

init();
