(async()=>{
 const $=id=>document.getElementById(id);
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
 const read=async path=>{const r=await fetch(path,{cache:'no-store'});if(!r.ok)throw Error('Could not load '+path);return r.json();};
 const collections={killers:await read('/killers.json'),survivors:await read('/survivors.json')};
 let type='killers',selected=null,dirty=false;
 const list=()=>collections[type][type]||[];
 const label=()=>type==='killers'?'killers.json':'survivors.json';
 const split=value=>value.split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
 const fields=['editPrestige','editOwned','editMain','editRotation','editShowName','editPerks','editAddons','editOffering','editNotes','editClips'];
 const external=url=>/^https?:\/\/[^\s/]+/i.test(url);
 function feedback(s){$('editorFeedback').textContent=s;}
 function draft(){
  if(!selected)return;
  const n=Number($('editPrestige').value);
  if(!Number.isInteger(n)||n<0||n>100)throw Error('Prestige must be a whole number from 0 to 100.');
  const clips=split($('editClips').value).map(line=>{
   const sep=line.indexOf(' | ');
   if(sep<0)throw Error('Clips must use: title | https://url');
   const title=line.slice(0,sep).trim(),url=line.slice(sep+3).trim();
   if(!title||!external(url))throw Error('Clip title and HTTP(S) URL are required.');
   return{title,url};
  });
  selected.prestige=n;selected.owned=$('editOwned').checked;selected.main=$('editMain').checked;
  selected.rotation=$('editRotation').checked;selected.nameshown=$('editShowName').checked;
  selected.favLoadout={...(selected.favLoadout||{}),perks:split($('editPerks').value),addons:split($('editAddons').value),offering:$('editOffering').value.trim(),notes:$('editNotes').value.trim()};
  selected.clips=clips;
  dirty=true;
  $('jsonPreview').textContent=JSON.stringify(selected,null,2);
  feedback('Saved to this browser draft. Download or copy the full JSON to publish.');
 }
 function show(){
  if(!selected)return;
  $('editorName').textContent=selected.name;$('editorId').textContent=selected.id;
  $('editorPortrait').src='/'+String(selected.img||'').replace(/^\/+/,'');
  $('editPrestige').value=Number(selected.prestige)||0;
  $('editOwned').checked=selected.owned!==false;$('editMain').checked=selected.main===true;
  $('editRotation').checked=selected.rotation===true;$('editShowName').checked=selected.nameshown!==false;
  const fav=selected.favLoadout||{};
  $('editPerks').value=(fav.perks||[]).map(x=>typeof x==='string'?x:x.name||'').join('\n');
  $('editAddons').value=(fav.addons||[]).map(x=>typeof x==='string'?x:x.name||'').join('\n');
  $('editOffering').value=fav.offering||'';$('editNotes').value=fav.notes||'';
  $('editClips').value=(selected.clips||[]).map(x=>(x.title||'Clip')+' | '+(x.url||'')).join('\n');
  $('jsonPreview').textContent=JSON.stringify(selected,null,2);
 }
 function refreshList(){
  const search=$('characterSearch').value.toLowerCase().trim();
  $('characterList').innerHTML='';
  const filtered=list().filter(x=>!search||[x.id,x.name].join(' ').toLowerCase().includes(search));
  for(const entry of filtered){
   const button=document.createElement('button');button.type='button';
   button.className=entry===selected?'selected':'';
   button.innerHTML='<img loading="lazy" alt="" src="/'+esc(String(entry.img||'').replace(/^\/+/,''))+'"><span>'+esc(entry.name)+'<small>Prestige '+esc(entry.prestige??0)+'</small></span>';
   button.onclick=()=>{try{if(selected)draft();}catch(err){feedback(err.message);return;}selected=entry;show();refreshList();};
   $('characterList').append(button);
  }
  if(!filtered.length)$('characterList').textContent='No matching characters.';
 }
 function loadType(newType){
  try{if(selected)draft();}catch(err){feedback(err.message);$('collectionType').value=type;return;}
  type=newType;selected=list()[0]||null;show();refreshList();
  $('editOnGitHub').href='https://github.com/Sic4rioDragon/deadbydaylight.sic4riodragon.uk/edit/main/'+label();
  feedback('Edits stay local until you download or copy the JSON.');
 }
 const serialize=()=>{if(selected)draft();const copy=JSON.parse(JSON.stringify(collections[type]));copy.updated=new Date().toISOString().slice(0,10);return JSON.stringify(copy,null,2)+'\n';};
 $('collectionType').addEventListener('change',()=>loadType($('collectionType').value));
 $('characterSearch').addEventListener('input',refreshList);
 $('saveCharacter').onclick=()=>{try{draft();refreshList();}catch(err){feedback(err.message);}};
 $('downloadCollection').onclick=()=>{
  try{
   const text=serialize(),url=URL.createObjectURL(new Blob([text],{type:'application/json'}));
   const a=document.createElement('a');a.href=url;a.download=label();a.click();setTimeout(()=>URL.revokeObjectURL(url),2500);
   feedback('Downloaded '+label()+'. Replace the file on GitHub and commit it to publish.');
  }catch(err){feedback(err.message);}
 };
 $('copyCollection').onclick=async()=>{try{const content=serialize();await navigator.clipboard.writeText(content);feedback('Copied the complete '+label()+'. Paste into the GitHub editor and commit.');}catch(err){feedback('Clipboard failed. Use Download JSON instead. '+err.message);}};
 window.addEventListener('beforeunload',e=>{if(dirty){e.preventDefault();e.returnValue='';}});
 loadType('killers');
})().catch(err=>{console.error(err);document.getElementById('editorFeedback').textContent='Could not load collection data.';});