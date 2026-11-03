(async () => {
 const host=document.getElementById('homePlayers'),activity=document.getElementById('homeRecent');
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
 const get=async url=>{const r=await fetch(url,{cache:'no-store'});if(!r.ok)throw Error('Could not load '+url);return r.json();};
 const date=s=>{const n=Date.parse(s||'');return Number.isFinite(n)?new Date(n).toLocaleDateString():'';};
 try{
  const [players,catalog,icons]=await Promise.all([get('/achievements/players.json'),get('/achievements/achievements.base.json'),get('/achievements/achievements.icons.json')]);
  const data=await Promise.all(players.map(async p=>{
   let info={};try{info=await get('/achievements/players/'+encodeURIComponent(p.steamid)+'.json');}catch{}
   const m=new Map();
   for(const group of Object.values(info.state||{}))for(const section of Object.values(group||{}))for(const [id,value] of Object.entries(section||{})){
    const v=typeof value==='boolean'?{unlocked:value}:value;
    if(!v||typeof v!=='object')continue;
    if(!m.has(id)||(!m.get(id).unlocked&&v.unlocked))m.set(id,v);
   }
   return {p,info,map:m,name:p.overrideName||info.steamName||p.fallbackName||p.steamid};
  }));
  host.innerHTML=data.map(({p,info,map,name})=>{
   const count=catalog.filter(item=>map.get(item.achievement_id)?.unlocked===true).length;
   const percent=catalog.length?Math.round(count/catalog.length*100):0;
   const avatar=/^https:\/\//.test(info.avatar||'')?info.avatar:'/assets/img/deadbydaylight_icon.png';
   return '<a class="hub-player" href="/achievements/?player='+encodeURIComponent(p.steamid)+'"><img alt="" loading="lazy" src="'+esc(avatar)+'"><span><strong>'+esc(name)+'</strong><small>'+(info.lastSync?'Synced '+esc(date(info.lastSync)):'Awaiting first sync')+'</small>'+(info.lastSync ? '<span class="hub-player-count">'+count+' / '+catalog.length+' unlocked ('+percent+'%)</span><span class="hub-meter"><span style="width:'+percent+'%"></span></span>' : '<span class="hub-player-count">Achievement data pending</span>')+'</span></a>';
  }).join('')||'<span>No registered players.</span>';
  const titles=new Map(catalog.map(i=>[i.achievement_id,i])),all=[];
  for(const {p,name,map} of data)for(const [id,v] of map){
   if(!v.unlocked||!v.unlockedAt||!titles.has(id))continue;
   const time=Date.parse(v.unlockedAt);
   if(Number.isFinite(time))all.push({id,name,steamid:p.steamid,time,item:titles.get(id)});
  }
  all.sort((a,b)=>b.time-a.time);
  activity.innerHTML=all.slice(0,6).map(v=>{
   const icon=icons[v.id]||'/assets/img/deadbydaylight_icon.png';
   return '<a class="hub-activity-item" href="/achievements/?player='+encodeURIComponent(v.steamid)+'"><img alt="" loading="lazy" src="'+esc(icon)+'"><span><strong>'+esc(v.item.title)+'</strong><small>'+esc(v.name)+' · '+esc(date(v.time))+'</small></span></a>';
  }).join('')||'<span>No unlock timestamps recorded yet.</span>';
 }catch(err){
  console.error('Home achievement summary unavailable',err);
  host.textContent='Tracked profiles temporarily unavailable.';
  activity.textContent='Achievement activity temporarily unavailable.';
 }
})();