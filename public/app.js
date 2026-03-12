'use strict';

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------
function esc(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function resolveUrl(src, base) {
  if (!src) return null;
  try {
    return new URL(src, base).href;
  } catch {
    return src;
  }
}

function domain(url) {
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return url; }
}

function icon(name, extra = '') {
  const icons = {
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>',
    x: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
    minus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><line x1="5" y1="12" x2="19" y2="12"/></svg>',
    warn: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
    info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>',
    tag: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>',
    search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>',
    eye: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>',
    image: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>',
    heading: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><polyline points="4 7 4 4 20 4 20 7"/><line x1="9" y1="20" x2="15" y2="20"/><line x1="12" y1="4" x2="12" y2="20"/></svg>',
    form: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/></svg>',
    landmark: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><line x1="3" y1="22" x2="21" y2="22"/><line x1="6" y1="18" x2="6" y2="11"/><line x1="10" y1="18" x2="10" y2="11"/><line x1="14" y1="18" x2="14" y2="11"/><line x1="18" y1="18" x2="18" y2="11"/><polygon points="12 2 20 7 4 7"/></svg>',
  };
  return `<span class="${extra}">${icons[name] || ''}</span>`;
}

// ---------------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------------
document.addEventListener('DOMContentLoaded', async () => {
  // Check capabilities
  try {
    const caps = await fetch('/api/capabilities').then(r => r.json());
    if (!caps.puppeteerAvailable) {
      const toggle = document.getElementById('render-js');
      const label = document.getElementById('js-toggle-label');
      const note = document.getElementById('js-unavailable-note');
      toggle.disabled = true;
      label.classList.add('disabled');
      if (note) note.hidden = false;
    }
  } catch { /* ignore */ }

  document.getElementById('check-form').addEventListener('submit', handleSubmit);

  // Tab navigation
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  // JS toggle aria-checked sync
  const jsToggle = document.getElementById('render-js');
  if (jsToggle) {
    jsToggle.addEventListener('change', () => {
      jsToggle.setAttribute('aria-checked', jsToggle.checked ? 'true' : 'false');
    });
  }
});

// ---------------------------------------------------------------------------
// Tab switching
// ---------------------------------------------------------------------------
function switchTab(tabName) {
  document.querySelectorAll('.tab-btn').forEach(b => {
    const active = b.dataset.tab === tabName;
    b.classList.toggle('active', active);
    b.setAttribute('aria-selected', active ? 'true' : 'false');
  });
  document.querySelectorAll('.tab-panel').forEach(p => {
    const active = p.id === `tab-${tabName}`;
    p.classList.toggle('active', active);
    p.hidden = !active;
  });
}

// ---------------------------------------------------------------------------
// Form submission
// ---------------------------------------------------------------------------
async function handleSubmit(e) {
  e.preventDefault();

  const urlInput = document.getElementById('url-input');
  const renderJs = document.getElementById('render-js').checked;
  const submitBtn = document.getElementById('submit-btn');
  const btnText = submitBtn.querySelector('.btn-text');
  const btnSpinner = submitBtn.querySelector('.btn-spinner');
  const errorBanner = document.getElementById('error-banner');
  const errorMsg = document.getElementById('error-message');
  const resultsArea = document.getElementById('results-area');

  const url = urlInput.value.trim();
  if (!url) { urlInput.focus(); return; }

  // Loading state
  submitBtn.disabled = true;
  btnText.hidden = true;
  btnSpinner.hidden = false;
  errorBanner.hidden = true;
  resultsArea.hidden = true;

  try {
    const res = await fetch('/api/check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, renderJs }),
    });

    const data = await res.json();

    if (!res.ok || data.error) {
      showError(data.message || 'Ein ukjend feil oppstod.');
      return;
    }

    renderResults(data);
  } catch (err) {
    showError('Nettverksfeil – klarte ikkje kontakte serveren.');
  } finally {
    submitBtn.disabled = false;
    btnText.hidden = false;
    btnSpinner.hidden = true;
  }
}

function showError(msg) {
  const banner = document.getElementById('error-banner');
  document.getElementById('error-message').textContent = msg;
  banner.hidden = false;
  banner.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// ---------------------------------------------------------------------------
// Main render
// ---------------------------------------------------------------------------
function renderResults(data) {
  const { url, fetchedAt, renderedWithJs, statusCode, meta, warnings, seo, accessibility } = data;

  // Result header
  const urlLink = document.getElementById('result-url-link');
  urlLink.href = url;
  urlLink.textContent = url;

  document.getElementById('result-status').textContent = `HTTP ${statusCode}`;
  document.getElementById('result-status').className = `status-chip ${statusCode < 300 ? 'success' : statusCode < 400 ? 'warning' : 'error'}`;
  document.getElementById('result-render-mode').textContent = renderedWithJs ? 'JS-rendering' : 'Statisk henting';
  document.getElementById('result-render-mode').className = `status-chip ${renderedWithJs ? 'success' : ''}`;
  document.getElementById('result-time').textContent = new Date(fetchedAt).toLocaleTimeString('nb-NO');

  // Warnings
  renderWarnings(warnings);

  // Sections
  document.getElementById('meta-content').innerHTML = '';
  document.getElementById('preview-content').innerHTML = '';
  document.getElementById('seo-content').innerHTML = '';
  document.getElementById('a11y-content').innerHTML = '';

  document.getElementById('meta-content').appendChild(buildMetaSection(meta));
  document.getElementById('preview-content').appendChild(buildPreviewSection(meta, url));
  document.getElementById('seo-content').appendChild(buildSeoSection(seo));
  document.getElementById('a11y-content').appendChild(buildA11ySection(accessibility));

  // Show results
  document.getElementById('results-area').hidden = false;
  switchTab('meta');
  document.getElementById('results-area').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ---------------------------------------------------------------------------
// Warnings
// ---------------------------------------------------------------------------
function renderWarnings(warnings) {
  const section = document.getElementById('warnings-section');
  const list = document.getElementById('warnings-list');
  list.innerHTML = '';

  if (!warnings || warnings.length === 0) {
    section.hidden = true;
    return;
  }

  section.hidden = false;
  warnings.forEach(w => {
    const li = document.createElement('li');
    li.className = `warning-item ${w.severity}`;
    const labels = { error: 'Feil', warning: 'Åtvaring', info: 'Info' };
    li.innerHTML = `
      <span class="warning-badge">${esc(labels[w.severity] || w.severity)}</span>
      <span>
        ${esc(w.message)}
        ${w.field ? `<span class="warning-field">${esc(w.field)}</span>` : ''}
      </span>
    `;
    list.appendChild(li);
  });
}

// ---------------------------------------------------------------------------
// Metadata section
// ---------------------------------------------------------------------------
function buildMetaSection(meta) {
  const frag = document.createDocumentFragment();

  const makeRow = (fieldName, value, opts = {}) => {
    const tr = document.createElement('tr');
    let valueHtml;
    if (value == null) {
      valueHtml = `<span class="meta-value-missing">— manglar</span>`;
    } else if (opts.isImage) {
      const absUrl = resolveUrl(value, window._currentUrl);
      valueHtml = `<img class="meta-image-thumb" src="${esc(absUrl)}" alt="" loading="lazy">${esc(value)}`;
    } else if (opts.isBool) {
      valueHtml = value
        ? `<span class="bool-yes">✓ Ja</span>`
        : `<span class="bool-no">— Nei</span>`;
    } else {
      let badge = '';
      if (opts.warnLen) {
        const len = String(value).length;
        const { min, max } = opts.warnLen;
        const cls = len < min ? 'warn' : len > max ? 'warn' : 'ok';
        badge = `<span class="char-count ${cls}">${len} teikn</span>`;
      }
      valueHtml = `<span class="meta-value-text">${esc(String(value))}</span>${badge}`;
    }
    tr.innerHTML = `<td class="field-name">${esc(fieldName)}</td><td class="field-value">${valueHtml}</td>`;
    return tr;
  };

  const addSection = (title, rows) => {
    const card = document.createElement('div');
    card.className = 'card meta-table-card';
    card.innerHTML = `<table class="meta-table"><thead><tr><th colspan="2">${esc(title)}</th></tr></thead><tbody></tbody></table>`;
    const tbody = card.querySelector('tbody');
    rows.forEach(r => tbody.appendChild(makeRow(...r)));
    frag.appendChild(card);
  };

  addSection('Grunnleggjande metadata', [
    ['title', meta.title, { warnLen: { min: 30, max: 60 } }],
    ['description', meta.description, { warnLen: { min: 70, max: 160 } }],
    ['keywords', meta.keywords],
    ['robots', meta.robots],
    ['canonical', meta.canonical],
    ['lang', meta.lang],
    ['charset', meta.charset],
    ['viewport', meta.viewport],
  ]);

  addSection('Open Graph (Facebook / LinkedIn)', [
    ['og:title', meta.og.title],
    ['og:description', meta.og.description],
    ['og:image', meta.og.image, { isImage: !!meta.og.image }],
    ['og:image:width', meta.og.imageWidth],
    ['og:image:height', meta.og.imageHeight],
    ['og:image:alt', meta.og.imageAlt],
    ['og:url', meta.og.url],
    ['og:type', meta.og.type],
    ['og:site_name', meta.og.siteName],
    ['og:locale', meta.og.locale],
  ]);

  addSection('Twitter / X Card', [
    ['twitter:card', meta.twitter.card],
    ['twitter:title', meta.twitter.title],
    ['twitter:description', meta.twitter.description],
    ['twitter:image', meta.twitter.image, { isImage: !!meta.twitter.image }],
    ['twitter:image:alt', meta.twitter.imageAlt],
    ['twitter:site', meta.twitter.site],
    ['twitter:creator', meta.twitter.creator],
  ]);

  addSection('Anna', [
    ['Strukturerte data (ld+json)', meta.hasStructuredData, { isBool: true }],
    ['Favicon', meta.hasFavicon, { isBool: true }],
    ['RSS-feed', meta.hasRssFeed, { isBool: true }],
  ]);

  return frag;
}

// ---------------------------------------------------------------------------
// Social preview section
// ---------------------------------------------------------------------------
function buildPreviewSection(meta, url) {
  window._currentUrl = url;
  const frag = document.createDocumentFragment();
  const grid = document.createElement('div');
  grid.className = 'preview-grid';

  // --- Facebook/LinkedIn ---
  const fbWrap = document.createElement('div');
  fbWrap.className = 'preview-card-wrap';
  const fbTitle = meta.og.title || meta.title;
  const fbDesc = meta.og.description || meta.description;
  const fbImage = meta.og.image ? resolveUrl(meta.og.image, url) : null;
  const fbFallback = !meta.og.title;

  let fbImageHtml = fbImage
    ? `<img class="fb-card-image" src="${esc(fbImage)}" alt="${esc(meta.og.imageAlt || '')}" loading="lazy" onerror="this.style.display='none'">`
    : `<div class="fb-card-image-placeholder">Inga og:image</div>`;

  fbWrap.innerHTML = `
    <p class="preview-label">
      <svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14" aria-hidden="true"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
      Facebook / LinkedIn ${fbFallback ? '<span class="fallback-label">fallback</span>' : ''}
    </p>
    <div class="fb-card">
      ${fbImageHtml}
      <div class="fb-card-body">
        <div class="fb-card-domain">${esc(domain(url))}</div>
        <div class="fb-card-title">${esc(fbTitle || 'Ingen tittel')}</div>
        <div class="fb-card-desc">${esc(fbDesc || '')}</div>
      </div>
    </div>
  `;

  // --- Twitter/X ---
  const twWrap = document.createElement('div');
  twWrap.className = 'preview-card-wrap';
  const twTitle = meta.twitter.title || meta.og.title || meta.title;
  const twDesc = meta.twitter.description || meta.og.description || meta.description;
  const twImage = meta.twitter.image ? resolveUrl(meta.twitter.image, url)
    : meta.og.image ? resolveUrl(meta.og.image, url) : null;
  const twCard = meta.twitter.card || 'summary';
  const twFallback = !meta.twitter.title;

  let twHtml;
  if (twCard === 'summary_large_image') {
    const imgHtml = twImage
      ? `<img class="tw-card-large-image" src="${esc(twImage)}" alt="${esc(meta.twitter.imageAlt || '')}" loading="lazy" onerror="this.style.display='none'">`
      : `<div class="tw-card-large-image-placeholder">Inga twitter:image</div>`;
    twHtml = `
      <div class="tw-card">
        ${imgHtml}
        <div class="tw-card-body">
          <div class="tw-card-title">${esc(twTitle || 'Ingen tittel')}</div>
          <div class="tw-card-desc">${esc(twDesc || '')}</div>
          <div class="tw-card-meta">${esc(domain(url))}${meta.twitter.site ? ' · ' + esc(meta.twitter.site) : ''}</div>
        </div>
      </div>
    `;
  } else {
    // summary or default
    const imgHtml = twImage
      ? `<img class="tw-summary-image" src="${esc(twImage)}" alt="${esc(meta.twitter.imageAlt || '')}" loading="lazy" onerror="this.style.display='none'">`
      : `<div class="tw-summary-image-placeholder">Inga bilde</div>`;
    twHtml = `
      <div class="tw-summary-card">
        ${imgHtml}
        <div class="tw-summary-body">
          <div class="tw-card-title">${esc(twTitle || 'Ingen tittel')}</div>
          <div class="tw-card-desc">${esc(twDesc || '')}</div>
          <div class="tw-card-meta">${esc(domain(url))}${meta.twitter.site ? ' · ' + esc(meta.twitter.site) : ''}</div>
        </div>
      </div>
    `;
  }

  twWrap.innerHTML = `
    <p class="preview-label">
      <svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14" aria-hidden="true"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.73-8.835L1.254 2.25H8.08l4.26 5.632zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
      Twitter / X &nbsp;<span class="status-chip" style="font-size:.65rem;padding:1px 5px">${esc(twCard)}</span>
      ${twFallback ? '<span class="fallback-label">fallback</span>' : ''}
    </p>
    ${twHtml}
  `;

  grid.appendChild(fbWrap);
  grid.appendChild(twWrap);
  frag.appendChild(grid);
  return frag;
}

// ---------------------------------------------------------------------------
// SEO section
// ---------------------------------------------------------------------------
function buildSeoSection(seo) {
  const frag = document.createDocumentFragment();

  // Stats row
  const statsCard = document.createElement('div');
  statsCard.className = 'sub-card';
  statsCard.innerHTML = `
    <div class="seo-stats-row">
      <div class="seo-stat-card">
        <div class="seo-stat-value">${seo.totalWords.toLocaleString('nb-NO')}</div>
        <div class="seo-stat-label">Ord totalt</div>
      </div>
      <div class="seo-stat-card">
        <div class="seo-stat-value">${seo.uniqueWords.toLocaleString('nb-NO')}</div>
        <div class="seo-stat-label">Unike ord</div>
      </div>
      <div class="seo-stat-card">
        <div class="seo-stat-value">${seo.h1Count}</div>
        <div class="seo-stat-label">H1-overskrifter</div>
      </div>
      <div class="seo-stat-card">
        <div class="seo-stat-value">${seo.readingTimeMinutes}</div>
        <div class="seo-stat-label">Min. lesetid</div>
      </div>
    </div>
  `;
  frag.appendChild(statsCard);

  // Keyword table
  const kwCard = document.createElement('div');
  kwCard.className = 'sub-card';
  kwCard.innerHTML = `
    <h3 class="sub-card-title">${icon('search')} Nøkkelord-frekvens (topp 20)</h3>
    <div class="keyword-table-wrap">
      <table class="keyword-table" id="keyword-table">
        <thead>
          <tr>
            <th data-col="term" class="sort-asc">Ord</th>
            <th data-col="count">Antal</th>
            <th data-col="density">Tettleik</th>
          </tr>
        </thead>
        <tbody></tbody>
      </table>
    </div>
  `;
  frag.appendChild(kwCard);

  // Render keyword rows
  let kwData = [...(seo.topKeywords || [])];
  let sortCol = 'count';
  let sortDir = 'desc';
  const maxDensity = Math.max(...kwData.map(k => k.density), 0.01);

  function renderKwRows() {
    const tbody = kwCard.querySelector('tbody');
    tbody.innerHTML = '';
    kwData.forEach(kw => {
      const pct = Math.min((kw.density / maxDensity) * 100, 100);
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><strong>${esc(kw.term)}</strong></td>
        <td>${kw.count}</td>
        <td>
          <div class="density-bar">
            <div class="density-track"><div class="density-fill" style="width:${pct}%"></div></div>
            <span>${kw.density}%</span>
          </div>
        </td>
      `;
      tbody.appendChild(tr);
    });
  }

  renderKwRows();

  kwCard.querySelector('thead').addEventListener('click', e => {
    const th = e.target.closest('th[data-col]');
    if (!th) return;
    const col = th.dataset.col;
    if (sortCol === col) { sortDir = sortDir === 'asc' ? 'desc' : 'asc'; }
    else { sortCol = col; sortDir = col === 'term' ? 'asc' : 'desc'; }
    kwData.sort((a, b) => {
      const av = a[col], bv = b[col];
      if (typeof av === 'string') return sortDir === 'asc' ? av.localeCompare(bv, 'nb') : bv.localeCompare(av, 'nb');
      return sortDir === 'asc' ? av - bv : bv - av;
    });
    kwCard.querySelectorAll('th').forEach(t => t.classList.remove('sort-asc', 'sort-desc'));
    th.classList.add(sortDir === 'asc' ? 'sort-asc' : 'sort-desc');
    renderKwRows();
  });

  // Heading tree
  const hCard = document.createElement('div');
  hCard.className = 'sub-card';
  const headingWarn = seo.headings.length === 0
    ? '<p class="meta-value-missing" style="font-size:.875rem">Ingen overskrifter funne.</p>'
    : seo.h1Count === 0
    ? '<div class="heading-skip-warn">' + icon('warn') + ' Sida manglar H1-overskrift</div>'
    : seo.h1Count > 1
    ? '<div class="heading-skip-warn">' + icon('warn') + ` Sida har ${seo.h1Count} H1-overskrifter – berre éin er tilrådd</div>`
    : '';

  hCard.innerHTML = `<h3 class="sub-card-title">${icon('heading')} Overskriftsstruktur</h3>${headingWarn}`;
  const ul = document.createElement('ul');
  ul.className = 'heading-tree';
  seo.headings.forEach((h, i) => {
    const li = document.createElement('li');
    li.style.paddingLeft = `${(h.level - 1) * 16}px`;
    li.innerHTML = `<span class="heading-level-badge">H${h.level}</span><span>${esc(h.text)}</span>`;
    ul.appendChild(li);
  });
  hCard.appendChild(ul);
  frag.appendChild(hCard);

  return frag;
}

// ---------------------------------------------------------------------------
// Accessibility section
// ---------------------------------------------------------------------------
function buildA11ySection(a11y) {
  const frag = document.createDocumentFragment();

  // Language
  const langCard = document.createElement('div');
  langCard.className = 'sub-card';
  const langOk = a11y.lang.present;
  langCard.innerHTML = `
    <h3 class="sub-card-title">${icon('info')} Språk</h3>
    <div class="a11y-summary-bar">
      <div class="a11y-summary-stat ${langOk ? 'success' : 'error'}">
        <strong>${langOk ? '✓ lang="' + esc(a11y.lang.value) + '"' : '✗ lang-attributt manglar'}</strong>
      </div>
    </div>
  `;
  frag.appendChild(langCard);

  // Semantic tags
  const semCard = document.createElement('div');
  semCard.className = 'sub-card';
  semCard.innerHTML = `<h3 class="sub-card-title">${icon('tag')} Semantiske HTML-element</h3>`;
  const grid = document.createElement('div');
  grid.className = 'semantic-tags-grid';
  a11y.semanticTags.forEach(t => {
    const div = document.createElement('div');
    div.className = `semantic-tag-item ${t.present ? 'present' : 'absent'}`;
    div.innerHTML = `
      <span class="semantic-tag-icon">${t.present ? '✓' : '○'}</span>
      <span class="semantic-tag-name">&lt;${esc(t.tag)}&gt;</span>
      ${t.present ? `<span class="semantic-tag-count">${t.count}×</span>` : ''}
    `;
    grid.appendChild(div);
  });
  semCard.appendChild(grid);
  if (a11y.multipleMainWarning) {
    semCard.innerHTML += `<div class="heading-skip-warn" style="margin-top:12px">${icon('warn')} Sida har fleire &lt;main&gt;-element – berre eitt er tillate</div>`;
  }
  frag.appendChild(semCard);

  // Images
  const imgCard = document.createElement('div');
  imgCard.className = 'sub-card';
  const imgs = a11y.images;
  imgCard.innerHTML = `
    <h3 class="sub-card-title">${icon('image')} Alt-tekst på bilete</h3>
    <div class="a11y-summary-bar">
      <div class="a11y-summary-stat ${imgs.missingAlt === 0 ? 'success' : 'error'}">
        <strong>${imgs.withAlt}</strong>&nbsp;av&nbsp;<strong>${imgs.total}</strong>&nbsp;bilete har alt-tekst
      </div>
      ${imgs.withEmptyAlt > 0 ? `<div class="a11y-summary-stat warning"><strong>${imgs.withEmptyAlt}</strong>&nbsp;dekorative (tom alt)</div>` : ''}
      ${imgs.missingAlt > 0 ? `<div class="a11y-summary-stat error"><strong>${imgs.missingAlt}</strong>&nbsp;manglar alt</div>` : ''}
    </div>
  `;
  if (imgs.images.length > 0) {
    const list = document.createElement('div');
    list.className = 'images-list';
    imgs.images.forEach(img => {
      const div = document.createElement('div');
      div.className = 'image-item';
      let statusIcon, statusClass, altText;
      if (!img.hasAlt) {
        statusIcon = '✗'; statusClass = 'image-status-missing'; altText = 'alt-attributt manglar!';
      } else if (img.emptyAlt) {
        statusIcon = '○'; statusClass = 'image-status-empty'; altText = img.isDecorative ? 'dekorativt bilde' : 'tom alt=""';
      } else {
        statusIcon = '✓'; statusClass = 'image-status-ok'; altText = img.alt;
      }
      div.innerHTML = `
        <span class="img-status ${statusClass}" aria-hidden="true">${statusIcon}</span>
        <span class="img-src" title="${esc(img.src)}">${esc(img.src)}</span>
        <span class="img-alt">${esc(altText)}</span>
      `;
      list.appendChild(div);
    });
    imgCard.appendChild(list);
  }
  frag.appendChild(imgCard);

  // Heading hierarchy
  const hCard = document.createElement('div');
  hCard.className = 'sub-card';
  const hh = a11y.headings;
  hCard.innerHTML = `<h3 class="sub-card-title">${icon('heading')} Overskriftshierarki</h3>`;
  if (hh.hasSkips) {
    hh.skips.forEach(s => {
      hCard.innerHTML += `<div class="heading-skip-warn">${icon('warn')} Hopp i overskriftsrekkjefølgje: H${s.from} → H${s.to} ("${esc(s.text)}")</div>`;
    });
  }
  if (hh.h1Count !== 1) {
    hCard.innerHTML += `<div class="heading-skip-warn">${icon('warn')} ${hh.h1Count === 0 ? 'Ingen H1 funne' : hh.h1Count + ' H1-element funne (berre éin tilrådd)'}</div>`;
  }
  if (!hh.hasSkips && hh.h1Count === 1) {
    hCard.innerHTML += `<p style="font-size:.875rem;color:var(--success)">✓ Overskriftshierarkiet ser bra ut</p>`;
  }
  frag.appendChild(hCard);

  // Forms
  const formCard = document.createElement('div');
  formCard.className = 'sub-card';
  const f = a11y.forms;
  formCard.innerHTML = `
    <h3 class="sub-card-title">${icon('form')} Skjemaelement</h3>
    <div class="a11y-summary-bar">
      <div class="a11y-summary-stat ${f.inputsMissingLabel === 0 ? 'success' : 'error'}">
        <strong>${f.inputsWithLabel}</strong>&nbsp;av&nbsp;<strong>${f.totalInputs}</strong>&nbsp;felt har etikett
      </div>
    </div>
  `;
  if (f.unlabelledInputs.length > 0) {
    const tbl = document.createElement('table');
    tbl.className = 'form-table';
    tbl.innerHTML = `<thead><tr><th>Type</th><th>Name</th><th>ID</th><th>Status</th></tr></thead>`;
    const tbody = document.createElement('tbody');
    f.unlabelledInputs.forEach(inp => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${esc(inp.type)}</td>
        <td>${esc(inp.name) || '—'}</td>
        <td>${esc(inp.id) || '—'}</td>
        <td style="color:var(--error-color)">Manglar etikett</td>
      `;
      tbody.appendChild(tr);
    });
    tbl.appendChild(tbody);
    formCard.appendChild(tbl);
  } else if (f.totalInputs === 0) {
    formCard.innerHTML += `<p style="font-size:.875rem;color:var(--text-muted)">Ingen skjemafelt funne på sida.</p>`;
  }
  frag.appendChild(formCard);

  // ARIA landmarks
  const lmCard = document.createElement('div');
  lmCard.className = 'sub-card';
  lmCard.innerHTML = `<h3 class="sub-card-title">${icon('landmark')} ARIA-landemerke</h3>`;
  const lmList = document.createElement('div');
  lmList.className = 'landmark-list';
  const lmLabels = { banner: 'banner', navigation: 'navigation', main: 'main', contentinfo: 'contentinfo', search: 'search', complementary: 'complementary' };
  Object.entries(a11y.ariaLandmarks).forEach(([role, count]) => {
    const div = document.createElement('div');
    div.className = `landmark-chip ${count > 0 ? 'has-role' : 'no-role'}`;
    div.textContent = `${lmLabels[role]} (${count})`;
    lmList.appendChild(div);
  });
  lmCard.appendChild(lmList);
  frag.appendChild(lmCard);

  // tabindex issues
  if (a11y.tabindexIssues.length > 0) {
    const tCard = document.createElement('div');
    tCard.className = 'sub-card';
    tCard.innerHTML = `
      <h3 class="sub-card-title">${icon('warn')} tabindex-problem</h3>
      <p style="font-size:.875rem;margin-bottom:10px">Element med tabindex > 0 forstyrrar naturleg fokusrekkjefølgje:</p>
    `;
    const tbl = document.createElement('table');
    tbl.className = 'form-table';
    tbl.innerHTML = `<thead><tr><th>Element</th><th>tabindex</th><th>Tekst</th></tr></thead>`;
    const tbody = document.createElement('tbody');
    a11y.tabindexIssues.forEach(ti => {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>&lt;${esc(ti.tag)}&gt;</td><td>${ti.tabindex}</td><td>${esc(ti.text)}</td>`;
      tbody.appendChild(tr);
    });
    tbl.appendChild(tbody);
    tCard.appendChild(tbl);
    frag.appendChild(tCard);
  }

  // Notices
  if (a11y.notices && a11y.notices.length > 0) {
    const nCard = document.createElement('div');
    nCard.className = 'sub-card';
    nCard.innerHTML = `<h3 class="sub-card-title">${icon('info')} Merknader</h3>`;
    a11y.notices.forEach(n => {
      const div = document.createElement('div');
      div.className = 'notice-item';
      div.textContent = n;
      nCard.appendChild(div);
    });
    frag.appendChild(nCard);
  }

  return frag;
}
