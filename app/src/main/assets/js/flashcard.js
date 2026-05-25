/* Smart Study — flashcard.js */
function openFlashcardMode() {
    if (savedQs.length === 0) { showToast('⭐ আগে কিছু প্রশ্ন সেভ করো!'); return; }
    _fcItems = savedQs.filter(q => getVal(q,'question') && getVal(q,'correct'));
    if (_fcItems.length === 0) { showToast('সেভ করা প্রশ্নে উত্তর নেই!'); return; }
    _fcIndex = 0;
    renderFlashcard();
    document.getElementById('flashcard-modal').classList.remove('hidden');
}

function renderFlashcard() {
    const item = _fcItems[_fcIndex];
    document.getElementById('fc-question').innerText = getVal(item, 'question');
    document.getElementById('fc-answer').innerText = getVal(item, 'correct') || getVal(item, 'answer') || '—';
    document.getElementById('fc-counter').innerText = `${_fcIndex + 1} / ${_fcItems.length}`;
    const scene = document.getElementById('fc-scene');
    if (scene) scene.classList.remove('flipped');
}

function flipCard() {
    document.getElementById('fc-scene').classList.toggle('flipped');
}

function fcNext() {
    if (_fcIndex < _fcItems.length - 1) { _fcIndex++; renderFlashcard(); }
    else { showToast('🎉 সব Flashcard শেষ!'); }
}

function fcPrev() {
    if (_fcIndex > 0) { _fcIndex--; renderFlashcard(); }
}

function closeFlashcard() {
    document.getElementById('flashcard-modal').classList.add('hidden');
}

// ====================================================
// 🎬 ADMIN REELS FLASHCARD SYSTEM
// ====================================================
var _rfc = {
  source: 'QBank',
  timer: 7,
  items: [],
  index: 0,
  timerInterval: null,
  remaining: 7
};

function openAdminReelsFC() {
  if (!isAdmin()) return;
  // Subject dropdown populate
  var src = _rfc.source;
  var arr = toArr ? toArr(fullData[src]) : (fullData[src] ? Object.values(fullData[src]) : []);
  var subjects = [...new Set(arr.map(q => getVal(q,'subject')).filter(Boolean))].sort();
  var sel = document.getElementById('rfc-subject-sel');
  if (sel) {
    sel.innerHTML = '<option value="">সব Subject</option>' +
      subjects.map(s => `<option value="${s}">${s}</option>`).join('');
  }
  document.getElementById('reels-fc-modal').style.display = 'block';
  document.getElementById('reels-setup').style.display = 'flex';
  document.getElementById('reels-play').style.display = 'none';
}

function rfcSelectSource(src) {
  _rfc.source = src;
  document.querySelectorAll('.rfc-src-btn').forEach(b => {
    var active = b.id === 'rfc-src-' + src;
    b.style.border = active ? '1.5px solid #6366f1' : '1.5px solid rgba(255,255,255,.12)';
    b.style.background = active ? 'rgba(99,102,241,.15)' : 'rgba(255,255,255,.04)';
    b.style.color = active ? '#a5b4fc' : 'rgba(255,255,255,.5)';
  });
  // Refresh subjects
  var arr = fullData[src] ? Object.values(fullData[src]) : [];
  var subjects = [...new Set(arr.map(q => getVal(q,'subject')).filter(Boolean))].sort();
  var sel = document.getElementById('rfc-subject-sel');
  if (sel) sel.innerHTML = '<option value="">সব Subject</option>' + subjects.map(s => `<option value="${s}">${s}</option>`).join('');
}

function rfcTimerAdj(d) {
  var v = Math.min(10, Math.max(5, _rfc.timer + d));
  _rfc.timer = v;
  document.getElementById('rfc-timer-val').textContent = v;
  document.getElementById('rfc-timer-range').value = v;
}

function rfcTimerRange(v) {
  _rfc.timer = parseInt(v);
  document.getElementById('rfc-timer-val').textContent = v;
}

function startReelsFC() {
  var src = _rfc.source;
  var subj = document.getElementById('rfc-subject-sel').value;
  var arr = fullData[src] ? Object.values(fullData[src]) : [];
  if (subj) arr = arr.filter(q => getVal(q,'subject') === subj);
  arr = arr.filter(q => getVal(q,'question'));
  if (arr.length === 0) { alert('কোনো প্রশ্ন পাওয়া যায়নি!'); return; }
  // Shuffle
  arr = arr.sort(() => Math.random() - .5);
  _rfc.items = arr;
  _rfc.index = 0;
  document.getElementById('reels-setup').style.display = 'none';
  document.getElementById('reels-play').style.display = 'block';
  rfcShowQuestion();
}

function rfcShowQuestion() {
  if (_rfc.index >= _rfc.items.length) {
    alert('🎉 সব প্রশ্ন শেষ!');
    closeReelsFC();
    return;
  }
  var item = _rfc.items[_rfc.index];
  var qType = (getVal(item,'question_type') || getVal(item,'QType') || getVal(item,'qtype') || 'mcq').toLowerCase();
  var isMCQ = qType !== 'written' && qType !== 'study';
  var opts = [
    getVal(item,'opt1') || getVal(item,'Opt1') || getVal(item,'option1') || getVal(item,'Option1'),
    getVal(item,'opt2') || getVal(item,'Opt2') || getVal(item,'option2') || getVal(item,'Option2'),
    getVal(item,'opt3') || getVal(item,'Opt3') || getVal(item,'option3') || getVal(item,'Option3'),
    getVal(item,'opt4') || getVal(item,'Opt4') || getVal(item,'option4') || getVal(item,'Option4')
  ].filter(Boolean);
  if (opts.length > 0) isMCQ = true;

  // Show question phase
  var phQ = document.getElementById('rfc-phase-q');
  var phA = document.getElementById('rfc-phase-a');
  phQ.style.display = 'flex';
  phA.style.display = 'none';

  // Counter
  document.getElementById('rfc-counter').textContent = (_rfc.index + 1) + ' / ' + _rfc.items.length;
  // Subject
  document.getElementById('rfc-subj').textContent = getVal(item,'subject') || _rfc.source;
  // Type badge
  var badge = document.getElementById('rfc-qtype-badge');
  badge.textContent = isMCQ ? '❓ MCQ' : '✍️ Written';
  badge.style.background = isMCQ ? 'rgba(99,102,241,.15)' : 'rgba(139,92,246,.15)';
  badge.style.color = isMCQ ? '#a5b4fc' : '#c4b5fd';
  // Question
  document.getElementById('rfc-question').textContent = getVal(item,'question');

  // MCQ options
  var optsEl = document.getElementById('rfc-opts');
  if (isMCQ && opts.length > 0) {
    var ltrs = ['ক','খ','গ','ঘ'];
    optsEl.innerHTML = opts.map((o,i) => `
      <div style="display:flex;align-items:center;gap:12px;padding:10px 14px;border-radius:13px;border:1px solid #e2e8f0;background:#f8fafc;animation:rfcOptIn .3s ease both ${i*.1}s;opacity:0;">
        <span style="width:30px;height:30px;border-radius:9px;background:#e2e8f0;font-family:system-ui;font-size:12px;font-weight:800;color:#64748b;display:flex;align-items:center;justify-content:center;flex-shrink:0;">${ltrs[i]}</span>
        <span style="font-size:13.5px;color:#475569;font-weight:500;">${o}</span>
      </div>`).join('');
    optsEl.style.display = 'flex';
  } else {
    optsEl.innerHTML = '';
    optsEl.style.display = 'none';
  }

  // Timer
  clearInterval(_rfc.timerInterval);
  _rfc.remaining = _rfc.timer;
  rfcUpdateRing(_rfc.remaining, _rfc.timer);
  document.getElementById('rfc-timer-disp').textContent = _rfc.remaining;

  _rfc.timerInterval = setInterval(() => {
    _rfc.remaining--;
    document.getElementById('rfc-timer-disp').textContent = Math.max(0, _rfc.remaining);
    rfcUpdateRing(_rfc.remaining, _rfc.timer);
    if (_rfc.remaining <= 0) {
      clearInterval(_rfc.timerInterval);
      rfcFlipToAnswer();
    }
  }, 1000);
}

function rfcUpdateRing(rem, total) {
  var circ = 188.5;
  var offset = circ - (circ * rem / total);
  var ring = document.getElementById('rfc-ring');
  if (ring) ring.style.strokeDashoffset = Math.max(0, offset);
}

function rfcFlipToAnswer() {
  // Page flip effect
  var overlay = document.getElementById('rfc-flip-overlay');
  var page = document.getElementById('rfc-flip-page');
  overlay.style.display = 'block';
  page.style.transition = 'none';
  page.style.transform = 'rotateY(0deg)';
  page.getBoundingClientRect();
  page.style.transition = 'transform .55s cubic-bezier(.4,0,.2,1)';
  page.style.transform = 'rotateY(-180deg)';

  setTimeout(() => {
    overlay.style.display = 'none';
    page.style.transform = 'rotateY(0deg)';
    rfcShowAnswer();
  }, 560);
}

function rfcShowAnswer() {
  var item = _rfc.items[_rfc.index];
  var opts = [
    getVal(item,'opt1') || getVal(item,'Opt1') || getVal(item,'option1') || getVal(item,'Option1'),
    getVal(item,'opt2') || getVal(item,'Opt2') || getVal(item,'option2') || getVal(item,'Option2'),
    getVal(item,'opt3') || getVal(item,'Opt3') || getVal(item,'option3') || getVal(item,'Option3'),
    getVal(item,'opt4') || getVal(item,'Opt4') || getVal(item,'option4') || getVal(item,'Option4')
  ].filter(Boolean);
  var correct = getVal(item,'correct') || getVal(item,'Correct') || '';
  var explanation = getVal(item,'explanation') || getVal(item,'Explanation') || '';

  var phQ = document.getElementById('rfc-phase-q');
  var phA = document.getElementById('rfc-phase-a');
  phQ.style.display = 'none';
  phA.style.display = 'flex';

  // Reset animations
  var ansBox = document.getElementById('rfc-ans-box');
  var expWrap = document.getElementById('rfc-exp-wrap');
  ansBox.style.animation = 'none'; ansBox.style.opacity = '0';
  ansBox.getBoundingClientRect();
  ansBox.style.animation = 'rfcPop .4s cubic-bezier(.34,1.56,.64,1) both .1s';

  // Correct answer text
  document.getElementById('rfc-correct-text').textContent = correct;

  // Explanation
  if (explanation) {
    expWrap.style.display = 'block';
    expWrap.style.animation = 'none'; expWrap.style.opacity = '0';
    expWrap.getBoundingClientRect();
    expWrap.style.animation = 'rfcSlideUp .4s ease both .4s';
    document.getElementById('rfc-exp-text').textContent = explanation;
  } else {
    expWrap.style.display = 'none';
  }

  // Answer options (MCQ)
  var ansOpts = document.getElementById('rfc-ans-opts');
  if (opts.length > 0) {
    var ltrs = ['ক','খ','গ','ঘ'];
    ansOpts.innerHTML = opts.map((o,i) => {
      var isCorrect = correct && o.trim().toLowerCase() === correct.trim().toLowerCase();
      var isWrong = !isCorrect;
      return `<div style="display:flex;align-items:center;gap:12px;padding:10px 14px;border-radius:13px;
        border:1px solid ${isCorrect ? 'rgba(16,185,129,.4)' : 'rgba(255,255,255,.06)'};
        background:${isCorrect ? 'rgba(16,185,129,.12)' : 'rgba(239,68,68,.05)'};
        animation:rfcOptIn .3s ease both ${.3+i*.1}s;opacity:0;">
        <span style="width:28px;height:28px;border-radius:8px;font-family:system-ui;font-size:12px;font-weight:800;display:flex;align-items:center;justify-content:center;flex-shrink:0;
          background:${isCorrect ? '#10b981' : 'rgba(239,68,68,.2)'};
          color:${isCorrect ? '#fff' : 'rgba(239,68,68,.7)'};">${ltrs[i]}</span>
        <span style="font-size:13px;font-weight:${isCorrect?'700':'500'};
          color:${isCorrect ? '#d1fae5' : 'rgba(255,255,255,.35)'};">${o}${isCorrect?' ✓':''}</span>
      </div>`;
    }).join('');
    ansOpts.style.display = 'flex';
  } else {
    ansOpts.innerHTML = '';
    ansOpts.style.display = 'none';
  }
}

function rfcNext() {
  clearInterval(_rfc.timerInterval);
  _rfc.index++;
  rfcShowQuestion();
}

function closeReelsFC() {
  clearInterval(_rfc.timerInterval);
  document.getElementById('reels-fc-modal').style.display = 'none';
}

// ── Helper for toArr compatibility ──
function toArr(obj) {
