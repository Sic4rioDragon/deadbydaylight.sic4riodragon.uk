(async () => {
  const host = document.getElementById('homePlayers');
  if (!host) return;
  const safe = s => String(s ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
  try {
    const res = await fetch('/achievements/players.json', {cache:'no-store'});
    if (!res.ok) throw new Error('Players unavailable');
    const players = await res.json();
    const cards = await Promise.all(players.map(async p => {
      let info = {};
      try {
        const r = await fetch('/achievements/players/'+encodeURIComponent(p.steamid)+'.json', {cache:'no-store'});
        if (r.ok) info = await r.json();
      } catch {}
      const name = p.overrideName || info.steamName || p.fallbackName || p.steamid;
      const avatar = info.avatar || '/assets/img/deadbydaylight_icon.png';
      const sync = info.lastSync ? 'Updated '+new Date(info.lastSync).toLocaleDateString() : 'Awaiting first sync';
      return '<a class="hub-player" href="/achievements/?player='+encodeURIComponent(p.steamid)+'"><img alt="" loading="lazy" src="'+safe(avatar)+'"><span><strong>'+safe(name)+'</strong><small>'+safe(sync)+'</small></span></a>';
    }));
    host.innerHTML = cards.join('') || '<span>No players added yet.</span>';
  } catch {
    host.textContent = 'Player list is temporarily unavailable.';
  }
})();