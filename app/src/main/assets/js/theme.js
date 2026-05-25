/* Smart Study — theme.js */
function setTheme(theme) {
    localStorage.setItem('app_theme', theme);
    applyTheme(theme);
    if (currentMode === 'menu') renderView();
}

function applyTheme(theme) {
    document.body.classList.remove(...THEMES.map(t => 'theme-' + t));
    if (theme && theme !== 'default') {
        document.body.classList.add('theme-' + theme);
    }
    // Update header color based on current mode
    const colors = {
        default: { study:'#6366f1', quiz:'#059669', qbank:'#0d9488', menu:'#d97706' },
        green:   { study:'#059669', quiz:'#0d9488', qbank:'#047857', menu:'#d97706' },
        rose:    { study:'#e11d48', quiz:'#be123c', qbank:'#9f1239', menu:'#d97706' },
        amber:   { study:'#d97706', quiz:'#b45309', qbank:'#92400e', menu:'#6366f1' },
    };
    window._themeColors = colors[theme] || colors.default;
}

function getActiveTheme() {
    return localStorage.getItem('app_theme') || 'default';
}

// ====================================================
// 📅 EXAM COUNTDOWN
// ====================================================
function renderExamCountdown() {
    const examDate = localStorage.getItem('exam_date');
    if (!examDate) {
        return `<div class="countdown-card mb-2">
            <div class="flex justify-between items-center">
                <div>
                    <p class="font-black text-white">📅 পরীক্ষার Countdown</p>
                    <p class="text-white/60 text-[10px] font-bold mt-0.5">পরীক্ষার তারিখ সেট করো</p>
                </div>
                <button onclick="setExamDate()" class="bg-white/20 text-white text-xs font-black px-4 py-2 rounded-xl border border-white/20 active:scale-90 transition-all">সেট করো</button>
            </div>
        </div>`;
    }
    const now = new Date();
    const exam = new Date(examDate);
    const diff = exam - now;
    if (diff <= 0) {
        return `<div class="countdown-card mb-2">
            <p class="font-black text-white text-center">🎉 পরীক্ষার দিন এসে গেছে! শুভকামনা!</p>
            <button onclick="setExamDate()" class="mt-2 w-full text-center text-white/60 text-xs font-bold">নতুন তারিখ সেট করো</button>
        </div>`;
    }
    const days = Math.floor(diff / (1000*60*60*24));
    const hours = Math.floor((diff % (1000*60*60*24)) / (1000*60*60));
    const mins = Math.floor((diff % (1000*60*60)) / (1000*60));
    const examName = localStorage.getItem('exam_name') || 'পরীক্ষা';
    // Start live tick
    setTimeout(() => startCountdownTick(), 300);
    return `<div class="countdown-card mb-2">
        <div class="flex justify-between items-center mb-3">
            <div>
                <p class="text-white/60 text-[10px] font-bold uppercase tracking-wider">⏳ বাকি আছে</p>
                <p class="font-black text-white text-base">${examName}</p>
            </div>
            <button onclick="setExamDate()" class="text-white/50 text-[10px] font-bold">✎ পরিবর্তন</button>
        </div>
        <div class="flex gap-2 justify-center" id="live-countdown-boxes">
            <div class="countdown-box"><div class="font-black text-2xl text-white" id="cd-days">${days}</div><div class="text-white/50 text-[9px] font-bold mt-1">দিন</div></div>
            <div class="countdown-box"><div class="font-black text-2xl text-white" id="cd-hours">${hours}</div><div class="text-white/50 text-[9px] font-bold mt-1">ঘণ্টা</div></div>
            <div class="countdown-box"><div class="font-black text-2xl text-white" id="cd-mins">${mins}</div><div class="text-white/50 text-[9px] font-bold mt-1">মিনিট</div></div>
            <div class="countdown-box"><div class="font-black text-2xl text-white" id="cd-secs">00</div><div class="text-white/50 text-[9px] font-bold mt-1">সেকেন্ড</div></div>
        </div>
    </div>`;
}

function setExamDate() {
    // Open calendar modal
    openCalendar();
}

// ====================================================
// 📅 CALENDAR DATE PICKER
// ====================================================
let _calYear, _calMonth, _calSelectedDate = null;

function openCalendar() {
    const modal = document.getElementById('exam-calendar-modal');
    if (!modal) return;
    const now = new Date();
    _calYear = now.getFullYear();
    _calMonth = now.getMonth();
    _calSelectedDate = localStorage.getItem('exam_date') || null;
    renderCalendar();
    modal.classList.add('show');
}

function closeCalendar() {
    document.getElementById('exam-calendar-modal').classList.remove('show');
}

function calPrevMonth() {
    _calMonth--;
    if (_calMonth < 0) { _calMonth = 11; _calYear--; }
    renderCalendar();
}

function calNextMonth() {
    _calMonth++;
    if (_calMonth > 11) { _calMonth = 0; _calYear++; }
    renderCalendar();
}

function renderCalendar() {
    const months = ['জানুয়ারি','ফেব্রুয়ারি','মার্চ','এপ্রিল','মে','জুন','জুলাই','আগস্ট','সেপ্টেম্বর','অক্টোবর','নভেম্বর','ডিসেম্বর'];
    document.getElementById('cal-month-label').innerText = `${months[_calMonth]} ${_calYear}`;
    const grid = document.getElementById('cal-days-grid');
    const today = new Date(); today.setHours(0,0,0,0);
    const firstDay = new Date(_calYear, _calMonth, 1).getDay();
    const daysInMonth = new Date(_calYear, _calMonth + 1, 0).getDate();
    let html = '';
    for (let i = 0; i < firstDay; i++) html += '<div class="cal-day empty"></div>';
    for (let d = 1; d <= daysInMonth; d++) {
        const dateObj = new Date(_calYear, _calMonth, d);
        const dateStr = `${_calYear}-${String(_calMonth+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
        const isPast = dateObj < today;
        const isToday = dateObj.toDateString() === today.toDateString();
        const isSelected = dateStr === _calSelectedDate;
        let cls = 'cal-day';
        if (isPast) cls += ' past';
        if (isToday) cls += ' today';
        if (isSelected) cls += ' selected';
        html += `<div class="${cls}" onclick="calSelectDay('${dateStr}',this)">${d}</div>`;
    }
    grid.innerHTML = html;
    const confirmBtn = document.getElementById('cal-confirm-btn');
    if (confirmBtn) confirmBtn.disabled = !_calSelectedDate;
    if (_calSelectedDate) {
        document.getElementById('cal-selected-label').innerText = `✅ নির্বাচিত: ${_calSelectedDate}`;
    }
}

function calSelectDay(dateStr, el) {
    _calSelectedDate = dateStr;
    document.querySelectorAll('.cal-day').forEach(d => d.classList.remove('selected'));
    el.classList.add('selected');
    document.getElementById('cal-selected-label').innerText = `✅ নির্বাচিত: ${dateStr}`;
    const confirmBtn = document.getElementById('cal-confirm-btn');
    if (confirmBtn) confirmBtn.disabled = false;
}

function confirmExamDate() {
    if (!_calSelectedDate) return;
    const name = prompt('পরীক্ষার নাম লিখো (যেমন: BCS, HSC):') || 'পরীক্ষা';
    localStorage.setItem('exam_name', name);
    localStorage.setItem('exam_date', _calSelectedDate);
    closeCalendar();
    showToast(`✅ ${name} Countdown সেট হয়েছে!`);
    if (window._countdownInterval) clearInterval(window._countdownInterval);
    startCountdownTick();
    if (currentMode === 'menu') renderView();
}

// ====================================================
// ⚡ FLASHCARD MODE
// ====================================================
let _fcItems = [], _fcIndex = 0;

