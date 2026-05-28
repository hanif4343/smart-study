/* Smart Study — config.js */
        const FIREBASE_URL = "%%FIREBASE_URL%%";
        const SECRET_KEY = "%%SECRET_KEY%%";
        const GAS_URL = "%%GAS_URL%%"; 
        const USER_PHONE = "%%ADMIN_PHONE%%"; 
        let fullData = {}, currentMode = 'study', path = [], quizItems = [], displayLimit = 20, savedQs = JSON.parse(localStorage.getItem('hs_saved') || '[]');
        // ── Auth State ──
        var currentUser = null;
        function loadCurrentUser() { try { currentUser = JSON.parse(localStorage.getItem('ss_user') || 'null'); } catch(e) { currentUser = null; } }

        /* ── User Type Selection (Signup) ── */
        window._selectedUserType = null;
        function selectUserType(type) {
            window._selectedUserType = type;

            // Button highlight
            document.querySelectorAll('[id^="utype-"]').forEach(b => {
                b.style.background = 'rgba(255,255,255,0.1)';
                b.style.borderColor = 'rgba(255,255,255,0.3)';
                b.style.color = 'white';
            });
            var btn = document.getElementById('utype-' + type);
            if (btn) {
                btn.style.background = 'white';
                btn.style.borderColor = 'white';
                btn.style.color = '#4f46e5';
            }

            // Level section — Job বা Student হলে দেখাও, options আলাদা
            var cls = document.getElementById('class-level-section');
            var lbl = document.getElementById('class-level-label');
            var sel = document.getElementById('signup-class');

            // Student options
            var studentOptions = [
                ['', '-- শ্রেণি বেছে নিন --'],
                ['Class 3',  '৩য় শ্রেণি'],
                ['Class 4',  '৪র্থ শ্রেণি'],
                ['Class 5',  '৫ম শ্রেণি'],
                ['Class 6',  '৬ষ্ঠ শ্রেণি'],
                ['Class 7',  '৭ম শ্রেণি'],
                ['Class 8',  '৮ম শ্রেণি'],
                ['Class 9',  '৯ম শ্রেণি'],
                ['Class 10', '১০ম শ্রেণি (SSC)'],
                ['HSC 1st',  'HSC ১ম বর্ষ'],
                ['HSC 2nd',  'HSC ২য় বর্ষ'],
                ['Degree 1st',  'ডিগ্রি ১ম বর্ষ'],
                ['Degree 2nd',  'ডিগ্রি ২য় বর্ষ'],
                ['Degree 3rd',  'ডিগ্রি ৩য় বর্ষ'],
                ['Masters 1st', 'মাস্টার্স ১ম বর্ষ'],
                ['Masters 2nd', 'মাস্টার্স ২য় বর্ষ'],
            ];

            // Job options (16-20th grade চাকরি)
            var jobOptions = [
                ['', '-- গ্রেড / পদ বেছে নিন --'],
                ['Grade 16', '১৬তম গ্রেড'],
                ['Grade 17', '১৭তম গ্রেড'],
                ['Grade 18', '১৮তম গ্রেড'],
                ['Grade 19', '১৯তম গ্রেড'],
                ['Grade 20', '২০তম গ্রেড'],
            ];

            if (type === 'Student') {
                if (cls) cls.style.display = 'block';
                if (lbl) lbl.textContent = 'শ্রেণি / বর্ষ সিলেক্ট করুন';
                if (sel) {
                    sel.innerHTML = studentOptions.map(function(o) {
                        return '<option value="' + o[0] + '" style="color:#1e293b;">' + o[1] + '</option>';
                    }).join('');
                }
            } else if (type === 'Job') {
                if (cls) cls.style.display = 'block';
                if (lbl) lbl.textContent = 'চাকরির গ্রেড সিলেক্ট করুন';
                if (sel) {
                    sel.innerHTML = jobOptions.map(function(o) {
                        return '<option value="' + o[0] + '" style="color:#1e293b;">' + o[1] + '</option>';
                    }).join('');
                }
            } else {
                // General — level দরকার নেই
                if (cls) cls.style.display = 'none';
            }
        }

        /* ── User-এর audience tags বের করো (filter-এ ব্যবহার হবে) ── */
        // ══════════════════════════════════════════
        // Admin View Override — logout ছাড়াই যেকোনো mode-এ preview
        // ══════════════════════════════════════════
        var _adminViewOverride = null; // null = নিজের real mode, otherwise {userType, classLevel}

        function setAdminView(userType, classLevel) {
            if (!isAdmin()) return;
            if (!userType) {
                _adminViewOverride = null;
                showToast('✅ নিজের view-এ ফিরে এসেছ');
            } else {
                _adminViewOverride = { userType: userType, classLevel: classLevel || '' };
                var label = classLevel ? classLevel : userType;
                showToast('👁 Preview: ' + label);
            }
            // Re-render current view
            if (typeof renderView === 'function') renderView();
            renderAdminViewBadge();
        }

        function getEffectiveUser() {
            if (_adminViewOverride && isAdmin()) {
                return Object.assign({}, currentUser, {
                    userType:   _adminViewOverride.userType,
                    UserType:   _adminViewOverride.userType,
                    classLevel: _adminViewOverride.classLevel,
                    ClassLevel: _adminViewOverride.classLevel
                });
            }
            return currentUser;
        }

        function renderAdminViewBadge() {
            var badge = document.getElementById('admin-view-badge');
            if (!badge) return;
            if (_adminViewOverride && isAdmin()) {
                var label = _adminViewOverride.classLevel || _adminViewOverride.userType || 'সবাই';
                badge.style.display = 'flex';
                badge.innerHTML = '👁 <strong style="margin:0 4px;">' + label + '</strong> <span onclick="setAdminView(null)" style="cursor:pointer;opacity:0.8;font-size:11px;">✕ নিজের view</span>';
            } else {
                badge.style.display = 'none';
            }
        }

        function getUserAudienceTags() {
            var _eu = getEffectiveUser();
            if (!_eu) return ['General'];
            var uType  = (_eu.userType  || _eu.UserType  || '').trim();
            var uClass = (_eu.classLevel || _eu.ClassLevel || '').trim();
            var tags = [];

            if (uType === 'Job') {
                tags.push('Job');
                if (uClass) tags.push(uClass); // Grade 16, Grade 17...
            } else if (uType === 'Student' && uClass) {
                tags.push(uClass); // Class 3, Masters 1st...
                if (uClass.indexOf('HSC') !== -1 || uClass.indexOf('Degree') !== -1 || uClass.indexOf('Masters') !== -1) {
                    tags.push('Higher');
                }
            } else {
                tags.push('General');
            }
            return tags;
        }

        /* ── Strict audience user কিনা (Job / Masters / Degree / HSC) ── */
        function isStrictAudienceUser() {
            var _eu = getEffectiveUser();
            if (!_eu) return false;
            var uType  = (_eu.userType  || _eu.UserType  || '').trim();
            var uClass = (_eu.classLevel || _eu.ClassLevel || '').trim();
            if (uType === 'Job') return true;
            if (uType === 'Student' && uClass) {
                return uClass.indexOf('Masters') !== -1 ||
                       uClass.indexOf('Degree')  !== -1 ||
                       uClass.indexOf('HSC')     !== -1;
            }
            return false;
        }

        /* ── Question টি user-এর জন্য relevant কিনা ── */
        // ── Audience filter cache: প্রতি session এ একবার compute ──
        var _audienceCache = null;
        function _getAudienceCache() {
            if (_audienceCache) return _audienceCache;
            var strict = isStrictAudienceUser();
            var userTags = getUserAudienceTags().map(function(t){ return t.toLowerCase(); });
            _audienceCache = { strict: strict, userTags: userTags };
            return _audienceCache;
        }
        function invalidateAudienceCache() { _audienceCache = null; }

        function isQuestionRelevant(audienceTags) {
            var ac = _getAudienceCache();
            if (!audienceTags || audienceTags.trim() === '') return !ac.strict;
            var qTags = audienceTags.split(',').map(function(t){ return t.trim().toLowerCase(); });
            if (qTags.indexOf('general') !== -1) return !ac.strict;
            return qTags.some(function(qt){ return ac.userTags.indexOf(qt) !== -1; });
        }
        function saveCurrentUser(u) { currentUser = u; localStorage.setItem('ss_user', JSON.stringify(u)); }
        function clearCurrentUser() { currentUser = null; localStorage.removeItem('ss_user'); }
        function isAdmin() { return !!(currentUser && currentUser.role && currentUser.role.toLowerCase() === 'admin'); }
        function isLoggedIn() { return !!currentUser; }
        // ── Safe helper: encode value for edit modal ──
        function encodeEditVal(v) { return (v||'').replace(/\\/g,'\\\\').replace(/'/g,"\\'").replace(/"/g,'&quot;').replace(/\n/g,'\\n'); }
        // ── Safe pic helper ──
        function buildUserPicHtml(picUrl, size) {
            var sz = size || 64;
            var css = 'width:'+sz+'px;height:'+sz+'px;border-radius:50%;flex-shrink:0;';
            if (picUrl) {
                return '<img src="'+picUrl+'" style="'+css+'object-fit:cover;border:3px solid rgba(255,255,255,0.4);" onerror="this.style.display=\'none\'">';
            }
            return '<div style="'+css+'background:rgba(255,255,255,0.2);display:flex;align-items:center;justify-content:center;font-size:'+(sz/2.5|0)+'px;">👤</div>';
        }
        loadCurrentUser();

        // Override ALL native JS dialogs — no "The page at file://" ever
        window.alert   = function(msg) { if(typeof showToast==='function') showToast(String(msg).substring(0,150)); };
        window.confirm = function(msg, onOk, onCancel) { if(typeof showConfirm==='function'){ showConfirm(msg, onOk||function(){}, onCancel||function(){}); } return false; };
        window.prompt  = function(msg, def) { return def||''; };


        let mTimer, quizTime = 0, answeredCount = 0, selectedSubTopics = [];
        let selectedQId = null, editingField = '';
        let userExamData = [];
        function hideSplash() {
            // splash screen hide
            var splash = document.getElementById('splash-screen');
            if (splash) {
                splash.style.opacity = '0';
                splash.style.transition = 'opacity 0.3s';
                setTimeout(function() { splash.classList.add('hidden'); }, 400);
            }
            // loader spinner hide
            var loader = document.getElementById('loader');
            if (loader) { loader.classList.add('hidden'); }
        }

        let scale = 1, lastScale = 1, posX = 0, posY = 0, lastPosX = 0, lastPosY = 0;
        let startX = 0, startY = 0, startDist = 0;
        let isDragging = false, isZoomOpen = false;

        const overlay = document.getElementById('image-zoom-overlay');
        const zoomedImg = document.getElementById('zoomed-image');

        function openImageZoom(url) {
            zoomedImg.src = url;
            overlay.style.display = 'flex';
            isZoomOpen = true;
            window.history.pushState({view: 'zoom'}, "");
            scale = 1; posX = 0; posY = 0; lastScale = 1;
            updateTransform();
            
            overlay.addEventListener('touchstart', handleTouchStart, {passive: false});
            overlay.addEventListener('touchmove', handleTouchMove, {passive: false});
            overlay.addEventListener('touchend', handleTouchEnd);
        }

        function handleZoomCloseBtn() {
            window.history.back(); 
        }

        function closeImageZoom() {
            overlay.style.display = 'none';
            isZoomOpen = false;
            zoomedImg.src = "";
            overlay.removeEventListener('touchstart', handleTouchStart);
            overlay.removeEventListener('touchmove', handleTouchMove);
            overlay.removeEventListener('touchend', handleTouchEnd);
        }

        function handleTouchStart(e) {
            if (e.touches.length === 2) {
                startDist = Math.hypot(e.touches[0].pageX - e.touches[1].pageX, e.touches[0].pageY - e.touches[1].pageY);
            } else if (e.touches.length === 1) {
                isDragging = true;
                startX = e.touches[0].pageX - posX;
                startY = e.touches[0].pageY - posY;
            }
        }

        function handleTouchMove(e) {
            if (!isZoomOpen) return;
            e.preventDefault();
            if (e.touches.length === 2) {
                const dist = Math.hypot(e.touches[0].pageX - e.touches[1].pageX, e.touches[0].pageY - e.touches[1].pageY);
                scale = Math.min(Math.max(1, lastScale * (dist / startDist)), 5);
                updateTransform();
            } else if (e.touches.length === 1 && isDragging) {
                posX = e.touches[0].pageX - startX;
                posY = e.touches[0].pageY - startY;
                updateTransform();
            }
        }

        function handleTouchEnd(e) { lastScale = scale; isDragging = false; }
        function updateTransform() { if (scale === 1) { posX = 0; posY = 0; } zoomedImg.style.transform = `translate(${posX}px, ${posY}px) scale(${scale})`; }

        window.addEventListener('popstate', function(event) {
    // 0. Typing overlay back — result → home → close
    var _to = document.getElementById('typing-overlay');
    if (_to && _to.style.display !== 'none') {
        var badge = document.getElementById('tt-mode-badge');
        var badgeText = badge ? badge.innerText : '';
        if (badgeText === 'RESULT') {
            // result থেকে home এ যাও
            renderTypingHome();
            history.pushState({mode:currentMode,path:[...path]},'');
            return;
        } else if (badgeText !== 'HOME') {
            // practice থেকে home এ যাও
            ttStop();
            renderTypingHome();
            history.pushState({mode:currentMode,path:[...path]},'');
            return;
        } else {
            // home থেকে typing overlay বন্ধ করো
            closeTypingTest();
            history.pushState({mode:currentMode,path:[...path]},'');
            return;
        }
    }

    // 1. Image zoom close
    if (isZoomOpen) { closeImageZoom(); history.pushState({mode:currentMode,path:[...path]},''); return; }

    // 2. Result modal close
    var _rm = document.getElementById('result-modal-enhanced');
    if (_rm && !_rm.classList.contains('hidden-modal')) { closeResult(); return; }

    // 3. Leaderboard close
    var _lb = document.getElementById('leaderboard-modal');
    if (_lb && _lb.style.display === 'flex') { closeLeaderboard(); history.pushState({mode:currentMode,path:[...path]},''); return; }

    // 4. Review popup close
    var _rp = document.getElementById('review-popup-sheet');
    if (_rp && _rp.style.display === 'flex') { closeReviewPopup(); return; }

    // 5. Report dialog close
    var _rd = document.getElementById('report-dialog-modal');
    if (_rd && _rd.style.display === 'flex') { _rd.style.display='none'; history.pushState({mode:currentMode,path:[...path]},''); return; }

    // 5. Custom confirm close
    var _cc = document.getElementById('custom-confirm-modal');
    if (_cc && _cc.style.display === 'flex') { _cc.style.display='none'; history.pushState({mode:currentMode,path:[...path]},''); return; }

    document.getElementById('sticky-result').classList.add('hidden');

    if (event.state && event.state.mode) {
        stopTimer();
        currentMode = event.state.mode;
        path = [...(event.state.path || [])];
        updateUIMode(currentMode);
        var ctrlBar = document.getElementById('back-and-ctrls');
        var readingCtrls = document.getElementById('reading-controls');
        if (path.length === 0) {
            ctrlBar.classList.add('hidden');
        } else {
            ctrlBar.classList.remove('hidden');
            if (path.length >= 2 || path.includes('MockResult')) {
                readingCtrls.classList.remove('hidden');
            } else {
                readingCtrls.classList.add('hidden');
            }
        }
        renderView();
    } else if (event.state && event.state._base) {
        // Base home state hit — show exit dialog
        history.pushState({mode:'home',path:[],_base:true},'');
        if (currentMode !== 'home' || path.length > 0) {
            // Navigate to home first
            path = []; currentMode = 'home'; updateUIMode('home');
            document.getElementById('back-and-ctrls').classList.add('hidden');
            renderView();
            pushAppState();
        } else {
            // Already at home — exit dialog
            showConfirm('Smart Study থেকে বের হবেন?', function() {
                try { AndroidBridge.exitApp(); } catch(e) { history.go(-20); }
            });
        }
    } else {
        // Completely empty — last resort exit dialog
        history.pushState({mode:currentMode,path:[...path]},'');
        if (currentMode !== 'home' || path.length > 0) {
            path = []; currentMode = 'home'; updateUIMode('home');
            document.getElementById('back-and-ctrls').classList.add('hidden');
            renderView();
            pushAppState();
        } else {
            showConfirm('Smart Study থেকে বের হবেন?', function() {
                try { AndroidBridge.exitApp(); } catch(e) { history.go(-20); }
            });
        }
    }
});


        function openVideoApp(url) {
            if (!url) return;
            if (url.includes("youtube.com") || url.includes("youtu.be")) {
                let videoId = "";
                if (url.includes("v=")) videoId = url.split("v=")[1].split("&")[0];
                else videoId = url.substring(url.lastIndexOf("/") + 1);
                window.location.href = "vnd.youtube:" + videoId;
                return;
            } 
            if (url.includes("facebook.com")) {
                let fbUrl = "fb://facewebmodal/f?href=" + encodeURIComponent(url);
                window.location.href = fbUrl;
                setTimeout(function() { if (!document.hidden) { window.open(url, '_system'); } }, 1500);
            }
        }

        function changeFontSize(delta) {
    let currentSize = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--font-size-base'));
    let newSize = currentSize + delta;
    if (newSize >= 12 && newSize <= 32) {
        document.documentElement.style.setProperty('--font-size-base', newSize + 'px');
        localStorage.setItem('user_font_size', newSize + 'px');
        
        // ডাইনামিক বক্সগুলোর সাইজ সরাসরি আপডেট করার জন্য
        const elements = document.querySelectorAll('.question-text, .opt-btn, .ans-box, .tech-box, .ans-box div, .tech-box div');
        elements.forEach(el => {
            if(el.classList.contains('question-text')) {
                el.style.fontSize = (newSize + 2) + 'px';
            } else {
                el.style.fontSize = newSize + 'px';
            }
        });
    }
}



        // getVal cache: same object + key এর জন্য বারবার Object.keys() করা লাগবে না
        var _getValKeyCache = new WeakMap();
        function _getKeyMap(obj) {
            var cached = _getValKeyCache.get(obj);
            if (cached) return cached;
            var map = {};
            Object.keys(obj).forEach(function(k) { map[k.toLowerCase().trim()] = k; });
            _getValKeyCache.set(obj, map);
            return map;
        }
        function getVal(obj, key) { 
            if(!obj) return ''; 
            var map = _getKeyMap(obj);
            var fKey = map[key.toLowerCase().trim()];
            return fKey !== undefined ? (obj[fKey] === null || obj[fKey] === undefined ? '' : obj[fKey].toString().trim()) : ''; 
        }

var _parsedCache = new Map();
function parseLinksToImages(text) {
    if (!text) return '';
    if (text.includes('pdf-btn-style') || text.includes('openPdfModal')) return text;
    // Cache: একই text বারবার parse করা লাগবে না
    var cached = _parsedCache.get(text);
    if (cached !== undefined) return cached;
    // Cache 500 এর বেশি হলে পুরানো গুলো clear করো
    if (_parsedCache.size > 500) _parsedCache.clear();

    let processed = text;
    let pdfHolders = [];

    // ২. ড্রাইভ এবং পিডিএফ লিংক শনাক্ত করা
    const pdfRegex = /(https?:\/\/(?:drive\.google\.com|docs\.google\.com|[^?\s"'>]+\.pdf)[^\s"'>]*)/gi;
    
    processed = processed.replace(pdfRegex, (match) => {
        let finalUrl = match.trim();
        
        if (finalUrl.includes('drive.google.com')) {
            const fileIdMatch = finalUrl.match(/\/d\/([^/]+)/);
            if (fileIdMatch) {
                finalUrl = `https://drive.google.com/file/d/${fileIdMatch[1]}/preview`;
            }
        }

        const placeholder = `##PDF_BLOCK_${pdfHolders.length}##`;
        
        // এখানে কোনো জটিল স্টাইল নেই, শুধু একটি ক্লাস ব্যবহার করছি
        const buttonHtml = `<div class="my-4 text-center">
            <button onclick="openPdfModal('${finalUrl}')" class="pdf-btn-style">
                📕 PDF দেখুন
            </button>
        </div>`;
        
        pdfHolders.push({ placeholder, html: buttonHtml });
        return placeholder;
    });

    // ৩. আপনার গুরুত্বপূর্ণ টেবিল লজিক (যা সেমিকোলন দিয়ে কাজ করে)
    if (processed.includes(';')) {
        const lines = processed.split('\n');
        let finalContent = [];
        let tableRows = [];

        lines.forEach(line => {
            let trimmedLine = line.trim();
            // টেবিল হওয়ার শর্ত: সেমিকোলন থাকতে হবে এবং এটি পিডিএফ ব্লক হওয়া যাবে না
            if (trimmedLine.includes(';') && !trimmedLine.includes('http') && !trimmedLine.includes('PDF_BLOCK')) {
                tableRows.push(trimmedLine);
            } else {
                if (tableRows.length > 0) {
                    finalContent.push(generateTableHtml(tableRows));
                    tableRows = [];
                }
                finalContent.push(line);
            }
        });
        if (tableRows.length > 0) finalContent.push(generateTableHtml(tableRows));
        processed = finalContent.join('\n');
    }

    // ৪. ইমেজ এবং অন্যান্য লজিক
    const imgRegex = /(https?:\/\/[^\s"'>]+?\.(?:jpg|jpeg|gif|png|webp|bmp)(?:\?[^\s"'>]*)?)/gi;
    processed = processed.replace(imgRegex, (match) => {
        if (match.includes('PDF_BLOCK')) return match;
        return `<img src="${match}" class="preview-img" onclick="openImageZoom('${match}')" onerror="this.style.display='none'">`;
    });
// ৩. ভিডিও লজিক (বাটন স্টাইলসহ)
    const urlRegex = /(https?:\/\/(?:www\.)?(?:youtube\.com|youtu\.be|facebook\.com)[^\s]+)/gi;
    processed = processed.replace(urlRegex, (match) => {
        let cleanUrl = match.replace(/[,।]$/, ""); 
        if (cleanUrl.includes("youtube.com") || cleanUrl.includes("youtu.be")) {
            return `<div class="my-2"><button onclick="openVideoApp('${cleanUrl}')" style="background:#fff1f2; color:#be123c; width:100%; padding:12px; border-radius:12px; font-weight:700; border:1px solid #fecdd3; display:flex; align-items:center; justify-content:center; gap:8px;"><span style="color:#e11d48;">🎬</span> ইউটিউব অ্যাপে দেখুন</button></div>`;
        } else if (cleanUrl.includes("facebook.com")) {
            return `<div class="my-2"><button onclick="openVideoApp('${cleanUrl}')" style="background:#f0f9ff; color:#0369a1; width:100%; padding:12px; border-radius:12px; font-weight:700; border:1px solid #bae6fd; display:flex; align-items:center; justify-content:center; gap:8px;"><span style="color:#0ea5e9;">🔵</span> ফেইসবুক অ্যাপে দেখুন</button></div>`;
        }
        return match;
    });
    // ৫. সবশেষে বাটন বসানো
    pdfHolders.forEach(item => {
        processed = processed.replace(item.placeholder, item.html);
    });

    // ৬. LaTeX auto-wrap — \implies, \frac, \times ইত্যাদি delimiter ছাড়া থাকলে wrap করো
    processed = autoWrapLatex(processed);

    var result = processed.replace(/\n/g, '<br>');
    _parsedCache.set(text, result);
    return result;
}

// LaTeX commands auto-detect করে $...$ দিয়ে wrap করে
function autoWrapLatex(text) {
    if (!text) return text;
    // already $ বা \( delimiter আছে — MathJax নিজেই handle করবে
    if (/\$|\\\(|\\\[/.test(text)) return text;

    // কোনো LaTeX command আছে কিনা চেক করো
    const hasLatex = /\\(?:implies|iff|frac|times|div|cdot|pm|leq|geq|neq|approx|sqrt|sum|int|prod|lim|alpha|beta|gamma|delta|epsilon|theta|lambda|mu|pi|sigma|phi|omega|infty|text|textrm|left|right|begin|end|overline|underline|vec|hat|bar|mathbb|mathbf|to|Rightarrow|Leftarrow|rightarrow|leftarrow|equiv|subset|supset|in|notin|cup|cap|forall|exists|partial|nabla|log|sin|cos|tan|not|quad|qquad)\b/.test(text);
    if (!hasLatex) return text;

    // প্রতিটি line আলাদাভাবে process করো
    return text.split('\n').map(function(line) {
        if (!/\\[a-zA-Z]/.test(line)) return line;
        // already wrapped skip
        if (/\$|\\\(/.test(line)) return line;

        // line কে chunks এ ভাগ করো: বাংলা/সাধারণ text vs LaTeX expression
        // LaTeX expression: \cmd থেকে শুরু হয়ে পরবর্তী বাংলা text বা sentence end পর্যন্ত
        var result = '';
        var remaining = line;

        // Pattern: LaTeX segment = একটানা \cmd, {}, [], =, digits, spaces সহ
        var latexSegment = /((?:\\[a-zA-Z]+(?:\{[^{}]*\}|\[[^\[\]]*\])*\s*)+(?:[=\+\-\×\÷\/\^\_\d\s\(\),.]*(?:\\[a-zA-Z]+(?:\{[^{}]*\}|\[[^\[\]]*\])*\s*)*)*)/g;

        result = line.replace(latexSegment, function(match) {
            var trimmed = match.trim();
            if (!trimmed || !/\\[a-zA-Z]/.test(trimmed)) return match;
            // = এর আশেপাশের expression সহ wrap করো
            return '$' + trimmed + '$';
        });
        return result;
    }).join('\n');
}




// ৪. টেবিল জেনারেটর (সব কলামের জন্য সমানভাবে কার্যকর)
function generateTableHtml(rows) {
    let html = '<div class="table-responsive" style="margin: 10px 0; border-radius: 8px; border: 1px solid #cbd5e1; overflow: hidden;">'; 
    html += '<table style="width: 100%; border-collapse: collapse; background: white;">';
    
    rows.forEach((row, index) => {
        const cols = row.split(';');
        // জোড় বেজোড় লাইনে কালার পরিবর্তন (Scannability)
        let rowStyle = index % 2 === 1 ? 'background: #f8fafc;' : 'background: #ffffff;';
        html += `<tr style="${rowStyle}">`;
        
        cols.forEach(col => {
            if (index === 0) {
                // টেবিলের প্রথম লাইন (Header)
                html += `<th style="border: 1px solid #cbd5e1; padding: 10px 5px; background: #6366f1; color: white; font-size: 13px; text-align: center; font-weight: 800;">${col.trim()}</th>`;
            } else {
                // বাকি ডাটা সেল
                html += `<td style="border: 1px solid #cbd5e1; padding: 10px 5px; color: #1e293b; font-size: 13px; text-align: center; font-weight: 600;">${col.trim()}</td>`;
            }
        });
        html += '</tr>';
    });
    
    html += '</table></div>';
    return html;
}

        // --- Editor & Toast Functions ---
        function showToast(msg, duration = 3000) {
            const container = document.getElementById('toast-container');
            const toast = document.createElement('div');
            toast.className = 'toast';
            toast.innerText = msg;
            container.appendChild(toast);
            setTimeout(() => {
                toast.style.opacity = '0';
                setTimeout(() => toast.remove(), 500);
            }, duration);
        }

        function openEditModal(id, field, text) {
            // Non-admin: correct ও question edit করতে পারবে না
            if (!isAdmin() && (field === 'correct' || field === 'question' || field.startsWith('opt'))) {
                showToast('⛔ Admin only — এই field edit করা যাবে না!'); return;
            }
            selectedQId = id; editingField = field;
            var fieldLabels = {
                question:'প্রশ্ন', correct:'সঠিক উত্তর', explanation:'ব্যাখ্যা', technique:'টেকনিক',
                opt1:'অপশন ক', opt2:'অপশন খ', opt3:'অপশন গ', opt4:'অপশন ঘ',
                option1:'অপশন ক', option2:'অপশন খ', option3:'অপশন গ', option4:'অপশন ঘ'
            };
            document.getElementById('field-label').innerText = fieldLabels[field] || field.toUpperCase();
            document.getElementById('edit-q-id').innerText = 'ID: ' + id;
            document.getElementById('edit-input').value = text || '';
            document.getElementById('edit-modal').style.display = 'flex';
        }

        function closeEditModal() { document.getElementById('edit-modal').style.display = 'none'; }

        async function submitExplanationToSheet() {
    const val = document.getElementById('edit-input').value.trim();
    const qId = selectedQId;
    const field = editingField;
    
    // বর্তমান মোড অনুযায়ী শিটের সঠিক নাম নির্ধারণ
    let sheetTarget = "Study";
    if (currentMode === 'quiz') sheetTarget = "Quiz";
    if (currentMode === 'qbank') sheetTarget = "QBank";

    closeEditModal();
    showToast("Updating Sheet...");

    try {
        const response = await fetch(GAS_URL, {
            method: "POST",
            mode: "no-cors", // ব্রাউজার রেস্ট্রিকশন এড়াতে
            cache: "no-cache",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                type: "update_explanation",
                sheet: sheetTarget,
                id: qId,
                field: field,
                content: val
            })
        });

        // যেহেতু no-cors মোডে রেসপন্স পড়া যায় না, তাই আমরা সফল ধরে নিয়ে UI আপডেট করবো
        showToast("✅ " + field + " আপডেট রিকোয়েস্ট পাঠানো হয়েছে!");
        
        // লোকাল ডেটা আপডেট যাতে রিফ্রেশ ছাড়াই দেখা যায়
        const item = quizItems.find(q => getVal(q, 'id').toString() === qId.toString());
        if(item) {
            const key = Object.keys(item).find(k => k.toLowerCase().trim() === field.toLowerCase().trim()) || field;
            item[key] = val;
        }
        renderQuestions();
        
    } catch (e) {
        // অফলাইনে থাকলে পেন্ডিং কিউতে রাখুন
        if (typeof addToPendingQueue === 'function') {
            addToPendingQueue({ type: "update_explanation", sheet: sheetTarget, id: qId, field: field, content: val });
            showToast("📦 অফলাইনে সেভ হয়েছে — ইন্টারনেট আসলে সিঙ্ক হবে");
        } else {
            showToast("❌ কানেকশন এরর!");
        }
        // তবুও লোকাল ডেটা আপডেট করুন যাতে রিফ্রেশ ছাড়াই দেখা যায়
        const item2 = quizItems.find(q => getVal(q, 'id').toString() === qId.toString());
        if(item2) {
            const key2 = Object.keys(item2).find(k => k.toLowerCase().trim() === field.toLowerCase().trim()) || field;
            item2[key2] = val;
        }
        renderQuestions();
        console.error(e);
    }
}



        // ====================================================
        // 📦 OFFLINE SUPPORT SYSTEM
        // ====================================================

        const OFFLINE_DATA_KEY  = 'ss_offline_fulldata';
        const OFFLINE_TS_KEY    = 'ss_offline_timestamp';
        const PENDING_QUEUE_KEY = 'ss_pending_queue';

        function isOnline() { return navigator.onLine; }

        function updateOfflineBanner() {
            const banner = document.getElementById('offline-banner');
            const countText = document.getElementById('pending-count-text');
            if (!isOnline()) {
                banner.classList.add('show');
                const pq = getPendingQueue();
                countText.innerText = pq.length > 0 ? ` · ${pq.length} টি আপডেট পেন্ডিং` : '';
            } else {
                banner.classList.remove('show');
            }
            updatePendingBadge();
        }

        function updatePendingBadge() {
            const badge = document.getElementById('pending-badge');
            const countEl = document.getElementById('pending-badge-count');
            const pq = getPendingQueue();
            if (pq.length > 0) {
                badge.style.display = 'block';
                countEl.innerText = pq.length;
            } else {
                badge.style.display = 'none';
            }
        }

        function openPendingModal() {
            const pq = getPendingQueue();
            const listEl = document.getElementById('pending-modal-list');
            const syncBtn = document.getElementById('pm-sync-btn');
            if (pq.length === 0) {
                listEl.innerHTML = '<div class="pm-empty"><div style="font-size:32px;margin-bottom:8px;">✅</div>কোনো পেন্ডিং আপডেট নেই</div>';
            } else {
                listEl.innerHTML = pq.map(function(item, i) {
                    var typeLabel = item.action || item.type || item.sheetName || 'আপডেট';
                    var detail = item.phone ? 'Phone: ' + item.phone : (item.question ? item.question.slice(0,40)+'...' : JSON.stringify(item).slice(0,60)+'...');
                    var time = item.queuedAt ? new Date(item.queuedAt).toLocaleString('bn-BD') : '';
                    return '<div class="pm-item"><div class="pm-item-type">' + typeLabel + '</div><div>' + detail + '</div><div class="pm-item-time">' + time + '</div></div>';
                }).join('');
            }
            if (!navigator.onLine) {
                syncBtn.disabled = true;
                syncBtn.style.opacity = '0.5';
                syncBtn.innerText = '📡 অফলাইনে Sync সম্ভব নয়';
            } else {
                syncBtn.disabled = false;
                syncBtn.style.opacity = '1';
                syncBtn.innerText = '🔄 এখনই Sync করো (' + pq.length + ' টি)';
            }
            document.getElementById('pending-modal-overlay').classList.add('show');
        }

        function closePendingModal(e) {
            if (!e || e.target === document.getElementById('pending-modal-overlay')) {
                document.getElementById('pending-modal-overlay').classList.remove('show');
            }
        }

        async function manualSyncPending() {
            const btn = document.getElementById('pm-sync-btn');
            btn.disabled = true;
            btn.innerText = '⏳ Sync হচ্ছে...';
            await syncPendingQueue();
            const pq = getPendingQueue();
            openPendingModal();
        }

        function saveDataOffline(data) {
            try {
                localStorage.setItem(OFFLINE_DATA_KEY, JSON.stringify(data));
                localStorage.setItem(OFFLINE_TS_KEY, new Date().toISOString());
            } catch(e) {
                try {
                    const keys = Object.keys(localStorage).filter(k => k.startsWith('daily_'));
                    if (keys.length > 30) keys.slice(0,-7).forEach(k => localStorage.removeItem(k));
                    localStorage.setItem(OFFLINE_DATA_KEY, JSON.stringify(data));
                } catch(e2) { console.warn('Offline save failed:', e2); }
            }
        }

        function loadOfflineData() {
            try {
                const raw = localStorage.getItem(OFFLINE_DATA_KEY);
                if (!raw) return null;
                return JSON.parse(raw);
            } catch(e) { return null; }
        }

        function getPendingQueue() {
            try { return JSON.parse(localStorage.getItem(PENDING_QUEUE_KEY) || '[]'); }
            catch(e) { return []; }
        }

        function addToPendingQueue(item) {
            const q = getPendingQueue();
            q.push({ ...item, queuedAt: new Date().toISOString() });
            localStorage.setItem(PENDING_QUEUE_KEY, JSON.stringify(q));
            updateOfflineBanner();
        }

        async function syncPendingQueue() {
            const q = getPendingQueue();
            if (q.length === 0) return;
            showToast(`🔄 ${q.length} টি পেন্ডিং আপডেট সিঙ্ক হচ্ছে...`);
            let failed = [];
            for (const item of q) {
                try {
                    await fetch(GAS_URL, {
                        method: "POST",
                        mode: "no-cors",
                        cache: "no-cache",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify(item)
                    });
                } catch(e) { failed.push(item); }
            }
            localStorage.setItem(PENDING_QUEUE_KEY, JSON.stringify(failed));
            showToast(failed.length === 0 ? '✅ সব পেন্ডিং আপডেট সিঙ্ক সম্পন্ন!' : `⚠️ ${failed.length} টি আপডেট সিঙ্ক হয়নি`);
            updateOfflineBanner();
        }

        window.addEventListener('online', () => {
            updateOfflineBanner();
            showToast('🟢 ইন্টারনেট সংযোগ পুনরুদ্ধার হয়েছে!');
            syncPendingQueue();
        });
        window.addEventListener('offline', () => {
            updateOfflineBanner();
            showToast('🔴 অফলাইন মোডে চলছে');
        });

        if ('serviceWorker' in navigator && !location.hostname.includes('claudeusercontent')) {
            window.addEventListener('load', () => {
                navigator.serviceWorker.register('./sw.js').then((reg) => {
                    navigator.serviceWorker.addEventListener('message', event => {
                        if (event.data && event.data.type === 'SYNC_PENDING') syncPendingQueue();
                    });
                    // ✅ SW update check — নতুন SW থাকলে activate করো
                    reg.update();
                }).catch(err => console.log('SW failed:', err));
            });
        }

        // ====================================================
        // 🚀 APP INIT (Offline-capable)
        // ====================================================
        function initApp() {
    // ── Ensure proper history base state ──
    window.history.replaceState({mode:'home', path:[], _base:true}, '');
    // ── Font size restore ──
    const savedFontSize = localStorage.getItem('user_font_size');
    if (savedFontSize) {
        document.documentElement.style.setProperty('--font-size-base', savedFontSize);
    }

    // ── Theme ──
    applyTheme(localStorage.getItem('app_theme') || 'default');

    // ── Onboarding ──
    if (!localStorage.getItem('ob_done')) {
        setTimeout(() => showOnboarding(), 1200);
    }

    // ── Daily Active Tracking ──
    setTimeout(function(){ try{ trackDailyActive(); }catch(e){} }, 3000);

    // ── Smart Load: Online হলে Firebase, Offline হলে Cache ──
    const cachedData = loadOfflineData();
    if (cachedData && (cachedData.Study || cachedData.Quiz || cachedData.QBank)) {
        // Cache আগে দেখাও — instant UI
        fullData['Study']  = cachedData.Study  || [];
        fullData['Quiz']   = cachedData.Quiz   || [];
        fullData['QBank']  = cachedData.QBank  || [];
        fullData['Notice'] = cachedData.Notice || [];
        fullData['Typing'] = cachedData.Typing || [];
        console.log('✅ Cache (instant):', fullData['Study'].length, 'items');
        try {
            const mv = document.getElementById('main-view');
            if (mv && currentMode === 'home' && typeof renderHome === 'function') {
                renderHome(mv);
            } else if (typeof renderView === 'function') {
                renderView();
            }
        } catch(e) {}
    }
    // ✅ Online হলে সবসময় Firebase থেকে fresh data নাও (cache override করবে)
    // Offline হলে cache দিয়েই চলবে — loadFirebaseData()-এ check আছে

    // ── Reminders ──
    try { scheduleStudyReminders(); } catch(e) {}
    try { scheduleAllReminders(); } catch(e) {}

    // ── Admin notification listener ──
    setTimeout(() => startNotificationPolling(), 3000);

    // ── Session timer — app usage tracking ──
    try { startSessionTimer(); } catch(e) {}

    // ── Firebase fetch — পুরোপুরি non-blocking ──
    loadFirebaseData();
}

