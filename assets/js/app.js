(async () => {
  async function loadData() {
    if (window.SHATIBIYYAH_DATA) return window.SHATIBIYYAH_DATA;
    const res = await fetch('data/shatibiyyah_full.json');
    if (!res.ok) throw new Error('تعذر تحميل قاعدة بيانات الشاطبية الكاملة');
    return await res.json();
  }

  let DATA;
  try {
    DATA = await loadData();
  } catch (err) {
    document.getElementById('bookPage').innerHTML =
      `<p style="color:#b91c1c;text-align:center;padding:24px;font-weight:700">${err.message}</p>`;
    return;
  }

  const toAr = n => String(n).replace(/\d/g, d => '٠١٢٣٤٥٦٧٨٩'[d]);
  const toEnDigits = s => String(s || '').replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d));
  const stripDiac = s => (s || '').replace(/[\u064B-\u065F\u0670\u0640]/g, '').replace(/[أإآٱ]/g, 'ا').replace(/ى/g, 'ي');
  const escapeHtml = s => (s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

  const SEC_LABELS = {
    osool: 'قسم الأصول',
    farsh: 'فرش الحروف',
    khatimah: 'التكبير والمخارج والخاتمة'
  };

  const chMap = Object.fromEntries(DATA.chapters.map(c => [c.id, c]));
  const vMap = Object.fromEntries(DATA.verses.map(v => [v.n, v]));

  // Build chapter-respecting horizontal pages (~10 verses/page)
  const VERSES_PER_PAGE = 10;
  const PAGES = [];
  const verseToPage = {};
  const chapterToFirstPage = {};

  DATA.chapters.forEach(ch => {
    const chVerses = DATA.verses.filter(v => v.ch === ch.id);
    chapterToFirstPage[ch.id] = PAGES.length;
    for (let i = 0; i < chVerses.length; i += VERSES_PER_PAGE) {
      const slice = chVerses.slice(i, i + VERSES_PER_PAGE);
      const pIdx = PAGES.length;
      slice.forEach(v => { verseToPage[v.n] = pIdx; });
      PAGES.push({
        chapter: ch,
        partIndex: Math.floor(i / VERSES_PER_PAGE) + 1,
        totalParts: Math.ceil(chVerses.length / VERSES_PER_PAGE),
        isFirstOfChapter: i === 0,
        verses: slice
      });
    }
  });

  // Persistent state
  let currentPage = Number(localStorage.getItem('shat_full_page') || 0);
  if (currentPage < 0 || currentPage >= PAGES.length) currentPage = 0;
  let activeSectionFilter = 'all';
  let fontScale = Number(localStorage.getItem('shat_font') || 1.48);
  let bookmarks = JSON.parse(localStorage.getItem('shat_bookmarks') || '{}');
  let customQuiz = JSON.parse(localStorage.getItem('shat_custom_quiz') || '[]');
  let activeModalVerse = null;
  const pageRenderedCallbacks = [];

  document.documentElement.style.setProperty('--verse-size', fontScale + 'rem');
  if (localStorage.getItem('shat_dark') === '1') document.body.classList.add('dark');

  const chapterSelect = document.getElementById('chapterSelect');
  const searchChapFilter = document.getElementById('searchChapFilter');

  function populateChapterDropdown(secFilter = 'all') {
    const prevVal = chapterSelect.value;
    chapterSelect.innerHTML = '';
    const groups = [
      { key: 'osool', label: '── قسم الأصول (١ – ٤٤٤) ──' },
      { key: 'farsh', label: '── فرش الحروف (٤٤٥ – ١١٢٠) ──' },
      { key: 'khatimah', label: '── التكبير والمخارج والخاتمة (١١٢١ – ١١٧٣) ──' },
    ];
    groups.forEach(g => {
      if (secFilter !== 'all' && secFilter !== g.key) return;
      const og = document.createElement('optgroup');
      og.label = g.label;
      DATA.chapters.filter(c => c.section === g.key).forEach(ch => {
        const opt = document.createElement('option');
        opt.value = ch.id;
        opt.textContent = `${toAr(ch.id)}. ${ch.title} (${toAr(ch.verse_start)}–${toAr(ch.verse_end)})`;
        og.appendChild(opt);
      });
      chapterSelect.appendChild(og);
    });
    if (prevVal && [...chapterSelect.options].some(o => o.value === prevVal)) {
      chapterSelect.value = prevVal;
    }
  }

  function populateSearchChaptersAndIndex() {
    searchChapFilter.innerHTML = '<option value="all">جميع أبواب المنظومة (٧٨ باباً — ١١٧٣ بيتاً)</option>';
    const sections = [
      { key: 'osool', title: 'أولاً: قسم الأصول', sub: '٢٩ باباً • الأبيات ١ – ٤٤٤' },
      { key: 'farsh', title: 'ثانياً: فرش الحروف (سورة البقرة إلى الناس)', sub: '٤٦ باباً • الأبيات ٤٤٥ – ١١٢٠' },
      { key: 'khatimah', title: 'ثالثاً: التكبير ومخارج الحروف والخاتمة', sub: '٣ أبواب • الأبيات ١١٢١ – ١١٧٣' },
    ];
    const indexHost = document.getElementById('chaptersIndexHost');
    indexHost.innerHTML = '';

    sections.forEach(sec => {
      const og = document.createElement('optgroup');
      og.label = sec.title;
      const chs = DATA.chapters.filter(c => c.section === sec.key);
      chs.forEach(ch => {
        const opt = document.createElement('option');
        opt.value = ch.id;
        opt.textContent = `${toAr(ch.id)}. ${ch.title} (${toAr(ch.verse_start)}–${toAr(ch.verse_end)})`;
        og.appendChild(opt);
      });
      searchChapFilter.appendChild(og);

      const secHead = document.createElement('div');
      secHead.className = 'idx-sec-head';
      secHead.innerHTML = `<strong>${sec.title}</strong><span style="font-size:.82rem;color:var(--ink-muted)">${sec.sub}</span>`;
      indexHost.appendChild(secHead);

      const grid = document.createElement('div');
      grid.className = 'chapters-grid';
      chs.forEach(ch => {
        const tile = document.createElement('div');
        tile.className = 'chap-tile';
        tile.innerHTML = `<div class="chap-tile-title">${toAr(ch.id)}. ${escapeHtml(ch.title)}</div>
          <div class="chap-tile-meta">الأبيات ${toAr(ch.verse_start)} – ${toAr(ch.verse_end)} (${toAr(ch.verse_count)} بيتاً)</div>`;
        tile.addEventListener('click', () => {
          setSectionPill('all', false);
          switchView('reader');
          renderPage(chapterToFirstPage[ch.id]);
        });
        grid.appendChild(tile);
      });
      indexHost.appendChild(grid);
    });
  }

  function setSectionPill(sec, jumpToFirst = true) {
    activeSectionFilter = sec;
    document.querySelectorAll('.sec-pill').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.sec === sec);
    });
    populateChapterDropdown(sec);
    if (jumpToFirst && sec !== 'all') {
      const firstCh = DATA.chapters.find(c => c.section === sec);
      if (firstCh) renderPage(chapterToFirstPage[firstCh.id]);
    }
  }

  document.querySelectorAll('.sec-pill').forEach(btn => {
    btn.addEventListener('click', () => setSectionPill(btn.dataset.sec, true));
  });

  const pageSlider = document.getElementById('pageSlider');
  pageSlider.max = PAGES.length;

  function renderTokensHTML(tokens) {
    return tokens.map(tk => {
      if (tk.k === 'N') return escapeHtml(tk.t);
      const payload = encodeURIComponent(JSON.stringify({
        sym: tk.sym, k: tk.k, readers: tk.readers, cat: tk.cat, note: tk.note, word: tk.t
      }));
      if (tk.k === 'L') {
        return `<span class="sym-letter" data-sym="${payload}" role="button" tabindex="0">${escapeHtml(tk.h)}</span>${escapeHtml(tk.r)}`;
      }
      const pref = tk.p ? escapeHtml(tk.p) : '';
      return `${pref}<span class="sym-word" data-sym="${payload}" role="button" tabindex="0">${escapeHtml(tk.h)}</span>`;
    }).join(' ');
  }

  function renderPage(pIdx, highlightVerse = null, autoScroll = true) {
    currentPage = Math.max(0, Math.min(PAGES.length - 1, pIdx));
    localStorage.setItem('shat_full_page', currentPage);
    hidePopover();

    const pg = PAGES[currentPage];
    if (activeSectionFilter !== 'all' && pg.chapter.section !== activeSectionFilter) {
      activeSectionFilter = 'all';
      document.querySelectorAll('.sec-pill').forEach(b => b.classList.toggle('active', b.dataset.sec === 'all'));
      populateChapterDropdown('all');
    }
    chapterSelect.value = pg.chapter.id;
    pageSlider.value = currentPage + 1;
    document.getElementById('pageInfo').textContent = `صفحة ${toAr(currentPage + 1)} من ${toAr(PAGES.length)} — ${pg.chapter.title}`;
    document.getElementById('prevPageBtn').disabled = currentPage === 0;
    document.getElementById('nextPageBtn').disabled = currentPage === PAGES.length - 1;

    const fillEl = document.getElementById('progressFill');
    if (fillEl) fillEl.style.width = (((currentPage + 1) / PAGES.length) * 100).toFixed(1) + '%';

    let html = `
      <div class="page-chapter-banner">
        <span class="sec-tag">${SEC_LABELS[pg.chapter.section] || ''} • الباب ${toAr(pg.chapter.id)} من ٧٨</span>
        <h2>${escapeHtml(pg.chapter.title)}</h2>
        <div class="sub">الأبيات ${toAr(pg.verses[0].n)} – ${toAr(pg.verses[pg.verses.length - 1].n)} ${pg.totalParts > 1 ? `• الجزء ${toAr(pg.partIndex)} من ${toAr(pg.totalParts)}` : ''}</div>
      </div>
    `;
    if (pg.isFirstOfChapter && pg.chapter.intro) {
      html += `<div class="chapter-intro-box"><strong>تمهيد الباب (من الوافي):</strong> ${escapeHtml(pg.chapter.intro)}</div>`;
    }

    pg.verses.forEach(v => {
      const isSaved = Boolean(bookmarks[v.n]);
      html += `
        <div class="verse-card" data-verse="${v.n}" id="verse-${v.n}">
          <div class="verse-top">
            <span class="verse-num">${toAr(v.n)}</span>
            <div class="verse-lines">
              <div class="hemistich">${renderTokensHTML(v.st)}</div>
              <div class="hemistich">${renderTokensHTML(v.at)}</div>
            </div>
            <div class="verse-actions">
              <button class="v-btn v-play-btn" data-play="${v.n}" title="تشغيل البيت صوتياً">▶</button>
              <button class="v-btn" data-explain="${v.n}" title="عرض شرح الوافي">الشرح</button>
              <button class="v-btn ${isSaved ? 'saved' : ''}" data-bm="${v.n}" title="حفظ البيت">${isSaved ? '★' : '☆'}</button>
            </div>
          </div>
        </div>
      `;
    });

    const pageEl = document.getElementById('bookPage');
    pageEl.innerHTML = html;
    attachVerseInteractions(pageEl);

    if (highlightVerse) {
      const el = document.getElementById('verse-' + highlightVerse);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.classList.add('flash');
        setTimeout(() => el.classList.remove('flash'), 1900);
      }
    } else if (autoScroll) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    pageRenderedCallbacks.forEach(cb => cb(currentPage, pg));
  }

  function attachVerseInteractions(container) {
    container.querySelectorAll('[data-sym]').forEach(el => {
      el.addEventListener('click', e => {
        e.stopPropagation();
        const info = JSON.parse(decodeURIComponent(el.dataset.sym));
        showPopover(info, e.clientX, e.clientY);
      });
    });
    container.querySelectorAll('[data-play]').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        if (window.SHAT_AUDIO) window.SHAT_AUDIO.toggleVerse(Number(btn.dataset.play));
      });
    });
    container.querySelectorAll('[data-explain]').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        openWafiModal(Number(btn.dataset.explain));
      });
    });
    container.querySelectorAll('[data-bm]').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        toggleBookmark(Number(btn.dataset.bm));
      });
    });
    container.querySelectorAll('.verse-card').forEach(card => {
      const vn = Number(card.dataset.verse);
      let pressTimer = null;
      card.addEventListener('dblclick', e => {
        if (e.target.closest('[data-sym], button')) return;
        openWafiModal(vn);
      });
      card.addEventListener('touchstart', e => {
        if (e.target.closest('[data-sym], button')) return;
        pressTimer = setTimeout(() => { pressTimer = null; openWafiModal(vn); }, 520);
      }, { passive: true });
      const cancelPress = () => { if (pressTimer) { clearTimeout(pressTimer); pressTimer = null; } };
      card.addEventListener('touchend', cancelPress);
      card.addEventListener('touchmove', cancelPress);
      card.addEventListener('touchcancel', cancelPress);
      card.addEventListener('contextmenu', e => {
        if (!e.target.closest('[data-sym]')) e.preventDefault();
      });
    });
  }

  // Jump to verse number
  function jumpToVerseInput() {
    const raw = toEnDigits(document.getElementById('jumpVerseInput').value).trim();
    const num = Number(raw);
    if (!num || num < 1 || num > DATA.verses.length) return;
    setSectionPill('all', false);
    renderPage(verseToPage[num], num);
  }
  document.getElementById('jumpVerseBtn').addEventListener('click', jumpToVerseInput);
  document.getElementById('jumpVerseInput').addEventListener('keydown', e => {
    if (e.key === 'Enter') jumpToVerseInput();
  });

  const symPop = document.getElementById('symPopover');
  function showPopover(info, x, y) {
    document.getElementById('spBadge').textContent = info.sym;
    document.getElementById('spType').textContent = info.k === 'L' ? 'رمز حرفي (الحرف الأول فقط)' : 'رمز كلمي جماعي';
    document.getElementById('spReaders').textContent = info.readers;
    document.getElementById('spCat').textContent = `${info.cat} • الكلمة: «${info.word}»`;
    const noteEl = document.getElementById('spNote');
    noteEl.textContent = info.note ? `الدلالة في هذا الموضع: ${info.note}` : '';
    noteEl.style.display = info.note ? 'block' : 'none';

    symPop.style.display = 'block';
    const rect = symPop.getBoundingClientRect();
    let left = Math.min(Math.max(12, x - rect.width / 2), window.innerWidth - rect.width - 12);
    let top = y + 16;
    if (top + rect.height > window.innerHeight - 12) top = Math.max(12, y - rect.height - 14);
    symPop.style.left = left + 'px';
    symPop.style.top = top + 'px';
  }
  function hidePopover() { symPop.style.display = 'none'; }
  document.getElementById('spClose').addEventListener('click', hidePopover);
  document.addEventListener('click', e => {
    if (!symPop.contains(e.target) && !e.target.closest('[data-sym]')) hidePopover();
  });

  const wafiModal = document.getElementById('wafiModal');
  let commRegistry = [{ id: 'wafi', title: 'الوافي (القاضي)', author: 'الشيخ عبد الفتاح القاضي', builtin: true }];
  let loadedExtraComms = {};
  let activeCommId = 'wafi';

  fetch('data/commentaries/index.json')
    .then(r => r.ok ? r.json() : null)
    .then(idx => {
      if (idx && Array.isArray(idx.commentaries) && idx.commentaries.length) {
        commRegistry = idx.commentaries;
      }
    })
    .catch(() => {});

  async function getCommentaryForVerse(commId, vn) {
    const v = vMap[vn];
    if (commId === 'wafi') {
      const c = DATA.commentaries[v.cid];
      return {
        title: 'الوافي في شرح الشاطبية',
        range: c.range,
        summary: c.summary,
        full: c.full,
        footnotes: c.footnotes || []
      };
    }
    const meta = commRegistry.find(x => x.id === commId);
    if (!meta || !meta.file) return null;
    if (!loadedExtraComms[commId]) {
      const res = await fetch(meta.file);
      if (!res.ok) return null;
      loadedExtraComms[commId] = await res.json();
    }
    const ext = loadedExtraComms[commId];
    const sec = (ext.sections || []).find(s => vn >= s.from && vn <= s.to);
    if (!sec) return null;
    return {
      title: ext.title || meta.title,
      range: [sec.from, sec.to],
      summary: sec.summary || '',
      full: sec.full || '',
      footnotes: sec.footnotes || []
    };
  }

  async function openWafiModal(vn, commId = activeCommId) {
    hidePopover();
    const v = vMap[vn];
    activeModalVerse = vn;
    activeCommId = commId;

    // Render commentary switcher tabs
    const tabsBar = document.getElementById('wmCommTabs');
    if (tabsBar) {
      tabsBar.innerHTML = commRegistry.map(c =>
        `<button class="comm-tab-btn ${c.id === activeCommId ? 'active' : ''}" data-comm-id="${escapeHtml(c.id)}">${escapeHtml(c.title)}</button>`
      ).join('');
      tabsBar.querySelectorAll('[data-comm-id]').forEach(btn => {
        btn.addEventListener('click', () => openWafiModal(vn, btn.dataset.commId));
      });
    }

    let comm = await getCommentaryForVerse(activeCommId, vn);
    if (!comm && activeCommId !== 'wafi') {
      activeCommId = 'wafi';
      comm = await getCommentaryForVerse('wafi', vn);
    }

    const rStart = comm.range[0], rEnd = comm.range[1];
    const rangeTxt = rStart === rEnd ? `البيت ${toAr(rStart)}` : `الأبيات ${toAr(rStart)} – ${toAr(rEnd)}`;
    document.getElementById('wmTitle').textContent = `${comm.title} — ${chMap[v.ch].title} (${rangeTxt})`;

    let verseHtml = '';
    for (let k = rStart; k <= rEnd; k++) {
      const vk = vMap[k];
      if (!vk) continue;
      const mark = k === vn ? 'style="color:var(--accent);font-weight:700"' : '';
      verseHtml += `<div ${mark}><span style="font-size:.82rem;opacity:.7">(${toAr(k)})</span> ${escapeHtml(vk.s)} &nbsp;❖&nbsp; ${escapeHtml(vk.a)}</div>`;
    }
    document.getElementById('wmVerse').innerHTML = verseHtml;
    document.getElementById('wmSummary').textContent = comm.summary;

    const paras = comm.full.split(/\n\n+/).filter(Boolean);
    document.getElementById('wmFull').innerHTML = paras.map(p => {
      const formatted = escapeHtml(p).replace(/^(【[^】]+】|اللغة:|\[اللغة\]:|المعنى:|والمعنى:|اللغة والمعنى:|والخلاصة:|والحاصل:|تنبيهات?:|فائدة:|فائدتان:|تتمة|«تتمة»|تلخيص مذاهب القراء)/, '<strong style="color:var(--accent)">$1</strong>');
      return `<p class="wafi-para">${formatted}</p>`;
    }).join('');

    const fnEl = document.getElementById('wmFootnotes');
    if (comm.footnotes && comm.footnotes.length) {
      fnEl.style.display = 'block';
      fnEl.innerHTML = '<strong>حواشٍ وتنبيهات:</strong><br>' + comm.footnotes.map(f => escapeHtml(f)).join('<br>');
    } else {
      fnEl.style.display = 'none';
    }

    updateModalBmBtn();
    wafiModal.classList.add('open');
  }
  function updateModalBmBtn() {
    const btn = document.getElementById('wmBookmarkBtn');
    const saved = Boolean(bookmarks[activeModalVerse]);
    btn.textContent = saved ? '★ محفوظ' : '☆ حفظ البيت';
    btn.classList.toggle('saved', saved);
  }
  document.getElementById('wmBookmarkBtn').addEventListener('click', () => {
    if (activeModalVerse) { toggleBookmark(activeModalVerse); updateModalBmBtn(); }
  });
  document.getElementById('wmPlayBtn').addEventListener('click', () => {
    if (activeModalVerse && window.SHAT_AUDIO) window.SHAT_AUDIO.playVerse(activeModalVerse);
  });
  document.getElementById('wmClose').addEventListener('click', () => wafiModal.classList.remove('open'));
  wafiModal.addEventListener('click', e => { if (e.target === wafiModal) wafiModal.classList.remove('open'); });

  document.getElementById('prevPageBtn').addEventListener('click', () => renderPage(currentPage - 1));
  document.getElementById('nextPageBtn').addEventListener('click', () => renderPage(currentPage + 1));
  pageSlider.addEventListener('input', e => renderPage(Number(e.target.value) - 1));
  chapterSelect.addEventListener('change', e => renderPage(chapterToFirstPage[Number(e.target.value)]));

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      hidePopover();
      wafiModal.classList.remove('open');
      refModal.classList.remove('open');
      const asModal = document.getElementById('audioSettingsModal');
      if (asModal) asModal.classList.remove('open');
      return;
    }
    if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)) return;
    const anyModalOpen = wafiModal.classList.contains('open') || refModal.classList.contains('open') ||
      (document.getElementById('audioSettingsModal') && document.getElementById('audioSettingsModal').classList.contains('open'));
    if (anyModalOpen) return;
    if (e.code === 'Space' && document.getElementById('view-reader').classList.contains('active')) {
      e.preventDefault();
      if (window.SHAT_AUDIO) window.SHAT_AUDIO.togglePlayPause();
      return;
    }
    if (!document.getElementById('view-reader').classList.contains('active')) return;
    if (e.key === 'ArrowLeft') renderPage(currentPage + 1);
    if (e.key === 'ArrowRight') renderPage(currentPage - 1);
  });

  let touchStartX = 0, touchStartY = 0;
  const vp = document.getElementById('bookViewport');
  vp.addEventListener('touchstart', e => {
    touchStartX = e.changedTouches[0].clientX;
    touchStartY = e.changedTouches[0].clientY;
  }, { passive: true });
  vp.addEventListener('touchend', e => {
    const dx = e.changedTouches[0].clientX - touchStartX;
    const dy = e.changedTouches[0].clientY - touchStartY;
    if (Math.abs(dx) > 65 && Math.abs(dx) > Math.abs(dy) * 1.4) {
      if (dx > 0) renderPage(currentPage + 1);
      else renderPage(currentPage - 1);
    }
  }, { passive: true });

  function switchView(name) {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.toggle('active', b.dataset.view === name));
    document.getElementById('view-' + name).classList.add('active');
    hidePopover();
    if (name === 'bookmarks') renderBookmarks();
    if (name === 'search') runSearch();
  }
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => switchView(btn.dataset.view));
  });

  document.getElementById('fontInc').addEventListener('click', () => {
    fontScale = Math.min(2.1, +(fontScale + 0.1).toFixed(2));
    localStorage.setItem('shat_font', fontScale);
    document.documentElement.style.setProperty('--verse-size', fontScale + 'rem');
  });
  document.getElementById('fontDec').addEventListener('click', () => {
    fontScale = Math.max(1.05, +(fontScale - 0.1).toFixed(2));
    localStorage.setItem('shat_font', fontScale);
    document.documentElement.style.setProperty('--verse-size', fontScale + 'rem');
  });
  document.getElementById('themeToggle').addEventListener('click', () => {
    document.body.classList.toggle('dark');
    localStorage.setItem('shat_dark', document.body.classList.contains('dark') ? '1' : '0');
  });

  function updateBmCount() {
    document.getElementById('bmCount').textContent = toAr(Object.keys(bookmarks).length);
  }
  function toggleBookmark(vn) {
    if (bookmarks[vn]) delete bookmarks[vn];
    else bookmarks[vn] = { note: '', savedAt: new Date().toISOString() };
    localStorage.setItem('shat_bookmarks', JSON.stringify(bookmarks));
    updateBmCount();
    const btn = document.querySelector(`[data-bm="${vn}"]`);
    if (btn) {
      const saved = Boolean(bookmarks[vn]);
      btn.classList.toggle('saved', saved);
      btn.textContent = saved ? '★' : '☆';
    }
  }
  function renderBookmarks() {
    const list = document.getElementById('bookmarksList');
    const keys = Object.keys(bookmarks).map(Number).sort((a, b) => a - b);
    if (!keys.length) {
      list.innerHTML = '<p style="color:var(--ink-muted);text-align:center;padding:24px">لا توجد أبيات محفوظة بعد. اضغط على النجمة ☆ بجانب أي بيت لحفظه وإضافة ملاحظاتك.</p>';
      return;
    }
    list.innerHTML = keys.map(vn => {
      const v = vMap[vn];
      if (!v) return '';
      return `
        <div class="result-item" style="cursor:default">
          <div class="result-meta">
            <span>البيت ${toAr(vn)} — ${escapeHtml(chMap[v.ch].title)}</span>
            <div style="display:flex;gap:6px">
              <button class="v-btn" onclick="window.__playVerse(${vn})">▶ استماع</button>
              <button class="v-btn" onclick="window.__goVerse(${vn})">فتح في المتن</button>
              <button class="v-btn" onclick="window.__openExp(${vn})">الشرح</button>
              <button class="v-btn" style="color:var(--sym-red)" onclick="window.__delBm(${vn})">حذف</button>
            </div>
          </div>
          <div class="result-verse">${escapeHtml(v.s)} &nbsp;❖&nbsp; ${escapeHtml(v.a)}</div>
          <textarea class="note-textarea" rows="2" placeholder="أضف ملاحظتك الشخصية أو تنبيهاً للمراجعة..." data-bmnote="${vn}">${escapeHtml(bookmarks[vn].note || '')}</textarea>
        </div>
      `;
    }).join('');
    list.querySelectorAll('[data-bmnote]').forEach(ta => {
      ta.addEventListener('input', () => {
        const vn = Number(ta.dataset.bmnote);
        if (bookmarks[vn]) {
          bookmarks[vn].note = ta.value;
          localStorage.setItem('shat_bookmarks', JSON.stringify(bookmarks));
        }
      });
    });
  }
  window.__goVerse = vn => { setSectionPill('all', false); switchView('reader'); renderPage(verseToPage[vn], vn); };
  window.__openExp = vn => openWafiModal(vn);
  window.__delBm = vn => { toggleBookmark(vn); renderBookmarks(); };
  window.__playVerse = vn => { if (window.SHAT_AUDIO) window.SHAT_AUDIO.playVerse(vn); };

  document.getElementById('exportBmBtn').addEventListener('click', () => {
    downloadJSON(bookmarks, 'shatibiyyah_bookmarks.json');
  });

  // Search Engine across all 1,173 verses + Wafi full text
  const searchInput = document.getElementById('searchInput');
  const onlySymCheck = document.getElementById('onlySymbolsCheck');
  const searchSecFilter = document.getElementById('searchSecFilter');

  function runSearch() {
    const qRaw = searchInput.value.trim();
    const q = stripDiac(qRaw);
    const chVal = searchChapFilter.value;
    const secVal = searchSecFilter.value;
    const onlySym = onlySymCheck.checked;
    const qDigits = toEnDigits(qRaw);
    const qNum = /^\d+$/.test(qDigits) ? Number(qDigits) : null;

    const results = DATA.verses.filter(v => {
      const ch = chMap[v.ch];
      if (secVal !== 'all' && ch.section !== secVal) return false;
      if (chVal !== 'all' && String(v.ch) !== chVal) return false;
      if (onlySym && !v.hs) return false;
      if (!q) return true;
      if (qNum && v.n === qNum) return true;
      if (stripDiac(v.p).includes(q)) return true;
      if (stripDiac(ch.title).includes(q)) return true;
      const symText = [...v.st, ...v.at].filter(t => t.k !== 'N').map(t => t.readers + ' ' + t.sym).join(' ');
      if (stripDiac(symText).includes(q)) return true;
      const comm = DATA.commentaries[v.cid];
      if (stripDiac(comm.full).includes(q)) return true;
      return false;
    });

    const stats = document.getElementById('searchStats');
    stats.textContent = `عدد النتائج: ${toAr(results.length)} بيت${results.length > 60 ? ' (يُعرض أول ٦٠ نتيجة، خصّص البحث لعرض أدق)' : ''}`;
    const box = document.getElementById('searchResults');
    if (!results.length) {
      box.innerHTML = '<p style="text-align:center;color:var(--ink-muted);padding:18px">لم يُعثر على نتائج مطابقة.</p>';
      return;
    }
    box.innerHTML = results.slice(0, 60).map(v => `
      <div class="result-item" onclick="window.__goVerse(${v.n})">
        <div class="result-meta">
          <span>البيت ${toAr(v.n)} • ${escapeHtml(chMap[v.ch].title)} (${SEC_LABELS[chMap[v.ch].section]})</span>
          <span>${v.hs ? '🔴 يحتوي على رموز' : 'بدون رموز'}</span>
        </div>
        <div class="result-verse">${escapeHtml(v.s)} &nbsp;❖&nbsp; ${escapeHtml(v.a)}</div>
      </div>
    `).join('');
  }
  searchInput.addEventListener('input', runSearch);
  searchChapFilter.addEventListener('change', runSearch);
  searchSecFilter.addEventListener('change', runSearch);
  onlySymCheck.addEventListener('change', runSearch);

  // Reference Card Modal
  const refModal = document.getElementById('refModal');
  function buildRefModal() {
    const r = DATA.refs;
    document.getElementById('refBody').innerHTML = `
      <h4 style="margin-top:0;color:var(--accent)">١. الرموز الحرفية الفردية (أبج دهز حطي كلم نصع فضق رست)</h4>
      <table class="ref-table">
        <thead><tr><th>المجموعة</th><th>الإمام</th><th>الراوي الأول</th><th>الراوي الثاني</th></tr></thead>
        <tbody>${r.individual_groups.map(g => `<tr><td style="color:var(--sym-red);font-weight:800">${g.code}</td><td>${g.imam}</td><td>${g.r1}</td><td>${g.r2}</td></tr>`).join('')}</tbody>
      </table>
      <h4 style="color:var(--accent)">٢. الرموز الحرفية الجماعية (ثخذ ظغش)</h4>
      <table class="ref-table">
        <thead><tr><th>الرمز</th><th>القراء المقصودون</th></tr></thead>
        <tbody>${r.group_letters.map(g => `<tr><td style="color:var(--sym-red);font-weight:800;font-size:1.1rem">${g.sym}</td><td>${g.readers}</td></tr>`).join('')}</tbody>
      </table>
      <h4 style="color:var(--accent)">٣. الرموز الكلمية الجماعية (الكلمات الثمان)</h4>
      <table class="ref-table">
        <thead><tr><th>الكلمة الرمزية</th><th>القراء المقصودون</th></tr></thead>
        <tbody>${r.word_symbols.map(g => `<tr><td style="color:var(--sym-red);font-weight:800">${g.sym}</td><td>${g.readers}</td></tr>`).join('')}</tbody>
      </table>
    `;
  }
  document.getElementById('openRefBtn').addEventListener('click', () => refModal.classList.add('open'));
  document.getElementById('refClose').addEventListener('click', () => refModal.classList.remove('open'));
  refModal.addEventListener('click', e => { if (e.target === refModal) refModal.classList.remove('open'); });

  // Quiz Engine
  function getAllQuestions() { return [...DATA.quiz, ...customQuiz]; }
  function populateQuizChapters() {
    const sel = document.getElementById('quizChapFilter');
    const chs = [...new Set(getAllQuestions().map(q => q.chapter))];
    sel.innerHTML = '<option value="all">جميع أبواب الاختبار (' + toAr(getAllQuestions().length) + ' سؤالاً)</option>' +
      chs.map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('');
  }

  let quizSession = { list: [], idx: 0, score: 0, answered: false };
  function startQuiz() {
    const chF = document.getElementById('quizChapFilter').value;
    const lvF = document.getElementById('quizLevelFilter').value;
    let pool = getAllQuestions().filter(q => (chF === 'all' || q.chapter === chF) && (lvF === 'all' || q.level === lvF));
    pool = pool.sort(() => Math.random() - 0.5);
    quizSession = { list: pool, idx: 0, score: 0, answered: false };
    renderQuizCard();
  }

  function renderQuizCard() {
    const box = document.getElementById('quizContainer');
    const scoreBadge = document.getElementById('quizScoreBadge');
    if (!quizSession.list.length) {
      box.innerHTML = '<p style="text-align:center;color:var(--ink-muted)">لا توجد أسئلة مطابقة للتصفية الحالية.</p>';
      scoreBadge.textContent = '';
      return;
    }
    if (quizSession.idx >= quizSession.list.length) {
      const pct = Math.round((quizSession.score / quizSession.list.length) * 100);
      scoreBadge.textContent = `النتيجة النهائية: ${toAr(quizSession.score)} / ${toAr(quizSession.list.length)} (${toAr(pct)}%)`;
      box.innerHTML = `
        <div style="text-align:center;padding:26px;background:var(--accent-light);border-radius:14px">
          <h3 style="color:var(--accent);margin-top:0">أتممت الاختبار بنجاح!</h3>
          <p style="font-size:1.25rem;font-weight:800">درجتك: ${toAr(quizSession.score)} من ${toAr(quizSession.list.length)} (${toAr(pct)}%)</p>
          <button class="page-nav-btn" onclick="window.__restartQuiz()">إعادة المحاولة</button>
        </div>
      `;
      return;
    }
    const q = quizSession.list[quizSession.idx];
    scoreBadge.textContent = `السؤال ${toAr(quizSession.idx + 1)} من ${toAr(quizSession.list.length)} • النقاط: ${toAr(quizSession.score)}`;
    box.innerHTML = `
      <div style="background:var(--bg);border:1px solid var(--border);border-radius:14px;padding:16px">
        <div style="display:flex;justify-content:space-between;font-size:.82rem;color:var(--accent);font-weight:700;margin-bottom:8px">
          <span>الباب: ${escapeHtml(q.chapter)}</span>
          <span>المستوى: ${escapeHtml(q.level)}</span>
        </div>
        <h3 style="margin:0 0 14px;font-size:1.08rem;line-height:1.7">${escapeHtml(q.q)}</h3>
        <div id="qOpts">
          ${q.opts.map((o, i) => `<button class="quiz-opt" data-opt="${i}">${toAr(i + 1)}. ${escapeHtml(o)}</button>`).join('')}
        </div>
        <div id="qFeedback" style="margin-top:10px;display:none;padding:10px 12px;border-radius:10px;background:var(--gold-soft);font-size:.9rem"></div>
        <div style="margin-top:12px;text-align:left">
          <button class="page-nav-btn" id="nextQBtn" style="display:none">السؤال التالي ←</button>
        </div>
      </div>
    `;
    box.querySelectorAll('[data-opt]').forEach(btn => {
      btn.addEventListener('click', () => {
        if (quizSession.answered) return;
        quizSession.answered = true;
        const chosen = Number(btn.dataset.opt);
        box.querySelectorAll('[data-opt]').forEach(b => {
          b.disabled = true;
          const bi = Number(b.dataset.opt);
          if (bi === q.ans) b.classList.add('correct');
          else if (bi === chosen) b.classList.add('wrong');
        });
        if (chosen === q.ans) quizSession.score++;
        const fb = document.getElementById('qFeedback');
        fb.style.display = 'block';
        fb.innerHTML = `<strong>${chosen === q.ans ? '✔ إجابة صحيحة!' : '✘ إجابة غير صحيحة.'}</strong> ${escapeHtml(q.exp || '')}`;
        document.getElementById('nextQBtn').style.display = 'inline-block';
      });
    });
    document.getElementById('nextQBtn').addEventListener('click', () => {
      quizSession.idx++;
      quizSession.answered = false;
      renderQuizCard();
    });
  }
  window.__restartQuiz = startQuiz;

  document.getElementById('startQuizBtn').addEventListener('click', startQuiz);
  document.getElementById('toggleAddQBtn').addEventListener('click', () => {
    const f = document.getElementById('addQForm');
    f.style.display = f.style.display === 'none' ? 'block' : 'none';
  });
  document.getElementById('saveQBtn').addEventListener('click', () => {
    const q = {
      id: Date.now(),
      chapter: document.getElementById('nqChap').value.trim() || 'أسئلة مضافة',
      level: document.getElementById('nqLevel').value,
      q: document.getElementById('nqText').value.trim(),
      opts: [0,1,2,3].map(i => document.getElementById('nqO' + i).value.trim()),
      ans: Number(document.getElementById('nqAns').value),
      exp: document.getElementById('nqExp').value.trim()
    };
    if (!q.q || q.opts.some(o => !o)) { alert('يرجى إدخال نص السؤال والخيارات الأربعة.'); return; }
    customQuiz.push(q);
    localStorage.setItem('shat_custom_quiz', JSON.stringify(customQuiz));
    ['nqText','nqO0','nqO1','nqO2','nqO3','nqExp'].forEach(id => document.getElementById(id).value = '');
    populateQuizChapters();
    alert('تم حفظ السؤال في بنك الأسئلة بنجاح!');
    startQuiz();
  });
  document.getElementById('exportQuizBtn').addEventListener('click', () => downloadJSON(getAllQuestions(), 'shatibiyyah_quiz_bank.json'));
  document.getElementById('importQuizInput').addEventListener('change', e => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const arr = JSON.parse(reader.result);
        if (!Array.isArray(arr)) throw new Error('invalid');
        const existingQs = new Set(getAllQuestions().map(x => x.q));
        let added = 0;
        arr.forEach(item => {
          if (item && item.q && Array.isArray(item.opts) && item.opts.length === 4 && !existingQs.has(item.q)) {
            customQuiz.push(item);
            added++;
          }
        });
        localStorage.setItem('shat_custom_quiz', JSON.stringify(customQuiz));
        populateQuizChapters();
        startQuiz();
        alert(`تم استيراد ${added} سؤالاً جديداً بنجاح.`);
      } catch { alert('ملف JSON غير صالح.'); }
    };
    reader.readAsText(file);
  });

  function downloadJSON(obj, filename) {
    const blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  // Expose clean bridge for Audio Player & future modules (e.g. Symbol Trainer)
  window.SHAT_APP = {
    DATA,
    vMap,
    chMap,
    PAGES,
    verseToPage,
    chapterToFirstPage,
    toAr,
    toEnDigits,
    escapeHtml,
    downloadJSON,
    getCurrentPageIndex: () => currentPage,
    getCurrentPageObj: () => PAGES[currentPage],
    focusVerse: (vn) => {
      const targetPage = verseToPage[vn];
      if (targetPage === undefined) return;
      if (targetPage !== currentPage) {
        renderPage(targetPage, null, false);
      }
      const el = document.getElementById('verse-' + vn);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    },
    onPageRendered: (cb) => pageRenderedCallbacks.push(cb),
    openWafi: (vn) => openWafiModal(vn),
    goToVerse: (vn) => { setSectionPill('all', false); switchView('reader'); renderPage(verseToPage[vn], vn); },
    switchView
  };

  populateChapterDropdown('all');
  populateSearchChaptersAndIndex();
  buildRefModal();
  updateBmCount();
  populateQuizChapters();
  startQuiz();
  renderPage(currentPage);


  // Mobile & PWA Modal + Service Worker
  const mobileModal = document.getElementById('mobileModal');
  const openMobileBtn = document.getElementById('openMobileBtn');
  const mmClose = document.getElementById('mmClose');
  if (openMobileBtn && mobileModal) {
    openMobileBtn.addEventListener('click', () => mobileModal.classList.add('open'));
    mmClose.addEventListener('click', () => mobileModal.classList.remove('open'));
    mobileModal.addEventListener('click', e => { if (e.target === mobileModal) mobileModal.classList.remove('open'); });
  }

  let deferredInstallPrompt = null;
  const installPwaBtn = document.getElementById('installPwaBtn');
  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault();
    deferredInstallPrompt = e;
    if (installPwaBtn) installPwaBtn.style.display = 'inline-block';
  });
  if (installPwaBtn) {
    installPwaBtn.addEventListener('click', async () => {
      if (!deferredInstallPrompt) return;
      deferredInstallPrompt.prompt();
      await deferredInstallPrompt.userChoice;
      deferredInstallPrompt = null;
      installPwaBtn.style.display = 'none';
    });
  }
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }

  if (typeof window.initShatAudio === 'function') {
    window.initShatAudio(window.SHAT_APP);
  }
  if (typeof window.initShatTrainer === 'function') {
    window.initShatTrainer(window.SHAT_APP);
  }
})();
