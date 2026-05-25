/* Smart Study — social.js */
function loadSocialSignal() {
    try {
        var FB = window._FB_URL;
        if (!FB) { updateSocialUI(0); return; }
        var today = new Date().toDateString().replace(/ /g,'_');
        fetch(FB + '/DailyActive/' + today + '.json')
            .then(function(r){ return r.json(); })
            .then(function(data){
                var count = data ? Object.keys(data).length : 0;
                updateSocialUI(count);
            }).catch(function(){ updateSocialUI(0); });
    } catch(e){ updateSocialUI(0); }
}

function updateSocialUI(count) {
    var el = document.getElementById('social-active-count');
    if (!el) return;
    if (count > 1) {
        el.textContent = 'আজ ' + count + ' জন Smart Study-তে পড়েছে!';
    } else {
        el.textContent = 'আজই পড়া শুরু করো — community-তে যোগ দাও!';
    }
}

function shareProgressText() {
    var subjData = JSON.parse(localStorage.getItem('subj_stats') || '{}');
    var correctH = JSON.parse(localStorage.getItem('correct_history') || '[]');
    var wrongH   = JSON.parse(localStorage.getItem('wrong_history') || '{}');
    var totalC   = correctH.length;
    var totalW   = Object.values(wrongH).reduce(function(a,b){return a+b;},0);
    var acc      = (totalC+totalW)>0 ? Math.round(totalC/(totalC+totalW)*100) : 0;
    var streak   = typeof getStreakInfo==='function' ? getStreakInfo().streak : 0;
    var xp       = typeof getXPInfo==='function' ? getXPInfo().xp : 0;
    var name     = (currentUser&&currentUser.name) ? currentUser.name : 'আমি';
    var date     = new Date().toLocaleDateString('bn-BD');

    var lines = ['📊 Smart Study — অগ্রগতি রিপোর্ট', '👤 ' + name, '📅 ' + date, ''];
    lines.push('✅ মোট সঠিক: ' + totalC);
    lines.push('❌ মোট ভুল: ' + totalW);
    lines.push('🎯 নির্ভুলতা: ' + acc + '%');
    lines.push('🔥 Streak: ' + streak + ' দিন');
    lines.push('⭐ XP: ' + xp);
    lines.push('');

    var subjKeys = Object.keys(subjData).filter(function(k){ return (subjData[k].correct||0)+(subjData[k].wrong||0)>0; });
    if(subjKeys.length>0){
        lines.push('📚 বিষয়ভিত্তিক:');
        subjKeys.forEach(function(k){
            var c=subjData[k].correct||0, w=subjData[k].wrong||0, t=c+w;
            var pct=t>0?Math.round(c/t*100):0;
            var g=pct>=90?'A+':pct>=80?'A':pct>=70?'B':pct>=60?'C':pct>=50?'D':'F';
            lines.push('  • '+k+': '+pct+'% ('+g+')');
        });
        lines.push('');
    }
    lines.push('📱 Smart Study App দিয়ে পড়াশোনা করো!');

    var text = lines.join('\n');
    if(navigator.clipboard) {
        navigator.clipboard.writeText(text).then(function(){ showToast('✅ রিপোর্ট copy হয়েছে! WhatsApp-এ paste করো।'); });
    } else {
        var ta = document.createElement('textarea');
        ta.value = text; document.body.appendChild(ta); ta.select();
        document.execCommand('copy'); document.body.removeChild(ta);
        showToast('✅ রিপোর্ট copy হয়েছে!');
    }
}

function shareProgressImage() {
    showToast('📸 Screenshot নিয়ে share করো!');
    // Native screenshot hint for Android
    if(window.AndroidBridge && window.AndroidBridge.takeScreenshot) {
        window.AndroidBridge.takeScreenshot();
    }
}

// Daily active tracking — app খুললে Firebase-এ mark করো
function trackDailyActive() {
    try {
        var FB = window._FB_URL;
        var uid = currentUser && currentUser.phone ? currentUser.phone : null;
        if (!FB || !uid) return;
        var today = new Date().toDateString().replace(/ /g,'_');
        fetch(FB + '/DailyActive/' + today + '/' + uid + '.json', {
            method: 'PUT',
            body: JSON.stringify({ name: currentUser.name||'', time: Date.now() })
        }).catch(function(){});
    } catch(e){}
}
function srSyncToFirebase() {
    try {
        var uid = currentUser && currentUser.phone ? currentUser.phone : null;
        if (!uid) return;
        var dueCount = srGetDueCount();
        var data = srGetData();
        var totalCards = Object.keys(data).length;
        var subjStats = JSON.parse(localStorage.getItem('subj_stats') || '{}');
        var FB = window._FB_URL;
        if (!FB) return;
        fetch(FB + '/Users/' + uid + '/SR_Summary.json', {
            method: 'PUT',
            body: JSON.stringify({ dueCount: dueCount, totalCards: totalCards, lastSync: Date.now() })
        }).catch(function(){});
        // Subject stats sync
        fetch(FB + '/Users/' + uid + '/SubjectStats.json', {
            method: 'PUT',
            body: JSON.stringify(subjStats)
        }).catch(function(){});
    } catch(e) {}
}

function saveQuizResultToFirebase(result) {
    if (!currentUser || !currentUser.phone || !FIREBASE_URL || FIREBASE_URL.length < 10) return;
    var phone = currentUser.phone.toString().trim().replace(/\s/g,'');
    var safePhone = phone.replace(/[.#$\[\]]/g, '_');
    var now = new Date();
    var dateKey = now.toISOString().split('T')[0];
    var entryKey = dateKey + '_' + now.toTimeString().substring(0,5).replace(':','');
    var payload = {
        correct: result.correct, wrong: result.wrong,
        skipped: result.skipped, total: result.total, pct: result.pct,
        subject: result.subject || '', ts: now.toLocaleString(), date: dateKey
    };
    fetch(FIREBASE_URL + 'Analytics/Results/' + safePhone + '/' + entryKey + '.json?auth=' + SECRET_KEY, {
        method:'PUT', headers:{'Content-Type':'application/json'}, body:JSON.stringify(payload)
    }).catch(function(){});
    fetch(FIREBASE_URL + 'Analytics/Summary/' + safePhone + '.json?auth=' + SECRET_KEY)
        .then(function(r){ return r.json(); })
        .then(function(prev){
            prev = prev || {totalCorrect:0,totalWrong:0,totalQuizzes:0,totalQuestions:0};
            prev.totalCorrect   = (prev.totalCorrect  ||0) + result.correct;
            prev.totalWrong     = (prev.totalWrong    ||0) + result.wrong;
            prev.totalQuizzes   = (prev.totalQuizzes  ||0) + 1;
            prev.totalQuestions = (prev.totalQuestions||0) + result.total;
            prev.name    = currentUser.name    || prev.name    || '';
            prev.picture = currentUser.picture || prev.picture || '';
            prev.lastActive = dateKey;
            // Local cache save করো যাতে Home screen সঠিক দেখায়
            try { localStorage.setItem('fb_summary_cache', JSON.stringify(prev)); } catch(e){}
            return fetch(FIREBASE_URL + 'Analytics/Summary/' + safePhone + '.json?auth=' + SECRET_KEY,
                {method:'PUT', headers:{'Content-Type':'application/json'}, body:JSON.stringify(prev)});
        }).catch(function(){});
}

function saveSessionMinuteToFirebase() {
    if (!currentUser || !currentUser.phone || !FIREBASE_URL || FIREBASE_URL.length < 10) return;
    var safePhone = currentUser.phone.toString().trim().replace(/[.#$\[\]\s]/g,'_');
    var dateKey = new Date().toISOString().split('T')[0];
    fetch(FIREBASE_URL + 'Analytics/Time/' + safePhone + '/' + dateKey + '.json?auth=' + SECRET_KEY)
        .then(function(r){ return r.json(); })
        .then(function(cur){
            var mins = (parseInt(cur)||0) + 1;
            return fetch(FIREBASE_URL + 'Analytics/Time/' + safePhone + '/' + dateKey + '.json?auth=' + SECRET_KEY,
                {method:'PUT', headers:{'Content-Type':'application/json'}, body:JSON.stringify(mins)});
        }).catch(function(){});
}

// ════════════════════════════════════════════
// 🔔 NOTIFICATION POLLING
// Admin থেকে resolve notification পেলে দেখাবে
// ════════════════════════════════════════════
var _notifPollTimer = null;
// প্রথমবার চালু হলে এখন থেকে নতুন notification দেখাবে, পুরনো না
var _lastNotifCheck = parseInt(localStorage.getItem('last_notif_check') || Date.now().toString());
if (!localStorage.getItem('last_notif_check')) {
    localStorage.setItem('last_notif_check', _lastNotifCheck.toString());
}

