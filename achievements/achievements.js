const baseUrl = './achievements.base.json';
const playerIndexUrl = './players.json';
let stateUrl = './achievements.json';

const iconsUrl = './achievements.icons.json';

const els = {
  countUnlocked: document.getElementById('countUnlocked'),
  countLocked: document.getElementById('countLocked'),
  countShown: document.getElementById('countShown'),

  survivorSummary: document.getElementById('survivorSummary'),
  killerSummary: document.getElementById('killerSummary'),
  generalSummary: document.getElementById('generalSummary'),

  survivorSummaryCounts: document.getElementById('survivorSummaryCounts'),
  killerSummaryCounts: document.getElementById('killerSummaryCounts'),
  generalSummaryCounts: document.getElementById('generalSummaryCounts'),

  survivorSections: document.getElementById('survivorSections'),
  killerSections: document.getElementById('killerSections'),
  generalSections: document.getElementById('generalSections'),

  searchInput: document.getElementById('searchInput'),
  toggleUnlocked: document.getElementById('toggleUnlocked'),
  filterSelect: document.getElementById('filterSelect'),
  toggleFarmable: document.getElementById('toggleFarmable'),
  farmableCount: document.getElementById('farmableCount')
};

const SECTION_ORDER = {
  killer: ['adept', 'general', 'extra'],
  survivor: ['adept', 'map', 'general'],
  general: ['general']
};

let state = {
  search: '',
  showUnlocked: false,
  farmableOnly: false,
  farming: {},
  filter: 'all',
  items: [],
  icons: {}
};

async function loadOptionalJson(url, fallback) {
  try {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) return fallback;
    return await res.json();
  } catch {
    return fallback;
  }
}

function normalize(value) {
  return String(value || '').toLowerCase().trim();
}

function flattenState(grouped) {
  const out = new Map();

  for (const [topKey, topValue] of Object.entries(grouped || {})) {
    if (!topValue || typeof topValue !== 'object') continue;

    for (const [sectionKey, sectionValue] of Object.entries(topValue)) {
      if (!sectionValue || typeof sectionValue !== 'object') continue;

      for (const [achievementId, rawValue] of Object.entries(sectionValue)) {
        let unlocked = false;
        let progress = null;
        let goal = null;

        if (typeof rawValue === 'boolean') {
          unlocked = rawValue;
        } else if (rawValue && typeof rawValue === 'object') {
          unlocked = !!rawValue.unlocked;
          progress = Number.isFinite(rawValue.progress) ? rawValue.progress : 0;
          goal = Number.isFinite(rawValue.goal) ? rawValue.goal : 0;
        }

        if (out.has(achievementId) && out.get(achievementId).unlocked && !unlocked) continue;
        out.set(achievementId, {
          unlocked,
          progress,
          goal,
          category:
            topKey === 'survivors'
              ? 'survivor'
              : topKey === 'killers'
                ? 'killer'
                : 'general',
          section: sectionKey
        });
      }
    }
  }

  return out;
}

function matchesSearch(item, search) {
  if (!search) return true;

  const haystack = [
    item.title,
    item.description,
    item.category,
    item.section,
    item.achievement_id
  ].join(' ').toLowerCase();

  return haystack.includes(search);
}

function matchesFilter(item, filter) {
  if (!filter || filter === 'all') return true;

  if (filter === 'killer' || filter === 'survivor' || filter === 'general') {
    return item.category === filter;
  }

  if (filter === 'adept' || filter === 'map' || filter === 'extra') {
    return item.section === filter;
  }

  if (filter === 'general-section') {
    return item.section === 'general';
  }

  return true;
}

function getVisibleItems(items) {
  return items.filter(item => {
    const passesUnlocked = state.showUnlocked ? true : !item.unlocked;
    const passesFarming = !state.farmableOnly || (!item.unlocked && !!state.farming[item.achievement_id]);
    return passesUnlocked && passesFarming && matchesSearch(item, state.search) && matchesFilter(item, state.filter);
  });
}

function countLocked(items) {
  return items.filter(item => !item.unlocked).length;
}

function countUnlocked(items) {
  return items.filter(item => item.unlocked).length;
}

function prettySectionName(section) {
  if (section === 'adept') return 'Adept';
  if (section === 'map') return 'Map';
  if (section === 'extra') return 'Extra';
  return 'General';
}

function escapeHtml(text) {
  return String(text ?? '').replace(/[&<>"']/g, c => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

function renderSummary(container, items, category) {
  if (!container) return;

  const order = SECTION_ORDER[category] || ['general'];

  const groups = order
    .map(section => ({
      section,
      items: items.filter(item => item.section === section)
    }))
    .filter(group => group.items.length > 0);

  if (!groups.length) {
    container.innerHTML = `<div class="summary-row"><strong>No achievements</strong><span>0</span></div>`;
    return;
  }

  container.innerHTML = groups.map(group => `
    <div class="summary-row">
      <strong>${prettySectionName(group.section)}</strong>
      <span>${countLocked(group.items)} locked / ${group.items.length}</span>
    </div>
  `).join('');
}

function renderSections(container, items, category) {
  if (!container) return;

  const order = SECTION_ORDER[category] || ['general'];

  const groups = order
    .map(section => ({
      section,
      items: items.filter(item => item.section === section)
    }))
    .filter(group => group.items.length > 0);

  if (!groups.length) {
    container.innerHTML = `<div class="empty">No achievements match the current filters.</div>`;
    return;
  }

  container.innerHTML = groups.map(group => `
    <details class="subsection" open>
      <summary class="subsection-head">
        <h3>${prettySectionName(group.section)}</h3>
        <span>${countLocked(group.items)} locked / ${group.items.length}</span>
      </summary>
      <div class="achievement-list">
        ${group.items.map(renderAchievementCard).join('')}
      </div>
    </details>
  `).join('');
}

function renderAchievementCard(item) {
  const icon = state.icons[item.achievement_id] || '';
  const guide = !item.unlocked ? state.farming[item.achievement_id] : null;
  const farmLinks = guide && Array.isArray(guide.methods) ? guide.methods.filter(m => m.url?.startsWith('https://dbdfarming.sic4riodragon.uk/')) : [];
  const farmHtml = farmLinks.length ? `<div class="farming-method-links"><span class="farming-label">Farming guide</span>${farmLinks.slice(0,2).map(m => `<a href="${escapeHtml(m.url)}" target="_blank" rel="noopener noreferrer" title="${escapeHtml(m.summary || '')}">${escapeHtml(m.name)} ↗</a>`).join('')}${guide.guideUrl?.startsWith('https://dbdfarming.sic4riodragon.uk/') ? `<a class="farming-all" href="${escapeHtml(guide.guideUrl)}" target="_blank" rel="noopener noreferrer">Full guide</a>` : ''}</div>` : '';
  const hasProgress = !item.unlocked && Number.isFinite(item.progress) && Number.isFinite(item.goal) && item.goal > 1;

  let metaHtml = '';

  if (item.unlocked) {
    metaHtml = `
      <div class="achievement-meta">
        <span class="achievement-state achievement-state-done">Done</span>
        <strong>${item.unlockedAt ? escapeHtml(new Date(item.unlockedAt).toLocaleDateString()) : 'Done'}</strong>
      </div>
    `;
  } else if (hasProgress) {
    const safeProgress = Math.max(0, item.progress);
    const safeGoal = Math.max(1, item.goal);
    const percent = Math.max(0, Math.min(100, (safeProgress / safeGoal) * 100));
    const percentLabel = Number.isInteger(percent) ? String(percent) : percent.toFixed(1);

    metaHtml = `
      <div class="achievement-meta achievement-meta-progress">
        <span class="achievement-state">Locked</span>
        <strong>${safeProgress} / ${safeGoal}</strong>
        <small title="Steam does not provide live partial-progress counters for every achievement">${item.progressUpdatedAt ? `Saved ${escapeHtml(new Date(item.progressUpdatedAt).toLocaleDateString())}` : 'Saved progress'}</small>
        <div class="achievement-progress-wrap">
          <div class="achievement-progress-label">${percentLabel}%</div>
          <div class="achievement-progressbar">
            <div class="achievement-progressbar-inner" style="width:${percent}%;"></div>
          </div>
        </div>
      </div>
    `;
  } else {
    metaHtml = `
      <div class="achievement-meta">
        <span class="achievement-state">Locked</span>
        <strong>0 / 1</strong>
      </div>
    `;
  }

  return `
    <article class="achievement ${item.unlocked ? 'is-unlocked' : 'is-locked'} ${farmLinks.length ? 'has-farming-guide' : ''}">
      <div class="achievement-icon-wrap">
        ${icon ? `<img class="achievement-icon" src="${escapeHtml(icon)}" alt="${escapeHtml(item.title)}">` : ''}
      </div>
      <div class="achievement-copy">
        <div class="achievement-topline">
          <h4>${escapeHtml(item.title)}</h4>
        </div>
        <p>${escapeHtml(item.description)}</p>
        ${farmHtml}
      </div>
      ${metaHtml}
    </article>
  `;
}

function updateCounters(allItems, visibleItems) {
  els.countUnlocked.textContent = String(countUnlocked(allItems));
  els.countLocked.textContent = String(countLocked(allItems));
  els.countShown.textContent = String(visibleItems.length);
  if(els.farmableCount) els.farmableCount.textContent = String(allItems.filter(item => !item.unlocked && state.farming[item.achievement_id]).length);
}

function render() {
  const allItems = state.items.slice();
  const visibleItems = getVisibleItems(allItems);

  const killerItems = visibleItems.filter(item => item.category === 'killer');
  const survivorItems = visibleItems.filter(item => item.category === 'survivor');
  const generalItems = visibleItems.filter(item => item.category === 'general');

  updateCounters(allItems, visibleItems);

  if (els.killerSummaryCounts) {
    els.killerSummaryCounts.textContent = `${countLocked(allItems.filter(i => i.category === 'killer'))} locked`;
  }
  if (els.survivorSummaryCounts) {
    els.survivorSummaryCounts.textContent = `${countLocked(allItems.filter(i => i.category === 'survivor'))} locked`;
  }
  if (els.generalSummaryCounts) {
    els.generalSummaryCounts.textContent = `${countLocked(allItems.filter(i => i.category === 'general'))} locked`;
  }

  renderSummary(els.killerSummary, killerItems, 'killer');
  renderSummary(els.survivorSummary, survivorItems, 'survivor');
  renderSummary(els.generalSummary, generalItems, 'general');

  renderSections(els.killerSections, killerItems, 'killer');
  renderSections(els.survivorSections, survivorItems, 'survivor');
  renderSections(els.generalSections, generalItems, 'general');
}


function renderRecentUnlocks(){
 const host=document.getElementById('latestUnlocks');if(!host)return;
 const recent=state.items.filter(i=>i.unlocked&&i.unlockedAt&&Number.isFinite(Date.parse(i.unlockedAt)))
  .sort((a,b)=>Date.parse(b.unlockedAt)-Date.parse(a.unlockedAt)).slice(0,8);
 host.innerHTML=recent.map(item=>{
  const icon=state.icons[item.achievement_id]||'/assets/img/deadbydaylight_icon.png';
  return '<div class="recent-item"><img loading="lazy" alt="" src="'+escapeHtml(icon)+'"><span><strong>'+escapeHtml(item.title)+'</strong><small>'+escapeHtml(new Date(item.unlockedAt).toLocaleDateString())+'</small></span></div>';
 }).join('')||'<span>No recorded unlock dates yet.</span>';
}

async function init() {
  const players = await loadOptionalJson(playerIndexUrl, []);
  const idFromUrl = new URLSearchParams(location.search).get('player');
  const selected = Array.isArray(players) && players.find(p => p.steamid === idFromUrl) || (Array.isArray(players) ? players[0] : null);
  let profile = null;
  const select = document.getElementById('playerSelect');
  const status = document.getElementById('playerSyncStatus');
  const steamLink = document.getElementById('playerSteamLink');
  const nightlightLink = document.getElementById('playerNightlightLink');
  if (selected) {
    const options = await Promise.all(players.map(async p => {
      const data = await loadOptionalJson('./players/' + encodeURIComponent(p.steamid) + '.json', {});
      return { ...p, profile: data };
    }));
    if (select) {
      for (const p of options) {
        const option = document.createElement('option');
        option.value = p.steamid;
        option.textContent = p.overrideName || p.profile.steamName || p.fallbackName || p.steamid;
        option.selected = p.steamid === selected.steamid;
        select.appendChild(option);
      }
      select.addEventListener('change', () => {
        const url = new URL(location.href);
        url.searchParams.set('player', select.value);
        location.href = url.toString();
      });
    }
    profile = options.find(p=>p.steamid===selected.steamid)?.profile || {};
    if (steamLink) steamLink.href = 'https://steamcommunity.com/profiles/' + selected.steamid;
    if (nightlightLink) nightlightLink.href = 'https://nightlight.gg/steam-stats/profile/' + selected.steamid + '/achievements';
    if (status) {
      status.textContent = profile.syncStatus === 'unavailable'
        ? (profile.lastSync ? 'Latest sync failed — showing last successful data from ' + new Date(profile.lastSync).toLocaleString() : 'Steam achievements unavailable — last attempt ' + (profile.lastAttempt ? new Date(profile.lastAttempt).toLocaleString() : 'unknown'))
        : (profile.lastSync ? 'Last synced: ' + new Date(profile.lastSync).toLocaleString() : 'Awaiting first Steam sync');
      if (profile.syncReason) status.title = profile.syncReason;
    }
    const displayName = selected.overrideName || profile.steamName || selected.fallbackName || selected.steamid;
    if (document.getElementById('profileName')) document.getElementById('profileName').textContent = displayName;
    document.title = 'DBD Achievements — ' + displayName;
    const pageTitle = document.getElementById('achievementsPageTitle');
    if (pageTitle) pageTitle.textContent = 'Achievements — ' + displayName;
    if (document.getElementById('profileAvatar') && profile.avatar) document.getElementById('profileAvatar').src = profile.avatar;
    stateUrl = './players/' + encodeURIComponent(selected.steamid) + '.json';
  }
  if (selected && !profile?.lastSync) {
    const note = '<div class="empty">No DBD achievement snapshot available for this player yet. Check Steam Game details visibility and whether the account has played Dead by Daylight.</div>';
    for (const el of [els.killerSections, els.survivorSections, els.generalSections, document.getElementById('latestUnlocks')]) {
      if (el) el.innerHTML = note;
    }
    for (const el of [els.countUnlocked, els.countLocked, els.countShown]) {
      if (el) el.textContent = '—';
    }
    for (const el of [els.killerSummaryCounts,els.survivorSummaryCounts,els.generalSummaryCounts]) {
      if (el) el.textContent = 'Unavailable';
    }
    return;
  }
  const [base, groupedState, icons, farmData] = await Promise.all([
    fetch(baseUrl, { cache: 'no-store' }).then(r => r.json()),
    fetch(stateUrl, { cache: 'no-store' }).then(r => r.json()),
    loadOptionalJson(iconsUrl, {}),
    loadOptionalJson('./farming-links.json', {mapping:{}})
  ]);
  state.farming = farmData.mapping || {};

  const stateMap = flattenState(groupedState.state || groupedState);
  state.icons = icons || {};

 state.items = base.map(item => {
  const entry = stateMap.get(item.achievement_id) || {
    unlocked: false,
    progress: null,
    goal: null,
    category: item.category,
    section: item.section
  };

  return {
    ...item,
    unlocked: !!entry.unlocked,
    progress: Number.isFinite(entry.progress) ? entry.progress : null,
    goal: Number.isFinite(entry.goal) ? entry.goal : null,
    unlockedAt: entry.unlockedAt || null,
    progressSource: entry.progressSource || null,
    progressUpdatedAt: entry.progressUpdatedAt || null
  };
});

  els.searchInput?.addEventListener('input', () => {
    state.search = normalize(els.searchInput.value);
    render();
  });

  state.farmableOnly = new URLSearchParams(location.search).get('farmable') === '1';
  if(els.toggleFarmable) els.toggleFarmable.checked=state.farmableOnly;
  els.toggleFarmable?.addEventListener('change', () => {
    state.farmableOnly = !!els.toggleFarmable.checked;
    const url = new URL(location.href);
    if(state.farmableOnly) url.searchParams.set('farmable', '1'); else url.searchParams.delete('farmable');
    history.replaceState(null,'',url);
    render();
  });

  els.toggleUnlocked?.addEventListener('change', () => {
    state.showUnlocked = !!els.toggleUnlocked.checked;
    render();
  });

  els.filterSelect?.addEventListener('change', () => {
    state.filter = els.filterSelect.value;
    render();
  });

  render();
  renderRecentUnlocks();
}

init().catch(error => {
  console.error(error);

  const msg = '<div class="empty">Failed to load achievements data.</div>';
  if (els.killerSections) els.killerSections.innerHTML = msg;
  if (els.survivorSections) els.survivorSections.innerHTML = msg;
  if (els.generalSections) els.generalSections.innerHTML = msg;
});