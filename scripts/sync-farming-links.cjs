// Curated farming guide integration. Public guide JSON is the source of truth.
// This is run by GitHub Actions, not by browsers; failures retain last valid mapping.
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const catalog=JSON.parse(fs.readFileSync(path.join(root,'achievements/achievements.base.json'),'utf8'));
const output=path.join(root,'achievements/farming-links.json');
const remote='https://raw.githubusercontent.com/Sic4rioDragon/dbdfarming.sic4riodragon.uk/main/data/';
const guideSite='https://dbdfarming.sic4riodragon.uk/';
const normalize=value=>String(value||'').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,' ').trim();
const validSlug=value=>/^[a-z0-9-]{2,100}$/.test(value);
async function getJSON(filename){
 const response=await fetch(remote+filename,{signal:AbortSignal.timeout(20000),headers:{'User-Agent':'Sic4rioDragon-DBD-Farming-Sync/1.0'}});
 if(!response.ok)throw Error('Guide source HTTP '+response.status+' for '+filename);
 return response.json();
}
function makeLinks(achievements,methods){
 if(!achievements||Object.keys(achievements).length<40)throw Error('Guide achievements source is unexpectedly small');
 if(!methods||Object.keys(methods).length<20)throw Error('Guide methods source is unexpectedly small');
 const titles=new Map();
 for(const [slug,row] of Object.entries(achievements)){
  if(!validSlug(slug)||!row?.name)continue;
  const key=normalize(row.name);
  titles.set(key,[...(titles.get(key)||[]),{...row,slug}]);
 }
 const mapping={};let skipped=0;
 for(const entry of catalog){
  const entries=titles.get(normalize(entry.title))||[];
  let match=entries.find(x=>x.side===entry.category)||(entries.length===1?entries[0]:null);
  let matchType='title';
  if(!match&&entry.section==='adept'&&['killer','survivor'].includes(entry.category)){
   const key=entry.category+'-adept';
   if(achievements[key]){match={...achievements[key],slug:key};matchType='adept';}
  }
  if(!match||!validSlug(match.slug))continue;
  const matchedMethods=(match.methodIds||[]).filter(id=>validSlug(id)&&methods[id]).map(id=>({
   id,name:methods[id].name||id,url:guideSite+'methods/'+id+'/',summary:methods[id].summary||''
  }));
  if(!matchedMethods.length){skipped++;continue;}
  mapping[entry.achievement_id]={
   guideUrl:guideSite+'achievements/'+match.slug+'/',
   guideName:match.name,guideCategory:match.category||'',
   methods:matchedMethods,matchType,
   priority:Number.isFinite(match.priority)?match.priority:999
  };
 }
 return{sourceRepository:'https://github.com/Sic4rioDragon/dbdfarming.sic4riodragon.uk',sourceWebsite:guideSite,catalogSize:catalog.length,matchedAchievements:Object.keys(mapping).length,matching:'Exact guide achievement title, then category-specific Adept family',mapping};
}
(async()=>{
 try{
  const [achievements,methods]=await Promise.all([getJSON('achievements.json'),getJSON('methods.json')]);
  const generated=makeLinks(achievements,methods);
  const text=JSON.stringify(generated,null,2)+'\n';
  if(!fs.existsSync(output)||fs.readFileSync(output,'utf8')!==text)fs.writeFileSync(output,text);
  console.log('Farming guide links:',generated.matchedAchievements+'/'+generated.catalogSize,'matched achievements.');
 }catch(e){
  if(fs.existsSync(output)){console.warn('Guide link sync unavailable, keeping last valid mapping:',e.message);return;}
  console.error('Cannot build initial farming links:',e.message);
  process.exitCode=1;
 }
})();
