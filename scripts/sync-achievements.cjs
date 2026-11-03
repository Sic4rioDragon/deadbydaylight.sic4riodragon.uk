/* Steam DBD achievement sync.
 * Uses official Steam Web API. Keeps last successful snapshots on errors.
 * Progress counters not returned by Steam are preserved from existing data.
 */
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname,'..');
const ach = path.join(root,'achievements');
const playerFile = path.join(ach,'players.json');
const baseFile = path.join(ach,'achievements.base.json');
const iconsFile = path.join(ach,'achievements.icons.json');
const key = process.env.STEAM_API_KEY;
const APP = '381210';
const read = (file, fallback) => fs.existsSync(file) ? JSON.parse(fs.readFileSync(file,'utf8')) : fallback;
const write = (file, data) => { const value=JSON.stringify(data,null,2)+'\n';if(!fs.existsSync(file)||fs.readFileSync(file,'utf8')!==value)fs.writeFileSync(file,value); };
const norm = value => String(value||'').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,' ').trim();
const slug = value => norm(value).replace(/ /g,'_');
const valid = steamid => /^7656119\d{10}$/.test(String(steamid)) && BigInt(steamid)>76561197960265728n;
const bucket = x => [x.category==='killer'?'killers':x.category==='survivor'?'survivors':'general',x.section||'general'];
const playerPath = id => path.join(ach,'players',id+'.json');
function register(mode,steamid,name) {
 if (!valid(steamid)) throw Error('Valid 17-digit SteamID64 is required.');
 let players = read(playerFile,[]);
 const existing = players.find(x=>x.steamid===steamid);
 if(mode==='add') {
   if(!existing) {
     players.push({steamid,fallbackName:name||steamid,overrideName:''});
     write(playerFile,players);
     console.log('Registered player',steamid);
   } else console.log('Player already registered',steamid);
   if(!fs.existsSync(playerPath(steamid)))write(playerPath(steamid),{steamid,steamName:'',avatar:'',lastSync:null,state:{killers:{},survivors:{},general:{}}});
 } else if (mode==='remove') {
   if(steamid==='76561198742447566')throw Error('Primary account cannot be removed through the workflow.');
   players=players.filter(x=>x.steamid!==steamid);
   write(playerFile,players);
   if(fs.existsSync(playerPath(steamid))) fs.unlinkSync(playerPath(steamid));
   console.log('Removed player',steamid);
 } else if(mode==='rename') {
   if(!existing)throw Error('Player not registered.');
   existing.overrideName=String(name||'').trim().slice(0,80);
   write(playerFile,players);
   console.log('Set display name override for',steamid,'(empty restores Steam name)');
 }
}
async function steam(endpoint, params) {
 const url=new URL('https://api.steampowered.com/'+endpoint);
 for(const [name,value] of Object.entries({key,...params}))url.searchParams.set(name,value);
 const timeout=AbortSignal.timeout(20000);
 const response=await fetch(url,{signal:timeout,headers:{'User-Agent':'Sic4rioDragon-DBD-AchievementSync/1.0'}});
 if(!response.ok)throw Error('Steam '+endpoint+' HTTP '+response.status);
 return response.json();
}

function normalizeProfileState(input,catalog){
 const previous=new Map();
 for(const group of Object.values(input||{})){
  if(!group||typeof group!=='object')continue;
  for(const section of Object.values(group)){
   if(!section||typeof section!=='object')continue;
   for(const [id,value] of Object.entries(section)){
    const row=typeof value==='boolean'?{unlocked:value}:value;
    if(!row||typeof row!=='object')continue;
    const old=previous.get(id);
    if(!old){previous.set(id,{...row});continue;}
    const chosen=old.unlocked?old:row.unlocked?row:old;
    previous.set(id,{...old,...row,...chosen,unlocked:!!(old.unlocked||row.unlocked)});
   }
  }
 }
 const out={killers:{},survivors:{},general:{}};
 for(const item of catalog){
  const value=previous.get(item.achievement_id);
  if(!value)continue;
  const [group,section]=bucket(item);
  (out[group][section]??={})[item.achievement_id]=value;
 }
 return out;
}


function classifyNewAchievement(title,description){
 const name=String(title||''),text=String(description||'');
 if(/^Adept /i.test(name)&&/merciless victory/i.test(text))return{category:'killer',section:'adept',needsReview:false};
 if(/^Adept /i.test(name)&&/escape with/i.test(text))return{category:'survivor',section:'adept',needsReview:false};
 if(/as the (?:Slasher|Judgment)/i.test(text))return{category:'killer',section:'extra',needsReview:false};
 if(/down \d+ Survivors/i.test(text))return{category:'killer',section:'general',needsReview:false};
 if(/give a total of .*healing charges to Survivors/i.test(text))return{category:'survivor',section:'general',needsReview:false};
 if(/escape .*Exile/i.test(text)||/gain a health state/i.test(text))return{category:'survivor',section:'general',needsReview:false};
 return{category:'general',section:'general',needsReview:true};
}
function generateReview(catalog,schema){
 const needsReview=catalog.filter(x=>x.needsReview===true).map(x=>({
  achievement_id:x.achievement_id,title:x.title,steam_api_name:x.steam_api_name||'',
  description:x.description||'',category:x.category,section:x.section,
  reason:x.description?'Manual category review needed':'Missing description; manual review needed'
 }));
 const known=new Set((schema||[]).map(x=>x.name));
 const missingFromCurrentSteamSchema=known.size?catalog.filter(x=>x.steam_api_name&&!known.has(x.steam_api_name)).map(x=>({achievement_id:x.achievement_id,title:x.title,steam_api_name:x.steam_api_name})):[];
 return{instructions:'Review achievements.base.json, assign category/section, then remove needsReview. Re-generated on the next sync.',needsReview,missingFromCurrentSteamSchema};
}


function parseNightLightProgress(html){
 const items=[];
 for(const fragment of html.split(/<div class="_achievement_[^"]+">/i).slice(1,500)){
  const title=fragment.match(/<p class="mb-0 fw-bold">([\s\S]*?)<\/p>/i);
  const progress=fragment.match(/<div class="_progress_info_[^"]+">([\s\S]*?)<\/small>/i);
  if(!title||!progress)continue;
  const name=title[1].replace(/<[^>]*>/g,'').replace(/&amp;/g,'&').replace(/&#39;/g,"'").replace(/&quot;/g,'"').trim();
  const text=progress[1].replace(/<!--[\s\S]*?-->/g,'').replace(/<[^>]*>/g,'');
  const values=text.match(/([\d,]+)\s*\/\s*([\d,]+)/);
  if(!values)continue;
  const current=Number(values[1].replace(/,/g,'')),goal=Number(values[2].replace(/,/g,''));
  if(!Number.isSafeInteger(current)||!Number.isSafeInteger(goal)||current<0||goal<2||goal>1000000000||current>goal)continue;
  items.push({name,progress:current,goal});
 }
 return items;
}
async function updatePartialProgress(steamid,state,catalog){
 try {
  const response=await fetch('https://nightlight.gg/steam-stats/profile/'+steamid+'/achievements',{
   headers:{'User-Agent':'Sic4rioDragon DBD Achievement Tracker'},
   signal:AbortSignal.timeout(12000)
  });
  if(!response.ok)throw Error('NightLight HTTP '+response.status);
  const html=await response.text();
  if(html.length>4000000)throw Error('Unexpected NightLight response size');
  const progress=parseNightLightProgress(html);
  const named=new Map(catalog.map(x=>[norm(x.title),x]));
  let refreshed=0;
  for(const item of progress){
   const record=named.get(norm(item.name));
   if(!record)continue;
   const [group,section]=bucket(record);
   const previous=state[group]?.[section]?.[record.achievement_id];
   if(!previous||previous.unlocked)continue;
   if(Number.isFinite(previous.goal)&&previous.goal>1&&previous.goal!==item.goal)continue;
   const value=Number.isFinite(previous.progress)?Math.max(previous.progress,item.progress):item.progress;
   state[group][section][record.achievement_id]={...previous,progress:value,goal:item.goal,progressSource:'NightLight',progressUpdatedAt:new Date().toISOString()};
   refreshed++;
  }
  console.log('NightLight progress refreshed',steamid,refreshed);
 }catch(error){console.warn('NightLight progress unavailable for',steamid,'-',error.message);}
}

async function sync() {
 if(!key){throw Error('STEAM_API_KEY is missing. Add it in GitHub repository Actions secrets.');}
 const players=read(playerFile,[]);
 const base=read(baseFile,[]);
 const icons=read(iconsFile,{});
 let schema;
 try {
   const data=await steam('ISteamUserStats/GetSchemaForGame/v2/',{appid:APP});
   schema=data.game?.availableGameStats?.achievements||[];
   if(schema.length<100)throw Error('Steam returned incomplete achievement schema');
 } catch(err){console.warn('Schema unavailable; preserving catalog:',err.message);schema=[];}
 const names=new Map(base.map(x=>[norm(x.title),x]));
 const steamNames=new Map(schema.map(x=>[String(x.name),x]));
 const byApi=new Map();
 for(const x of base){if(x.steam_api_name)byApi.set(x.steam_api_name,x);}
 for(const x of schema){
   const known=byApi.get(x.name)||names.get(norm(x.displayName));
   if(known){
     if(!known.steam_api_name)known.steam_api_name=x.name;
     byApi.set(x.name,known);
   } else {
     const id='steam_'+slug(x.name);
     const inferred=classifyNewAchievement(x.displayName||x.name,x.description||'');
     const added={achievement_id:id,steam_api_name:x.name,title:x.displayName||x.name,description:x.description||'',...inferred,id:'steam'};
     base.push(added);byApi.set(x.name,added);names.set(norm(added.title),added);
     console.log('New Steam achievement:',added.title);
   }
 }
 let successes=0;
 for(const p of players){
   const current=read(playerPath(p.steamid),{steamid:p.steamid,steamName:'',avatar:'',lastSync:null,state:{}});
   // Profile identity is independent of whether DBD achievement stats are public.
   let steamName=current.steamName||'',avatar=current.avatar||'';
   try {
     const s=await steam('ISteamUser/GetPlayerSummaries/v2/',{steamids:p.steamid});
     const u=s.response?.players?.[0];
     if(u){steamName=u.personaname||steamName;avatar=u.avatarfull||avatar;}
   } catch(err){console.warn('Steam profile lookup unavailable',p.steamid,err.message);}
   let list;
   try {
     const data=await steam('ISteamUserStats/GetPlayerAchievements/v1/',{appid:APP,steamid:p.steamid,l:'en'});
     if(data.playerstats?.success!==true || !Array.isArray(data.playerstats.achievements) || data.playerstats.achievements.length<100){
       throw Error('Achievements are private, unavailable or incomplete');
     }
     list=data.playerstats.achievements;
   }catch(err){
     const message=String(err?.message||'Steam returned no DBD achievement data').slice(0,180);
     console.warn('No DBD achievement snapshot for',p.steamid,':',message);
     // Preserve any prior valid achievement snapshot and lastSync timestamp.
     write(playerPath(p.steamid),{...current,steamid:p.steamid,steamName,avatar,lastAttempt:new Date().toISOString(),syncStatus:'unavailable',syncReason:message});
     continue;
   }
   const state=normalizeProfileState(current.state,base);
   const unknown=[];
   for(const a of list){
     let item=byApi.get(String(a.apiname));
     if(!item){
       const match=names.get(norm(a.name)) || names.get(norm(steamNames.get(a.apiname)?.displayName));
       if(match){item=match;if(!item.steam_api_name)item.steam_api_name=a.apiname;byApi.set(a.apiname,item);}
     }
     if(!item){unknown.push(a.apiname);continue;}
     const [group,section]=bucket(item);
     state[group]??={}; state[group][section]??={};
     const old=state[group][section][item.achievement_id];
     const unlocked=Number(a.achieved)===1;
     const prior=old&&typeof old==='object'?old:null;
     const record={unlocked, ...(prior&&Number.isFinite(prior.progress)?{progress:prior.progress}:{}), ...(prior&&Number.isFinite(prior.goal)?{goal:prior.goal}:{}), ...(prior?.progressSource?{progressSource:prior.progressSource}:{}), ...(prior?.progressUpdatedAt?{progressUpdatedAt:prior.progressUpdatedAt}:{})};
     if(unlocked && Number.isFinite(record.goal))record.progress=record.goal;
     if(unlocked && Number.isFinite(Number(a.unlocktime)) && Number(a.unlocktime)>0)record.unlockedAt=new Date(Number(a.unlocktime)*1000).toISOString();
     state[group][section][item.achievement_id]=record;
   }
   if(unknown.length)console.warn('Unmapped Steam achievement identifiers:',unknown.slice(0,15).join(', '));
   await updatePartialProgress(p.steamid,state,base);
   const syncedAt=new Date().toISOString();
   write(playerPath(p.steamid),{steamid:p.steamid,steamName,avatar,lastSync:syncedAt,lastAttempt:syncedAt,syncStatus:'ok',syncReason:null,state});
   successes++;
   console.log('Updated',p.steamid,':',list.length,'achievements');
 }
 // Retain Steam schema and icon changes, but never replace existing progress on failed calls.
 write(baseFile,base);
 write(iconsFile,icons);
 write(path.join(ach,'catalog-review.json'),generateReview(base,schema));
 if(!successes)console.warn('No player could be synchronized. Existing snapshots retained.');
}
(async()=>{
 const mode=process.argv[2]||'sync';
 const steamid=process.argv[3]||'';
 const name=process.argv[4]||'';
 if(mode==='add'||mode==='remove'||mode==='rename')register(mode,steamid,name);
 else if(mode!=='sync')throw Error('Unknown mode '+mode);
 if(mode==='sync'||mode==='add')await sync();
})().catch(e=>{console.error(e);process.exitCode=1;});
