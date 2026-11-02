(() => {
  const links = [
    ['/', 'Home'], ['/killers/', 'Killers'], ['/survivors.html', 'Survivors'],
    ['/achievements/', 'Achievements'], ['/dbd-rulebook/', 'Rulebook'],
    ['https://dbdfarming.sic4riodragon.uk/', 'Farming guide'],
    ['https://sic4riodragon.uk/twitch/deadbydaylight/', 'Challenges']
  ];
  const esc = s => String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const path = location.pathname;
  let header = document.querySelector('.site-header');
  if (!header) {
    header = document.createElement('header');
    header.className = 'site-header';
    document.body.prepend(header);
  }
  header.innerHTML = '<a class="site-brand" href="/"><img src="/assets/img/deadbydaylight_icon.png" alt="" loading="lazy"><span>DEAD BY DAYLIGHT<small>Sic4rioDragon</small></span></a>' +
    '<nav class="site-links" aria-label="Main navigation">' + links.map(([url,label]) => {
      const selected = url.startsWith('/') && (url==='/' ? path==='/' : path.startsWith(url.replace('survivors.html','survivors')));
      return '<a href="'+esc(url)+'"'+(selected?' aria-current="page"':'')+'>'+esc(label)+'</a>';
    }).join('') + '</nav>';
})();
