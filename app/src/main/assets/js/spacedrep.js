/* Smart Study — spacedrep.js */
function srGetData() {
    try { return JSON.parse(localStorage.getItem('sr_data') || '{}'); } catch(e) { return {}; }
}

function srSaveData(data) {
    localStorage.setItem('sr_data', JSON.stringify(data));
}

// quality: 5=perfect, 4=correct easy, 3=correct hard, 2=wrong easy, 1=wrong, 0=blackout
function srUpdateCard(qId, quality) {
    var data = srGetData();
    var card = data[qId] || { ease: 2.5, interval: 1, reps: 0, due: 0 };

    if (quality >= 3) {
        if (card.reps === 0) card.interval = 1;
        else if (card.reps === 1) card.interval = 3;
        else card.interval = Math.round(card.interval * card.ease);
        card.reps += 1;
        card.ease = Math.max(1.3, card.ease + 0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
    } else {
        // ভুল হলে reset
        card.reps = 0;
        card.interval = 1;
        card.ease = Math.max(1.3, card.ease - 0.2);
    }

    var now = Date.now();
    card.due = now + card.interval * 24 * 60 * 60 * 1000;
    card.lastReview = now;
    card.lastQuality = quality;
    data[qId] = card;
    srSaveData(data);
    return card;
}

function srGetDueCount() {
    var data = srGetData();
    var now = Date.now();
    return Object.values(data).filter(function(c) { return c.due <= now; }).length;
}

function srGetDueIds() {
    var data = srGetData();
    var now = Date.now();
    return Object.keys(data).filter(function(id) { return data[id].due <= now; });
}

// question-এর SR priority score — বেশি হলে আগে আসবে
function srGetPriority(qId) {
    var data = srGetData();
    var card = data[qId];
    if (!card) return 50; // নতুন প্রশ্ন — মাঝারি priority
    var now = Date.now();
    if (card.due <= now) return 100; // overdue — সবচেয়ে আগে
    var daysLeft = (card.due - now) / (24 * 60 * 60 * 1000);
    if (card.lastQuality !== undefined && card.lastQuality < 3) return 80; // সম্প্রতি ভুল
    return Math.max(10, 50 - daysLeft * 5);
}

// Quiz items SR অনুযায়ী sort করো
function srSortItems(items) {
    return items.slice().sort(function(a, b) {
        var pa = srGetPriority(getVal(a,'id') || getVal(a,'sl') || '');
        var pb = srGetPriority(getVal(b,'id') || getVal(b,'sl') || '');
        if (pb !== pa) return pb - pa;
        return Math.random() - 0.5; // same priority → shuffle
    });
}

// Quiz সঠিক হলে SR update করো
function srMarkCorrect(qId) {
    srUpdateCard(qId, 4);
}

// Quiz ভুল হলে SR update করো
function srMarkWrong(qId) {
    srUpdateCard(qId, 1);
}

// SR due count Firebase-এ sync করো

// ============================================================
// 🔁 REVISION MODE — SR due questions
// ============================================================
function startRevisionMode() {
