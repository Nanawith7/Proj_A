// ═══════════ Nodeview Editor - Core (data + forms) ═══════════
let templates={}, currentName='', propRows=[];

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
  applyToForm(nv); renderTemplateList(); updatePreview();
}
function newTemplate(){currentName='untitled'; applyToForm({shape:'rect',rx:4}); renderTemplateList(); updatePreview();}
function importJSON(){const raw=prompt('Paste nodeview JSON:');if(!raw)return;try{applyToForm(JSON.parse(raw));updatePreview();}catch(e){alert('Invalid JSON');}}

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
    if(isPill)extraHTML=`<select onchange="propRows[${i}].shape=this.value;updatePreview()" style="width:60px"><option ${pr.shape==='round'?'selected':''}>round</option><option ${pr.shape==='diamond'?'selected':''}>diamond</option><option ${pr.shape==='rect'?'selected':''}>rect</option></select><input value="${pr.bg}" placeholder="bg" style="width:60px" oninput="propRows[${i}].bg=this.value;updatePreview()"><input value="${pr.textColor}" placeholder="fg" style="width:60px" oninput="propRows[${i}].textColor=this.value;updatePreview()">`;
    row.innerHTML=`<span>${i+1}</span><input value="${pr.key}" placeholder="key" oninput="propRows[${i}].key=this.value;updatePreview()"><select onchange="propRows[${i}].style=this.value;renderProps();updatePreview()"><option ${pr.style==='pill'?'selected':''}>pill</option><option ${pr.style==='text'?'selected':''}>text</option></select>${extraHTML}<input value="${pr.px}" placeholder="x" style="width:40px" oninput="propRows[${i}].px=this.value;updatePreview()"><input value="${pr.py}" placeholder="y" style="width:40px" oninput="propRows[${i}].py=this.value;updatePreview()"><button onclick="propRows.splice(${i},1);renderProps();updatePreview()" style="background:#533483;padding:2px 6px;font-size:10px">x</button>`;
    div.appendChild(row);
  });
}
function addProp(){propRows.push({key:'newKey',style:'text',shape:'round',bg:'#fff2',textColor:'#eee',px:'',py:''});renderProps();updatePreview();}

function buildNV(){
  const props={};
  propRows.forEach(pr=>{const p={};if(pr.style==='pill'){p.style='pill';p.shape=pr.shape;p.bg=pr.bg;p.textColor=pr.textColor;}if(pr.px||pr.py){p.position={};if(pr.px)p.position.x=pr.px;if(pr.py)p.position.y=pr.py;}if(Object.keys(p).length)props[pr.key]=p;});
  const layout={};
  if(getNum('nv-tpx')!==10)layout.titlePadX=getNum('nv-tpx');if(getNum('nv-tpy')!==10)layout.titlePadY=getNum('nv-tpy');
  if(getNum('nv-cfop')!==1)layout.collapsedFillOpacity=getNum('nv-cfop');if(getNum('nv-efop')!==1)layout.expandedFillOpacity=getNum('nv-efop');
  if(getNum('nv-bgop')!==0.15)layout.backgroundOpacity=getNum('nv-bgop');
  if(getNum('nv-ew')!==300)layout.expandMinW=getNum('nv-ew');if(getNum('nv-eh')!==200)layout.expandMinH=getNum('nv-eh');
  if(getNum('nv-cpx')!==10)layout.contentPadX=getNum('nv-cpx');if(getNum('nv-cpy')!==10)layout.contentPadY=getNum('nv-cpy');
  function getRaw(id){const v=document.getElementById(id)?.value||'';return v;}
  const bdx=getRaw('nv-bdx'),bdy=getRaw('nv-bdy'),tdx=getRaw('nv-tdx'),tdy=getRaw('nv-tdy');
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

function copyJSON(){navigator.clipboard.writeText(document.getElementById('json-output').value).then(()=>{document.getElementById('status').textContent='Copied!';setTimeout(()=>document.getElementById('status').textContent='',2000);});}
async function saveTemplate(){const nv=buildNV(),name=prompt('Template name:',currentName||'untitled');if(!name)return;try{const r=await fetch('/api/save',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name,nodeview:nv})});const d=await r.json();document.getElementById('json-output').value=d.json;document.getElementById('status').textContent=`Saved: ${name}`;setTimeout(()=>document.getElementById('status').textContent='',3000);}catch(e){document.getElementById('status').textContent='Save failed';}}
