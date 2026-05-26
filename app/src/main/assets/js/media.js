/* Smart Study — media.js */
function openPdfModal(url) {
    const modal = document.getElementById('pdf-modal');
    const frame = document.getElementById('pdf-frame');
    
    let finalUrl = url;
    // গুগল ড্রাইভ লিঙ্ক হলে প্রিভিউ মোডে নেওয়া (জুমের জন্য ভালো)
    if (finalUrl.includes('drive.google.com') && !finalUrl.includes('preview')) {
        finalUrl = finalUrl.replace(/\/view.*$/, '/preview');
    }

    frame.src = finalUrl;
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    
    // ব্যাক বাটন হ্যান্ডলিং
    window.history.pushState({view: 'pdf'}, "");
}


function closePdfModal() {
    const modal = document.getElementById('pdf-modal');
    const frame = document.getElementById('pdf-frame');
    modal.classList.add('hidden');
    modal.classList.remove('flex'); // flex সরিয়ে ফেলুন
    frame.src = "";
}


// ফোন এর ব্যাক বাটন টিপলে পপ-আপ বন্ধ হওয়া নিশ্চিত করতে
window.addEventListener('popstate', function(event) {
    const modal = document.getElementById('pdf-modal');
    if (modal && !modal.classList.contains('hidden')) {
        closePdfModal();
    }
});

function toggleGlobalSearch() {
    const staticH = document.getElementById('header-static');
    const searchC = document.getElementById('search-container');
    const input = document.getElementById('global-search-input');
    
    if(searchC.classList.contains('hidden')) {
        staticH.classList.add('hidden');
        searchC.classList.remove('hidden');
        input.focus();
    } else {
        staticH.classList.remove('hidden');
        searchC.classList.add('hidden');
        input.value = '';
        renderView(); // সার্চ বন্ধ করলে আগের ভিউতে ফিরবে
    }
}

// টেক্সট হাইলাইট করার জন্য নতুন হেল্পার ফাংশন
function highlightText(text, query) {
    if (!query) return text;
    const regex = new RegExp(`(${query})`, 'gi');
    return text.replace(regex, '<mark class="bg-yellow-200 text-black rounded px-0.5 font-bold">$1</mark>');
}

function executeGlobalSearch(query) {
    const container = document.getElementById('main-view');
    const q = query.toLowerCase().trim();
    
    if(q.length < 2) {
        if(q.length === 0) renderView();
        return;
    }

    let results = [];
    const modes = ['Study', 'Quiz', 'QBank'];

    modes.forEach(mode => {
        if(fullData[mode]) {
            fullData[mode].forEach(item => {
                // Audience filter — user-এর জন্য relevant না হলে skip
                var _aTags = (item.AudienceTags||item.audiencetags||'').toString();
                if (!isQuestionRelevant(_aTags)) return;

                const question = getVal(item, 'question').toLowerCase();
                const correct = getVal(item, 'correct').toLowerCase();
                const explanation = getVal(item, 'explanation').toLowerCase();
                const answer = getVal(item, 'answer').toLowerCase();

                if(question.includes(q) || correct.includes(q) || explanation.includes(q) || answer.includes(q)) {
                    results.push({...item, sourceMode: mode});
                }
            });
        }
    });

    if(results.length === 0) {
        container.innerHTML = `<div class="text-center py-20 text-gray-400 font-bold">" ${query} " সংক্রান্ত কোনো তথ্য পাওয়া যায়নি!</div>`;
        return;
    }

    let html = `<div class="mb-4 text-xs font-bold text-gray-400 px-2 uppercase">${results.length} টি ফলাফল পাওয়া গেছে</div><div class="space-y-3">`;
    
    results.slice(0, 50).forEach((i, idx) => {
        const modeColor = i.sourceMode === 'Study' ? 'bg-indigo-100 text-indigo-600' : 
                         (i.sourceMode === 'Quiz' ? 'bg-green-100 text-green-600' : 'bg-teal-100 text-teal-600');
        
        // প্রশ্নের টেক্সটে আপনার সার্চ করা শব্দটিকে হাইলাইট করা হচ্ছে
        const highlightedQuestion = highlightText(getVal(i, 'question'), q);

        html += `
        <div onclick="goToResult('${i.sourceMode}', '${getVal(i, 'subject').replace(/'/g, "\\'")}', '${getVal(i, 'sub_topic').replace(/'/g, "\\'")}', '${getVal(i, 'id')}')" class="card active:scale-[0.98] transition-transform">
            <div class="flex justify-between items-start mb-2">
                <span class="text-[9px] font-black px-2 py-0.5 rounded-full ${modeColor}">${i.sourceMode}</span>
                <span class="text-[9px] text-gray-400 font-bold">${getVal(i, 'subject')}</span>
            </div>
            <div class="question-text text-sm line-clamp-3">${highlightedQuestion}</div>
            <div class="text-[10px] text-indigo-500 font-bold mt-2">ট্যাপ করে বিস্তারিত দেখুন ❯</div>
        </div>`;
    });
    
    html += `</div>`;
    container.innerHTML = html;
    triggerMathJax();
}





// সার্চ রেজাল্টে ক্লিক করলে নির্দিষ্ট প্রশ্নে নিয়ে যাওয়ার আপডেট ফাংশন
function goToResult(mode, subject, subTopic, targetQId) {
    // ১. সার্চ বার বন্ধ করা
    const staticH = document.getElementById('header-static');
    const searchC = document.getElementById('search-container');
    staticH.classList.remove('hidden');
    searchC.classList.add('hidden');
    document.getElementById('global-search-input').value = '';

    // ২. মোড ও পাথ সেট করা
    currentMode = mode.toLowerCase();
    updateUIMode(currentMode);
    path = [subject, subTopic]; 
    window.history.pushState({mode: currentMode, path: [...path]}, "");

    // ৩. ডাটা ফিল্টার করা
    let currentSheet = (currentMode === 'quiz' ? 'Quiz' : (currentMode === 'qbank' ? 'QBank' : 'Study'));
    // Audience filter — user type অনুযায়ী relevant প্রশ্ন
    const data = (fullData[currentSheet] || []).filter(function(row) {
        var tags = getVal(row, 'AudienceTags') || getVal(row, 'audiencetags') || '';
        return isQuestionRelevant(tags);
    });
    
    // সব প্রশ্ন ফিল্টার করা
    let filteredItems = data.filter(i => getVal(i, 'subject') === subject && getVal(i, 'sub_topic') === subTopic); 

    if(filteredItems.length > 0) {
        // *** বিশেষ পরিবর্তন: টার্গেট প্রশ্নটিকে খুঁজে বের করে তালিকার শুরুতে নিয়ে আসা ***
        const targetIndex = filteredItems.findIndex(i => getVal(i, 'id') === targetQId);
        if (targetIndex > -1) {
            const [targetItem] = filteredItems.splice(targetIndex, 1);
            filteredItems.unshift(targetItem); // সবার উপরে পাঠিয়ে দিলাম
        }

        quizItems = filteredItems;
        displayLimit = quizItems.length;
        
        document.getElementById('back-and-ctrls').classList.remove('hidden');
    if(typeof applyAdminVisibility==='function') applyAdminVisibility();
        if(currentMode !== 'study') startTimer(quizItems.length);
        
        // ৪. প্রশ্নগুলো রেন্ডার করা
        renderQuestions();

        // ৫. স্ক্রল এবং হাইলাইট করা
        setTimeout(() => {
            const allCards = document.querySelectorAll('#main-view .card');
            if(allCards.length > 0) {
                // যেহেতু আমরা টার্গেট প্রশ্ন শুরুতে এনেছি, তাই প্রথম কার্ডটিই আমাদের টার্গেট
                const targetCard = allCards[0];
                targetCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
                
                // হাইলাইট ইফেক্ট
                targetCard.style.transition = "0.5s";
                targetCard.style.border = "2px solid #6366f1";
                targetCard.style.boxShadow = "0 0 20px rgba(99, 102, 241, 0.4)";
                
                setTimeout(() => {
                    targetCard.style.boxShadow = "";
                    targetCard.style.border = "1px solid rgba(0,0,0,0.05)";
                }, 4000);
            }
        }, 400); // রেন্ডার হওয়ার জন্য পর্যাপ্ত সময়
    }
}

// ===== READING PROGRESS BAR =====
function updateReadingProgress() {
    const cards = document.querySelectorAll('#main-view .card');
    if (!cards.length) return;
    const total = cards.length;
    let answered = 0;
    cards.forEach(card => {
        if (card.querySelector('.options-container.done') || 
            card.querySelector('.exp-box:not(.hidden)') ||
            card.querySelector('.ans-box')) {
            answered++;
        }
    });
    const pct = Math.round((answered / total) * 100);
    const fill = document.getElementById('reading-progress-fill');
    if (fill) fill.style.width = pct + '%';
}

// ===== WEAK TOPICS =====
function getWeakTopics() {
    const wrongHistory = JSON.parse(localStorage.getItem('wrong_history') || '{}');
    const result = [];

    // Audience-filtered topics বের করো — user-এর content-এর বাইরের topic দেখাবে না
    var validTopics = new Set();
    try {
        var allItems = [
            ...(fullData['Quiz']  || []),
            ...(fullData['QBank'] || []),
            ...(fullData['Study'] || [])
        ];
        allItems.forEach(function(item) {
            var t = (item.AudienceTags || item.audiencetags || '').toString();
            if (isQuestionRelevant(t)) {
                var topic = getVal(item, 'sub_topic') || getVal(item, 'subject') || '';
                if (topic) validTopics.add(topic);
            }
        });
    } catch(e) {}

    Object.entries(wrongHistory).forEach(([topic, count]) => {
        // validTopics empty মানে data লোড হয়নি — তখন সব দেখাও
        if (count >= 2 && (validTopics.size === 0 || validTopics.has(topic))) {
            result.push({ topic, wrongCount: count });
        }
    });
    return result.sort((a,b) => b.wrongCount - a.wrongCount);
}

function trackWrongAnswer(topic, qId) {
    var wrongHistory = JSON.parse(localStorage.getItem('wrong_history') || '{}');
    wrongHistory[topic] = (wrongHistory[topic] || 0) + 1;
    localStorage.setItem('wrong_history', JSON.stringify(wrongHistory));
    if (qId) {
        // Store as "mode:id" to prevent Quiz/QBank ID collision
        var mode = currentMode === 'qbank' ? 'qbank' : 'quiz';
        var sid  = mode + ':' + String(qId);
        var wrongIds = JSON.parse(localStorage.getItem('wrong_q_ids') || '[]');
        if (!wrongIds.includes(sid)) wrongIds.push(sid);
        localStorage.setItem('wrong_q_ids', JSON.stringify(wrongIds));
        var wrongCount = JSON.parse(localStorage.getItem('wrong_q_count') || '{}');
        wrongCount[sid] = (wrongCount[sid] || 0) + 1;
        localStorage.setItem('wrong_q_count', JSON.stringify(wrongCount));
        try { srMarkWrong(sid); } catch(e) {}
        // Subject-wise wrong tracking
        try {
            var _wItem = null;
            var _wId = String(qId);
            ['QBank','Study','Quiz'].forEach(function(sh){ if(fullData[sh]) fullData[sh].forEach(function(it){ if(String(getVal(it,'id')||getVal(it,'sl')||'')=== _wId) _wItem=it; }); });
            if(_wItem) {
                var _wSubj = getVal(_wItem,'subject') || 'অন্যান্য';
                var _wChap = getVal(_wItem,'sub_topic') || '';
                var _wData = JSON.parse(localStorage.getItem('subj_stats')||'{}');
                if(!_wData[_wSubj]) _wData[_wSubj]={correct:0,wrong:0,chapters:{}};
                if(!_wData[_wSubj].chapters) _wData[_wSubj].chapters={};
                _wData[_wSubj].wrong++;
                if(_wChap){
                    if(!_wData[_wSubj].chapters[_wChap]) _wData[_wSubj].chapters[_wChap]={correct:0,wrong:0};
                    _wData[_wSubj].chapters[_wChap].wrong++;
                }
                localStorage.setItem('subj_stats', JSON.stringify(_wData));
            }
        } catch(e) {}
    }
}

// ===== DAILY STREAK =====
function getStreakInfo() {
    const data = JSON.parse(localStorage.getItem('study_streak') || '{"streak":0,"lastDate":""}');
    const today = new Date().toDateString();
    if (data.lastDate === today) return data;
    const yesterday = new Date(Date.now() - 86400000).toDateString();
    if (data.lastDate === yesterday) {
        data.streak = (data.streak || 0) + 1;
    } else if (data.lastDate !== today) {
        data.streak = 1;
    }
    data.lastDate = today;
    localStorage.setItem('study_streak', JSON.stringify(data));
    return data;
}

// ===== DAILY GOAL =====
// (getDailyGoal defined below with custom goal support)

function updateDailyGoal(count) {
    const todayKey = 'daily_' + new Date().toDateString();
    const current = parseInt(localStorage.getItem(todayKey) || '0');
    localStorage.setItem(todayKey, current + count);
    getStreakInfo(); // update streak
}

// ===== SAVED Q WITH FILTER =====
function showSavedQWithFilter(filterSubject) {
    if (savedQs.length === 0) { showToast('⚠️ কোনো প্রশ্ন নেই!'); return; }
    
    const subjects = [...new Set(savedQs.map(q => getVal(q, 'subject')))].filter(x => x);
    
    let filtered = filterSubject ? savedQs.filter(q => getVal(q, 'subject') === filterSubject) : savedQs;
    quizItems = filtered;
    displayLimit = filtered.length;
    currentMode = 'study';
    updateUIMode('study');
    path = ['Saved Questions'];
    pushAppState();
    
    // Render with filter chips on top
    renderQuestions();
    
    // Insert filter chips after render
    const container = document.getElementById('main-view');
    const chipHtml = `<div class="flex gap-2 overflow-x-auto pb-2 mb-3 -mx-1 px-1" style="scrollbar-width:none">
        <button onclick="showSavedQWithFilter()" class="filter-chip ${!filterSubject ? 'active' : ''}">সব (${savedQs.length})</button>
        ${subjects.map(s => `<button onclick="showSavedQWithFilter('${s}')" class="filter-chip ${filterSubject===s ? 'active' : ''}">${s}</button>`).join('')}
    </div>`;
    container.insertAdjacentHTML('afterbegin', chipHtml);
    
    document.getElementById('back-and-ctrls').classList.remove('hidden');
}

// ===== HIDE PROGRESS BAR ON MODE CHANGE: handled inside changeMode =====


// ===================================================
// 🔊 SOUND ENGINE
// ===================================================
const AudioCtx = window.AudioContext || window.webkitAudioContext;
let _audioCtx = null;

function getAudioCtx() {
    if (!_audioCtx) _audioCtx = new AudioCtx();
    return _audioCtx;
}

function playSound(type) {
    if (localStorage.getItem('sound_off')) return;
    try {
        const ctx = getAudioCtx();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);

        if (type === 'correct') {
            // Pleasant "ding-ding" ascending
            osc.type = 'sine';
            osc.frequency.setValueAtTime(523, ctx.currentTime);       // C5
            osc.frequency.setValueAtTime(659, ctx.currentTime + 0.1); // E5
            osc.frequency.setValueAtTime(784, ctx.currentTime + 0.2); // G5
            gain.gain.setValueAtTime(0.3, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
            osc.start(ctx.currentTime);
            osc.stop(ctx.currentTime + 0.5);
        } else if (type === 'wrong') {
            // Low buzz
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(200, ctx.currentTime);
            osc.frequency.setValueAtTime(150, ctx.currentTime + 0.1);
            gain.gain.setValueAtTime(0.15, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
            osc.start(ctx.currentTime);
            osc.stop(ctx.currentTime + 0.3);
        } else if (type === 'streak') {
            // Fanfare
            const notes = [523, 659, 784, 1047];
            notes.forEach((freq, i) => {
                const o = ctx.createOscillator();
                const g = ctx.createGain();
                o.connect(g); g.connect(ctx.destination);
                o.type = 'sine';
                o.frequency.setValueAtTime(freq, ctx.currentTime + i*0.1);
                g.gain.setValueAtTime(0.25, ctx.currentTime + i*0.1);
                g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i*0.1 + 0.4);
                o.start(ctx.currentTime + i*0.1);
                o.stop(ctx.currentTime + i*0.1 + 0.4);
            });
            return;
        } else if (type === 'timeup') {
            // Urgent alarm
            osc.type = 'square';
            osc.frequency.setValueAtTime(880, ctx.currentTime);
            osc.frequency.setValueAtTime(440, ctx.currentTime + 0.2);
            osc.frequency.setValueAtTime(880, ctx.currentTime + 0.4);
            gain.gain.setValueAtTime(0.2, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
            osc.start(ctx.currentTime);
            osc.stop(ctx.currentTime + 0.6);
        }
    } catch(e) { /* silent fail */ }
}

function toggleSound() {
    if (localStorage.getItem('sound_off')) {
        localStorage.removeItem('sound_off');
        showToast('🔊 সাউন্ড চালু হয়েছে');
    } else {
        localStorage.setItem('sound_off', '1');
        showToast('🔇 সাউন্ড বন্ধ হয়েছে');
    }
    // Re-render menu to update button
    if (currentMode === 'menu') renderView();
}

// ===================================================
// 🔥 STREAK POPUP
// ===================================================
function showStreakPopup(count) {
    playSound('streak');
    haptic('streak');
    const popup = document.getElementById('streak-popup');
    const countEl = document.getElementById('streak-count');
    if (!popup || !countEl) return;
    countEl.innerText = count + ' একটানা সঠিক! 🔥';
    popup.classList.remove('show');
    void popup.offsetWidth; // reflow
    popup.classList.add('show');
    setTimeout(() => popup.classList.remove('show'), 1900);
}

// ===================================================
// 🎯 DAILY GOAL SETTER
// ===================================================
function setDailyGoal(goal) {
    localStorage.setItem('daily_goal', goal);
    showToast(`🎯 লক্ষ্যমাত্রা ${goal} টি প্রশ্ন সেট হয়েছে!`);
    renderView(); // re-render menu
}

// Override getDailyGoal to use custom goal
function getDailyGoal() {
    const todayKey = 'daily_' + new Date().toDateString();
    const done = parseInt(localStorage.getItem(todayKey) || '0');
    const goal = parseInt(localStorage.getItem('daily_goal') || '20');
    return { done, goal };
}

// ===================================================
// 📊 STATS PAGE
// ===================================================
function showStatsPage() {
    const container = document.getElementById('main-view');
    const correctHistory = JSON.parse(localStorage.getItem('correct_history') || '[]');
    const wrongHistory = JSON.parse(localStorage.getItem('wrong_history') || '{}');
    const streakInfo = getStreakInfo();
    const todayGoal = getDailyGoal();

    const totalCorrect = correctHistory.length;
    const totalWrong = Object.values(wrongHistory).reduce((a,b) => a+b, 0);
    const totalAttempted = totalCorrect + totalWrong;
    const accuracyPct = totalAttempted > 0 ? Math.round((totalCorrect/totalAttempted)*100) : 0;
    const circumference = 283;
    const offset = circumference - (circumference * accuracyPct / 100);

    const weekDays = ['\u09B0\u09AC\u09BF','\u09B8\u09CB\u09AE','\u09AE\u0999\u09CD\u0997\u09B2','\u09AC\u09C1\u09A7','\u09AC\u09C3\u09B9','\u09B6\u09C1\u0995\u09CD\u09B0','\u09B6\u09A8\u09BF'];
    const today = new Date();
    const maxCount = Math.max(1, ...Array.from({length:7}, (_,i) => {
        const d = new Date(today); d.setDate(today.getDate()-(6-i));
        return parseInt(localStorage.getItem('daily_'+d.toDateString())||'0');
    }));
    const weekBars = Array.from({length:7}, (_,i) => {
        const d = new Date(today); d.setDate(today.getDate()-(6-i));
        const count = parseInt(localStorage.getItem('daily_'+d.toDateString())||'0');
        return { dayName: weekDays[d.getDay()], count, isToday: i===6 };
    });

    const weakData = getWeakTopics().slice(0,5);

    let statsHTML = '<div class="mb-4"><h2 class="font-black text-xl text-gray-800">\uD83D\uDCCA \u0986\u09AE\u09BE\u09B0 \u09AA\u09B0\u09BF\u09B8\u0982\u0996\u09CD\u09AF\u09BE\u09A8</h2><p class="text-xs text-gray-400 font-bold">\u0986\u099C \u09AA\u09B0\u09CD\u09AF\u09A8\u09CD\u09A4 \u09AE\u09CB\u099F \u0985\u0997\u09CD\u09B0\u0997\u09A4\u09BF</p></div>';

    // Accuracy Ring card
    statsHTML += '<div class="card text-center mb-3">';
    statsHTML += '<p class="text-[10px] font-black text-gray-400 uppercase tracking-wider mb-4">\u09B8\u09BE\u09AE\u0997\u09CD\u09B0\u09BF\u0995 \u09A8\u09BF\u09B0\u09CD\u09AD\u09C1\u09B2\u09A4\u09BE</p>';
    statsHTML += '<div class="stats-ring-wrap mb-3">';
    statsHTML += '<svg class="stats-ring-svg" viewBox="0 0 100 100">';
    statsHTML += '<defs><linearGradient id="statsGrad" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#6366f1"/><stop offset="100%" stop-color="#10b981"/></linearGradient></defs>';
    statsHTML += '<circle class="stats-ring-bg" cx="50" cy="50" r="45"/>';
    statsHTML += '<circle class="stats-ring-fill" cx="50" cy="50" r="45" style="stroke-dashoffset:'+offset+'"/>';
    statsHTML += '</svg>';
    statsHTML += '<div class="stats-ring-label"><span class="font-black text-2xl text-indigo-600">'+accuracyPct+'%</span><span class="text-[9px] text-gray-400 font-bold">\u09B8\u09A0\u09BF\u0995</span></div>';
    statsHTML += '</div>';
    statsHTML += '<div class="grid grid-cols-3 gap-3 mt-2">';
    statsHTML += '<div class="bg-green-50 rounded-xl p-3"><div class="font-black text-xl text-green-600">'+totalCorrect+'</div><div class="text-[9px] font-bold text-gray-400">\u09AE\u09CB\u099F \u09B8\u09A0\u09BF\u0995</div></div>';
    statsHTML += '<div class="bg-red-50 rounded-xl p-3"><div class="font-black text-xl text-red-500">'+totalWrong+'</div><div class="text-[9px] font-bold text-gray-400">\u09AE\u09CB\u099F \u09AD\u09C1\u09B2</div></div>';
    statsHTML += '<div class="bg-indigo-50 rounded-xl p-3"><div class="font-black text-xl text-indigo-600">'+streakInfo.streak+'</div><div class="text-[9px] font-bold text-gray-400">\u09B8\u09CD\u099F\u09CD\u09B0\u09BF\u0995 \uD83D\uDD25</div></div>';
    statsHTML += '</div></div>';

    // Weekly bar chart
    statsHTML += '<div class="card mb-3"><p class="text-[10px] font-black text-gray-400 uppercase tracking-wider mb-4">\u09B8\u09BE\u09AA\u09CD\u09A4\u09BE\u09B9\u09BF\u0995 \u09AA\u09CD\u09B0\u09B6\u09CD\u09A8\u09C7\u09B0 \u09B8\u0982\u0996\u09CD\u09AF\u09BE</p>';
    statsHTML += '<div class="flex items-end justify-between gap-1" style="height:80px;">';
    weekBars.forEach(function(b) {
        var h = Math.max(4, Math.round((b.count/maxCount)*64));
        var color = b.isToday ? 'linear-gradient(to top,#6366f1,#818cf8)' : '#e2e8f0';
        statsHTML += '<div class="flex flex-col items-center gap-1 flex-1">';
        statsHTML += '<span class="text-[8px] font-black" style="color:'+(b.isToday?'#4f46e5':'#cbd5e1')+'">'+(b.count||'')+'</span>';
        statsHTML += '<div style="height:'+h+'px;width:100%;border-radius:6px 6px 0 0;background:'+color+'"></div>';
        statsHTML += '</div>';
    });
    statsHTML += '</div>';
    statsHTML += '<div class="flex justify-between mt-1">';
    weekBars.forEach(function(b) {
        statsHTML += '<div class="flex-1 text-center text-[8px] font-bold" style="color:'+(b.isToday?'#4f46e5':'#cbd5e1')+'">'+b.dayName+'</div>';
    });
    statsHTML += '</div></div>';

    // Today goal card
    var goalPct = Math.min(100, Math.round(todayGoal.done/todayGoal.goal*100));
    statsHTML += '<div class="card mb-3" style="background:linear-gradient(135deg,#6366f1,#4338ca);color:white;">';
    statsHTML += '<div class="flex justify-between items-center mb-2"><span class="font-black">\uD83C\uDFAF \u0986\u099C\u0995\u09C7\u09B0 \u09B2\u0995\u09CD\u09B7\u09CD\u09AF</span><span class="font-black text-lg">'+todayGoal.done+'/'+todayGoal.goal+'</span></div>';
    statsHTML += '<div class="bg-white/20 rounded-full h-3 overflow-hidden"><div class="bg-white h-full rounded-full" style="width:'+goalPct+'%"></div></div>';
    statsHTML += '<p class="text-white/70 text-[10px] font-bold mt-2">'+(todayGoal.done>=todayGoal.goal ? '\u2705 \u0986\u099C\u0995\u09C7\u09B0 \u09B2\u0995\u09CD\u09B7\u09CD\u09AF \u09AA\u09C2\u09B0\u09A3 \u09B9\u09AF\u09BC\u09C7\u099B\u09C7!' : (todayGoal.goal-todayGoal.done)+' \u099F\u09BF \u09AC\u09BE\u0995\u09BF \u0986\u099B\u09C7')+'</p>';
    statsHTML += '</div>';

    // Weak topics
    if (weakData.length > 0) {
        statsHTML += '<div class="card mb-20"><p class="font-black text-red-600 mb-3">\uD83D\uDD25 \u09A6\u09C1\u09B0\u09CD\u09AC\u09B2 \u0985\u09A7\u09CD\u09AF\u09BE\u09AF\u09BC</p>';
        weakData.forEach(function(w, i) {
            statsHTML += '<div class="flex items-center gap-3 py-2 border-b border-gray-50 last:border-0">';
            statsHTML += '<span class="font-black text-gray-300 w-4">'+(i+1)+'</span>';
            statsHTML += '<span class="flex-1 text-sm font-bold text-gray-600 truncate">'+w.topic+'</span>';
            statsHTML += '<span class="text-[10px] font-black text-red-500 bg-red-50 px-2 py-0.5 rounded-full">'+w.wrongCount+' \u09AD\u09C1\u09B2</span>';
            statsHTML += '</div>';
        });
        statsHTML += '</div>';
    } else {
        statsHTML += '<div class="card mb-20 text-center text-gray-400 font-bold py-6">\uD83D\uDC4F \u098F\u0996\u09A8\u09CB \u0995\u09CB\u09A8\u09CB \u09A6\u09C1\u09B0\u09CD\u09AC\u09B2 \u0985\u09A7\u09CD\u09AF\u09BE\u09AF\u09BC \u09A8\u09C7\u0987!</div>';
    }


    // ── Subject-wise Progress Report ──
    var subjData = JSON.parse(localStorage.getItem('subj_stats') || '{}');
    var subjKeys = Object.keys(subjData).filter(function(k){ return subjData[k].correct + subjData[k].wrong > 0; });
    subjKeys.sort(function(a,b){
        var pa = subjData[a].correct/(subjData[a].correct+subjData[a].wrong);
        var pb = subjData[b].correct/(subjData[b].correct+subjData[b].wrong);
        return pa - pb; // দুর্বল বিষয় আগে
    });

    if (subjKeys.length > 0) {
        statsHTML = statsHTML.replace('</div>', ''); // remove last mb-20 closing — we'll reclose
        statsHTML += '<div class="card mb-3">';
        statsHTML += '<p class="font-black text-gray-700 mb-4" style="font-size:13px;">📚 বিষয়ভিত্তিক অগ্রগতি</p>';
        subjKeys.forEach(function(subj) {
            var c = subjData[subj].correct || 0;
            var w = subjData[subj].wrong || 0;
            var t = c + w;
            var pct = t > 0 ? Math.round(c/t*100) : 0;
            var barColor = pct >= 80 ? '#10b981' : pct >= 50 ? '#f59e0b' : '#ef4444';
            var grade = pct >= 90 ? 'A+' : pct >= 80 ? 'A' : pct >= 70 ? 'B' : pct >= 60 ? 'C' : pct >= 50 ? 'D' : 'F';
            var gradeColor = pct >= 70 ? '#10b981' : pct >= 50 ? '#f59e0b' : '#ef4444';
            statsHTML += '<div style="margin-bottom:12px;">';
            statsHTML += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">';
            statsHTML += '<span style="font-size:11px;font-weight:800;color:#374151;flex:1;margin-right:8px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">'+subj+'</span>';
            statsHTML += '<span style="font-size:10px;font-weight:900;color:'+gradeColor+';background:'+(pct>=70?'#d1fae5':pct>=50?'#fef3c7':'#fee2e2')+';padding:1px 7px;border-radius:8px;">'+grade+'</span>';
            statsHTML += '</div>';
            statsHTML += '<div style="display:flex;align-items:center;gap:8px;">';
            statsHTML += '<div style="flex:1;background:#f1f5f9;border-radius:6px;height:8px;overflow:hidden;">';
            statsHTML += '<div style="width:'+pct+'%;background:'+barColor+';height:100%;border-radius:6px;transition:width 0.6s ease;"></div>';
            statsHTML += '</div>';
            statsHTML += '<span style="font-size:10px;font-weight:900;color:#6b7280;min-width:60px;text-align:right;">'+c+'/'+t+' ('+pct+'%)</span>';
            statsHTML += '</div>';
            statsHTML += '</div>';
        });
        statsHTML += '</div>';
    }

    // ── SR Summary card ──
    var srData = srGetData ? srGetData() : {};
    var srTotal = Object.keys(srData).length;
    var srDue = typeof srGetDueCount === 'function' ? srGetDueCount() : 0;
    var srMastered = Object.values(srData).filter(function(c){ return c.reps >= 3 && c.ease >= 2.5; }).length;
    if (srTotal > 0) {
        statsHTML += '<div class="card mb-20" style="background:linear-gradient(135deg,#1e1b4b,#312e81);">';
        statsHTML += '<p class="font-black text-white mb-3" style="font-size:13px;">🧠 Spaced Repetition</p>';
        statsHTML += '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;">';
        statsHTML += '<div style="background:rgba(255,255,255,0.1);border-radius:10px;padding:10px;text-align:center;">';
        statsHTML += '<div style="font-size:20px;font-weight:900;color:#4ade80;">'+srMastered+'</div>';
        statsHTML += '<div style="font-size:8px;font-weight:800;color:rgba(255,255,255,0.5);margin-top:2px;">আয়ত্ত</div></div>';
        statsHTML += '<div style="background:rgba(255,255,255,0.1);border-radius:10px;padding:10px;text-align:center;">';
        statsHTML += '<div style="font-size:20px;font-weight:900;color:#fbbf24;">'+srDue+'</div>';
        statsHTML += '<div style="font-size:8px;font-weight:800;color:rgba(255,255,255,0.5);margin-top:2px;">Review বাকি</div></div>';
        statsHTML += '<div style="background:rgba(255,255,255,0.1);border-radius:10px;padding:10px;text-align:center;">';
        statsHTML += '<div style="font-size:20px;font-weight:900;color:#a78bfa;">'+srTotal+'</div>';
        statsHTML += '<div style="font-size:8px;font-weight:800;color:rgba(255,255,255,0.5);margin-top:2px;">মোট Cards</div></div>';
        statsHTML += '</div></div>';
    } else {
        statsHTML += '<div style="height:60px;"></div>'; // bottom padding
    }

    container.innerHTML = statsHTML;
    document.getElementById('back-and-ctrls').classList.remove('hidden');
    path = ['Stats'];
    pushAppState();
}

        // Single clean boot — handles splash + initApp together
        document.addEventListener('DOMContentLoaded', function() {
            // Offline banner padding for header
            function adjustHeaderForBanner() {
                const banner = document.getElementById('offline-banner');
                const header = document.getElementById('main-header');
                const stickyCtrl = document.querySelector('.sticky-ctrls');
                if (!banner || !header) return;
                const bannerH = banner.classList.contains('show') ? banner.offsetHeight : 0;
                header.style.top = bannerH + 'px';
                if (stickyCtrl) stickyCtrl.style.top = (bannerH + 75) + 'px';
            }
            // Observe banner class changes
            const bannerEl = document.getElementById('offline-banner');
            if (bannerEl) {
                new MutationObserver(adjustHeaderForBanner).observe(bannerEl, { attributes: true, attributeFilter: ['class'] });
            }
            // Initial check
            updateOfflineBanner();
            adjustHeaderForBanner();

            // ── INSTANT BOOT ──
            // Theme
            try {
                var t = localStorage.getItem('app_theme');
                if (t === 'dark') document.body.classList.add('dark-theme');
            } catch(e) {}

            // Loader + Splash — সাথে সাথে hide
            hideSplash();

            // Home তাৎক্ষণিক render
            currentMode = 'home';
            try { updateUIMode('home'); } catch(e) {}
            document.querySelectorAll('.nav-item').forEach(function(b) {
                b.classList.remove('active-home','active-study','active-quiz','active-qbank','active-menu');
            });
            var nh = document.getElementById('nav-home');
            if (nh) nh.classList.add('active-home');

            // Home render
            try {
                var mainView = document.getElementById('main-view');
                if (mainView && typeof renderHome === 'function') {
                    renderHome(mainView);
                }
            } catch(e) {
                console.error('renderHome error:', e);
            }

            // Background এ DB load — 50ms (DOM paint হওয়ার জন্য)
            setTimeout(function() {
                try { if(!isLoggedIn()){hideSplash();showAuthScreen('login');}else{initApp();} } catch(e){ console.error('initApp error:',e); }
            }, 50);
        });

// ====================================================
// 🎓 ONBOARDING
// ====================================================
let _obCurrent = 0;
const _obTotal = 4;

var _obSelected = { type: '', classLevel: '', goal: 20 };
var _obTotalSlides = 6;

function showOnboarding() {
    document.getElementById('onboarding-overlay').classList.remove('hidden');
    _obCurrent = 0;
    updateObSlide();
}

function updateObSlide() {
    document.querySelectorAll('.ob-slide').forEach(function(s, i) {
        s.classList.toggle('active', i === _obCurrent);
    });
    document.querySelectorAll('.ob-dot').forEach(function(d, i) {
        d.classList.toggle('active', i === _obCurrent);
    });
    var nextBtn = document.getElementById('ob-next');
    var skipBtn = document.getElementById('ob-skip');
    if (nextBtn) {
        nextBtn.textContent = _obCurrent === _obTotalSlides - 1 ? 'পড়া শুরু করো 🚀' : 'পরবর্তী →';
    }
    // Hide skip on last slide
    if (skipBtn) skipBtn.style.display = _obCurrent === _obTotalSlides - 1 ? 'none' : '';

    // Slide 2 (class) — skip if Job type
    if (_obCurrent === 2 && _obSelected.type === 'Job') {
        _obCurrent = 3; updateObSlide(); return;
    }
    // Slide 5 (ready) — populate summary
    if (_obCurrent === 5) obShowSummary();
}

function nextObSlide() {
    // Validate required selections
    if (_obCurrent === 1 && !_obSelected.type) {
        obShake('ob-1'); return;
    }
    if (_obCurrent === 3 && !_obSelected.goal) _obSelected.goal = 20;

    if (_obCurrent < _obTotalSlides - 1) {
        _obCurrent++;
        updateObSlide();
    } else {
        finishOnboarding();
    }
}

function obSelectType(type) {
    _obSelected.type = type;
    document.querySelectorAll('[id^="ob-type-"]').forEach(function(b) {
        b.style.background = 'rgba(255,255,255,0.1)';
        b.style.borderColor = 'rgba(255,255,255,0.2)';
    });
    var sel = document.getElementById('ob-type-' + type);
    if (sel) { sel.style.background = 'rgba(255,255,255,0.25)'; sel.style.borderColor = 'white'; }
    setTimeout(function(){ nextObSlide(); }, 300);
}

function obSelectClass(cls) {
    _obSelected.classLevel = cls;
    document.querySelectorAll('.ob-class-btn').forEach(function(b) { b.classList.remove('selected'); });
    event.target.classList.add('selected');
    setTimeout(function(){ nextObSlide(); }, 300);
}

function obSelectGoal(g) {
    _obSelected.goal = g;
    localStorage.setItem('daily_goal', g);
    [20,50,100,200].forEach(function(v) {
        var el = document.getElementById('ob-goal-'+v);
        if (el) { el.style.background = v===g ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.1)'; el.style.borderColor = v===g ? 'white' : 'rgba(255,255,255,0.2)'; }
    });
    setTimeout(function(){ nextObSlide(); }, 300);
}

function obEnableNotif() {
    if (typeof requestNotificationPermission === 'function') requestNotificationPermission();
    nextObSlide();
}

function obFollowFacebook() {
    var btn = document.getElementById('ob-fb-btn');
    var url = 'https://www.facebook.com/profile.php?id=61590421432898';

    // AndroidBridge.openFacebook দিয়ে Facebook app বা browser এ open করো
    if (window.AndroidBridge && window.AndroidBridge.openFacebook) {
        window.AndroidBridge.openFacebook(url);
    } else {
        window.open(url, '_blank');
    }

    // Button feedback
    if (btn) {
        btn.textContent = '✅ ধন্যবাদ!';
        btn.style.background = '#10b981';
        btn.disabled = true;
    }
    localStorage.setItem('fb_followed', '1');
    // Auto-advance to next slide after short delay
    setTimeout(function() { nextObSlide(); }, 1500);
}

function obShowSummary() {
    var el = document.getElementById('ob-summary');
    if (!el) return;
    var typeLabel = _obSelected.type === 'Job' ? '💼 চাকরি প্রস্তুতি' : '🎓 ছাত্র/ছাত্রী';
    var classLabel = _obSelected.classLevel ? ' — ' + _obSelected.classLevel : '';
    el.innerHTML =
        '<div style="color:white;font-size:12px;font-weight:700;line-height:1.8;">' +
        '👤 ' + typeLabel + classLabel + '<br>' +
        '🎯 দৈনিক লক্ষ্য: ' + _obSelected.goal + ' প্রশ্ন<br>' +
        '🧠 Smart Review: চালু<br>' +
        '📊 Progress Track: চালু' +
        '</div>';
}

function obShake(id) {
    var el = document.getElementById(id);
    if (!el) return;
    el.style.animation = 'none';
    setTimeout(function(){ el.style.animation = 'obShake 0.4s ease'; }, 10);
}

function finishOnboarding() {
    localStorage.setItem('ob_done', '1');
    // Save user preferences from onboarding
    if (_obSelected.type) {
        localStorage.setItem('ob_user_type', _obSelected.type);
        if (_obSelected.classLevel) localStorage.setItem('ob_class_level', _obSelected.classLevel);
    }
    if (_obSelected.goal) localStorage.setItem('daily_goal', _obSelected.goal);
    document.getElementById('onboarding-overlay').classList.add('hidden');
    setTimeout(function(){ requestNotificationPermission(); }, 800);
}

// ====================================================
// 🔔 FCM BRIDGE — Android → JavaScript
// ====================================================

// Android থেকে FCM token পাওয়ার পর call হয়
function onFCMTokenReceived(token) {
    if (!token || token.length < 10) return;
    // SharedPreferences এ আছে, JS এও রাখো
    localStorage.setItem('fcm_token', token);
    // User logged in থাকলে Firebase এ save করো
    if (currentUser && currentUser.phone) {
        saveFCMTokenToFirebase(token);
    }
}

// FCM notification এলে app foreground এ থাকলে in-app banner দেখাও
function onFCMNotification(title, body, url, questionId) {
    // in-app banner বন্ধ — system notification যথেষ্ট
}

// Java থেকে call হয় — notification click এ deep link
function navigateTo(url, questionId, qsheet) {
    var waited = 0;
    function tryNav() {
        var hasData = fullData && (fullData['QBank'] || fullData['Quiz'] || fullData['Study']);
        if (hasData || waited >= 4000) {
            _doDeepLink(url, questionId || '', qsheet || '');
        } else {
            waited += 300;
            setTimeout(tryNav, 300);
        }
    }
    tryNav();
}

function _doDeepLink(url, questionId, qsheet) {
    if (!url) return;
    url       = url.toString().trim();
    questionId = (questionId || '').toString().trim();
    qsheet    = (qsheet || '').toString().trim();

    if (url === 'qbank')    { changeMode('qbank');  return; }
    if (url === 'quiz')     { changeMode('quiz');   return; }
    if (url === 'study')    { changeMode('study');  return; }
    if (url === 'home')     { changeMode('home');   return; }
    if (url === 'signups')  { changeMode('signups');return; }

    if (url === 'report' && questionId) {
        var qNorm = questionId.replace(/^0+/, '').trim();
        var found = null, foundSheet = null;

        // QSheet থাকলে সরাসরি সেই sheet এ খোঁজো — ভুল হবে না
        var sheetMap = { qbank: 'QBank', quiz: 'Quiz', study: 'Study' };
        var targetSheet = sheetMap[qsheet.toLowerCase()] || qsheet;
        var sheetsToSearch = targetSheet && fullData[targetSheet]
            ? [targetSheet]
            : ['QBank', 'Quiz', 'Study'];

        sheetsToSearch.forEach(function(sh) {
            if (found) return;
            (fullData[sh] || []).forEach(function(it) {
                if (found) return;
                var itId = String(getVal(it,'id') || getVal(it,'sl') || getVal(it,'ID') || '').replace(/^0+/, '').trim();
                if (itId && itId === qNorm) { found = it; foundSheet = sh; }
            });
        });

        if (!found) {
            changeMode(targetSheet ? sheetMap[targetSheet.toLowerCase()] || 'qbank' : 'qbank');
            showToast('প্রশ্ন #' + questionId + ' খুঁজে পাওয়া যায়নি।');
            return;
        }

        var modeMap = { Quiz: 'quiz', Study: 'study', QBank: 'qbank' };
        var mode     = modeMap[foundSheet] || 'qbank';
        var subject  = getVal(found, 'subject') || '';
        var subtopic = getVal(found, 'sub_topic') || '';
        var actualId = String(getVal(found,'id') || getVal(found,'sl') || questionId);

        currentMode = mode;
        updateUIMode(mode);
        stopTimer();
        path = subject ? [subject] : [];

        if (subject && subtopic) {
            showQuestions(subtopic);
            setTimeout(function() {
                var el = document.querySelector('[data-qid="' + actualId + '"]')
                      || document.querySelector('[data-qid="' + actualId.replace(/^0+/,'') + '"]');
                if (el) {
                    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    el.style.outline = '3px solid #22c55e';
                    el.style.borderRadius = '10px';
                    setTimeout(function() { el.style.outline = ''; el.style.borderRadius = ''; }, 3000);
                }
            }, 900);
        } else {
            renderView();
        }
        return;
    }
}

// Firebase Users node এ FCM token save করো
function saveFCMTokenToFirebase(token) {
    if (!currentUser || !currentUser.phone || !FIREBASE_URL) return;
    fetch(FIREBASE_URL + 'Users.json?auth=' + SECRET_KEY)
        .then(function(r) { return r.json(); })
        .then(function(data) {
            if (!data) return;
            var keys = Object.keys(data);
            var normP = currentUser.phone.toString().trim().replace(/^0+/, '');
            for (var i = 0; i < keys.length; i++) {
                var u = data[keys[i]];
                if (!u) continue;
                var uPhone = (u.Phone || u.phone || '').toString().trim().replace(/['\s]/g, '');
                var normU = uPhone.replace(/^0+/, '');
                if (uPhone === currentUser.phone.toString().trim() || normU === normP) {
                    // শুধু FCMToken field PATCH করো
                    fetch(FIREBASE_URL + 'Users/' + keys[i] + '/FCMToken.json?auth=' + SECRET_KEY, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(token)
                    }).catch(function() {});
                    break;
                }
            }
        }).catch(function() {});
}

// Login এর পরে token save করো
function postLoginFCMSetup() {
    var token = localStorage.getItem('fcm_token') || '';
    if (!token) {
        try { token = AndroidBridge.getFCMToken(); } catch(e) {}
    }
    if (token && token.length > 10 && currentUser && currentUser.phone) {
        // Firebase FCMTokens node এ save (GAS sendFCMToPhone এখান থেকে পড়ে)
        fetch(GAS_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                type: 'save_fcm_token',
                phone: currentUser.phone,
                token: token
            })
        }).catch(function() {});
        // Users node এও save
        saveFCMTokenToFirebase(token);
    }
    try { AndroidBridge.subscribeToTopic('all_users'); } catch(e) {}
}

// ====================================================
// ⚡ XP UPDATE — race condition fix
// ====================================================
// XP update queue — একসাথে অনেক XP award হলে batch করে পাঠাও
var _xpUpdateTimer = null;
var _xpPendingSync = false;

function awardXP(amount) {
    var prevInfo = getXPInfo();
    var prevLevel = prevInfo.level;
    var _xpKey = currentUser && currentUser.phone ? 'user_xp_' + currentUser.phone : 'user_xp';
    var curXP = parseInt(localStorage.getItem(_xpKey) || '0');
    var newXP = curXP + amount;
    localStorage.setItem(_xpKey, newXP);
    // currentUser এও update রাখো
    if (currentUser) { currentUser.xp = newXP; saveCurrentUser(currentUser); }

    var newInfo = getXPInfo();
    if (newInfo.level > prevLevel) {
        showAchievement(newInfo.levelEmoji, 'Level Up! ' + newInfo.levelName, 'তুমি Level ' + newInfo.level + '-এ পৌঁছেছ!');
        if (navigator.vibrate) navigator.vibrate([100, 50, 100, 50, 200]);
    }
    checkAchievements(newXP);

    // Debounce sync — ৩ সেকেন্ড পর একবার পাঠাও, বারবার না
    if (_xpUpdateTimer) clearTimeout(_xpUpdateTimer);
    _xpUpdateTimer = setTimeout(function() {
        _syncXPNow(newXP);
    }, 3000);
}

