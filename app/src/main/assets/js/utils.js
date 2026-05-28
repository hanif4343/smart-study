/* Smart Study — utils.js */
  if (!obj) return [];
  if (Array.isArray(obj)) return obj;
  return Object.values(obj);
}
// ====================================================
function updateUIMode(m) {
    const colors = window._themeColors || {
        home:'#10b981', study:'#6366f1', quiz:'#059669', qbank:'#0d9488', menu:'#d97706'
    };
    document.getElementById('main-header').style.backgroundColor = colors[m] || '#6366f1';
    const names = {home:'Smart Study', study:'স্টাডি জোন', quiz:'কুইজ জোন', qbank:'প্রশ্ন ব্যাংক', menu:'প্রোফাইল'};

    // Breadcrumb: path থাকলে subject/subtopic header এ দেখাও
    var titleEl = document.getElementById('zone-title');
    var subtitleEl = document.querySelector('#header-static p');
    if (typeof path !== 'undefined' && path.length > 0) {
        if (path.length === 1) {
            titleEl.textContent = path[0];
            if (subtitleEl) subtitleEl.textContent = names[m] || m;
        } else if (path.length >= 2) {
            var st = path[path.length - 1];
            titleEl.textContent = st.length > 22 ? st.substring(0, 20) + '\u2026' : st;
            if (subtitleEl) subtitleEl.textContent = path[0];
        }
    } else {
        titleEl.textContent = names[m] || 'Smart Study';
        if (subtitleEl) subtitleEl.textContent = 'Smart Study';
    }

    document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active-home','active-study','active-quiz','active-qbank','active-menu'));
    if(document.getElementById('nav-'+m)) document.getElementById('nav-'+m).classList.add('active-'+m);
}


// ====================================================
// 📊 PROGRESS TRACKING — Subject & SubTopic
// ====================================================
// ── In-memory cache: প্রতি renderView এ একবার মাত্র localStorage read ──
var _chCache = null;        // correct_history array
var _chSet   = null;        // Set for O(1) lookup
var _whCache = null;        // wrong_history object

function _invalidateProgressCache() {
    _chCache = null; _chSet = null; _whCache = null;
}

function _getCorrectSet() {
    if (_chSet) return _chSet;
    try {
        _chCache = JSON.parse(localStorage.getItem('correct_history') || '[]');
    } catch(e) { _chCache = []; }
    _chSet = new Set(_chCache);
    return _chSet;
}

function getSubjectProgress(subject, mode) {
    const sheet = mode === 'quiz' ? 'Quiz' : mode === 'qbank' ? 'QBank' : 'Study';
    const data = fullData[sheet] || [];
    const items = data.filter(i => getVal(i,'subject') === subject);
    if (!items.length) return { done:0, total:0, pct:0 };
    const ch = _getCorrectSet();
    const modePrefix = mode === 'qbank' ? 'qbank' : 'quiz';
    const done = items.filter(i => {
        var rawId = String(getVal(i,'id') || '');
        return ch.has(modePrefix + ':' + rawId) || ch.has(rawId);
    }).length;
    return { done, total: items.length, pct: Math.round((done/items.length)*100) };
}

function getSubTopicProgress(subject, subTopic, mode) {
    const sheet = mode === 'quiz' ? 'Quiz' : mode === 'qbank' ? 'QBank' : 'Study';
    const data = fullData[sheet] || [];
    const items = data.filter(i => getVal(i,'subject') === subject && getVal(i,'sub_topic') === subTopic);
    if (!items.length) return { done:0, total:0, pct:0 };
    const ch = _getCorrectSet();
    const modePrefix = mode === 'qbank' ? 'qbank' : 'quiz';
    const done = items.filter(i => {
        var rawId = String(getVal(i,'id') || '');
        return ch.has(modePrefix + ':' + rawId) || ch.has(rawId);
    }).length;
    return { done, total: items.length, pct: Math.round((done/items.length)*100) };
}

// ====================================================
// ⏱️ LIVE COUNTDOWN TICK (seconds)
// ====================================================
function startCountdownTick() {
    if (window._countdownInterval) clearInterval(window._countdownInterval);
    const examDate = localStorage.getItem('exam_date');
    if (!examDate) return;
    function tick() {
        const now = new Date();
        const exam = new Date(examDate);
        exam.setHours(0,0,0,0);
        const diff = exam - now;
        if (diff <= 0) { clearInterval(window._countdownInterval); return; }
        const days  = Math.floor(diff / (1000*60*60*24));
        const hours = Math.floor((diff % (1000*60*60*24)) / (1000*60*60));
        const mins  = Math.floor((diff % (1000*60*60)) / (1000*60));
        const secs  = Math.floor((diff % (1000*60)) / 1000);
        const dEl = document.getElementById('cd-days');
        const hEl = document.getElementById('cd-hours');
        const mEl = document.getElementById('cd-mins');
        const sEl = document.getElementById('cd-secs');
        if (dEl) dEl.innerText = days;
        if (hEl) hEl.innerText = String(hours).padStart(2,'0');
        if (mEl) mEl.innerText = String(mins).padStart(2,'0');
        if (sEl) sEl.innerText = String(secs).padStart(2,'0');
    }
    tick();
    window._countdownInterval = setInterval(tick, 1000);
}

// ====================================================
// 📳 HAPTIC FEEDBACK (Enhanced)
// ====================================================
function haptic(type) {
    if (!navigator.vibrate) return;
    const patterns = {
        light:   [30],
        medium:  [60],
        heavy:   [100],
        correct: [40, 20, 40],
        wrong:   [80, 30, 80, 30, 80],
        streak:  [50, 30, 50, 30, 100, 50, 150],
        levelup: [100,50,100,50,200,100,300],
        tap:     [15],
    };
    navigator.vibrate(patterns[type] || patterns.light);
}

// Patch all nav taps to haptic
document.querySelectorAll('.nav-item').forEach(btn => {
    btn.addEventListener('touchstart', () => haptic('tap'), {passive:true});
});
document.querySelectorAll('.opt-btn').forEach(btn => {
    btn.addEventListener('touchstart', () => haptic('tap'), {passive:true});
});

// ====================================================
// 🔔 NOTIFICATION — SW sync + in-app fallback
// (called from saveNotifSettings and initApp)
// ====================================================
function scheduleAllReminders() {
    // Register SW background sync if supported
    if ('serviceWorker' in navigator && 'SyncManager' in window) {
        navigator.serviceWorker.ready.then(reg => {
            reg.sync.register('study-reminder').catch(()=>{});
        });
    }
    // SW message listener for reminders
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.addEventListener('message', (event) => {
            if (event.data && event.data.type === 'SHOW_REMINDER') {
                const goal = getDailyGoal();
                const remaining = goal.goal - goal.done;
                if (remaining > 0) {
                    showInAppBanner('পড়ার সময়!', `${remaining} টি প্রশ্ন বাকি আছে 🎯`, '🔔');
                }
            }
        });
    }
    // In-app fallback
    scheduleInAppReminder();
}

function scheduleInAppReminder() {
    if (window._inAppReminderTimers) window._inAppReminderTimers.forEach(t=>clearTimeout(t));
    window._inAppReminderTimers = [];
    const morningTime = localStorage.getItem('morning_reminder') || '07:00';
    const nightTime   = localStorage.getItem('night_reminder')   || '21:00';
    function msUntil(t) {
        const [h,m] = t.split(':').map(Number);
        const now = new Date(), target = new Date();
        target.setHours(h,m,0,0);
        if (target <= now) target.setDate(target.getDate()+1);
        return target - now;
    }
    window._inAppReminderTimers.push(setTimeout(()=>{
        showInAppBanner('পড়ার সময় হয়েছে!', 'আজকের লক্ষ্য পূরণ করো 🎯', '📚');
        haptic('medium');
        scheduleInAppReminder();
    }, msUntil(morningTime)));
    window._inAppReminderTimers.push(setTimeout(()=>{
        const goal = getDailyGoal();
        if(goal.done < goal.goal) {
            showInAppBanner('রাতের Reminder', `${goal.goal-goal.done} টি প্রশ্ন বাকি! Streak ধরে রাখো 🔥`, '🌙');
            haptic('medium');
        }
        scheduleInAppReminder(); // ✅ পরের দিনের জন্য reschedule
    }, msUntil(nightTime)));
}

function showInAppBanner(title, body, icon) {
    icon = icon || '📚';
    const bar = document.getElementById('inapp-reminder-bar');
    if (!bar) return;
    
    document.getElementById('reminder-bar-icon').textContent = icon;
    document.getElementById('reminder-bar-title').textContent = title;
    document.getElementById('reminder-bar-body').textContent = body;
    
    // progress bar রিসেট করে animation restart
    const fill = document.getElementById('reminder-progress-fill');
    if (fill) {
        fill.style.animation = 'none';
        fill.offsetHeight; // reflow trigger
        fill.style.animation = '';
    }
    
    bar.classList.add('show');
    haptic('medium');
    
    // 8 সেকেন্ড পর অটো হাইড
    clearTimeout(window._reminderAutoHide);
    window._reminderAutoHide = setTimeout(() => closeReminderBar(), 8000);
}

function closeReminderBar() {
    const bar = document.getElementById('inapp-reminder-bar');
    if (bar) bar.classList.remove('show');
    clearTimeout(window._reminderAutoHide);
}

// ====================================================
// Patch check() to use haptic properly
// ====================================================
// Re-attach haptic on nav buttons after render
// ====================================================
// ⌨️ WRITING FOCUS — Simple Global Functions
// ====================================================
function writingFocusEnter() {
    window._wfActive = true;
    var nav  = document.querySelector('.nav-container');
    var bar  = document.getElementById('pro-submit-bar');
    var ctrl = document.getElementById('back-and-ctrls');
    var badge= document.getElementById('q-counter-badge');
    if (nav)  nav.style.display = 'none';
    if (bar)  { window._wfBarWasHidden = bar.classList.contains('hidden'); bar.style.display = 'none'; }
    if (ctrl) { ctrl.style.opacity = '0'; ctrl.style.pointerEvents = 'none'; }
    if (badge) badge.style.visibility = 'hidden';
}
function writingFocusLeave() { /* exit only on submit */ }
function writingFocusExit() {
    if (!window._wfActive) return;
    window._wfActive = false;
    var nav  = document.querySelector('.nav-container');
    var bar  = document.getElementById('pro-submit-bar');
    var ctrl = document.getElementById('back-and-ctrls');
    var badge= document.getElementById('q-counter-badge');
    // inline style remove করলে CSS এর default ফিরে আসবে
    if (nav)  nav.style.removeProperty('display');
    if (bar)  {
        bar.style.removeProperty('display');
        if (window._wfBarWasHidden) bar.classList.add('hidden');
        else bar.classList.remove('hidden');
    }
    if (ctrl)  { ctrl.style.removeProperty('opacity'); ctrl.style.removeProperty('pointer-events'); }
    if (badge)  badge.style.removeProperty('visibility');
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
}

// ====================================================
// ⌨️ WRITING FOCUS MODE (v3)
// textarea focus → UI hide | submit click → UI show + keyboard dismiss
// ====================================================
(function() {
    if (window._writingFocusInited) return;
    window._writingFocusInited = true;

    function enterFocusMode() {
        document.body.classList.add('writing-focus');
        // Direct JS hide — CSS fallback নয়
        const bar = document.getElementById('pro-submit-bar');
        const nav = document.querySelector('.nav-container');
        const ctrl = document.getElementById('back-and-ctrls');
        const badge = document.getElementById('q-counter-badge');
        if (bar)   { bar._prevDisplay = bar.style.display; bar.style.transform = 'translateY(120%)'; }
        if (nav)   { nav.style.transform = 'translateY(120%)'; }
        if (ctrl)  { ctrl.style.opacity = '0'; ctrl.style.pointerEvents = 'none'; }
        if (badge) { badge.style.opacity = '0'; }
    }
    function exitFocusMode() {
        document.body.classList.remove('writing-focus');
        // Direct JS restore
        const bar = document.getElementById('pro-submit-bar');
        const nav = document.querySelector('.nav-container');
        const ctrl = document.getElementById('back-and-ctrls');
        const badge = document.getElementById('q-counter-badge');
        if (bar)   { bar.style.transform = ''; }
        if (nav)   { nav.style.transform = ''; }
        if (ctrl)  { ctrl.style.opacity = ''; ctrl.style.pointerEvents = ''; }
        if (badge) { badge.style.opacity = ''; }
        // keyboard dismiss
        const a = document.activeElement;
        if (a && typeof a.blur === 'function') a.blur();
    }
    window.enterWritingFocus = enterFocusMode;
    window.exitWritingFocus  = exitFocusMode;

    // textarea focus → writingFocusEnter + scroll
    document.addEventListener('focusin', function(e) {
        if (!e.target.matches('.written-textarea, .sub-textarea')) return;
        writingFocusEnter();
        // keyboard উঠার পর scroll
        setTimeout(function() {
            var ta = e.target;
            var vv = window.visualViewport;
            if (!vv || !ta) return;
            var rect = ta.getBoundingClientRect();
            var visH = vv.height;
            if (rect.bottom > visH - 8) {
                window.scrollBy({ top: rect.bottom - visH + 20, behavior: 'smooth' });
            }
        }, 500);
    });

    // visualViewport resize = keyboard up/down
    if (window.visualViewport) {
        window.visualViewport.addEventListener('resize', function() {
            var ta = document.activeElement;
            if (!ta || !ta.matches('.written-textarea, .sub-textarea')) return;
            writingFocusEnter(); // re-apply (bar might have reappeared)
            setTimeout(function() {
                var rect = ta.getBoundingClientRect();
                var visH = window.visualViewport.height;
                if (rect.bottom > visH - 8) {
                    window.scrollBy({ top: rect.bottom - visH + 20, behavior: 'smooth' });
                }
            }, 80);
        });
    }
})();


function reAttachHaptics() {
    document.querySelectorAll('.nav-item, .opt-btn, .goal-btn, .ctrl-btn').forEach(btn => {
        if (!btn._hapticAttached) {
            btn.addEventListener('touchstart', () => haptic('tap'), {passive:true});
            btn._hapticAttached = true;
        }
    });
}
// reAttachHaptics called from renderView directly (see renderView function)

// Start live countdown on load if exam date set
window.addEventListener('load', () => {
    if (localStorage.getItem('exam_date')) startCountdownTick();
});


// ====================================================
// ✍️ SUB-QUESTION PARSER — ক) খ) গ) / a. b. c. / (i) (ii) ইত্যাদি
// ====================================================

/**
 * প্রশ্ন/উত্তর টেক্সট থেকে সাব-প্রশ্নগুলো আলাদা করে।
 * Returns: [{label:'ক.', text:'...'}, ...]
 * সাব-প্রশ্ন না থাকলে [{label:'', text: fullText}]
 *
 * Strategy: delimiter গুলো খুঁজি, তারপর তাদের মাঝের অংশ text হিসেবে নিই।
 * Delimiter = লাইনের শুরুতে বা whitespace/newline এর পর আসা ক) খ) / a. b. / ১. ২. ইত্যাদি
 */

// ── renderView debounce ────────────────────────────────────
// Rapid click এ একবারই render হবে — jank বন্ধ
var _renderViewTimer = null;
var _renderViewOriginal = null;
function _setupRenderDebounce() {
    if (typeof renderView !== 'function' || _renderViewOriginal) return;
    _renderViewOriginal = renderView;
    window.renderView = function() {
        if (_renderViewTimer) cancelAnimationFrame(_renderViewTimer);
        _renderViewTimer = requestAnimationFrame(function() {
            _renderViewOriginal();
        });
    };
}

// ── Instant touch feedback ─────────────────────────────────
function _setupTouchFeedback() {
    // Button press এ তাৎক্ষণিক visual feedback
    document.addEventListener('touchstart', function(e) {
        var btn = e.target.closest('button, [onclick], .card, a[href]');
        if (btn) btn.style.opacity = '0.7';
    }, { passive: true });

    document.addEventListener('touchend', function(e) {
        var btn = e.target.closest('button, [onclick], .card, a[href]');
        if (btn) setTimeout(function() { btn.style.opacity = ''; }, 120);
    }, { passive: true });

    document.addEventListener('touchcancel', function(e) {
        var btn = e.target.closest('button, [onclick], .card, a[href]');
        if (btn) btn.style.opacity = '';
    }, { passive: true });
}

// ── Passive scroll listeners ───────────────────────────────
function _setupPassiveScroll() {
    // Scroll smooth করতে passive listeners
    window.addEventListener('scroll', function(){}, { passive: true });
    document.addEventListener('touchmove', function(){}, { passive: true });
}

// ── Init all performance fixes ─────────────────────────────
document.addEventListener('DOMContentLoaded', function() {
    _setupTouchFeedback();
    _setupPassiveScroll();
    // renderView debounce: initApp এর পরে setup হবে
    setTimeout(_setupRenderDebounce, 500);
});
