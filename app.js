// ================================================================
// KABEB WEATHER RADAR v4
// Hard-coded admin list — DO NOT MODIFY
// ================================================================
const ADMIN_EMAILS = Object.freeze(['fheh074@gmail.com','kalebgamer0515@gmail.com']);
const isAdmin = e => ADMIN_EMAILS.includes((e||'').toLowerCase().trim());

const WATCH_TYPE_LABELS = {
  TORNADO_WATCH:'TORNADO WATCH', TORNADO_EMERGENCY:'TORNADO EMERGENCY',
  SVR_WATCH:'SEVERE THUNDERSTORM WATCH', FLASH_FLOOD_WATCH:'FLASH FLOOD WATCH',
  WINTER_STORM_WATCH:'WINTER STORM WATCH', FIRE_WEATHER_WATCH:'FIRE WEATHER WATCH',
  HURRICANE_WATCH:'HURRICANE WATCH', SPECIAL_STATEMENT:'SPECIAL STATEMENT'
};
const WATCH_COLORS = {
  TORNADO_WATCH:'#FF0000', TORNADO_EMERGENCY:'#FF0040', SVR_WATCH:'#FF6600',
  FLASH_FLOOD_WATCH:'#00FF7F', WINTER_STORM_WATCH:'#87CEFA',
  FIRE_WEATHER_WATCH:'#FF4500', HURRICANE_WATCH:'#FF69B4', SPECIAL_STATEMENT:'#4169E1'
};

const NWS_COLORS = {
  'tornado warning':'#FF0000','tornado emergency':'#FF0000','pds tornado':'#FF0000',
  'severe thunderstorm warning':'#FF8C00','flash flood warning':'#00FF7F',
  'flash flood emergency':'#00FF7F','flood warning':'#00CC44',
  'tornado watch':'#FFFF00','severe thunderstorm watch':'#DB7093',
  'winter storm warning':'#87CEFA','blizzard warning':'#87CEFA',
  'high wind warning':'#DAA520','excessive heat warning':'#C71585',
  'hurricane warning':'#DC143C','hurricane watch':'#FF69B4',
  'fire weather watch':'#FF7F00','red flag warning':'#FF4500',
  'dense fog advisory':'#808080','special weather statement':'#FFE4B5',
};
function nwsColor(ev){ const e=(ev||'').toLowerCase(); for(const[k,v] of Object.entries(NWS_COLORS)){if(e.includes(k))return v;} return '#888'; }

// SPC outlook categories — matches the style in the screenshot
const SPC_CATEGORIES = [
  {id:'HIGH',  label:'HIGH',         fill:'#FF00FF', stroke:'#CC00CC', fillOpacity:0.25},
  {id:'MDT',   label:'MODERATE',     fill:'#FF0000', stroke:'#CC0000', fillOpacity:0.22},
  {id:'ENH',   label:'ENHANCED',     fill:'#FF8C00', stroke:'#CC7000', fillOpacity:0.2},
  {id:'SLGT',  label:'SLIGHT',       fill:'#FFFF00', stroke:'#CCCC00', fillOpacity:0.18},
  {id:'MRGL',  label:'MARGINAL',     fill:'#00CC00', stroke:'#009900', fillOpacity:0.16},
  {id:'TSTM',  label:'GENERAL TSTM', fill:'#C0C0C0', stroke:'#888888', fillOpacity:0.1},
];

// ─── STATE ─────────────────────────────────────────────────────
const S = {
  map:null, mode:'global', product:'REF',
  site:null, siteName:'', siteCoords:null,
  rvFrames:[], rvIdx:0,
  iemFrames:[], iemIdx:0, iemProd:'N0B',
  playing:false, timer:null, speed:450,
  opacity:0.9, showNws:true, showSpc:true, showKabeb:true, showRings:false, showMarkers:true,
  sidebarOpen:true,
  radarLayers:[],
  nwsGrp:null, spcGrp:null, kabebGrp:null, markGrp:null, ringsGrp:null,
  nwsWarnings:[], kabebWatches:[],
  user:null,
  drawing:false, drawPts:[], drawLine:null, drawPoly:null, pendingPoly:null,
  wpWarnings:[], wpIdx:0, kwpIdx:0
};

// ─── HELPERS ───────────────────────────────────────────────────
const $ = id => document.getElementById(id);
const pad = n => String(n).padStart(2,'0');
function toTs(d){ return `${d.getUTCFullYear()}${pad(d.getUTCMonth()+1)}${pad(d.getUTCDate())}${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}`; }
function fmtIso(d){ return `${d.getUTCFullYear()}-${pad(d.getUTCMonth()+1)}-${pad(d.getUTCDate())}T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:00Z`; }
function rid(id){ const u=(id||'').toUpperCase(); return (u.length===4&&u[0]==='K')?u.slice(1):u; }
function genEst(n=10){
  const r=new Date(); r.setUTCSeconds(0,0); r.setUTCMinutes(Math.floor(r.getUTCMinutes()/5)*5);
  const f=[]; for(let i=n-1;i>=0;i--)f.push(toTs(new Date(r-i*5*60000))); return f;
}
function timeFmt(exp){
  const r=exp-Date.now(); if(r<=0)return'Expired';
  const h=Math.floor(r/3600000),m=Math.floor((r%3600000)/60000);
  return h>0?`${h}h ${m}m`:`${m}m`;
}

// ─── STORAGE ───────────────────────────────────────────────────
function loadPrefs(){ try{const d=JSON.parse(localStorage.getItem('kbp')||'{}'); if(d.opacity!=null)S.opacity=d.opacity; if(d.speed!=null)S.speed=d.speed; if(d.showNws!=null)S.showNws=d.showNws; if(d.showSpc!=null)S.showSpc=d.showSpc; if(d.showKabeb!=null)S.showKabeb=d.showKabeb;}catch(e){} }
function savePrefs(){ localStorage.setItem('kbp',JSON.stringify({opacity:S.opacity,speed:S.speed,showNws:S.showNws,showSpc:S.showSpc,showKabeb:S.showKabeb})); }
function getWatches(){ try{return JSON.parse(localStorage.getItem('kbw')||'[]').filter(w=>w.exp>Date.now());}catch(e){return[];} }
function addWatch(w){ const a=JSON.parse(localStorage.getItem('kbw')||'[]'); a.push(w); localStorage.setItem('kbw',JSON.stringify(a)); }
function removeWatch(id){ localStorage.setItem('kbw',JSON.stringify(JSON.parse(localStorage.getItem('kbw')||'[]').filter(w=>w.id!==id))); }
function clearExpired(){ localStorage.setItem('kbw',JSON.stringify(JSON.parse(localStorage.getItem('kbw')||'[]').filter(w=>w.exp>Date.now()))); }
function getUsers(){ try{return JSON.parse(localStorage.getItem('kbu')||'[]');}catch(e){return[];} }
function saveUsers(u){ localStorage.setItem('kbu',JSON.stringify(u)); }

// ─── AUTH ──────────────────────────────────────────────────────
function tryLogin(email,pass){ const u=getUsers().find(x=>x.e.toLowerCase()===email.toLowerCase()&&x.p===btoa(pass)); return u?{email:u.e,admin:isAdmin(u.e)}:null; }
function tryRegister(email,pass){ const u=getUsers(); if(u.find(x=>x.e.toLowerCase()===email.toLowerCase()))return{ok:false,msg:'Account already exists'}; u.push({e:email,p:btoa(pass)}); saveUsers(u); return{ok:true,user:{email,admin:isAdmin(email)}}; }
function loadUser(){ try{const u=JSON.parse(localStorage.getItem('kbc')||'null'); if(u){S.user=u;S.user.admin=isAdmin(u.email);}}catch(e){} }
function setUser(u){ S.user=u; if(u)localStorage.setItem('kbc',JSON.stringify(u)); else localStorage.removeItem('kbc'); renderUserUI(); }

function renderUserUI(){
  const lb=$('login-btn'), ua=$('user-wrap'), as=$('admin-sec');
  if(S.user){
    lb.style.display='none'; ua.style.display='';
    $('u-av').textContent=S.user.email[0].toUpperCase();
    $('u-av').className='u-av'+(S.user.admin?' admin':'');
    $('u-name').textContent=S.user.email.split('@')[0];
    $('u-role').style.display=S.user.admin?'':'none';
    $('dd-email').textContent=S.user.email;
    as.style.display=S.user.admin?'':'none';
  } else { lb.style.display=''; ua.style.display='none'; as.style.display='none'; }
}

// ─── RAINVIEWER ────────────────────────────────────────────────
async function fetchRV(){
  const r=await fetch('https://api.rainviewer.com/public/weather-maps.json',{cache:'no-cache'});
  if(!r.ok)throw new Error('RV');
  const d=await r.json();
  return{past:d.radar.past||[],nowcast:d.radar.nowcast||[]};
}
// Color 6 = NEXRAD Level III look (closest to Ryan Hall)
const rvUrl = ts => `https://tilecache.rainviewer.com/v2/radar/${ts}/512/{z}/{x}/{y}/6/1_1.png`;

// ─── IEM RIDGE ─────────────────────────────────────────────────
const PROD_MAP = {REF:'N0B',VEL:'N0U',CC:'N0C'};
const PROD_FB  = {N0B:['N0B','N0Q'],N0U:['N0U','N0S'],N0C:['N0C','N0X']};
const iemUrl = (r,p,ts) => `https://mesonet.agron.iastate.edu/cache/tile.py/1.0.0/ridge::${r}-${p}-${ts}/{z}/{x}/{y}.png`;

async function fetchIem(siteId,product){
  const r=rid(siteId), cands=PROD_FB[product]||[product], now=new Date();
  for(const p of cands){
    for(const hrs of [1,3,6]){
      const url=`https://mesonet.agron.iastate.edu/json/radar?operation=list&product=${p}&station=${r}&start=${fmtIso(new Date(now-hrs*3600000))}&end=${fmtIso(now)}`;
      try{
        const ctrl=new AbortController(); setTimeout(()=>ctrl.abort(),6000);
        const res=await fetch(url,{signal:ctrl.signal}); if(!res.ok)continue;
        const data=await res.json();
        const tss=[...new Set((data.scans||data.data||[]).map(s=>{
          const v=s.valid||s.ts||'';
          try{const d=new Date(v.replace(' ','T')+(v.endsWith('Z')?'':'Z'));return isNaN(d)?null:toTs(d);}catch(e){return null;}
        }).filter(Boolean))];
        if(tss.length)return{frames:tss.slice(-12),product:p,ok:true};
      }catch(e){}
    }
  }
  return{frames:genEst(8),product:cands[0],ok:false};
}

// ─── RADAR LAYERS ──────────────────────────────────────────────
function clearRadar(){ S.radarLayers.forEach(l=>{try{S.map.removeLayer(l);}catch(e){}}); S.radarLayers=[]; }

function makeRvLayer(ts,op){
  return L.tileLayer(rvUrl(ts),{opacity:op,tileSize:512,zoomOffset:-1,zIndex:200,maxNativeZoom:12,maxZoom:18,attribution:'',crossOrigin:true,keepBuffer:8,updateWhenZooming:false,updateWhenIdle:false});
}
function makeIemLayer(r,p,ts,op){
  return L.tileLayer(iemUrl(r,p,ts),{opacity:op,tileSize:256,zoomOffset:0,zIndex:200,maxNativeZoom:9,maxZoom:18,attribution:'',crossOrigin:true,keepBuffer:6,updateWhenZooming:false,updateWhenIdle:false});
}

function buildGlobal(){
  clearRadar();
  if(!S.rvFrames.length)return;
  S.rvFrames.forEach((f,i)=>{
    const l=makeRvLayer(f.time,i===S.rvIdx?S.opacity:0);
    l.addTo(S.map); S.radarLayers.push(l);
  });
  renderTimeline();
}
function buildSite(){
  clearRadar();
  if(!S.iemFrames.length||!S.site)return;
  const r=rid(S.site);
  S.iemFrames.forEach((ts,i)=>{
    const l=makeIemLayer(r,S.iemProd,ts,i===S.iemIdx?S.opacity:0);
    l.addTo(S.map); S.radarLayers.push(l);
  });
  renderTimeline();
}

function getN(){ return S.mode==='global'?S.rvFrames.length:S.iemFrames.length; }
function getIdx(){ return S.mode==='global'?S.rvIdx:S.iemIdx; }
function setIdx(i){ if(S.mode==='global')S.rvIdx=i; else S.iemIdx=i; }

function showFrame(idx){
  const n=getN(); if(!n)return;
  const old=getIdx(), next=Math.max(0,Math.min(n-1,idx));
  setIdx(next);
  if(S.radarLayers[old])S.radarLayers[old].setOpacity(0);
  if(S.radarLayers[next])S.radarLayers[next].setOpacity(S.opacity);
  renderTimeline();
}
function setOp(v){ S.opacity=v; const i=getIdx(); if(S.radarLayers[i])S.radarLayers[i].setOpacity(v); }

// ─── ANIMATION ─────────────────────────────────────────────────
function play(){
  if(S.timer)clearInterval(S.timer);
  S.playing=true;
  $('tl-play').textContent='⏸'; $('tl-play').classList.add('playing');
  S.timer=setInterval(()=>{const n=getN();if(n)showFrame((getIdx()+1)%n);},S.speed);
}
function pause(){
  if(S.timer){clearInterval(S.timer);S.timer=null;}
  S.playing=false; $('tl-play').textContent='▶'; $('tl-play').classList.remove('playing');
}
function togglePlay(){ S.playing?pause():play(); }

// ─── TIMELINE ──────────────────────────────────────────────────
function renderTimeline(){
  const track=$('tl-track'), idx=getIdx();
  let labels=[];
  if(S.mode==='global'){
    labels=S.rvFrames.map(f=>{const d=new Date(f.time*1000);return`${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;});
  } else {
    labels=S.iemFrames.map(ts=>`${ts.slice(8,10)}:${ts.slice(10,12)}`);
  }
  track.innerHTML='';
  labels.forEach((lbl,i)=>{
    const d=document.createElement('div');
    d.className='tl-dot'+(i===idx?' on':'');
    d.textContent=lbl; d.onclick=()=>{pause();showFrame(i);}; track.appendChild(d);
  });
  $('tl-frame').textContent=labels.length?`Frame ${idx+1}/${labels.length}`:'—';
  $('tl-time').textContent=labels[idx]||'—';
}

// ─── LOAD GLOBAL ───────────────────────────────────────────────
async function loadGlobal(){
  pause();
  S.mode='global';
  // Always hide single-site controls when switching to global
  $('prod-sec').style.display='none';
  $('site-sec').style.display='none';
  S.map.setView([38,-97],4,{animate:true});
  updateBadge(); updatePP(); renderRings();
  setStatus('loading','Fetching radar frames…');
  setLoading(true,'Loading global mosaic…');
  try{
    const rv=await fetchRV();
    S.rvFrames=[...rv.past,...rv.nowcast].slice(-16);
    S.rvIdx=rv.past.length-1; if(S.rvIdx<0)S.rvIdx=S.rvFrames.length-1;
    buildGlobal();
    setStatus('ok',`Global · ${S.rvFrames.length} frames · RainViewer`);
    setLoading(false);
    renderMarkers();
    showFrame(S.rvIdx); // show latest, don't auto-play
  }catch(e){
    // IEM mosaic fallback
    const FR=['nexrad-n0q-m55m','nexrad-n0q-m50m','nexrad-n0q-m45m','nexrad-n0q-m40m','nexrad-n0q-m35m','nexrad-n0q-m30m','nexrad-n0q-m25m','nexrad-n0q-m20m','nexrad-n0q-m15m','nexrad-n0q-m10m','nexrad-n0q-m05m','nexrad-n0q'];
    clearRadar();
    FR.forEach((fr,i)=>{
      const l=L.tileLayer(`https://mesonet.agron.iastate.edu/cache/tile.py/1.0.0/${fr}/{z}/{x}/{y}.png`,{opacity:i===FR.length-1?S.opacity:0,tileSize:512,zoomOffset:-1,zIndex:200,maxNativeZoom:9,maxZoom:18,attribution:'',crossOrigin:true,keepBuffer:6,updateWhenZooming:false});
      l.addTo(S.map); S.radarLayers.push(l);
    });
    S.rvFrames=FR.map((_,i)=>({time:Date.now()/1000-((FR.length-1-i)*5*60)}));
    S.rvIdx=FR.length-1; renderTimeline();
    setStatus('ok','Global · IEM fallback'); setLoading(false); renderMarkers();
    showFrame(S.rvIdx);
  }
}

// ─── LOAD SINGLE SITE ──────────────────────────────────────────
async function loadSite(siteId,coords,name){
  pause();
  S.mode='single-site'; S.site=siteId; S.siteCoords=coords; S.siteName=name||siteId;
  const iemProd=PROD_MAP[S.product]||'N0B';
  S.iemFrames=genEst(10); S.iemIdx=S.iemFrames.length-1; S.iemProd=iemProd;
  buildSite();
  S.map.setView(coords,8,{animate:true});
  renderRings(); updateBadge(); updatePP();
  setStatus('loading',`${siteId} · ${S.product} · Fetching…`);
  setLoading(true,`${siteId} — loading ${S.product}…`);
  play(); // play estimated frames while real data loads in background
  const res=await fetchIem(siteId,iemProd);
  S.iemProd=res.product;
  const wasPlaying=S.playing; pause();
  S.iemFrames=res.frames; S.iemIdx=res.frames.length-1;
  buildSite();
  if(res.ok){
    setStatus('ok',`${siteId} · ${res.product} · ${res.frames.length} scans`);
  } else {
    setStatus('error',`${siteId} · No data — try REF`);
  }
  setLoading(false); updateBadge(); updatePP();
  if(wasPlaying||res.ok)play();
}

// ─── STATUS / LOADING ──────────────────────────────────────────
function setStatus(t,txt){ $('radar-status').className='status-row '+t; $('s-txt').textContent=txt; }
function setLoading(on,txt){ $('loading-bar').style.display=on?'flex':'none'; if(txt)$('ld-txt').textContent=txt; }

// ─── BADGE + PRODUCT PANEL ─────────────────────────────────────
function updateBadge(){
  const PC={REF:'rgba(0,212,255,.26)',VEL:'rgba(168,85,247,.26)',CC:'rgba(0,255,128,.22)'};
  const PL={REF:'REF',VEL:'VEL',CC:'CC'};
  const badge=$('center-badge'), bt=$('badge-txt'), bp=$('badge-prod');
  if(S.mode==='global'){ badge.style.borderColor='rgba(0,212,255,.26)'; bt.textContent='GLOBAL MOSAIC'; bp.style.display='none'; }
  else { badge.style.borderColor=PC[S.product]||'rgba(0,212,255,.26)'; bt.textContent=S.site?`${S.site} · ${PL[S.product]||S.product}`:'SINGLE SITE'; bp.textContent=PL[S.product]||S.product; bp.style.display=''; }
}
function updatePP(){
  const PTL={REF:'LOCAL RADAR',VEL:'WIND VELOCITY',CC:'CORR. COEFF.'};
  $('pp-title').textContent=S.mode==='global'?'GLOBAL MOSAIC':(PTL[S.product]||'LOCAL RADAR');
  const n=new Date(),h=n.getHours(),m=n.getMinutes(),ap=h>=12?'PM':'AM',h12=h%12||12;
  $('pp-time').textContent=`${pad(h12)}:${pad(m)} ${ap} CDT`;
  $('pp-bar').className='pp-bar '+(S.product==='VEL'?'pp-vel':S.product==='CC'?'pp-cc':'pp-ref');
  const lbls=$('pp-labels');
  if(S.product==='VEL')lbls.innerHTML='<span>←TOWARD</span><span style="flex:1"></span><span>AWAY→</span>';
  else if(S.product==='CC')lbls.innerHTML='<span>LOW</span><span>MEDIUM</span><span>HIGH</span>';
  else lbls.innerHTML='<span>LIGHT</span><span>MODERATE</span><span>HEAVY</span><span>EXTREME</span>';
  const stEl=$('pp-state');
  if(S.mode==='single-site'&&S.site){
    $('pp-stn').textContent=`${rid(S.site)} · 0.5°`;
    const site=SITES.find(x=>x.id===S.site); const parts=(site?.name||'').split(' ');
    stEl.textContent=parts[parts.length-1]||''; stEl.style.display='';
  } else { $('pp-stn').textContent='GLOBAL'; stEl.textContent=''; stEl.style.display='none'; }
}

// ─── SPC OUTLOOKS ──────────────────────────────────────────────
async function fetchSPC(){
  S.spcGrp.clearLayers();
  if(!S.showSpc)return;
  // SPC Day 1 outlook GeoJSON
  const url='https://www.spc.noaa.gov/products/outlook/day1otlk_cat.nolyr.geojson';
  try{
    const ctrl=new AbortController(); setTimeout(()=>ctrl.abort(),8000);
    const res=await fetch(url,{signal:ctrl.signal,cache:'no-cache'});
    if(!res.ok)return;
    const data=await res.json();
    // Render from lowest to highest risk so higher risks appear on top
    const orderedCats=['TSTM','MRGL','SLGT','ENH','MDT','HIGH'];
    orderedCats.forEach(catId=>{
      const cfg=SPC_CATEGORIES.find(c=>c.id===catId);
      if(!cfg)return;
      const features=(data.features||[]).filter(f=>(f.properties?.LABEL2||f.properties?.LABEL||'').toUpperCase()===catId||(f.properties?.DN||0)===SPC_CATEGORIES.indexOf(cfg));
      features.forEach(f=>{
        try{
          L.geoJSON(f,{
            style:{color:cfg.stroke,fillColor:cfg.fill,fillOpacity:cfg.fillOpacity,weight:1.5,opacity:0.85,dashArray:catId==='TSTM'?'5 4':null},
            onEachFeature(_,lay){
              lay.bindTooltip(`SPC Day 1 Outlook: ${cfg.label}`,{sticky:true});
            }
          }).addTo(S.spcGrp);
        }catch(e){}
      });
    });
    renderSPCLegend(true);
  }catch(e){ renderSPCLegend(false); }
}

function renderSPCLegend(show){
  let el=document.getElementById('spc-legend');
  if(!el){
    el=document.createElement('div');
    el.id='spc-legend'; el.className='spc-legend';
    document.body.appendChild(el);
  }
  if(!show||!S.showSpc){ el.classList.remove('visible'); return; }
  el.innerHTML='<div class="spc-legend-title">SPC DAY 1 OUTLOOK</div>'+
    SPC_CATEGORIES.slice(0,-1).map(c=>`<div class="spc-row"><div class="spc-swatch" style="background:${c.fill};border:1px solid ${c.stroke}"></div><div class="spc-lbl">${c.label}</div></div>`).reverse().join('');
  el.classList.add('visible');
}

// ─── NWS WARNINGS ──────────────────────────────────────────────
const NWS_PRIO=['tornado emergency','tornado warning','severe thunderstorm warning','flash flood emergency','flash flood warning'];
function warnPrio(ev){ const e=(ev||'').toLowerCase(); for(let i=0;i<NWS_PRIO.length;i++){if(e.includes(NWS_PRIO[i]))return NWS_PRIO.length-i;} return 0; }

async function fetchNWS(){
  try{
    const r=await fetch('https://api.weather.gov/alerts/active?status=actual&message_type=alert');
    if(!r.ok)return;
    const d=await r.json();
    S.nwsWarnings=(d.features||[]).sort((a,b)=>warnPrio(b.properties?.event)-warnPrio(a.properties?.event));
    renderNWS(); updateChips();
    // Auto-show for significant warnings (tornado/SVR/flood)
    const top=S.nwsWarnings[0];
    if(top&&warnPrio(top.properties?.event)>=2){
      S.wpWarnings=[...S.nwsWarnings]; showWP(0);
    }
  }catch(e){}
}
function renderNWS(){
  S.nwsGrp.clearLayers(); if(!S.showNws)return;
  S.nwsWarnings.forEach((f,idx)=>{
    const p=f.properties||{},color=nwsColor(p.event||'');
    try{
      if(f.geometry?.type){
        L.geoJSON(f,{
          style:{color,fillColor:color,fillOpacity:0.15,weight:1.8,opacity:0.88},
          onEachFeature(_,lay){ lay.on('click',()=>{S.wpWarnings=[...S.nwsWarnings];showWP(idx);}); }
        }).addTo(S.nwsGrp);
      }
    }catch(e){}
  });
}

// ─── NWS WARNING PANEL ─────────────────────────────────────────
function showWP(idx){
  const wp=$('wp');
  if(!S.wpWarnings.length||idx<0||idx>=S.wpWarnings.length){wp.style.display='none';return;}
  const w=S.wpWarnings[idx]; S.wpIdx=idx;
  const p=w.properties||{},ev=(p.event||'').toLowerCase();
  let theme='def';
  if(ev.includes('tornado emergency')||ev.includes('particularly dangerous'))theme='pds';
  else if(ev.includes('tornado'))theme='tor';
  else if(ev.includes('severe thunderstorm'))theme='svr';
  else if(ev.includes('flash flood')||ev.includes('flood'))theme='flood';
  wp.style.display='';
  wp.className='warn-panel '+theme+(S.sidebarOpen?'':' sb-closed');
  let sev='DANGEROUS SITUATION';
  if(ev.includes('particularly dangerous')||ev.includes('emergency'))sev='PARTICULARLY DANGEROUS SITUATION';
  $('wp-hdr').textContent=sev;
  let act='SEEK SHELTER';
  if(ev.includes('tornado'))act='TAKE COVER NOW';
  else if(ev.includes('flash flood'))act='MOVE TO HIGHER GROUND';
  $('wp-act').textContent=act;
  $('wp-type').textContent=(p.event||'').toUpperCase();
  const exp=p.expires?Math.max(0,Math.round((new Date(p.expires)-Date.now())/60000)):null;
  $('wp-exp').textContent=exp!=null?(exp>=60?`EXPIRES IN ${Math.floor(exp/60)} HR ${exp%60} MIN`:`EXPIRES IN ${exp} MIN`):'ACTIVE';
  const area=p.areaDesc||'—';
  $('wp-ctys').textContent=area.split(';').map(x=>x.trim().split(',')[0].toUpperCase()).filter(Boolean).slice(0,5).join(', ')||area.slice(0,60);
  const parts=area.split(','); $('wp-state').textContent=parts.length>1?parts[parts.length-1].trim().toUpperCase().slice(0,2):'—';
  const params=p.parameters||{};
  const thr=params.tornadoDetection?.[0]||null;
  const thrEl=$('wp-threat'); if(thr){thrEl.textContent=thr.toUpperCase();thrEl.style.display='';}else thrEl.style.display='none';
  const hail=params.maxHailSize?.[0]; const hr=$('wp-hail-r');
  if(hail){$('wp-hail').textContent=hail+' IN';hr.style.display='';}else hr.style.display='none';
  const src=params.tornadoDetection?.[0]||null; const sr=$('wp-src-r');
  if(src){$('wp-src').textContent=src;sr.style.display='';}else sr.style.display='none';
  const more=S.wpWarnings.length-idx-1;
  const mEl=$('wp-more'); if(more>0){$('wp-more-n').textContent=more;mEl.style.display='';}else mEl.style.display='none';
}

// ─── KABEB WATCH PANEL ─────────────────────────────────────────
function showKWP(idx){
  const watches=getWatches(), kwp=$('kwp');
  if(!watches.length||idx<0||idx>=watches.length){kwp.style.display='none';return;}
  const w=watches[idx]; S.kwpIdx=idx;
  kwp.style.display='';
  kwp.className='kwatch-panel'+(S.sidebarOpen?'':' sb-closed');
  kwp.style.borderColor=(w.color||'rgba(255,200,0,.28)');
  kwp.style.boxShadow=`0 10px 48px rgba(0,0,0,.9),0 0 20px ${(w.color||'#FFB000')}16`;
  $('kwp-type').textContent=WATCH_TYPE_LABELS[w.type]||w.type;
  $('kwp-type').style.color=(w.color||'#FFB000')+'aa';
  $('kwp-title').textContent=w.title||'—';
  const exp=Math.max(0,Math.round((w.exp-Date.now())/60000));
  $('kwp-exp').textContent=exp>=60?`EXPIRES IN ${Math.floor(exp/60)} HR ${exp%60} MIN`:`EXPIRES IN ${exp} MIN`;
  const descEl=$('kwp-desc');
  if(w.desc){descEl.textContent=w.desc;descEl.style.display='';}else descEl.style.display='none';
  const navEl=$('kwp-nav');
  if(watches.length>1){$('kwp-ctr').textContent=`${idx+1} / ${watches.length}`;navEl.style.display='';}else navEl.style.display='none';
}

// ─── KABEB WATCHES ─────────────────────────────────────────────
function renderKabeb(){
  S.kabebGrp.clearLayers();
  const strip=$('watch-strip'); strip.innerHTML='';
  S.kabebWatches=getWatches();
  S.kabebWatches.forEach((w,idx)=>{
    const color=w.color||'#FFB000';
    if(w.poly?.length>=3&&S.showKabeb){
      const poly=L.polygon(w.poly,{color,fillColor:color,fillOpacity:0.16,weight:2.5,opacity:0.95});
      poly.on('click',()=>showKWP(idx));
      S.kabebGrp.addLayer(poly);
    }
    const chip=document.createElement('div');
    chip.className='wchip'; chip.style.borderColor=color;
    chip.innerHTML=`<div class="wchip-t" style="color:${color}">${w.title||WATCH_TYPE_LABELS[w.type]||'KABEB WATCH'}</div><div class="wchip-e">${timeFmt(w.exp)} remaining</div>`;
    chip.onclick=()=>showKWP(idx); strip.appendChild(chip);
  });
  updateChips();
  const cnt=$('admin-cnt'); if(cnt)cnt.textContent=`${S.kabebWatches.length} active watch${S.kabebWatches.length!==1?'es':''}`;
  if(S.kabebWatches.length>0&&$('kwp').style.display==='none')showKWP(0);
  else if(!S.kabebWatches.length)$('kwp').style.display='none';
}
window._del=(id)=>{ removeWatch(id); renderKabeb(); S.map.closePopup(); };

function updateChips(){
  const nc=S.nwsWarnings.length,kc=getWatches().length;
  $('nws-n').textContent=nc; $('kab-n').textContent=kc;
  $('nws-chip').style.display=nc>0?'flex':'none';
  $('kab-chip').style.display=kc>0?'flex':'none';
}

// ─── MARKERS & RINGS ───────────────────────────────────────────
function renderMarkers(){
  S.markGrp.clearLayers(); if(!S.showMarkers)return;
  SITES.forEach(s=>{
    const icon=L.divIcon({html:`<div style="width:8px;height:8px;border-radius:50%;background:rgba(0,212,255,.58);border:1px solid rgba(0,212,255,.28);box-shadow:0 0 5px rgba(0,212,255,.3)"></div>`,iconSize:[8,8],iconAnchor:[4,4],className:''});
    const m=L.marker([s.lat,s.lon],{icon,title:s.id});
    m.bindTooltip(`${s.id} — ${s.name}`,{direction:'top',offset:[0,-5]});
    m.on('click',()=>selectSite(s.id,[s.lat,s.lon],s.name));
    S.markGrp.addLayer(m);
  });
}
function renderRings(){
  S.ringsGrp.clearLayers(); if(!S.showRings||S.mode!=='single-site'||!S.siteCoords)return;
  [50,100,150,200].forEach(km=>{
    L.circle(S.siteCoords,{radius:km*1000,color:'rgba(255,255,255,.15)',fillOpacity:0,weight:1,dashArray:'4 6'}).addTo(S.ringsGrp);
    L.marker(L.latLng(S.siteCoords[0]+km/111.1,S.siteCoords[1]),{icon:L.divIcon({html:`<span style="font-size:9px;color:rgba(255,255,255,.24);font-family:var(--mo);white-space:nowrap">${km}km</span>`,className:'',iconAnchor:[0,6]})}).addTo(S.ringsGrp);
  });
}
function selectSite(id,coords,name){
  $('btn-global').classList.remove('active'); $('btn-single').classList.add('active');
  $('prod-sec').style.display=''; $('site-sec').style.display='';
  $('sel-card').style.display='flex'; $('sel-id').textContent=id; $('sel-nm').textContent=name||id;
  $('site-inp').value=''; $('site-results').classList.remove('open');
  loadSite(id,coords,name);
}

// ─── DRAW ──────────────────────────────────────────────────────
function startDraw(){ S.drawing=true;S.drawPts=[];$('draw-banner').style.display='flex';$('watch-modal').style.display='none';S.map.getContainer().classList.add('draw-cursor');if(S.drawLine){S.map.removeLayer(S.drawLine);S.drawLine=null;}if(S.drawPoly){S.map.removeLayer(S.drawPoly);S.drawPoly=null;}updDraw(); }
function cancelDraw(){ S.drawing=false;S.drawPts=[];$('draw-banner').style.display='none';S.map.getContainer().classList.remove('draw-cursor');if(S.drawLine){S.map.removeLayer(S.drawLine);S.drawLine=null;}if(S.drawPoly){S.map.removeLayer(S.drawPoly);S.drawPoly=null;}$('watch-modal').style.display='flex'; }
function finishDraw(){ if(S.drawPts.length<3)return; S.pendingPoly=[...S.drawPts];S.drawing=false;$('draw-banner').style.display='none';S.map.getContainer().classList.remove('draw-cursor');if(S.drawLine){S.map.removeLayer(S.drawLine);S.drawLine=null;}$('poly-status').textContent=`✓ ${S.pendingPoly.length} vertices defined`;$('poly-status').className='poly-status ok';$('watch-modal').style.display='flex'; }
function updDraw(){ const n=S.drawPts.length;$('db-pts').textContent=`${n} pt${n!==1?'s':''} — ${n<3?`need ${3-n} more`:'ready'}`;$('draw-done').disabled=n<3; }
function addPt(ll){
  S.drawPts.push([ll.lat,ll.lng]);
  const c=$('wt-color')?.value||'#FF0000';
  if(S.drawLine)S.map.removeLayer(S.drawLine);
  if(S.drawPoly)S.map.removeLayer(S.drawPoly);
  if(S.drawPts.length>=2)S.drawLine=L.polyline(S.drawPts,{color:c,weight:2,dashArray:'5 4',opacity:.9}).addTo(S.map);
  if(S.drawPts.length>=3)S.drawPoly=L.polygon(S.drawPts,{color:c,fillColor:c,fillOpacity:.13,weight:2}).addTo(S.map);
  updDraw();
}
function issueWatch(){
  const type=$('wt-type').value;
  const title=$('wt-title').value.trim();
  const dur=parseInt($('wt-dur').value)||2;
  const color=$('wt-color').value||WATCH_COLORS[type]||'#FF0000';
  const desc=$('wt-desc').value.trim();
  const err=$('wm-err'); err.style.display='none';
  if(!title){err.textContent='Enter a title/headline.';err.style.display='';return;}
  if(!S.pendingPoly||S.pendingPoly.length<3){err.textContent='Draw the watch area first.';err.style.display='';return;}
  addWatch({id:'kw-'+Date.now()+'-'+Math.random().toString(36).slice(2,6),type,title,color,poly:S.pendingPoly,issued:Date.now(),exp:Date.now()+dur*3600000,desc});
  S.pendingPoly=null;
  $('watch-modal').style.display='none';
  $('poly-status').textContent='⚠ Draw the watch area first'; $('poly-status').className='poly-status';
  $('wt-title').value=''; $('wt-desc').value='';
  renderKabeb();
  if(S.drawPoly){S.map.removeLayer(S.drawPoly);S.drawPoly=null;}
  if(S.drawLine){S.map.removeLayer(S.drawLine);S.drawLine=null;}
}

// ─── MAP INIT ──────────────────────────────────────────────────
function initMap(){
  S.map=L.map('map',{center:[38,-97],zoom:4,zoomControl:false,attributionControl:true,preferCanvas:true});
  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png',{subdomains:'abcd',maxZoom:20,attribution:'© OpenStreetMap © CARTO'}).addTo(S.map);
  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}{r}.png',{subdomains:'abcd',maxZoom:20,attribution:'',zIndex:300}).addTo(S.map);
  L.control.zoom({position:'bottomright'}).addTo(S.map);
  S.spcGrp=L.layerGroup().addTo(S.map);
  S.nwsGrp=L.layerGroup().addTo(S.map);
  S.kabebGrp=L.layerGroup().addTo(S.map);
  S.markGrp=L.layerGroup().addTo(S.map);
  S.ringsGrp=L.layerGroup().addTo(S.map);
  S.map.on('click',e=>{ if(S.drawing)addPt(e.latlng); });
  S.map.on('contextmenu',e=>{
    if(!S.drawing||!S.drawPts.length)return;
    S.drawPts.pop();
    const c=$('wt-color')?.value||'#FF0000';
    if(S.drawLine)S.map.removeLayer(S.drawLine);
    if(S.drawPoly)S.map.removeLayer(S.drawPoly);
    if(S.drawPts.length>=2)S.drawLine=L.polyline(S.drawPts,{color:c,weight:2,dashArray:'5 4',opacity:.9}).addTo(S.map);
    if(S.drawPts.length>=3)S.drawPoly=L.polygon(S.drawPts,{color:c,fillColor:c,fillOpacity:.13,weight:2}).addTo(S.map);
    updDraw();
  });
}

// ─── SEARCH ────────────────────────────────────────────────────
function setupSearch(){
  const inp=$('site-inp'), res=$('site-results');
  inp.oninput=()=>{
    const q=inp.value.trim().toLowerCase(); if(!q){res.classList.remove('open');return;}
    const m=SITES.filter(s=>s.id.toLowerCase().includes(q)||s.name.toLowerCase().includes(q)).slice(0,12);
    res.innerHTML=''; if(!m.length){res.classList.remove('open');return;}
    m.forEach(s=>{const d=document.createElement('div');d.className='sr-item';d.innerHTML=`<span class="sr-id">${s.id}</span><span class="sr-nm">${s.name}</span>`;d.onclick=()=>selectSite(s.id,[s.lat,s.lon],s.name);res.appendChild(d);});
    res.classList.add('open');
  };
  inp.onblur=()=>setTimeout(()=>res.classList.remove('open'),200);
}

// ─── CLOCK ─────────────────────────────────────────────────────
function startClock(){
  setInterval(()=>{
    const n=new Date();
    $('utc-clock').textContent=`${pad(n.getUTCHours())}:${pad(n.getUTCMinutes())}:${pad(n.getUTCSeconds())}`;
    const pp=$('pp-time');if(pp){const h=n.getHours(),m=n.getMinutes(),ap=h>=12?'PM':'AM',h12=h%12||12;pp.textContent=`${pad(h12)}:${pad(m)} ${ap} CDT`;}
  },1000);
}

// ─── SIDEBAR PANEL POSITIONS ───────────────────────────────────
function updatePanelPositions(){
  const sb=S.sidebarOpen, offset=sb?`calc(var(--sw) + 12px)`:'12px';
  const wp=$('wp'), kwp=$('kwp');
  if(wp.style.display!=='none') wp.style.left=offset;
  if(kwp.style.display!=='none') kwp.style.left=offset;
}

// ─── MAIN ──────────────────────────────────────────────────────
window.onload=()=>{
  loadPrefs(); loadUser(); initMap(); startClock(); setupSearch();

  $('op-sl').value=Math.round(S.opacity*100);
  $('op-val').textContent=Math.round(S.opacity*100)+'%';
  $('spd-sel').value=S.speed;
  $('t-nws').className='tog '+(S.showNws?'on':'off');
  $('t-spc').className='tog '+(S.showSpc?'on':'off');
  $('t-kab').className='tog '+(S.showKabeb?'on':'off');

  // Sidebar
  $('sb-tog').onclick=()=>{
    S.sidebarOpen=!S.sidebarOpen;
    $('sidebar').classList.toggle('hidden',!S.sidebarOpen);
    const btn=$('sb-tog'); btn.classList.toggle('closed',!S.sidebarOpen);
    btn.textContent=S.sidebarOpen?'◀':'▶'; btn.style.left=S.sidebarOpen?'var(--sw)':'0';
    updatePanelPositions();
  };

  // Mode buttons
  $('btn-global').onclick=()=>{
    $('btn-global').classList.add('active'); $('btn-single').classList.remove('active');
    $('prod-sec').style.display='none'; $('site-sec').style.display='none';
    loadGlobal();
  };
  $('btn-single').onclick=()=>{
    $('btn-global').classList.remove('active'); $('btn-single').classList.add('active');
    $('prod-sec').style.display=''; $('site-sec').style.display='';
    if(S.site)loadSite(S.site,S.siteCoords,S.siteName);
    else{ S.mode='single-site'; pause(); updateBadge(); }
  };

  // Products
  document.querySelectorAll('.prod-btn').forEach(b=>{
    b.onclick=()=>{ document.querySelectorAll('.prod-btn').forEach(x=>x.classList.remove('active')); b.classList.add('active'); S.product=b.dataset.p; if(S.site&&S.mode==='single-site')loadSite(S.site,S.siteCoords,S.siteName); updateBadge(); };
  });

  // Clear site
  $('clear-site').onclick=()=>{ S.site=null;S.siteCoords=null;S.siteName=''; $('sel-card').style.display='none'; $('site-inp').value=''; };

  // Opacity
  $('op-sl').oninput=e=>{ S.opacity=e.target.value/100; $('op-val').textContent=e.target.value+'%'; setOp(S.opacity); savePrefs(); };

  // Toggles
  const mkT=(id,key,cb)=>{ $(id).onclick=function(){ S[key]=!S[key]; this.className='tog '+(S[key]?'on':'off'); cb(); savePrefs(); }; };
  mkT('t-nws','showNws',renderNWS);
  mkT('t-spc','showSpc',()=>{ if(S.showSpc)fetchSPC(); else{ S.spcGrp.clearLayers(); renderSPCLegend(false); } });
  mkT('t-kab','showKabeb',renderKabeb);
  mkT('t-rings','showRings',renderRings);
  mkT('t-mrkrs','showMarkers',renderMarkers);

  // Timeline
  $('tl-play').onclick=togglePlay;
  $('tl-prev').onclick=()=>{pause();showFrame(getIdx()-1);};
  $('tl-next').onclick=()=>{pause();showFrame(getIdx()+1);};
  $('spd-sel').onchange=e=>{ S.speed=parseInt(e.target.value); if(S.playing){pause();play();} savePrefs(); };

  // Login
  let authMode='login';
  $('login-btn').onclick=()=>{ $('m-err').style.display='none'; $('login-modal').style.display='flex'; };
  $('m-close').onclick=()=>$('login-modal').style.display='none';
  $('login-modal').onclick=e=>{ if(e.target.id==='login-modal')$('login-modal').style.display='none'; };
  $('tab-in').onclick=()=>{ authMode='login'; $('tab-in').classList.add('active'); $('tab-reg').classList.remove('active'); $('m-go').textContent='SIGN IN'; };
  $('tab-reg').onclick=()=>{ authMode='register'; $('tab-reg').classList.add('active'); $('tab-in').classList.remove('active'); $('m-go').textContent='CREATE ACCOUNT'; };
  $('m-go').onclick=()=>{
    const email=$('m-email').value.trim(), pass=$('m-pass').value, err=$('m-err'); err.style.display='none';
    if(!email||!pass){err.textContent='Email and password required.';err.style.display='';return;}
    if(authMode==='login'){ const u=tryLogin(email,pass); if(!u){err.textContent='Invalid email or password.';err.style.display='';return;} setUser(u); $('login-modal').style.display='none'; }
    else{ if(pass.length<6){err.textContent='Password must be 6+ characters.';err.style.display='';return;} const r=tryRegister(email,pass); if(!r.ok){err.textContent=r.msg;err.style.display='';return;} setUser(r.user); $('login-modal').style.display='none'; }
  };
  $('m-pass').onkeydown=e=>{ if(e.key==='Enter')$('m-go').click(); };
  $('m-email').onkeydown=e=>{ if(e.key==='Enter')$('m-pass').focus(); };

  // User menu
  $('user-btn')?.addEventListener('click',()=>{ const dd=$('user-dd'); dd.style.display=dd.style.display==='none'?'':'none'; });
  $('dd-signout').onclick=()=>{ setUser(null); $('user-dd').style.display='none'; };
  document.addEventListener('click',e=>{ if(!e.target.closest('#user-wrap')&&!e.target.closest('#user-btn')&&!e.target.closest('#user-dd'))$('user-dd').style.display='none'; });

  // NWS panel
  $('nws-chip').onclick=()=>{ if(S.nwsWarnings.length){S.wpWarnings=[...S.nwsWarnings];showWP(0);} };
  $('wp-x').onclick=()=>$('wp').style.display='none';
  $('wp-more').onclick=()=>showWP((S.wpIdx+1)%S.wpWarnings.length);

  // Kabeb watch panel
  $('kab-chip').onclick=()=>{ if(getWatches().length)showKWP(S.kwpIdx); };
  $('kwp-x').onclick=()=>$('kwp').style.display='none';
  $('kwp-prev').onclick=()=>{ const w=getWatches(); showKWP((S.kwpIdx-1+w.length)%w.length); };
  $('kwp-next').onclick=()=>{ const w=getWatches(); showKWP((S.kwpIdx+1)%w.length); };

  // Admin / watch modal
  $('btn-issue').onclick=()=>{
    S.pendingPoly=null;
    $('poly-status').textContent='⚠ Draw the watch area first'; $('poly-status').className='poly-status';
    $('wm-err').style.display='none'; $('wt-title').value=''; $('wt-desc').value='';
    $('wt-color').value=WATCH_COLORS[$('wt-type').value]||'#FF0000';
    $('watch-modal').style.display='flex';
  };
  $('btn-clear').onclick=()=>{ clearExpired(); renderKabeb(); };
  $('wt-type').onchange=()=>{ $('wt-color').value=WATCH_COLORS[$('wt-type').value]||'#FF0000'; };
  $('wm-close').onclick=()=>{ $('watch-modal').style.display='none'; cancelDraw(); };
  $('btn-issue-cancel').onclick=()=>{ $('watch-modal').style.display='none'; cancelDraw(); };
  $('watch-modal').onclick=e=>{ if(e.target.id==='watch-modal'){$('watch-modal').style.display='none';cancelDraw();} };
  $('btn-draw-area').onclick=startDraw;
  $('btn-issue-submit').onclick=issueWatch;
  $('draw-done').onclick=finishDraw;
  $('draw-cancel').onclick=cancelDraw;

  // Boot
  renderUserUI();
  loadGlobal();
  fetchNWS();
  fetchSPC();
  renderKabeb();

  setInterval(fetchNWS,60000);
  setInterval(renderKabeb,30000);
  setInterval(fetchSPC,10*60*1000);
  // Silent global refresh every 5 min
  setInterval(async()=>{
    if(S.mode!=='global')return;
    try{ const rv=await fetchRV(); S.rvFrames=[...rv.past,...rv.nowcast].slice(-16); const wp=S.playing; pause(); buildGlobal(); if(wp)play(); }catch(e){}
  },5*60*1000);
};
