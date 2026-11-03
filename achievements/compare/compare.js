(async()=>{
 const $=id=>document.getElementById(id);
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
 const read=async path=>{const r=await fetch(path,{cache:'no-store'});if(!r.ok)throw Error('Could not load '+path);return r.json();};
 const [registered,catalog,icons]=await Promise.all([read('/achievements/players.json'),read('/achievements/achievements.base.json'),read('/achievements/achievements.icons.json')]);
 if(registered.length<2){$('compareRows').innerHTML='<tr><td colspan="3">At least two registered players are required.</td></tr>';return;}
 function flatten(state){const m=new Map();for(const group of Object.values(state||{}))for(const section of Object.values(group||{}))for(const [id,v] of Object.entries(section||{})){const value=typeof v==='boolean'?{unlocked:v}:v;if(!value)continue;const old=m.get(id);if(!old||(!old.unlocked&&value.unlocked))m.set(id,value);}return m;}
 const players=await Promise.all(registered.map(async p=>{let data={};try{data=await read('/achievements/players/'+encodeURIComponent(p.steamid)+'.json');}catch{}return{p,data,name:p.overrideName||data.steamName||p.fallbackName||p.steamid,achievements:flatten(data.state)};}));
 const lookup=new Map(players.map(p=>[p.p.steamid,p]));
 const selectA=$('compareA'),selectB=$('compareB'),params=new URLSearchParams(location.search);
 for(const el of [selectA,selectB])for(const p of players){const option=document.createElement('option');option.value=p.p.steamid;option.textContent=p.name;el.append(option);}
 selectA.value=lookup.has(params.get('a'))?params.get('a'):players[0].p.steamid;
 const preferredB=params.get('b');
 selectB.value=lookup.has(preferredB)&&preferredB!==selectA.value?preferredB:players.find(p=>p.p.steamid!==selectA.value).p.steamid;
 if(['different','aOnly','bOnly','both','neither','all'].includes(params.get('mode')))$('compareMode').value=params.get('mode');
 const stamp=x=>{const n=Date.parse(x||'');return Number.isFinite(n)?new Date(n).toLocaleDateString():'';};
 const cell=x=>{
  if(!x)return '<span class="compare-unknown">Unknown</span>';
  if(x.unlocked)return '<span class="compare-yes">✓ Unlocked</span>'+(x.unlockedAt?'<div class="compare-cell-meta">'+esc(stamp(x.unlockedAt))+'</div>':'');
  return '<span class="compare-no">Locked</span>'+(Number.isFinite(x.progress)&&Number.isFinite(x.goal)&&x.goal>1?'<div class="compare-cell-meta">'+x.progress+' / '+x.goal+'</div>':'');
 };
 const snapshot=(p,id)=>p.data.lastSync?p.achievements.get(id)||null:null;
 const profile=(p,host)=>{
  const avatar=/^https:\/\//.test(p.data.avatar||'')?p.data.avatar:'/assets/img/deadbydaylight_icon.png';
  host.innerHTML='<img src="'+esc(avatar)+'" alt=""><div><strong>'+esc(p.name)+'</strong><small>'+(p.data.lastSync?'Synced '+esc(stamp(p.data.lastSync)):'No completed sync')+'</small><a href="/achievements/?player='+encodeURIComponent(p.p.steamid)+'">Open achievements ↗</a></div>';
 };
 const stat=(label,count,detail)=>'<div class="compare-stat"><span>'+esc(label)+'</span><strong>'+count+'</strong><span>'+esc(detail)+'</span></div>';
 function render(){
  let first=lookup.get(selectA.value),second=lookup.get(selectB.value);if(!first||!second)return;
  if(first===second){second=players.find(p=>p!==first);selectB.value=second.p.steamid;}
  profile(first,$('compareProfileA'));profile(second,$('compareProfileB'));
  $('compareHeaderA').textContent=first.name;$('compareHeaderB').textContent=second.name;
  let aCount=0,bCount=0,both=0,aOnly=0,bOnly=0,neither=0,unknown=0;
  const rows=catalog.map(item=>{
   const a=snapshot(first,item.achievement_id),b=snapshot(second,item.achievement_id);
   if(a?.unlocked)aCount++;if(b?.unlocked)bCount++;
   let type='unknown';
   if(a&&b){if(a.unlocked&&b.unlocked)type='both';else if(a.unlocked)type='aOnly';else if(b.unlocked)type='bOnly';else type='neither';}
   if(type==='both')both++;else if(type==='aOnly')aOnly++;else if(type==='bOnly')bOnly++;else if(type==='neither')neither++;else unknown++;
   return{item,a,b,type};
  });
  $('compareSummary').innerHTML=stat(first.name,aCount,'of '+catalog.length+' unlocked')+stat(second.name,bCount,'of '+catalog.length+' unlocked')+stat('Both unlocked',both,'Shared achievements')+stat('Differences',aOnly+bOnly,'Unlocked by one player');
  const mode=$('compareMode').value,category=$('compareCategory').value,search=$('compareSearch').value.toLowerCase().trim();
  const visible=rows.filter(r=>{
   if(mode==='different'&&!['aOnly','bOnly'].includes(r.type))return false;
   if(mode!=='different'&&mode!=='all'&&mode!==r.type)return false;
   if(category!=='all'&&r.item.category!==category&&r.item.section!==category)return false;
   return !search||[r.item.title,r.item.description,r.item.category,r.item.section].join(' ').toLowerCase().includes(search);
  });
  $('compareCount').textContent=visible.length+' shown · '+aOnly+' only '+first.name+' · '+bOnly+' only '+second.name+(unknown?' · '+unknown+' unknown':'');
  $('compareRows').innerHTML=visible.map(r=>{
   const icon=icons[r.item.achievement_id]||'/assets/img/deadbydaylight_icon.png';
   return '<tr><td><div class="compare-achievement"><img loading="lazy" alt="" src="'+esc(icon)+'"><div><strong>'+esc(r.item.title)+'</strong><small>'+esc(r.item.description||r.item.category)+'</small></div></div></td><td>'+cell(r.a)+'</td><td>'+cell(r.b)+'</td></tr>';
  }).join('')||'<tr><td colspan="3">No achievements match these filters.</td></tr>';
  const url=new URL(location.href);url.searchParams.set('a',selectA.value);url.searchParams.set('b',selectB.value);url.searchParams.set('mode',mode);history.replaceState({},'',url);
 }
 for(const element of [selectA,selectB,$('compareMode'),$('compareCategory'),$('compareSearch')])element.addEventListener(element.id==='compareSearch'?'input':'change',render);
 $('compareSwap').addEventListener('click',()=>{const a=selectA.value;selectA.value=selectB.value;selectB.value=a;render();});
 $('compareCopy').addEventListener('click',async()=>{try{await navigator.clipboard.writeText(location.href);$('compareCopy').textContent='Copied';}catch{$('compareCopy').textContent='Copy URL from address bar';}});
 render();
})().catch(err=>{console.error(err);document.getElementById('compareRows').innerHTML='<tr><td colspan="3">Comparison could not be loaded. Please refresh.</td></tr>';});
