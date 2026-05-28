/* Smart Study — home.js */
const MOTIVATIONAL_QUOTES = [
    { text: "সাফল্য একদিনে আসে না, প্রতিদিনের অভ্যাসই তোমাকে গড়ে তোলে।", author: "স্মার্ট স্টাডি" },
    { text: "কঠিন পথেই শক্তিশালী মানুষ তৈরি হয়।", author: "অজানা" },
    { text: "আজকের পরিশ্রম কালকের সাফল্যের বীজ।", author: "স্মার্ট স্টাডি" },
    { text: "স্বপ্ন দেখো, পরিশ্রম করো, সফল হও।", author: "অজানা" },
    { text: "প্রতিটি প্রশ্নের উত্তর তোমাকে পরীক্ষার এক ধাপ কাছে নিয়ে যায়।", author: "স্মার্ট স্টাডি" },
    { text: "ব্যর্থতা মানে শেষ নয়, এটি শেখার একটি সুযোগ।", author: "অজানা" },
    { text: "মনোযোগ দিয়ে পড়ো, ফলাফল নিজেই আসবে।", author: "স্মার্ট স্টাডি" },
    { text: "আজ যা পড়লে, কাল পরীক্ষায় কাজে লাগবে।", author: "অজানা" },
    { text: "লক্ষ্য স্থির রাখো, পথ নিজেই তৈরি হয়।", author: "স্মার্ট স্টাডি" },
    { text: "ধৈর্য ও পরিশ্রম — সাফল্যের দুই চাবিকাঠি।", author: "অজানা" },
];





function getUserName() { return localStorage.getItem('home_user_name') || ''; }
function getUserPic()  { return localStorage.getItem('home_user_pic')  || ''; }

function saveUserName(name) { localStorage.setItem('home_user_name', name); }

function homePickPhoto() {
    // যদি আগের ছবি থাকে তাহলে confirm করে নেওয়া দরকার
    var existingPic = (currentUser && currentUser.picture) ? currentUser.picture : localStorage.getItem('home_user_pic') || '';
    var _doPickPhoto = function() {
        var input = document.createElement('input');
        input.type = 'file'; input.accept = 'image/*';
        input.onchange = function() {
            var file = input.files[0];
            if (!file) return;
            var reader = new FileReader();
            reader.onload = function(e) {
                var b64pic = e.target.result;
                var img2 = new Image();
                img2.onload = function() {
                    // Resize canvas
                    var canvas = document.createElement('canvas');
                    var maxSz = 400;
                    var w = img2.width, h = img2.height;
                    if (w > maxSz || h > maxSz) {
                        if (w > h) { h = Math.round(h * maxSz / w); w = maxSz; }
                        else { w = Math.round(w * maxSz / h); h = maxSz; }
                    }
                    canvas.width = w; canvas.height = h;
                    canvas.getContext('2d').drawImage(img2, 0, 0, w, h);
                    var compressed = canvas.toDataURL('image/jpeg', 0.75);
                    var b64only = compressed.split(',')[1];

                    // Show preview immediately
                    var av = document.getElementById('home-avatar-img') || document.querySelector('.home-avatar img');
                    if (!av) {
                        // avatar এখনো DOM এ নেই — container এ inject করো
                        var avatarWrap = document.querySelector('.home-avatar');
                        if (avatarWrap) {
                            avatarWrap.innerHTML = '<img id="home-avatar-img" src="" style="width:100%;height:100%;object-fit:cover;border-radius:50%;"><span id="home-avatar-emoji" style="font-size:28px;display:none;">👤</span>';
                            av = document.getElementById('home-avatar-img');
                        }
                    }
                    if (av) { av.src = compressed; av.style.display='block'; var ae = document.getElementById('home-avatar-emoji'); if(ae) ae.style.display='none'; }
                    localStorage.setItem('home_user_pic', compressed);
                    if (currentUser) { currentUser.picture = compressed; saveCurrentUser(currentUser); }

                    showToast('⏳ ছবি upload হচ্ছে...');

                    // Upload to ImgBB — API key সরাসরি ব্যবহার
                    var IMGBB_KEY = '%%IMGBB_KEY%%';
                    var fd = new FormData();
                    fd.append('image', b64only);
                    fetch('https://api.imgbb.com/1/upload?key=' + IMGBB_KEY, { method: 'POST', body: fd })
                        .then(function(r) { return r.json(); })
                        .then(function(data) {
                            if (data && data.success && data.data && data.data.url) {
                                var imgUrl = data.data.display_url || data.data.url;
                                // Save URL to Firebase (much smaller than Base64)
                                savePicToFirebase(imgUrl);
                                // Update local cache with URL
                                localStorage.setItem('home_user_pic', imgUrl);
                                if (currentUser) { currentUser.picture = imgUrl; saveCurrentUser(currentUser); }
                                if (av) { av.src = imgUrl; av.style.display='block'; }
                                showToast('✅ ছবি সংরক্ষিত!');
                            } else {
                                // ImgBB failed — save Base64 as fallback
                                savePicToFirebase(compressed);
                                showToast('⚠️ ImgBB ব্যর্থ, local save হয়েছে');
                            }
                        })
                        .catch(function() {
                            // No internet — save Base64 to Firebase
                            savePicToFirebase(compressed);
                            showToast('📶 অফলাইন — ছবি local save হয়েছে');
                        });
                };
                img2.src = b64pic;
            };
            reader.readAsDataURL(file);
        };
        input.click();
    };

    // আগে ছবি থাকলে confirm করে নতুন ছবি নেওয়া হবে
    if (existingPic) {
        showConfirm('নতুন ছবি দিয়ে পুরনো ছবি বদলাবেন?', function() {
            _doPickPhoto();
        });
    } else {
        _doPickPhoto();
    }
}

// ── renderHome memoize cache ──────────────────────────────
var _homeRenderKey = '';
var _allQForReviewCache = null;
var _allQForReviewDataLen = 0;

function renderHome(container) {
    // Progress cache invalidate — fresh render
    if (typeof _invalidateProgressCache === 'function') _invalidateProgressCache();
    // Memoize: same data → skip full re-render, only update dynamic parts
    var _newKey = [
        localStorage.getItem('home_user_name')||'',
        localStorage.getItem('user_xp_'+(currentUser&&currentUser.phone||''))||'0',
        (fullData['QBank']||[]).length,
        (fullData['Study']||[]).length,
        (fullData['Quiz']||[]).length,
    ].join('|');

    var _existingHome = container && container.querySelector && container.querySelector('.home-render-root');
    if (_existingHome && _newKey === _homeRenderKey) {
        // শুধু dynamic parts update করো — full re-render না
        _updateHomeDynamic();
        return;
    }
    _homeRenderKey = _newKey;

    let xpInfo = {xp:0, currentLevel:{level:1,name:'নতুন শিক্ষার্থী',emoji:'🌱',minXP:0}, nextLevel:{level:2,name:'অনুসন্ধানী',minXP:100}};
    let streak = {streak:0};
    try { if(typeof getXPInfo==='function') xpInfo=getXPInfo()||xpInfo; } catch(e){}
    try { if(typeof getStreakInfo==='function') streak=getStreakInfo()||streak; } catch(e){}
    if(!xpInfo.currentLevel) xpInfo.currentLevel={level:1,name:'নতুন শিক্ষার্থী',emoji:'🌱',minXP:0};

    const userName = localStorage.getItem('home_user_name')||'';
    const userPic  = localStorage.getItem('home_user_pic') ||'';
    const examDate = localStorage.getItem('exam_date');
    const examName = localStorage.getItem('exam_name')||'পরীক্ষা';
    const dbReady  = (fullData['QBank']||[]).length>0||(fullData['Study']||[]).length>0;
    // মোট সঠিক: Firebase Summary cache প্রথমে, তারপর local fallback
    var _fbSummary = {};
    try { _fbSummary = JSON.parse(localStorage.getItem('fb_summary_cache')||'{}'); } catch(e){}
    var correctCount = (_fbSummary.totalCorrect > 0)
        ? _fbSummary.totalCorrect
        : (typeof _getCorrectSet === 'function' ? _getCorrectSet().size : 0);

    // XP bar
    const xpPct = xpInfo.nextLevel
        ? Math.min(100,Math.round((xpInfo.xp-xpInfo.currentLevel.minXP)/(xpInfo.nextLevel.minXP-xpInfo.currentLevel.minXP)*100))
        : 100;

    // Avatar — prefer currentUser.picture over localStorage
    var _picSrc = (currentUser && currentUser.picture) ? currentUser.picture : userPic;
    var _dispName = (currentUser && currentUser.name) ? currentUser.name : userName;
    var _dispRole = (currentUser && currentUser.role) ? currentUser.role : '';
    var _isAdminRole  = _dispRole.toLowerCase() === 'admin';
    var _roleCls       = _isAdminRole ? 'home-role-badge' : 'home-role-badge regular';
    var _roleBadgeHTML = _dispRole ? ('<span class="' + _roleCls + '">' + _dispRole + '</span>') : '';
    // User-এর class/type badge — Masters 1st, Job ইত্যাদি
    var _uType  = currentUser ? ((currentUser.userType  || currentUser.UserType  || '')).toString().trim() : '';
    var _uClass = currentUser ? ((currentUser.classLevel || currentUser.ClassLevel || '')).toString().trim() : '';
    var _classBadgeText = _uClass ? _uClass : (_uType && _uType !== 'General' ? _uType : '');
    var _classBadgeHTML = _classBadgeText
        ? ('<span style="background:rgba(255,255,255,0.18);color:rgba(255,255,255,0.9);font-size:9px;font-weight:800;padding:2px 8px;border-radius:20px;margin-left:4px;letter-spacing:0.3px;">' + _classBadgeText + '</span>')
        : '';
    const avatarInner = _picSrc
        ? `<img id="home-avatar-img" src="${_picSrc}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;" onerror="this.style.display='none'"><span id="home-avatar-emoji" style="font-size:28px;display:none;">👤</span>`
        : `<img id="home-avatar-img" src="" style="display:none;width:100%;height:100%;object-fit:cover;border-radius:50%;"><span id="home-avatar-emoji" style="font-size:28px;">👤</span>`;

    // ── Weekly streak dots — উন্নত ডিজাইন ──
    const daysBn = ['শনি','রবি','সোম','মঙ্গল','বুধ','বৃহস্পতি','শুক্র'];
    // JS getDay(): 0=Sun,1=Mon,...,6=Sat → আমরা শনি থেকে শুরু করি তাই map করি
    const todayJS = new Date().getDay(); // 0-6
    // শনি=6, রবি=0, সোম=1... আমাদের array: [শনি,রবি,সোম,মঙ্গল,বুধ,বৃহস্পতি,শুক্র]
    // index: শনি=0,রবি=1,সোম=2,মঙ্গল=3,বুধ=4,বৃহস্পতি=5,শুক্র=6
    const jsToOurIdx = [1,2,3,4,5,6,0]; // getDay() → our array idx
    const todayOurIdx = jsToOurIdx[todayJS];
    const streakDays = streak.streak || 0;

    const weekDots = daysBn.map((d, i) => {
        // আজ থেকে পেছনের দিকে streak দিন highlight
        const daysAgo = (todayOurIdx - i + 7) % 7;
        const isToday = i === todayOurIdx;
        const isDone  = !isToday && daysAgo <= streakDays && daysAgo > 0;
        const isFuture = !isToday && daysAgo > streakDays && daysAgo < 7 && ((i - todayOurIdx + 7) % 7 < 7);
        
        let bg, border, color, icon;
        if(isToday) {
            bg='linear-gradient(135deg,#6366f1,#4338ca)'; border='none'; color='white';
            icon = streakDays>0 ? '🔥' : '📍';
        } else if(isDone) {
            bg='#dcfce7'; border='1px solid #86efac'; color='#166534';
            icon = '✓';
        } else {
            bg='var(--card-bg)'; border='1px solid rgba(0,0,0,0.06)'; color='#cbd5e1';
            icon = '';
        }
        return `<div style="flex:1;border-radius:10px;padding:8px 3px;text-align:center;background:${bg};border:${border};">
            <div style="font-size:13px;line-height:1;margin-bottom:3px;">${icon}</div>
            <div style="font-size:8px;font-weight:800;color:${color};">${d}</div>
        </div>`;
    }).join('');

    // ── Recent wrong questions — একবার parse করো ──
    var wrongHistory; try { wrongHistory = JSON.parse(localStorage.getItem('wrong_history')||'{}'); } catch(e){ wrongHistory={}; }
    var wrongQIds;    try { wrongQIds    = JSON.parse(localStorage.getItem('wrong_q_ids')||'[]');    } catch(e){ wrongQIds=[]; }
    // Cache allQForReview — data change না হলে recalculate না
    var _curDataLen = (fullData['QBank']||[]).length + (fullData['Study']||[]).length + (fullData['Quiz']||[]).length;
    if (!_allQForReviewCache || _curDataLen !== _allQForReviewDataLen) {
        _allQForReviewCache = [...(fullData['QBank']||[]),...(fullData['Quiz']||[]),...(fullData['Study']||[])].filter(function(i){
            var t = (i.AudienceTags||i.audiencetags||'').toString();
            return isQuestionRelevant(t);
        });
        _allQForReviewDataLen = _curDataLen;
    }
    const allQForReview = _allQForReviewCache;
    // Recalculate weakTopics based on actual uncorrected wrong question IDs
    const topicWrongCount = {};
    wrongQIds.forEach(function(qid) {
        var item = allQForReview.find(function(i){ return String(getVal(i,'id')) === String(qid); });
        if (!item) return;
        var topic = getVal(item,'sub_topic') || getVal(item,'subject') || '';
        if (topic) topicWrongCount[topic] = (topicWrongCount[topic] || 0) + 1;
    });
    // Merge with wrongHistory for topics without IDs
    Object.entries(wrongHistory).forEach(function([topic, count]) {
        if (!topicWrongCount[topic]) topicWrongCount[topic] = count;
    });
    // weakTopics replaced by wrong_q_ids approach

    // ── Review Section: All wrong question IDs (format: "quiz:id" or "qbank:id") ──
    var _wrongQIds  = wrongQIds; // উপরে একবার parse হয়েছে
    // Count unique wrong questions (new format)
    // ID → item Map: find() O(n) এর বদলে O(1) lookup
    var _buildIdMap = function(arr) {
        var m = {};
        (arr||[]).forEach(function(i){ var id=String(getVal(i,'id')||''); if(id) m[id]=i; });
        return m;
    };
    var _qbMap = _buildIdMap(fullData['QBank']);
    var _qzMap = _buildIdMap(fullData['Quiz']);
    var _wrongItems = [];
    _wrongQIds.forEach(function(entry) {
        var parts = entry.indexOf(':') !== -1 ? [entry.split(':')[0], entry.split(':').slice(1).join(':')] : ['quiz', entry];
        var sheet = parts[0]; var qid = parts[1];
        var found = sheet === 'qbank' ? _qbMap[qid] : _qzMap[qid];
        if (found) { found._wrongEntry = entry; _wrongItems.push(found); }
    });
    var reviewHTML  = '';
    if (_wrongItems.length > 0) {
        // Get wrong count per question
        var _wqCount; try { _wqCount = JSON.parse(localStorage.getItem('wrong_q_count') || '{}'); } catch(e){ _wqCount={}; }
        var _previewItems = _wrongItems.slice(0, 2);

        // Build preview question cards
        var _previewCards = _previewItems.map(function(item) {
            var qText    = (getVal(item,'question')||'').replace(/<[^>]+>/g,'').slice(0,55);
            var topic    = getVal(item,'sub_topic') || getVal(item,'subject') || '';
            var rawType  = (getVal(item,'Question Type')||'').toLowerCase();
            var isW      = rawType === 'written';
            var typeIcon = isW ? '✍️' : '🔘';
            var typeClr  = isW ? '#7c3aed' : '#0284c7';
            var entry    = item._wrongEntry || '';
            var cnt      = parseInt(_wqCount[entry] || 1);
            var badgeClr = cnt >= 3 ? '#dc2626' : cnt === 2 ? '#f97316' : '#f59e0b';
            return '<div style="display:flex;align-items:flex-start;gap:10px;padding:9px 12px;background:white;border-radius:12px;margin-bottom:6px;border:1px solid #fde8e8;">' +
                '<div style="width:28px;height:28px;border-radius:8px;background:#fef2f2;display:flex;align-items:center;justify-content:center;font-size:14px;flex-shrink:0;margin-top:1px;">' + typeIcon + '</div>' +
                '<div style="flex:1;min-width:0;">' +
                    '<div style="font-size:12px;font-weight:700;color:#1e293b;line-height:1.4;">' + qText + (qText.length>=55?'…':'') + '</div>' +
                    '<div style="display:flex;align-items:center;gap:6px;margin-top:4px;">' +
                        '<span style="font-size:9px;color:'+typeClr+';font-weight:800;background:'+(isW?'#f3e8ff':'#e0f2fe')+';padding:2px 6px;border-radius:6px;">' + (isW?'Written':'MCQ') + '</span>' +
                        '<span style="font-size:9px;color:#64748b;font-weight:600;">' + topic + '</span>' +
                    '</div>' +
                '</div>' +
                '<span style="background:'+badgeClr+';color:white;font-size:9px;font-weight:900;padding:2px 7px;border-radius:10px;flex-shrink:0;margin-top:2px;">×'+cnt+'</span>' +
                '</div>';
        }).join('');

        var _remaining = _wrongItems.length;
        var _correctCount = correctCount;

        reviewHTML =
            '<div style="background:white;border-radius:16px;padding:14px;margin-bottom:10px;border:1.5px solid rgba(239,68,68,0.2);box-shadow:0 2px 12px rgba(239,68,68,0.08);">' +

            // Header
            '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">' +
                '<div style="display:flex;align-items:center;gap:8px;">' +
                    '<div style="width:32px;height:32px;background:linear-gradient(135deg,#dc2626,#f97316);border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:16px;">🔁</div>' +
                    '<div>' +
                        '<div style="font-weight:900;font-size:13px;color:#dc2626;">ভুল প্রশ্ন Review</div>' +
                        '<div style="font-size:10px;color:#94a3b8;font-weight:600;margin-top:1px;">আবার চেষ্টা করো</div>' +
                    '</div>' +
                '</div>' +
                // Stats pills
                '<div style="display:flex;gap:5px;align-items:center;">' +
                    '<div style="background:#fef2f2;border:1px solid #fecaca;border-radius:10px;padding:4px 9px;text-align:center;">' +
                        '<div style="font-size:14px;font-weight:900;color:#dc2626;line-height:1;">' + _remaining + '</div>' +
                        '<div style="font-size:9px;color:#94a3b8;font-weight:700;">ভুল</div>' +
                    '</div>' +
                    '<div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:4px 9px;text-align:center;">' +
                        '<div style="font-size:14px;font-weight:900;color:#16a34a;line-height:1;">' + _correctCount + '</div>' +
                        '<div style="font-size:9px;color:#94a3b8;font-weight:700;">সঠিক</div>' +
                    '</div>' +
                '</div>' +
            '</div>' +

            // Preview cards
            _previewCards +

            // Action button
            '<button onclick="openReviewPopup()" style="width:100%;padding:13px;background:linear-gradient(135deg,#dc2626,#ef4444);color:white;border:none;border-radius:12px;font-weight:900;font-size:13px;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;margin-top:4px;">' +
                '<span>🎯</span>' +
                '<span>' + (_wrongItems.length > 2 ? 'সব ' + _wrongItems.length + 'টি প্রশ্ন অনুশীলন করুন' : _wrongItems.length + 'টি ভুল প্রশ্ন অনুশীলন করুন') + '</span>' +
                '<span style="background:rgba(255,255,255,0.25);padding:2px 8px;border-radius:8px;font-size:11px;">' + _wrongItems.length + '</span>' +
            '</button>' +

            '</div>';
    }

    // ── আজকের টপিক — Study থেকে subtopic বা QBank থেকে প্রশ্নপত্র ──
    let topicHTML = '';
    if(dbReady) {
        // দিন অনুযায়ী Study বা QBank থেকে পালাক্রমে
        const dayNum = new Date().getDate();
        const useStudy = dayNum % 2 === 0;
        
        if(useStudy && (fullData['Study']||[]).length > 0) {
            // Study থেকে subtopic — audience filter
            const studyItems = (fullData['Study']||[]).filter(function(i){
                var t = (i.AudienceTags||i.audiencetags||'').toString();
                return isQuestionRelevant(t);
            });
            const allSubtopics = [...new Set(studyItems.map(i=>getVal(i,'sub_topic')).filter(t=>t))];
            if(allSubtopics.length > 0) {
                const topic = allSubtopics[dayNum % allSubtopics.length];
                const count = studyItems.filter(i=>getVal(i,'sub_topic')===topic).length;
                const subj = (studyItems.find(i=>getVal(i,'sub_topic')===topic)||{});
                const subjName = getVal(subj,'subject')||'';
                const safeTopic = topic.replace(/'/g,"\\'");
                topicHTML = `<div onclick="goTodayTopic('${safeTopic}','study')" style="background:linear-gradient(135deg,#ecfdf5,#d1fae5);border-radius:14px;padding:12px 14px;margin-bottom:8px;border:1px solid #a7f3d0;cursor:pointer;">
                    <div style="font-size:10px;color:#059669;font-weight:800;margin-bottom:4px;">📌 আজকের পাঠ — Study</div>
                    <div style="display:flex;justify-content:space-between;align-items:center;">
                        <div>
                            <div style="font-size:15px;font-weight:900;color:#065f46;">${topic}</div>
                            <div style="font-size:11px;color:#047857;margin-top:2px;">${subjName} · ${count} টি প্রশ্ন</div>
                        </div>
                        <div style="font-size:28px;">📖</div>
                    </div>
                </div>`;
            }
        } else if((fullData['QBank']||[]).length > 0) {
            // QBank থেকে প্রশ্নপত্র — audience filter
            const qbItems = (fullData['QBank']||[]).filter(function(i){
                var t = (i.AudienceTags||i.audiencetags||'').toString();
                return isQuestionRelevant(t);
            });
            const allSubtopics = [...new Set(qbItems.map(i=>getVal(i,'sub_topic')).filter(t=>t))];
            if(allSubtopics.length > 0) {
                const topic = allSubtopics[dayNum % allSubtopics.length];
                const count = qbItems.filter(i=>getVal(i,'sub_topic')===topic).length;
                const subj = (qbItems.find(i=>getVal(i,'sub_topic')===topic)||{});
                const subjName = getVal(subj,'subject')||'';
                const safeTopic = topic.replace(/'/g,"\\'");
                topicHTML = `<div onclick="goTodayTopic('${safeTopic}','qbank')" style="background:linear-gradient(135deg,#eff6ff,#dbeafe);border-radius:14px;padding:12px 14px;margin-bottom:8px;border:1px solid #bfdbfe;cursor:pointer;">
                    <div style="font-size:10px;color:#2563eb;font-weight:800;margin-bottom:4px;">📌 আজকের প্রশ্নপত্র — QBank</div>
                    <div style="display:flex;justify-content:space-between;align-items:center;">
                        <div>
                            <div style="font-size:15px;font-weight:900;color:#1e40af;">${topic}</div>
                            <div style="font-size:11px;color:#3b82f6;margin-top:2px;">${subjName} · ${count} টি প্রশ্ন</div>
                        </div>
                        <div style="font-size:28px;">📚</div>
                    </div>
                </div>`;
            }
        }
    }

    // ── Exam countdown ──
    let examHTML = '';
    if(examDate) {
        examHTML = `<div style="background:linear-gradient(135deg,#1e1b4b,#312e81);border-radius:14px;padding:12px 14px;margin-bottom:8px;color:white;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
                <div>
                    <div style="font-size:10px;opacity:0.6;font-weight:700;">পরীক্ষার কাউন্টডাউন ⏳</div>
                    <div style="font-size:15px;font-weight:900;">${examName}</div>
                </div>
                <span style="font-size:22px;">Exam</span>
            </div>
            <div style="display:flex;gap:6px;justify-content:center;">
                <div style="background:rgba(255,255,255,0.1);border-radius:10px;padding:7px 10px;text-align:center;flex:1;border:1px solid rgba(255,255,255,0.12);">
                    <div id="cd-days" style="font-size:20px;font-weight:900;">--</div>
                    <div style="font-size:9px;opacity:0.55;font-weight:700;">দিন</div>
                </div>
                <div style="background:rgba(255,255,255,0.1);border-radius:10px;padding:7px 10px;text-align:center;flex:1;border:1px solid rgba(255,255,255,0.12);">
                    <div id="cd-hours" style="font-size:20px;font-weight:900;">--</div>
                    <div style="font-size:9px;opacity:0.55;font-weight:700;">ঘণ্টা</div>
                </div>
                <div style="background:rgba(255,255,255,0.1);border-radius:10px;padding:7px 10px;text-align:center;flex:1;border:1px solid rgba(255,255,255,0.12);">
                    <div id="cd-mins" style="font-size:20px;font-weight:900;">--</div>
                    <div style="font-size:9px;opacity:0.55;font-weight:700;">মিনিট</div>
                </div>
                <div style="background:rgba(255,255,255,0.1);border-radius:10px;padding:7px 10px;text-align:center;flex:1;border:1px solid rgba(255,255,255,0.12);">
                    <div id="cd-secs" style="font-size:20px;font-weight:900;">--</div>
                    <div style="font-size:9px;opacity:0.55;font-weight:700;">সেকেন্ড</div>
                </div>
            </div>
        </div>`;
    }

    // Daily challenge progress
    const today2 = new Date().toDateString();
    const chalDone = parseInt(localStorage.getItem('challenge_done_'+today2)||'0');
    const chalPct  = Math.min(100, chalDone/5*100);

    container.innerHTML = `<div class="home-render-root" style="padding-bottom:85px;">

    <!-- HERO -->
    <div class="home-hero">
        <!-- User Card -->
        <div class="home-user-card">
            <div class="home-avatar" onclick="homePickPhoto()" title="ছবি বদলাও">${avatarInner}</div>
            <div class="home-user-info">
                <div class="home-user-greeting">স্বাগতম! 👋</div>
                <div class="home-user-name">${_dispName||'নাম লিখো...'}</div>
                <div class="home-user-meta">
                    ${_roleBadgeHTML}${_classBadgeHTML}
                    <span class="home-level-badge">${xpInfo.currentLevel.emoji} Lv.${xpInfo.currentLevel.level} · ${xpInfo.currentLevel.name}</span>
                </div>
            </div>
            <div class="home-xp-right">
                <div style="display:flex;align-items:center;gap:4px;background:linear-gradient(135deg,#f59e0b,#d97706);border-radius:12px;padding:6px 10px;">
                    <span style="font-size:16px;">⭐</span>
                    <div>
                        <div style="font-size:16px;font-weight:900;color:white;line-height:1;">${xpInfo.xp}</div>
                        <div style="font-size:8px;color:rgba(255,255,255,0.8);font-weight:800;letter-spacing:0.5px;">XP</div>
                    </div>
                </div>
            </div>
        </div>
        <!-- XP Bar -->
        <div class="home-xp-bar-wrap">
            <div class="home-xp-bar"><div class="home-xp-fill" style="width:${xpPct}%;"></div></div>
            <div class="home-xp-labels">
                <span>Level ${xpInfo.currentLevel.level}</span>
                <span>${xpInfo.nextLevel?(xpInfo.nextLevel.minXP-xpInfo.xp)+' XP → '+xpInfo.nextLevel.name:'🏆 সর্বোচ্চ!'}</span>
            </div>
        </div>
    </div>

    <div style="padding:0 12px;">



    <!-- SR: আজকের Revision card -->
    <div id="sr-revision-card" onclick="startRevisionMode()" style="display:none;background:linear-gradient(135deg,#7c3aed,#4f46e5);border-radius:14px;padding:12px 14px;margin-bottom:7px;cursor:pointer;border:1px solid rgba(139,92,246,0.4);">
        <div style="display:flex;justify-content:space-between;align-items:center;">
            <div>
                <div style="color:white;font-weight:900;font-size:13px;">🔁 আজকের Revision</div>
                <div style="color:rgba(255,255,255,0.7);font-size:11px;font-weight:700;margin-top:2px;" id="sr-due-label">লোড হচ্ছে...</div>
            </div>
            <div style="background:rgba(255,255,255,0.2);border-radius:10px;padding:6px 12px;color:white;font-weight:900;font-size:18px;" id="sr-due-count">0</div>
        </div>
    </div>

    <!-- COMPACT STATS CARD — home -->
    <div onclick="showStatsPage()" style="background:linear-gradient(135deg,#1e1b4b,#312e81);border-radius:14px;padding:12px 14px;margin-bottom:7px;border:1px solid rgba(99,102,241,0.3);cursor:pointer;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
            <div style="color:white;font-weight:900;font-size:13px;">📊 আমার পরিসংখ্যান</div>
            <div style="color:rgba(255,255,255,0.5);font-size:11px;font-weight:700;">বিস্তারিত ❯</div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:6px;">
            <div style="background:rgba(255,255,255,0.08);border-radius:10px;padding:8px 4px;text-align:center;">
                <div style="font-size:16px;font-weight:900;color:#4ade80;">${correctCount}</div>
                <div style="font-size:8px;font-weight:800;color:rgba(255,255,255,0.5);margin-top:2px;">সঠিক</div>
            </div>
            <div style="background:rgba(255,255,255,0.08);border-radius:10px;padding:8px 4px;text-align:center;">
                <div style="font-size:16px;font-weight:900;color:#f87171;">${Object.values(wrongHistory).reduce(function(a,b){return a+b;},0)}</div>
                <div style="font-size:8px;font-weight:800;color:rgba(255,255,255,0.5);margin-top:2px;">ভুল</div>
            </div>
            <div style="background:rgba(255,255,255,0.08);border-radius:10px;padding:8px 4px;text-align:center;">
                <div style="font-size:16px;font-weight:900;color:#a78bfa;">${(function(){var c=JSON.parse(localStorage.getItem('correct_history')||'[]').length;var w=Object.values(JSON.parse(localStorage.getItem('wrong_history')||'{}')).reduce(function(a,b){return a+b;},0);var t=c+w;return t>0?Math.round(c/t*100)+'%':'0%';}())}</div>
                <div style="font-size:8px;font-weight:800;color:rgba(255,255,255,0.5);margin-top:2px;">নির্ভুলতা</div>
            </div>
            <div style="background:rgba(255,255,255,0.08);border-radius:10px;padding:8px 4px;text-align:center;">
                <div style="font-size:16px;font-weight:900;color:#fbbf24;">${getTodayStudyTime()}</div>
                <div style="font-size:8px;font-weight:800;color:rgba(255,255,255,0.5);margin-top:2px;">মিনিট</div>
            </div>
        </div>
    </div>

    <!-- TYPING TEST — first screen এ দেখাবে -->
    <div onclick="openTypingTest()" style="background:linear-gradient(135deg,#0c4a6e,#0369a1);border-radius:14px;padding:12px 14px;margin-bottom:7px;display:flex;justify-content:space-between;align-items:center;cursor:pointer;border:1px solid rgba(56,189,248,0.25);box-shadow:0 2px 10px rgba(3,105,161,0.2);">
        <div>
            <div style="color:white;font-weight:900;font-size:14px;">⌨️ Typing Speed Test</div>
            <div style="color:rgba(255,255,255,0.6);font-size:11px;margin-top:1px;">টাইপিং স্পিড ও নির্ভুলতা যাচাই করো</div>
        </div>
        <div style="background:rgba(56,189,248,0.25);border-radius:10px;padding:6px 12px;color:#7dd3fc;font-weight:900;font-size:13px;">শুরু করো ❯</div>
    </div>

    <!-- LEADERBOARD + DAILY CHALLENGE: side by side -->
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:7px;margin-bottom:7px;">
        <div onclick="openLeaderboard()" style="background:linear-gradient(135deg,#5b21b6,#7c3aed);border-radius:14px;padding:12px 12px;display:flex;flex-direction:column;justify-content:space-between;cursor:pointer;border:1px solid rgba(167,139,250,0.3);min-height:72px;">
            <div style="color:rgba(255,255,255,0.6);font-size:10px;font-weight:800;">🏆 Leaderboard</div>
            <div style="color:white;font-size:12px;font-weight:900;margin-top:4px;">র‍্যাংকিং দেখো ❯</div>
        </div>
        <div style="background:linear-gradient(135deg,#0f172a,#1e293b);border-radius:14px;padding:12px 12px;border:1px solid rgba(99,102,241,0.25);min-height:72px;display:flex;flex-direction:column;justify-content:space-between;">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;">
                <div style="color:rgba(255,255,255,0.6);font-size:10px;font-weight:800;">⚡ চ্যালেঞ্জ</div>
                <span style="font-size:10px;color:#a78bfa;font-weight:900;">${chalDone}/5</span>
            </div>
            <button onclick="startDailyChallenge()" style="background:${dbReady?'linear-gradient(135deg,#6366f1,#4338ca)':'#475569'};color:white;padding:5px 10px;border-radius:9px;font-weight:900;font-size:11px;border:none;cursor:pointer;margin-top:6px;">${chalDone>=5?'🏆 সম্পন্ন':dbReady?'শুরু →':'...'}</button>
        </div>
    </div>

    <!-- WEEKLY STREAK compact -->
    <div style="background:var(--card-bg);border-radius:14px;padding:10px 12px;margin-bottom:7px;border:1px solid rgba(0,0,0,0.05);">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
            <div style="font-size:12px;font-weight:900;">সাপ্তাহিক Streak</div>
            <div style="font-size:10px;font-weight:800;color:#f59e0b;background:#fffbeb;padding:2px 9px;border-radius:20px;border:1px solid #fde68a;">🔥 ${streak.streak} দিন</div>
        </div>
        <div style="display:flex;gap:4px;">${weekDots}</div>
    </div>

  <!-- EXAM -->
    ${examHTML}

    <!-- TODAY TOPIC -->
    ${topicHTML}

    <!-- REVIEW -->
    ${reviewHTML}

    </div></div>`;

    // Countdown শুরু
    if(examDate && typeof startCountdownTick==='function') setTimeout(startCountdownTick,50);
}




// ═══════════════════════════════════════════
// ⌨️  TYPING TEST — Full Overlay System
// ═══════════════════════════════════════════


// ── Home dynamic-only update (memoize) ──────────────────────
function _updateHomeDynamic() {
    // Countdown timer update
    try {
        var cd = document.getElementById('home-countdown-text');
        if (cd && localStorage.getItem('exam_date')) {
            var diff = new Date(localStorage.getItem('exam_date')) - new Date();
            var days = Math.max(0, Math.ceil(diff / 86400000));
            cd.textContent = days + ' দিন বাকি';
        }
    } catch(e) {}
}
