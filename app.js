// ================================================================
// KABEB WEATHER RADAR v4.2 — No mosaic, single site + global via RainViewer
// Hard-coded admins — DO NOT CHANGE
// ================================================================
const ADMIN_EMAILS = Object.freeze(['fheh074@gmail.com','kalebgamer0515@gmail.com']);
const isAdmin = e => ADMIN_EMAILS.includes((e||'').toLowerCase().trim());

const WATCH_TYPE_LABELS={TORNADO_WATCH:'TORNADO WATCH',TORNADO_EMERGENCY:'TORNADO EMERGENCY',SVR_WATCH:'SEVERE THUNDERSTORM WATCH',FLASH_FLOOD_WATCH:'FLASH FLOOD WATCH',WINTER_STORM_WATCH:'WINTER STORM WATCH',FIRE_WEATHER_WATCH:'FIRE WEATHER WATCH',HURRICANE_WATCH:'HURRICANE WATCH',SPECIAL_STATEMENT:'SPECIAL STATEMENT'};
const WATCH_COLORS={TORNADO_WATCH:'#FF0000',TORNADO_EMERGENCY:'#FF0040',SVR_WATCH:'#FF6600',FLASH_FLOOD_WATCH:'#00FF7F',WINTER_STORM_WATCH:'#87CEFA',FIRE_WEATHER_WATCH:'#FF4500',HURRICANE_WATCH:'#FF69B4',SPECIAL_STATEMENT:'#4169E1'};

const SPC_CAT=[
  {id:'HIGH',fill:'#ff00ff',stroke:'#cc00cc',fillOp:.45},
  {id:'MDT', fill:'#e03000',stroke:'#aa0000',fillOp:.42},
  {id:'ENH', fill:'#ffa366',stroke:'#cc5500',fillOp:.38},
  {id:'SLGT',fill:'#f6f600',stroke:'#bbbb00',fillOp:.34},
  {id:'MRGL',fill:'#66a366',stroke:'#005500',fillOp:.30},
  {id:'TSTM',fill:'#c5e8c5',stroke:'#669966',fillOp:.22,dash:'5 4'},
];
const SPC_PROB=[
  {pct:60,fill:'#f000ff',stroke:'#c000cc',fillOp:.45},
  {pct:45,fill:'#e03000',stroke:'#aa0000',fillOp:.42},
  {pct:30,fill:'#ff6000',stroke:'#cc4400',fillOp:.38},
  {pct:15,fill:'#ffff00',stroke:'#cccc00',fillOp:.32},
  {pct:10,fill:'#66aa66',stroke:'#004400',fillOp:.28},
  {pct:5, fill:'#55aa55',stroke:'#003300',fillOp:.22},
  {pct:2, fill:'#c5e8c5',stroke:'#669966',fillOp:.18,dash:'5 4'},
];

const NWS_COLORS={'tornado warning':'#FF0000','tornado emergency':'#FF0000','pds tornado':'#FF0000','severe thunderstorm warning':'#FF8C00','flash flood warning':'#00FF7F','flash flood emergency':'#00FF7F','flood warning':'#00CC44','tornado watch':'#FFFF00','severe thunderstorm watch':'#DB7093','winter storm warning':'#87CEFA','blizzard warning':'#87CEFA','high wind warning':'#DAA520','excessive heat warning':'#C71585','hurricane warning':'#DC143C','hurricane watch':'#FF69B4','fire weather watch':'#FF7F00','red flag warning':'#FF4500','dense fog advisory':'#808080','special weather statement':'#FFE4B5'};
function nwsColor(ev){const e=(ev||'').toLowerCase();for(const[k,v] of Object.entries(NWS_COLORS)){if(e.includes(k))return v;}return'#888';}

// ── STATE ──────────────────────────────────────────────────────
const S={
  map:null, mode:'global', product:'REF',
  site:null, siteName:'', siteCoords:null,
  // Global = RainViewer frames
  rvFrames:[], rvIdx:0,
  // Single site = IEM frames
  iemFrames:[], iemIdx:0, iemProd:'N0B',
  // Background preloaded single site
  preloaded:null,
  playing:false, timer:null, speed:450,
  opacity:0.9, showNws:true, showSpc:false, showKabeb:true, showRings:false, showMarkers:true,
  spcDay:1, spcHazard:'CAT',  // spcDay: 1-8 always numeric
  sidebarOpen:true,
  radarLayers:[],
  nwsGrp:null, spcGrp:null, kabebGrp:null, markGrp:null, ringsGrp:null,
  nwsWarnings:[], kabebWatches:[],
  user:null,
  drawing:false, drawPts:[], drawLine:null, drawPoly:null, pendingPoly:null,
  wpWarnings:[], wpIdx:0, kwpIdx:0
};

let _radarGen=0; // incremented each clearRadar to cancel stale loads
let _activeLayer=null;
const $=id=>document.getElementById(id);
function _panelLeft(){
  if(!S.sidebarOpen)return '12px';
  const sb=document.getElementById('sidebar');
  const w=sb?sb.getBoundingClientRect().right:258;
  return(w+12)+'px';
}
const pad=n=>String(n).padStart(2,'0');
function toTs(d){return`${d.getUTCFullYear()}${pad(d.getUTCMonth()+1)}${pad(d.getUTCDate())}${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}`;}
function fmtIso(d){return`${d.getUTCFullYear()}-${pad(d.getUTCMonth()+1)}-${pad(d.getUTCDate())}T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:00Z`;}
function rid(id){const u=(id||'').toUpperCase();return(u.length===4&&u[0]==='K')?u.slice(1):u;}
function timeFmt(exp){const r=exp-Date.now();if(r<=0)return'Expired';const h=Math.floor(r/3600000),m=Math.floor((r%3600000)/60000);return h>0?`${h}h ${m}m`:`${m}m`;}
function haversine(a,b,c,d){const R=6371,dL=(c-a)*Math.PI/180,dO=(d-b)*Math.PI/180,x=Math.sin(dL/2)**2+Math.cos(a*Math.PI/180)*Math.cos(c*Math.PI/180)*Math.sin(dO/2)**2;return R*2*Math.atan2(Math.sqrt(x),Math.sqrt(1-x));}
function nearestSite(lat,lon){let best=null,bestD=1e9;SITES.forEach(s=>{const d=haversine(lat,lon,s.lat,s.lon);if(d<bestD){bestD=d;best=s;}});return best;}

// ── STORAGE ────────────────────────────────────────────────────
function loadPrefs(){try{const d=JSON.parse(localStorage.getItem('kbp')||'{}');if(d.opacity!=null)S.opacity=d.opacity;if(d.speed!=null)S.speed=d.speed;if(d.showNws!=null)S.showNws=d.showNws;if(d.showKabeb!=null)S.showKabeb=d.showKabeb;if(d.site)S.site=d.site;if(d.siteName)S.siteName=d.siteName;if(d.siteCoords)S.siteCoords=d.siteCoords;}catch(e){}}
function savePrefs(){localStorage.setItem('kbp',JSON.stringify({opacity:S.opacity,speed:S.speed,showNws:S.showNws,showKabeb:S.showKabeb,site:S.site,siteName:S.siteName,siteCoords:S.siteCoords}));}
function getWatches(){try{return JSON.parse(localStorage.getItem('kbw')||'[]').filter(w=>w.exp>Date.now());}catch(e){return[];}}
function addWatch(w){const a=JSON.parse(localStorage.getItem('kbw')||'[]');a.push(w);localStorage.setItem('kbw',JSON.stringify(a));}
function removeWatch(id){localStorage.setItem('kbw',JSON.stringify(JSON.parse(localStorage.getItem('kbw')||'[]').filter(w=>w.id!==id)));}
function clearExpired(){localStorage.setItem('kbw',JSON.stringify(JSON.parse(localStorage.getItem('kbw')||'[]').filter(w=>w.exp>Date.now())));}
function getUsers(){try{return JSON.parse(localStorage.getItem('kbu')||'[]');}catch(e){return[];}}
function saveUsers(u){localStorage.setItem('kbu',JSON.stringify(u));}

// ── AUTH ───────────────────────────────────────────────────────
function tryLogin(email,pass){const u=getUsers().find(x=>x.e.toLowerCase()===email.toLowerCase()&&x.p===btoa(pass));return u?{email:u.e,admin:isAdmin(u.e)}:null;}
function tryRegister(email,pass){const u=getUsers();if(u.find(x=>x.e.toLowerCase()===email.toLowerCase()))return{ok:false,msg:'Account already exists'};u.push({e:email,p:btoa(pass)});saveUsers(u);return{ok:true,user:{email,admin:isAdmin(email)}};}
function loadUser(){try{const u=JSON.parse(localStorage.getItem('kbc')||'null');if(u){S.user=u;S.user.admin=isAdmin(u.email);}}catch(e){}}
function setUser(u){S.user=u;if(u)localStorage.setItem('kbc',JSON.stringify(u));else localStorage.removeItem('kbc');renderUserUI();}
function renderUserUI(){
  const lb=$('login-btn'),ua=$('user-wrap'),as=$('admin-sec');
  if(S.user){lb.style.display='none';ua.style.display='';$('u-av').textContent=S.user.email[0].toUpperCase();$('u-av').className='u-av'+(S.user.admin?' admin':'');$('u-name').textContent=S.user.email.split('@')[0];$('u-role').style.display=S.user.admin?'':'none';$('dd-email').textContent=S.user.email;as.style.display=S.user.admin?'':'none';}
  else{lb.style.display='';ua.style.display='none';as.style.display='none';}
}

// ── RAINVIEWER GLOBAL ──────────────────────────────────────────
async function fetchRV(){
  const r=await fetch('https://api.rainviewer.com/public/weather-maps.json',{cache:'no-cache'});
  if(!r.ok)throw new Error('RV');
  const d=await r.json();
  if(d.host)_rvHost=d.host;
  return{past:d.radar.past||[],nowcast:d.radar.nowcast||[]};
}
let _rvHost="https://tilecache.rainviewer.com";
const rvUrl=(ts,path)=>path?`${_rvHost}${path}/256/{z}/{x}/{y}/6/1_1.png`:`${_rvHost}/v2/radar/${ts}/256/{z}/{x}/{y}/6/1_1.png`;

// ── IEM RIDGE SINGLE SITE ─────────────────────────────────────
const PROD_CHAINS={REF:['N0B','N0Q'],VEL:['N0U','N0S'],CC:['N0C','N0X']};
const iemUrl=(r,p,ts)=>`https://mesonet.agron.iastate.edu/cache/tile.py/1.0.0/ridge::${r}-${p}-${ts}/{z}/{x}/{y}.png`;
const iemScanUrl=(r,p,hrs,now)=>`https://mesonet.agron.iastate.edu/json/radar?operation=list&product=${p}&station=${r}&start=${fmtIso(new Date(now-hrs*3600000))}&end=${fmtIso(now)}`;

async function fetchIemScans(siteId,product){
  const r=rid(siteId);
  const chain=PROD_CHAINS[product]||[product];
  const now=new Date();
  function parseTs(s){
    let v=s.utc_valid||s.valid||s.ts||'';
    if(!v)return null;
    v=v.replace(' ','T').replace(/[+-][0-9]{2}:?[0-9]{0,2}$/,'Z');
    if(!v.endsWith('Z'))v+='Z';
    try{const d=new Date(v);return(isNaN(d)||d.getFullYear()<2000)?null:toTs(d);}catch(e){return null;}
  }
  async function tryFetch(url){
    // IEM has CORS headers but try direct first, then proxy as fallback
    const attempts=[url,'https://corsproxy.io/?url='+encodeURIComponent(url)];
    for(const u of attempts){
      try{
        const ctrl=new AbortController();setTimeout(()=>ctrl.abort(),8000);
        const res=await fetch(u,{signal:ctrl.signal});
        if(!res.ok)continue;
        const data=await res.json();
        if(data&&(data.data||data.scans||data.results))return data;
      }catch(e){}
    }
    return null;
  }
  for(const p of chain){
    for(const hrs of [3,6]){
      const url=`https://mesonet.agron.iastate.edu/json/radar?operation=list&product=${p}&station=${r}&start=${fmtIso(new Date(now-hrs*3600000))}&end=${fmtIso(now)}`;
      try{
        const data=await tryFetch(url);
        if(!data)continue;
        const rows=data.data||data.scans||data.results||[];
        const tss=[...new Set(rows.map(parseTs).filter(Boolean))].sort();
        if(tss.length){console.log(`IEM: ${r} ${p} ${hrs}h → ${tss.length} frames`);return{frames:tss.slice(-14),product:p,ok:true};}
      }catch(e){console.warn('IEM fetch error:',e.message);}
    }
  }
  return{frames:[],product:chain[0],ok:false};
}

// ── LAYERS ─────────────────────────────────────────────────────
function clearRadar(){
  _radarGen++;
  if(_activeLayer){try{S.map.removeLayer(_activeLayer);}catch(e){}}_activeLayer=null;
  (S.radarLayers||[]).forEach(l=>{if(l)try{S.map.removeLayer(l);}catch(e){}});
  S.radarLayers=[];
}

function makeRvTile(ts,op,path){
  return L.tileLayer(rvUrl(ts,path),{opacity:op,tileSize:256,zoomOffset:0,zIndex:200,maxNativeZoom:12,maxZoom:18,attribution:'',crossOrigin:true,keepBuffer:4,updateWhenZooming:false,updateWhenIdle:false});
}
function makeIemSiteTile(r,p,ts,op){
  return L.tileLayer(iemUrl(r,p,ts),{opacity:op,tileSize:256,zoomOffset:0,zIndex:200,maxNativeZoom:10,maxZoom:18,attribution:'',crossOrigin:true,keepBuffer:6,updateWhenZooming:false,updateWhenIdle:false});
}

function getN(){return S.mode==='global'?S.rvFrames.length:S.iemFrames.length;}
function getIdx(){return S.mode==='global'?S.rvIdx:S.iemIdx;}
function setIdx(i){if(S.mode==='global')S.rvIdx=i;else S.iemIdx=i;}

// ── RADAR — single active layer, swap on frame change ─────────
// Only ONE tile layer is on the map at a time → no request flooding.
// Adjacent frames are pre-warmed via Image() so browser caches tiles.
function _tileUrl(idx){
  if(S.mode==='global'&&S.rvFrames[idx]){
    const f=S.rvFrames[idx];
    return f.path
      ?`${_rvHost}${f.path}/256/{z}/{x}/{y}/6/1_1.png`
      :`${_rvHost}/v2/radar/${f.time}/256/{z}/{x}/{y}/6/1_1.png`;
  }
  if(S.mode==='single-site'&&S.iemFrames[idx]){
    const r=rid(S.site),p=S.iemProd,ts=S.iemFrames[idx];
    return `https://mesonet.agron.iastate.edu/cache/tile.py/1.0.0/ridge::${r}-${p}-${ts}/{z}/{x}/{y}.png`;
  }
  return null;
}

function _prewarm(idx){
  // Hit a few sample tile coords at current map zoom to seed browser cache
  const url=_tileUrl(idx);if(!url)return;
  const z=Math.min(S.map.getZoom(),10);
  const c=S.map.getCenter();
  const n=Math.pow(2,z);
  const tx=Math.floor((c.lng+180)/360*n);
  const ty=Math.floor((1-Math.log(Math.tan(c.lat*Math.PI/180)+1/Math.cos(c.lat*Math.PI/180))/Math.PI)/2*n);
  [[tx,ty],[tx+1,ty],[tx,ty+1],[tx-1,ty],[tx,ty-1]].forEach(([x,y])=>{
    const u=url.replace('{z}',z).replace('{x}',x).replace('{y}',y);
    const img=new Image();img.src=u;
  });
}

function _swapLayer(idx){
  const url=_tileUrl(idx);if(!url)return;
  if(_activeLayer){try{S.map.removeLayer(_activeLayer);}catch(e){}}
  _activeLayer=L.tileLayer(url,{
    opacity:S.opacity,tileSize:256,zoomOffset:0,zIndex:200,
    maxNativeZoom:12,maxZoom:18,attribution:'',
    crossOrigin:true,keepBuffer:8,
    updateWhenZooming:false,updateWhenIdle:false
  });
  _activeLayer.addTo(S.map);
}

function buildGlobal(){
  _activeLayer=null;clearRadar();
  if(!S.rvFrames.length)return;
  _swapLayer(S.rvIdx);
  // Pre-warm adjacent frames
  const n=S.rvFrames.length;
  for(let d=1;d<=3;d++){
    _prewarm((S.rvIdx+d)%n);
    _prewarm((S.rvIdx-d+n)%n);
  }
  renderTL();
}

function buildSite(){
  _activeLayer=null;clearRadar();
  if(!S.iemFrames.length||!S.site)return;
  _swapLayer(S.iemIdx);
  const n=S.iemFrames.length;
  for(let d=1;d<=3;d++){
    _prewarm((S.iemIdx+d)%n);
    _prewarm((S.iemIdx-d+n)%n);
  }
  renderTL();
}

function showFrame(idx){
  const n=getN();if(!n)return;
  const next=Math.max(0,Math.min(n-1,idx));
  setIdx(next);
  _swapLayer(next);
  // Pre-warm next frame
  _prewarm((next+1)%n);
  _prewarm((next-1+n)%n);
  renderTL();
}
function setOp(v){S.opacity=v;if(_activeLayer)_activeLayer.setOpacity(v);}

// ── ANIMATION ──────────────────────────────────────────────────
function play(){if(S.timer)clearInterval(S.timer);S.playing=true;$('tl-play').textContent='⏸';$('tl-play').classList.add('playing');S.timer=setInterval(()=>{const n=getN();if(n)showFrame((getIdx()+1)%n);},S.speed);}
function pause(){if(S.timer){clearInterval(S.timer);S.timer=null;}S.playing=false;$('tl-play').textContent='▶';$('tl-play').classList.remove('playing');}
function togglePlay(){S.playing?pause():play();}

// ── TIMELINE ───────────────────────────────────────────────────
function renderTL(){
  const track=$('tl-track'),idx=getIdx();
  let labels=[];
  if(S.mode==='global'){
    labels=S.rvFrames.map(f=>{const d=new Date(f.time*1000);return`${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;});
  }else{
    labels=S.iemFrames.map(ts=>`${ts.slice(8,10)}:${ts.slice(10,12)}`);
  }
  track.innerHTML='';
  labels.forEach((lbl,i)=>{
    const d=document.createElement('div');d.className='tl-dot'+(i===idx?' on':'');
    d.textContent=lbl;d.onclick=()=>{pause();showFrame(i);};track.appendChild(d);
  });
  $('tl-frame').textContent=labels.length?`Frame ${idx+1}/${labels.length}`:'—';
  $('tl-time').textContent=labels[idx]||'—';
}

// ── LOAD GLOBAL (RainViewer only, no mosaic) ───────────────────
async function loadGlobal(){
  pause();S.mode='global';
  $('prod-sec').style.display='none';
  $('site-sec').style.display='none';
  $('btn-global').classList.add('active');
  $('btn-single').classList.remove('active');
  S.map.setView([38,-97],4,{animate:true});
  updateBadge();updatePP();renderRings();
  setStatus('loading','Fetching global radar…');setLoading(true,'Loading global radar…');
  try{
    const rv=await fetchRV();
    const all=[...rv.past,...rv.nowcast].slice(-16);
    if(!all.length)throw new Error('no frames');
    S.rvFrames=all;
    S.rvIdx=rv.past.length-1;if(S.rvIdx<0)S.rvIdx=S.rvFrames.length-1;
    buildGlobal();
    setStatus('ok',`Global · ${S.rvFrames.length} frames`);
    setLoading(false);renderMarkers();
    $('prod-sec').style.display='none';$('site-sec').style.display='none';
    showFrame(S.rvIdx); // show latest frame, NO autoplay
  }catch(e){
    setStatus('error','Global radar unavailable');
    setLoading(false);
  }
}

// ── LOAD SINGLE SITE ───────────────────────────────────────────
async function loadSite(siteId,coords,name,preloadedData){
  pause();
  S.mode='single-site';S.site=siteId;S.siteCoords=coords;S.siteName=name||siteId;
  $('btn-global').classList.remove('active');$('btn-single').classList.add('active');
  $('prod-sec').style.display='';$('site-sec').style.display='';
  $('sel-card').style.display='flex';$('sel-id').textContent=siteId;$('sel-nm').textContent=name||siteId;
  $('site-inp').value='';$('site-results').classList.remove('open');
  S.map.setView(coords,8,{animate:true});
  renderRings();updateBadge();updatePP();savePrefs();

  // Use preloaded data only if product matches what user selected
  const wantedProd=PROD_CHAINS[S.product]?.[0]||'N0B';
  const preloadMatch=preloadedData&&preloadedData.siteId===siteId&&
    preloadedData.frames?.length>0&&preloadedData.product===wantedProd;
  if(preloadMatch){
    S.iemFrames=preloadedData.frames;S.iemIdx=preloadedData.frames.length-1;S.iemProd=preloadedData.product;
    buildSite();setStatus('ok',`${siteId} · ${preloadedData.product} · ${preloadedData.frames.length} scans`);
    setLoading(false);showFrame(S.iemIdx);return;
  }

  // Fresh fetch
  setStatus('loading',`${siteId} · fetching scans…`);setLoading(true,`${siteId} — loading ${S.product}…`);
  const iemProd=PROD_CHAINS[S.product]?.[0]||'N0B';
  const res=await fetchIemScans(siteId,iemProd);
  S.iemProd=res.product;
  if(res.ok&&res.frames.length>0){
    S.iemFrames=res.frames;S.iemIdx=res.frames.length-1;
    buildSite();
    setStatus('ok',`${siteId} · ${res.product} · ${res.frames.length} scans`);
    setLoading(false);updateBadge();updatePP();
    showFrame(S.iemIdx); // NO autoplay
  }else{
    S.iemFrames=[];clearRadar();
    setStatus('error',`${siteId} · No ${S.product} data`);setLoading(false);
  }
}

// Background preload (silent, no UI changes)
async function bgPreload(siteId,coords,name,product){
  if(!siteId)return;
  const iemProd=PROD_CHAINS[product||'REF']?.[0]||'N0B';
  try{
    const res=await fetchIemScans(siteId,iemProd);
    if(res.ok&&res.frames.length>0)S.preloaded={siteId,frames:res.frames,product:res.product,coords,name};
  }catch(e){}
}

// ── STATUS / LOADING ───────────────────────────────────────────
function setStatus(t,txt){$('radar-status').className='status-row '+t;$('s-txt').textContent=txt;}
function setLoading(on,txt){$('loading-bar').style.display=on?'flex':'none';if(txt)$('ld-txt').textContent=txt;}

// ── BADGE + PRODUCT PANEL ──────────────────────────────────────
function updateBadge(){
  const PC={REF:'rgba(0,212,255,.26)',VEL:'rgba(168,85,247,.26)',CC:'rgba(0,255,128,.22)'};
  const PL={REF:'REF',VEL:'VEL',CC:'CC'};
  const badge=$('center-badge'),bt=$('badge-txt'),bp=$('badge-prod');
  if(S.mode==='global'){badge.style.borderColor='rgba(0,212,255,.26)';bt.textContent='GLOBAL MOSAIC';bp.style.display='none';}
  else{badge.style.borderColor=PC[S.product]||'rgba(0,212,255,.26)';bt.textContent=S.site?`${S.site} · ${PL[S.product]||S.product}`:'SINGLE SITE';bp.textContent=PL[S.product]||S.product;bp.style.display='';}
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
    const site=SITES.find(x=>x.id===S.site);const parts=(site?.name||'').split(' ');
    stEl.textContent=parts[parts.length-1]||'';stEl.style.display='';
  }else{$('pp-stn').textContent='GLOBAL';stEl.textContent='';stEl.style.display='none';}
}

// ── SPC OUTLOOKS D1–D8 ────────────────────────────────────────
// D1/D2/D3 have CAT + individual hazard products
// D4-D8 all use the combined day4-8 product, filtered by DAY property
const SPC_URLS={
  '1_CAT': 'https://www.spc.noaa.gov/products/outlook/day1otlk_cat.nolyr.geojson',
  '1_TOR': 'https://www.spc.noaa.gov/products/outlook/day1probotlk_torn.lyr.geojson',
  '1_WIND':'https://www.spc.noaa.gov/products/outlook/day1probotlk_wind.lyr.geojson',
  '1_HAIL':'https://www.spc.noaa.gov/products/outlook/day1probotlk_hail.lyr.geojson',
  '2_CAT': 'https://www.spc.noaa.gov/products/outlook/day2otlk_cat.nolyr.geojson',
  '2_TOR': 'https://www.spc.noaa.gov/products/outlook/day2probotlk_torn.lyr.geojson',
  '2_WIND':'https://www.spc.noaa.gov/products/outlook/day2probotlk_wind.lyr.geojson',
  '2_HAIL':'https://www.spc.noaa.gov/products/outlook/day2probotlk_hail.lyr.geojson',
  '3_CAT': 'https://www.spc.noaa.gov/products/outlook/day3otlk_cat.nolyr.geojson',
  '3_TOR': 'https://www.spc.noaa.gov/products/outlook/day3otlk_torn.lyr.geojson',
  '3_WIND':'https://www.spc.noaa.gov/products/outlook/day3otlk_wind.lyr.geojson',
  '3_HAIL':'https://www.spc.noaa.gov/products/outlook/day3otlk_hail.lyr.geojson',
  '4_8':   'https://www.spc.noaa.gov/products/outlook/day4-8otlk.lyr.geojson',
};
// Days that use categorical labels vs probability values
const SPC_PROB_DAYS=[3,4,5,6,7,8]; // D3-D8 all show probability-style
const SPC_HAZ_DAYS=[1,2,3];        // D1-D3 have TOR/WIND/HAIL buttons

function _spcPct(props){
  // SPC uses DN (authoritative numeric) or LABEL (may include %)
  const dn=props?.DN;
  if(dn!=null){const n=parseInt(dn);if(!isNaN(n))return n;}
  const raw=String(props?.LABEL||'').replace('%','').trim();
  const n=parseInt(raw);return isNaN(n)?-1:n;
}

async function _spcFetch(url){
  // SPC has no CORS headers — try proxies in order
  const attempts=[
    url, // direct (may work on some servers/extensions)
    'https://corsproxy.io/?url='+encodeURIComponent(url),
    'https://api.allorigins.win/raw?url='+encodeURIComponent(url),
    'https://thingproxy.freeboard.io/fetch/'+url,
  ];
  for(const u of attempts){
    try{
      const ctrl=new AbortController();setTimeout(()=>ctrl.abort(),9000);
      const res=await fetch(u,{signal:ctrl.signal,cache:'no-cache'});
      if(!res.ok)continue;
      const text=await res.text();
      if(!text||text.startsWith('Host not'))continue;
      const data=JSON.parse(text);
      if(data?.features?.length)return data;
    }catch(e){}
  }
  return null;
}

async function fetchSPC(){
  S.spcGrp.clearLayers();
  const legEl=document.getElementById('spc-legend');
  if(!S.showSpc){if(legEl)legEl.style.display='none';return;}
  const d=S.spcDay;
  const isD48=(d>=4);
  // Determine URL
  let url;
  if(isD48) url=SPC_URLS['4_8'];
  else url=SPC_URLS[`${d}_${S.spcHazard}`]||SPC_URLS[`${d}_CAT`];
  if(!url)return;
  try{
    const data=await _spcFetch(url);
    if(!data)throw new Error('all proxies failed');
    let features=data.features||[];
    // For D4-D8 filter by DAY property if it exists
    if(isD48){
      const hasDayProp=features.some(f=>f.properties?.DAY!=null);
      if(hasDayProp)features=features.filter(f=>parseInt(f.properties.DAY)===d);
    }
    if(!features.length){console.warn('SPC: no features for D'+d+' '+S.spcHazard);renderSPCLegend();return;}
    const isProb = isD48 || S.spcHazard !== 'CAT'; // any hazard-specific = probability
    const isCat=!isProb;
    if(isCat){
      // Categorical: TSTM MRGL SLGT ENH MDT HIGH
      ['TSTM','MRGL','SLGT','ENH','MDT','HIGH'].forEach(lbl=>{
        const cfg=SPC_CAT.find(c=>c.id===lbl);if(!cfg)return;
        features.filter(f=>{
          const l=(f.properties?.LABEL||f.properties?.LABEL2||'').toUpperCase();
          return l===lbl||l.includes(lbl);
        }).forEach(f=>{
          try{L.geoJSON(f,{style:{color:cfg.stroke,fillColor:cfg.fill,fillOpacity:cfg.fillOp,weight:1.8,opacity:.9,dashArray:cfg.dash||null},
            onEachFeature(_,lay){lay.bindTooltip(`SPC D${d}: ${lbl}`,{sticky:true});}}).addTo(S.spcGrp);}catch(e){}
        });
      });
    }else{
      // Probability: render from lowest to highest, highest on top
      const hazName=isD48?'SEVERE':{TOR:'TOR',WIND:'WIND',HAIL:'HAIL',CAT:'SEVERE'}[S.spcHazard]||'SEVERE';
      [...SPC_PROB].reverse().forEach(cfg=>{
        features.filter(f=>_spcPct(f.properties)===cfg.pct).forEach(f=>{
          try{
            const isSig=(f.properties?.LABEL2||'').toUpperCase()==='SIGN';
            const tip=isD48?`SPC D${d}: ${cfg.pct}% severe`:`SPC D${d} ${hazName}: ${cfg.pct}%${isSig?' (SIG)':''}`;
            L.geoJSON(f,{style:{color:cfg.stroke,fillColor:cfg.fill,fillOpacity:cfg.fillOp,weight:isSig?2.5:1.8,opacity:.9,dashArray:isSig?'4 3':(cfg.dash||null)},
              onEachFeature(_,lay){lay.bindTooltip(tip,{sticky:true});}}).addTo(S.spcGrp);
          }catch(e){}
        });
      });
    }
    renderSPCLegend();
  }catch(e){console.warn('SPC:',e.message);renderSPCLegend();}
}

function renderSPCLegend(){
  let el=document.getElementById('spc-legend');
  if(!el){el=document.createElement('div');el.id='spc-legend';document.body.appendChild(el);}
  if(!S.showSpc){el.style.display='none';return;}
  const d=S.spcDay;
  const isD48=d>=4;
  const isProb=isD48||S.spcHazard!=='CAT';
  const hazLabel={CAT:'CAT',TOR:'TOR',WIND:'WIND',HAIL:'HAIL'}[S.spcHazard]||'';
  const title=isD48?`SPC D${d} SEVERE PROB`:(isProb?`SPC D${d} ${hazLabel} PROB`:`SPC D${d} CATEGORICAL`);
  const items=isProb?[...SPC_PROB].filter(c=>c.pct>=5):SPC_CAT.filter(c=>c.id!=='TSTM').reverse();
  el.innerHTML=`<div class="spc-lg-title">${title}</div>`+
    items.map(c=>`<div class="spc-lg-row"><div class="spc-lg-sw" style="background:${c.fill};border:1px solid ${c.stroke}80"></div><span class="spc-lg-lbl">${isProb?c.pct+'%':c.id}</span></div>`).join('');
  el.style.display='block';
}

function updateSpcDayUI(){
  document.querySelectorAll('.spc-day-btn').forEach(b=>b.classList.toggle('active',parseInt(b.dataset.day)===S.spcDay));
  // Show hazard row only for D1-D3
  const hazSec=document.getElementById('spc-haz-sec');
  if(hazSec)hazSec.style.display=SPC_HAZ_DAYS.includes(S.spcDay)?'':'none';
  document.querySelectorAll('.spc-haz-btn').forEach(b=>b.classList.toggle('active',b.dataset.haz===S.spcHazard));
}

// ── NWS ────────────────────────────────────────────────────────
const NWS_PRIO=['tornado emergency','tornado warning','severe thunderstorm warning','flash flood emergency','flash flood warning'];
function warnPrio(ev){const e=(ev||'').toLowerCase();for(let i=0;i<NWS_PRIO.length;i++){if(e.includes(NWS_PRIO[i]))return NWS_PRIO.length-i;}return 0;}

async function fetchNWS(){
  try{
    const r=await fetch('https://api.weather.gov/alerts/active?status=actual&message_type=alert');
    if(!r.ok)return;
    const d=await r.json();
    S.nwsWarnings=(d.features||[]).sort((a,b)=>warnPrio(b.properties?.event)-warnPrio(a.properties?.event));
    renderNWS();updateChips();
    const top=S.nwsWarnings[0];
    // Show warning panel for any active warning (not just tornado)
    if(top&&warnPrio(top.properties?.event)>=1){
      S.wpWarnings=[...S.nwsWarnings];
      if($('wp').style.display==='none')showWP(0); // only auto-pop if not already open
    }
    // Background preload nearest site to worst warning
    const topGeo=S.nwsWarnings.find(f=>f.geometry);
    if(topGeo?.geometry?.coordinates){
      try{
        const raw=topGeo.geometry.type==='Polygon'?topGeo.geometry.coordinates[0]:topGeo.geometry.coordinates[0]?.[0];
        if(raw?.length){let lat=0,lon=0;raw.forEach(([lo,la])=>{lat+=la;lon+=lo;});lat/=raw.length;lon/=raw.length;const site=nearestSite(lat,lon);if(site&&site.id!==S.site)bgPreload(site.id,[site.lat,site.lon],site.name,'REF');}
      }catch(e){}
    }
  }catch(e){}
}
function renderNWS(){
  S.nwsGrp.clearLayers();if(!S.showNws)return;
  S.nwsWarnings.forEach((f,idx)=>{
    const p=f.properties||{},color=nwsColor(p.event||'');
    try{if(f.geometry?.type){L.geoJSON(f,{style:{color,fillColor:color,fillOpacity:0.14,weight:1.8,opacity:.88},onEachFeature(_,lay){lay.on('click',()=>{S.wpWarnings=[...S.nwsWarnings];showWP(idx);});}}).addTo(S.nwsGrp);}}catch(e){}
  });
}

// ── NWS WARNING PANEL ──────────────────────────────────────────
function showWP(idx){
  const wp=$('wp');
  if(!S.wpWarnings.length||idx<0||idx>=S.wpWarnings.length){wp.style.display='none';return;}
  const w=S.wpWarnings[idx];S.wpIdx=idx;
  const p=w.properties||{},ev=(p.event||'').toLowerCase();
  const params=p.parameters||{};
  const torDet=(params.tornadoDetection?.[0]||'').toUpperCase();
  const isEmergency=ev.includes('tornado emergency')||
    (p.headline||'').toLowerCase().includes('tornado emergency')||
    (params.tornadoTags||[]).some(t=>t.toLowerCase().includes('tor emergency'));
  const isPDS=ev.includes('particularly dangerous')||
    (p.headline||'').toLowerCase().includes('particularly dangerous')||
    (params.tornadoTags||[]).some(t=>t.toLowerCase().includes('pds'));
  const isObserved=torDet==='OBSERVED'||(torDet.includes('CONFIRMED'));
  const isTor=ev.includes('tornado');

  let theme='def';
  if(isTor){
    if(isEmergency)theme='tor-e';
    else if(isPDS)theme='tor-pds';
    else if(isObserved)theme='tor-obs';
    else theme='tor';
  }else if(ev.includes('severe thunderstorm'))theme='svr';
  else if(ev.includes('flash flood')||ev.includes('flood'))theme='flood';

  wp.style.display='';wp.className='warn-panel '+theme;
  wp.style.left=_panelLeft();

  // Type tag
  $('wp-type').textContent=(p.event||'').toUpperCase();

  // Headline
  let sev='DANGEROUS SITUATION';
  if(isEmergency)sev='⚠ TORNADO EMERGENCY';
  else if(isPDS)sev='PARTICULARLY DANGEROUS SITUATION';
  $('wp-hdr').textContent=sev;

  // Action
  let act='SEEK SHELTER NOW';
  if(isTor)act='TAKE COVER IMMEDIATELY';
  else if(ev.includes('flash flood'))act='MOVE TO HIGHER GROUND';
  else if(ev.includes('severe thunderstorm'))act='SEEK STURDY SHELTER';
  $('wp-act').textContent=act;

  // Timer
  const expMs=p.expires?new Date(p.expires)-Date.now():null;
  if(expMs!=null&&expMs>0){
    const em=Math.round(expMs/60000);
    $('wp-exp').textContent=em>=60?`${Math.floor(em/60)}h ${em%60}m remaining`:`${em} min remaining`;
  }else $('wp-exp').textContent='ACTIVE';

  // Area
  const area=p.areaDesc||'—';
  $('wp-ctys').textContent=area.split(';').map(x=>x.trim().split(',')[0].toUpperCase()).filter(Boolean).slice(0,6).join(' · ')||area.slice(0,80);

  // Detection — only relevant for tornado warnings
  const thrEl=$('wp-threat'),thrR=$('wp-threat-r');
  if(isTor&&torDet&&thrEl&&thrR){thrEl.textContent=torDet;thrR.style.display='';}
  else if(thrR)thrR.style.display='none';

  // Hail
  const hail=params.maxHailSize?.[0];const hr=$('wp-hail-r');
  if(hail&&hr){$('wp-hail').textContent=hail+'"';hr.style.display='';}else if(hr)hr.style.display='none';

  // More
  const more=S.wpWarnings.length-idx-1;
  const mEl=$('wp-more');
  if(mEl){
    if(more>0){$('wp-more-n').textContent=more;mEl.style.display='';mEl.onclick=()=>showWP((S.wpIdx+1)%S.wpWarnings.length);}
    else mEl.style.display='none';
  }
}

// ── KABEB WATCH PANEL ──────────────────────────────────────────
function showKWP(idx){
  const watches=getWatches(),kwp=$('kwp');
  if(!watches.length||idx<0||idx>=watches.length){kwp.style.display='none';return;}
  const w=watches[idx];S.kwpIdx=idx;
  kwp.style.display='';kwp.className='kwatch-panel';
  kwp.style.left=_panelLeft();
  kwp.style.borderColor=w.color||'rgba(255,200,0,.3)';
  // Title only (no type label)
  $('kwp-title').textContent=w.title||'KABEB WATCH';
  $('kwp-title').style.color=w.color||'#FFB000';
  const exp=Math.max(0,Math.round((w.exp-Date.now())/60000));
  $('kwp-exp').textContent=exp>=60?`${Math.floor(exp/60)}h ${exp%60}m remaining`:`${exp}m remaining`;
  const descEl=$('kwp-desc');if(w.desc){descEl.textContent=w.desc;descEl.style.display='';}else descEl.style.display='none';
  // Delete button — always visible (watches are local to this browser)
  const delBtn=$('kwp-del');
  if(delBtn){
    delBtn.style.display='flex';
    delBtn.onclick=()=>{removeWatch(w.id);renderKabeb();$('kwp').style.display='none';};
  }
  const navEl=$('kwp-nav');if(watches.length>1){$('kwp-ctr').textContent=`${idx+1} / ${watches.length}`;navEl.style.display='';}else navEl.style.display='none';
}
function renderKabeb(){
  S.kabebGrp.clearLayers();const strip=$('watch-strip');strip.innerHTML='';
  S.kabebWatches=getWatches();
  S.kabebWatches.forEach((w,idx)=>{
    const color=w.color||'#FFB000';
    if(w.poly?.length>=3&&S.showKabeb){const poly=L.polygon(w.poly,{color,fillColor:color,fillOpacity:0.16,weight:2.5,opacity:.95});poly.on('click',()=>showKWP(idx));S.kabebGrp.addLayer(poly);}
    const chip=document.createElement('div');chip.className='wchip';chip.style.borderColor=color;
    chip.innerHTML=`<div class="wchip-t" style="color:${color}">${w.title||'KABEB WATCH'}</div><div class="wchip-e">${timeFmt(w.exp)} remaining</div>`;
    chip.onclick=()=>showKWP(idx);strip.appendChild(chip);
  });
  updateChips();
  const cnt=$('admin-cnt');if(cnt)cnt.textContent=`${S.kabebWatches.length} active watch${S.kabebWatches.length!==1?'es':''}`;
  if(S.kabebWatches.length>0&&$('kwp').style.display==='none')showKWP(0);
  else if(!S.kabebWatches.length)$('kwp').style.display='none';
}
window._del=(id)=>{removeWatch(id);renderKabeb();S.map.closePopup();};
function updateChips(){
  const nc=S.nwsWarnings.length,kc=getWatches().length;
  $('nws-n').textContent=nc;$('kab-n').textContent=kc;
  $('nws-chip').style.display=nc>0?'flex':'none';
  $('kab-chip').style.display=kc>0?'flex':'none';
}

// ── MARKERS & RINGS ────────────────────────────────────────────
function renderMarkers(){
  S.markGrp.clearLayers();if(!S.showMarkers)return;
  SITES.forEach(s=>{
    const icon=L.divIcon({html:`<div style="width:8px;height:8px;border-radius:50%;background:rgba(0,212,255,.58);border:1px solid rgba(0,212,255,.28);box-shadow:0 0 4px rgba(0,212,255,.3)"></div>`,iconSize:[8,8],iconAnchor:[4,4],className:''});
    const m=L.marker([s.lat,s.lon],{icon,title:s.id});
    m.bindTooltip(`${s.id} — ${s.name}`,{direction:'top',offset:[0,-5]});
    m.on('click',()=>{
      if(S.mode==='global'){
        S.map.setView([s.lat,s.lon],8,{animate:true});
      }else{
        selectSite(s.id,[s.lat,s.lon],s.name);
      }
    });
    S.markGrp.addLayer(m);
  });
}
function renderRings(){
  S.ringsGrp.clearLayers();if(!S.showRings||S.mode!=='single-site'||!S.siteCoords)return;
  [50,100,150,200].forEach(km=>{
    L.circle(S.siteCoords,{radius:km*1000,color:'rgba(255,255,255,.15)',fillOpacity:0,weight:1,dashArray:'4 6'}).addTo(S.ringsGrp);
    L.marker(L.latLng(S.siteCoords[0]+km/111.1,S.siteCoords[1]),{icon:L.divIcon({html:`<span style="font-size:9px;color:rgba(255,255,255,.22);font-family:var(--mo);white-space:nowrap">${km}km</span>`,className:'',iconAnchor:[0,6]})}).addTo(S.ringsGrp);
  });
}
function selectSite(id,coords,name){
  $('btn-global').classList.remove('active');$('btn-single').classList.add('active');
  $('site-inp').value='';$('site-results').classList.remove('open');
  const pre=S.preloaded?.siteId===id?S.preloaded:null;
  loadSite(id,coords,name,pre);
}

// ── DRAW ───────────────────────────────────────────────────────
function startDraw(){S.drawing=true;S.drawPts=[];$('draw-banner').style.display='flex';$('watch-modal').style.display='none';S.map.getContainer().classList.add('draw-cursor');[S.drawLine,S.drawPoly].forEach(l=>{if(l)S.map.removeLayer(l);});S.drawLine=S.drawPoly=null;updDraw();}
function cancelDraw(){S.drawing=false;S.drawPts=[];$('draw-banner').style.display='none';S.map.getContainer().classList.remove('draw-cursor');[S.drawLine,S.drawPoly].forEach(l=>{if(l)S.map.removeLayer(l);});S.drawLine=S.drawPoly=null;$('watch-modal').style.display='flex';}
function finishDraw(){if(S.drawPts.length<3)return;S.pendingPoly=[...S.drawPts];S.drawing=false;$('draw-banner').style.display='none';S.map.getContainer().classList.remove('draw-cursor');if(S.drawLine){S.map.removeLayer(S.drawLine);S.drawLine=null;}$('poly-status').textContent=`✓ ${S.pendingPoly.length} vertices defined`;$('poly-status').className='poly-status ok';$('watch-modal').style.display='flex';}
function updDraw(){const n=S.drawPts.length;$('db-pts').textContent=`${n} pt${n!==1?'s':''} — ${n<3?`need ${3-n} more`:'ready'}`;$('draw-done').disabled=n<3;}
function addPt(ll){
  S.drawPts.push([ll.lat,ll.lng]);
  const c=$('wt-color')?.value||'#FF0000';
  [S.drawLine,S.drawPoly].forEach(l=>{if(l)S.map.removeLayer(l);});
  if(S.drawPts.length>=2)S.drawLine=L.polyline(S.drawPts,{color:c,weight:2,dashArray:'5 4',opacity:.9}).addTo(S.map);
  if(S.drawPts.length>=3)S.drawPoly=L.polygon(S.drawPts,{color:c,fillColor:c,fillOpacity:.13,weight:2}).addTo(S.map);
  updDraw();
}
function issueWatch(){
  const type=$('wt-type').value,title=$('wt-title').value.trim(),dur=parseInt($('wt-dur').value)||2;
  const color=$('wt-color').value||WATCH_COLORS[type]||'#FF0000',desc=$('wt-desc').value.trim();
  const err=$('wm-err');err.style.display='none';
  if(!title){err.textContent='Enter a title/headline.';err.style.display='';return;}
  if(!S.pendingPoly||S.pendingPoly.length<3){err.textContent='Draw the watch area first.';err.style.display='';return;}
  addWatch({id:'kw-'+Date.now()+'-'+Math.random().toString(36).slice(2,6),type,title,color,poly:S.pendingPoly,issued:Date.now(),exp:Date.now()+dur*3600000,desc});
  S.pendingPoly=null;$('watch-modal').style.display='none';
  $('poly-status').textContent='⚠ Draw the watch area first';$('poly-status').className='poly-status';
  $('wt-title').value='';$('wt-desc').value='';
  renderKabeb();[S.drawPoly,S.drawLine].forEach(l=>{if(l)S.map.removeLayer(l);});S.drawPoly=S.drawLine=null;
}

// ── MAP INIT ───────────────────────────────────────────────────
function initMap(){
  const useWebGL=(()=>{try{const c=document.createElement('canvas');return!!(c.getContext('webgl')||c.getContext('experimental-webgl'));}catch(e){return false;}})();
  S.map=L.map('map',{center:[38,-97],zoom:4,zoomControl:false,attributionControl:true,preferCanvas:true,renderer:L.canvas({padding:0.5,tolerance:3})});
  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png',{subdomains:'abcd',maxZoom:20,attribution:'© OpenStreetMap © CARTO'}).addTo(S.map);
  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}{r}.png',{subdomains:'abcd',maxZoom:20,attribution:'',zIndex:400}).addTo(S.map);
  L.control.zoom({position:'bottomright'}).addTo(S.map);
  S.spcGrp=L.layerGroup().addTo(S.map);
  S.nwsGrp=L.layerGroup().addTo(S.map);
  S.kabebGrp=L.layerGroup().addTo(S.map);
  S.markGrp=L.layerGroup().addTo(S.map);
  S.ringsGrp=L.layerGroup().addTo(S.map);
  S.map.on('click',e=>{if(S.drawing)addPt(e.latlng);});
  S.map.on('contextmenu',e=>{
    if(!S.drawing||!S.drawPts.length)return;
    S.drawPts.pop();const c=$('wt-color')?.value||'#FF0000';
    [S.drawLine,S.drawPoly].forEach(l=>{if(l)S.map.removeLayer(l);});S.drawLine=S.drawPoly=null;
    if(S.drawPts.length>=2)S.drawLine=L.polyline(S.drawPts,{color:c,weight:2,dashArray:'5 4',opacity:.9}).addTo(S.map);
    if(S.drawPts.length>=3)S.drawPoly=L.polygon(S.drawPts,{color:c,fillColor:c,fillOpacity:.13,weight:2}).addTo(S.map);
    updDraw();
  });
}

// ── SEARCH ─────────────────────────────────────────────────────
function setupSearch(){
  const inp=$('site-inp'),res=$('site-results');
  inp.oninput=()=>{
    const q=inp.value.trim().toLowerCase();if(!q){res.classList.remove('open');return;}
    const m=SITES.filter(s=>s.id.toLowerCase().includes(q)||s.name.toLowerCase().includes(q)).slice(0,12);
    res.innerHTML='';if(!m.length){res.classList.remove('open');return;}
    m.forEach(s=>{const d=document.createElement('div');d.className='sr-item';d.innerHTML=`<span class="sr-id">${s.id}</span><span class="sr-nm">${s.name}</span>`;d.onclick=()=>selectSite(s.id,[s.lat,s.lon],s.name);res.appendChild(d);});
    res.classList.add('open');
  };
  inp.onblur=()=>setTimeout(()=>res.classList.remove('open'),200);
}

// ── CLOCK ──────────────────────────────────────────────────────
function startClock(){
  setInterval(()=>{
    const n=new Date();$('utc-clock').textContent=`${pad(n.getUTCHours())}:${pad(n.getUTCMinutes())}:${pad(n.getUTCSeconds())}`;
    const pp=$('pp-time');if(pp){const h=n.getHours(),m=n.getMinutes(),ap=h>=12?'PM':'AM',h12=h%12||12;pp.textContent=`${pad(h12)}:${pad(m)} ${ap} CDT`;}
  },1000);
}

// ── MAIN ───────────────────────────────────────────────────────
window.onload=()=>{
  loadPrefs();loadUser();initMap();startClock();setupSearch();
  $('op-sl').value=Math.round(S.opacity*100);$('op-val').textContent=Math.round(S.opacity*100)+'%';
  $('spd-sel').value=S.speed;
  $('t-nws').className='tog '+(S.showNws?'on':'off');
  $('t-spc').className='tog off'; // SPC off by default
  $('t-kab').className='tog '+(S.showKabeb?'on':'off');
  updateSpcDayUI();

  // Sidebar
  $('sb-tog').onclick=()=>{
    S.sidebarOpen=!S.sidebarOpen;
    $('sidebar').classList.toggle('hidden',!S.sidebarOpen);
    const btn=$('sb-tog');btn.classList.toggle('closed',!S.sidebarOpen);btn.textContent=S.sidebarOpen?'◀':'▶';btn.style.left=S.sidebarOpen?'var(--sw)':'0';
    const off=_panelLeft();
    [$('wp'),$('kwp')].forEach(el=>{if(el)el.style.left=off;});
  };

  // Mode
  $('btn-global').onclick=()=>{$('btn-global').classList.add('active');$('btn-single').classList.remove('active');$('prod-sec').style.display='none';$('site-sec').style.display='none';loadGlobal();};
  $('btn-single').onclick=()=>{
    $('btn-global').classList.remove('active');$('btn-single').classList.add('active');$('prod-sec').style.display='';$('site-sec').style.display='';
    if(S.site)loadSite(S.site,S.siteCoords,S.siteName,S.preloaded?.siteId===S.site?S.preloaded:null);
    else if(S.preloaded?.siteId)loadSite(S.preloaded.siteId,S.preloaded.coords,S.preloaded.name,S.preloaded);
    else{S.mode='single-site';pause();updateBadge();}
  };

  // Products
  document.querySelectorAll('.prod-btn').forEach(b=>{
    b.onclick=()=>{document.querySelectorAll('.prod-btn').forEach(x=>x.classList.remove('active'));b.classList.add('active');S.product=b.dataset.p;if(S.site&&S.mode==='single-site')loadSite(S.site,S.siteCoords,S.siteName);updateBadge();};
  });

  // Clear site
  $('clear-site').onclick=()=>{S.site=null;S.siteCoords=null;S.siteName='';$('sel-card').style.display='none';$('site-inp').value='';savePrefs();};

  // Opacity
  $('op-sl').oninput=e=>{S.opacity=e.target.value/100;$('op-val').textContent=e.target.value+'%';setOp(S.opacity);savePrefs();};

  // Toggles
  const mkT=(id,key,cb)=>{$(id).onclick=function(){S[key]=!S[key];this.className='tog '+(S[key]?'on':'off');cb();savePrefs();};};
  mkT('t-nws','showNws',renderNWS);
  mkT('t-spc','showSpc',fetchSPC);
  mkT('t-kab','showKabeb',renderKabeb);
  mkT('t-rings','showRings',renderRings);
  mkT('t-mrkrs','showMarkers',renderMarkers);

  // SPC day selector
  document.querySelectorAll('.spc-day-btn').forEach(b=>{
    b.onclick=()=>{S.spcDay=parseInt(b.dataset.day);updateSpcDayUI();if(S.showSpc)fetchSPC();};
  });
  // SPC hazard selector
  document.querySelectorAll('.spc-haz-btn').forEach(b=>{
    b.onclick=()=>{S.spcHazard=b.dataset.haz;updateSpcDayUI();if(S.showSpc)fetchSPC();};
  });

  // Timeline
  $('tl-play').onclick=togglePlay;
  $('tl-prev').onclick=()=>{pause();showFrame(getIdx()-1);};
  $('tl-next').onclick=()=>{pause();showFrame(getIdx()+1);};
  $('spd-sel').onchange=e=>{S.speed=parseInt(e.target.value);if(S.playing){pause();play();}savePrefs();};

  // Login
  let authMode='login';
  $('login-btn').onclick=()=>{$('m-err').style.display='none';$('login-modal').style.display='flex';};
  $('m-close').onclick=()=>$('login-modal').style.display='none';
  $('login-modal').onclick=e=>{if(e.target.id==='login-modal')$('login-modal').style.display='none';};
  $('tab-in').onclick=()=>{authMode='login';$('tab-in').classList.add('active');$('tab-reg').classList.remove('active');$('m-go').textContent='SIGN IN';};
  $('tab-reg').onclick=()=>{authMode='register';$('tab-reg').classList.add('active');$('tab-in').classList.remove('active');$('m-go').textContent='CREATE ACCOUNT';};
  $('m-go').onclick=()=>{
    const email=$('m-email').value.trim(),pass=$('m-pass').value,err=$('m-err');err.style.display='none';
    if(!email||!pass){err.textContent='Email and password required.';err.style.display='';return;}
    if(authMode==='login'){const u=tryLogin(email,pass);if(!u){err.textContent='Invalid email or password.';err.style.display='';return;}setUser(u);$('login-modal').style.display='none';}
    else{if(pass.length<6){err.textContent='Password must be 6+ chars.';err.style.display='';return;}const r=tryRegister(email,pass);if(!r.ok){err.textContent=r.msg;err.style.display='';return;}setUser(r.user);$('login-modal').style.display='none';}
  };
  $('m-pass').onkeydown=e=>{if(e.key==='Enter')$('m-go').click();};
  $('m-email').onkeydown=e=>{if(e.key==='Enter')$('m-pass').focus();};

  // User menu
  $('user-btn')?.addEventListener('click',()=>{const dd=$('user-dd');dd.style.display=dd.style.display==='none'?'':'none';});
  $('dd-signout').onclick=()=>{setUser(null);$('user-dd').style.display='none';};
  document.addEventListener('click',e=>{if(!e.target.closest('#user-wrap')&&!e.target.closest('#user-btn')&&!e.target.closest('#user-dd'))$('user-dd').style.display='none';});

  // Warning panels
  $('nws-chip').onclick=()=>{if(S.nwsWarnings.length){S.wpWarnings=[...S.nwsWarnings];showWP(0);}};
  $('wp-x').onclick=()=>$('wp').style.display='none';
  // wp-more onclick set dynamically in showWP()
  $('kab-chip').onclick=()=>{if(getWatches().length)showKWP(S.kwpIdx);};
  $('kwp-x').onclick=()=>$('kwp').style.display='none';
  // kwp-del set dynamically in showKWP()
  $('kwp-prev').onclick=()=>{const w=getWatches();showKWP((S.kwpIdx-1+w.length)%w.length);};
  $('kwp-next').onclick=()=>{const w=getWatches();showKWP((S.kwpIdx+1)%w.length);};

  // Admin
  $('btn-issue').onclick=()=>{S.pendingPoly=null;$('poly-status').textContent='⚠ Draw the watch area first';$('poly-status').className='poly-status';$('wm-err').style.display='none';$('wt-title').value='';$('wt-desc').value='';$('wt-color').value=WATCH_COLORS[$('wt-type').value]||'#FF0000';$('watch-modal').style.display='flex';};
  $('btn-clear').onclick=()=>{clearExpired();renderKabeb();};
  $('wt-type').onchange=()=>{$('wt-color').value=WATCH_COLORS[$('wt-type').value]||'#FF0000';};
  $('wm-close').onclick=()=>{$('watch-modal').style.display='none';cancelDraw();};
  $('btn-issue-cancel').onclick=()=>{$('watch-modal').style.display='none';cancelDraw();};
  $('watch-modal').onclick=e=>{if(e.target.id==='watch-modal'){$('watch-modal').style.display='none';cancelDraw();}};
  $('btn-draw-area').onclick=startDraw;$('btn-issue-submit').onclick=issueWatch;
  $('draw-done').onclick=finishDraw;$('draw-cancel').onclick=cancelDraw;

  // ── BOOT SEQUENCE ─────────────────────────────────────────────
  // 1. Render UI immediately
  renderUserUI();renderKabeb();

  // 2. Load global + NWS simultaneously (don't wait for one before starting the other)
  fetchNWS(); // instant warnings
  loadGlobal().then(()=>{
    // If user has a saved site, preload it silently after global loads
    if(S.site&&S.siteCoords)bgPreload(S.site,S.siteCoords,S.siteName,'REF');
  });

  // Auto-refresh
  setInterval(fetchNWS,60000);
  setInterval(renderKabeb,30000);
  // Global radar: refresh every 5 min
  setInterval(async()=>{
    if(S.mode!=='global')return;
    try{
      const rv=await fetchRV();
      const all=[...rv.past,...rv.nowcast].slice(-16);
      if(!all.length)return;
      S.rvFrames=all;
      S.rvIdx=rv.past.length-1;if(S.rvIdx<0)S.rvIdx=S.rvFrames.length-1;
      const wasPlaying=S.playing;pause();buildGlobal();showFrame(S.rvIdx);if(wasPlaying)play();
    }catch(e){}
  },5*60*1000);
  // Single site: refresh every 3 min
  setInterval(async()=>{
    if(S.mode!=='single-site'||!S.site)return;
    try{
      const res=await fetchIemScans(S.site,S.iemProd);
      if(!res.ok||!res.frames.length)return;
      // Only rebuild if there are new frames
      if(res.frames[res.frames.length-1]===S.iemFrames[S.iemFrames.length-1])return;
      S.iemFrames=res.frames;S.iemProd=res.product;
      S.iemIdx=res.frames.length-1;
      const wasPlaying=S.playing;pause();buildSite();showFrame(S.iemIdx);if(wasPlaying)play();
      setStatus('ok',`${S.site} · ${res.product} · ${res.frames.length} scans`);
    }catch(e){}
  },3*60*1000);
};
