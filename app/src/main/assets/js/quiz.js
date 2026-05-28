/* Smart Study — quiz.js */
// Filtered data cache — mode বদলালে বা data update হলে invalidate হবে
var _filteredDataCache = {};
var _filteredDataMode = '';
function _getFilteredData(mode) {
    if (_filteredDataCache[mode]) return _filteredDataCache[mode];
    var sheet = mode === 'quiz' ? 'Quiz' : mode === 'qbank' ? 'QBank' : 'Study';
    _filteredDataCache[mode] = (fullData[sheet] || []).filter(function(row) {
        var tags = getVal(row, 'AudienceTags') || getVal(row, 'audiencetags') || '';
        return isQuestionRelevant(tags);
    });
    return _filteredDataCache[mode];
}
function _invalidateFilteredCache() { _filteredDataCache = {}; }

function renderView() {
    const container = document.getElementById('main-view');
    container.innerHTML = '';
    // প্রতি render এ progress cache reset
    if (typeof _invalidateProgressCache === 'function') _invalidateProgressCache();

    if (currentMode === 'home') {
        renderHome(container);
        return;
    }

    let currentSheet = (currentMode === 'quiz' ? 'Quiz' : (currentMode === 'qbank' ? 'QBank' : 'Study'));
    // Audience filter — cached
    const data = _getFilteredData(currentMode);

    if (currentMode === 'menu') {
        // Enhanced menu with streak + weak topics
        const weakData = getWeakTopics();
        const streakInfo = getStreakInfo();
        const todayGoal = getDailyGoal();

        const weakHtml = weakData.length > 0 ? `
        <div class="card mb-2 border-red-100 bg-red-50/50">
            <div class="flex justify-between items-center mb-3">
                <span class="font-black text-red-600 text-sm">🔥 দুর্বল অধ্যায়</span>
                <span class="weak-badge">${weakData.length} টি</span>
            </div>
            ${weakData.slice(0,3).map(w => `<div class="flex justify-between items-center py-1 border-b border-red-100 last:border-0">
                <span class="text-xs font-bold text-gray-600 truncate">${w.topic}</span>
                <span class="text-[10px] font-black text-red-500">${w.wrongCount} ভুল</span>
            </div>`).join('')}
        </div>` : '';

        const daysOfWeek = ['রবি', 'সোম', 'মঙ্গ', 'বুধ', 'বৃহ', 'শুক্র', 'শনি'];
        const today = new Date().getDay();
        const streakDots = daysOfWeek.map((d, idx) => {
            const cls = idx < today ? 'done' : (idx === today ? 'today' : '');
            return `<div class="streak-day-dot ${cls}">${d}</div>`;
        }).join('');

        var xpInfo = getXPInfo();
        var _uName  = currentUser && currentUser.name  ? currentUser.name  : (getUserName()||'ব্যবহারকারী');
        var _uPhone = currentUser && currentUser.phone ? currentUser.phone : USER_PHONE;
        var _uRole  = currentUser && currentUser.role  ? currentUser.role  : 'User';
        var _uPic   = currentUser && currentUser.picture ? currentUser.picture : getUserPic();
        var _picHTML = buildUserPicHtml(_uPic, 64);
        var _roleAdm = _uRole.toLowerCase()==='admin';
        var _roleStyle = _roleAdm ? 'background:#fef3c7;color:#92400e;' : 'background:rgba(255,255,255,0.15);color:rgba(255,255,255,0.9);';
        container.innerHTML = `


        ${weakHtml}

        <div onclick="showSavedQWithFilter()" class="card flex justify-between items-center mb-2">
            <span class="font-bold">⭐ সেভ করা প্রশ্ন</span>
            <span class="bg-indigo-100 text-indigo-700 font-black px-3 py-1 rounded-full text-sm">${savedQs.length}</span>
        </div>





        <!-- Stats Card -->
        <div style="display:flex;gap:8px;margin-bottom:8px;">
            <div onclick="showStatsPage()" class="card flex-1 flex justify-between items-center" style="background:linear-gradient(135deg,#eef2ff,#f5f3ff); border-color:#c7d2fe;margin-bottom:0;">
                <div>
                    <span class="font-black text-indigo-700">📊 পরিসংখ্যান</span>
                    <p class="text-[10px] text-gray-400 font-bold mt-0.5">সারসংক্ষেপ</p>
                </div>
                <span class="text-indigo-400 font-black text-lg">❯</span>
            </div>
            <div onclick="showProgressReport()" style="background:linear-gradient(135deg,#0f172a,#1e1b4b);border:1px solid rgba(99,102,241,0.3);border-radius:14px;padding:12px 14px;display:flex;flex-direction:column;justify-content:center;align-items:center;min-width:80px;cursor:pointer;">
                <span style="font-size:18px;">📈</span>
                <span style="color:white;font-size:9px;font-weight:900;margin-top:4px;text-align:center;">পূর্ণ রিপোর্ট</span>
            </div>
        </div>
        
  <!-- Notification Card -->
        <div class="notif-card mb-2">
            <div class="flex justify-between items-center">
                <div>
                    <p class="font-black text-white">🔔 Study Reminder</p>
                    <p class="text-white/70 text-[10px] font-bold mt-0.5">${getNotifStatus()}</p>
                </div>
                <button onclick="openNotifModal()" class="bg-white/20 text-white text-xs font-black px-4 py-2 rounded-xl border border-white/20 active:scale-90 transition-all">সেট করো</button>
            </div>
        </div>

        <!-- Exam Countdown Card -->
        ${renderExamCountdown()}

        <!-- Flashcard Quick Launch -->
        <div onclick="openFlashcardMode()" class="card flex justify-between items-center mb-2" style="background:linear-gradient(135deg,#f0f9ff,#e0f2fe); border-color:#bae6fd;">
            <div>
                <span class="font-black text-blue-700">⚡ Flashcard মোড</span>
                <p class="text-[10px] text-gray-400 font-bold mt-0.5">সব সেভ করা প্রশ্ন flashcard-এ পড়ো</p>
            </div>
            <span class="text-blue-400 font-black text-lg">❯</span>
        </div>



        <!-- Time Spent Today -->
        <div class="card mb-2">
            <p class="font-black text-gray-700 mb-3 text-sm">⏱️ আজকের পড়ার সময়</p>
            <div class="grid grid-cols-3 gap-2">
                <div class="time-stat-box">
                    <div class="font-black text-blue-700 text-xl">${getTodayStudyTime()}</div>
                    <div class="text-[9px] font-bold text-gray-400 mt-1">আজ মিনিট</div>
                </div>
                <div class="time-stat-box">
                    <div class="font-black text-blue-700 text-xl">${getWeekStudyTime()}</div>
                    <div class="text-[9px] font-bold text-gray-400 mt-1">সপ্তাহ মিনিট</div>
                </div>
                <div class="time-stat-box">
                    <div class="font-black text-blue-700 text-xl">${getTotalStudyTime()}</div>
                    <div class="text-[9px] font-bold text-gray-400 mt-1">মোট মিনিট</div>
                </div>
            </div>
        </div>
        <!-- Sound Toggle -->
        <div class="card flex justify-between items-center mb-2">
            <span class="font-bold">🔊 সাউন্ড ইফেক্ট</span>
            <button onclick="toggleSound()" class="goal-btn ${localStorage.getItem('sound_off') ? '' : 'selected'}" style="width:52px; font-size:18px;">${localStorage.getItem('sound_off') ? '🔇' : '🔊'}</button>
        </div><div onclick="toggleDarkMode()" class="card mb-2">🌙 ডার্ক মোড</div>
        ${_roleAdm ? `
        <div onclick="showFCMToken()" class="card flex justify-between items-center mb-2" style="background:linear-gradient(135deg,#f0fdf4,#dcfce7); border-color:#86efac;">
            <div>
                <span class="font-black text-green-700">🔔 FCM Token দেখাও</span>
                <p class="text-[10px] text-gray-400 font-bold mt-0.5">Notification test করতে এই token লাগবে</p>
            </div>
            <span class="text-green-400 font-black text-lg">❯</span>
        </div>` : ''}
        <div onclick="clearCache()" class="card text-red-500 mb-4">🔄 ডাটা রিসেট</div>

        ${_roleAdm ? `
        <div onclick="openAdminReelsFC()" class="card flex justify-between items-center mb-2" style="background:linear-gradient(135deg,#0a0a1f,#1e1b4b);border-color:rgba(99,102,241,0.4);">
            <div>
                <span class="font-black" style="color:#a5b4fc;">🎬 Reels Flashcard</span>
                <p class="text-[10px] font-bold mt-0.5" style="color:rgba(255,255,255,.4);">Facebook Reels এর জন্য MCQ রেকর্ড করো</p>
            </div>
            <span style="color:#6366f1;font-weight:900;font-size:18px;">❯</span>
        </div>` : ''}
        ${_roleAdm ? `        <!-- Admin: Switch To (admin only) -->
        <div class="card mb-4" style="background:linear-gradient(135deg,#0f172a,#1e1b4b);border-color:rgba(99,102,241,0.4);">
            <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;">
                <div style="width:32px;height:32px;background:rgba(99,102,241,0.25);border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:16px;">🔀</div>
                <div style="flex:1;">
                    <div style="font-weight:900;color:white;font-size:13px;">Switch To</div>
                    <div style="font-size:10px;color:rgba(255,255,255,0.45);font-weight:700;">অন্য user-এর view-এ preview করো</div>
                </div>
                ${_adminViewOverride ? `<span style="background:rgba(99,102,241,0.35);color:#a5b4fc;font-size:9px;font-weight:900;padding:3px 10px;border-radius:20px;border:1px solid rgba(99,102,241,0.5);">● ACTIVE</span>` : ''}
            </div>
            <div style="display:flex;gap:8px;flex-wrap:wrap;">
                <select id="menu-view-type" onchange="menuViewTypeChanged()" style="flex:1;min-width:120px;background:rgba(255,255,255,0.08);color:white;border:1px solid rgba(255,255,255,0.15);border-radius:10px;padding:8px 10px;font-size:12px;font-weight:800;outline:none;-webkit-appearance:none;appearance:none;background-image:url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='rgba(255,255,255,0.4)'/%3E%3C/svg%3E\");background-repeat:no-repeat;background-position:right 10px center;">
                    <option value="">🌐 সবাই (General)</option>
                    <option value="Student" ${_adminViewOverride && _adminViewOverride.userType==='Student' ? 'selected' : ''}>🎓 Student</option>
                    <option value="Job" ${_adminViewOverride && _adminViewOverride.userType==='Job' ? 'selected' : ''}>💼 Job</option>
                </select>
                <select id="menu-view-class" onchange="menuViewClassChanged()" style="flex:1;min-width:120px;display:${_adminViewOverride && _adminViewOverride.userType==='Student' ? 'block' : 'none'};background:rgba(255,255,255,0.08);color:white;border:1px solid rgba(255,255,255,0.15);border-radius:10px;padding:8px 10px;font-size:12px;font-weight:800;outline:none;-webkit-appearance:none;appearance:none;background-image:url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='rgba(255,255,255,0.4)'/%3E%3C/svg%3E\");background-repeat:no-repeat;background-position:right 10px center;">
                    <option value="">-- শ্রেণি --</option>
                    <option value="Class 4" ${_adminViewOverride && _adminViewOverride.classLevel==='Class 4' ? 'selected' : ''}>৪র্থ শ্রেণি</option>
                    <option value="Class 5" ${_adminViewOverride && _adminViewOverride.classLevel==='Class 5' ? 'selected' : ''}>৫ম শ্রেণি</option>
                    <option value="Class 6" ${_adminViewOverride && _adminViewOverride.classLevel==='Class 6' ? 'selected' : ''}>৬ষ্ঠ শ্রেণি</option>
                    <option value="Class 7" ${_adminViewOverride && _adminViewOverride.classLevel==='Class 7' ? 'selected' : ''}>৭ম শ্রেণি</option>
                    <option value="Class 8" ${_adminViewOverride && _adminViewOverride.classLevel==='Class 8' ? 'selected' : ''}>৮ম শ্রেণি</option>
                    <option value="Class 9" ${_adminViewOverride && _adminViewOverride.classLevel==='Class 9' ? 'selected' : ''}>৯ম শ্রেণি</option>
                    <option value="Class 10" ${_adminViewOverride && _adminViewOverride.classLevel==='Class 10' ? 'selected' : ''}>SSC / ১০ম</option>
                    <option value="HSC 1st" ${_adminViewOverride && _adminViewOverride.classLevel==='HSC 1st' ? 'selected' : ''}>HSC ১ম বর্ষ</option>
                    <option value="HSC 2nd" ${_adminViewOverride && _adminViewOverride.classLevel==='HSC 2nd' ? 'selected' : ''}>HSC ২য় বর্ষ</option>
                    <option value="Degree 1st" ${_adminViewOverride && _adminViewOverride.classLevel==='Degree 1st' ? 'selected' : ''}>ডিগ্রি ১ম বর্ষ</option>
                    <option value="Degree 2nd" ${_adminViewOverride && _adminViewOverride.classLevel==='Degree 2nd' ? 'selected' : ''}>ডিগ্রি ২য় বর্ষ</option>
                    <option value="Degree 3rd" ${_adminViewOverride && _adminViewOverride.classLevel==='Degree 3rd' ? 'selected' : ''}>ডিগ্রি ৩য় বর্ষ</option>
                    <option value="Masters 1st" ${_adminViewOverride && _adminViewOverride.classLevel==='Masters 1st' ? 'selected' : ''}>মাস্টার্স ১ম বর্ষ</option>
                    <option value="Masters 2nd" ${_adminViewOverride && _adminViewOverride.classLevel==='Masters 2nd' ? 'selected' : ''}>মাস্টার্স ২য় বর্ষ</option>
                    <option value="Grade 16" ${_adminViewOverride && _adminViewOverride.classLevel==='Grade 16' ? 'selected' : ''}>১৬তম গ্রেড</option>
                    <option value="Grade 17" ${_adminViewOverride && _adminViewOverride.classLevel==='Grade 17' ? 'selected' : ''}>১৭তম গ্রেড</option>
                    <option value="Grade 18" ${_adminViewOverride && _adminViewOverride.classLevel==='Grade 18' ? 'selected' : ''}>১৮তম গ্রেড</option>
                    <option value="Grade 19" ${_adminViewOverride && _adminViewOverride.classLevel==='Grade 19' ? 'selected' : ''}>১৯তম গ্রেড</option>
                    <option value="Grade 20" ${_adminViewOverride && _adminViewOverride.classLevel==='Grade 20' ? 'selected' : ''}>২০তম গ্রেড</option>
                </select>
            </div>
            ${_adminViewOverride ? `<button onclick="setAdminView(null);navigate('menu');" style="margin-top:10px;width:100%;background:rgba(239,68,68,0.15);color:#fca5a5;border:1px solid rgba(239,68,68,0.3);border-radius:10px;padding:9px;font-size:12px;font-weight:900;">✕ নিজের View-এ ফিরে যাও</button>` : ''}
        </div>
        ` : ''}
                <div onclick="doLogout()" class="card flex justify-between items-center mb-20" style="background:#fff5f5;border-color:#fecaca;">
            <span class="font-black text-red-600">🚪 লগআউট</span>
            <span class="text-red-400 font-black text-lg">❯</span>
        </div>`;
        return;
    }

    if(path.length === 0) {
        const list = [...new Set(data.map(i => getVal(i, 'subject')))].filter(x => x);
        const gridClass = currentMode === 'qbank' ? 'qbank-grid' : 'space-y-3';
        let html = `<div class="${gridClass}">`;
                html += list.map(s => {
            let count;
            if(currentMode === 'qbank') {
                // সাবজেক্টের আন্ডারে কতগুলো ইউনিক সাবটপিক আছে তা গণনা করবে
                const subTopics = [...new Set(data.filter(i => getVal(i, 'subject') === s).map(i => getVal(i, 'sub_topic')))].filter(x => x);
                count = subTopics.length;
                const qbProg = getSubjectProgress(s, 'qbank');
                return `<div onclick="pushPath('${s}')" class="qbank-main-card relative flex-col" style="padding-bottom:12px;">
                            <span>${s}</span>
                            <span class="text-[10px] opacity-80 font-normal mt-1">(${count} টি প্রশ্নপত্র)</span>
                            <div style="width:90%;margin-top:8px;background:rgba(255,255,255,0.25);border-radius:4px;height:5px;overflow:hidden;">
                                <div style="width:${qbProg.pct}%;height:100%;background:white;border-radius:4px;transition:width 0.6s;"></div>
                            </div>
                        </div>`;
            } else {
                count = data.filter(i => getVal(i, 'subject') === s).length;
                if(currentMode === 'study') {
                    return `<div onclick="pushPath('${s}')" class="card flex justify-between items-center px-5 py-4">
                                <span class="text-[16px] font-bold">${s}</span>
                                <span class="text-gray-300">❯</span>
                            </div>`;
                }
                const subjectItems = data.filter(i => getVal(i, 'subject') === s);
                const subjProg = getSubjectProgress(s, currentMode);
                const progColor = subjProg.pct >= 80 ? '#10b981' : subjProg.pct >= 50 ? '#6366f1' : subjProg.pct >= 20 ? '#f59e0b' : '#e2e8f0';
                return `<div onclick="pushPath('${s}')" class="card px-5 py-4">
                            <div class="flex justify-between items-center">
                                <span class="text-[16px] font-bold">${s}</span>
                                <div class="flex items-center gap-2">
                                    <span class="text-[10px] font-black text-gray-400">${subjProg.done}/${count}</span>
                                    <span class="text-gray-300">❯</span>
                                </div>
                            </div>
                            <div class="topic-progress-wrap mt-2">
                                <div class="topic-progress-fill" style="width:${subjProg.pct}%; background:${progColor};"></div>
                            </div>
                        </div>`;
            }
        }).join('');

        html += `</div>`;
        container.innerHTML = html;
        if(currentMode === 'quiz' || currentMode === 'qbank') container.insertAdjacentHTML('beforeend', `<div class="mt-6 border-t pt-4"><p class="text-xs font-bold text-gray-400 mb-3 uppercase tracking-wider text-center">স্পেশাল জোন</p><button onclick="pushPath('MockZone')" class="bg-[#059669] text-white p-4 rounded-2xl w-full font-black shadow-lg border-b-4 border-green-900 active:scale-95 transition-all flex items-center justify-center gap-2">🏆 বিষয় ভিত্তিক মক টেস্ট</button></div>`);
    } else if(path.length === 1) {
        if(path[0] === 'MockZone') { renderMockSelection(); return; }
        const filtered = data.filter(i => getVal(i, 'subject') === path[0]);
        if(currentMode === 'qbank') {
            // শুধু Study অংশের মতো সরাসরি সাবটপিক দেখান
         const stList = [...new Set(filtered.map(i => getVal(i, 'sub_topic')))].filter(x => x);
         container.innerHTML = '<div class="space-y-3">' + stList.map(function(st) {
             var stItems = filtered.filter(function(f){ return getVal(f,'sub_topic') === st; });
             var stProg = getSubTopicProgress(path[0], st, currentMode);
             var stColor = stProg.pct >= 80 ? '#10b981' : stProg.pct >= 50 ? '#6366f1' : stProg.pct >= 20 ? '#f59e0b' : '#e2e8f0';
             var safeSt = st.replace(/'/g, "\\'");
             return '<div onclick="showQuestions(\'' + safeSt + '\')" class="card">'
                 + '<div class="flex justify-between items-center">'
                 + '<span class="font-bold text-sm">' + st + '</span>'
                 + '<div class="flex items-center gap-2">'
                 + '<span class="text-[10px] font-black" style="color:' + stColor + '">' + stProg.done + '/' + stItems.length + '</span>'
                 + '<span class="text-gray-300 text-xs">&#10095;</span>'
                 + '</div></div>'
                 + '<div class="topic-progress-wrap">'
                 + '<div class="topic-progress-fill" style="width:' + stProg.pct + '%;background:' + stColor + ';"></div>'
                 + '</div></div>';
         }).join('') + '</div>';
        } else {
            const stList = [...new Set(filtered.map(i => getVal(i, 'sub_topic')))].filter(x => x);
            container.innerHTML = '<div class="space-y-3">' + stList.map(function(st) {
                var stItems = filtered.filter(function(f){ return getVal(f,'sub_topic') === st; });
                var safeSt = st.replace(/'/g, "\\'");
                var qCount = stItems.length;
                if(currentMode === 'study') {
                    // Study: সিম্পল কার্ড, progress bar নেই
                    return '<div onclick="showQuestions(\'' + safeSt + '\')" class="card flex justify-between items-center">'
                        + '<span class="font-bold text-sm">' + st + '</span>'
                        + '<span class="text-[10px] bg-gray-100 px-2 py-1 rounded text-gray-400">' + qCount + '</span>'
                        + '</div>';
                }
                // Quiz/QBank: progress bar সহ
                var stProg = getSubTopicProgress(path[0], st, currentMode);
                var stColor = stProg.pct >= 80 ? '#10b981' : stProg.pct >= 50 ? '#6366f1' : stProg.pct >= 20 ? '#f59e0b' : '#e2e8f0';
                return '<div onclick="showQuestions(\'' + safeSt + '\')" class="card">'
                    + '<div class="flex justify-between items-center">'
                    + '<span class="font-bold text-sm">' + st + '</span>'
                    + '<div class="flex items-center gap-2">'
                    + '<span class="text-[10px] font-black" style="color:' + stColor + '">' + stProg.done + '/' + qCount + '</span>'
                    + '<span class="text-gray-300 text-xs">&#10095;</span>'
                    + '</div></div>'
                    + '<div class="topic-progress-wrap">'
                    + '<div class="topic-progress-fill" style="width:' + stProg.pct + '%;background:' + stColor + ';"></div>'
                    + '</div></div>';
            }).join('') + '</div>';
        }
   }
}
        function renderMockSelection() {
    const data = _getFilteredData(currentMode);
    const container = document.getElementById('main-view');
    const subjects = [...new Set(data.map(i => getVal(i, 'subject')))].filter(x => x);

    let html = `
    <div class="sticky z-[45] bg-white border-b border-gray-100 pb-3 pt-2 -mx-5 px-5 mb-5 shadow-sm" style="top:max(75px,calc(env(safe-area-inset-top,0px) + 75px))">
        <div class="flex justify-between items-end">
            <div>
                <h3 class="font-black text-l text-gray-700 leading-none">টপিক সিলেক্ট করো</h3>
                <p class="text-[7px] text-gray-400 font-bold uppercase tracking-wider mt-1">Smart Preparation</p>
            </div>
            <div class="text-right flex flex-col items-end gap-1">
                <span id="selected-count" class="text-[11px] bg-indigo-50 text-indigo-600 px-3 py-1 rounded-full font-black border border-indigo-100">
                    ${selectedSubTopics.length} টি টপিক
                </span>
                <span id="selected-q-count" class="text-[11px] text-green-600 font-black">
                    মোট প্রশ্ন: 0 টি
                </span>
            </div>
        </div>
    </div>
    <div class="space-y-3 mb-40">`; // নিচের ফ্লোটিং কার্ডের জন্য পর্যাপ্ত জায়গা রাখা হয়েছে

    subjects.forEach((s, idx) => {
        const subTopics = [...new Set(data.filter(i => getVal(i, 'subject') === s).map(i => getVal(i, 'sub_topic')))].filter(x => x);
        const isSubjectChecked = subTopics.every(st => selectedSubTopics.includes(`${s}||${st}`));

        html += `
        <div class="border border-gray-200 rounded-2xl bg-white overflow-hidden shadow-sm">
            <div onclick="toggleAccordion('acc-${idx}')" class="flex justify-between items-center p-4 cursor-pointer hover:bg-gray-50 transition">
                <div class="flex items-center gap-3">
                    <input type="checkbox" ${isSubjectChecked ? 'checked' : ''} onclick="event.stopPropagation(); toggleAllInSubject('${s}', this)" class="w-5 h-5 accent-indigo-600 rounded-md">
                    <span class="font-bold text-gray-700">${s}</span>
                </div>
                <div class="flex items-center gap-3">
                    <span class="text-[10px] bg-gray-100 px-2 py-1 rounded-full text-gray-300 font-bold">${subTopics.length} Topics</span>
                    <span id="icon-acc-${idx}" class="text-gray-400 text-xs transition-transform duration-300">▼</span>
                </div>
            </div>
            <div id="acc-${idx}" class="hidden bg-gray-50 border-t border-gray-100 p-2 space-y-1">
                ${subTopics.map(st => { 
                    const key = `${s}||${st}`; 
                    return `
                    <label class="flex justify-between items-center p-3 rounded-xl hover:bg-white cursor-pointer transition border-b border-gray-100 last:border-0">
                        <div class="flex items-center gap-3">
                            <input type="checkbox" value="${key}" ${selectedSubTopics.includes(key) ? 'checked' : ''} onchange="updateMockSelection('${s}', '${st}', this)" class="w-4 h-4 accent-indigo-600">
                            <span class="text-sm font-medium text-gray-600">${st}</span>
                        </div>
                    </label>`; 
                }).join('')}
            </div>
        </div>`;
    });

    html += `</div>`;

    // আধুনিক ফ্লোটিং স্টিকি বার (এক লাইনে ইনপুট ও বাটন)
    html += `
    <div class="fixed bottom-[80px] left-4 right-4 z-[50]">
        <div class="bg-white/90 backdrop-blur-md rounded-3xl shadow-[0_10px_40px_rgba(0,0,0,0.15)] border border-white p-3">
            <div class="flex items-center gap-2">
                <div class="relative">
                    <input type="number" id="mock-q-limit" value="25" 
                           class="w-16 h-14 bg-gray-100 border-none rounded-2xl text-center font-black text-indigo-600 focus:ring-2 focus:ring-indigo-500 text-lg">
                    <span class="absolute -top-2 left-1/2 -translate-x-1/2 text-[8px] font-bold bg-indigo-600 text-white px-1.5 rounded-full uppercase">Q.Number</span>
                </div>
                
                <button onclick="startMock()" 
                        class="flex-1 h-14 bg-[#059669] text-white rounded-2xl font-black shadow-md border-b-4 border-green-800 active:scale-95 active:border-b-0 transition-all flex items-center justify-center gap-2">
                    <span>মক টেস্ট শুরু করুন</span>
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path fill-rule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clip-rule="evenodd" />
                    </svg>
                </button>
            </div>
        </div>
    </div>`;
    
    container.innerHTML = html;
    calculateTotalQuestions(); 
}


function calculateTotalQuestions() {
    const data = _getFilteredData(currentMode);
    const totalQ = data.filter(i => {
        const key = `${getVal(i, 'subject')}||${getVal(i, 'sub_topic')}`;
        return selectedSubTopics.includes(key);
    }).length;
    
    if(document.getElementById('selected-count')) {
        document.getElementById('selected-count').innerText = `${selectedSubTopics.length} টি টপিক`;
    }
    if(document.getElementById('selected-q-count')) {
        document.getElementById('selected-q-count').innerText = `মোট প্রশ্ন: ${totalQ} টি`;
    }
}


        function toggleAccordion(id) { const el = document.getElementById(id), icon = document.getElementById('icon-' + id); if(el.classList.contains('hidden')) { el.classList.remove('hidden'); icon.style.transform = 'rotate(180deg)'; } else { el.classList.add('hidden'); icon.style.transform = 'rotate(0deg)'; } }
        function updateMockSelection(sub, st, checkbox) {
    const key = `${sub}||${st}`;
    if(checkbox.checked) {
        if(!selectedSubTopics.includes(key)) selectedSubTopics.push(key);
    } else {
        selectedSubTopics = selectedSubTopics.filter(item => item !== key);
    }
    calculateTotalQuestions(); // এখানে কল করা হয়েছে
}

function toggleAllInSubject(sub, masterCheckbox) {
    const container = masterCheckbox.closest('.border').querySelectorAll('input[type="checkbox"]');
    container.forEach(cb => {
        if(cb !== masterCheckbox) {
            cb.checked = masterCheckbox.checked;
            const key = cb.value;
            if(cb.checked) {
                if(!selectedSubTopics.includes(key)) selectedSubTopics.push(key);
            } else {
                selectedSubTopics = selectedSubTopics.filter(item => item !== key);
            }
        }
    });
    calculateTotalQuestions(); // এখানেও কল করা হয়েছে
}

        function startMock() {
            const limit = parseInt(document.getElementById('mock-q-limit').value) || 25;
            const data = _getFilteredData(currentMode);
            const selectedSet = new Set(selectedSubTopics);
            let filtered = data.filter(i => { const key = getVal(i,'subject')+'||'+getVal(i,'sub_topic'); return selectedSet.has(key); });
            
            // --- মক টেস্টের জন্য সর্টিং ---
            const ch = typeof _getCorrectSet === 'function' ? _getCorrectSet() : new Set();
            const modePrefix = currentMode === 'qbank' ? 'qbank' : 'quiz';
            let correctHistory = [...ch];
            filtered.sort((a, b) => {
                let aDone = correctHistory.includes(getVal(a, 'id')) ? 1 : 0;
                let bDone = correctHistory.includes(getVal(b, 'id')) ? 1 : 0;
                return aDone - bDone;
            });
            
            quizItems = filtered.slice(0, limit); 
            if(quizItems.length === 0) { showToast('⚠️ টপিক সিলেক্ট করো!'); return; }
            window._correctStreak = 0; // reset streak counter
            displayLimit = quizItems.length;
            startTimer(quizItems.length); pushPath('MockResult'); renderQuestions();
        }

       function showQuestions(st) {
    const data = _getFilteredData(currentMode);
    quizItems = data.filter(i => getVal(i, 'subject') === path[0] && getVal(i, 'sub_topic') === st); 
    
    var correctHistory = JSON.parse(localStorage.getItem('correct_history') || '[]');
    var wrongQIds2     = JSON.parse(localStorage.getItem('wrong_q_ids')     || '[]');
    var modePrefix     = currentMode === 'qbank' ? 'qbank' : 'quiz';

    // 3 buckets: wrong, unattempted, correct
    var wrongItems       = [];
    var unattemptedItems = [];
    var correctItems     = [];

    quizItems.forEach(function(item) {
        var rawId = String(getVal(item,'id') || '');
        var sid   = modePrefix + ':' + rawId;
        var isCorrect = correctHistory.includes(sid) || correctHistory.includes(rawId);
        var isWrong   = wrongQIds2.includes(sid) || wrongQIds2.includes(rawId);
        if (isCorrect) {
            correctItems.push(item);
        } else if (isWrong) {
            wrongItems.push(item);
        } else {
            unattemptedItems.push(item);
        }
    });

    // Wrong items: higher wrong count first
    var wrongQCount = JSON.parse(localStorage.getItem('wrong_q_count') || '{}');
    wrongItems.sort(function(a, b) {
        var aSid = modePrefix + ':' + String(getVal(a,'id')||'');
        var bSid = modePrefix + ':' + String(getVal(b,'id')||'');
        return (wrongQCount[bSid]||0) - (wrongQCount[aSid]||0);
    });

    // Interleave: প্রতি 5টি unattempted এর পর 1টি wrong আসবে
    var INTERVAL = 5;
    var merged = [];
    var uIdx = 0, wIdx = 0;
    while (uIdx < unattemptedItems.length || wIdx < wrongItems.length) {
        var chunk = Math.min(INTERVAL, unattemptedItems.length - uIdx);
        for (var k = 0; k < chunk; k++) merged.push(unattemptedItems[uIdx++]);
        if (wIdx < wrongItems.length) {
            merged.push(wrongItems[wIdx++]);
        } else if (uIdx >= unattemptedItems.length) {
            break;
        }
    }
    // remaining wrong (if unattempted exhausted first)
    while (wIdx < wrongItems.length) merged.push(wrongItems[wIdx++]);
    // correct সব শেষে
    merged = merged.concat(correctItems);
    quizItems = merged;

    // কোনো লিমিট ছাড়া সব প্রশ্ন দেখানোর জন্য:
    displayLimit = quizItems.length; 

    window._correctStreak = 0; // reset streak
    if(currentMode !== 'study') startTimer(quizItems.length); 
    pushPath(st); 
    renderQuestions();

    // ══ VISUAL FLASHCARD — VisualURL আছে কিনা detect করো ══
    var _vBtn = document.getElementById('visual-fc-btn');
    if (_vBtn) {
        var _hasVisual = quizItems.some(function(i) {
            return (getVal(i, 'VisualURL') || '').trim() !== '';
        });
        if (_hasVisual) {
            _vBtn.classList.remove('hidden');
        } else {
            _vBtn.classList.add('hidden');
        }
    }
}



// Admin inline edit bar — safe version
function adminEditBar(item, mode) {
    if (!isAdmin()) return '';
    var id  = getVal(item, 'id') || '';

    function safeVal(v) {
        return v.toString().replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, ' ').replace(/"/g, '&quot;');
    }

    var q   = safeVal(getVal(item,'question')  || getVal(item,'explanation') || '');
    var o1  = safeVal(getVal(item,'option1')   || getVal(item,'opt1')  || '');
    var o2  = safeVal(getVal(item,'option2')   || getVal(item,'opt2')  || '');
    var o3  = safeVal(getVal(item,'option3')   || getVal(item,'opt3')  || '');
    var o4  = safeVal(getVal(item,'option4')   || getVal(item,'opt4')  || '');
    var cor = safeVal(getVal(item,'correct')   || '');

    function btn(label, field, val, bg, color, border) {
        return '<button onclick="openEditModal(\'' + id + '\',\'' + field + '\',\'' + val + '\')" style="font-size:10px;background:' + bg + ';color:' + color + ';border:1px solid ' + border + ';border-radius:6px;padding:2px 7px;cursor:pointer;white-space:nowrap;">' + label + '</button>';
    }

    var html = '<div style="display:flex;gap:4px;flex-wrap:wrap;margin:4px 0 6px 0;">';
    html += btn('✎ প্রশ্ন', 'question', q, '#eff6ff', '#1d4ed8', '#bfdbfe');
    if (mode === 'mcq') {
        html += btn('✎ ক', 'opt1', o1, '#f0fdf4', '#15803d', '#bbf7d0');
        html += btn('✎ খ', 'opt2', o2, '#f0fdf4', '#15803d', '#bbf7d0');
        html += btn('✎ গ', 'opt3', o3, '#f0fdf4', '#15803d', '#bbf7d0');
        html += btn('✎ ঘ', 'opt4', o4, '#f0fdf4', '#15803d', '#bbf7d0');
        html += btn('✎ উত্তর', 'correct', cor, '#fef2f2', '#dc2626', '#fecaca');
    } else if (mode === 'written') {
        html += btn('✎ উত্তর', 'correct', cor, '#fef2f2', '#dc2626', '#fecaca');
    }
    html += '</div>';
    return html;
}

function renderQuestions() {
    const container = document.getElementById('main-view');
    
    // কন্ট্রোল বার শো/হাইড লজিক আপডেট
    const readingCtrls = document.getElementById('reading-controls');
    
    // শুধুমাত্র একদম শেষ লেভেলে (প্রশ্ন পড়ার সময়) বাটনগুলো দেখাবে
    if (path.length >= 2 || path.includes('MockResult')) {
        readingCtrls.classList.remove('hidden');
        readingCtrls.classList.add('flex');
    } else {
        readingCtrls.classList.add('hidden');
    }

    answeredCount = 0; 
    updateScore();

    // ── Performance: once-per-render caches ──────────────────
    var wrongHistory;
    try { wrongHistory = JSON.parse(localStorage.getItem('wrong_history') || '{}'); } catch(e) { wrongHistory = {}; }
    const _savedQsSet  = new Set(savedQs.map(s => getVal(s, 'question')));

    let html = `<div class="space-y-4">`;
    quizItems.slice(0, displayLimit).forEach((i, idx) => {
        const qRaw = getVal(i, 'question'), 
              corRaw = getVal(i, 'correct'), 
              expRaw = getVal(i, 'explanation'), 
              ansRaw = getVal(i, 'answer'), 
              techRaw = getVal(i, 'technique'), 
              qType = getVal(i, 'Question Type').toLowerCase().trim();
        
        // Study backward compat: যদি question না থাকে, explanation-ই প্রশ্ন হিসেবে দেখাবে
        const _studyNoQ = currentMode === 'study' && !qRaw.trim();
        const q = parseLinksToImages(_studyNoQ ? (expRaw || ansRaw) : qRaw),
              explanation = parseLinksToImages(_studyNoQ ? '' : (expRaw || ansRaw)), 
              tech = parseLinksToImages(techRaw),
              correctVal = parseLinksToImages(corRaw);

        const isSaved = _savedQsSet.has(qRaw);
        // Spaced repetition: check if this question was wrong before
        const subTopicKey = getVal(i,'sub_topic') || getVal(i,'subject') || '';
        const isWeakQ = wrongHistory[subTopicKey] && wrongHistory[subTopicKey] >= 2;
        
        // ব্যাখ্যা UI লজিক
        const explanationUI = `<div style="background: #f0f9ff; padding: 3px 8px; margin-top: 6px; margin-bottom: 6px; border-radius: 5px; border-left: 1px solid #0ea5e9;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 5px;">
                <strong style="color: #0369a1; font-size: 12px;">ব্যাখ্যা:</strong>
                <button onclick="openEditModal('${getVal(i, 'id')}', 'explanation', '${(expRaw || ansRaw || '').replace(/'/g, "\\'").replace(/"/g, "&quot;").replace(/\n/g, "\\n")}')" 
                        style="width: 20px; height: 20px; background: #e0f2fe; color: #0369a1; border: 1px solid #bae6fd; border-radius: 4px; font-size: 18px; cursor: pointer;">✎</button>
            </div>
            <div style="color: #1e293b; font-size: 14px; margin-top: 2px;">${explanation || '  '}</div>
        </div>`;

        // টেকনিক UI লজিক
        const techUI = `<div style="background: #fffbeb; padding: 3px 8px; margin-top: 8px; border-radius: 5px; border-left: 3px solid #f59e0b;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1px;">
                <strong style="color: #92400e; font-size: 12px;">💡 টেকনিক:</strong>
                <button onclick="openEditModal('${getVal(i, 'id')}', 'technique', '${(techRaw || '').replace(/'/g, "\\'").replace(/"/g, "&quot;").replace(/\n/g, "\\n")}')" 
                        style="width: 20px; height: 20px; background: #fef3c7; color: #92400e; border: 1px solid #fde68a; border-radius: 4px; font-size: 15px; cursor: pointer;">✎</button>
            </div>
            <div style="color: #78350f; font-size: 14px; margin-top: 2px;">${tech || '  '}</div>
        </div>`;

        var _editCorBtn = '';
        if (isAdmin()) {
            var _qId2 = String(getVal(i,'id') || '');
            var _corE = (corRaw || '').replace(/\\/g,'\\\\').replace(/'/g,"\\'").replace(/"/g,'&quot;');
            _editCorBtn = '<button data-qid="' + _qId2 + '" data-field="correct" data-val="' + _corE + '" onclick="openEditModal(this.dataset.qid,this.dataset.field,this.dataset.val)" style="width:20px;height:20px;background:#dcfce7;color:#166534;border:1px solid #86efac;border-radius:4px;font-size:13px;cursor:pointer;line-height:1;">✎</button>';
        }
        // Study mode-এ সবসময় answer box দেখাবে (answer না থাকলেও admin edit করতে পারবে)
        const _showAnswerBox = correctVal || (currentMode === 'study' && isAdmin());
        const correctUI = (_showAnswerBox && (qType === 'written' || currentMode === 'study')) ? 
            '<div class="ans-box" style="border:1.5px solid #10b981;background:#f0fdf4;border-radius:8px;margin-top:-8px;padding:0 10px 5px 10px;">' +
            '<div style="display:flex;justify-content:space-between;align-items:center;margin-top:5px;margin-bottom:2px;">' +
            '<span style="font-weight:900;color:#15803d;font-size:14px;">উত্তর:</span>' +
            _editCorBtn +
            '</div>' +
            '<div style="margin-top:2px;line-height:1.3;">' + (correctVal || '<span style="color:#94a3b8;font-size:12px;">উত্তর এখনো যোগ করা হয়নি</span>') + '</div>' +
            '</div>'
            : '';

        // কন্ডিশনাল রেন্ডারিং
        if(currentMode === 'study') {
            const itemData = JSON.stringify(i).replace(/'/g, "&apos;").replace(/"/g, '&quot;');
            html += `<div class="card copy-target cursor-default" data-qid="${getVal(i,'id')}">
                        <div class="flex justify-between items-center mb-1">
                            <div class="flex items-center gap-2">
                                <span class="text-[10px] font-black text-indigo-400 bg-indigo-50 px-2 py-0.5 rounded-full">#${idx+1}</span>
                                ${isWeakQ ? '<span class="review-badge">🔁 Review</span>' : ''}
                                ${qType === 'written' ? '<span class="text-[9px] font-black bg-orange-100 text-orange-600 px-2 py-0.5 rounded-full">Written</span>' : ''}
                            </div>
                            <div class="flex items-center gap-4">
                                <span onclick="reportQuestion(${idx}, event)" class="report-btn">🚩</span>
                                <span onclick='toggleSave(this, ${itemData})' class="text-xl cursor-pointer ${isSaved?'star-active':'text-gray-300'}">★</span>
                                <span onclick='copyQuestionId("${getVal(i, 'id')}")' class="copy-id-btn">📋</span>
                            </div>
                        </div>
                        <div class="question-text">${q}</div>
                        ${adminEditBar(i,"study")}
                        ${correctUI}
                        ${explanationUI}
                        ${techUI}
                     </div>`;
        } else if(qType === 'written') {
            const itemData = JSON.stringify(i).replace(/'/g, "&apos;").replace(/"/g, '&quot;');
            // ====== SUB-QUESTION DETECTION ======
            const subParts = parseSubQuestions(corRaw);
            const hasSubQ = subParts.length > 1;
            let inputAreaHTML = '';
            if (hasSubQ) {
                // Multiple sub-answer boxes
                inputAreaHTML = `<div class="sub-written-wrap" data-qid="${getVal(i,'id')}" data-idx="${idx}" data-total="${subParts.length}">`;
                subParts.forEach((part, pi) => {
                    inputAreaHTML += `<div class="sub-q-item" data-part="${pi}">
                        <div class="sub-q-label">${part.label}</div>
                        <textarea class="written-textarea sub-textarea" placeholder="${part.label} এর উত্তর লিখো..." data-part="${pi}" style="min-height:70px;" onfocus="writingFocusEnter()" onblur="writingFocusLeave()"></textarea>
                        <div class="sub-match-result hidden" id="smr-${getVal(i,'id')}-${pi}"></div>
                    </div>`;
                });
                inputAreaHTML += `<button onclick="checkSubWrittenAnswer(this)" class="written-submit-btn" style="margin-top:10px;">🔍 সব উত্তর মিলিয়ে দেখো</button></div>`;
            } else {
                // Single textarea
                inputAreaHTML = `<div class="written-input-wrap" data-qid="${getVal(i,'id')}" data-idx="${idx}">
                    <textarea class="written-textarea" placeholder="এখানে তোমার উত্তর লিখো..." onfocus="writingFocusEnter()" onblur="writingFocusLeave()"></textarea>
                    <button onclick="checkWrittenAnswer(this)" class="written-submit-btn">🔍 উত্তর মিলিয়ে দেখো</button>
                </div>`;
            }
            html += `<div class="card copy-target cursor-default" style="padding-top:0;overflow:visible;" data-qid="${getVal(i,'id')}">
                        <div class="sub-q-sticky-question">
                            <div class="q-badge-row">
                                <span class="text-[10px] font-black text-indigo-400 bg-indigo-50 px-2 py-0.5 rounded-full">#${idx+1}</span>
                                <span class="text-[9px] font-black bg-orange-100 text-orange-600 px-2 py-0.5 rounded-full">Written</span>
                                ${hasSubQ ? `<span class="text-[9px] font-black bg-purple-100 text-purple-600 px-2 py-0.5 rounded-full">${subParts.length} টি অংশ</span>` : ''}
                                <div style="margin-left:auto;display:flex;align-items:center;gap:10px;">
                                    <span onclick="reportQuestion(${idx}, event)" class="report-btn">🚩</span>
                                    <span onclick='toggleSave(this, ${itemData})' class="text-xl cursor-pointer ${isSaved?'star-active':'text-gray-300'}">★</span>
                                    <span onclick='copyQuestionId("${getVal(i, 'id')}")' class="copy-id-btn">📋</span>
                                </div>
                            </div>
                            <div class="question-text">${q}</div>
                        ${adminEditBar(i,"written")}
                        </div>
                        <div style="padding: 0 0 4px 0;">
                        ${inputAreaHTML}
                        </div>
                        <div class="hidden mt-2 written-answer-box" id="wans-${getVal(i,'id')}">
                            ${correctUI}
                            ${explanationUI}
                            ${techUI}
                        </div>
                     </div>`;
        } else {
            let qId = getVal(i, 'id');
            const itemData = JSON.stringify(i).replace(/'/g, "&apos;").replace(/"/g, '&quot;');
            html += `<div class="card copy-target cursor-default" data-qid="${qId}">
                        <div class="flex justify-between items-center mb-1">
                            <div class="flex items-center gap-2">
                                <span class="text-[10px] font-black text-indigo-400 bg-indigo-50 px-2 py-0.5 rounded-full">#${idx+1}</span>
                            </div>
                            <div class="flex items-center gap-4">
                                <span onclick="reportQuestion(${idx}, event)" class="report-btn">🚩</span>
                                <span onclick='toggleSave(this, ${itemData})' class="text-xl cursor-pointer ${isSaved?'star-active':'text-gray-300'}">★</span>
                                <span onclick='copyQuestionId("${getVal(i, 'id')}")' class="copy-id-btn">📋</span>
                            </div>
                        </div>
                        <div class="question-text">${q}</div>
                        ${adminEditBar(i,"mcq")}
                        <div class="options-container">
                            ${[1,2,3,4].map(n => {
                                let optText = getVal(i, 'option'+n);
                                if(!optText) return '';
                                let safeCorRaw = corRaw.replace(/'/g, "\\'").replace(/"/g, "&quot;");
                                return `<button onclick="check(this, ${n}, '${safeCorRaw}', '${qId}')" class="opt-btn">${parseLinksToImages(optText)}</button>`;
                            }).join('')}
                        </div>
                        <div class="exp-box hidden mt-3 border-t pt-2">
                            ${explanationUI}
                            ${techUI}
                        </div>
                     </div>`;
        }
    });
    html += `</div>`;
    container.innerHTML = html;
    // Show reading progress bar + question counter badge
    document.getElementById('reading-progress-bar').classList.remove('hidden');
    document.getElementById('q-counter-badge').style.display = 'block';
    updateReadingProgress();
    try { srUpdateHomeCard(); } catch(e) {}

    // Scroll-based question counter
    if (window._scrollListener) window.removeEventListener('scroll', window._scrollListener);
    window._scrollListener = function() {
        const cards = document.querySelectorAll('#main-view .card');
        if (!cards.length) return;
        let current = 0;
        cards.forEach((card, idx) => {
            const rect = card.getBoundingClientRect();
            if (rect.top < window.innerHeight * 0.6) current = idx + 1;
        });
        const badge = document.getElementById('q-counter-badge');
        if (badge) badge.innerText = `${current}/${cards.length}`;
    };
    window.addEventListener('scroll', window._scrollListener, { passive: true });

    
    if (window.MathJax && MathJax.typesetPromise) {
        MathJax.typesetPromise();
    }
    setTimeout(reAttachHaptics, 200);
    
    // ===== Smart keyboard scroll — সব textarea এর জন্য =====
    setTimeout(() => initKeyboardScrollHandler(), 300);
}



function copyQuestionId(id) {
    if (!id) return;
   
    // আধুনিক পদ্ধতি (Clipboard API)
    if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(id).then(() => {
            showCopyToast(id);
        });
    } else {
        // ব্যাকআপ পদ্ধতি (যদি কোনো কারণে উপরেরটা কাজ না করে)
        let textArea = document.createElement("textarea");
        textArea.value = id;
        document.body.appendChild(textArea);
        textArea.select();
        try {
            document.execCommand('copy');
            showCopyToast(id);
        } catch (err) {
            console.error('Unable to copy', err);
        }
        document.body.removeChild(textArea);
    }
}

// কপি হওয়ারপর ছোট নোটিফিকেশন দেখানোর জন্য
function showCopyToast(id) {
    const toast = document.createElement('div');
    toast.innerText = "ID: " + id + " Copied!";
    toast.style = "position:fixed; bottom:100px; left:50%; transform:translateX(-50%); background:#4f46e5; color:white; padding:8px 15px; border-radius:20px; font-size:12px; z-index:9999; font-weight:bold; box-shadow:0 4px 12px rgba(0,0,0,0.2);";
    document.body.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transition = '0.5s';
        setTimeout(() => toast.remove(), 500);
    }, 1500);
}

function markAsCorrect(id) {
    if (!id) return;
    var rawId = String(id);
    var mode  = currentMode === 'qbank' ? 'qbank' : 'quiz';
    var sid   = mode + ':' + rawId;
    
    var correctHistory = JSON.parse(localStorage.getItem('correct_history') || '[]');
    if (!correctHistory.includes(sid)) {
        correctHistory.push(sid);
        localStorage.setItem('correct_history', JSON.stringify(correctHistory));
        // Memory cache invalidate করো — পরের render এ fresh data পাবে
        if (typeof _invalidateProgressCache === 'function') _invalidateProgressCache();
    }
    try { srMarkCorrect(sid); } catch(e) {}
    // Subject-wise tracking
    try {
        var _cItem = null;
        ['QBank','Study','Quiz'].forEach(function(sh){ if(fullData[sh]) fullData[sh].forEach(function(it){ if(String(getVal(it,'id')||getVal(it,'sl')||'')=== String(rawId)) _cItem=it; }); });
        if(_cItem) {
            var _subj = getVal(_cItem,'subject') || 'অন্যান্য';
            var _chap = getVal(_cItem,'sub_topic') || '';
            var _subjData = JSON.parse(localStorage.getItem('subj_stats')||'{}');
            if(!_subjData[_subj]) _subjData[_subj]={correct:0,wrong:0,chapters:{}};
            if(!_subjData[_subj].chapters) _subjData[_subj].chapters={};
            _subjData[_subj].correct++;
            if(_chap){
                if(!_subjData[_subj].chapters[_chap]) _subjData[_subj].chapters[_chap]={correct:0,wrong:0};
                _subjData[_subj].chapters[_chap].correct++;
            }
            localStorage.setItem('subj_stats', JSON.stringify(_subjData));
        }
    } catch(e) {}
    // Remove from wrong_q_ids
    var wrongIds = JSON.parse(localStorage.getItem('wrong_q_ids') || '[]');
    var widx = wrongIds.indexOf(sid);
    if (widx !== -1) {
        wrongIds.splice(widx, 1);
        localStorage.setItem('wrong_q_ids', JSON.stringify(wrongIds));
        setTimeout(function() { _hideReviewCard(sid); }, 600);
    }
}


function check(btn, sel, corRaw, qId) {
    const p = btn.parentElement; 
    if(p.classList.contains('done')) return; 
    p.classList.add('done'); 
    answeredCount++; 
    updateScore(); 

    let userAns = btn.innerText.toString().trim().toLowerCase();
    let actualAns = corRaw.toString().trim().toLowerCase();
    const card = p.closest('.card');

    if(userAns === actualAns) { 
        btn.classList.add('correct'); 
        markAsCorrect(qId);
        haptic('correct');
        if (card) { card.classList.add('flash-correct'); setTimeout(() => card.classList.remove('flash-correct'), 600); }
        playSound('correct');
        // XP Award
        awardXP(5);
        // Streak tracking
        window._correctStreak = (window._correctStreak || 0) + 1;
        if (window._correctStreak > 0 && window._correctStreak % 5 === 0) {
            showStreakPopup(window._correctStreak);
        }
    } else { 
        btn.classList.add('wrong'); 
        haptic('wrong');
        if (card) { card.classList.add('flash-wrong'); setTimeout(() => card.classList.remove('flash-wrong'), 600); }
        playSound('wrong');
        window._correctStreak = 0; // reset streak on wrong
        // Track wrong answer for weak topics
        const wrongTopic = quizItems.length > 0 ? (getVal(quizItems.find(q => getVal(q,'id') === qId) || {}, 'sub_topic') || getVal(quizItems.find(q => getVal(q,'id') === qId) || {}, 'subject') || 'অজানা') : 'অজানা';
        if (wrongTopic) trackWrongAnswer(wrongTopic, qId);
        const opts = p.querySelectorAll('.opt-btn');
        opts.forEach(opt => {
            if(opt.innerText.toString().trim().toLowerCase() === actualAns) {
                opt.classList.add('correct');
            }
        });
    } 
    
    updateReadingProgress();
    try { srUpdateHomeCard(); } catch(e) {}
    
    const exp = p.parentElement.querySelector('.exp-box'); 
    if(exp) { 
        exp.classList.remove('hidden'); 
        triggerMathJax(); 
    } 
}

        let totalQuizTime = 0;
        function startTimer(qCount) { 
            stopTimer(); 
            quizTime = qCount * 60; 
            totalQuizTime = quizTime;
            document.getElementById('pro-submit-bar').classList.remove('hidden');
            mTimer = setInterval(() => { 
                let m = Math.floor(quizTime/60), s = quizTime%60; 
                const timerEl = document.getElementById('timer-text');
                if(timerEl) {
                    timerEl.innerText = `${m}:${s<10?'0'+s:s}`;
                    // সময় কমলে রঙ বদলাও
                    const pct = quizTime / totalQuizTime;
                    timerEl.style.color = pct > 0.5 ? 'white' : pct > 0.25 ? '#fbbf24' : '#f87171';
                }
                if(quizTime-- <= 0) { playSound('timeup'); showResult(); } 
            }, 1000); 
        }
        function stopTimer() { clearInterval(mTimer); document.getElementById('pro-submit-bar').classList.add('hidden'); }
        function updateScore() { document.getElementById('score-text').innerText = `${answeredCount}/${quizItems.length} টি`; }
       function showResult() {
    const total = quizItems.length;
    let correct = 0, wrong = 0, skipped = 0;
    userExamData = []; 
    let subjectStats = {}; // subject-wise breakdown

    const cards = document.querySelectorAll('#main-view .card');
    cards.forEach((card, cardIdx) => {
        const isDone = card.querySelector('.options-container.done');
        const hasWrong = card.querySelector('.opt-btn.wrong');
        // Written question self-assessment check
        const selfAssessBox = card.querySelector('.self-assess-box');
        const selfCorrect = selfAssessBox && selfAssessBox.querySelector('.self-assess-done-correct');
        const selfWrong = selfAssessBox && selfAssessBox.querySelector('.self-assess-done-wrong');
        let status = 'skipped';

        if (isDone) {
            if (hasWrong) { status = 'wrong'; wrong++; } 
            else { status = 'correct'; correct++; }
        } else if (selfCorrect) {
            status = 'correct'; correct++;
        } else if (selfWrong) {
            status = 'wrong'; wrong++;
        } else { skipped++; }
        
        userExamData.push({ element: card, status: status });

        // Subject-wise stats
        if (cardIdx < quizItems.length) {
            const subj = getVal(quizItems[cardIdx], 'subject') || 'অন্যান্য';
            if (!subjectStats[subj]) subjectStats[subj] = { correct: 0, total: 0 };
            subjectStats[subj].total++;
            if (status === 'correct') subjectStats[subj].correct++;
        }
    });

    const pct = Math.round((correct / total) * 100);

    // Update daily goal
    updateDailyGoal(total);

    // Sticky result board update
    document.getElementById('sticky-result').classList.remove('hidden');
    document.getElementById('res-marks').innerText = pct;
    const totalQEl = document.getElementById('total-q-count'); if(totalQEl) totalQEl.innerText = total;
    document.getElementById('f-correct').innerText = correct;
    document.getElementById('f-wrong').innerText = wrong;
    document.getElementById('f-skipped').innerText = skipped;

    // Enhanced bottom sheet modal
    const emoji = pct >= 80 ? '🏆' : pct >= 60 ? '👏' : pct >= 40 ? '💪' : '📚';
    const title = pct >= 80 ? 'অসাধারণ!' : pct >= 60 ? 'ভালো হয়েছে!' : pct >= 40 ? 'চেষ্টা করো!' : 'আরো পড়তে হবে!';
    document.getElementById('rme-emoji').innerText = emoji;
    document.getElementById('rme-title').innerText = title;
    document.getElementById('rme-subtitle').innerText = `মোট ${total} প্রশ্নের মধ্যে ${correct} সঠিক, ${skipped} স্কিপ`;
    document.getElementById('rme-correct-n').innerText = correct;
    document.getElementById('rme-wrong-n').innerText = wrong;
    document.getElementById('rme-pct').innerText = pct + '%';
    // Conic gradient ring
    const deg = Math.round(pct * 3.6);
    document.getElementById('rme-score-ring').style.background = `conic-gradient(#6366f1 ${deg}deg, #e2e8f0 ${deg}deg)`;
    
    // Subject breakdown
    let breakdownHtml = '<p class="text-[10px] font-black text-gray-400 uppercase tracking-wider mb-3">বিষয় ভিত্তিক ফলাফল</p>';
    Object.entries(subjectStats).forEach(([subj, s]) => {
        const subPct = Math.round((s.correct / s.total) * 100);
        breakdownHtml += `<div class="subject-result-row">
            <span class="text-xs font-bold text-gray-600 w-24 truncate">${subj}</span>
            <div class="subject-result-bar"><div class="subject-result-fill" style="width:${subPct}%"></div></div>
            <span class="text-xs font-black text-indigo-600 w-10 text-right">${s.correct}/${s.total}</span>
        </div>`;
    });
    document.getElementById('rme-breakdown').innerHTML = breakdownHtml;
    
    // Show modal with slight delay
    setTimeout(() => {
        document.getElementById('result-modal-enhanced').classList.remove('hidden-modal');
    }, 400);

    stopTimer();
    // Analytics save
    if (currentUser && currentUser.phone) {
        try {
            saveQuizResultToFirebase({ correct, wrong,
                skipped: quizItems.length - correct - wrong,
                total: quizItems.length, pct,
                subject: quizItems[0] ? (getVal(quizItems[0],'subject')||'') : ''
            });
        } catch(e) {}
    }
    // Hide reading progress bar on submit
    document.getElementById('reading-progress-bar').classList.add('hidden');
    document.getElementById('q-counter-badge').style.display = 'none';
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function closeEnhancedResult() {
    document.getElementById('result-modal-enhanced').classList.add('hidden-modal');
}
function filterResults(type) {
    userExamData.forEach(item => {
        item.element.style.display = (type === 'all' || item.status === type) ? 'block' : 'none';
    });
    showToast(`${type === 'all' ? 'সবগুলো' : type} প্রশ্ন দেখানো হচ্ছে`);
}

function closeResult() {
    // result modal hide
    const modal = document.getElementById('result-modal-enhanced');
    if (modal) modal.classList.add('hidden-modal');
    // sticky result hide
    document.getElementById('sticky-result').classList.add('hidden');
    // timer stop
    stopTimer();
    // path এ আগের level এ ফিরে যাও (subject/topic list)
    if (path.length > 0) {
        path.pop(); // শেষ path সরাও
    }
    if (path.length === 0) {
        // subject list এ ফিরে যাও
        const backCtrl = document.getElementById('back-and-ctrls');
        if (backCtrl) { backCtrl.classList.add('hidden'); backCtrl.classList.remove('flex'); }
    }
    renderView();
    // Replace state (not push) so back button works correctly
    window.history.replaceState({mode: currentMode, path: [...path]}, '');
}



function shareResult() {
    var total = quizItems.length;
    var correctCount = parseInt((document.getElementById('f-correct') || {}).innerText || '0');
    var pct = total > 0 ? Math.round((correctCount / total) * 100) : 0;
    var todayStr = new Date().toLocaleDateString('bn-BD');
    var shareText = '\uD83C\uDFAF Smart Study \u2014 \u09B0\u09C7\u099C\u09BE\u09B2\u09CD\u099F\n\n' +
        '\uD83D\uDCC5 \u09A4\u09BE\u09B0\u09BF\u0996: ' + todayStr + '\n' +
        '\u2705 \u09B8\u09A0\u09BF\u0995: ' + correctCount + '/' + total + '\n' +
        '\uD83D\uDCCA \u09B8\u09CD\u0995\u09CB\u09B0: ' + pct + '%\n' +
        (pct >= 80 ? '\uD83C\uDFC6 \u0985\u09B8\u09BE\u09A7\u09BE\u09B0\u09A3!' : pct >= 60 ? '\uD83D\uDC4F \u09AD\u09BE\u09B2\u09CB \u09B9\u09AF\u09BC\u09C7\u099B\u09C7!' : '\uD83D\uDCAA \u0986\u09B0\u09CB \u099A\u09C7\u09B7\u09CD\u099F\u09BE \u0995\u09B0\u09CB!');
    if (navigator.share) {
        navigator.share({ title: 'Smart Study \u09B0\u09C7\u099C\u09BE\u09B2\u09CD\u099F', text: shareText })
            .catch(function() { fallbackShare(shareText); });
    } else {
        fallbackShare(shareText);
    }
}

function fallbackShare(text) {
    if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(text).then(function() { showToast('\u09B0\u09C7\u099C\u09BE\u09B2\u09CD\u099F \u0995\u09AA\u09BF \u09B9\u09AF\u09BC\u09C7\u099B\u09C7! \uD83D\uDCCB'); });
    } else {
        var ta = document.createElement('textarea');
        ta.value = text; document.body.appendChild(ta); ta.select();
        try { document.execCommand('copy'); showToast('\u09B0\u09C7\u099C\u09BE\u09B2\u09CD\u099F \u0995\u09AA\u09BF \u09B9\u09AF\u09BC\u09C7\u099B\u09C7! \uD83D\uDCCB'); } catch(e) {}
        document.body.removeChild(ta);
    }
}
        function reportQuestion(idx, event) {
            var item = quizItems[idx];
            var btn  = event.target;
            showReportDialog(function(issue) {
                if (!issue || !issue.trim()) return;
                btn.innerText = '⏳';
                // Sheet name — currentMode অনুযায়ী
                var sheetMap = { qbank: 'QBank', quiz: 'Quiz', study: 'Study' };
                var qSheet = sheetMap[currentMode] || 'QBank';
                // Phone — leading quote ও leading/trailing space ছাড়া
                var phone = (currentUser ? currentUser.phone : USER_PHONE)
                    .toString().replace(/^'+/, '').trim();
                var reportData = {
                    type:       'report',
                    Phone:      phone,
                    QSheet:     qSheet,
                    Subject:    getVal(item, 'subject')  || '',
                    SubTopic:   getVal(item, 'sub_topic') || '',
                    QuestionID: getVal(item, 'id')        || '',
                    Question:   (getVal(item, 'question') || '').replace(/<[^>]+>/g, '').slice(0, 200),
                    Issue:      issue.trim(),
                    Timestamp:  new Date().toLocaleString('bn-BD')
                };
                if (!navigator.onLine) {
                    addToPendingQueue(reportData);
                    showToast('📦 অফলাইনে রিপোর্ট সেভ হয়েছে।');
                    btn.innerText = '🚩'; return;
                }
                fetch(GAS_URL, {
                    method: 'POST', mode: 'no-cors',
                    headers: {'Content-Type':'application/json'},
                    body: JSON.stringify(reportData)
                })
                .then(function()  { showToast('✅ রিপোর্ট পাঠানো হয়েছে। ধন্যবাদ!'); })
                .catch(function() { addToPendingQueue(reportData); showToast('📦 রিপোর্ট অফলাইনে সেভ হয়েছে।'); })
                .finally(function() { btn.innerText = '🚩'; });
            });
        }

        function toggleSave(btn, item) { const q = getVal(item, 'question'), idx = savedQs.findIndex(s => getVal(s, 'question') === q); if(idx > -1) { savedQs.splice(idx, 1); btn.classList.remove('star-active'); } else { savedQs.push(item); btn.classList.add('star-active'); } localStorage.setItem('hs_saved', JSON.stringify(savedQs)); }

        function smartRefresh() {
            if (!navigator.onLine) {
                showToast('📴 নেট নেই — অফলাইন ক্যাশ থেকে চলছে');
                return;
            }
            document.getElementById('loader').classList.remove('hidden');
            // ✅ Immediately start Firebase fetch — cache clear এর জন্য অপেক্ষা না করে
            loadFirebaseData();
            showToast('🔄 ডেটা আপডেট হচ্ছে...');
            // SW cache clear in background (non-blocking)
            if ('caches' in window) {
                caches.keys().then(function(keys) {
                    return Promise.all(keys.map(function(k) { return caches.delete(k); }));
                }).catch(function() {});
            }
            setTimeout(function() {
                document.getElementById('loader').classList.add('hidden');
                const mv = document.getElementById('main-view');
                if (currentMode === 'home' && mv && typeof renderHome === 'function') renderHome(mv);
                else if (typeof renderView === 'function') renderView();
                showToast('✅ ডেটা আপডেট সম্পন্ন!');
            }, 3000);
        }

        function openMenu() { changeMode('menu'); }
        function toggleDarkMode() { document.body.classList.toggle('dark-theme'); }
        function clearCache() { 
            showConfirm('সব ডেটা রিসেট হবে। অফলাইন ক্যাশও মুছে যাবে। নিশ্চিত?', function() {
                localStorage.clear(); 
                if ('caches' in window) {
                    caches.keys().then(keys => keys.forEach(k => caches.delete(k)));
                }
                location.reload(); 
            });
        }
        function showSavedQuestions() { showSavedQWithFilter(); }

        function showFCMToken() {
            let token = "";
            try { token = AndroidBridge.getFCMToken(); } catch(e) { token = ""; }
            if (!token || token.trim() === "") {
                showToast("Token এখনো পাওয়া যায়নি। App একটু পর retry করুন।");
                return;
            }
            // Custom modal - prompt() blocked in WebView
            let modal = document.createElement('div');
            modal.id = 'fcm-modal';
            modal.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.7);z-index:99999;display:flex;align-items:center;justify-content:center;padding:20px;';
            modal.innerHTML = `
                <div style="background:#fff;border-radius:20px;padding:24px;width:100%;max-width:360px;box-shadow:0 20px 60px rgba(0,0,0,0.3);">
                    <p style="font-weight:900;font-size:16px;color:#1e293b;margin-bottom:4px;">🔔 FCM Token</p>
                    <p style="font-size:11px;color:#94a3b8;font-weight:700;margin-bottom:12px;">নিচের token টা copy করে Firebase-এ দিন</p>
                    <div id="fcm-token-box" style="background:#f1f5f9;border-radius:12px;padding:12px;font-size:10px;font-weight:700;color:#334155;word-break:break-all;line-height:1.6;border:2px solid #e2e8f0;margin-bottom:16px;max-height:120px;overflow-y:auto;">${token}</div>
                    <div style="display:flex;gap:10px;">
                        <button onclick="
                            var box = document.getElementById('fcm-token-box');
                            var range = document.createRange();
                            range.selectNode(box);
                            window.getSelection().removeAllRanges();
                            window.getSelection().addRange(range);
                            try { document.execCommand('copy'); showToast('Token copy হয়েছে! ✅'); } catch(e) { showToast('Manual copy করুন'); }
                            window.getSelection().removeAllRanges();
                        " style="flex:1;background:#4f46e5;color:white;border:none;border-radius:12px;padding:12px;font-weight:900;font-size:13px;cursor:pointer;">📋 Copy করুন</button>
                        <button onclick="document.getElementById('fcm-modal').remove();" style="flex:1;background:#f1f5f9;color:#64748b;border:none;border-radius:12px;padding:12px;font-weight:900;font-size:13px;cursor:pointer;">বন্ধ করুন</button>
                    </div>
                </div>`;
            document.body.appendChild(modal);
        }
      
var _mathJaxTimer = null;
function triggerMathJax() {
    // debounce — rapid call এ একবারই render করবে
    if (_mathJaxTimer) clearTimeout(_mathJaxTimer);
    _mathJaxTimer = setTimeout(function() {
        if (window.MathJax && MathJax.typesetPromise) {
            MathJax.typesetPromise().catch(function(e) {
                console.warn('MathJax error:', e);
            });
        }
    }, 80);
}
