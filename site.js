(() => {
  'use strict';

  document.documentElement.classList.remove('no-js');
  document.documentElement.classList.add('js');

  const ARCHIVE_PAGE = 'https://archive.org/details/lv_0_20260905132546';
  const videoGrid = document.getElementById('videoGrid');
  const filterList = document.getElementById('filterList');
  const countLabel = document.getElementById('libraryCount');
  const heroVideo = document.getElementById('heroVideo');
  const dialog = document.getElementById('videoDialog');
  const dialogVideo = document.getElementById('dialogVideo');
  const dialogTitle = document.getElementById('dialogTitle');
  const dialogMeta = document.getElementById('dialogMeta');
  const dialogSource = document.getElementById('dialogSource');
  let currentFilter = 'all';
  let libraryItems = [];

  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[character]));

  const safeUrl = (value) => {
    if (typeof value !== 'string' || !value.trim()) return '';
    try {
      const parsed = new URL(value, window.location.href);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return '';
      return parsed.href;
    } catch (_) {
      return '';
    }
  };

  const titleCase = (value) => String(value || 'OPEN MOTION').replace(/[_-]+/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());

  function observeReveals(root = document) {
    const nodes = root.querySelectorAll('[data-reveal]:not(.is-observed)');
    if (!('IntersectionObserver' in window)) {
      nodes.forEach((node) => node.classList.add('is-visible', 'is-observed'));
      return;
    }
    const observer = new IntersectionObserver((entries, instance) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          instance.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
    nodes.forEach((node) => {
      node.classList.add('is-observed');
      observer.observe(node);
    });
  }

  const placeholderMarkup = (number, title, note) => `
    <article class="placeholder-card" data-category="future" data-placeholder="true" data-reveal>
      <div class="placeholder-top"><span>OPEN SLOT / ${number}</span><span>COMING INTO FOCUS</span></div>
      <div class="placeholder-center" aria-hidden="true"><b>+</b></div>
      <div class="placeholder-bottom"><strong>${title}</strong><span>${note}</span></div>
    </article>`;

  function makeCard(item, index) {
    const source = safeUrl(item.source || item.url);
    if (!source) return '';
    const poster = safeUrl(item.poster || '');
    const title = item.title || 'Untitled animation';
    const category = titleCase(item.category || (item.featured ? 'FEATURED' : 'NEW DROP')).toUpperCase();
    const origin = item.origin || (item.featured ? 'INTERNET ARCHIVE' : 'OPEN MOTION');
    const duration = item.duration || 'NEW';
    const license = item.license || (item.featured ? 'VERIFY LICENSE' : 'LICENSE NOTE');
    const isFeatured = Boolean(item.featured || item.id === 'archive-feature');
    const cardNumber = String(index + 1).padStart(2, '0');
    const sourceLink = safeUrl(item.permalink || (isFeatured ? ARCHIVE_PAGE : source));
    const posterAttribute = poster ? ` poster="${esc(poster)}"` : '';

    return `
      <article class="video-card" data-featured="${isFeatured ? 'true' : 'false'}" data-category="${esc(category.toLowerCase())}" data-reveal>
        <div class="card-visual" data-palette="${index % 4}">
          ${poster ? `<img class="card-poster" src="${esc(poster)}" alt="" loading="lazy">` : '<div class="card-art-orbit" aria-hidden="true"></div><div class="card-art-center" aria-hidden="true">✳</div>'}
          <video class="card-video" src="${esc(source)}"${posterAttribute} muted loop playsinline preload="none" aria-hidden="true" tabindex="-1"></video>
          <span class="card-code">${isFeatured ? 'FEATURED / ' : 'NEW DROP / '}${cardNumber}</span>
          <span class="card-duration">${esc(duration)}</span>
          <button class="card-watch" type="button" data-watch="${esc(source)}" data-title="${esc(title)}" data-origin="${esc(origin)}" data-permalink="${esc(sourceLink)}" aria-label="Watch ${esc(title)}">
            <svg viewBox="0 0 14 14" aria-hidden="true"><path d="M4 2.5 11 7l-7 4.5v-9Z" fill="currentColor"/></svg> WATCH REEL
          </button>
        </div>
        <div class="card-meta">
          <div><p>${esc(origin)} <span aria-hidden="true">/</span> ${esc(category)}</p><h3 title="${esc(title)}">${esc(title)}</h3></div>
          <button class="card-open" type="button" data-watch="${esc(source)}" data-title="${esc(title)}" data-origin="${esc(origin)}" data-permalink="${esc(sourceLink)}" aria-label="Open ${esc(title)}">↗</button>
        </div>
        <div class="card-foot"><span>${isFeatured ? 'SOURCE LINKED' : 'ADDED TO THE SHELF'}</span><span class="card-license">${esc(license).toUpperCase()}</span></div>
      </article>`;
  }

  function renderFilters(items) {
    const categories = [...new Set(items.map((item) => titleCase(item.category || (item.featured ? 'FEATURED' : 'NEW DROP')).toUpperCase()))];
    const choices = [['all', 'ALL'], ...categories.map((category) => [category.toLowerCase(), category])];
    filterList.innerHTML = choices.map(([value, label], index) => `
      <button class="filter-button${index === 0 ? ' is-active' : ''}" type="button" data-filter="${esc(value)}" aria-pressed="${index === 0 ? 'true' : 'false'}">${esc(label)}</button>`).join('');
  }

  function applyFilter(filter) {
    currentFilter = filter;
    videoGrid.querySelectorAll('.video-card, .placeholder-card').forEach((card) => {
      const category = card.dataset.category || '';
      const show = filter === 'all' || category === filter;
      card.hidden = !show;
    });
    filterList.querySelectorAll('.filter-button').forEach((button) => {
      const active = button.dataset.filter === filter;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
  }

  function renderLibrary(items) {
    libraryItems = items.filter((item) => safeUrl(item.source || item.url));
    renderFilters(libraryItems);
    const cards = libraryItems.map(makeCard).join('');
    const emptySlots = Math.max(0, 4 - libraryItems.length);
    const slotData = [
      ['02', 'THE NEXT DROP', 'YOUR CLIP HERE'],
      ['03', 'ANOTHER WORLD', 'READY WHEN YOU ARE'],
      ['04', 'MORE MOTION', 'STAY TUNED']
    ];
    const placeholders = Array.from({ length: emptySlots }, (_, index) => placeholderMarkup(...slotData[index % slotData.length])).join('');
    videoGrid.innerHTML = cards + placeholders;
    videoGrid.setAttribute('aria-busy', 'false');
    countLabel.textContent = `${String(libraryItems.length).padStart(2, '0')} ${libraryItems.length === 1 ? 'CLIP' : 'CLIPS'} / ${libraryItems.length < 4 ? 'SHELF IN PROGRESS' : 'AND GROWING'}`;
    observeReveals(videoGrid);
    attachCardPreviews();
    applyFilter(currentFilter);
  }

  async function getLibraryData() {
    const endpoints = ['./videos.json'];
    for (const endpoint of endpoints) {
      try {
        const response = await fetch(endpoint, { headers: { Accept: 'application/json' }, cache: 'no-store' });
        if (!response.ok) continue;
        const data = await response.json();
        const videos = Array.isArray(data) ? data : data.videos;
        if (Array.isArray(videos)) return videos;
      } catch (_) {
        // GitHub Pages serves the static videos.json catalog.
      }
    }
    return [];
  }

  function attachCardPreviews() {
    const cards = Array.from(videoGrid.querySelectorAll('.video-card'));
    const featuredCard = cards.find((card) => card.dataset.featured === 'true');

    cards.forEach((card) => {
      const video = card.querySelector('.card-video');
      if (!video || card === featuredCard) return;
      card.addEventListener('pointerenter', () => {
        if (window.matchMedia('(hover: hover)').matches) {
          card.classList.add('is-playing');
          const attempt = video.play();
          if (attempt && typeof attempt.catch === 'function') attempt.catch(() => {});
        }
      });
      card.addEventListener('pointerleave', () => {
        card.classList.remove('is-playing');
        video.pause();
        try { video.currentTime = 0; } catch (_) {}
      });
    });

    // Start the featured Archive.org reel only while its library card is on screen.
    if (featuredCard) {
      const video = featuredCard.querySelector('.card-video');
      if (!video) return;
      const play = () => {
        featuredCard.classList.add('is-playing');
        const attempt = video.play();
        if (attempt && typeof attempt.catch === 'function') {
          attempt.catch(() => featuredCard.classList.remove('is-playing'));
        }
      };
      const pause = () => {
        featuredCard.classList.remove('is-playing');
        video.pause();
      };
      if ('IntersectionObserver' in window) {
        const previewObserver = new IntersectionObserver((entries) => {
          entries.forEach((entry) => entry.isIntersecting ? play() : pause());
        }, { threshold: 0.35 });
        previewObserver.observe(featuredCard);
      } else {
        play();
      }
    }
  }

  function openPlayer(button) {
    const source = safeUrl(button.dataset.watch || '');
    if (!source || !dialog || !dialogVideo) return;
    const title = button.dataset.title || 'Featured animation';
    const origin = button.dataset.origin || 'OPEN MOTION';
    const permalink = safeUrl(button.dataset.permalink || '') || ARCHIVE_PAGE;
    dialogTitle.textContent = title;
    dialogMeta.textContent = `SOURCE / ${origin.toUpperCase()}`;
    dialogSource.href = permalink;
    dialogSource.textContent = origin.toUpperCase().includes('ARCHIVE') ? 'OPEN ORIGINAL SOURCE ↗' : 'OPEN CLIP FILE ↗';
    dialogVideo.src = source;
    dialogVideo.load();
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else dialog.setAttribute('open', '');
    const attempt = dialogVideo.play();
    if (attempt && typeof attempt.catch === 'function') attempt.catch(() => {});
  }

  videoGrid.addEventListener('click', (event) => {
    const button = event.target.closest('[data-watch]');
    if (button) openPlayer(button);
  });

  filterList.addEventListener('click', (event) => {
    const button = event.target.closest('[data-filter]');
    if (button) applyFilter(button.dataset.filter);
  });

  function closePlayer() {
    if (dialog && dialog.open) dialog.close();
    if (dialogVideo) {
      dialogVideo.pause();
      dialogVideo.removeAttribute('src');
      dialogVideo.load();
    }
  }
  document.getElementById('dialogClose')?.addEventListener('click', closePlayer);
  dialog?.addEventListener('click', (event) => {
    if (event.target === dialog) closePlayer();
  });
  dialog?.addEventListener('close', () => {
    if (dialogVideo) {
      dialogVideo.pause();
      dialogVideo.removeAttribute('src');
      dialogVideo.load();
    }
  });

  const audioToggle = document.getElementById('audioToggle');
  audioToggle?.addEventListener('click', () => {
    if (!heroVideo) return;
    heroVideo.muted = !heroVideo.muted;
    audioToggle.setAttribute('aria-pressed', heroVideo.muted ? 'false' : 'true');
    audioToggle.setAttribute('aria-label', heroVideo.muted ? 'Unmute background video' : 'Mute background video');
  });

  const playToggle = document.getElementById('playToggle');
  playToggle?.addEventListener('click', () => {
    if (!heroVideo) return;
    if (heroVideo.paused) {
      const attempt = heroVideo.play();
      if (attempt && typeof attempt.catch === 'function') attempt.catch(() => {});
      playToggle.innerHTML = '<span class="pause-glyph" aria-hidden="true">Ⅱ</span> Pause reel';
      playToggle.setAttribute('aria-label', 'Pause background video');
    } else {
      heroVideo.pause();
      playToggle.innerHTML = '<span class="pause-glyph" aria-hidden="true">▶</span> Play reel';
      playToggle.setAttribute('aria-label', 'Play background video');
    }
  });

  heroVideo?.addEventListener('playing', () => {
    const status = document.getElementById('heroStatus');
    if (status) status.textContent = 'ARCHIVE FEED / LIVE';
  });
  heroVideo?.addEventListener('error', () => {
    const status = document.getElementById('heroStatus');
    if (status) status.textContent = 'ARCHIVE SOURCE / PAUSED';
  });

  const signalArt = document.getElementById('signalArt');
  const signalRate = document.getElementById('signalRate');
  const rhythmRates = ['01.00', '01.25', '00.75', '01.50'];
  let rhythmIndex = 0;
  document.getElementById('signalShift')?.addEventListener('click', () => {
    rhythmIndex = (rhythmIndex + 1) % rhythmRates.length;
    signalArt?.setAttribute('data-mode', String(rhythmIndex));
    if (signalRate) signalRate.innerHTML = `${rhythmRates[rhythmIndex]}<span>×</span>`;
  });

  const menuToggle = document.getElementById('menuToggle');
  const mainNav = document.getElementById('mainNav');
  menuToggle?.addEventListener('click', () => {
    const expanded = menuToggle.getAttribute('aria-expanded') === 'true';
    menuToggle.setAttribute('aria-expanded', expanded ? 'false' : 'true');
    menuToggle.setAttribute('aria-label', expanded ? 'Open navigation' : 'Close navigation');
    mainNav?.classList.toggle('is-open', !expanded);
  });
  mainNav?.querySelectorAll('a').forEach((link) => link.addEventListener('click', () => {
    menuToggle?.setAttribute('aria-expanded', 'false');
    menuToggle?.setAttribute('aria-label', 'Open navigation');
    mainNav.classList.remove('is-open');
  }));
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && mainNav?.classList.contains('is-open')) {
      mainNav.classList.remove('is-open');
      menuToggle?.setAttribute('aria-expanded', 'false');
      menuToggle?.setAttribute('aria-label', 'Open navigation');
    }
  });

  if (window.matchMedia('(pointer: fine)').matches) {
    const glow = document.getElementById('cursorGlow');
    let pending = false;
    window.addEventListener('pointermove', (event) => {
      if (pending) return;
      pending = true;
      window.requestAnimationFrame(() => {
        if (glow) {
          glow.style.left = `${event.clientX}px`;
          glow.style.top = `${event.clientY}px`;
          glow.style.opacity = '1';
        }
        pending = false;
      });
    }, { passive: true });
    document.addEventListener('pointerleave', () => { if (glow) glow.style.opacity = '0'; });
  }

  observeReveals();
  getLibraryData().then(renderLibrary).catch(() => renderLibrary([]));
})();
