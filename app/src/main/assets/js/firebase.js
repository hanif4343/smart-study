/* Smart Study — firebase.js */

// ── Offline cache helpers ──────────────────────────────────
function saveDataOffline(data) {
    try { localStorage.setItem('ss_offline_cache', JSON.stringify(data)); } catch(e) {}
}
function loadDataOffline() {
    try { return JSON.parse(localStorage.getItem('ss_offline_cache') || 'null'); } catch(e) { return null; }
}
function updateOfflineBanner() {
    var b = document.getElementById('offline-banner');
    if (!b) return;
    if (!navigator.onLine) { b.classList.remove('hidden'); }
    else { b.classList.add('hidden'); }
}

// ── CACHE-FIRST Firebase Loader ────────────────────────────
// Step 1: localStorage cache থেকে তাৎক্ষণিক UI দেখাও
// Step 2: Background এ Firebase থেকে fresh data নাও, silently update করো
function loadFirebaseData() {
    updateOfflineBanner();

    // ── Step 1: Cache-first (instant) ──
    var cached = loadDataOffline();
    if (cached) {
        _applyFirebaseData(cached, false); // UI তাৎক্ষণিক দেখাও
    }

    if (!navigator.onLine) return; // offline — cache দিয়েই চলো

    // ── Step 2: Background fetch (silent refresh) ──
    var dbDot = document.getElementById('db-loading-dot');
    if (dbDot && !cached) dbDot.style.display = 'block'; // first load এ দেখাও

    var _fbUrl = FIREBASE_URL + '.json?auth=' + SECRET_KEY + '&_t=' + Date.now();
    fetch(_fbUrl, { cache: 'no-cache' })
        .then(function(r) {
            if (!r.ok) throw new Error('HTTP ' + r.status);
            return r.json();
        })
        .then(function(data) {
            if (!data) throw new Error('No data');
            if (dbDot) dbDot.style.display = 'none';
            _applyFirebaseData(data, true); // fresh data apply + save cache
        })
        .catch(function(err) {
            if (dbDot) dbDot.style.display = 'none';
            updateOfflineBanner();
        });
}

function _applyFirebaseData(data, shouldCache) {
    function fixData(folder) {
        if (!data[folder]) return [];
        return Array.isArray(data[folder])
            ? data[folder]
            : Object.values(data[folder]);
    }

    fullData['Study']  = fixData('Study');
    fullData['Quiz']   = fixData('Quiz');
    fullData['QBank']  = fixData('QBank');
    fullData['Notice'] = fixData('Notice');
    fullData['Users']  = fixData('Users');
    fullData['Typing'] = fixData('Typing');

    // User sync
    if (currentUser && currentUser.phone) {
        var fbPhone = currentUser.phone.toString().trim();
        var freshU = (fullData['Users']||[]).find(function(u) {
            return (u.Phone||u.phone||'').toString().trim() === fbPhone;
        });
        if (freshU) {
            currentUser.name    = freshU.Name    || freshU.name    || currentUser.name;
            currentUser.role    = freshU.Role    || freshU.role    || currentUser.role;
            currentUser.status  = freshU.Status  || freshU.status  || currentUser.status;
            currentUser.picture = freshU.Picture || freshU.picture || currentUser.picture;
            var fireXP = parseInt(freshU.XP || freshU.xp || 0) || 0;
            currentUser.xp = fireXP;
            saveCurrentUser(currentUser);
            localStorage.setItem('home_user_name', currentUser.name || '');
            if (currentUser.picture) localStorage.setItem('home_user_pic', currentUser.picture);
            var _xpKey = 'user_xp_' + currentUser.phone;
            var localXP = parseInt(localStorage.getItem(_xpKey) || '0');
            if (fireXP > localXP) localStorage.setItem(_xpKey, fireXP);
        }
    }

    // Cache save (only for fresh network data)
    if (shouldCache) {
        saveDataOffline({
            Study: fullData['Study'],
            Quiz:  fullData['Quiz'],
            QBank: fullData['QBank'],
            Notice: fullData['Notice'],
            Typing: fullData['Typing']
        });
    }

    // UI refresh
    var mv = document.getElementById('main-view');
    if (mv) {
        if (currentMode === 'home' && typeof renderHome === 'function') {
            renderHome(mv);
        } else if (typeof renderView === 'function') {
            renderView();
        }
    }

    // Notice (only on fresh data)
    if (shouldCache && fullData['Notice'].length > 0) {
        var lastN = fullData['Notice'][fullData['Notice'].length - 1];
        var msg   = getVal(lastN, 'Message');
        var title = getVal(lastN, 'Title');
        var date  = getVal(lastN, 'Date');
        var shown = localStorage.getItem('last_notice');
        if (msg && msg !== shown) {
            document.getElementById('n-title').innerText   = title || 'গুরুত্বপূর্ণ নোটিশ';
            document.getElementById('n-message').innerText = msg;
            document.getElementById('n-date').innerText    = date || '';
            document.getElementById('notice-overlay').classList.remove('hidden');
            localStorage.setItem('last_notice', msg);
        }
    }
}

function closeNotice() {
    document.getElementById('notice-overlay').classList.add('hidden');
}

// ── Navigation helpers ─────────────────────────────────────
function pushAppState() {
    if (window.history.length <= 1) {
        window.history.replaceState({mode:'home', path:[], _base:true}, '');
    }
    window.history.pushState({mode: currentMode, path: [...path]}, '');
}

function pushPath(p) {
    path.push(p);
    pushAppState();
    var backCtrl = document.getElementById('back-and-ctrls');
    if (backCtrl) {
        backCtrl.classList.remove('hidden');
        backCtrl.classList.add('flex');
    }
    document.getElementById('reading-progress-bar').classList.add('hidden');
    var badge = document.getElementById('q-counter-badge');
    if (badge) badge.style.display = 'none';
    renderView();
}

function handleBack() { window.history.back(); }

function handleBackPress() {
    var overlays = document.querySelectorAll(
        '.fixed.inset-0:not(.hidden), [id$="-modal"]:not([style*="display:none"]):not([style*="display: none"]), #reels-fc-modal:not([style*="display:none"])'
    );
    for (var i = 0; i < overlays.length; i++) {
        var el = overlays[i];
        if (el.offsetParent !== null || el.style.display === 'flex' || el.style.display === 'block') {
            var closeBtn = el.querySelector('button[onclick*="close"], button[onclick*="Close"], .modal-close');
            if (closeBtn) { closeBtn.click(); return true; }
            el.style.display = 'none';
            return true;
        }
    }
    var auth = document.getElementById('auth-screen');
    if (auth && auth.style.display !== 'none' && auth.style.display !== '') return false;
    if (path && path.length > 0) { popPath(); return true; }
    if (currentMode !== 'home') { changeMode('home'); return true; }
    return false;
}

function popPath() {
    if (path.length > 0) path.pop();
    pushAppState();
    if (path.length === 0) {
        var backCtrl = document.getElementById('back-and-ctrls');
        if (backCtrl) {
            backCtrl.classList.add('hidden');
            backCtrl.classList.remove('flex');
        }
        stopTimer();
    }
    renderView();
}

function applyAdminVisibility() {
    var isAdmin = currentUser && currentUser.role && currentUser.role.toLowerCase() === 'admin';
    var aiBtn = document.getElementById('ai-copy-btn');
    if (aiBtn) aiBtn.style.display = isAdmin ? '' : 'none';
    var styleId = 'admin-style-override';
    var existing = document.getElementById(styleId);
    if (existing) existing.remove();
    if (isAdmin) {
        var st = document.createElement('style');
        st.id = styleId;
        st.textContent = '.copy-id-btn { display:inline !important; }';
        document.head.appendChild(st);
    }
}

function copyForAI() {
    const aiCommand = " নিচের টেক্সটগুলোকে উদাহরন এর মত করে দাও। সিরিয়াল নাম্বার লাগবেনা, অপশনে ক খ গ ঘ দরকার নাই।  ফরম্যাট হবে: প্রশ্ন;অপশনগুলো;উত্তর। যেন কুইজের মত হয়। অপ্রাসাঙ্গিক টেক্সট এড়িয়ে যাবে উদাহরন এর মত করে দিবে প্লিজ, ১৩তম জাতীয় সংসদের বিরোধীদলীয় প্রধান হুইপ কে?; শফিকুর রহমান; নাহিদ ইসলাম; কায়সার কামাল; হাফিজ উদ্দিন আহমেদ; নাহিদ ইসলাম    আমাদের জাতীয় কবি কে?;জসিমউদ্দিন;রবীন্দ্রনাথ ঠাকুর;জীবনানন্দ দাশ; কাজী নজরুল ইসলাম প্রশ্ন; অপশনগুলো;উত্তর অপশনে উততরের পজিশন বারবার পরিবতর্ন করে দিও যেন আনতাজ করা না যা্য়,যেহেতু এটা লিখিত প্রশ্ন একই প্রশ্নের মধ্যে একাধিক প্রশ্ন আছে সেটাও mcq আকারে করে দিবে। ।\n\n";
    const tempInput = document.createElement("textarea");
    tempInput.value = aiCommand + document.body.innerText;
    document.body.appendChild(tempInput);
    tempInput.select();
    document.execCommand("copy");
    document.body.removeChild(tempInput);
}

function changeMode(m, shouldPush = true) {
    if(currentMode === m && path.length === 0 && shouldPush && m !== 'home') return;
    window._reviewMode = false;
    document.getElementById('sticky-result').classList.add('hidden');
    document.getElementById('reading-progress-bar').classList.add('hidden');
    document.getElementById('q-counter-badge').style.display = 'none';
    if (window._scrollListener) {
        window.removeEventListener('scroll', window._scrollListener);
        window._scrollListener = null;
    }
    currentMode = m;
    if(m !== 'home') localStorage.setItem('last_mode', m);
    updateUIMode(m);
    path = [];
    stopTimer();
    selectedSubTopics = [];
    document.getElementById('back-and-ctrls').classList.add('hidden');
    if(shouldPush) {
        if (window.history.length <= 1 || m === 'home') {
            window.history.replaceState({mode:'home', path:[], _base:true}, '');
        }
        if (m !== 'home') {
            window.history.pushState({mode: m, path:[]}, '');
        }
    }
    renderView();
    if (m === 'menu' && localStorage.getItem('exam_date')) {
        setTimeout(() => startCountdownTick(), 400);
    }
}
