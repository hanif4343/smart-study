/* Smart Study — firebase.js */
function loadFirebaseData() {
    updateOfflineBanner();
    if (!navigator.onLine) {
        // সত্যিই offline — cache দিয়ে চলো
        console.log('📴 Offline — using cached data');
        return;
    }

    const dbDot = document.getElementById('db-loading-dot');
    if (dbDot) dbDot.style.display = 'block';

    // Online হলে সবসময় fresh data — SW/browser cache bypass
    var _fbUrl = FIREBASE_URL + '.json?auth=' + SECRET_KEY + '&_t=' + Date.now();
    fetch(_fbUrl, { cache: 'no-cache' })
        .then(function(response) {
            if (!response.ok) throw new Error('HTTP ' + response.status);
            return response.json();
        })
        .then(function(data) {
            if (!data) throw new Error('No data');

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
            if (currentUser && currentUser.phone) {
                var fbPhone = currentUser.phone.toString().trim();
                var freshU = (fullData['Users']||[]).find(function(u){ return (u.Phone||u.phone||'').toString().trim()===fbPhone; });
                if (freshU) {
                    currentUser.name    = freshU.Name    || freshU.name    || currentUser.name;
                    currentUser.role    = freshU.Role    || freshU.role    || currentUser.role;
                    currentUser.status  = freshU.Status  || freshU.status  || currentUser.status;
                    currentUser.picture = freshU.Picture || freshU.picture || currentUser.picture;
                    var fireXP2 = parseInt(freshU.XP || freshU.xp || 0) || 0;
                    currentUser.xp = fireXP2;
                    saveCurrentUser(currentUser);
                    localStorage.setItem('home_user_name', currentUser.name || '');
                    if (currentUser.picture) localStorage.setItem('home_user_pic', currentUser.picture);
                    // Sync Firebase XP to per-user localStorage (use max)
                    var _xpKey2 = 'user_xp_' + currentUser.phone;
                    var localXP2 = parseInt(localStorage.getItem(_xpKey2) || '0');
                    if (fireXP2 > localXP2) localStorage.setItem(_xpKey2, fireXP2);
                }
            }

            // Cache এ save
            saveDataOffline({
                Study: fullData['Study'],
                Quiz:  fullData['Quiz'],
                QBank: fullData['QBank'],
                Notice: fullData['Notice'],
                Typing: fullData['Typing']
            });

            if (dbDot) dbDot.style.display = 'none';
            console.log('✅ Firebase loaded:', fullData['Study'].length, 'Study items');

            // UI refresh — যেকোনো mode এ
            const mv = document.getElementById('main-view');
            if (mv) {
                if (currentMode === 'home' && typeof renderHome === 'function') {
                    renderHome(mv);
                } else if (typeof renderView === 'function') {
                    renderView();
                }
            }

            // Notice check
            if (fullData['Notice'].length > 0) {
                const lastN = fullData['Notice'][fullData['Notice'].length - 1];
                const msg   = getVal(lastN, 'Message');
                const title = getVal(lastN, 'Title');
                const date  = getVal(lastN, 'Date');
                const shown = localStorage.getItem('last_notice');
                if (msg && msg !== shown) {
                    document.getElementById('n-title').innerText   = title || 'গুরুত্বপূর্ণ নোটিশ';
                    document.getElementById('n-message').innerText = msg;
                    document.getElementById('n-date').innerText    = date || '';
                    document.getElementById('notice-overlay').classList.remove('hidden');
                    localStorage.setItem('last_notice', msg);
                }
            }
        })
        .catch(function(err) {
            console.warn('Firebase fetch failed:', err);
            if (dbDot) dbDot.style.display = 'none';
            updateOfflineBanner();
            // Cache already loaded above — app still works
        });
}

                function closeNotice() { document.getElementById('notice-overlay').classList.add('hidden'); }
        function pushAppState() {
    // Ensure base home state exists so back never hits empty history
    if (window.history.length <= 1) {
        window.history.replaceState({mode:'home', path:[], _base:true}, '');
    }
    window.history.pushState({mode: currentMode, path: [...path]}, '');
}

function pushPath(p) {
    path.push(p);
    pushAppState();
    // back button দেখাও
    const backCtrl = document.getElementById('back-and-ctrls');
    if (backCtrl) {
        backCtrl.classList.remove('hidden');
        backCtrl.classList.add('flex');
    }
    // progress bar এবং badge hide
    document.getElementById('reading-progress-bar').classList.add('hidden');
    const badge = document.getElementById('q-counter-badge');
    if (badge) badge.style.display = 'none';
    renderView();
}

function handleBack() {
    window.history.back();
}

// Java onBackPressed থেকে call হয়
function handleBackPress() {
    // 1. কোনো modal/overlay খোলা আছে?
    var overlays = document.querySelectorAll(
        '.fixed.inset-0:not(.hidden), [id$="-modal"]:not([style*="display:none"]):not([style*="display: none"]), #reels-fc-modal:not([style*="display:none"])'
    );
    for (var i = 0; i < overlays.length; i++) {
        var el = overlays[i];
        if (el.offsetParent !== null || el.style.display === 'flex' || el.style.display === 'block') {
            // modal বন্ধ করো
            var closeBtn = el.querySelector('button[onclick*="close"], button[onclick*="Close"], .modal-close');
            if (closeBtn) { closeBtn.click(); return true; }
            el.style.display = 'none';
            return true;
        }
    }
    // 2. Auth screen খোলা?
    var auth = document.getElementById('auth-screen');
    if (auth && auth.style.display !== 'none' && auth.style.display !== '') {
        return false; // auth screen এ back = exit
    }
    // 3. Path এ কিছু আছে (subject/subtopic ভেতরে)?
    if (path && path.length > 0) {
        popPath();
        return true;
    }
    // 4. Home এ নেই?
    if (currentMode !== 'home') {
        changeMode('home');
        return true;
    }
    // 5. Home এ আছি — app minimize করবে (Java side moveTaskToBack করবে)
    return false;
}

function popPath() {
    if (path.length > 0) {
        path.pop();
        pushAppState();
    }
    if (path.length === 0) {
        const backCtrl = document.getElementById('back-and-ctrls');
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
    // AI Copy button
    var aiBtn = document.getElementById('ai-copy-btn');
    if (aiBtn) aiBtn.style.display = isAdmin ? '' : 'none';
    // copy-id-btn elements (rendered dynamically, so use CSS class injection)
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
    // আপনার কমান্ড
    const aiCommand = " নিচের টেক্সটগুলোকে উদাহরন এর মত করে দাও। সিরিয়াল নাম্বার লাগবেনা, অপশনে ক খ গ ঘ দরকার নাই।  ফরম্যাট হবে: প্রশ্ন;অপশনগুলো;উত্তর। যেন কুইজের মত হয়। অপ্রাসাঙ্গিক টেক্সট এড়িয়ে যাবে উদাহরন এর মত করে দিবে প্লিজ, ১৩তম জাতীয় সংসদের বিরোধীদলীয় প্রধান হুইপ কে?; শফিকুর রহমান; নাহিদ ইসলাম; কায়সার কামাল; হাফিজ উদ্দিন আহমেদ; নাহিদ ইসলাম    আমাদের জাতীয় কবি কে?;জসিমউদ্দিন;রবীন্দ্রনাথ ঠাকুর;জীবনানন্দ দাশ; কাজী নজরুল ইসলাম প্রশ্ন; অপশনগুলো;উত্তর অপশনে উততরের পজিশন বারবার পরিবতর্ন করে দিও যেন আনতাজ করা না যা্য়,যেহেতু এটা লিখিত প্রশ্ন একই প্রশ্নের মধ্যে একাধিক প্রশ্ন আছে সেটাও mcq আকারে করে দিবে। ।\n\n";
    // পুরো পেজের সব টেক্সট একসাথে ধরা
    const screenText = document.body.innerText;

    // কমান্ড + পেজের সব টেক্সট
    const finalData = aiCommand + screenText;

    // কপি করার সবচেয়ে সহজ ও কার্যকর পদ্ধতি
    const tempInput = document.createElement("textarea");
    tempInput.value = finalData;
    document.body.appendChild(tempInput);
    tempInput.select();
    document.execCommand("copy");
    document.body.removeChild(tempInput);

    
}





        // updateUIMode — see themed version below

        function changeMode(m, shouldPush = true) {
    if(currentMode === m && path.length === 0 && shouldPush && m !== 'home') return;
    window._reviewMode = false;
    document.getElementById('sticky-result').classList.add('hidden');
    document.getElementById('reading-progress-bar').classList.add('hidden');
    document.getElementById('q-counter-badge').style.display = 'none';
    if (window._scrollListener) { window.removeEventListener('scroll', window._scrollListener); window._scrollListener = null; }
    currentMode = m;
    if(m !== 'home') localStorage.setItem('last_mode', m);
    updateUIMode(m); path = []; stopTimer(); selectedSubTopics = [];
    document.getElementById('back-and-ctrls').classList.add('hidden');
    if(shouldPush) {
        // Always push at least 2 states: home base + current
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


        // ====================================================
// 🏠 HOME SCREEN
// ====================================================
