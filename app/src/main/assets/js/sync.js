/* Smart Study — sync.js */
function startNotificationPolling() {
    if (_notifPollTimer) return;
    setTimeout(checkNotifications, 5000); // ৫ সেকেন্ড পর প্রথম check
    _notifPollTimer = setInterval(checkNotifications, 60000); // তারপর প্রতি মিনিটে
}

function stopNotificationPolling() {
    clearInterval(_notifPollTimer);
    _notifPollTimer = null;
}

async function checkNotifications() {
    if (!currentUser || !currentUser.phone || !FIREBASE_URL || FIREBASE_URL.length < 10) return;
    // phone normalize — Admin এর safePhone এর মতো করতে হবে
    var safePhone = currentUser.phone.toString().trim().replace(/[.#$\[\]\s]/g, '_');
    try {
        var res = await fetch(FIREBASE_URL + 'Notifications/' + safePhone + '.json?auth=' + SECRET_KEY);
        if (!res.ok) return;
        var data = await res.json();
        if (!data || typeof data !== 'object') return;

        var now = Date.now();
        var newOnes = [];

        Object.entries(data).forEach(function([key, notif]) {
            if (!notif || notif.read === true) return;
            // key থেকে timestamp বের করি (notif_1234567890)
            var keyTime = parseInt((key.replace('notif_','')) || '0') || 0;
            // time field থেকেও try করি
            var notifTime = keyTime > 0 ? keyTime : (new Date(notif.time || 0).getTime() || 0);
            if (notifTime > _lastNotifCheck) {
                newOnes.push(Object.assign({ _key: key }, notif));
            }
        });

        if (newOnes.length > 0) {
            _lastNotifCheck = now;
            localStorage.setItem('last_notif_check', now.toString());
            newOnes.forEach(function(n) {
                showAdminNotification(n);
                // mark as read
                fetch(FIREBASE_URL + 'Notifications/' + safePhone + '/' + n._key + '/read.json?auth=' + SECRET_KEY, {
                    method: 'PUT',
                    headers: {'Content-Type': 'application/json'},
                    body: 'true'
                }).catch(function(){});
            });
        }
    } catch(e) { /* silent fail */ }
}

function showAdminNotification(notif) {
    // In-app notification card
    var toast = document.createElement('div');
    toast.style.cssText = `
        position:fixed; top:16px; left:50%; transform:translateX(-50%) translateY(-120px);
        z-index:99999; background:linear-gradient(135deg,#4f46e5,#7c3aed);
        color:white; border-radius:20px; padding:14px 18px; max-width:320px; width:90%;
        box-shadow:0 8px 30px rgba(79,70,229,0.5); transition:transform 0.4s cubic-bezier(0.34,1.56,0.64,1);
        display:flex; align-items:flex-start; gap:12px; font-family:inherit;
    `;
    toast.innerHTML = `
        <div style="font-size:24px;flex-shrink:0;">✅</div>
        <div style="flex:1;">
            <p style="font-size:13px;font-weight:900;margin:0 0 3px;">${notif.title || 'Notification'}</p>
            <p style="font-size:11px;opacity:0.85;margin:0;line-height:1.4;">${notif.body || ''}</p>
        </div>
        <button onclick="this.parentElement.remove()" style="background:rgba(255,255,255,0.2);border:none;border-radius:50%;width:24px;height:24px;color:white;font-size:14px;cursor:pointer;flex-shrink:0;display:flex;align-items:center;justify-content:center;">×</button>
    `;
    document.body.appendChild(toast);
    // Slide in
    setTimeout(() => { toast.style.transform = 'translateX(-50%) translateY(0)'; }, 50);
    // Auto dismiss after 6s
    setTimeout(() => {
        toast.style.transform = 'translateX(-50%) translateY(-120px)';
        setTimeout(() => toast.remove(), 400);
    }, 6000);

    // Browser notification ও try করো
    if ('Notification' in window && Notification.permission === 'granted') {
        try {
            new Notification(notif.title || '✅ Smart Study', { body: notif.body || '', icon: '/icon.png' });
        } catch(e) {}
    }
}

// ── Sync XP to Firebase Users node — PATCH শুধু XP field ──
function syncXPToFirebase(phone, xp) {
    if (!phone || !FIREBASE_URL || FIREBASE_URL.length < 10) return;
    // Firebase Users array এ user-এর index খুঁজো, তারপর শুধু XP field PATCH করো
    fetch(FIREBASE_URL + 'Users.json?auth=' + SECRET_KEY)
        .then(function(r) { return r.json(); })
        .then(function(data) {
            if (!data) return;
            var keys = Object.keys(data);
            var foundKey = null;
            var normP = phone.toString().trim().replace(/^0+/,'');
            for (var i = 0; i < keys.length; i++) {
                var u = data[keys[i]];
                if (!u) continue;
                var uPhone = (u.Phone || u.phone || '').toString().trim().replace(/['\s]/g,'');
                var normU  = uPhone.replace(/^0+/,'');
                if (uPhone === phone.toString().trim() || normU === normP) {
                    foundKey = keys[i]; break;
                }
            }
            if (foundKey === null) return;
            // শুধু XP field PATCH — বাকি সব data অপরিবর্তিত থাকবে
            return fetch(FIREBASE_URL + 'Users/' + foundKey + '/XP.json?auth=' + SECRET_KEY, {
                method: 'PUT',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify(xp)
            });
        })
        .catch(function(){});
}

// ── Save profile picture to Firebase Users ──
function savePicToFirebase(picUrl) {
    if (!currentUser || !currentUser.phone) return;
    var phone = currentUser.phone.toString().trim();

    // Step 1: Find user index in Firebase
    fetch(FIREBASE_URL + 'Users.json?auth=' + SECRET_KEY)
        .then(function(r) { return r.json(); })
        .then(function(data) {
            if (!data) return Promise.reject('no data');
            var keys = Object.keys(data);
            var foundKey = null;
            for (var i = 0; i < keys.length; i++) {
                var u = data[keys[i]];
                if (!u) continue;
                var uPhone = (u.Phone || u.phone || '').toString().trim().replace(/[\s']/g,'');
                var normU  = uPhone.replace(/^0+/,'');
                var normP  = phone.replace(/^0+/,'');
                if (uPhone === phone || normU === normP) { foundKey = keys[i]; break; }
            }
            if (foundKey === null) return Promise.reject('user not found');

            // Step 2: PATCH only the Picture field in Firebase
            return fetch(FIREBASE_URL + 'Users/' + foundKey + '/Picture.json?auth=' + SECRET_KEY, {
                method: 'PUT',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify(picUrl)
            });
        })
        .then(function() {
            // Step 3: Update local state
            currentUser.picture = picUrl;
            saveCurrentUser(currentUser);
            localStorage.setItem('home_user_pic', picUrl);

            // Step 4: Save Picture URL to Sheet via GAS update_picture
            return fetch(GAS_URL, {
                method: 'POST',
                mode: 'no-cors',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({
                    type: 'update_picture',
                    phone: phone,
                    picture_url: picUrl
                })
            });
        })
        .then(function() {
            showToast('✅ ছবি সংরক্ষিত হয়েছে!');
            // Re-render home avatar
            renderView();
        })
        .catch(function(e) {
            console.log('Pic err:', e);
            showToast('❌ ছবি save ব্যর্থ: ' + e);
        });
}

// ── Phone number: strip leading zero for display normalization ──
function normalizePhone(ph) {
    return (ph || '').toString().trim().replace(/\s/g,'');
}


// ── Android back button: close result/modal screens ──


// Push state on navigation so back button works
var _origChangeMode = typeof changeMode === 'function' ? changeMode : null;
function pushHistoryState() {
    try { history.pushState({path: path.slice()}, ''); } catch(e) {}
}


// ── Custom Confirm Dialog (no native browser dialog) ──
function showConfirm(msg, onOk, onCancel) {
    var modal = document.getElementById('custom-confirm-modal');
    var msgEl = document.getElementById('custom-confirm-msg');
    var okBtn = document.getElementById('custom-confirm-ok');
    var cancelBtn = document.getElementById('custom-confirm-cancel');
    if (!modal) { if (onOk) onOk(); return; }
    msgEl.textContent = msg;
    modal.style.display = 'flex';
    var cleanup = function() { modal.style.display = 'none'; okBtn.onclick = null; cancelBtn.onclick = null; };
    okBtn.onclick = function() { cleanup(); if (onOk) onOk(); };
    cancelBtn.onclick = function() { cleanup(); if (onCancel) onCancel(); };
}





// ── Report Dialog functions ──
var _reportCallback = null;
function showReportDialog(callback) {
    _reportCallback = callback;
    var modal = document.getElementById('report-dialog-modal');
    var input = document.getElementById('report-issue-input');
    if (!modal) { var issue = ''; if(callback) callback(issue); return; }
    input.value = '';
    modal.style.display = 'flex';
    input.focus();
    history.pushState({mode:currentMode,path:[...path]},'');
}
function submitReportDialog() {
    var input = document.getElementById('report-issue-input');
    var val   = (input ? input.value : '').trim();
    if (!val) { showToast('⚠️ সমস্যার বিবরণ লিখুন'); return; }
    var modal = document.getElementById('report-dialog-modal');
    if (modal) modal.style.display = 'none';
    if (_reportCallback) { _reportCallback(val); _reportCallback = null; }
}


// ══════════════════════════════════════════════════════════
// REVIEW POPUP — ভুল প্রশ্ন Bottom Sheet
// ══════════════════════════════════════════════════════════

