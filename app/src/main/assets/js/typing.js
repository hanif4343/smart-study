/* Smart Study — typing.js */
function openTypingTest() {
    var existing = document.getElementById('typing-overlay');
    if (existing) {
        existing.style.display = 'flex';
        // fullData['Typing'] empty হলে আবার load করো
        if (!fullData['Typing'] || fullData['Typing'].length === 0) {
            ttLoadTypingData(function(){ renderTypingHome(); });
        } else {
            renderTypingHome();
        }
        history.pushState({mode:currentMode,path:[...path]},'');
        return;
    }

    var overlay = document.createElement('div');
    overlay.id = 'typing-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;padding-top:env(safe-area-inset-top,0px);background:#f8fafc;z-index:9999;display:flex;flex-direction:column;overflow:hidden;';
    overlay.innerHTML = `
    <style>
        #typing-overlay { font-family:"Noto Sans Bengali",sans-serif; }
        .tt-topbar { background:linear-gradient(135deg,#0c4a6e,#0369a1);padding:14px 16px;padding-top:max(14px,env(safe-area-inset-top,14px));display:flex;align-items:center;gap:12px;flex-shrink:0; }
        .tt-back { background:rgba(255,255,255,0.15);border:none;border-radius:10px;color:white;font-size:18px;padding:6px 11px;cursor:pointer; }
        .tt-title { color:white;font-weight:900;font-size:16px;flex:1; }
        .tt-body { flex:1;overflow-y:auto;padding:14px;display:flex;flex-direction:column; }
        .tt-card { background:white;border-radius:14px;padding:14px;margin-bottom:10px;border:1px solid rgba(0,0,0,0.06);box-shadow:0 2px 8px rgba(0,0,0,0.05); }
        .tt-label { font-size:11px;font-weight:800;color:#64748b;margin-bottom:6px; }
        .tt-select { width:100%;padding:10px 12px;border-radius:10px;border:1.5px solid #e2e8f0;font-size:13px;font-weight:700;background:white;color:#1e293b;-webkit-appearance:none;appearance:none; }
        .tt-start-btn { width:100%;padding:14px;background:linear-gradient(135deg,#0369a1,#0c4a6e);color:white;border:none;border-radius:14px;font-size:15px;font-weight:900;cursor:pointer;margin-top:6px; }
        .tt-custom-area { width:100%;padding:10px 12px;border-radius:10px;border:1.5px solid #e2e8f0;font-size:13px;font-weight:600;min-height:100px;resize:none;box-sizing:border-box;color:#1e293b; }
        /* Practice screen */
        .tt-timer-bar { background:white;padding:10px 16px;display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #e2e8f0;flex-shrink:0; }
        .tt-timer-num { font-size:26px;font-weight:900;color:#0369a1;font-variant-numeric:tabular-nums; }
        .tt-stat-pill { background:#f1f5f9;border-radius:10px;padding:5px 10px;text-align:center; }
        .tt-stat-pill .v { font-size:15px;font-weight:900;color:#0f172a; }
        .tt-stat-pill .l { font-size:9px;font-weight:700;color:#94a3b8; }
        /* ── Passage display (উপরে, marking সহ) ── */
        .tt-passage {
            font-size:17px;line-height:2.2;letter-spacing:0.4px;
            padding:14px;background:white;border-radius:14px;
            border:1.5px solid #e2e8f0;
            word-break:break-all;overflow-wrap:break-word;white-space:pre-wrap;
            overflow-y:auto;             /* scrollTop JS দিয়ে control হবে */
            position:relative;z-index:1;
            flex:1;min-height:0;           /* flex child হিসেবে বাড়বে-কমবে */
        }
        .tt-ch { color:#374151; }
        .tt-ch.correct { color:#16a34a; }
        .tt-ch.wrong { color:#dc2626;background:#fef2f2;border-radius:3px; }
        .tt-ch.cursor { border-left:2.5px solid #0369a1;margin-left:-1px;animation:tt-blink 1s infinite; }
        @keyframes tt-blink { 0%,100%{opacity:1} 50%{opacity:0} }
        /* পুরনো hidden input — এখনো keyboard trigger এর জন্য রাখা */
        .tt-input { position:fixed;top:-9999px;left:-9999px;opacity:0;pointer-events:none;width:1px;height:1px; }
        /* ── নতুন visible input box (নিচে) ── */
        .tt-type-box-wrap {
            flex-shrink:0;
            background:white;
            border-top:2px solid #e2e8f0;
            padding:10px 12px;
        }
        .tt-type-box-label {
            font-size:10px;font-weight:800;color:#94a3b8;margin-bottom:5px;letter-spacing:0.5px;
        }
        .tt-type-box {
            width:100%;box-sizing:border-box;
            padding:11px 13px;
            border-radius:12px;
            border:2px solid #0369a1;
            font-size:16px;font-weight:600;
            font-family:\"Noto Sans Bengali\",sans-serif;
            color:#1e293b;background:#f8fafc;
            resize:none;outline:none;
            line-height:1.6;
            min-height:52px;max-height:100px;
            overflow-y:auto;
        }
        .tt-type-box:focus { border-color:#0369a1;background:white;box-shadow:0 0 0 3px rgba(3,105,161,0.12); }
        .tt-finish-btn { width:100%;padding:10px;background:linear-gradient(135deg,#dc2626,#b91c1c);color:white;border:none;border-radius:12px;font-size:14px;font-weight:900;cursor:pointer;margin-top:8px; }
        .tt-tap-hint { text-align:center;color:#94a3b8;font-size:12px;font-weight:700;padding:4px; }
        /* Result */
        .tt-result-ring { width:110px;height:110px;margin:0 auto 16px;position:relative; }
        .tt-result-val { position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center; }
        .tt-result-grid { display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px; }
        .tt-result-box { background:#f8fafc;border-radius:12px;padding:12px;text-align:center;border:1px solid rgba(0,0,0,0.06); }
        .tt-result-box .rv { font-size:22px;font-weight:900;color:#0369a1; }
        .tt-result-box .rl { font-size:10px;font-weight:700;color:#94a3b8;margin-top:3px; }
        .tt-wrong-list { background:#fef2f2;border-radius:12px;padding:12px;border:1px solid #fecaca; }
        .tt-wrong-word { display:inline-block;background:white;border:1px solid #fca5a5;border-radius:8px;padding:3px 8px;font-size:12px;font-weight:700;color:#dc2626;margin:3px; }
        .tt-tab-row { display:flex;margin-bottom:12px;background:#f1f5f9;border-radius:12px;padding:3px; }
        .tt-tab { flex:1;padding:8px;text-align:center;font-size:12px;font-weight:800;border-radius:9px;cursor:pointer;border:none;background:transparent;color:#64748b; }
        .tt-tab.active { background:white;color:#0369a1;box-shadow:0 1px 4px rgba(0,0,0,0.1); }
    </style>

    <!-- Topbar -->
    <div class="tt-topbar">
        <button class="tt-back" onclick="closeTypingTest()">←</button>
        <span class="tt-title">⌨️ Typing Speed Test</span>
        <span id="tt-mode-badge" style="background:rgba(255,255,255,0.15);color:white;font-size:10px;font-weight:800;padding:3px 9px;border-radius:8px;">HOME</span>
    </div>

    <!-- Body (dynamic) -->
    <div class="tt-body" id="tt-body">
        <div style="text-align:center;padding:40px;color:#94a3b8;">লোড হচ্ছে...</div>
    </div>

    <!-- hidden input for typing capture -->
    <input type="text" class="tt-input" id="tt-hidden-input" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false"
        oninput="ttHandleInput(this.value)" onkeydown="ttHandleKey(event)">
    `;
    document.body.appendChild(overlay);

    // Android back button support — history এ push করো
    history.pushState({mode:currentMode,path:[...path]},'');

    // ── Typing state
    window._tt = {
        passage: '',
        title: '',
        typed: '',
        startTime: null,
        timerInterval: null,
        timeLimit: 0,
        timeElapsed: 0,
        running: false,
        finished: false,
        wrongWords: [],
        wpm: 0,
        accuracy: 0,
        totalChars: 0,
        correctChars: 0,
        tab: 'db',
        selectedPassageIdx: 0,
        selectedTime: 180,
        selectedLevel: '',
        selectedSubject: ''
    };

    // fullData['Typing'] empty হলে সরাসরি Firebase থেকে load করো
    if (!fullData['Typing'] || fullData['Typing'].length === 0) {
        ttLoadTypingData(function(){ renderTypingHome(); });
    } else {
        renderTypingHome();
    }
}

function closeTypingTest() {
    var ov = document.getElementById('typing-overlay');
    if (ov) ov.style.display = 'none';
    ttStop();
}

// ─── HOME SCREEN ───────────────────────────────
function renderTypingHome() {
    ttStop();
    document.getElementById('tt-mode-badge').innerText = 'HOME';

    var tt = window._tt;
    var passages = getTypingPassages();

    // Filter options
    var subjects = [...new Set(passages.map(p => p.subject || p.language).filter(Boolean))];
    var levels   = [...new Set(passages.map(p => p.level).filter(Boolean))];

    var subjectOpts = subjects.map(s => `<option value="${s}" ${tt.selectedSubject===s?'selected':''}>${s}</option>`).join('');
    var levelOpts   = levels.map(l => `<option value="${l}" ${tt.selectedLevel===l?'selected':''}>${l}</option>`).join('');

    // Filtered passages
    var filtered = passages.filter(p => {
        if (tt.selectedSubject && (p.subject || p.language) !== tt.selectedSubject) return false;
        if (tt.selectedLevel  && p.level  !== tt.selectedLevel)  return false;
        return true;
    });
    var passageOpts = filtered.map((p, i) => `<option value="${i}">${p.title||('অনুচ্ছেদ '+(i+1))}</option>`).join('');
    if (!passageOpts) passageOpts = '<option>কোনো অনুচ্ছেদ নেই</option>';

    var noData = passages.length === 0;

    document.getElementById('tt-body').innerHTML = `
    <!-- Tab row -->
    <div class="tt-tab-row">
        <button class="tt-tab ${tt.tab==='db'?'active':''}" onclick="ttSwitchTab('db')">📚 Firebase Passages</button>
        <button class="tt-tab ${tt.tab==='custom'?'active':''}" onclick="ttSwitchTab('custom')">✏️ Custom Text</button>
    </div>

    ${tt.tab === 'db' ? `
    <!-- DB TAB -->
    ${noData ? `<div class="tt-card" style="text-align:center;color:#94a3b8;padding:30px;">
        <div style="font-size:32px;margin-bottom:8px;">📭</div>
        <div style="font-weight:800;">Firebase-এ কোনো Typing ডেটা নেই</div>
        <div style="font-size:11px;margin-top:6px;">Firebase-এ <b>Typing</b> collection যোগ করুন<br>অথবা Custom Text ব্যবহার করুন</div>
        <div style="font-size:10px;margin-top:10px;background:#f1f5f9;border-radius:8px;padding:8px;text-align:left;color:#64748b;">
            Firebase structure:<br>
            <code>Typing/ { Id, Title, Level, Language, Content, AudienceTags }</code>
        </div>
    </div>` : `
    <div class="tt-card">
        <div class="tt-label">বিষয় নির্বাচন</div>
        <select class="tt-select" onchange="ttSetFilter('subject',this.value)">
            <option value="">সব বিষয়</option>
            ${subjectOpts}
        </select>
    </div>
    <div class="tt-card">
        <div class="tt-label">লেভেল নির্বাচন</div>
        <select class="tt-select" onchange="ttSetFilter('level',this.value)">
            <option value="">সব লেভেল</option>
            ${levelOpts}
        </select>
    </div>
    <div class="tt-card">
        <div class="tt-label">অনুচ্ছেদ নির্বাচন</div>
        <select class="tt-select" id="tt-passage-sel">
            ${passageOpts}
        </select>
    </div>
    <div class="tt-card">
        <div class="tt-label">সময় নির্বাচন</div>
        <select class="tt-select" id="tt-time-sel">
            <option value="180" ${tt.selectedTime===180?'selected':''}>৩ মিনিট</option>
            <option value="300" ${tt.selectedTime===300?'selected':''}>৫ মিনিট</option>
            <option value="420" ${tt.selectedTime===420?'selected':''}>৭ মিনিট</option>
            <option value="600" ${tt.selectedTime===600?'selected':''}>১০ মিনিট</option>
            <option value="0">সময় সীমা নেই</option>
        </select>
    </div>
    <button class="tt-start-btn" onclick="ttStartFromDB()">▶ Typing Speed Test শুরু করো</button>
    `}
    ` : `
    <!-- CUSTOM TAB -->
    <div class="tt-card">
        <div class="tt-label">টেক্সট টাইটেল (ঐচ্ছিক)</div>
        <input id="tt-custom-title" class="tt-select" placeholder="শিরোনাম লিখুন..." style="margin-bottom:0;">
    </div>
    <div class="tt-card">
        <div class="tt-label">তোমার টেক্সট লিখো বা পেস্ট করো</div>
        <textarea id="tt-custom-text" class="tt-custom-area" placeholder="এখানে অনুচ্ছেদ লিখুন বা পেস্ট করুন..."></textarea>
    </div>
    <div class="tt-card">
        <div class="tt-label">সময় নির্বাচন</div>
        <select class="tt-select" id="tt-custom-time">
            <option value="120">২ মিনিট</option>
            <option value="180" selected>৩ মিনিট</option>
            <option value="300">৫ মিনিট</option>
            <option value="600">১০ মিনিট</option>
            <option value="0">সময় সীমা নেই</option>
        </select>
    </div>
    <button class="tt-start-btn" onclick="ttStartCustom()">▶ Custom Typing শুরু করো</button>
    `}
    `;
}

function ttSwitchTab(tab) { window._tt.tab = tab; renderTypingHome(); }
function ttSetFilter(key, val) {
    window._tt['selected'+key.charAt(0).toUpperCase()+key.slice(1)] = val;
    window._tt.selectedPassageIdx = 0;
    renderTypingHome();
}

// ── Typing data সরাসরি Firebase থেকে load করো ──
function ttLoadTypingData(callback) {
    var body = document.getElementById('tt-body');
    if (body) body.innerHTML = '<div style="text-align:center;padding:40px;color:#64748b;font-weight:700;">⏳ ডেটা লোড হচ্ছে...</div>';

    fetch(FIREBASE_URL + 'Typing.json?auth=' + SECRET_KEY)
        .then(function(r){ return r.json(); })
        .then(function(data){
            if (data && typeof data === 'object') {
                fullData['Typing'] = Array.isArray(data) ? data : Object.values(data);
            }
            if (callback) callback();
        })
        .catch(function(){
            if (callback) callback(); // error হলেও render করো (empty দেখাবে)
        });
}

function getTypingPassages() {
    var raw = fullData['Typing'] || [];
    return raw.map(function(item) {
        return {
            title:    getVal(item,'Title')    || getVal(item,'title')    || '',
            level:    getVal(item,'Level')    || getVal(item,'level')    || '',
            language: getVal(item,'Language') || getVal(item,'language') || 'Bangla',
            content:  getVal(item,'Content')  || getVal(item,'content')  || '',
            subject:  getVal(item,'Language') || getVal(item,'language') || ''
        };
    }).filter(function(p){ return p.content && p.content.trim().length > 5; });
}

function ttStartFromDB() {
    var passages = getTypingPassages();
    var subject  = window._tt.selectedSubject;
    var level    = window._tt.selectedLevel;
    var filtered = passages.filter(p => {
        if (subject && (p.subject || p.language) !== subject) return false;
        if (level  && p.level  !== level)  return false;
        return true;
    });
    var idx = parseInt(document.getElementById('tt-passage-sel')?.value || '0');
    var p   = filtered[idx] || filtered[0];
    if (!p) { ttAlert('অনুচ্ছেদ পাওয়া যায়নি! Firebase-এ Typing data যোগ করুন।'); return; }
    var timeLimit = parseInt(document.getElementById('tt-time-sel')?.value || '180');
    ttBegin(p.content.trim(), p.title || 'অনুচ্ছেদ', timeLimit);
}

function ttStartCustom() {
    var txt = (document.getElementById('tt-custom-text')?.value || '').trim();
    var title = (document.getElementById('tt-custom-title')?.value || '').trim() || 'Custom Text';
    if (txt.length < 10) { ttAlert('অনুচ্ছেদ অনেক ছোট! আরও টেক্সট লিখুন।'); return; }
    var timeLimit = parseInt(document.getElementById('tt-custom-time')?.value || '180');
    ttBegin(txt, title, timeLimit);
}

// ─── PRACTICE SCREEN ───────────────────────────────
function ttBegin(passage, title, timeLimit) {
    var tt  = window._tt;
    tt.passage    = passage;
    tt.title      = title;
    tt.typed      = '';
    tt.startTime  = null;
    tt.timeElapsed= 0;
    tt.timeLimit  = timeLimit;
    tt.running    = false;
    tt.finished   = false;
    tt.wrongWords = [];
    tt.wpm        = 0;
    tt.accuracy   = 100;
    tt.totalChars = 0;
    tt.correctChars = 0;

    document.getElementById('tt-mode-badge').innerText = title.slice(0,12)+(title.length>12?'…':'');

    var timeLabel = timeLimit === 0 ? '\u221e' : ttFormatTime(timeLimit);
    // tt-body কে flex column করো
    var body = document.getElementById('tt-body');
    body.style.cssText = 'flex:1;overflow:hidden;display:flex;flex-direction:column;padding:0;';
    body.innerHTML = '<div class="tt-timer-bar" style="display:flex;gap:8px;padding:8px 12px;flex-shrink:0;">'
        + '<div class="tt-stat-pill" style="flex:1;"><div class="v" id="tt-timer">' + timeLabel + '</div><div class="l">\u09b8\u09ae\u09af\u09bc</div></div>'
        + '<div class="tt-stat-pill" style="flex:1;"><div class="v" id="tt-wpm">0</div><div class="l">WPM</div></div>'
        + '<div class="tt-stat-pill" style="flex:1;"><div class="v" id="tt-acc">100%</div><div class="l">\u09a8\u09bf\u09b0\u09cd\u09ad\u09c1\u09b2\u09a4\u09be</div></div>'
        + '<div class="tt-stat-pill" style="flex:1;"><div class="v" id="tt-chars">0</div><div class="l">\u0985\u0995\u09cd\u09b7\u09b0</div></div>'
        + '</div>'
        + '<div style="flex:1;min-height:0;padding:10px 12px 6px;display:flex;flex-direction:column;">'
        + '<div class="tt-passage" id="tt-passage-display"></div>'
        + '</div>'
        + '<div class="tt-type-box-wrap">'
        + '<div class="tt-type-box-label">\u270d\ufe0f \u098f\u0996\u09be\u09a8\u09c7 \u099f\u09be\u0987\u09aa \u0995\u09b0\u09c1\u09a8</div>'
        + '<textarea class="tt-type-box" id="tt-visible-input" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" placeholder="\u099f\u09be\u0987\u09aa \u09b6\u09c1\u09b0\u09c1 \u0995\u09b0\u09c1\u09a8..." oninput="ttHandleVisibleInput(this)" onkeydown="ttHandleKey(event)"></textarea>'
        + '<button class="tt-finish-btn" onclick="ttFinish(true)">\u23f9 \u098f\u0996\u09a8\u0987 \u09b6\u09c7\u09b7 \u0995\u09b0\u09cb</button>'
        + '</div>';

    ttRenderPassage();
    // Auto-focus: keyboard opens immediately when practice screen loads
    setTimeout(function() { ttFocusInput(); }, 80);
}

function ttRenderPassage() {
    var tt   = window._tt;
    var pass = tt.passage;
    var typed = tt.typed;
    var html = '';
    for (var i = 0; i < pass.length; i++) {
        var ch = pass[i] === ' ' ? '&nbsp;' : pass[i] === '\n' ? '<br>' : pass[i];
        var cls = 'tt-ch';
        if (i < typed.length) {
            cls += (typed[i] === pass[i]) ? ' correct' : ' wrong';
        } else if (i === typed.length) {
            cls += ' cursor';
        }
        html += `<span class="${cls}">${ch}</span>`;
    }
    var el = document.getElementById('tt-passage-display');
    if (!el) return;
    el.innerHTML = html;

    // ── Smart auto-scroll: cursor যে line এ আছে সেটা উপরে দেখাবে ──
    var cur = el.querySelector('.cursor');
    if (cur) {
        var elRect  = el.getBoundingClientRect();
        var curRect = cur.getBoundingClientRect();
        // cursor যদি নিচের ৪০% অংশে চলে যায় তাহলে scroll করো
        var relTop = curRect.top - elRect.top;
        var threshold = elRect.height * 0.45;
        if (relTop > threshold) {
            // cursor কে passage এর উপরের ৩০% এ নিয়ে আসো
            el.scrollTop += relTop - elRect.height * 0.25;
        } else if (relTop < 20 && el.scrollTop > 0) {
            // উপরে গেলে পিছিয়ে আসো
            el.scrollTop = Math.max(0, el.scrollTop + relTop - elRect.height * 0.25);
        }
    }
}

function ttFocusInput() {
    // নতুন visible textarea তে focus দাও
    var vis = document.getElementById('tt-visible-input');
    if (vis) { vis.focus(); return; }
    // fallback: পুরনো hidden input
    var inp = document.getElementById('tt-hidden-input');
    if (!inp) return;
    inp.readOnly = true; inp.focus(); inp.readOnly = false; inp.focus();
    try { inp.click(); } catch(e) {}
}

// নতুন visible input থেকে handle করার function
function ttHandleVisibleInput(el) {
    ttHandleInput(el.value);
}

function ttHandleInput(val) {
    var tt = window._tt;
    if (tt.finished) return;
    if (!tt.running) ttStartTimer();

    tt.typed = val;

    // live stats
    var correct = 0;
    for (var i = 0; i < val.length && i < tt.passage.length; i++) {
        if (val[i] === tt.passage[i]) correct++;
    }
    tt.totalChars   = val.length;
    tt.correctChars = correct;
    tt.accuracy     = val.length > 0 ? Math.round(correct / val.length * 100) : 100;

    var elapsed = tt.startTime ? (Date.now() - tt.startTime) / 60000 : 0;
    var words   = val.trim().split(/\s+/).filter(w => w).length;
    tt.wpm = elapsed > 0 ? Math.round(words / elapsed) : 0;

    ttRenderPassage();
    ttUpdateStats();

    // auto-finish when passage complete
    if (val.length >= tt.passage.length) { ttFinish(false); return; }
}

function ttHandleKey(e) {
    // prevent backspace from navigating
    if (e.key === 'Backspace') { /* allow default */ }
}

function ttStartTimer() {
    var tt = window._tt;
    tt.running   = true;
    tt.startTime = Date.now();
    if (tt.timerInterval) clearInterval(tt.timerInterval);
    tt.timerInterval = setInterval(function() {
        if (!tt.running) return;
        tt.timeElapsed = Math.floor((Date.now() - tt.startTime) / 1000);
        var remaining  = tt.timeLimit > 0 ? tt.timeLimit - tt.timeElapsed : 0;
        var el = document.getElementById('tt-timer');
        if (el) el.innerText = tt.timeLimit > 0 ? ttFormatTime(Math.max(0, remaining)) : ttFormatTime(tt.timeElapsed);
        if (tt.timeLimit > 0 && remaining <= 0) { ttFinish(true); }
        // color red in last 30s
        if (el && tt.timeLimit > 0 && remaining <= 30) el.style.color = '#dc2626';
    }, 500);
}

function ttStop() {
    var tt = window._tt;
    if (!tt) return;
    tt.running = false;
    if (tt.timerInterval) { clearInterval(tt.timerInterval); tt.timerInterval = null; }
}

function ttUpdateStats() {
    var tt = window._tt;
    var wEl  = document.getElementById('tt-wpm');
    var aEl  = document.getElementById('tt-acc');
    var cEl  = document.getElementById('tt-chars');
    if (wEl) wEl.innerText = tt.wpm;
    if (aEl) { aEl.innerText = tt.accuracy + '%'; aEl.style.color = tt.accuracy >= 90 ? '#16a34a' : tt.accuracy >= 70 ? '#d97706' : '#dc2626'; }
    if (cEl) cEl.innerText  = tt.totalChars;
}

function ttFormatTime(sec) {
    var m = Math.floor(sec/60);
    var s = sec % 60;
    return (m<10?'0':'')+m+':'+(s<10?'0':'')+s;
}

function ttFinish(forced) {
    var tt = window._tt;
    if (tt.finished) return;
    tt.finished = true;
    ttStop();

    var elapsedSec  = tt.startTime ? (Date.now() - tt.startTime) / 1000 : 1;
    var elapsedMin  = elapsedSec / 60;

    // ── চরিত্র হিসাব ──
    var charsWithSpace = tt.typed.length;
    var charsNoSpace   = tt.typed.replace(/\s/g,'').length;

    // ── ভুল শব্দ বের করো (character-level) ──
    var passWordsArr  = tt.passage.trim().split(/\s+/);
    var typedWordsArr = tt.typed.trim().split(/\s+/).filter(w=>w);
    var wrongWords = [];
    passWordsArr.forEach(function(w, i) {
        if (typedWordsArr[i] !== undefined && typedWordsArr[i] !== w) {
            wrongWords.push({expected: w, typed: typedWordsArr[i]});
        }
    });

    // ── Character-level ভুল গণনা (সঠিক accuracy) ──
    var totalTyped   = tt.typed.length;
    var correctChars = 0;
    for (var ci = 0; ci < totalTyped && ci < tt.passage.length; ci++) {
        if (tt.typed[ci] === tt.passage[ci]) correctChars++;
    }
    var wrongChars   = totalTyped - correctChars;
    var accuracy     = totalTyped > 0 ? Math.round((correctChars / totalTyped) * 100) : 0;

    // ── Word stats ──
    var totalTypedWords = typedWordsArr.length;
    var correctWords    = 0;
    passWordsArr.forEach(function(w,i){ if(typedWordsArr[i]===w) correctWords++; });
    var mistakeCount    = wrongWords.length;
    var skippedCount    = Math.max(0, passWordsArr.length - typedWordsArr.length);

    // ── WPM হিসাব (selftyping.com / standard) ──
    // Gross WPM (With Space) = সব typed chars ÷ 5 ÷ minutes (space সহ)
    var grossWPM = elapsedMin > 0 ? Math.round((charsWithSpace / 5) / elapsedMin) : 0;

    // Net WPM (With Space) = শুধু correct chars ÷ 5 ÷ minutes
    // এটাই real speed — ভুলগুলো count হবে না
    var netWPM = elapsedMin > 0 ? Math.round((correctChars / 5) / elapsedMin) : 0;

    // WPM Without Space = space বাদে সব chars ÷ 5 ÷ minutes
    var wpmNoSpace = elapsedMin > 0 ? Math.round((charsNoSpace / 5) / elapsedMin) : 0;

    // WPM Word-based = total typed words ÷ minutes (gross, speed measure)
    var wpmWordBased = elapsedMin > 0 ? Math.round(totalTypedWords / elapsedMin) : 0;

    // display এ "wpm" = gross WPM with space (typobd এর "WPM With Space" এর মত)
    var wpm = grossWPM;
    var elapsed = elapsedSec;

    // ── PASSED/FAILED — সঠিক লজিক ──
    // word-level accuracy = correct words / total typed words
    var wordAccuracy = totalTypedWords > 0 ? (correctWords / totalTypedWords) * 100 : 0;
    // PASSED হতে হলে:
    //   - word accuracy >= 80% (সঠিকভাবে type করা words)
    //   - net WPM >= 20 (minimum useful speed)
    var isPassed = (wordAccuracy >= 80) && (netWPM >= 20);

    var grade = accuracy >= 95 ? {g:'S',c:'#7c3aed'} : accuracy >= 85 ? {g:'A',c:'#059669'} : accuracy >= 70 ? {g:'B',c:'#2563eb'} : accuracy >= 50 ? {g:'C',c:'#d97706'} : {g:'D',c:'#dc2626'};
    var circumference = 2 * Math.PI * 42;
    var dashOffset    = circumference - (accuracy / 100 * circumference);
    var ringColor     = accuracy >= 85 ? '#10b981' : accuracy >= 60 ? '#f59e0b' : '#ef4444';

    var wrongHTML = wrongWords.length > 0 ? `
    <div class="tt-wrong-list">
        <div style="font-size:12px;font-weight:900;color:#dc2626;margin-bottom:8px;">❌ ভুল শব্দগুলো (${Math.min(wrongWords.length,20)}টি)</div>
        ${wrongWords.slice(0,20).map(w=>`<span class="tt-wrong-word" title="সঠিক: ${w.expected}">${w.typed}</span>`).join('')}
        ${wrongWords.length>20?`<div style="font-size:11px;color:#94a3b8;margin-top:6px;">আরও ${wrongWords.length-20}টি ভুল...</div>`:''}
    </div>` : `<div style="background:#f0fdf4;border-radius:12px;padding:14px;text-align:center;border:1px solid #bbf7d0;color:#166534;font-weight:800;">🎉 কোনো ভুল নেই! অসাধারণ!</div>`;

    // Duration format
    var durMins = Math.floor(elapsedSec / 60);

    document.getElementById('tt-mode-badge').innerText = 'RESULT';
    document.getElementById('tt-body').innerHTML = `
    <div style="text-align:center;margin-bottom:16px;">
        <div style="font-size:13px;font-weight:800;color:#64748b;margin-bottom:12px;">📊 ফলাফল — ${tt.title}</div>
        <div class="tt-result-ring">
            <svg width="110" height="110" viewBox="0 0 110 110">
                <circle cx="55" cy="55" r="42" fill="none" stroke="#e2e8f0" stroke-width="9"/>
                <circle cx="55" cy="55" r="42" fill="none" stroke="${ringColor}" stroke-width="9"
                    stroke-dasharray="${circumference}" stroke-dashoffset="${dashOffset}"
                    stroke-linecap="round" transform="rotate(-90 55 55)" style="transition:stroke-dashoffset 1s ease;"/>
            </svg>
            <div class="tt-result-val">
                <div style="font-size:24px;font-weight:900;color:${grade.c};">${grade.g}</div>
                <div style="font-size:13px;font-weight:900;color:#0f172a;">${accuracy}%</div>
            </div>
        </div>
    </div>

    <div class="tt-result-grid">
        <div class="tt-result-box">
            <div class="rv" style="color:#0369a1;">${grossWPM}</div>
            <div class="rl">WPM (With Space)</div>
        </div>
        <div class="tt-result-box">
            <div class="rv" style="color:#0369a1;">${wpmNoSpace}</div>
            <div class="rl">WPM (Without Space)</div>
        </div>
        <div class="tt-result-box">
            <div class="rv" style="color:#0369a1;">${wpmWordBased}</div>
            <div class="rl">WPM (Word-based)</div>
        </div>
        <div class="tt-result-box">
            <div class="rv" style="color:${wordAccuracy>=80?'#16a34a':'#dc2626'};">${accuracy}%</div>
            <div class="rl">Accuracy</div>
        </div>
        <div class="tt-result-box">
            <div class="rv" style="color:#0f172a;">${totalTypedWords}</div>
            <div class="rl">Total Typed Words</div>
        </div>
        <div class="tt-result-box">
            <div class="rv" style="color:#16a34a;">${correctWords}</div>
            <div class="rl">Correct Words</div>
        </div>
        <div class="tt-result-box">
            <div class="rv" style="color:#0f172a;">${charsWithSpace}</div>
            <div class="rl">Characters (With Space)</div>
        </div>
        <div class="tt-result-box">
            <div class="rv" style="color:#0f172a;">${charsNoSpace}</div>
            <div class="rl">Characters (Without Space)</div>
        </div>
        <div class="tt-result-box">
            <div class="rv" style="color:#d97706;font-size:20px;">${(durMins>0?String(durMins).padStart(2,'0')+':':'')+String(Math.floor(elapsedSec%60)).padStart(2,'0')}</div>
            <div class="rl">Duration</div>
        </div>
        <div class="tt-result-box">
            <div class="rv" style="font-size:18px;font-weight:900;color:${isPassed?'#16a34a':'#dc2626'};">${isPassed?'PASSED':'FAILED'}</div>
            <div class="rl">Result</div>
        </div>
    </div>

    <!-- Total Mistakes breakdown -->
    <div class="tt-wrong-list" style="margin-bottom:10px;">
        <div style="font-size:13px;font-weight:900;color:#dc2626;margin-bottom:5px;">Total Mistakes: ${mistakeCount}</div>
        <div style="font-size:12px;color:#64748b;font-weight:700;">(Mistakes: ${mistakeCount}, Skipped: ${skippedCount}, Extra: 0, Spaces: 0)</div>
    </div>

    <!-- Your Typed Text -->
    <div style="background:#f8fafc;border-radius:12px;padding:12px;margin-bottom:10px;border:1px solid #e2e8f0;">
        <div style="font-size:12px;font-weight:800;color:#64748b;margin-bottom:6px;">Your Typed Text:</div>
        <div style="font-size:13px;color:#1e293b;line-height:1.7;word-break:break-all;">${tt.typed||'(কিছু টাইপ হয়নি)'}</div>
    </div>

    ${wrongHTML}

    <div style="margin-top:14px;display:grid;gap:8px;">
        <button onclick="ttBegin(window._tt.passage, window._tt.title, window._tt.timeLimit)"
            style="width:100%;padding:13px;background:linear-gradient(135deg,#0369a1,#0c4a6e);color:white;border:none;border-radius:12px;font-size:14px;font-weight:900;cursor:pointer;">
            🔄 আবার চেষ্টা করো
        </button>
        <button onclick="renderTypingHome()"
            style="width:100%;padding:13px;background:#f1f5f9;color:#1e293b;border:none;border-radius:12px;font-size:14px;font-weight:900;cursor:pointer;">
            ← নতুন অনুচ্ছেদ বেছে নাও
        </button>
    </div>
    `;
}

function ttAlert(msg) {
    var b = document.getElementById('tt-body');
    var old = b.querySelector('.tt-alert');
    if(old) old.remove();
    var d = document.createElement('div');
    d.className='tt-alert';
    d.style.cssText='background:#fef2f2;border:1px solid #fca5a5;border-radius:10px;padding:10px 14px;color:#dc2626;font-weight:800;font-size:13px;margin-bottom:10px;';
    d.innerText='⚠️ '+msg;
    b.insertBefore(d, b.firstChild);
    setTimeout(()=>d.remove(), 3000);
}

// Firebase Typing data load — existing loadFirebaseData() এর মধ্যে যোগ হবে স্বয়ংক্রিয়ভাবে
// fullData['Typing'] populate করা হবে fixData('Typing') দিয়ে

function getChallengeProgress() {
    const today = new Date().toDateString();
    const done = parseInt(localStorage.getItem('challenge_done_' + today) || '0');
    const total = 5;
    return done >= total ? '✅ আজকের চ্যালেঞ্জ সম্পন্ন!' : `${done}/${total} সম্পন্ন`;
}

function updateChallengeBar() {
    const today = new Date().toDateString();
    const done = parseInt(localStorage.getItem('challenge_done_' + today) || '0');
    const bar = document.getElementById('challenge-progress-bar');
    if (bar) bar.style.width = Math.min(100, (done/5)*100) + '%';
}



function goTodayTopic(topic, mode) {
    mode = mode || 'study';
    const sheetKey = mode==='qbank'?'QBank':'Study';
    const allData = (fullData[sheetKey]||[]).filter(function(i){
        var t = (i.AudienceTags||i.audiencetags||'').toString();
        return isQuestionRelevant(t);
    });
    const items = allData.filter(i => (getVal(i,'sub_topic')||'') === topic);
    if(items.length === 0) { showToast('⚠️ প্রশ্ন পাওয়া যায়নি'); changeMode(mode); return; }
    quizItems = (typeof srSortItems === 'function') ? srSortItems(items) : items;
    displayLimit = items.length;
    currentMode = mode;
    updateUIMode(mode);
    document.querySelectorAll('.nav-item').forEach(b=>b.classList.remove('active-home','active-study','active-quiz','active-qbank','active-menu'));
    const navEl = document.getElementById('nav-'+mode);
    if(navEl) navEl.classList.add('active-'+mode);
    // Header title — কী পড়ছি
    const subjName = getVal(items[0],'subject')||'';
    const zoneTitle = document.getElementById('zone-title');
    if(zoneTitle) zoneTitle.innerText = topic;
    path = [subjName||topic, topic];
    const backCtrl = document.getElementById('back-and-ctrls');
    if(backCtrl){ backCtrl.classList.remove('hidden'); backCtrl.classList.add('flex'); }
    if(mode!=='study') startTimer(items.length);
    renderQuestions();
    pushAppState();
}

function startDailyChallenge() {
    const today = new Date().toDateString();
    const done = parseInt(localStorage.getItem('challenge_done_' + today) || '0');
    if (done >= 5) { showToast('🎉 আজকের চ্যালেঞ্জ শেষ!'); return; }
    // Random 5 from QBank
    const allQ = [...(fullData['QBank']||[]), ...(fullData['Quiz']||[])].filter(function(i){
        var t = (i.AudienceTags||i.audiencetags||'').toString();
        return isQuestionRelevant(t);
    });
    if (allQ.length === 0) { showToast('⚠️ ডেটা লোড হয়নি'); return; }
    const shuffled = allQ.sort(() => Math.random() - 0.5).slice(0, 5);
    quizItems = shuffled;
    displayLimit = 5;
    currentMode = 'quiz';
    localStorage.setItem('challenge_source', 'daily');
    document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active-home','active-study','active-quiz','active-qbank','active-menu'));
    document.getElementById('nav-quiz').classList.add('active-quiz');
    startTimer(5);
    pushPath('DailyChallenge');
    renderQuestions();
}

