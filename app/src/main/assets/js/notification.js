/* Smart Study — notification.js */
function openNotifModal() {
    const modal = document.getElementById('notif-modal');
    if (!modal) return;
    document.getElementById('morning-time').value = localStorage.getItem('morning_reminder') || '07:00';
    document.getElementById('night-time').value = localStorage.getItem('night_reminder') || '21:00';
    modal.classList.remove('hidden');
}

function closeNotifModal() {
    document.getElementById('notif-modal').classList.add('hidden');
}

function saveNotifSettings() {
    const morning = document.getElementById('morning-time').value;
    const night   = document.getElementById('night-time').value;
    localStorage.setItem('morning_reminder', morning);
    localStorage.setItem('night_reminder',   night);

    // ── Native Android AlarmManager (app বন্ধ থাকলেও কাজ করে) ──
    if (window.AndroidBridge && typeof AndroidBridge.scheduleReminder === 'function') {
        try {
            // Android 12+ এ exact alarm permission check
            if (typeof AndroidBridge.canScheduleExactAlarms === 'function' && !AndroidBridge.canScheduleExactAlarms()) {
                if (typeof AndroidBridge.openAlarmPermissionSettings === 'function') {
                    AndroidBridge.openAlarmPermissionSettings();
                    showToast('⚠️ Settings থেকে "Alarms & Reminders" Allow করো, তারপর আবার save করো');
                    return;
                }
            }
            AndroidBridge.scheduleReminder(morning, '📚 পড়ার সময় হয়েছে!', 'Smart Study খুলে আজকের লক্ষ্য পূরণ করো 🎯', 1001);
            AndroidBridge.scheduleReminder(night,   '🌙 রাতের Reminder',    'ঘুমানোর আগে পড়ার অভ্যাস ধরে রাখো 🔥',      1002);
            showToast('✅ Reminder সেট হয়েছে! (app বন্ধ থাকলেও আসবে)');
            closeNotifModal();
            if (currentMode === 'menu') renderView();
            return;
        } catch(e) {
            console.warn('AndroidBridge.scheduleReminder failed, fallback to web:', e);
        }
    }

    // ── Fallback: Web Notification API (app open থাকলে কাজ করে) ──
    requestNotificationPermission().then(() => {
        scheduleStudyReminders();
        showToast('✅ Reminder সেট হয়েছে!');
        closeNotifModal();
        if (currentMode === 'menu') renderView();
    });
}

function getNotifStatus() {
    const m = localStorage.getItem('morning_reminder');
    const n = localStorage.getItem('night_reminder');
    // Android native bridge আছে কিনা দেখো
    if (window.AndroidBridge && typeof AndroidBridge.scheduleReminder === 'function') {
        if (m && n) return `✅ চালু আছে · সকাল ${m}, রাত ${n}`;
        return 'এখনো চালু হয়নি — সেট করো';
    }
    if (!('Notification' in window)) return 'এই ডিভাইসে সাপোর্ট নেই';
    if (Notification.permission === 'granted') {
        if (m && n) return `✅ চালু আছে · সকাল ${m}, রাত ${n}`;
        return 'এখনো চালু হয়নি — সেট করো';
    }
    if (Notification.permission === 'denied') return '❌ Permission নেই — Settings থেকে চালু করো';
    return 'এখনো চালু হয়নি — সেট করো';
}

// ====================================================
// ⏱️ TIME TRACKER
// ====================================================
let _sessionStart = null;
let _sessionTimer = null;

function startSessionTimer() {
    _sessionStart = Date.now();
    clearInterval(_sessionTimer);
    _sessionTimer = setInterval(() => {
        const minutesPassed = Math.floor((Date.now() - _sessionStart) / 60000);
        if (minutesPassed > 0 && minutesPassed % 1 === 0) {
            const todayKey = 'time_' + new Date().toDateString();
            const current = parseInt(localStorage.getItem(todayKey) || '0');
            localStorage.setItem(todayKey, current + 1);
            _sessionStart = Date.now();
            try { saveSessionMinuteToFirebase(); } catch(e) {}
        }
    }, 60000);
}

// App background/foreground হলে timer pause/resume
document.addEventListener('visibilitychange', function() {
    if (document.hidden) {
        clearInterval(_sessionTimer);
        _sessionTimer = null;
    } else {
        if (currentUser && currentUser.phone) {
            _sessionStart = Date.now();
            startSessionTimer();
        }
    }
});

function getTodayStudyTime() {
    const key = 'time_' + new Date().toDateString();
    return parseInt(localStorage.getItem(key) || '0');
}

function getWeekStudyTime() {
    let total = 0;
    for (let i = 0; i < 7; i++) {
        const d = new Date(); d.setDate(d.getDate() - i);
        total += parseInt(localStorage.getItem('time_' + d.toDateString()) || '0');
    }
    return total;
}

function getTotalStudyTime() {
    let total = 0;
    Object.keys(localStorage).filter(k => k.startsWith('time_')).forEach(k => {
        total += parseInt(localStorage.getItem(k) || '0');
    });
    return total;
}

// ====================================================
// 🎨 THEME SYSTEM
// ====================================================
const THEMES = ['default', 'green', 'rose', 'amber'];

