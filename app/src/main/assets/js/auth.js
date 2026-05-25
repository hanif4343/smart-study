/* Smart Study — auth.js */
function showAuthScreen(tab) {
    var s = document.getElementById('auth-screen');
    if (s) { s.style.display = 'flex'; s.classList.remove('hidden'); }
    switchAuthTab(tab || 'login');
}

function hideAuthScreen() {
    var s = document.getElementById('auth-screen');
    if (s) { s.style.display = 'none'; s.classList.add('hidden'); }
}

function switchAuthTab(tab) {
    var lf  = document.getElementById('auth-login-form');
    var sf  = document.getElementById('auth-signup-form');
    var tl  = document.getElementById('tab-login');
    var ts  = document.getElementById('tab-signup');
    if (!lf || !sf) return;
    if (tab === 'login') {
        lf.style.display = 'block'; sf.style.display = 'none';
        if (tl) { tl.style.background = 'white'; tl.style.color = '#4f46e5'; tl.style.boxShadow = '0 2px 8px rgba(0,0,0,0.15)'; }
        if (ts) { ts.style.background = 'transparent'; ts.style.color = 'rgba(255,255,255,0.75)'; ts.style.boxShadow = 'none'; }
    } else {
        lf.style.display = 'none'; sf.style.display = 'block';
        if (ts) { ts.style.background = 'white'; ts.style.color = '#4f46e5'; ts.style.boxShadow = '0 2px 8px rgba(0,0,0,0.15)'; }
        if (tl) { tl.style.background = 'transparent'; tl.style.color = 'rgba(255,255,255,0.75)'; tl.style.boxShadow = 'none'; }
    }
}

function togglePassView(id) {
    var inp = document.getElementById(id);
    if (inp) inp.type = inp.type === 'password' ? 'text' : 'password';
}

function showAuthLoading(show) {
    var el = document.getElementById('auth-loading');
    if (!el) return;
    el.style.display = show ? 'flex' : 'none';
}

function showAuthMsg(formType, msg) {
    var el = document.getElementById(formType + '-error');
    if (!el) return;
    el.textContent = msg;
    el.style.display = 'block';
    clearTimeout(el._t);
    el._t = setTimeout(function() { el.style.display = 'none'; }, 5000);
}

// ── SHA-256 — Pure JS, WebView safe, crypto.subtle নির্ভর করে না ──
function sha256(message) {
    function rightRotate(value, amount) { return (value >>> amount) | (value << (32 - amount)); }
    var mathPow = Math.pow;
    var maxWord = mathPow(2, 32);
    var i, j, result = '';
    var words = [];
    var asciiBitLength = message.length * 8;
    var hash = [], k = [];
    var primeCounter = 0;
    var isComposite = {};
    for (var candidate = 2; primeCounter < 64; candidate++) {
        if (!isComposite[candidate]) {
            for (i = 0; i * candidate < 64; i++) isComposite[i * candidate] = true;
            hash[primeCounter] = (mathPow(candidate, 0.5) * maxWord) | 0;
            k[primeCounter++] = (mathPow(candidate, 1 / 3) * maxWord) | 0;
        }
    }
    message += '\x80';
    while (message.length % 64 - 56) message += '\x00';
    for (i = 0; i < message.length; i++) {
        j = message.charCodeAt(i);
        if (j >> 8) return '';
        words[i >> 2] |= j << ((3 - i) % 4) * 8;
    }
    words[words.length] = ((asciiBitLength / maxWord) | 0);
    words[words.length] = (asciiBitLength | 0);
    for (j = 0; j < words.length;) {
        var w = words.slice(j, j += 16);
        var oldHash = hash.slice(0);
        for (i = 0; i < 64; i++) {
            var i2 = i + j - 16;
            var w15 = w[i - 15], w2 = w[i - 2];
            var a = hash[0], e = hash[4];
            var temp1 = hash[7]
                + (rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25))
                + ((e & hash[5]) ^ (~e & hash[6]))
                + k[i]
                + (w[i] = (i < 16) ? w[i] : (
                    w[i - 16]
                    + (rightRotate(w15, 7) ^ rightRotate(w15, 18) ^ (w15 >>> 3))
                    + w[i - 7]
                    + (rightRotate(w2, 17) ^ rightRotate(w2, 19) ^ (w2 >>> 10))
                ) | 0);
            var temp2 = (rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22))
                + ((a & hash[1]) ^ (a & hash[2]) ^ (hash[1] & hash[2]));
            hash = [(temp1 + temp2) | 0].concat(hash);
            hash[4] = (hash[4] + temp1) | 0;
            hash.length = 8;
        }
        for (i = 0; i < 8; i++) hash[i] = (hash[i] + oldHash[i]) | 0;
    }
    for (i = 0; i < 8; i++) {
        for (j = 3; j + 1; j--) {
            var b = (hash[i] >> (j * 8)) & 255;
            result += ((b < 16) ? '0' : '') + b.toString(16);
        }
    }
    return result;
}

// sha256 কে async wrapper দিয়ে রাখো যাতে existing code না ভাঙে
async function sha256Async(message) { return sha256(message); }

async function doLogin() {
    var phone = (document.getElementById('login-phone') || {value:''}).value.trim().replace(/\s/g, '');
    var pass  = (document.getElementById('login-pass')  || {value:''}).value.trim();
    if (!phone || !pass) { showAuthMsg('login', '📱 ফোন ও পাসওয়ার্ড দিন'); return; }

    var hashedPass = sha256(pass);
    // GAS hash এর সাথেও compare করার জন্য node crypto style hash
    // login এ দুটোই try করা হবে: JS hash এবং plain text (পুরনো accounts)

    showAuthLoading(true);
    // Firebase থেকে সরাসরি Users verify করো — GAS ছাড়া
    fetch(FIREBASE_URL + 'Users.json?auth=' + SECRET_KEY)
        .then(function(r) { return r.json(); })
        .then(function(data) {
            showAuthLoading(false);
            if (!data) { showAuthMsg('login', '❌ সংযোগ সমস্যা। আবার চেষ্টা করুন।'); return; }
            var users = Array.isArray(data) ? data : Object.values(data);
            var normPhone = phone.replace(/^0+/, '');
            var matched = users.find(function(u) {
                if (!u) return false;
                var uPhone = (u.Phone || u.phone || '').toString().trim().replace(/[\s']/g, '');
                var uNorm  = uPhone.replace(/^0+/, '');
                var phoneMatch = uPhone === phone || uNorm === normPhone;
                if (!phoneMatch) return false;
                var uPass = (u.Password || u.password || '').toString().trim();
                return uPass === pass || uPass === sha256(pass);
            });
            if (!matched) { showAuthMsg('login', '❌ ফোন বা পাসওয়ার্ড ভুল!'); return; }
            var status = (matched.Status || matched.status || 'active').toLowerCase();
            if (status === 'inactive') {
                showAuthMsg('login', '⏳ অ্যাকাউন্ট এখনো Activate হয়নি। Admin-এর সাথে যোগাযোগ করুন।');
                return;
            }
            var user = {
                name:       matched.Name       || matched.name       || '',
                phone:      (matched.Phone || matched.phone || phone).toString().replace(/^'+/, '').trim(),
                email:      matched.Email       || matched.email       || '',
                role:       matched.Role        || matched.role        || 'User',
                status:     matched.Status      || matched.status      || 'Active',
                picture:    matched.Picture     || matched.picture     || '',
                xp:         parseInt(matched.XP || matched.xp || 0) || 0,
                userType:   matched.UserType    || matched.userType    || 'General',
                classLevel: matched.ClassLevel  || matched.classLevel  || ''
            };
            saveCurrentUser(user);
            localStorage.setItem('home_user_name', user.name || '');
            if (user.picture) localStorage.setItem('home_user_pic', user.picture);
            setTimeout(initAdminViewBar, 500); // Admin view bar show/hide
            // Firebase Summary prefetch — মোট সঠিক cache warm
            (function() {
                try {
                    var sp = user.phone.toString().trim().replace(/[.#$\[\]\s]/g,'_');
                    fetch(FIREBASE_URL + 'Analytics/Summary/' + sp + '.json?auth=' + SECRET_KEY)
                        .then(function(r){ return r.json(); })
                        .then(function(s){ if(s && s.totalCorrect>=0) localStorage.setItem('fb_summary_cache', JSON.stringify(s)); })
                        .catch(function(){});
                } catch(e){}
            })();
            // Load per-user XP from Firebase into localStorage
            var _xpKey = 'user_xp_' + user.phone;
            var localXP = parseInt(localStorage.getItem(_xpKey) || '0');
            var fireXP  = user.xp || 0;
            localStorage.setItem(_xpKey, Math.max(localXP, fireXP));
            hideAuthScreen();
            // Admin কে notify করো — fire and forget
            try {
                fetch(GAS_URL + '?action=adminNotify&event=login'
                    + '&name=' + encodeURIComponent(user.name||"")
                    + '&phone=' + encodeURIComponent(user.phone||"")
                ).catch(function(){});
            } catch(e2) {}
            // FCM token Firebase এ save করো + topic subscribe
            setTimeout(postLoginFCMSetup, 1000);
            try { initApp(); } catch(e) { console.error('initApp after login:', e); }
            setTimeout(applyAdminVisibility, 200);
        })
        .catch(function() {
            showAuthLoading(false);
            showAuthMsg('login', '❌ সংযোগ সমস্যা। ইন্টারনেট চেক করুন।');
        });
}

// ── Signup Photo Preview ──
function previewSignupPhoto(input) {
    if (!input.files || !input.files[0]) return;
    var file = input.files[0];
    var reader = new FileReader();
    reader.onload = function(e) {
        var img = document.getElementById('signup-photo-img');
        var icon = document.getElementById('signup-photo-icon');
        if (img && icon) {
            img.src = e.target.result;
            img.style.display = 'block';
            icon.style.display = 'none';
        }
        document.getElementById('signup-upload-status').textContent = '✅ ছবি নির্বাচন হয়েছে';
    };
    reader.readAsDataURL(file);
}

// ── imgbb Upload ──
async function uploadToImgbb(file) {
    var apiKey = typeof IMGBB_API_KEY !== 'undefined' ? IMGBB_API_KEY : '';
    if (!apiKey) {
        // GAS থেকে key আনো
        try {
            var r = await fetch(GAS_URL + '?action=getImgbbKey');
            var d = await r.json();
            apiKey = d.key || '';
        } catch(e) {}
    }
    if (!apiKey || !file) return '';
    return new Promise(function(resolve) {
        var reader = new FileReader();
        reader.onload = function(e) {
            var base64 = e.target.result.split(',')[1];
            var formData = new FormData();
            formData.append('image', base64);
            fetch('https://api.imgbb.com/1/upload?key=' + apiKey, {
                method: 'POST',
                body: formData
            })
            .then(function(r) { return r.json(); })
            .then(function(data) {
                resolve(data && data.data && data.data.url ? data.data.url : '');
            })
            .catch(function() { resolve(''); });
        };
        reader.readAsDataURL(file);
    });
}

async function doSignup() {
    var name      = (document.getElementById('signup-name')  || {value:''}).value.trim();
    var phone     = (document.getElementById('signup-phone') || {value:''}).value.trim().replace(/\s/g, '');
    var email     = (document.getElementById('signup-email') || {value:''}).value.trim();
    var pass      = (document.getElementById('signup-pass')  || {value:''}).value.trim();
    var userType  = window._selectedUserType || 'General';
    var classLevel= (document.getElementById('signup-class') || {value:''}).value.trim();

    if (!name)              { showAuthMsg('signup', '👤 নাম লিখুন'); return; }
    if (phone.length < 10)  { showAuthMsg('signup', '📱 সঠিক ফোন নম্বর দিন'); return; }
    if (pass.length < 4)    { showAuthMsg('signup', '🔒 কমপক্ষে ৪ অক্ষরের পাসওয়ার্ড দিন'); return; }
    if (!userType)          { showAuthMsg('signup', '📋 ক্যাটাগরি সিলেক্ট করুন'); return; }
    if (userType === 'Student' && !classLevel) { showAuthMsg('signup', '🎒 শ্রেণি / বর্ষ সিলেক্ট করুন'); return; }
    if (userType === 'Job' && !classLevel) { showAuthMsg('signup', '🏢 চাকরির গ্রেড সিলেক্ট করুন'); return; }

    showAuthLoading(true);
    document.getElementById('signup-upload-status').textContent = '';

    // Photo upload — file থাকলে imgbb তে upload করো
    var pictureUrl = '';
    var photoInput = document.getElementById('signup-photo-input');
    if (photoInput && photoInput.files && photoInput.files[0]) {
        document.getElementById('signup-upload-status').textContent = '⏳ ছবি upload হচ্ছে...';
        pictureUrl = await uploadToImgbb(photoInput.files[0]);
        document.getElementById('signup-upload-status').textContent = pictureUrl ? '✅ ছবি upload সফল' : '⚠️ ছবি upload ব্যর্থ';
    }

    // Submit button loading state
    var submitBtn = document.querySelector('#auth-signup-form button[onclick="doSignup()"]');
    if (submitBtn) { submitBtn.textContent = '⏳ তৈরি হচ্ছে...'; submitBtn.disabled = true; }

    fetch(GAS_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            targetTab: 'Users',
            name: name,
            phone: "'" + phone,
            email: email,
            password: pass,
            type: 'Student',
            userType: userType,
            classLevel: classLevel || '',
            picture: pictureUrl,
            timestamp: new Date().toLocaleString('en-BD')
        })
    }).then(function(r) { return r.json(); })
    .then(function(res) {
        showAuthLoading(false);
        if (submitBtn) { submitBtn.textContent = 'অ্যাকাউন্ট তৈরি করুন 🚀'; submitBtn.disabled = false; }

        if (res && res.result === 'duplicate') {
            showAuthMsg('signup', '⚠️ এই ফোন নম্বর দিয়ে আগেই অ্যাকাউন্ট আছে!');
            return;
        }
        if (res && res.result !== 'success') {
            showAuthMsg('signup', '❌ সমস্যা হয়েছে: ' + (res.error || 'আবার চেষ্টা করুন'));
            return;
        }

        // ✅ Success
        // Admin কে notify করো — fire and forget
        try {
            fetch(GAS_URL + '?action=adminNotify&event=signup'
                + '&name=' + encodeURIComponent(name)
                + '&phone=' + encodeURIComponent(phone)
                + '&userType=' + encodeURIComponent(userType)
            ).catch(function(){});
        } catch(e2) {}

        document.getElementById('signup-name').value  = '';
        document.getElementById('signup-phone').value = '';
        document.getElementById('signup-email').value = '';
        document.getElementById('signup-pass').value  = '';
        var pi = document.getElementById('signup-photo-input'); if(pi) pi.value = '';
        var img = document.getElementById('signup-photo-img'); if(img){img.src='';img.style.display='none';}
        var icon = document.getElementById('signup-photo-icon'); if(icon) icon.style.display='block';
        document.getElementById('signup-upload-status').textContent = '';
        if (document.getElementById('signup-class')) document.getElementById('signup-class').value = '';
        window._selectedUserType = null;
        document.querySelectorAll('[id^="utype-"]').forEach(b => {
            b.style.background = 'rgba(255,255,255,0.1)';
            b.style.borderColor = 'rgba(255,255,255,0.3)';
        });
        if (document.getElementById('class-level-section')) document.getElementById('class-level-section').style.display = 'none';

        // Success popup দেখাও তারপর login এ যাও
        showAuthMsg('signup', '✅ অ্যাকাউন্ট তৈরি সফল! এখনই লগইন করুন।');
        setTimeout(function() { switchAuthTab('login'); }, 1800);

    }).catch(function() {
        showAuthLoading(false);
        if (submitBtn) { submitBtn.textContent = 'অ্যাকাউন্ট তৈরি করুন 🚀'; submitBtn.disabled = false; }
        showAuthMsg('signup', '❌ সংযোগ সমস্যা। আবার চেষ্টা করুন।');
    });
}

function doLogout() {
    showConfirm('লগআউট করবেন?', function() {
        clearCurrentUser();
        localStorage.removeItem('home_user_name');
        localStorage.removeItem('home_user_pic');
        try {
            var s = document.getElementById('auth-screen');
            if (s) { s.style.display = 'flex'; s.classList.remove('hidden'); }
            switchAuthTab('login');
        } catch(e) { location.reload(); }
    });
}
// ── Google Sign-in ──
function googleSignIn() {
    if (typeof AndroidBridge !== 'undefined') {
        AndroidBridge.startGoogleSignIn();
    } else {
        showAuthMsg('login', '❌ Google Sign-in শুধু App-এ কাজ করে');
    }
}

function onGoogleSignInResult(success, idToken, email, name, photoUrl) {
    if (!success) {
        showAuthMsg('login', '❌ Google Sign-in বাতিল হয়েছে');
        return;
    }
    showAuthLoading(true);

    // Firebase থেকে সরাসরি email দিয়ে user খোঁজো
    fetch(FIREBASE_URL + 'Users.json?auth=' + SECRET_KEY)
        .then(function(r) { return r.json(); })
        .then(function(data) {
            showAuthLoading(false);
            if (!data) { showAuthMsg('login', '❌ সংযোগ সমস্যা। আবার চেষ্টা করুন।'); return; }
            var users = Array.isArray(data) ? data : Object.values(data);
            var normEmail = email.toString().trim().toLowerCase();

            // Email দিয়ে match করো
            var matched = users.find(function(u) {
                if (!u) return false;
                var uEmail = (u.Email || u.email || '').toString().trim().toLowerCase();
                return uEmail === normEmail;
            });

            if (matched) {
                // ✅ Existing user — সরাসরি login করো
                var status = (matched.Status || matched.status || 'active').toLowerCase();
                if (status === 'inactive') {
                    showAuthMsg('login', '⏳ অ্যাকাউন্ট এখনো Activate হয়নি। Admin-এর সাথে যোগাযোগ করুন।');
                    return;
                }
                var user = {
                    name:       matched.Name       || matched.name       || name,
                    phone:      matched.Phone      || matched.phone      || email,
                    email:      matched.Email      || matched.email      || email,
                    role:       matched.Role       || matched.role       || 'User',
                    status:     matched.Status     || matched.status     || 'Active',
                    picture:    matched.Picture    || matched.picture    || photoUrl,
                    xp:         parseInt(matched.XP || matched.xp || 0) || 0,
                    userType:   matched.UserType   || matched.userType   || 'General',
                    classLevel: matched.ClassLevel || matched.classLevel || ''
                };
                saveCurrentUser(user);
                localStorage.setItem('home_user_name', user.name);
                if (user.picture) localStorage.setItem('home_user_pic', user.picture);
                hideAuthScreen();
                // Admin কে notify করো — fire and forget
                try {
                    fetch(GAS_URL + '?action=adminNotify&event=login'
                        + '&name=' + encodeURIComponent(user.name||"")
                        + '&phone=' + encodeURIComponent(user.phone||"")
                    ).catch(function(){});
                } catch(e2) {}
                setTimeout(postLoginFCMSetup, 1000);
                try { initApp(); } catch(e) {}
                setTimeout(applyAdminVisibility, 200);
            } else {
                // 🆕 নতুন user — signup form এ email/name বসিয়ে দাও
                switchAuthTab('signup');
                var nameEl  = document.getElementById('signup-name');
                var emailEl = document.getElementById('signup-email');
                if (nameEl)  nameEl.value  = name;
                if (emailEl) emailEl.value = email;
                window._googlePhotoUrl = photoUrl;
                showAuthMsg('signup', '✅ Google থেকে তথ্য আনা হয়েছে। ফোন নম্বর ও বাকি তথ্য পূরণ করুন।');
            }
        })
        .catch(function(err) {
            showAuthLoading(false);
            showAuthMsg('login', '❌ সংযোগ সমস্যা। আবার চেষ্টা করুন।');
        });
}

// =====================================================
// LEADERBOARD FUNCTIONS
// =====================================================

// ══════════════════════════════════════════════════════
// ADMIN VIEW SWITCHER
// ══════════════════════════════════════════════════════
function initAdminViewBar() {
    // Floating admin-view-bar removed — Switch To is now only inside the menu (admin-only)
}

function menuViewTypeChanged() {
    var typeEl  = document.getElementById('menu-view-type');
    var classEl = document.getElementById('menu-view-class');
    var val = typeEl ? typeEl.value : '';
    if (!val) {
        if (classEl) classEl.style.display = 'none';
        setAdminView(null);
        showToast('✅ নিজের view-এ ফিরে এসেছো');
        navigate('home');
    } else if (val === 'Student') {
        if (classEl) { classEl.style.display = 'block'; classEl.value = ''; }
        setAdminView('Student', '');
        showToast('👁 Student view সক্রিয়');
    } else if (val === 'Job') {
        if (classEl) { classEl.style.display = 'none'; }
        setAdminView('Job', '');
        showToast('👁 Job view সক্রিয়');
        navigate('home');
    }
}

function menuViewClassChanged() {
    var typeEl  = document.getElementById('menu-view-type');
    var classEl = document.getElementById('menu-view-class');
    var userType = typeEl ? typeEl.value : 'Student';
    var classVal = classEl ? classEl.value : '';
    if (classVal) {
        setAdminView(userType, classVal);
        showToast('👁 ' + classVal + ' view সক্রিয়');
        navigate('home');
    }
}

function adminViewTypeChanged() {
    var typeEl  = document.getElementById('admin-view-type');
    var classEl = document.getElementById('admin-view-class');
    var val = typeEl ? typeEl.value : '';

    if (!val) {
        if (classEl) classEl.style.display = 'none';
        setAdminView(null);
        return;
    }
    if (val === 'Student') {
        if (classEl) { classEl.style.display = 'inline-block'; classEl.value = ''; }
        setAdminView('Student', '');
    } else if (val === 'Job') {
        if (classEl) { classEl.style.display = 'inline-block'; classEl.value = ''; }
        setAdminView('Job', '');
    }
}

function adminViewClassChanged() {
    var typeEl  = document.getElementById('admin-view-type');
    var classEl = document.getElementById('admin-view-class');
    var uType   = typeEl  ? typeEl.value  : 'Student';
    var uClass  = classEl ? classEl.value : '';
    setAdminView(uType, uClass);
}

