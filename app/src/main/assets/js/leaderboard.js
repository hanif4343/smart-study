/* Smart Study — leaderboard.js */
function openLeaderboard() {
    var modal = document.getElementById('leaderboard-modal');
    if (!modal) return;
    modal.style.display = 'flex';
    renderLeaderboard();
}

function closeLeaderboard() {
    var modal = document.getElementById('leaderboard-modal');
    if (modal) modal.style.display = 'none';
}

function renderLeaderboard() {
    var body = document.getElementById('leaderboard-body');
    if (!body) return;
    body.innerHTML = '<div style="text-align:center;padding:50px 0;"><div style="width:40px;height:40px;border:4px solid rgba(99,102,241,0.2);border-top-color:#818cf8;border-radius:50%;animation:spin .8s linear infinite;margin:0 auto 14px;"></div><div style="color:#6366f1;font-weight:800;font-size:13px;">লোড হচ্ছে...</div></div>';

    fetch(FIREBASE_URL + 'Users.json?auth=' + SECRET_KEY)
        .then(function(r) { return r.json(); })
        .then(function(data) {
            if (!data) { body.innerHTML = '<div style="text-align:center;padding:40px;color:#64748b;font-weight:700;">ডেটা পাওয়া যায়নি</div>'; return; }
            var users = Array.isArray(data) ? data : Object.values(data);

            var ranked = [];
            for (var i = 0; i < users.length; i++) {
                var u = users[i];
                if (!u || !(u.Name || u.name)) continue;
                var uPhone = (u.Phone || u.phone || '').toString().trim();
                var xpVal  = parseInt(u.XP || u.xp || 0) || 0;
                // Use latest local XP if this is current user
                if (currentUser && currentUser.phone) {
                    var myNorm = currentUser.phone.toString().trim().replace(/^0+/,'');
                    var uNorm  = uPhone.replace(/^0+/,'');
                    if (myNorm === uNorm || currentUser.phone === uPhone) {
                        var localXP = parseInt(localStorage.getItem('user_xp_' + currentUser.phone) || localStorage.getItem('user_xp') || '0');
                        if (localXP > xpVal) xpVal = localXP;
                        // also use currentUser.xp if bigger
                        if ((currentUser.xp||0) > xpVal) xpVal = currentUser.xp;
                    }
                }
                var picVal = u.Picture || u.picture || '';
                if (typeof picVal === 'object') picVal = '';
                ranked.push({
                    name:    u.Name    || u.name    || '—',
                    phone:   uPhone,
                    role:    u.Role    || u.role    || 'User',
                    status:  u.Status  || u.status  || 'Active',
                    picture: picVal.trim ? picVal.trim() : picVal,
                    xp:      xpVal
                });
            }
            ranked.sort(function(a, b) { return b.xp - a.xp; });

            if (ranked.length === 0) {
                body.innerHTML = '<div style="text-align:center;padding:40px;color:#64748b;font-weight:700;">কোনো ব্যবহারকারী নেই</div>';
                return;
            }

            // Find current user rank
            var myRankIdx = -1;
            if (currentUser && currentUser.phone) {
                var myN = currentUser.phone.toString().trim().replace(/^0+/,'');
                for (var mi = 0; mi < ranked.length; mi++) {
                    if (ranked[mi].phone.replace(/^0+/,'') === myN) { myRankIdx = mi; break; }
                }
            }

            function makeAvatar(ru, size, fontSize) {
                var _pic = (ru.picture && typeof ru.picture === 'string' && ru.picture.length > 10) ? ru.picture : '';
                var sz = size || 44;
                var fs = fontSize || 18;
                var initial = ru.name ? ru.name.charAt(0).toUpperCase() : '?';
                var colors = [
                    ['#818cf8','#6366f1'],['#34d399','#059669'],['#f472b6','#db2777'],
                    ['#fb923c','#ea580c'],['#60a5fa','#2563eb'],['#a78bfa','#7c3aed']
                ];
                var ci = ru.name ? (ru.name.charCodeAt(0) % colors.length) : 0;
                var c1 = colors[ci][0], c2 = colors[ci][1];
                var divSt = 'width:' + sz + 'px;height:' + sz + 'px;border-radius:50%;background:linear-gradient(135deg,' + c1 + ',' + c2 + ');display:flex;align-items:center;justify-content:center;font-size:' + fs + 'px;font-weight:900;color:white;flex-shrink:0;border:2px solid rgba(255,255,255,0.2);';
                var fallbackHtml = '<div style="' + divSt + '">' + initial + '</div>';
                if (_pic) {
                    var imgSt = 'width:' + sz + 'px;height:' + sz + 'px;border-radius:50%;object-fit:cover;flex-shrink:0;border:2px solid rgba(255,255,255,0.25);display:block;';
                    return '<img src="' + _pic + '" style="' + imgSt + '" loading="lazy">';
                }
                return fallbackHtml;
            }

            var out = '';

            // ── TOP 3 PODIUM ──
            if (ranked.length >= 1) {
                // Podium order: 2nd | 1st | 3rd
                var podiumOrder = ranked.length >= 3 ? [ranked[1], ranked[0], ranked[2]] : ranked.length === 2 ? [null, ranked[0], ranked[1]] : [null, ranked[0], null];
                var podiumPos   = ranked.length >= 3 ? [1, 0, 2] : ranked.length === 2 ? [-1, 0, 1] : [-1, 0, -1];
                var podiumH     = ['72px', '96px', '60px'];
                var crownClr    = ['#94a3b8','#fbbf24','#f97316'];
                var medalEmoji  = ['🥈','🥇','🥉'];
                var podiumBg    = [
                    'background:linear-gradient(180deg,#1e293b,#0f172a);border:1px solid rgba(148,163,184,0.25);',
                    'background:linear-gradient(180deg,#3b1d8a,#1e1048);border:2px solid rgba(251,191,36,0.5);',
                    'background:linear-gradient(180deg,#1c1109,#0f0a00);border:1px solid rgba(249,115,22,0.3);'
                ];

                out += '<div style="display:flex;align-items:flex-end;justify-content:center;gap:10px;margin-bottom:20px;padding:16px 8px 0;">';
                for (var pi = 0; pi < 3; pi++) {
                    var pu = podiumOrder[pi];
                    var origIdx = podiumPos[pi];
                    if (!pu) { out += '<div style="flex:1;"></div>'; continue; }
                    var isMe2 = currentUser && currentUser.phone && pu.phone.replace(/^0+/,'') === currentUser.phone.toString().replace(/^0+/,'');
                    var xpI2 = lbCalcXP(pu.xp);
                    var glowSt = pi === 1 ? 'box-shadow:0 0 30px rgba(251,191,36,0.35),0 8px 32px rgba(0,0,0,0.5);' : pi === 0 ? 'box-shadow:0 0 20px rgba(148,163,184,0.2);' : 'box-shadow:0 0 20px rgba(249,115,22,0.2);';
                    var meBorder = isMe2 ? 'outline:3px solid #818cf8;outline-offset:2px;' : '';
                    var avatarSz = pi === 1 ? 58 : 46;
                    var avFontSz = pi === 1 ? 24 : 18;

                    out += '<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:6px;">';
                    // Crown/medal above avatar for 1st
                    if (pi === 1) out += '<div style="font-size:20px;filter:drop-shadow(0 0 6px rgba(251,191,36,0.7));">👑</div>';
                    else out += '<div style="font-size:16px;">' + medalEmoji[pi] + '</div>';
                    // Avatar with ring
                    out += '<div style="' + (isMe2 ? 'outline:3px solid #818cf8;outline-offset:2px;' : '') + 'border-radius:50%;">' + makeAvatar(pu, avatarSz, avFontSz) + '</div>';
                    // Name
                    out += '<div style="font-size:11px;font-weight:900;color:white;text-align:center;max-width:80px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + pu.name + '</div>';
                    if (isMe2) out += '<div style="font-size:9px;background:#6366f1;color:white;padding:1px 6px;border-radius:6px;font-weight:900;">আপনি</div>';
                    // XP
                    out += '<div style="font-size:12px;font-weight:900;color:' + crownClr[pi] + ';">' + pu.xp + ' XP</div>';
                    // Podium block
                    out += '<div style="width:100%;' + podiumBg[pi] + 'border-radius:10px 10px 0 0;height:' + podiumH[pi] + ';display:flex;align-items:center;justify-content:center;' + glowSt + '">';
                    out += '<span style="font-size:' + (pi===1?'28px':'22px') + ';font-weight:900;color:' + crownClr[pi] + ';">' + (origIdx + 1) + '</span>';
                    out += '</div>';
                    out += '</div>';
                }
                out += '</div>';
            }

            // ── REST OF RANKINGS (4th onwards) ──
            if (ranked.length > 3) {
                out += '<div style="display:flex;flex-direction:column;gap:8px;margin-top:4px;">';
                for (var j = 3; j < ranked.length; j++) {
                    var ru = ranked[j];
                    var isMe = currentUser && currentUser.phone && ru.phone.replace(/^0+/,'') === currentUser.phone.toString().replace(/^0+/,'');
                    var isAdm = ru.role.toLowerCase() === 'admin';
                    var xpI = lbCalcXP(ru.xp);
                    var cardBg = isMe
                        ? 'background:linear-gradient(135deg,rgba(99,102,241,0.18),rgba(139,92,246,0.12));border:1.5px solid rgba(99,102,241,0.4);'
                        : 'background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.07);';
                    var meShadow = isMe ? 'box-shadow:0 0 16px rgba(99,102,241,0.25);' : '';

                    out += '<div style="display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:14px;' + cardBg + meShadow + '">';
                    out += '<div style="font-size:13px;width:24px;text-align:center;font-weight:900;color:rgba(255,255,255,0.4);">#' + (j+1) + '</div>';
                    out += makeAvatar(ru, 40, 16);
                    out += '<div style="flex:1;min-width:0;">';
                    out += '<div style="display:flex;align-items:center;gap:5px;flex-wrap:wrap;">';
                    out += '<span style="font-weight:900;font-size:13px;color:' + (isMe ? '#a5b4fc' : 'rgba(255,255,255,0.9)') + ';">' + ru.name + '</span>';
                    if (isMe)  out += '<span style="font-size:9px;background:#6366f1;color:white;padding:1px 6px;border-radius:6px;font-weight:900;">আপনি</span>';
                    if (isAdm) out += '<span style="font-size:9px;background:#fef3c7;color:#92400e;padding:1px 6px;border-radius:6px;font-weight:900;">Admin</span>';
                    out += '</div>';
                    out += '<div style="font-size:10px;color:rgba(255,255,255,0.35);font-weight:700;margin-top:1px;">' + xpI.emoji + ' Lv.' + xpI.level + ' · ' + xpI.name + '</div>';
                    out += '</div>';
                    out += '<div style="text-align:right;flex-shrink:0;">';
                    out += '<div style="font-size:15px;font-weight:900;color:#818cf8;">' + ru.xp + '</div>';
                    out += '<div style="font-size:9px;color:rgba(255,255,255,0.3);font-weight:700;">XP</div>';
                    out += '</div></div>';
                }
                out += '</div>';
            }

            // ── MY RANK STICKY (if not in top visible) ──
            if (myRankIdx > 3 || (myRankIdx === -1 && currentUser)) {
                // Already shown above if myRankIdx >= 4 — but add sticky footer hint
            }

            body.innerHTML = out || '<div style="text-align:center;padding:40px;color:rgba(255,255,255,0.4);font-weight:700;">কোনো ব্যবহারকারী নেই</div>';

            // Scroll to current user if they exist
            if (myRankIdx >= 0) {
                setTimeout(function() {
                    var cards = body.querySelectorAll('[data-me]');
                    // no specific scroll needed — user is visible in podium or list
                }, 200);
            }
        })
        .catch(function(e) {
            console.error('LB error:', e);
            body.innerHTML = '<div style="text-align:center;padding:40px;color:#f87171;font-weight:700;">❌ ডেটা লোড ব্যর্থ<br><span style="font-size:12px;color:rgba(255,255,255,0.4);">ইন্টারনেট চেক করুন</span></div>';
        });
}

function lbCalcXP(xp) {
    xp = xp || 0;
    var lvls = [
        {min:0,    name:'নতুন শিক্ষার্থী', emoji:'🌱'},
        {min:100,  name:'উৎসাহী',           emoji:'📗'},
        {min:300,  name:'মনোযোগী',          emoji:'📘'},
        {min:600,  name:'অধ্যয়নশীল',       emoji:'📕'},
        {min:1000, name:'দক্ষ',              emoji:'⭐'},
        {min:1500, name:'বিশেষজ্ঞ',         emoji:'🌟'},
        {min:2500, name:'মাস্টার',           emoji:'💎'},
        {min:5000, name:'লিজেন্ড',          emoji:'🏆'}
    ];
    var lv = 1, nm = lvls[0].name, em = lvls[0].emoji;
    for (var i = lvls.length - 1; i >= 0; i--) {
        if (xp >= lvls[i].min) { lv = i + 1; nm = lvls[i].name; em = lvls[i].emoji; break; }
    }
    return { level: lv, name: nm, emoji: em };
}


// ════════════════════════════════════════════
// 📊 ANALYTICS — Firebase এ save
// ════════════════════════════════════════════

// ============================================================
// 🧠 SPACED REPETITION ENGINE — Phase 1
// Algorithm: SM-2 simplified
// SR data per question: { ease, interval, due, reps }
// ============================================================

