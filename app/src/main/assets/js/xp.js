/* Smart Study — xp.js */
function _syncXPNow(xp) {
    if (!currentUser || !currentUser.phone || _xpPendingSync) return;
    _xpPendingSync = true;
    var phone = currentUser.phone;

    // GAS Sheet update
    fetch(GAS_URL, {
        method: 'POST', mode: 'no-cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'update_xp', phone: phone, xp: xp })
    }).catch(function() {});

    // Firebase PATCH — শুধু XP field
    syncXPToFirebase(phone, xp);

    setTimeout(function() { _xpPendingSync = false; }, 5000);
}
const XP_LEVELS = [
    { level:1,  name:'নতুন শিক্ষার্থী', emoji:'🌱', minXP:0 },
    { level:2,  name:'অনুসন্ধানী',       emoji:'🔍', minXP:100 },
    { level:3,  name:'পরিশ্রমী',          emoji:'📖', minXP:300 },
    { level:4,  name:'মেধাবী',            emoji:'💡', minXP:600 },
    { level:5,  name:'দক্ষ শিক্ষার্থী',  emoji:'⭐', minXP:1000 },
    { level:6,  name:'বিশেষজ্ঞ',          emoji:'🏅', minXP:1500 },
    { level:7,  name:'চ্যাম্পিয়ন',        emoji:'🏆', minXP:2500 },
    { level:8,  name:'মাস্টার',            emoji:'🎓', minXP:4000 },
    { level:9,  name:'গ্র্যান্ড মাস্টার', emoji:'👑', minXP:6000 },
    { level:10, name:'কিংবদন্তি',         emoji:'🌟', minXP:10000 },
];

function getXPInfo() {
    var _xpKey = currentUser && currentUser.phone ? 'user_xp_' + currentUser.phone : 'user_xp';
    const xp = parseInt(localStorage.getItem(_xpKey) || '0');
    let currentLevel = XP_LEVELS[0];
    let nextLevel = XP_LEVELS[1];
    for (let i = XP_LEVELS.length - 1; i >= 0; i--) {
        if (xp >= XP_LEVELS[i].minXP) {
            currentLevel = XP_LEVELS[i];
            nextLevel = XP_LEVELS[Math.min(i + 1, XP_LEVELS.length - 1)];
            break;
        }
    }
    const rangeXP = nextLevel.minXP - currentLevel.minXP;
    const earnedXP = xp - currentLevel.minXP;
    const pct = rangeXP > 0 ? Math.min(100, Math.round((earnedXP / rangeXP) * 100)) : 100;
    return { xp, level: currentLevel.level, levelName: currentLevel.name, levelEmoji: currentLevel.emoji, nextXP: nextLevel.minXP - xp, pct };
}

// XP_LEVELS এবং getXPInfo নিচে define করা আছে

// ====================================================
// 🏅 ACHIEVEMENTS
// ====================================================
const ACHIEVEMENTS = [
    { id:'first10',   xp:10,    emoji:'🎯', title:'প্রথম ১০ XP!',    desc:'শুরু হলো যাত্রা' },
    { id:'xp100',     xp:100,   emoji:'💫', title:'১০০ XP অর্জন!',   desc:'দারুণ শুরু!' },
    { id:'xp500',     xp:500,   emoji:'🔥', title:'৫০০ XP অর্জন!',   desc:'তুমি দারুণ!' },
    { id:'xp1000',    xp:1000,  emoji:'🏅', title:'১০০০ XP!',        desc:'অসাধারণ পারফরম্যান্স!' },
    { id:'xp2500',    xp:2500,  emoji:'🏆', title:'২৫০০ XP!',        desc:'তুমি চ্যাম্পিয়ন!' },
    { id:'xp5000',    xp:5000,  emoji:'👑', title:'৫০০০ XP!',        desc:'কিংবদন্তি হচ্ছ তুমি!' },
];

function checkAchievements(totalXP) {
    const earned = JSON.parse(localStorage.getItem('achievements') || '[]');
    ACHIEVEMENTS.forEach(a => {
        if (totalXP >= a.xp && !earned.includes(a.id)) {
            earned.push(a.id);
            localStorage.setItem('achievements', JSON.stringify(earned));
            setTimeout(() => showAchievement(a.emoji, a.title, a.desc), 800);
        }
    });
}

function showAchievement(emoji, title, desc) {
    const popup = document.getElementById('achievement-popup');
    if (!popup) return;
    document.getElementById('ach-emoji').innerText = emoji;
    document.getElementById('ach-title').innerText = title;
    document.getElementById('ach-desc').innerText = desc;
    popup.classList.add('show');
    playSound('streak');
    setTimeout(() => popup.classList.remove('show'), 3500);
}

// ====================================================
// 🔔 PUSH NOTIFICATIONS
// ====================================================
async function requestNotificationPermission() {
    if (!('Notification' in window)) return;
    if (Notification.permission === 'granted') return;
    if (Notification.permission === 'denied') return;
    const perm = await Notification.requestPermission();
    if (perm === 'granted') {
        showToast('🔔 Notification চালু হয়েছে!');
        scheduleStudyReminders();
    }
}

function scheduleStudyReminders() {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    // Clear existing timers
    if (window._notifTimers) window._notifTimers.forEach(t => clearTimeout(t));
    window._notifTimers = [];

    const morningTime = localStorage.getItem('morning_reminder') || '07:00';
    const nightTime = localStorage.getItem('night_reminder') || '21:00';

    function msUntil(timeStr) {
        const [h, m] = timeStr.split(':').map(Number);
        const now = new Date();
        const target = new Date();
        target.setHours(h, m, 0, 0);
        if (target <= now) target.setDate(target.getDate() + 1);
        return target - now;
    }

    // Morning reminder
    const msM = msUntil(morningTime);
    window._notifTimers.push(setTimeout(() => {
        sendNotification('📚 পড়ার সময় হয়েছে!', 'আজকের লক্ষ্য পূরণ করো। Smart Study খোলো এখনই! 🎯');
        scheduleStudyReminders(); // reschedule for next day
    }, msM));

    // Night reminder
    const msN = msUntil(nightTime);
    window._notifTimers.push(setTimeout(() => {
        const goal = getDailyGoal();
        if (goal.done < goal.goal) {
            sendNotification('🌙 রাতের Reminder', `এখনো ${goal.goal - goal.done} টি প্রশ্ন বাকি! Streak ধরে রাখো 🔥`);
        }
        scheduleStudyReminders(); // ✅ পরের দিনের জন্য reschedule
    }, msN));
}

function sendNotification(title, body) {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    try {
        new Notification(title, {
            body,
            icon: 'https://i.postimg.cc/QMcM9t0b/icon.jpg',
            badge: 'https://i.postimg.cc/QMcM9t0b/icon.jpg',
            vibrate: [200, 100, 200],
            tag: 'smart-study-reminder',
            renotify: true
        });
    } catch(e) { console.warn('Notification failed:', e); }
}

