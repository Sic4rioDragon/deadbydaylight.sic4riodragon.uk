const fs=require('node:fs'),path=require('node:path');const root=path.resolve(__dirname,'..');
const load=p=>JSON.parse(fs.readFileSync(path.join(root,p),'utf8'));
const errors=[],check=(value,message)=>{if(!value)errors.push(message);};
const base=load('achievements/achievements.base.json'),players=load('achievements/players.json');
check(Array.isArray(base)&&base.length>=100,'Achievement catalog unexpectedly small');
const ids=new Set(),steamNames=new Set();
for(const item of base){
 check(typeof item.achievement_id==='string'&&item.achievement_id.length>0,'Achievement missing an ID');
 check(!ids.has(item.achievement_id),'Duplicate catalog ID '+item.achievement_id);ids.add(item.achievement_id);
 check(['killer','survivor','general'].includes(item.category),'Invalid category for '+item.achievement_id);
 check(['adept','general','extra','map'].includes(item.section),'Invalid section for '+item.achievement_id);
 if(item.steam_api_name){check(!steamNames.has(item.steam_api_name),'Duplicate Steam API ID '+item.steam_api_name);steamNames.add(item.steam_api_name);}
}
const registered=new Set();
check(Array.isArray(players)&&players.length>0,'No registered players');
for(const p of players){
 check(/^\d{17}$/.test(String(p.steamid)),'Invalid SteamID64 '+p.steamid);
 check(!registered.has(p.steamid),'Duplicate player '+p.steamid);registered.add(p.steamid);
 const file=path.join(root,'achievements','players',p.steamid+'.json');
 check(fs.existsSync(file),'Missing data for '+p.steamid);
 if(fs.existsSync(file)){const data=JSON.parse(fs.readFileSync(file,'utf8'));check(data.steamid===p.steamid,'Profile ID mismatch '+p.steamid);}
}
const review=load('achievements/catalog-review.json');
check(Array.isArray(review.needsReview),'Catalog review file lacks needsReview array');
if(errors.length){console.error(errors.join('\n'));process.exitCode=1;}
else console.log('Site data validated: '+base.length+' achievements, '+players.length+' player profiles.');