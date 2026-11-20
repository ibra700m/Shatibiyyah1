/* المشغّل الصوتي المتزامن وميزة التكرار والحفظ — الشاطبية التفاعلية */
window.initShatAudio = function(APP) {
  const { DATA, vMap, chMap, toAr, escapeHtml, downloadJSON } = APP;
  const TOTAL_VERSES = DATA.verses.length;

  // IndexedDB helper for persisting FileSystemDirectoryHandle across sessions
  const IDB_NAME = 'shatibiyyah_audio_db';
  const IDB_STORE = 'handles';
  function idbSet(key, val) {
    return new Promise((resolve) => {
      try {
        const req = indexedDB.open(IDB_NAME, 1);
        req.onupgradeneeded = () => req.result.createObjectStore(IDB_STORE);
        req.onsuccess = () => {
          const tx = req.result.transaction(IDB_STORE, 'readwrite');
          tx.objectStore(IDB_STORE).put(val, key);
          tx.oncomplete = () => resolve(true);
          tx.onerror = () => resolve(false);
        };
        req.onerror = () => resolve(false);
      } catch (_) { resolve(false); }
    });
  }
  function idbGet(key) {
    return new Promise((resolve) => {
      try {
        const req = indexedDB.open(IDB_NAME, 1);
        req.onupgradeneeded = () => req.result.createObjectStore(IDB_STORE);
        req.onsuccess = () => {
          const tx = req.result.transaction(IDB_STORE, 'readonly');
          const g = tx.objectStore(IDB_STORE).get(key);
          g.onsuccess = () => resolve(g.result || null);
          g.onerror = () => resolve(null);
        };
        req.onerror = () => resolve(null);
      } catch (_) { resolve(null); }
    });
  }

  // Persistent settings (Default to real MP3 mode — never auto-play robotic TTS unless user chooses it)
  const savedCfg = JSON.parse(localStorage.getItem('shat_audio_cfg') || '{}');
  const state = {
    sourceMode: savedCfg.sourceMode || 'mp3',        // 'mp3' | 'chapter' | 'tts'
    useTemplate: Boolean(savedCfg.useTemplate),
    urlTemplate: savedCfg.urlTemplate || 'audio/{0001}.mp3',
    verseRepeatMax: Number(savedCfg.verseRepeatMax ?? 1), // 0 = infinity
    rangeEnabled: Boolean(savedCfg.rangeEnabled),
    rangeStart: Number(savedCfg.rangeStart || 1),
    rangeEnd: Number(savedCfg.rangeEnd || 10),
    rangeRepeatMax: Number(savedCfg.rangeRepeatMax ?? 3), // 0 = infinity
    pauseGapSec: Number(savedCfg.pauseGapSec ?? 0),
    autoAdvance: savedCfg.autoAdvance !== false,
    speed: Number(savedCfg.speed || 1),
    ttsVoiceName: savedCfg.ttsVoiceName || '',

    // Runtime state
    isPlaying: false,
    isPaused: false,
    currentVerse: 1,
    verseRepeatDone: 1,
    rangeRepeatDone: 1,
    activeBackend: 'mp3',
    playToken: 0,
    gapTimer: null,
    gapCountdownTimer: null,
    ttsProgressTimer: null,

    // Local runtime audio resources
    savedDirHandle: null,
    localVerseMap: {},      // { [verseNum]: objectURL }
    chapterAudioMap: {},    // { [chapterId]: { url, name } }
    chapterTimings: JSON.parse(localStorage.getItem('shat_audio_timings') || '{}'),
    syncModeActive: false,
    syncChapterId: 1,
    syncNextVerse: 1,
  };

  function saveCfg() {
    localStorage.setItem('shat_audio_cfg', JSON.stringify({
      sourceMode: state.sourceMode,
      useTemplate: state.useTemplate,
      urlTemplate: state.urlTemplate,
      verseRepeatMax: state.verseRepeatMax,
      rangeEnabled: state.rangeEnabled,
      rangeStart: state.rangeStart,
      rangeEnd: state.rangeEnd,
      rangeRepeatMax: state.rangeRepeatMax,
      pauseGapSec: state.pauseGapSec,
      autoAdvance: state.autoAdvance,
      speed: state.speed,
      ttsVoiceName: state.ttsVoiceName,
    }));
  }

  function saveTimings() {
    localStorage.setItem('shat_audio_timings', JSON.stringify(state.chapterTimings));
  }

  const audioEl = new Audio();
  audioEl.preload = 'auto';

  // DOM References
  const dock = document.getElementById('audioDock');
  const repeatDrawer = document.getElementById('repeatDrawer');
  const srcBadge = document.getElementById('audioSrcBadge');
  const versePreview = document.getElementById('audioVersePreview');
  const loopStatus = document.getElementById('audioLoopStatus');
  const collapseBtn = document.getElementById('dockCollapseBtn');

  const playPauseBtn = document.getElementById('audioPlayPauseBtn');
  const prevBtn = document.getElementById('audioPrevBtn');
  const nextBtn = document.getElementById('audioNextBtn');
  const stopBtn = document.getElementById('audioStopBtn');
  const seekBar = document.getElementById('audioSeek');
  const timeLabel = document.getElementById('audioTimeLabel');
  const speedBtn = document.getElementById('audioSpeedBtn');
  const toggleRepeatBtn = document.getElementById('toggleRepeatBtn');
  const openSettingsBtn = document.getElementById('openAudioSettingsBtn');

  const verseRepeatSelect = document.getElementById('verseRepeatSelect');
  const rangeLoopCheck = document.getElementById('rangeLoopCheck');
  const rangeStartInput = document.getElementById('rangeStartInput');
  const rangeEndInput = document.getElementById('rangeEndInput');
  const rangeRepeatSelect = document.getElementById('rangeRepeatSelect');
  const pauseGapSelect = document.getElementById('pauseGapSelect');
  const autoAdvanceCheck = document.getElementById('autoAdvanceCheck');

  const asModal = document.getElementById('audioSettingsModal');
  const localFolderInput = document.getElementById('localFolderInput');
  const localFolderStatus = document.getElementById('localFolderStatus');
  const clearLocalFolderBtn = document.getElementById('clearLocalFolderBtn');
  const useTemplateCheck = document.getElementById('useTemplateCheck');
  const urlTemplateInput = document.getElementById('urlTemplateInput');
  const saveTemplateBtn = document.getElementById('saveTemplateBtn');

  const syncChapterSelect = document.getElementById('syncChapterSelect');
  const chapterAudioInput = document.getElementById('chapterAudioInput');
  const chapterAudioStatus = document.getElementById('chapterAudioStatus');
  const syncStartBtn = document.getElementById('syncStartBtn');
  const syncMarkBtn = document.getElementById('syncMarkBtn');
  const syncNextVerseLabel = document.getElementById('syncNextVerseLabel');
  const syncTimingsList = document.getElementById('syncTimingsList');
  const ttsVoiceSelect = document.getElementById('ttsVoiceSelect');

  function fmtTime(sec) {
    if (!isFinite(sec) || sec < 0) return '00:00';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }

  function formatTemplateUrl(tpl, vn) {
    return tpl
      .replace(/\{0001\}/g, String(vn).padStart(4, '0'))
      .replace(/\{001\}/g, String(vn).padStart(3, '0'))
      .replace(/\{1\}/g, String(vn));
  }

  function clearTimers() {
    if (state.gapTimer) { clearTimeout(state.gapTimer); state.gapTimer = null; }
    if (state.gapCountdownTimer) { clearInterval(state.gapCountdownTimer); state.gapCountdownTimer = null; }
    if (state.ttsProgressTimer) { clearInterval(state.ttsProgressTimer); state.ttsProgressTimer = null; }
  }

  function cancelSpeech() {
    if ('speechSynthesis' in window) {
      try { window.speechSynthesis.cancel(); } catch (_) {}
    }
  }

  function getOrderedRange() {
    const a = Math.max(1, Math.min(TOTAL_VERSES, Number(state.rangeStart) || 1));
    const b = Math.max(1, Math.min(TOTAL_VERSES, Number(state.rangeEnd) || a));
    return [Math.min(a, b), Math.max(a, b)];
  }

  function updateVerseHighlights() {
    const [rStart, rEnd] = getOrderedRange();
    document.querySelectorAll('.verse-card').forEach(card => {
      const vn = Number(card.dataset.verse);
      const isActive = (state.isPlaying || state.isPaused) && vn === state.currentVerse;
      card.classList.toggle('playing', isActive);
      card.classList.toggle('in-loop-range', state.rangeEnabled && vn >= rStart && vn <= rEnd);
      const btn = card.querySelector('.v-play-btn');
      if (btn) {
        const playingThis = state.isPlaying && !state.isPaused && vn === state.currentVerse;
        btn.classList.toggle('active', playingThis);
        btn.textContent = playingThis ? '⏸' : '▶';
      }
    });
  }

  function updateLoopBadge(customMsg = null) {
    const isRepeatActive = state.verseRepeatMax !== 1 || state.rangeEnabled;
    toggleRepeatBtn.classList.toggle('toggled', isRepeatActive);

    if (customMsg) {
      loopStatus.textContent = customMsg;
      loopStatus.classList.add('show');
      return;
    }
    const parts = [];
    if (state.verseRepeatMax !== 1) {
      const maxTxt = state.verseRepeatMax === 0 ? '∞' : toAr(state.verseRepeatMax);
      parts.push(`البيت ${toAr(state.verseRepeatDone)}/${maxTxt}`);
    }
    if (state.rangeEnabled) {
      const [s, e] = getOrderedRange();
      const rMax = state.rangeRepeatMax === 0 ? '∞' : toAr(state.rangeRepeatMax);
      parts.push(`النطاق ${toAr(s)}–${toAr(e)} (${toAr(state.rangeRepeatDone)}/${rMax})`);
    }
    if (parts.length && (state.isPlaying || state.isPaused || state.rangeEnabled)) {
      loopStatus.textContent = parts.join(' • ');
      loopStatus.classList.add('show');
    } else {
      loopStatus.classList.remove('show');
    }
  }

  function updateDockDisplay(vn, statusNote = null) {
    const v = vMap[vn];
    if (statusNote) {
      versePreview.textContent = statusNote;
    } else if (v) {
      const ch = chMap[v.ch];
      versePreview.textContent = `(${toAr(vn)}) ${v.s} ❖ ${v.a} — ${ch.title}`;
    }
    playPauseBtn.textContent = (state.isPlaying && !state.isPaused) ? '⏸' : '▶';
    speedBtn.textContent = `${state.speed}×`;

    const hasAnyMp3 = Object.keys(state.localVerseMap).length > 0 || state.useTemplate || Object.keys(state.chapterAudioMap).length > 0;
    const badgeLabels = {
      mp3: hasAnyMp3 ? 'MP3 قراءة حقيقية' : 'بانتظار ربط MP3',
      chapter: 'صوت الباب المتزامن',
      tts: 'نطق آلي (تجريبي)'
    };
    srcBadge.textContent = badgeLabels[state.activeBackend] || 'MP3 قراءة حقيقية';
    srcBadge.classList.toggle('mp3', hasAnyMp3 || state.activeBackend === 'chapter');
    updateLoopBadge();
    updateVerseHighlights();
  }

  function resolveVerseSource(vn) {
    const v = vMap[vn];
    const chId = v ? v.ch : 1;
    const hasLocalMp3 = Boolean(state.localVerseMap[vn]);
    const hasChapterAudio = Boolean(state.chapterAudioMap[chId]);

    if (state.sourceMode === 'tts') return { backend: 'tts' };

    if (state.sourceMode === 'chapter') {
      if (hasChapterAudio) return { backend: 'chapter', chId, url: state.chapterAudioMap[chId].url };
      return {
        backend: 'missing',
        msg: `لم يُربط ملف صوتي لباب «${chMap[chId].title}» — اضغط «⚙ الصوتيات» لربطه.`
      };
    }

    // Default 'mp3' (or legacy 'auto') -> use real MP3 only, never auto-fallback to robotic TTS
    if (hasLocalMp3) return { backend: 'mp3', url: state.localVerseMap[vn] };
    if (hasChapterAudio && state.chapterTimings[chId] && state.chapterTimings[chId][vn] !== undefined) {
      return { backend: 'chapter', chId, url: state.chapterAudioMap[chId].url };
    }
    if (state.useTemplate && state.urlTemplate.trim()) {
      return { backend: 'mp3', url: formatTemplateUrl(state.urlTemplate.trim(), vn), fromTemplate: true };
    }
    return {
      backend: 'missing',
      msg: 'لم يُربط مجلد تلاوة MP3 بعد — اضغط «⚙ الصوتيات» لاختيار مجلد القراءة (مثل الشيخ أيمن سويد).'
    };
  }

  // Arabic TTS Playback (only when explicitly chosen by user)
  let availableVoices = [];
  function loadTtsVoices() {
    if (!('speechSynthesis' in window)) return;
    availableVoices = window.speechSynthesis.getVoices() || [];
    const arVoices = availableVoices.filter(v => (v.lang || '').toLowerCase().startsWith('ar'));
    const list = arVoices.length ? arVoices : availableVoices;

    ttsVoiceSelect.innerHTML = '';
    if (!list.length) {
      ttsVoiceSelect.innerHTML = '<option value="">الصوت العربي الافتراضي للمتصفح</option>';
      return;
    }
    const defOpt = document.createElement('option');
    defOpt.value = '';
    defOpt.textContent = 'تلقائي (أفضل صوت عربي متاح)';
    ttsVoiceSelect.appendChild(defOpt);
    list.forEach(v => {
      const opt = document.createElement('option');
      opt.value = v.name;
      opt.textContent = `${v.name} (${v.lang})`;
      ttsVoiceSelect.appendChild(opt);
    });
    ttsVoiceSelect.value = state.ttsVoiceName || '';
  }

  if ('speechSynthesis' in window) {
    loadTtsVoices();
    window.speechSynthesis.onvoiceschanged = loadTtsVoices;
  }

  function pickArabicVoice() {
    if (!availableVoices.length && 'speechSynthesis' in window) {
      availableVoices = window.speechSynthesis.getVoices() || [];
    }
    if (state.ttsVoiceName) {
      const exact = availableVoices.find(v => v.name === state.ttsVoiceName);
      if (exact) return exact;
    }
    return availableVoices.find(v => /ar-SA|ar-EG|ar/i.test(v.lang)) || null;
  }

  function speakVerseTTS(vn, token) {
    if (!('speechSynthesis' in window)) {
      stopPlayback('المتصفح لا يدعم النطق الآلي — يرجى ربط ملفات MP3 من ⚙ الصوتيات.');
      return;
    }
    state.activeBackend = 'tts';
    updateDockDisplay(vn);
    cancelSpeech();

    const v = vMap[vn];
    // Add natural prosodic pause between Sadr and Ajuz
    const spokenText = `${v.s} . . . ${v.a}`;
    const utter = new SpeechSynthesisUtterance(spokenText);
    utter.lang = 'ar-SA';
    utter.rate = Math.max(0.65, state.speed * 0.92);
    const voice = pickArabicVoice();
    if (voice) utter.voice = voice;

    const estDuration = Math.max(2.8, (spokenText.length * 0.088) / state.speed);
    const startMs = Date.now();
    seekBar.value = 0;
    timeLabel.textContent = `00:00 / ${fmtTime(estDuration)}`;
    clearTimers();
    state.ttsProgressTimer = setInterval(() => {
      if (token !== state.playToken || !state.isPlaying || state.isPaused) return;
      const elapsed = (Date.now() - startMs) / 1000;
      const pct = Math.min(98, Math.round((elapsed / estDuration) * 100));
      seekBar.value = pct;
      timeLabel.textContent = `${fmtTime(elapsed)} / ${fmtTime(estDuration)}`;
    }, 200);

    utter.onend = () => {
      if (token !== state.playToken) return;
      clearTimers();
      seekBar.value = 100;
      handleVerseFinished(token);
    };
    utter.onerror = (ev) => {
      if (token !== state.playToken) return;
      if (ev.error === 'canceled' || ev.error === 'interrupted') return;
      clearTimers();
      stopPlayback('تعذر تشغيل النطق الآلي — يرجى ربط ملفات MP3 من ⚙ الصوتيات.');
    };

    setTimeout(() => {
      if (token !== state.playToken || !state.isPlaying || state.isPaused) return;
      window.speechSynthesis.speak(utter);
    }, 65);
  }

  function playVerseMp3(vn, url, token) {
    state.activeBackend = 'mp3';
    state.syncModeActive = false;
    updateDockDisplay(vn);
    cancelSpeech();
    clearTimers();

    audioEl.pause();
    audioEl.src = url;
    audioEl.playbackRate = state.speed;
    audioEl.currentTime = 0;

    audioEl.onended = () => {
      if (token !== state.playToken) return;
      handleVerseFinished(token);
    };
    audioEl.onerror = () => {
      if (token !== state.playToken) return;
      stopPlayback(`تعذر العثور على ملف الصوت للبيت ${toAr(vn)} (${url})`);
    };
    audioEl.play().catch(() => {});
  }

  function getChapterVerseBounds(chId, vn) {
    const ch = chMap[chId];
    const map = state.chapterTimings[chId] || {};
    const startT = map[vn] !== undefined ? Number(map[vn]) : 0;
    let endT = null;
    for (let k = vn + 1; k <= ch.verse_end; k++) {
      if (map[k] !== undefined && Number(map[k]) > startT) {
        endT = Number(map[k]);
        break;
      }
    }
    return { startT, endT };
  }

  function playVerseFromChapterAudio(vn, chId, url, token) {
    state.activeBackend = 'chapter';
    state.syncModeActive = false;
    updateDockDisplay(vn);
    cancelSpeech();
    clearTimers();

    const { startT, endT } = getChapterVerseBounds(chId, vn);
    const sameSrc = audioEl.dataset.chId === String(chId) && audioEl.src === url;
    if (!sameSrc) {
      audioEl.src = url;
      audioEl.dataset.chId = String(chId);
    }
    audioEl.playbackRate = state.speed;

    const seekAndPlay = () => {
      if (token !== state.playToken) return;
      audioEl.currentTime = startT;
      audioEl.play().catch(() => {});
    };

    audioEl.onended = () => {
      if (token !== state.playToken) return;
      handleVerseFinished(token);
    };
    audioEl.onerror = () => {
      if (token !== state.playToken) return;
      stopPlayback('تعذر تشغيل الملف الصوتي للباب.');
    };

    audioEl._chapterVerseEnd = endT;
    if (audioEl.readyState >= 1 && sameSrc) {
      seekAndPlay();
    } else {
      audioEl.onloadedmetadata = seekAndPlay;
    }
  }

  audioEl.addEventListener('timeupdate', () => {
    if (state.activeBackend === 'tts') return;
    if (isFinite(audioEl.duration) && audioEl.duration > 0) {
      seekBar.value = Math.round((audioEl.currentTime / audioEl.duration) * 100);
      timeLabel.textContent = `${fmtTime(audioEl.currentTime)} / ${fmtTime(audioEl.duration)}`;
    }
    if (state.isPlaying && !state.isPaused && state.activeBackend === 'chapter' && !state.syncModeActive) {
      const endT = audioEl._chapterVerseEnd;
      if (endT !== null && endT !== undefined && audioEl.currentTime >= endT - 0.08) {
        audioEl._chapterVerseEnd = null;
        audioEl.pause();
        handleVerseFinished(state.playToken);
      }
    }
  });

  seekBar.addEventListener('input', () => {
    if (state.activeBackend !== 'tts' && isFinite(audioEl.duration) && audioEl.duration > 0) {
      audioEl.currentTime = (Number(seekBar.value) / 100) * audioEl.duration;
    }
  });

  function scheduleAfterGap(token, callback) {
    if (state.pauseGapSec <= 0) {
      callback();
      return;
    }
    let rem = state.pauseGapSec;
    updateLoopBadge(`مهلة ترديد (${toAr(rem)} ث)...`);
    state.gapCountdownTimer = setInterval(() => {
      if (token !== state.playToken || !state.isPlaying || state.isPaused) {
        clearInterval(state.gapCountdownTimer);
        return;
      }
      rem--;
      if (rem > 0) updateLoopBadge(`مهلة ترديد (${toAr(rem)} ث)...`);
    }, 1000);

    state.gapTimer = setTimeout(() => {
      clearTimers();
      if (token !== state.playToken || !state.isPlaying || state.isPaused) return;
      callback();
    }, state.pauseGapSec * 1000);
  }

  function handleVerseFinished(token) {
    if (token !== state.playToken || !state.isPlaying) return;

    if (state.verseRepeatMax === 0 || state.verseRepeatDone < state.verseRepeatMax) {
      state.verseRepeatDone++;
      updateLoopBadge();
      scheduleAfterGap(token, () => playVerseInternal(state.currentVerse, false));
      return;
    }

    state.verseRepeatDone = 1;

    if (!state.autoAdvance) {
      stopPlayback(`✔ اكتمل تشغيل البيت ${toAr(state.currentVerse)}`);
      return;
    }

    if (state.rangeEnabled) {
      const [s, e] = getOrderedRange();
      if (state.currentVerse < e) {
        scheduleAfterGap(token, () => playVerseInternal(state.currentVerse + 1, false));
      } else {
        if (state.rangeRepeatMax === 0 || state.rangeRepeatDone < state.rangeRepeatMax) {
          state.rangeRepeatDone++;
          updateLoopBadge();
          scheduleAfterGap(token, () => playVerseInternal(s, false));
        } else {
          stopPlayback(`✔ اكتمل تكرار النطاق (${toAr(s)} – ${toAr(e)}) بنجاح`);
        }
      }
      return;
    }

    if (state.currentVerse < TOTAL_VERSES) {
      scheduleAfterGap(token, () => playVerseInternal(state.currentVerse + 1, false));
    } else {
      stopPlayback('✔ أتممت الاستماع إلى المنظومة كاملةً');
    }
  }

  function playVerseInternal(vn, resetCounters = true) {
    vn = Math.max(1, Math.min(TOTAL_VERSES, Number(vn) || 1));
    state.playToken++;
    const token = state.playToken;
    clearTimers();

    state.currentVerse = vn;
    state.isPlaying = true;
    state.isPaused = false;
    if (resetCounters) {
      state.verseRepeatDone = 1;
      state.rangeRepeatDone = 1;
    }

    APP.focusVerse(vn);

    const src = resolveVerseSource(vn);
    if (src.backend === 'missing') {
      stopPlayback(src.msg);
      openSettingsBtn.classList.add('toggled');
      setTimeout(() => openSettingsBtn.classList.remove('toggled'), 2200);
      return;
    }
    if (src.backend === 'mp3') {
      playVerseMp3(vn, src.url, token);
    } else if (src.backend === 'chapter') {
      playVerseFromChapterAudio(vn, src.chId, src.url, token);
    } else {
      speakVerseTTS(vn, token);
    }
  }

  function pausePlayback() {
    if (!state.isPlaying || state.isPaused) return;
    state.isPaused = true;
    state.playToken++;
    clearTimers();
    if (state.activeBackend === 'tts') cancelSpeech();
    else audioEl.pause();
    updateDockDisplay(state.currentVerse);
  }

  function resumePlayback() {
    if (!state.isPlaying || !state.isPaused) return;
    state.isPaused = false;
    if (state.activeBackend === 'tts') {
      state.playToken++;
      speakVerseTTS(state.currentVerse, state.playToken);
    } else {
      audioEl.playbackRate = state.speed;
      audioEl.play().catch(() => {});
      updateDockDisplay(state.currentVerse);
    }
  }

  function stopPlayback(statusMsg = null) {
    state.playToken++;
    state.isPlaying = false;
    state.isPaused = false;
    state.syncModeActive = false;
    state.verseRepeatDone = 1;
    state.rangeRepeatDone = 1;
    clearTimers();
    cancelSpeech();
    audioEl.pause();
    audioEl._chapterVerseEnd = null;
    seekBar.value = 0;
    timeLabel.textContent = '00:00 / 00:00';
    updateDockDisplay(state.currentVerse, statusMsg);
    if (statusMsg) updateLoopBadge(statusMsg);
  }

  function togglePlayPause() {
    if (state.isPlaying && !state.isPaused) {
      pausePlayback();
    } else if (state.isPlaying && state.isPaused) {
      resumePlayback();
    } else if (state.rangeEnabled) {
      const [s] = getOrderedRange();
      playVerseInternal(s, true);
    } else {
      const pg = APP.getCurrentPageObj();
      const startVn = pg && pg.verses.length ? pg.verses[0].n : state.currentVerse;
      playVerseInternal(startVn, true);
    }
  }

  function toggleVerse(vn) {
    if (state.isPlaying && !state.isPaused && state.currentVerse === vn) {
      pausePlayback();
    } else if (state.isPlaying && state.isPaused && state.currentVerse === vn) {
      resumePlayback();
    } else {
      playVerseInternal(vn, true);
    }
  }

  // Bind Main Dock Controls
  playPauseBtn.addEventListener('click', togglePlayPause);
  stopBtn.addEventListener('click', () => stopPlayback());
  prevBtn.addEventListener('click', () => playVerseInternal(Math.max(1, state.currentVerse - 1), true));
  nextBtn.addEventListener('click', () => playVerseInternal(Math.min(TOTAL_VERSES, state.currentVerse + 1), true));

  const SPEEDS = [0.75, 1, 1.25, 1.5];
  speedBtn.addEventListener('click', () => {
    const idx = SPEEDS.indexOf(state.speed);
    state.speed = SPEEDS[(idx + 1) % SPEEDS.length];
    audioEl.playbackRate = state.speed;
    saveCfg();
    speedBtn.textContent = `${state.speed}×`;
    if (state.isPlaying && !state.isPaused && state.activeBackend === 'tts') {
      state.playToken++;
      speakVerseTTS(state.currentVerse, state.playToken);
    }
  });

  toggleRepeatBtn.addEventListener('click', () => repeatDrawer.classList.toggle('open'));
  collapseBtn.addEventListener('click', () => {
    const collapsed = dock.classList.toggle('collapsed');
    collapseBtn.textContent = collapsed ? 'إظهار المشغّل ▴' : 'تصغير ▾';
  });

  // Bind Repeat & Memorization Controls
  verseRepeatSelect.value = String(state.verseRepeatMax);
  rangeLoopCheck.checked = state.rangeEnabled;
  rangeStartInput.value = state.rangeStart;
  rangeEndInput.value = state.rangeEnd;
  rangeRepeatSelect.value = String(state.rangeRepeatMax);
  pauseGapSelect.value = String(state.pauseGapSec);
  autoAdvanceCheck.checked = state.autoAdvance;

  verseRepeatSelect.addEventListener('change', () => {
    state.verseRepeatMax = Number(verseRepeatSelect.value);
    state.verseRepeatDone = 1;
    saveCfg();
    updateLoopBadge();
  });
  rangeLoopCheck.addEventListener('change', () => {
    state.rangeEnabled = rangeLoopCheck.checked;
    state.rangeRepeatDone = 1;
    saveCfg();
    updateLoopBadge();
    updateVerseHighlights();
  });
  function syncRangeInputs() {
    state.rangeStart = Math.max(1, Math.min(TOTAL_VERSES, Number(rangeStartInput.value) || 1));
    state.rangeEnd = Math.max(1, Math.min(TOTAL_VERSES, Number(rangeEndInput.value) || state.rangeStart));
    rangeStartInput.value = state.rangeStart;
    rangeEndInput.value = state.rangeEnd;
    state.rangeRepeatDone = 1;
    saveCfg();
    updateLoopBadge();
    updateVerseHighlights();
  }
  rangeStartInput.addEventListener('change', syncRangeInputs);
  rangeEndInput.addEventListener('change', syncRangeInputs);
  rangeRepeatSelect.addEventListener('change', () => {
    state.rangeRepeatMax = Number(rangeRepeatSelect.value);
    state.rangeRepeatDone = 1;
    saveCfg();
    updateLoopBadge();
  });
  pauseGapSelect.addEventListener('change', () => {
    state.pauseGapSec = Number(pauseGapSelect.value);
    saveCfg();
  });
  autoAdvanceCheck.addEventListener('change', () => {
    state.autoAdvance = autoAdvanceCheck.checked;
    saveCfg();
  });

  function applyRangePreset(s, e) {
    state.rangeEnabled = true;
    state.rangeStart = s;
    state.rangeEnd = e;
    rangeLoopCheck.checked = true;
    rangeStartInput.value = s;
    rangeEndInput.value = e;
    state.rangeRepeatDone = 1;
    saveCfg();
    updateLoopBadge();
    updateVerseHighlights();
  }
  document.getElementById('presetPageBtn').addEventListener('click', () => {
    const pg = APP.getCurrentPageObj();
    if (pg && pg.verses.length) applyRangePreset(pg.verses[0].n, pg.verses[pg.verses.length - 1].n);
  });
  document.getElementById('presetChapterBtn').addEventListener('click', () => {
    const pg = APP.getCurrentPageObj();
    if (pg) applyRangePreset(pg.chapter.verse_start, pg.chapter.verse_end);
  });
  document.getElementById('presetFiveBtn').addEventListener('click', () => {
    const pg = APP.getCurrentPageObj();
    const baseVn = (state.isPlaying || state.isPaused) ? state.currentVerse : (pg ? pg.verses[0].n : 1);
    applyRangePreset(baseVn, Math.min(TOTAL_VERSES, baseVn + 4));
  });
  document.getElementById('presetPlayRangeBtn').addEventListener('click', () => {
    state.rangeEnabled = true;
    rangeLoopCheck.checked = true;
    saveCfg();
    const [s] = getOrderedRange();
    playVerseInternal(s, true);
  });

  // Audio Settings Modal
  function refreshModeCards() {
    document.querySelectorAll('#audioModeCards .mode-card').forEach(card => {
      card.classList.toggle('active', card.dataset.amode === state.sourceMode);
    });
  }
  document.querySelectorAll('#audioModeCards .mode-card').forEach(card => {
    card.addEventListener('click', () => {
      state.sourceMode = card.dataset.amode;
      saveCfg();
      refreshModeCards();
      updateDockDisplay(state.currentVerse);
    });
  });

  openSettingsBtn.addEventListener('click', () => {
    refreshModeCards();
    useTemplateCheck.checked = state.useTemplate;
    urlTemplateInput.value = state.urlTemplate;
    const pg = APP.getCurrentPageObj();
    if (pg) {
      syncChapterSelect.value = pg.chapter.id;
      refreshSyncPanel();
    }
    asModal.classList.add('open');
  });
  document.getElementById('asClose').addEventListener('click', () => asModal.classList.remove('open'));
  asModal.addEventListener('click', e => { if (e.target === asModal) asModal.classList.remove('open'); });

  // Index files from either FileList (<input webkitdirectory>) or FileSystemDirectoryHandle
  function indexAudioFiles(fileEntries) {
    Object.values(state.localVerseMap).forEach(u => URL.revokeObjectURL(u));
    state.localVerseMap = {};
    let matched = 0;
    fileEntries.forEach(({ name, file }) => {
      const base = name.replace(/\.[^.]+$/, '');
      const nums = base.match(/\d+/g);
      if (!nums) return;
      const vn = Number(nums[nums.length - 1]);
      if (vn >= 1 && vn <= TOTAL_VERSES) {
        state.localVerseMap[vn] = URL.createObjectURL(file);
        matched++;
      }
    });
    localFolderStatus.textContent = matched
      ? `✔ تم ربط ${toAr(matched)} ملفاً صوتياً من المجلد بنجاح!`
      : 'لم يُعثر على ملفات مرقّمة من ١ إلى ١١٧٣ داخل المجلد.';
    if (matched) {
      state.sourceMode = 'mp3';
      saveCfg();
      refreshModeCards();
      updateDockDisplay(state.currentVerse, `✔ تم ربط ${toAr(matched)} ملفاً صوتياً — اضغط ▶ للاستماع`);
    }
  }

  localFolderInput.addEventListener('change', e => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    indexAudioFiles(files.map(f => ({ name: f.name, file: f })));
  });

  // Persistent Directory Picker (Chrome/Edge Desktop)
  if ('showDirectoryPicker' in window) {
    const persistBtn = document.createElement('button');
    persistBtn.type = 'button';
    persistBtn.className = 'tool-btn gold';
    persistBtn.textContent = '📌 ربط مجلد دائم (يُحفظ بعد الإغلاق)';
    persistBtn.addEventListener('click', async () => {
      try {
        const dirHandle = await window.showDirectoryPicker({ mode: 'read' });
        await idbSet('mp3_dir_handle', dirHandle);
        state.savedDirHandle = dirHandle;
        const entries = [];
        for await (const [name, handle] of dirHandle.entries()) {
          if (handle.kind === 'file' && /\.(mp3|m4a|wav|ogg|aac)$/i.test(name)) {
            entries.push({ name, file: await handle.getFile() });
          }
        }
        indexAudioFiles(entries);
      } catch (_) {}
    });
    clearLocalFolderBtn.parentNode.insertBefore(persistBtn, clearLocalFolderBtn);

    // Check if a previously saved directory handle exists on startup
    idbGet('mp3_dir_handle').then(handle => {
      if (!handle) return;
      state.savedDirHandle = handle;
      const restoreBtn = document.createElement('button');
      restoreBtn.type = 'button';
      restoreBtn.className = 'tool-btn';
      restoreBtn.textContent = `🔄 تفعيل المجلد المحفوظ (${handle.name})`;
      restoreBtn.addEventListener('click', async () => {
        try {
          const perm = await handle.requestPermission({ mode: 'read' });
          if (perm !== 'granted') return;
          const entries = [];
          for await (const [name, h] of handle.entries()) {
            if (h.kind === 'file' && /\.(mp3|m4a|wav|ogg|aac)$/i.test(name)) {
              entries.push({ name, file: await h.getFile() });
            }
          }
          indexAudioFiles(entries);
          restoreBtn.remove();
        } catch (_) {}
      });
      localFolderStatus.textContent = `يوجد مجلد محفوظ سابقاً: «${handle.name}»`;
      clearLocalFolderBtn.parentNode.insertBefore(restoreBtn, clearLocalFolderBtn);
    });
  }

  clearLocalFolderBtn.addEventListener('click', async () => {
    Object.values(state.localVerseMap).forEach(u => URL.revokeObjectURL(u));
    state.localVerseMap = {};
    state.savedDirHandle = null;
    await idbSet('mp3_dir_handle', null);
    localFolderInput.value = '';
    localFolderStatus.textContent = 'تم إلغاء ربط المجلد المحلي.';
    updateDockDisplay(state.currentVerse);
  });

  saveTemplateBtn.addEventListener('click', () => {
    state.useTemplate = useTemplateCheck.checked;
    state.urlTemplate = urlTemplateInput.value.trim() || 'audio/{0001}.mp3';
    saveCfg();
    updateDockDisplay(state.currentVerse);
    alert('تم حفظ إعدادات المسار/الرابط الصوتي بنجاح.');
  });
  useTemplateCheck.addEventListener('change', () => {
    state.useTemplate = useTemplateCheck.checked;
    saveCfg();
    updateDockDisplay(state.currentVerse);
  });

  // Chapter Sync Studio
  DATA.chapters.forEach(ch => {
    const opt = document.createElement('option');
    opt.value = ch.id;
    opt.textContent = `${toAr(ch.id)}. ${ch.title} (${toAr(ch.verse_start)}–${toAr(ch.verse_end)})`;
    syncChapterSelect.appendChild(opt);
  });

  function refreshSyncPanel() {
    const chId = Number(syncChapterSelect.value);
    state.syncChapterId = chId;
    const ch = chMap[chId];
    const chAudio = state.chapterAudioMap[chId];
    chapterAudioStatus.textContent = chAudio ? `✔ مرتبط: ${chAudio.name}` : 'لا يوجد ملف محمّل لهذا الباب';

    const tmap = state.chapterTimings[chId] || {};
    let nextUnmarked = ch.verse_start;
    for (let k = ch.verse_start; k <= ch.verse_end; k++) {
      if (tmap[k] === undefined) { nextUnmarked = k; break; }
      nextUnmarked = Math.min(ch.verse_end, k + 1);
    }
    state.syncNextVerse = nextUnmarked;
    syncNextVerseLabel.textContent = `البيت ${toAr(state.syncNextVerse)}`;

    const keys = Object.keys(tmap).map(Number).sort((a, b) => a - b);
    if (!keys.length) {
      syncTimingsList.innerHTML = '<div style="color:var(--ink-muted);text-align:center;padding:8px">لا توجد طوابع زمنية مسجّلة لهذا الباب بعد.</div>';
      return;
    }
    syncTimingsList.innerHTML = keys.map(vn => `
      <div class="sync-row">
        <span><strong>البيت ${toAr(vn)}</strong> — يبدأ عند <code>${fmtTime(tmap[vn])}</code> (${tmap[vn]} ث)</span>
        <button class="v-btn" data-del-sync="${vn}" style="color:var(--sym-red)">حذف</button>
      </div>
    `).join('');
    syncTimingsList.querySelectorAll('[data-del-sync]').forEach(b => {
      b.addEventListener('click', () => {
        const vn = Number(b.dataset.delSync);
        if (state.chapterTimings[chId]) {
          delete state.chapterTimings[chId][vn];
          saveTimings();
          refreshSyncPanel();
        }
      });
    });
  }

  syncChapterSelect.addEventListener('change', refreshSyncPanel);

  chapterAudioInput.addEventListener('change', e => {
    const file = e.target.files[0];
    if (!file) return;
    const chId = Number(syncChapterSelect.value);
    if (state.chapterAudioMap[chId]) URL.revokeObjectURL(state.chapterAudioMap[chId].url);
    state.chapterAudioMap[chId] = { url: URL.createObjectURL(file), name: file.name };
    refreshSyncPanel();
  });

  syncStartBtn.addEventListener('click', () => {
    const chId = Number(syncChapterSelect.value);
    const chAudio = state.chapterAudioMap[chId];
    if (!chAudio) { alert('يرجى اختيار ملف MP3 لهذا الباب أولاً.'); return; }
    state.playToken++;
    clearTimers();
    cancelSpeech();
    state.activeBackend = 'chapter';
    state.syncModeActive = true;
    state.isPlaying = true;
    state.isPaused = false;
    audioEl.src = chAudio.url;
    audioEl.dataset.chId = String(chId);
    audioEl.playbackRate = state.speed;
    audioEl.currentTime = 0;
    audioEl._chapterVerseEnd = null;
    audioEl.play().catch(() => {});
    updateDockDisplay(state.syncNextVerse, `وضع مزامنة الباب: ${chMap[chId].title}`);
  });

  syncMarkBtn.addEventListener('click', () => {
    const chId = Number(syncChapterSelect.value);
    if (!state.chapterAudioMap[chId]) { alert('يرجى اختيار وتشغيل ملف الباب أولاً.'); return; }
    const ch = chMap[chId];
    const vn = state.syncNextVerse;
    if (!state.chapterTimings[chId]) state.chapterTimings[chId] = {};
    state.chapterTimings[chId][vn] = Number(audioEl.currentTime.toFixed(2));
    saveTimings();
    if (vn < ch.verse_end) state.syncNextVerse = vn + 1;
    refreshSyncPanel();
  });

  document.getElementById('exportTimingsBtn').addEventListener('click', () => {
    downloadJSON(state.chapterTimings, 'shatibiyyah_audio_timings.json');
  });
  document.getElementById('importTimingsInput').addEventListener('change', e => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const obj = JSON.parse(reader.result);
        if (typeof obj !== 'object' || !obj) throw new Error('bad');
        state.chapterTimings = { ...state.chapterTimings, ...obj };
        saveTimings();
        refreshSyncPanel();
        alert('تم استيراد ملف التوقيتات الصوتية بنجاح.');
      } catch { alert('ملف JSON غير صالح.'); }
    };
    reader.readAsText(file);
  });
  document.getElementById('clearChTimingsBtn').addEventListener('click', () => {
    const chId = Number(syncChapterSelect.value);
    delete state.chapterTimings[chId];
    saveTimings();
    refreshSyncPanel();
  });

  ttsVoiceSelect.addEventListener('change', () => {
    state.ttsVoiceName = ttsVoiceSelect.value;
    saveCfg();
  });
  document.getElementById('testTtsBtn').addEventListener('click', () => {
    state.sourceMode = 'tts';
    saveCfg();
    refreshModeCards();
    playVerseInternal(1, true);
  });

  APP.onPageRendered(() => updateVerseHighlights());

  window.SHAT_AUDIO = {
    playVerse: (vn) => playVerseInternal(vn, true),
    toggleVerse,
    togglePlayPause,
    stop: () => stopPlayback(),
    getState: () => state
  };

  speedBtn.textContent = `${state.speed}×`;
  updateDockDisplay(state.currentVerse);
  refreshSyncPanel();
};
