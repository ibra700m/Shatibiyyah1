/* وضع التدريب الآلي الذكي على رموز الشاطبية (١,٦٠٥ رموز — ٣٥ رمزاً أصلياً) */
window.initShatTrainer = function(APP) {
  const { DATA, vMap, chMap, toAr, escapeHtml } = APP;

  // Canonical catalog of all 35 Shatibi symbols
  const CATALOG = [
    // Individual Letters (21)
    { sym: 'ا', short: 'نافع', readers: 'نافع المدني', type: 'indiv', group: 'أبج' },
    { sym: 'ب', short: 'قالون', readers: 'قالون عن نافع', type: 'indiv', group: 'أبج' },
    { sym: 'ج', short: 'ورش', readers: 'ورش عن نافع', type: 'indiv', group: 'أبج' },
    { sym: 'د', short: 'ابن كثير', readers: 'ابن كثير المكي', type: 'indiv', group: 'دهز' },
    { sym: 'ه', short: 'البزي', readers: 'البزي عن ابن كثير', type: 'indiv', group: 'دهز' },
    { sym: 'ز', short: 'قنبل', readers: 'قنبل عن ابن كثير', type: 'indiv', group: 'دهز' },
    { sym: 'ح', short: 'أبو عمرو', readers: 'أبو عمرو البصري', type: 'indiv', group: 'حطي' },
    { sym: 'ط', short: 'الدوري (ع)', readers: 'الدوري عن أبي عمرو', type: 'indiv', group: 'حطي' },
    { sym: 'ي', short: 'السوسي', readers: 'السوسي عن أبي عمرو', type: 'indiv', group: 'حطي' },
    { sym: 'ك', short: 'ابن عامر', readers: 'ابن عامر الشامي', type: 'indiv', group: 'كلم' },
    { sym: 'ل', short: 'هشام', readers: 'هشام عن ابن عامر', type: 'indiv', group: 'كلم' },
    { sym: 'م', short: 'ابن ذكوان', readers: 'ابن ذكوان عن ابن عامر', type: 'indiv', group: 'كلم' },
    { sym: 'ن', short: 'عاصم', readers: 'عاصم الكوفي', type: 'indiv', group: 'نصع' },
    { sym: 'ص', short: 'شعبة', readers: 'شعبة عن عاصم', type: 'indiv', group: 'نصع' },
    { sym: 'ع', short: 'حفص', readers: 'حفص عن عاصم', type: 'indiv', group: 'نصع' },
    { sym: 'ف', short: 'حمزة', readers: 'حمزة الكوفي', type: 'indiv', group: 'فضق' },
    { sym: 'ض', short: 'خلف', readers: 'خلف عن حمزة', type: 'indiv', group: 'فضق' },
    { sym: 'ق', short: 'خلاد', readers: 'خلاد عن حمزة', type: 'indiv', group: 'فضق' },
    { sym: 'ر', short: 'الكسائي', readers: 'الكسائي الكوفي', type: 'indiv', group: 'رست' },
    { sym: 'س', short: 'أبو الحارث', readers: 'أبو الحارث عن الكسائي', type: 'indiv', group: 'رست' },
    { sym: 'ت', short: 'الدوري (ك)', readers: 'الدوري عن الكسائي', type: 'indiv', group: 'رست' },
    // Group Letters (6)
    { sym: 'ث', short: 'الكوفيون', readers: 'الكوفيون الثلاثة (عاصم، حمزة، الكسائي)', type: 'group', group: 'ثخذ' },
    { sym: 'خ', short: 'الستة عدا نافع', readers: 'القراء الستة (كل القراء عدا نافع)', type: 'group', group: 'ثخذ' },
    { sym: 'ذ', short: 'الشامي والكوفيون', readers: 'ابن عامر والكوفيون الثلاثة', type: 'group', group: 'ثخذ' },
    { sym: 'ظ', short: 'المكي والكوفيون', readers: 'ابن كثير والكوفيون الثلاثة', type: 'group', group: 'ظغش' },
    { sym: 'غ', short: 'البصري والكوفيون', readers: 'أبو عمرو والكوفيون الثلاثة', type: 'group', group: 'ظغش' },
    { sym: 'ش', short: 'حمزة والكسائي', readers: 'حمزة والكسائي', type: 'group', group: 'ظغش' },
    // Word Symbols (8)
    { sym: 'صحبة', short: 'حمزة والكسائي وشعبة', readers: 'حمزة والكسائي وشعبة', type: 'word', group: 'كلمية' },
    { sym: 'صحاب', short: 'حمزة والكسائي وحفص', readers: 'حمزة والكسائي وحفص', type: 'word', group: 'كلمية' },
    { sym: 'عم', short: 'نافع وابن عامر', readers: 'نافع وابن عامر', type: 'word', group: 'كلمية' },
    { sym: 'سما', short: 'نافع والمكي والبصري', readers: 'نافع وابن كثير وأبو عمرو', type: 'word', group: 'كلمية' },
    { sym: 'حق', short: 'المكي والبصري', readers: 'ابن كثير وأبو عمرو', type: 'word', group: 'كلمية' },
    { sym: 'نفر', short: 'المكي والبصري والشامي', readers: 'ابن كثير وأبو عمرو وابن عامر', type: 'word', group: 'كلمية' },
    { sym: 'حرمي', short: 'نافع وابن كثير', readers: 'نافع وابن كثير', type: 'word', group: 'كلمية' },
    { sym: 'حصن', short: 'نافع والكوفيون', readers: 'نافع والكوفيون الثلاثة', type: 'word', group: 'كلمية' },
  ];
  const CAT_MAP = Object.fromEntries(CATALOG.map(c => [c.sym, c]));

  // Index all 1,605 tagged symbol occurrences from DATA.verses
  const ALL_OCCURRENCES = [];
  const CHAPTERS_WITH_SYMS = new Set();

  DATA.verses.forEach(v => {
    const ch = chMap[v.ch];
    const addSide = (tokens, side) => {
      tokens.forEach((tk, idx) => {
        if (tk.k !== 'L' && tk.k !== 'W') return;
        const meta = CAT_MAP[tk.sym];
        if (!meta) return;
        CHAPTERS_WITH_SYMS.add(v.ch);
        ALL_OCCURRENCES.push({
          vn: v.n,
          chId: v.ch,
          chTitle: ch.title,
          section: ch.section,
          side,          // 'st' | 'at'
          tokIdx: idx,
          tk,
          sym: tk.sym,
          type: meta.type,
          readers: meta.readers,
          cat: tk.cat || meta.group,
          note: tk.note || ''
        });
      });
    };
    addSide(v.st, 'st');
    addSide(v.at, 'at');
  });

  // Persistent statistics
  const defaultStats = () => ({
    total: 0,
    correct: 0,
    bestStreak: 0,
    perSym: {} // { [sym]: { ok: n, fail: n } }
  });
  let stats = Object.assign(defaultStats(), JSON.parse(localStorage.getItem('shat_trainer_stats') || '{}'));
  if (!stats.perSym) stats.perSym = {};

  function saveStats() {
    localStorage.setItem('shat_trainer_stats', JSON.stringify(stats));
  }

  // Trainer Runtime State
  const tr = {
    mode: 'mixed',           // 'mixed' | 'decode' | 'spot' | 'flash'
    scope: 'all',            // 'all' | 'osool' | 'farsh'
    chFilter: 'all',
    catFilter: 'all',        // 'all' | 'indiv' | 'group' | 'word'
    sessionLen: 10,          // 0 = infinite
    timerEnabled: false,
    focusSyms: null,         // null or Set of symbols (e.g. weak symbols or single heatmap symbol)
    focusLabel: '',

    // Active session
    items: [],
    idx: 0,
    score: 0,
    streak: 0,
    maxSessionStreak: 0,
    answered: false,
    mistakes: [],
    currentQ: null,
    timerId: null,
    timeLeft: 15,
  };

  // DOM References
  const scopeFilter = document.getElementById('trScopeFilter');
  const chapterSelect = document.getElementById('trChapterSelect');
  const catFilter = document.getElementById('trCatFilter');
  const lenSelect = document.getElementById('trLenSelect');
  const timerCheck = document.getElementById('trTimerCheck');
  const startBtn = document.getElementById('trStartBtn');
  const weakBtn = document.getElementById('trWeakBtn');
  const weakCountEl = document.getElementById('trWeakCount');
  const resetStatsBtn = document.getElementById('trResetStatsBtn');
  const focusNotice = document.getElementById('trFocusNotice');
  const focusText = document.getElementById('trFocusText');
  const clearFocusBtn = document.getElementById('trClearFocusBtn');
  const arena = document.getElementById('trArena');
  const heatmapHost = document.getElementById('trHeatmapHost');

  // Populate chapters with symbols
  function populateChapters() {
    const scope = scopeFilter.value;
    chapterSelect.innerHTML = '';
    const chList = DATA.chapters.filter(c =>
      CHAPTERS_WITH_SYMS.has(c.id) && (scope === 'all' || c.section === scope)
    );
    const allOpt = document.createElement('option');
    allOpt.value = 'all';
    allOpt.textContent = `جميع الأبواب ذات الرموز (${toAr(chList.length)} باباً)`;
    chapterSelect.appendChild(allOpt);

    chList.forEach(ch => {
      const opt = document.createElement('option');
      opt.value = ch.id;
      opt.textContent = `${toAr(ch.id)}. ${ch.title}`;
      chapterSelect.appendChild(opt);
    });
  }

  // Helpers
  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function getWeakSymbols() {
    return CATALOG.filter(c => {
      const s = stats.perSym[c.sym];
      if (!s) return false;
      const tot = s.ok + s.fail;
      return tot > 0 && (s.fail >= 1 && (s.ok / tot) < 0.75);
    }).map(c => c.sym);
  }

  function getMasteredCount() {
    return CATALOG.filter(c => {
      const s = stats.perSym[c.sym];
      if (!s) return false;
      const tot = s.ok + s.fail;
      return tot >= 2 && (s.ok / tot) >= 0.85;
    }).length;
  }

  function clearQuestionTimer() {
    if (tr.timerId) { clearInterval(tr.timerId); tr.timerId = null; }
  }

  // Update KPIs & Heatmap
  function updateStatsUI() {
    document.getElementById('trTotalAnswered').textContent = toAr(stats.total);
    const pct = stats.total ? Math.round((stats.correct / stats.total) * 100) : 0;
    document.getElementById('trOverallAcc').textContent = `${toAr(pct)}%`;
    document.getElementById('trBestStreak').textContent = toAr(stats.bestStreak);
    document.getElementById('trMasteredCount').textContent = `${toAr(getMasteredCount())} / ٣٥`;

    const weak = getWeakSymbols();
    weakCountEl.textContent = toAr(weak.length);
    weakBtn.disabled = weak.length === 0;
    weakBtn.style.opacity = weak.length === 0 ? '.55' : '1';

    renderHeatmap();
  }

  function renderHeatmap() {
    const sections = [
      { key: 'indiv', title: '١. الرموز الحرفية الفردية (٢١ رمزاً — أبج دهز حطي كلم نصع فضق رست)' },
      { key: 'group', title: '٢. الرموز الحرفية الجماعية (٦ رموز — ثخذ ظغش)' },
      { key: 'word', title: '٣. الرموز الكلمية الجماعية (٨ كلمات)' },
    ];
    heatmapHost.innerHTML = sections.map(sec => {
      const items = CATALOG.filter(c => c.type === sec.key);
      return `
        <div class="hm-group-title">${sec.title}</div>
        <div class="hm-grid">
          ${items.map(c => {
            const st = stats.perSym[c.sym];
            const tot = st ? (st.ok + st.fail) : 0;
            const acc = tot ? Math.round((st.ok / tot) * 100) : null;
            let cls = '';
            if (tot >= 2 && acc >= 85) cls = 'lvl-master';
            else if (tot >= 1 && acc >= 60) cls = 'lvl-mid';
            else if (tot >= 1 && acc < 60) cls = 'lvl-weak';
            const accTxt = acc === null ? 'جديد' : `${toAr(acc)}% (${toAr(tot)})`;
            return `
              <div class="hm-tile ${cls}" data-hm-sym="${escapeHtml(c.sym)}" title="${escapeHtml(c.readers)} — اضغط للتدريب على هذا الرمز">
                <div class="hm-sym">${escapeHtml(c.sym)}</div>
                <div class="hm-sub">${escapeHtml(c.short)}</div>
                <div class="hm-acc">${accTxt}</div>
              </div>
            `;
          }).join('')}
        </div>
      `;
    }).join('');

    heatmapHost.querySelectorAll('[data-hm-sym]').forEach(tile => {
      tile.addEventListener('click', () => {
        const sym = tile.dataset.hmSym;
        const c = CAT_MAP[sym];
        tr.focusSyms = new Set([sym]);
        tr.focusLabel = `تدريب مركّز على الرمز «${sym}» (${c.readers})`;
        showFocusNotice();
        startSession();
        arena.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    });
  }

  function showFocusNotice() {
    if (tr.focusSyms && tr.focusSyms.size) {
      focusText.textContent = `🎯 ${tr.focusLabel}`;
      focusNotice.style.display = 'flex';
    } else {
      focusNotice.style.display = 'none';
    }
  }

  // Smart Distractor Generator (picks plausible distractors from same symbol type first)
  function pickDistractors(targetSym, field, count = 3) {
    const target = CAT_MAP[targetSym];
    const sameType = shuffle(CATALOG.filter(c => c.sym !== targetSym && c.type === target.type));
    const others = shuffle(CATALOG.filter(c => c.sym !== targetSym && c.type !== target.type));
    const pool = [...sameType, ...others];
    const chosen = [];
    const seenVals = new Set([target[field]]);
    for (const item of pool) {
      if (chosen.length >= count) break;
      if (!seenVals.has(item[field])) {
        seenVals.add(item[field]);
        chosen.push(item[field]);
      }
    }
    return chosen;
  }

  // Filter eligible occurrences & catalog entries
  function getFilteredOccurrences() {
    return ALL_OCCURRENCES.filter(o => {
      if (tr.focusSyms && !tr.focusSyms.has(o.sym)) return false;
      if (tr.scope !== 'all' && o.section !== tr.scope) return false;
      if (tr.chFilter !== 'all' && String(o.chId) !== String(tr.chFilter)) return false;
      if (tr.catFilter !== 'all' && o.type !== tr.catFilter) return false;
      return true;
    });
  }

  function getFilteredCatalog() {
    return CATALOG.filter(c => {
      if (tr.focusSyms && !tr.focusSyms.has(c.sym)) return false;
      if (tr.catFilter !== 'all' && c.type !== tr.catFilter) return false;
      return true;
    });
  }

  // Build a single question object
  function buildQuestion(kind, occOrCat) {
    if (kind === 'flash') {
      const c = occOrCat;
      const askSym = Math.random() < 0.5;
      if (askSym) {
        const distractors = pickDistractors(c.sym, 'sym', 3);
        const opts = shuffle([c.sym, ...distractors]);
        return {
          kind: 'flash',
          direction: 'readers-to-sym',
          sym: c.sym,
          readers: c.readers,
          catObj: c,
          prompt: 'اختر رمز الشاطبية الصحيح للقارئ أو المجموعة التالية:',
          displayMain: c.readers,
          displaySub: c.type === 'word' ? 'رمز كلمي جماعي' : (c.type === 'group' ? 'رمز حرفي جماعي (ثخذ ظغش)' : `رمز حرفي فردي — مجموعة (${c.group})`),
          opts,
          ansIdx: opts.indexOf(c.sym),
          ansLabel: c.sym
        };
      } else {
        const distractors = pickDistractors(c.sym, 'readers', 3);
        const opts = shuffle([c.readers, ...distractors]);
        return {
          kind: 'flash',
          direction: 'sym-to-readers',
          sym: c.sym,
          readers: c.readers,
          catObj: c,
          prompt: 'من القارئ أو القراء المرموز لهم بهذا الرمز في الشاطبية؟',
          displayMain: c.sym,
          displaySub: c.type === 'word' ? 'رمز كلمي جماعي' : (c.type === 'group' ? 'رمز حرفي جماعي' : 'رمز حرفي فردي'),
          opts,
          ansIdx: opts.indexOf(c.readers),
          ansLabel: c.readers
        };
      }
    }

    const occ = occOrCat;
    const v = vMap[occ.vn];
    if (kind === 'decode') {
      const distractors = pickDistractors(occ.sym, 'readers', 3);
      const opts = shuffle([occ.readers, ...distractors]);
      return {
        kind: 'decode',
        occ,
        v,
        sym: occ.sym,
        readers: occ.readers,
        prompt: `من المرموز له بالرمز «${occ.sym}» في كلمة «${occ.tk.t}» من هذا البيت؟`,
        opts,
        ansIdx: opts.indexOf(occ.readers),
        ansLabel: occ.readers
      };
    }

    // kind === 'spot'
    // Collect ALL valid token indices in this verse matching occ.sym
    const validTargets = new Set();
    v.st.forEach((tk, i) => { if (tk.k !== 'N' && tk.sym === occ.sym) validTargets.add(`st:${i}`); });
    v.at.forEach((tk, i) => { if (tk.k !== 'N' && tk.sym === occ.sym) validTargets.add(`at:${i}`); });

    return {
      kind: 'spot',
      occ,
      v,
      sym: occ.sym,
      readers: occ.readers,
      validTargets,
      prompt: `اضغط مباشرةً على الكلمة الحاملة لرمز «${occ.readers}» في هذا البيت:`,
      ansLabel: `${occ.tk.t} (الرمز: ${occ.sym})`
    };
  }

  function pickNextInfiniteQuestion() {
    const occs = getFilteredOccurrences();
    const cats = getFilteredCatalog();
    let kind = tr.mode;
    if (kind === 'mixed') {
      const poolKinds = occs.length ? ['decode', 'decode', 'spot', 'flash'] : ['flash'];
      kind = poolKinds[Math.floor(Math.random() * poolKinds.length)];
    }
    if (kind === 'flash' || !occs.length) {
      const c = cats[Math.floor(Math.random() * cats.length)];
      return c ? buildQuestion('flash', c) : null;
    }
    const o = occs[Math.floor(Math.random() * occs.length)];
    return buildQuestion(kind, o);
  }

  function startSession(overrideItems = null) {
    clearQuestionTimer();
    tr.scope = scopeFilter.value;
    tr.chFilter = chapterSelect.value;
    tr.catFilter = catFilter.value;
    tr.sessionLen = Number(lenSelect.value);
    tr.timerEnabled = timerCheck.checked;

    tr.idx = 0;
    tr.score = 0;
    tr.streak = 0;
    tr.maxSessionStreak = 0;
    tr.answered = false;
    tr.mistakes = [];

    if (overrideItems) {
      tr.items = overrideItems;
    } else if (tr.sessionLen === 0) {
      tr.items = []; // generated on the fly
    } else {
      const occs = shuffle(getFilteredOccurrences());
      const cats = shuffle(getFilteredCatalog());

      if (tr.mode !== 'flash' && !occs.length && !cats.length) {
        arena.innerHTML = '<div class="tr-arena-card" style="text-align:center;color:var(--ink-muted)">لا توجد رموز مطابقة للتصفية الحالية. جرّب توسيع القسم أو الباب.</div>';
        return;
      }

      const list = [];
      for (let i = 0; i < tr.sessionLen; i++) {
        let kind = tr.mode;
        if (kind === 'mixed') {
          if (!occs.length) kind = 'flash';
          else kind = (i % 4 === 3) ? 'flash' : ((i % 4 === 1) ? 'spot' : 'decode');
        }
        if (kind === 'flash' || !occs.length) {
          if (!cats.length) break;
          list.push(buildQuestion('flash', cats[i % cats.length]));
        } else {
          list.push(buildQuestion(kind, occs[i % occs.length]));
        }
      }
      tr.items = list;
    }

    loadNextQuestion();
  }

  function loadNextQuestion() {
    clearQuestionTimer();
    tr.answered = false;

    if (tr.sessionLen > 0 && tr.idx >= tr.items.length) {
      renderSessionSummary();
      return;
    }

    tr.currentQ = tr.sessionLen === 0 ? pickNextInfiniteQuestion() : tr.items[tr.idx];
    if (!tr.currentQ) {
      arena.innerHTML = '<div class="tr-arena-card" style="text-align:center;color:var(--ink-muted)">تعذر توليد أسئلة بالتصفية الحالية.</div>';
      return;
    }
    renderQuestion(tr.currentQ);

    if (tr.timerEnabled) {
      tr.timeLeft = 15;
      const tBadge = document.getElementById('trTimerBadge');
      tr.timerId = setInterval(() => {
        tr.timeLeft--;
        if (tBadge) {
          tBadge.textContent = `⏱ ${toAr(tr.timeLeft)} ث`;
          tBadge.classList.toggle('timer-warn', tr.timeLeft <= 5);
        }
        if (tr.timeLeft <= 0) {
          clearQuestionTimer();
          if (!tr.answered) finalizeAnswer(false, null, true);
        }
      }, 1000);
    }
  }

  function renderVerseForDecode(q) {
    const renderSide = (tokens, side) => tokens.map((tk, idx) => {
      if (side === q.occ.side && idx === q.occ.tokIdx) {
        if (tk.k === 'L') {
          return `<span class="tr-target-word-wrap"><span class="tr-target-sym">${escapeHtml(tk.h)}</span>${escapeHtml(tk.r)}</span>`;
        }
        return `${escapeHtml(tk.p || '')}<span class="tr-target-sym">${escapeHtml(tk.h)}</span>`;
      }
      return escapeHtml(tk.t);
    }).join(' ');

    return `
      <div class="tr-verse-stage">
        <div class="tr-verse-meta">البيت ${toAr(q.v.n)} • ${escapeHtml(q.occ.chTitle)}</div>
        <div class="tr-hemistich-row">
          <div>${renderSide(q.v.st, 'st')}</div>
          <div>${renderSide(q.v.at, 'at')}</div>
        </div>
      </div>
    `;
  }

  function renderVerseForSpot(q) {
    const renderSide = (tokens, side) => tokens.map((tk, idx) => {
      const key = `${side}:${idx}`;
      return `<span class="tr-spot-word" data-spot="${key}" role="button" tabindex="0">${escapeHtml(tk.t)}</span>`;
    }).join(' ');

    return `
      <div class="tr-verse-stage">
        <div class="tr-verse-meta">البيت ${toAr(q.v.n)} • ${escapeHtml(q.occ.chTitle)} (اضغط على الكلمة الصحيحة)</div>
        <div class="tr-hemistich-row">
          <div>${renderSide(q.v.st, 'st')}</div>
          <div>${renderSide(q.v.at, 'at')}</div>
        </div>
      </div>
    `;
  }

  function renderQuestion(q) {
    const totalTxt = tr.sessionLen === 0 ? '∞' : toAr(tr.items.length);
    const progPct = tr.sessionLen === 0 ? 100 : Math.round((tr.idx / tr.items.length) * 100);
    const modeLabel = q.kind === 'decode' ? 'فكّ الرمز في البيت' : (q.kind === 'spot' ? 'استخرج الرمز بالضغط' : 'تحدي الرمز السريع');

    let bodyHtml = '';
    if (q.kind === 'decode') {
      bodyHtml = renderVerseForDecode(q) + `
        <div class="tr-opts-grid" id="trOptsGrid">
          ${q.opts.map((o, i) => `<button class="quiz-opt" data-tr-opt="${i}">${toAr(i + 1)}. ${escapeHtml(o)}</button>`).join('')}
        </div>
      `;
    } else if (q.kind === 'spot') {
      bodyHtml = renderVerseForSpot(q);
    } else {
      const cls = q.direction === 'readers-to-sym' ? 'readers-mode' : '';
      bodyHtml = `
        <div class="tr-flash-card">
          <div class="tr-flash-main ${cls}">${escapeHtml(q.displayMain)}</div>
          <div class="tr-flash-sub">${escapeHtml(q.displaySub)}</div>
        </div>
        <div class="tr-opts-grid" id="trOptsGrid">
          ${q.opts.map((o, i) => `<button class="quiz-opt" data-tr-opt="${i}">${toAr(i + 1)}. ${escapeHtml(o)}</button>`).join('')}
        </div>
      `;
    }

    arena.innerHTML = `
      <div class="tr-arena-card">
        <div class="tr-session-bar">
          <span>السؤال ${toAr(tr.idx + 1)} من ${totalTxt} • ${modeLabel}</span>
          <div class="tr-badges-group">
            <span class="tr-pill-badge">النقاط: ${toAr(tr.score)}</span>
            <span class="tr-pill-badge streak">🔥 السلسلة: ${toAr(tr.streak)}</span>
            ${tr.timerEnabled ? `<span class="tr-pill-badge" id="trTimerBadge">⏱ ١٥ ث</span>` : ''}
          </div>
        </div>
        <div class="tr-prog-track"><div class="tr-prog-bar" style="width:${progPct}%"></div></div>
        <h3 class="tr-prompt">${escapeHtml(q.prompt)}</h3>
        ${bodyHtml}
        <div class="tr-feedback" id="trFeedback"></div>
      </div>
    `;

    // Bind interactions
    if (q.kind === 'decode' || q.kind === 'flash') {
      arena.querySelectorAll('[data-tr-opt]').forEach(btn => {
        btn.addEventListener('click', () => {
          if (tr.answered) return;
          const chosen = Number(btn.dataset.trOpt);
          finalizeAnswer(chosen === q.ansIdx, chosen, false);
        });
      });
    } else if (q.kind === 'spot') {
      arena.querySelectorAll('[data-spot]').forEach(el => {
        el.addEventListener('click', () => {
          if (tr.answered) return;
          const key = el.dataset.spot;
          finalizeAnswer(q.validTargets.has(key), key, false);
        });
      });
    }
  }

  function recordResult(sym, isOk) {
    stats.total++;
    if (isOk) {
      stats.correct++;
      tr.score++;
      tr.streak++;
      if (tr.streak > tr.maxSessionStreak) tr.maxSessionStreak = tr.streak;
      if (tr.streak > stats.bestStreak) stats.bestStreak = tr.streak;
    } else {
      tr.streak = 0;
    }
    if (!stats.perSym[sym]) stats.perSym[sym] = { ok: 0, fail: 0 };
    if (isOk) stats.perSym[sym].ok++;
    else stats.perSym[sym].fail++;
    saveStats();
    updateStatsUI();
  }

  function finalizeAnswer(isOk, chosenVal, timedOut) {
    tr.answered = true;
    clearQuestionTimer();
    const q = tr.currentQ;

    recordResult(q.sym, isOk);
    if (!isOk) tr.mistakes.push(q);

    // Highlight choices
    if (q.kind === 'decode' || q.kind === 'flash') {
      arena.querySelectorAll('[data-tr-opt]').forEach(b => {
        b.disabled = true;
        const bi = Number(b.dataset.trOpt);
        if (bi === q.ansIdx) b.classList.add('correct');
        else if (bi === chosenVal) b.classList.add('wrong');
      });
    } else if (q.kind === 'spot') {
      arena.querySelectorAll('[data-spot]').forEach(el => {
        el.classList.add('locked');
        const key = el.dataset.spot;
        if (q.validTargets.has(key)) el.classList.add('spot-correct');
        else if (key === chosenVal) el.classList.add('spot-wrong');
      });
    }

    const fb = document.getElementById('trFeedback');
    fb.className = `tr-feedback ${isOk ? 'ok' : ''}`;
    fb.style.display = 'block';

    const verdict = isOk
      ? '✔ إجابة صحيحة! أحسنت الضبط.'
      : (timedOut ? '⏱ انتهى الوقت!' : '✘ إجابة غير صحيحة.');
    const catInfo = CAT_MAP[q.sym];
    const noteHtml = (q.occ && q.occ.note)
      ? `<div style="margin-top:4px;font-size:.86rem;color:var(--ink-muted)"><strong>الدلالة في هذا الموضع:</strong> ${escapeHtml(q.occ.note)}</div>`
      : '';

    const verseActions = q.v ? `
      <div style="display:flex;gap:6px;flex-wrap:wrap">
        <button class="v-btn" id="trOpenWafiBtn">📖 شرح الوافي</button>
        <button class="v-btn" id="trPlayVerseBtn">▶ استماع للبيت</button>
        <button class="v-btn" id="trGoVerseBtn">فتح في المتن</button>
      </div>
    ` : '<div></div>';

    const nextTxt = (tr.sessionLen > 0 && tr.idx + 1 >= tr.items.length) ? 'عرض نتيجة الجلسة ←' : 'السؤال التالي ←';

    fb.innerHTML = `
      <div><strong>${verdict}</strong> الرمز <span class="sym-word" style="cursor:default">${escapeHtml(q.sym)}</span> يدل على: <strong>${escapeHtml(catInfo.readers)}</strong>${q.occ ? ` (في كلمة «${escapeHtml(q.occ.tk.t)}»)` : ''}.</div>
      ${noteHtml}
      <div class="tr-feedback-actions">
        ${verseActions}
        <button class="page-nav-btn" id="trNextBtn">${nextTxt}</button>
      </div>
    `;

    if (q.v) {
      document.getElementById('trOpenWafiBtn').addEventListener('click', () => APP.openWafi(q.v.n));
      document.getElementById('trPlayVerseBtn').addEventListener('click', () => {
        if (window.SHAT_AUDIO) window.SHAT_AUDIO.playVerse(q.v.n);
      });
      document.getElementById('trGoVerseBtn').addEventListener('click', () => APP.goToVerse(q.v.n));
    }
    document.getElementById('trNextBtn').addEventListener('click', () => {
      tr.idx++;
      loadNextQuestion();
    });
  }

  function renderSessionSummary() {
    const total = tr.items.length || 1;
    const pct = Math.round((tr.score / total) * 100);
    const mistakesHtml = tr.mistakes.length ? `
      <div style="margin-top:16px;text-align:right">
        <h4 style="margin:0 0 8px;color:var(--sym-red)">الرموز التي أخطأت فيها بهذه الجلسة (${toAr(tr.mistakes.length)}):</h4>
        ${tr.mistakes.map(m => `
          <div class="tr-mistake-row">
            <span>الرمز <strong style="color:var(--sym-red)">«${escapeHtml(m.sym)}»</strong> ← <strong>${escapeHtml(m.readers)}</strong>${m.v ? ` (البيت ${toAr(m.v.n)} — ${escapeHtml(m.occ.chTitle)})` : ''}</span>
            ${m.v ? `<button class="v-btn" onclick="window.SHAT_APP.openWafi(${m.v.n})">الشرح</button>` : ''}
          </div>
        `).join('')}
      </div>
    ` : '<p style="color:var(--accent);font-weight:800">🌟 ممتاز! لم ترتكب أي خطأ في هذه الجلسة.</p>';

    arena.innerHTML = `
      <div class="tr-arena-card" style="text-align:center">
        <h3 style="margin-top:0;color:var(--accent);font-size:1.3rem">اكتملت جلسة التدريب الآلي!</h3>
        <p style="font-size:1.25rem;font-weight:800;margin:8px 0">
          النتيجة: ${toAr(tr.score)} من ${toAr(total)} (${toAr(pct)}%) • أعلى سلسلة: 🔥 ${toAr(tr.maxSessionStreak)}
        </p>
        <div style="display:flex;justify-content:center;gap:8px;flex-wrap:wrap;margin-top:14px">
          <button class="page-nav-btn" id="trAgainBtn">▶ جلسة جديدة</button>
          ${tr.mistakes.length ? '<button class="tool-btn gold" id="trRetryMistakesBtn">🎯 أعد التدريب على أخطاء هذه الجلسة</button>' : ''}
        </div>
        ${mistakesHtml}
      </div>
    `;

    document.getElementById('trAgainBtn').addEventListener('click', () => startSession());
    const retryBtn = document.getElementById('trRetryMistakesBtn');
    if (retryBtn) {
      retryBtn.addEventListener('click', () => {
        const retryList = shuffle(tr.mistakes).map(m =>
          m.kind === 'flash' ? buildQuestion('flash', CAT_MAP[m.sym]) : buildQuestion(m.kind, m.occ)
        );
        startSession(retryList);
      });
    }
  }

  // Event Bindings
  document.querySelectorAll('#trModePills .tr-mode-pill').forEach(btn => {
    btn.addEventListener('click', () => {
      tr.mode = btn.dataset.tmode;
      document.querySelectorAll('#trModePills .tr-mode-pill').forEach(b => b.classList.toggle('active', b === btn));
      startSession();
    });
  });

  scopeFilter.addEventListener('change', () => {
    populateChapters();
    startSession();
  });
  chapterSelect.addEventListener('change', () => startSession());
  catFilter.addEventListener('change', () => startSession());
  lenSelect.addEventListener('change', () => startSession());
  timerCheck.addEventListener('change', () => startSession());
  startBtn.addEventListener('click', () => startSession());

  weakBtn.addEventListener('click', () => {
    const weak = getWeakSymbols();
    if (!weak.length) return;
    tr.focusSyms = new Set(weak);
    tr.focusLabel = `مراجعة نقاط الضعف (${toAr(weak.length)} رمزاً)`;
    showFocusNotice();
    startSession();
  });

  clearFocusBtn.addEventListener('click', () => {
    tr.focusSyms = null;
    tr.focusLabel = '';
    showFocusNotice();
    startSession();
  });

  resetStatsBtn.addEventListener('click', () => {
    if (!confirm('هل تريد تصفير إحصائيات التدريب وخريطة إتقان الرموز؟')) return;
    stats = defaultStats();
    saveStats();
    tr.focusSyms = null;
    tr.focusLabel = '';
    showFocusNotice();
    updateStatsUI();
    startSession();
  });

  // Keyboard shortcuts while in Trainer view (1-4 for MCQ, Enter for Next)
  document.addEventListener('keydown', e => {
    if (!document.getElementById('view-trainer').classList.contains('active')) return;
    if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)) return;
    const anyModal = document.querySelector('.modal-backdrop.open');
    if (anyModal) return;

    if (e.key === 'Enter' && tr.answered) {
      const nextBtn = document.getElementById('trNextBtn');
      if (nextBtn) { e.preventDefault(); nextBtn.click(); }
      return;
    }
    if (!tr.answered && ['1', '2', '3', '4'].includes(e.key)) {
      const idx = Number(e.key) - 1;
      const optBtn = arena.querySelector(`[data-tr-opt="${idx}"]`);
      if (optBtn) { e.preventDefault(); optBtn.click(); }
    }
  });

  // Init
  populateChapters();
  updateStatsUI();
  startSession();

  window.SHAT_TRAINER = { startSession, updateStatsUI };
};
