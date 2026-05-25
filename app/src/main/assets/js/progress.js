/* Smart Study — progress.js */
function showProgressReport() {
    var container = document.getElementById('main-view');
    var subjData  = JSON.parse(localStorage.getItem('subj_stats') || '{}');
    var correctH  = JSON.parse(localStorage.getItem('correct_history') || '[]');
    var wrongH    = JSON.parse(localStorage.getItem('wrong_history') || '{}');
    var srData    = typeof srGetData === 'function' ? srGetData() : {};
    var streak    = typeof getStreakInfo === 'function' ? getStreakInfo() : {streak:0};
    var todayGoal = typeof getDailyGoal  === 'function' ? getDailyGoal()  : {done:0,goal:20};
    var xpInfo    = typeof getXPInfo     === 'function' ? getXPInfo()     : {xp:0,level:1,levelName:'নতুন'};

    var totalC = correctH.length;
    var totalW = Object.values(wrongH).reduce(function(a,b){return a+b;},0);
    var totalQ = totalC + totalW;
    var acc    = totalQ > 0 ? Math.round(totalC/totalQ*100) : 0;
    var srMastered = Object.values(srData).filter(function(c){return c.reps>=3;}).length;
    var srDue  = typeof srGetDueCount === 'function' ? srGetDueCount() : 0;

    // Grade helper
    function grade(pct){ return pct>=90?'A+':pct>=80?'A':pct>=70?'B':pct>=60?'C':pct>=50?'D':'F'; }
    function gradeColor(pct){ return pct>=70?'#10b981':pct>=50?'#f59e0b':'#ef4444'; }
    function gradeBg(pct){ return pct>=70?'#d1fae5':pct>=50?'#fef3c7':'#fee2e2'; }

    var now = new Date();
    var dateStr = now.getFullYear()+'/'+(now.getMonth()+1)+'/'+now.getDate();
    var userName = (currentUser&&currentUser.name) ? currentUser.name : (typeof getUserName==='function'?getUserName():'শিক্ষার্থী');

    // ── HTML BUILD ──
    var h = '';

    // Header
    h += '<div style="background:linear-gradient(135deg,#1e1b4b,#4338ca);border-radius:20px;padding:20px;margin-bottom:12px;position:relative;">';
    h += '<div style="display:flex;justify-content:space-between;align-items:flex-start;">';
    h += '<div>';
    h += '<div style="color:rgba(255,255,255,0.6);font-size:10px;font-weight:800;letter-spacing:1px;">SMART STUDY • অগ্রগতি রিপোর্ট</div>';
    h += '<div style="color:white;font-size:18px;font-weight:900;margin-top:4px;">'+userName+'</div>';
    h += '<div style="color:rgba(255,255,255,0.5);font-size:10px;font-weight:700;margin-top:2px;">'+dateStr+' পর্যন্ত</div>';
    h += '</div>';
    h += '<div style="text-align:right;">';
    h += '<div style="background:rgba(255,255,255,0.15);border-radius:12px;padding:6px 12px;">';
    h += '<div style="color:#fbbf24;font-size:16px;font-weight:900;">⭐ '+xpInfo.xp+' XP</div>';
    h += '<div style="color:rgba(255,255,255,0.5);font-size:9px;font-weight:700;">Lv.'+xpInfo.level+' '+xpInfo.levelName+'</div>';
    h += '</div></div></div>';

    // Overall stats row
    h += '<div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:8px;margin-top:14px;">';
    var stats4 = [
        {v:totalC, l:'সঠিক', c:'#4ade80'},
        {v:totalW, l:'ভুল', c:'#f87171'},
        {v:acc+'%', l:'নির্ভুলতা', c:'#a78bfa'},
        {v:streak.streak+'🔥', l:'Streak', c:'#fbbf24'}
    ];
    stats4.forEach(function(s){
        h += '<div style="background:rgba(255,255,255,0.08);border-radius:12px;padding:10px 6px;text-align:center;">';
        h += '<div style="font-size:15px;font-weight:900;color:'+s.c+';">'+s.v+'</div>';
        h += '<div style="font-size:8px;font-weight:800;color:rgba(255,255,255,0.45);margin-top:2px;">'+s.l+'</div>';
        h += '</div>';
    });
    h += '</div></div>';

    // ── Subject breakdown ──
    var subjKeys = Object.keys(subjData).filter(function(k){
        return (subjData[k].correct||0)+(subjData[k].wrong||0)>0;
    });
    subjKeys.sort(function(a,b){
        var pa=(subjData[a].correct||0)/Math.max(1,(subjData[a].correct||0)+(subjData[a].wrong||0));
        var pb=(subjData[b].correct||0)/Math.max(1,(subjData[b].correct||0)+(subjData[b].wrong||0));
        return pa-pb;
    });

    if(subjKeys.length > 0){
        h += '<div style="background:white;border-radius:20px;padding:16px;margin-bottom:12px;border:1px solid #f1f5f9;">';
        h += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;">';
        h += '<div style="font-weight:900;color:#1e293b;font-size:13px;">📚 বিষয়ভিত্তিক ফলাফল</div>';
        h += '<div style="font-size:9px;font-weight:700;color:#94a3b8;">'+subjKeys.length+' বিষয়</div>';
        h += '</div>';

        subjKeys.forEach(function(subj){
            var c = subjData[subj].correct||0;
            var w = subjData[subj].wrong||0;
            var t = c+w;
            var pct = t>0?Math.round(c/t*100):0;
            var g = grade(pct);
            var chapters = subjData[subj].chapters || {};
            var chapKeys = Object.keys(chapters).filter(function(k){ return (chapters[k].correct||0)+(chapters[k].wrong||0)>0; });

            // Subject row
            h += '<div style="margin-bottom:14px;">';
            h += '<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">';
            h += '<span style="flex:1;font-size:12px;font-weight:800;color:#334155;">'+subj+'</span>';
            h += '<span style="font-size:10px;font-weight:900;padding:2px 8px;border-radius:8px;color:'+gradeColor(pct)+';background:'+gradeBg(pct)+';">'+g+'</span>';
            h += '<span style="font-size:10px;font-weight:700;color:#94a3b8;">'+c+'/'+t+'</span>';
            h += '</div>';
            // Bar
            h += '<div style="background:#f1f5f9;border-radius:6px;height:8px;overflow:hidden;">';
            h += '<div style="width:'+pct+'%;background:'+(pct>=70?'#10b981':pct>=50?'#f59e0b':'#ef4444')+';height:100%;border-radius:6px;"></div>';
            h += '</div>';

            // Chapter breakdown
            if(chapKeys.length > 0){
                h += '<div style="margin-top:8px;padding-left:12px;border-left:2px solid #e2e8f0;">';
                chapKeys.sort(function(a,b){
                    var pa=(chapters[a].correct||0)/Math.max(1,(chapters[a].correct||0)+(chapters[a].wrong||0));
                    var pb=(chapters[b].correct||0)/Math.max(1,(chapters[b].correct||0)+(chapters[b].wrong||0));
                    return pa-pb;
                }).slice(0,5).forEach(function(chap){
                    var cc=chapters[chap].correct||0;
                    var cw=chapters[chap].wrong||0;
                    var ct=cc+cw;
                    var cp=ct>0?Math.round(cc/ct*100):0;
                    h += '<div style="display:flex;align-items:center;gap:6px;padding:4px 0;border-bottom:1px solid #f8fafc;">';
                    h += '<span style="flex:1;font-size:10px;font-weight:700;color:#64748b;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">'+chap+'</span>';
                    h += '<div style="width:60px;background:#f1f5f9;border-radius:4px;height:5px;overflow:hidden;">';
                    h += '<div style="width:'+cp+'%;background:'+(cp>=70?'#10b981':cp>=50?'#f59e0b':'#ef4444')+';height:100%;"></div>';
                    h += '</div>';
                    h += '<span style="font-size:9px;font-weight:800;color:'+gradeColor(cp)+';min-width:28px;text-align:right;">'+cp+'%</span>';
                    h += '</div>';
                });
                h += '</div>';
            }
            h += '</div>';
        });
        h += '</div>';
    } else {
        h += '<div style="background:white;border-radius:20px;padding:24px;text-align:center;margin-bottom:12px;color:#94a3b8;font-weight:700;border:1px solid #f1f5f9;">📚 এখনো কোনো বিষয়ের data নেই<br><span style="font-size:11px;">Quiz বা QBank থেকে পড়া শুরু করো</span></div>';
    }

    // ── SR Summary ──
    if(Object.keys(srData).length > 0){
        h += '<div style="background:linear-gradient(135deg,#0f172a,#1e1b4b);border-radius:20px;padding:16px;margin-bottom:12px;">';
        h += '<div style="font-weight:900;color:white;font-size:13px;margin-bottom:12px;">🧠 Smart Review (Spaced Repetition)</div>';
        h += '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;">';
        [{v:srMastered,l:'আয়ত্ত',c:'#4ade80'},{v:srDue,l:'বাকি',c:'#fbbf24'},{v:Object.keys(srData).length,l:'মোট Cards',c:'#a78bfa'}].forEach(function(s){
            h += '<div style="background:rgba(255,255,255,0.08);border-radius:12px;padding:10px;text-align:center;">';
            h += '<div style="font-size:18px;font-weight:900;color:'+s.c+';">'+s.v+'</div>';
            h += '<div style="font-size:8px;font-weight:800;color:rgba(255,255,255,0.4);margin-top:2px;">'+s.l+'</div>';
            h += '</div>';
        });
        h += '</div></div>';
    }

    // ── Social Signal: "X জন আজ পড়েছে" ──
    h += '<div id="social-signal-card" style="background:linear-gradient(135deg,#ecfdf5,#d1fae5);border:1px solid #a7f3d0;border-radius:20px;padding:14px 16px;margin-bottom:12px;display:flex;align-items:center;gap:10px;">';
    h += '<span style="font-size:24px;">👥</span>';
    h += '<div style="flex:1;"><div style="font-weight:900;color:#065f46;font-size:12px;" id="social-active-count">লোড হচ্ছে...</div>';
    h += '<div style="font-weight:700;color:#34d399;font-size:10px;margin-top:2px;">Smart Study community</div></div>';
    h += '<div style="background:#10b981;color:white;border-radius:10px;padding:4px 10px;font-size:10px;font-weight:900;">LIVE</div>';
    h += '</div>';

    // ── Share button ──
    h += '<div style="background:linear-gradient(135deg,#6366f1,#4338ca);border-radius:20px;padding:16px;margin-bottom:80px;">';
    h += '<div style="font-weight:900;color:white;font-size:13px;margin-bottom:12px;">📤 রিপোর্ট শেয়ার করো</div>';
    h += '<div style="display:flex;gap:10px;">';
    h += '<button onclick="shareProgressText()" style="flex:1;background:rgba(255,255,255,0.15);border:none;border-radius:14px;padding:12px;color:white;font-weight:800;font-size:12px;">📋 Text Copy</button>';
    h += '<button onclick="shareProgressImage()" style="flex:1;background:white;border:none;border-radius:14px;padding:12px;color:#4338ca;font-weight:900;font-size:12px;">🖼 Screenshot</button>';
    h += '</div></div>';

    container.innerHTML = h;
    document.getElementById('back-and-ctrls').classList.remove('hidden');

    // Load social signal from Firebase
    loadSocialSignal();
}

