/* Smart Study — visual_flashcard.js */
// ══════════════════════════════════════════
// VISUAL FLASHCARD ENGINE
// ══════════════════════════════════════════
var _vfc = {
    deck: [], idx: 0, doneCount: 0, againCount: 0,
    paused: false, spd: 5000, raf: null, t0: null,
    totalOrig: 0
};

function openVisualFlashcard() {
    // quizItems থেকে VisualURL আছে এমন cards নাও
    var cards = [];
    quizItems.forEach(function(i) {
        var url = (getVal(i, 'VisualURL') || '').trim();
        if (!url) return;
        cards.push({
            url: url,
            word: getVal(i, 'question') || '',
            answer: getVal(i, 'correct') || ''
        });
    });
    if (!cards.length) { showToast('⚠️ এই topic-এ কোনো Visual ছবি নেই'); return; }

    _vfc.deck = cards.map(function(c){ return Object.assign({}, c); });
    _vfc.idx = 0; _vfc.doneCount = 0; _vfc.againCount = 0;
    _vfc.paused = false; _vfc.spd = 5000; _vfc.totalOrig = cards.length;

    // Title
    var topicName = path.length >= 2 ? path[path.length - 1] : (path[0] || 'Visual');
    document.getElementById('vfc-title').textContent = '🖼 ' + topicName;
    document.getElementById('vfc-fin-total').textContent = cards.length;

    // Reset controls
    document.getElementById('vfc-pause-btn').textContent = '⏸';
    document.getElementById('vfc-pause-btn').style.color = '';
    document.getElementById('vfc-spd-btn').textContent = '⏱ ৫s';

    // Show modal
    var modal = document.getElementById('visual-fc-modal');
    modal.style.display = 'flex';
    document.getElementById('vfc-stage').style.display = '';
    document.getElementById('vfc-finish').style.display = 'none';
    document.querySelector('#visual-fc-modal > div:last-of-type').style.display = '';

    // Push history state so back button closes modal
    history.pushState({view: 'visual-fc'}, '');

    _vfcRender();
}

function closeVisualFlashcard() {
    _vfcStopTimer();
    document.getElementById('visual-fc-modal').style.display = 'none';
}

function _vfcRender() {
    if (_vfc.idx >= _vfc.deck.length) { _vfcShowFinish(); return; }
    var c = _vfc.deck[_vfc.idx];

    // Image
    document.getElementById('vfc-img').src = c.url;

    // Word strip — question + answer
    var strip = '';
    if (c.word) strip += '<span style="background:rgba(99,102,241,0.18);border:1.5px solid rgba(99,102,241,0.4);border-radius:20px;padding:5px 12px;font-size:12px;font-weight:900;color:#a5b4fc;white-space:nowrap;">' + c.word + '</span>';
    if (c.answer) strip += '<span style="background:rgba(74,222,128,0.15);border:1.5px solid rgba(74,222,128,0.35);border-radius:20px;padding:5px 12px;font-size:12px;font-weight:900;color:#86efac;white-space:nowrap;">→ ' + c.answer + '</span>';
    document.getElementById('vfc-strip').innerHTML = strip || '';

    // Progress
    var total = _vfc.deck.length;
    var pct = Math.round((_vfc.idx / total) * 100);
    document.getElementById('vfc-prog').style.width = pct + '%';
    document.getElementById('vfc-count').textContent = (_vfc.idx + 1) + ' / ' + total;
    document.getElementById('vfc-done-lbl').textContent = '✓ ' + _vfc.doneCount + ' Done';

    // Animate card in
    var card = document.getElementById('vfc-card');
    card.classList.remove('vfc-in','vfc-xl','vfc-xr');
    void card.offsetWidth;
    card.classList.add('vfc-in');

    _vfcStartTimer();
}

function _vfcStartTimer() {
    _vfcStopTimer();
    if (_vfc.spd === 0 || _vfc.paused) { _vfcSetTimerBar(1); return; }
    _vfc.t0 = performance.now();
    (function tick(now) {
        if (_vfc.paused) return;
        var r = Math.max(0, 1 - (now - _vfc.t0) / _vfc.spd);
        _vfcSetTimerBar(r);
        if (r <= 0) { _vfcAdvance('auto'); return; }
        _vfc.raf = requestAnimationFrame(tick);
    })(_vfc.t0);
}
function _vfcStopTimer() {
    if (_vfc.raf) { cancelAnimationFrame(_vfc.raf); _vfc.raf = null; }
}
function _vfcSetTimerBar(r) {
    var el = document.getElementById('vfc-timer');
    if (el) el.style.width = (r * 100) + '%';
}

function _vfcAdvance(why) {
    _vfcStopTimer();
    var card = document.getElementById('vfc-card');
    var cls = (why === 'done') ? 'vfc-xr' : 'vfc-xl';
    card.classList.add(cls);
    setTimeout(function() {
        card.classList.remove(cls);
        if (why === 'again') {
            var c = _vfc.deck.splice(_vfc.idx, 1)[0];
            _vfc.deck.push(c);
            if (_vfc.idx >= _vfc.deck.length) _vfc.idx = _vfc.deck.length - 1;
        } else {
            _vfc.idx++;
        }
        _vfcRender();
    }, 280);
}

function vfcTap()  { _vfcStopTimer(); _vfcAdvance('tap'); }
function vfcDone() { _vfc.doneCount++; _vfcFlashDone(); _vfcAdvance('done'); }
function vfcAgain(){ _vfc.againCount++; _vfcAdvance('again'); }

function _vfcFlashDone() {
    var el = document.createElement('div');
    el.style.cssText = 'position:absolute;inset:0;z-index:20;border-radius:20px;background:rgba(74,222,128,0.15);border:2px solid rgba(74,222,128,0.45);display:flex;align-items:center;justify-content:center;pointer-events:none;animation:vfcIn .5s ease forwards;';
    el.innerHTML = '<span style="font-size:56px;">✅</span>';
    document.getElementById('vfc-stage').appendChild(el);
    setTimeout(function(){ el.remove(); }, 500);
}

function vfcPauseToggle() {
    _vfc.paused = !_vfc.paused;
    var btn = document.getElementById('vfc-pause-btn');
    var hint = document.getElementById('vfc-hint');
    if (_vfc.paused) {
        _vfcStopTimer();
        btn.textContent = '▶'; btn.style.color = '#4ade80';
        hint.textContent = '⏸ বিরতি — ▶ চাপুন চালাতে';
    } else {
        btn.textContent = '⏸'; btn.style.color = '';
        hint.textContent = '👆 ট্যাপ করুন বা অপেক্ষা করুন';
        _vfcStartTimer();
    }
}

function openVFCSpeedSheet()  {
    _vfc.paused = true; _vfcStopTimer();
    document.getElementById('vfc-speed-overlay').style.display = 'block';
}
function closeVFCSpeedSheet() { document.getElementById('vfc-speed-overlay').style.display = 'none'; }

function vfcSetSpeed(ms, lbl, el) {
    _vfc.spd = ms;
    document.getElementById('vfc-spd-btn').textContent = '⏱ ' + lbl;
    document.querySelectorAll('#vfc-speed-overlay button').forEach(function(b){
        b.style.background = 'rgba(255,255,255,0.04)';
        b.style.borderColor = 'rgba(255,255,255,0.1)';
        b.style.color = 'rgba(255,255,255,0.5)';
    });
    el.style.background = 'rgba(245,166,35,0.14)';
    el.style.borderColor = 'rgba(245,166,35,0.5)';
    el.style.color = '#f5a623';
    closeVFCSpeedSheet();
    _vfc.paused = false;
    document.getElementById('vfc-pause-btn').textContent = '⏸';
    document.getElementById('vfc-pause-btn').style.color = '';
    var hint = document.getElementById('vfc-hint');
    hint.textContent = ms === 0 ? '👆 ট্যাপ করলে পরেরটা আসবে' : '👆 ট্যাপ করুন বা অপেক্ষা করুন';
    if (ms === 0) _vfcSetTimerBar(0); else _vfcStartTimer();
}

function _vfcShowFinish() {
    _vfcStopTimer();
    document.getElementById('vfc-stage').style.display = 'none';
    // Hide bottom controls
    var ctrls = document.querySelector('#visual-fc-modal > div:nth-last-child(3)');
    if (ctrls) ctrls.style.display = 'none';
    document.querySelector('.vfc-timer-row') && (document.querySelector('.vfc-timer-row').style.display = 'none');
    document.getElementById('vfc-finish').style.display = 'flex';
    document.getElementById('vfc-fin-done').textContent = _vfc.doneCount;
    document.getElementById('vfc-fin-again').textContent = _vfc.againCount;
}

function vfcRestart() {
    // rebuild deck from original quizItems
    var cards = [];
    quizItems.forEach(function(i) {
        var url = (getVal(i, 'VisualURL') || '').trim();
        if (!url) return;
        cards.push({ url: url, word: getVal(i, 'question') || '', answer: getVal(i, 'correct') || '' });
    });
    _vfc.deck = cards;
    _vfc.idx = 0; _vfc.doneCount = 0; _vfc.againCount = 0; _vfc.paused = false;
    document.getElementById('vfc-finish').style.display = 'none';
    document.getElementById('vfc-stage').style.display = '';
    var ctrls = document.querySelector('#visual-fc-modal > div:nth-last-child(3)');
    if (ctrls) ctrls.style.display = '';
    document.getElementById('vfc-pause-btn').textContent = '⏸';
    document.getElementById('vfc-pause-btn').style.color = '';
    _vfcRender();
}
