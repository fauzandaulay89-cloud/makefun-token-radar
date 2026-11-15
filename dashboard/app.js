/* Token Launch Radar — the page. Reads window.RADAR (written by main.ts
   from the sealed snapshot), renders the board, and nothing else. No fetch,
   no network, no framework. */
(function () {
  'use strict';
  var D = window.RADAR;
  if (!D || !Array.isArray(D.rows)) {
    document.getElementById('meta').textContent = 'No radar data: data.js did not load.';
    return;
  }

  var $ = function (id) { return document.getElementById(id); };
  var rowsEl = $('rows'), liveRowsEl = $('live-rows'), detailEl = $('detail');
  var boardSec = $('board'), liveSec = $('live');

  /* ---------- formatting ---------- */
  function money(n) {
    if (n === null || n === undefined) return '—';
    return '$' + Math.round(n).toLocaleString('en-US');
  }
  function compact(n) {
    if (n === null || n === undefined) return '—';
    if (n >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
    if (n >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
    if (n >= 1e3) return '$' + (n / 1e3).toFixed(1) + 'K';
    return money(n);
  }
  function pct(n) {
    if (n === null || n === undefined) return '<span class="flat">—</span>';
    var c = n > 0.05 ? 'up' : n < -0.05 ? 'down' : 'flat';
    var s = (n > 0 ? '+' : '') + n.toFixed(1) + '%';
    return '<span class="' + c + '">' + s + '</span>';
  }
  function age(n) {
    if (n === null || n === undefined) return '—';
    if (n >= 365) return (n / 365).toFixed(1) + 'y';
    if (n >= 30) return Math.round(n / 30) + 'mo';
    return n + 'd';
  }
  function chainsShort(list, max) {
    if (list.length <= max) return list.join(', ');
    return list.slice(0, max).join(', ') + ' +' + (list.length - max) + ' more';
  }
  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  /* ---------- header, stats, footer ---------- */
  var totalImplied = D.rows.reduce(function (a, r) { return a + r.implied_value_usd; }, 0);
  $('meta').textContent = 'Snapshot ' + D.as_of + ' · ' + D.source + ' · model ' + D.model_version;
  $('stats').innerHTML =
    stat(compact(totalImplied), 'total implied value across the board') +
    stat(String(D.board_size), 'protocols ranked · ' + D.watchlist_size + ' on the watchlist') +
    stat(String(D.early_size), 'early finds below the $50M floor') +
    stat(D.global_multiple.toFixed(3) + '×', 'snapshot-wide median mcap / TVL');
  function stat(b, s) { return '<div class="stat"><b>' + b + '</b><span>' + s + '</span></div>'; }
  $('foot').textContent = 'Token Launch Radar · model ' + D.model_version + ' · snapshot ' + D.as_of +
    ' · ' + D.source + ' · “Pre-token” means the record carries no token, never proof it has none.';

  /* ---------- filter controls ---------- */
  var cats = [], chains = [];
  D.rows.forEach(function (r) {
    if (r.category && cats.indexOf(r.category) < 0) cats.push(r.category);
    r.chains.forEach(function (c) { if (chains.indexOf(c) < 0) chains.push(c); });
  });
  cats.sort(); chains.sort();
  fillSelect($('cat'), cats);
  fillSelect($('chain'), chains);
  function fillSelect(sel, values) {
    values.forEach(function (v) {
      var o = document.createElement('option');
      o.value = v; o.textContent = v;
      sel.appendChild(o);
    });
  }

  var params = new URLSearchParams(window.location.search);
  var state = {
    view: params.get('view') === 'live' ? 'live' : 'board',
    q: params.get('q') || '',
    cat: params.get('cat') || '',
    chain: params.get('chain') || '',
    watchlist: params.get('watchlist') === '1',
    sort: params.get('sort') || 'implied',
    slug: params.get('slug') || '',
  };
  $('q').value = state.q;
  $('cat').value = state.cat;
  $('chain').value = state.chain;
  $('watchlist').checked = state.watchlist;
  $('sort').value = state.sort;

  var sorters = {
    implied: function (a, b) { return b.implied_value_usd - a.implied_value_usd || a.rank - b.rank; },
    tvl: function (a, b) { return b.tvl_usd - a.tvl_usd || a.rank - b.rank; },
    growth: function (a, b) { return (b.change_7d || 0) - (a.change_7d || 0) || a.rank - b.rank; },
    age: function (a, b) { return (b.age_days || 0) - (a.age_days || 0) || a.rank - b.rank; },
    name: function (a, b) { return a.name < b.name ? -1 : a.name > b.name ? 1 : a.rank - b.rank; },
  };

  function filtered() {
    var q = state.q.trim().toLowerCase();
    return D.rows.filter(function (r) {
      if (state.watchlist && !r.watchlist) return false;
      if (state.cat && r.category !== state.cat) return false;
      if (state.chain && r.chains.indexOf(state.chain) < 0) return false;
      if (q && r.name.toLowerCase().indexOf(q) < 0 && r.slug.toLowerCase().indexOf(q) < 0) return false;
      return true;
    }).sort(sorters[state.sort] || sorters.implied);
  }

  function render() {
    var isLive = state.view === 'live';
    $('tab-board').setAttribute('aria-selected', String(!isLive));
    $('tab-live').setAttribute('aria-selected', String(isLive));
    boardSec.hidden = isLive;
    liveSec.hidden = !isLive;
    document.querySelector('.controls').style.display = '';
    if (isLive) { renderLive(); return; }
    var list = filtered();
    $('count').textContent = list.length + ' of ' + D.board_size + ' protocols' +
      (state.watchlist ? ' · watchlist only' : '') +
      (state.cat ? ' · ' + state.cat : '') +
      (state.chain ? ' · ' + state.chain : '') +
      (state.q ? ' · matching “' + state.q + '”' : '');
    $('empty').hidden = list.length > 0;
    rowsEl.innerHTML = list.map(function (r) {
      return '<tr data-slug="' + esc(r.slug) + '"' + (state.slug === r.slug ? ' class="sel"' : '') + '>' +
        '<td class="num">' + r.rank + '</td>' +
        '<td><span class="name">' + esc(r.name) + '</span> <span class="slug">' + esc(r.slug) + '</span>' +
        (r.watchlist ? ' <span class="wl">WATCHLIST</span>' : '') + '</td>' +
        '<td>' + esc(r.category || '—') + '</td>' +
        '<td>' + esc(chainsShort(r.chains, 4) || '—') + '</td>' +
        '<td class="num">' + compact(r.tvl_usd) + '</td>' +
        '<td class="num">' + pct(r.change_7d) + '</td>' +
        '<td class="num">' + age(r.age_days) + '</td>' +
        '<td class="num imp">' + money(r.implied_value_usd) + '</td></tr>';
    }).join('');
    if (state.slug) showDetail(state.slug);
  }

  function renderLive() {
    $('count').textContent = D.live.length + ' largest live-token protocols by market cap — already trading, never ranked here.';
    liveRowsEl.innerHTML = D.live.map(function (r) {
      return '<tr><td><span class="name">' + esc(r.name) + '</span> <span class="slug">' + esc(r.slug) + '</span></td>' +
        '<td>' + esc(r.category || '—') + '</td>' +
        '<td>' + esc(chainsShort(r.chains, 4) || '—') + '</td>' +
        '<td class="num">' + compact(r.tvl_usd) + '</td>' +
        '<td class="num">' + compact(r.mcap_usd) + '</td>' +
        '<td class="num">' + (r.mcap_tvl === null ? '—' : r.mcap_tvl.toFixed(3) + '×') + '</td>' +
        '<td class="num">' + pct(r.change_7d) + '</td></tr>';
    }).join('');
  }

  /* ---------- detail ---------- */
  function showDetail(slug) {
    var r = null;
    for (var i = 0; i < D.rows.length; i++) if (D.rows[i].slug === slug) { r = D.rows[i]; break; }
    if (!r) { detailEl.hidden = true; return; }
    var base = r.tvl_usd * r.category_multiple;
    detailEl.innerHTML =
      '<button class="close" id="close-detail">Close ✕</button>' +
      '<h2>#' + r.rank + ' ' + esc(r.name) + ' <span class="slug">' + esc(r.slug) + '</span></h2>' +
      '<p class="sub">' + esc(r.category || 'Uncategorised') + ' · ' + esc(chainsShort(r.chains, 6) || '—') +
      ' · TVL ' + compact(r.tvl_usd) + ' · 7d ' + (r.change_7d === null ? '—' : (r.change_7d > 0 ? '+' : '') + r.change_7d.toFixed(1) + '%') +
      ' · tracked ' + (r.age_days === null ? 'since an unknown date' : r.age_days + ' days') +
      (r.watchlist ? ' · on the watchlist' : ' · below the watchlist floor') + '</p>' +
      '<div class="formula">' + money(r.tvl_usd) + ' TVL × <b>' + r.category_multiple.toFixed(3) + '</b> ' +
      esc(r.category || 'category') + ' multiple × <b>' + r.growth_multiplier.toFixed(3) + '</b> growth × <b>' +
      r.maturity_multiplier.toFixed(3) + '</b> maturity × <b>' + r.breadth_multiplier.toFixed(3) + '</b> breadth' +
      ' <span class="eq">=</span> <b>' + money(r.implied_value_usd) + '</b> implied value' +
      ' <span class="eq">(base ' + money(base) + ')</span></div>' +
      '<h3>Farm plan — six steps</h3><ol>' +
      r.farm_steps.map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('') +
      '</ol>' +
      '<p class="warn">“Pre-token” means this protocol’s DefiLlama record carries no token — no market cap, ' +
      'no CoinGecko id, no symbol. It is not proof the protocol has none, and nothing here predicts ' +
      'whether or when a token is issued.</p>';
    detailEl.hidden = false;
    $('close-detail').addEventListener('click', function () {
      state.slug = ''; detailEl.hidden = true; syncUrl(); render();
    });
  }

  /* ---------- category multiples ---------- */
  var multHtml = Object.keys(D.category_multiples).sort().map(function (c) {
    return '<span class="mult">' + esc(c) + ' <b>' + D.category_multiples[c].toFixed(3) + '×</b></span>';
  }).join('');
  $('mults').innerHTML = multHtml +
    '<span class="mult">snapshot-wide fallback <b>' + D.global_multiple.toFixed(3) + '×</b></span>';

  /* ---------- events ---------- */
  function syncUrl() {
    try {
      var p = new URLSearchParams();
      if (state.view === 'live') p.set('view', 'live');
      if (state.q) p.set('q', state.q);
      if (state.cat) p.set('cat', state.cat);
      if (state.chain) p.set('chain', state.chain);
      if (state.watchlist) p.set('watchlist', '1');
      if (state.sort !== 'implied') p.set('sort', state.sort);
      if (state.slug) p.set('slug', state.slug);
      var qs = p.toString();
      window.history.replaceState(null, '', window.location.pathname + (qs ? '?' + qs : ''));
    } catch (e) { /* file:// or sandboxed: the page works without it */ }
  }
  $('q').addEventListener('input', function () { state.q = this.value; syncUrl(); render(); });
  $('cat').addEventListener('change', function () { state.cat = this.value; syncUrl(); render(); });
  $('chain').addEventListener('change', function () { state.chain = this.value; syncUrl(); render(); });
  $('watchlist').addEventListener('change', function () { state.watchlist = this.checked; syncUrl(); render(); });
  $('sort').addEventListener('change', function () { state.sort = this.value; syncUrl(); render(); });
  $('tab-board').addEventListener('click', function () { state.view = 'board'; syncUrl(); render(); });
  $('tab-live').addEventListener('click', function () { state.view = 'live'; syncUrl(); render(); });
  rowsEl.addEventListener('click', function (ev) {
    var tr = ev.target.closest ? ev.target.closest('tr[data-slug]') : null;
    if (!tr) return;
    state.slug = tr.getAttribute('data-slug');
    syncUrl(); render();
    detailEl.scrollIntoView({ block: 'nearest' });
  });
  document.querySelectorAll('thead th[data-sort]').forEach(function (th) {
    th.addEventListener('click', function () {
      var s = th.getAttribute('data-sort');
      state.sort = s === 'name' ? 'name' : s === 'tvl' ? 'tvl' : s === 'growth' ? 'growth' : s === 'age' ? 'age' : 'implied';
      $('sort').value = state.sort;
      syncUrl(); render();
    });
  });

  render();
  if (state.slug && state.view === 'board') detailEl.scrollIntoView({ block: 'start' });
})();
