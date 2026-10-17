(() => {
  'use strict';

  const ARCHIVE_UPLOADS_URL = 'https://archive.org/details/@zak_firdous/uploads';
  const SEARCH_URL = 'https://archive.org/advancedsearch.php';
  const fallbackPath = './archive-uploads.json';
  const grid = document.getElementById('archiveGrid');
  const filters = document.getElementById('filters');
  const searchBox = document.getElementById('searchBox');
  const countLabel = document.getElementById('itemCount');
  let allItems = [];
  let activeFilter = 'all';
  let searchTerm = '';

  const htmlEscape = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[character]));

  function plainDescription(value) {
    const html = Array.isArray(value) ? value.join('\n\n') : String(value || '');
    if (!html) return '';
    const parsed = new DOMParser().parseFromString(html, 'text/html');
    parsed.querySelectorAll('a').forEach((anchor) => {
      const href = anchor.getAttribute('href');
      if (href && /^https?:\/\//i.test(href) && !anchor.textContent.includes(href)) {
        anchor.append(parsed.createTextNode(` (${href})`));
      }
    });
    parsed.querySelectorAll('br').forEach((br) => br.replaceWith(parsed.createTextNode('\n')));
    parsed.querySelectorAll('p,div,li,h1,h2,h3').forEach((block) => block.append(parsed.createTextNode('\n\n')));
    return (parsed.body.innerText || parsed.body.textContent || '')
      .replace(/[\t\u00a0 ]+\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  function licenseInfo(item) {
    const url = String(item.licenseurl || item.license_url || '').trim();
    const description = plainDescription(item.description).toLowerCase();
    const cc0Listed = /creativecommons\.org\/publicdomain\/zero\/1\.0\/?/i.test(url);
    const explicitNonCC0 = /not under cc0|not cc0|not licensed under cc0|not covered by cc0|does not apply to (?:the )?(?:music|audio|background|cc0)|music (?:is )?not (?:under cc0|cc0|free)|do not use music|not to be used for commercial|not for commercial use|non-commercial|noncommercial/i.test(description);
    const exclusions = /not under cc0|not cc0|does not apply|not free|do not use|not to be used for commercial|non-commercial|noncommercial|terms of use|personal\/social use|background art/i.test(description);

    if (cc0Listed && exclusions) {
      return { state: 'caution', label: 'CC0 LISTED · EXCLUSIONS IN DESCRIPTION', openDescription: true, url };
    }
    if (cc0Listed) {
      return { state: 'cc0', label: 'CC0 LISTED', openDescription: false, url };
    }
    if (url) {
      const license = url.match(/creativecommons\.org\/licenses\/([^/]+)\/([0-9.]+)/i);
      const label = license ? `CC ${license[1].toUpperCase()} ${license[2]} · NOT CC0` : 'NON-CC0 LICENSE';
      return { state: 'noncc0', label, openDescription: true, url };
    }
    if (explicitNonCC0) {
      return { state: 'noncc0', label: 'NOT CC0 · DESCRIPTION SAYS SO', openDescription: true, url: '' };
    }
    return { state: 'unverified', label: 'NO CC0 LICENSE LISTED', openDescription: true, url: '' };
  }

  function safeArchiveItemUrl(item) {
    const identifier = String(item.identifier || '').trim();
    return identifier ? `https://archive.org/details/${encodeURIComponent(identifier)}` : ARCHIVE_UPLOADS_URL;
  }

  function formatDate(value) {
    if (!value) return 'DATE NOT LISTED';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value).slice(0, 10);
    return new Intl.DateTimeFormat('en', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' }).format(date);
  }

  function isModel(item) {
    const text = `${item.title || ''} ${item.identifier || ''}`.toLowerCase();
    return Number(item.modelFileCount || 0) > 0 || /\.glb\b|\.gltf\b|schoolgirl\.glb/.test(text);
  }

  function buildCard(item, index) {
    const identifier = String(item.identifier || 'archive-item');
    const title = String(item.title || identifier);
    const description = plainDescription(item.description);
    const status = licenseInfo(item);
    const href = safeArchiveItemUrl(item);
    const thumb = `https://archive.org/services/img/${encodeURIComponent(identifier)}`;
    const kind = isModel(item) ? '3D MODEL / NOT A VIDEO' : 'VIDEO / ARCHIVE ITEM';

    const card = document.createElement('article');
    card.className = 'archive-card';
    card.dataset.state = status.state;
    card.dataset.kind = isModel(item) ? 'model' : 'video';
    card.dataset.search = `${title} ${identifier} ${description} ${status.label}`.toLowerCase();
    card.innerHTML = `
      <div class="card-head">
        <a class="thumb" href="${htmlEscape(href)}" target="_blank" rel="noopener noreferrer" aria-label="Open ${htmlEscape(title)} on Internet Archive">
          <img src="${htmlEscape(thumb)}" alt="" loading="lazy">
          <span class="thumb-index">${String(index + 1).padStart(2, '0')}</span>
        </a>
        <div class="card-heading">
          <div class="card-meta"><span class="kind">${kind}</span><span>${htmlEscape(formatDate(item.publicdate || item.date))}</span></div>
          <h2><a href="${htmlEscape(href)}" target="_blank" rel="noopener noreferrer">${htmlEscape(title)}</a></h2>
          <span class="license-badge ${status.state}">${htmlEscape(status.label)}</span>
        </div>
      </div>
      <div class="card-bottom">
        <details class="desc"${status.openDescription ? ' open' : ''}>
          <summary>FULL ARCHIVE DESCRIPTION <span>${htmlEscape(identifier)}</span></summary>
          <div class="desc-text"></div>
          ${status.url ? `<a class="license-source" href="${htmlEscape(status.url)}" target="_blank" rel="noopener noreferrer">VIEW LISTED LICENSE ↗</a>` : ''}
        </details>
        <div class="card-actions"><a class="item-link" href="${htmlEscape(href)}" target="_blank" rel="noopener noreferrer">OPEN ORIGINAL ITEM <span>↗</span></a><span class="action-note">HOSTED BY INTERNET ARCHIVE</span></div>
      </div>`;
    card.querySelector('.desc-text').textContent = description || 'No description was supplied for this item.';
    const image = card.querySelector('.thumb img');
    image.addEventListener('error', () => image.remove(), { once: true });
    return card;
  }

  function renderFilters() {
    const options = [
      ['all', 'ALL UPLOADS'],
      ['cc0', 'CC0 LISTED'],
      ['review', 'NON-CC0 / REVIEW'],
      ['video', 'VIDEO ITEMS'],
      ['model', '3D ASSETS']
    ];
    filters.innerHTML = options.map(([value, label], index) => `<button class="filter-btn${index === 0 ? ' active' : ''}" type="button" data-filter="${value}" aria-pressed="${index === 0 ? 'true' : 'false'}">${label}</button>`).join('');
  }

  function applyFilters() {
    let visible = 0;
    for (const card of grid.querySelectorAll('.archive-card')) {
      const state = card.dataset.state;
      const category = card.dataset.kind;
      const matchesFilter = activeFilter === 'all'
        || (activeFilter === 'cc0' && state === 'cc0')
        || (activeFilter === 'review' && state !== 'cc0')
        || activeFilter === category;
      const matchesSearch = !searchTerm || card.dataset.search.includes(searchTerm);
      card.hidden = !(matchesFilter && matchesSearch);
      if (!card.hidden) visible += 1;
    }
    countLabel.textContent = `${String(visible).padStart(2, '0')} OF ${String(allItems.length).padStart(2, '0')} UPLOADS`;
    filters.querySelectorAll('.filter-btn').forEach((button) => {
      const active = button.dataset.filter === activeFilter;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
    const oldEmpty = grid.querySelector('.empty');
    if (oldEmpty) oldEmpty.remove();
    if (!visible) {
      const empty = document.createElement('div');
      empty.className = 'empty';
      empty.textContent = 'No Archive items match this filter.';
      grid.append(empty);
    }
  }

  function renderItems(items) {
    allItems = items.slice().sort((a, b) => String(b.publicdate || b.date || '').localeCompare(String(a.publicdate || a.date || '')));
    grid.replaceChildren();
    allItems.forEach((item, index) => grid.append(buildCard(item, index)));
    grid.setAttribute('aria-busy', 'false');
    renderFilters();
    applyFilters();
  }

  async function getLiveUploads() {
    const url = new URL(SEARCH_URL);
    url.searchParams.set('q', 'uploader:zakfirdous@gmail.com mediatype:movies');
    ['identifier', 'title', 'description', 'licenseurl', 'publicdate', 'mediatype'].forEach((field) => url.searchParams.append('fl[]', field));
    url.searchParams.append('sort[]', 'publicdate desc');
    url.searchParams.set('rows', '100');
    url.searchParams.set('output', 'json');
    const response = await fetch(url.toString(), { headers: { Accept: 'application/json' }, cache: 'no-store' });
    if (!response.ok) throw new Error(`Archive search returned ${response.status}`);
    const data = await response.json();
    const docs = data?.response?.docs;
    if (!Array.isArray(docs) || docs.length === 0) throw new Error('No Archive uploads returned');
    return docs;
  }

  async function getFallbackUploads() {
    const response = await fetch(fallbackPath, { cache: 'no-store' });
    if (!response.ok) throw new Error('Bundled Archive list unavailable');
    const data = await response.json();
    return Array.isArray(data.items) ? data.items : [];
  }

  filters.addEventListener('click', (event) => {
    const button = event.target.closest('[data-filter]');
    if (!button) return;
    activeFilter = button.dataset.filter;
    applyFilters();
  });
  searchBox.addEventListener('input', () => {
    searchTerm = searchBox.value.trim().toLowerCase();
    applyFilters();
  });

  (async () => {
    try {
      const live = await getLiveUploads();
      renderItems(live);
    } catch (error) {
      try {
        const fallback = await getFallbackUploads();
        renderItems(fallback);
        const count = document.getElementById('itemCount');
        if (count) count.title = 'Showing the bundled snapshot; live Archive lookup was unavailable.';
      } catch (_) {
        grid.innerHTML = '<div class="error">COULD NOT LOAD THE ARCHIVE LIST. <a href="https://archive.org/details/@zak_firdous/uploads" target="_blank" rel="noopener noreferrer">OPEN ARCHIVE.ORG ↗</a></div>';
        grid.setAttribute('aria-busy', 'false');
        countLabel.textContent = 'ARCHIVE UNAVAILABLE';
      }
    }
  })();
})();
