/* Smart Study — written.js */
function parseSubQuestions(rawText) {
    if (!rawText) return [{label:'', text:''}];

    // HTML ট্যাগ ও entity সাফ করা
    let plain = rawText
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<[^>]+>/g, '')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .trim();

    // সব ধরনের delimiter pattern — লাইন শুরুতে বা whitespace পরে
    // Priority: বাংলা বর্ণ > English a-h > Roman > সংখ্যা
    const DELIMITER_PATTERNS = [
        // বাংলা: ক. ক) ক। খ. খ) গ. etc. — লাইন শুরুতে বা আগে newline/space
        /(?:^|(?<=\n))\s*([কখগঘঙচছজঝঞটঠডঢণতথদধনপফবভমযরলশষসহ]\s*[\.\)\।])\s*/gm,
        // English lowercase a-h (i বাদ কারণ Roman i এর সাথে conflict)
        /(?:^|(?<=\n))\s*([a-hA-H]\s*[\.\)])\s*/gm,
        // Roman: (i) (ii) (iii) বা i. ii. iii.
        /(?:^|(?<=\n))\s*(\((?:i{1,3}|iv|vi{0,3}|ix|xi{0,2})\))\s*/gim,
        // বাংলা সংখ্যা ১. ২. ৩. বা ১) ২) ৩)
        /(?:^|(?<=\n))\s*([০-৯]+\s*[\.\)])\s*/gm,
        // Arabic সংখ্যা 1. 2. 3. বা 1) 2) 3)
        /(?:^|(?<=\n))\s*([1-9][0-9]?\s*[\.\)])\s*/gm,
    ];

    // Fallback: lookbehind support না থাকলে সহজ pattern ব্যবহার
    const SIMPLE_PATTERNS = [
        /\n\s*([কখগঘঙচছজঝঞটঠডঢণতথদধনপফবভমযরলশষসহ]\s*[\.\)\।])\s*/g,
        /\n\s*([a-hA-H]\s*[\.\)])\s*/g,
        /\n\s*(\((?:i{1,3}|iv|vi{0,3}|ix|xi{0,2})\))\s*/gi,
        /\n\s*([০-৯]+\s*[\.\)])\s*/g,
        /\n\s*([1-9][0-9]?\s*[\.\)])\s*/g,
    ];

    function tryParse(patterns, text) {
        for (const pat of patterns) {
            pat.lastIndex = 0;
            const found = [];
            let m;
            while ((m = pat.exec(text)) !== null) {
                found.push({ label: m[1].replace(/\s+/g,''), idx: m.index, len: m[0].length });
            }
            if (found.length >= 2) {
                const parts = [];
                for (let i = 0; i < found.length; i++) {
                    const contentStart = found[i].idx + found[i].len;
                    const contentEnd = i + 1 < found.length ? found[i+1].idx : text.length;
                    const content = text.slice(contentStart, contentEnd).trim();
                    parts.push({ label: found[i].label, text: content });
                }
                // প্রতিটি part এ অন্তত কিছু content থাকতে হবে
                if (parts.every(p => p.text.length > 0)) return parts;
            }
        }
        return null;
    }

    // lookbehind try, fallback to simple
    let result = null;
    try {
        result = tryParse(DELIMITER_PATTERNS, plain);
    } catch(e) {}
    
    if (!result) {
        // Simple pattern: newline এর পর delimiter খুঁজি
        // প্রথমে দেখি প্রথম delimiter টা কোথায়, তার আগে \n add করি
        for (const simPat of SIMPLE_PATTERNS) {
            simPat.lastIndex = 0;
            const testMatch = simPat.exec(plain);
            if (testMatch) {
                // যদি প্রথম delimiter একদম শুরুতে থাকে (index < 5), \n দিয়ে শুরু করি
                const adjusted = plain.indexOf('\n') === -1 ? plain.replace(
                    new RegExp('^\\s*(' + testMatch[1].replace(/[.*+?^${}()|[\]\\]/g,'\\$&') + ')\\s*'),
                    '\n$1 '
                ) : plain;
                simPat.lastIndex = 0;
                result = tryParse([simPat], adjusted);
                if (result) break;
            }
        }
    }

    // শেষ চেষ্টা: পুরো text কে newline দিয়ে ভাগ করে delimiter দেখি
    if (!result) {
        result = tryParseInline(plain);
    }

    return result && result.length >= 2 ? result : [{label:'', text: plain.trim()}];
}

/**
 * Inline delimiter detection — newline ছাড়াও space এর পর delimiter ধরে
 * যেমন: "ক. উত্তর এক খ. উত্তর দুই" → দুটো part
 */
function tryParseInline(text) {
    // সব ধরনের delimiter inline এ খোঁজা
    const PAT = /(?:^|\s)([কখগঘঙচছজঝঞটঠডঢণতথদধনপফবভমযরলশষসহ][\.\)\।]|[a-hA-H][\.\)]|\((?:i{1,3}|iv|vi{0,3})\)|[০-৯][\.\)]|[1-9][\.\)])\s+/g;
    PAT.lastIndex = 0;
    const found = [];
    let m;
    while ((m = PAT.exec(text)) !== null) {
        found.push({ label: m[1].replace(/\s+/g,''), idx: m.index + (m[0].startsWith(' ') || m[0].startsWith('\n') ? 1 : 0), len: m[0].trim().length + 1 });
    }
    if (found.length < 2) return null;
    const parts = [];
    for (let i = 0; i < found.length; i++) {
        const contentStart = found[i].idx + found[i].len;
        const contentEnd = i + 1 < found.length ? found[i+1].idx : text.length;
        const content = text.slice(contentStart, contentEnd).trim();
        if (content.length === 0) return null;
        parts.push({ label: found[i].label, text: content });
    }
    return parts.length >= 2 ? parts : null;
}

/**
 * sub-written-wrap এর প্রতিটি textarea-র উত্তর আলাদাভাবে match করে।
 * সম্পূর্ণ local — AI ছাড়া।
 */
function checkSubWrittenAnswer(btn) {
    writingFocusExit();
    const wrap = btn.closest('.sub-written-wrap');
    if (!wrap) return;
    const qId = wrap.dataset.qid;
    const idx = parseInt(wrap.dataset.idx || '0');
    
    const textareas = wrap.querySelectorAll('.sub-textarea');
    let allFilled = true;
    textareas.forEach(ta => { if (!ta.value.trim()) allFilled = false; });
    if (!allFilled) { showToast('⚠️ সব অংশের উত্তর লিখো!'); return; }
    
    // সঠিক উত্তর খুঁজি — qId দিয়ে item খুঁজি (idx wrong হতে পারে filtered list-এ)
    let correctRaw = '';
    const qItem = quizItems.find(function(it) {
        return String(getVal(it,'id')||getVal(it,'sl')||getVal(it,'#')||'') === String(qId) ||
               String(quizItems.indexOf(it)) === String(idx);
    });
    if (qItem) {
        correctRaw = getVal(qItem, 'correct') || getVal(qItem, 'answer') || '';
    }
    if (!correctRaw && idx < quizItems.length) {
        correctRaw = getVal(quizItems[idx], 'correct') || getVal(quizItems[idx], 'answer') || '';
    }
    // fallback: DOM থেকে নাও
    const ansBox = document.getElementById('wans-' + qId);
    if (!correctRaw && ansBox) {
        const ansDiv = ansBox.querySelector('.ans-box, [style*="f0fdf4"]');
        if (ansDiv) correctRaw = ansDiv.innerText || ansDiv.textContent;
    }
    correctRaw = correctRaw.replace(/^(উত্তর|উ|ans|answer|Solution)\s*[:।-]\s*/i, '').trim();
    
    // উত্তরকেও সাব-প্রশ্নে ভাগ করি
    const correctParts = parseSubQuestions(correctRaw);
    
    btn.disabled = true;
    btn.innerHTML = '<span style="animation:spin 1s linear infinite;display:inline-block">⏳</span> মিলিয়ে দেখছি...';
    
    if (ansBox) ansBox.classList.remove('hidden');
    triggerMathJax();
    
    let totalPct = 0;
    textareas.forEach((ta, pi) => {
        const userAns = ta.value.trim();
        const correctPartText = pi < correctParts.length ? correctParts[pi].text : (correctParts[correctParts.length-1] ? correctParts[correctParts.length-1].text : correctRaw);
        
        const result = localMatchAnswer(userAns, correctPartText);
        totalPct += result.pct;
        
        // এই sub-question এর result দেখাই
        const resDiv = document.getElementById('smr-' + qId + '-' + pi);
        if (resDiv) {
            resDiv.classList.remove('hidden');
            const color = result.pct >= 80 ? '#10b981' : result.pct >= 60 ? '#6366f1' : result.pct >= 40 ? '#f59e0b' : '#ef4444';
            const bg = result.pct >= 80 ? '#f0fdf4' : result.pct >= 60 ? '#eef2ff' : result.pct >= 40 ? '#fffbeb' : '#fef2f2';
            const label = correctParts[pi] ? correctParts[pi].label : '';
            resDiv.innerHTML = `<div class="sub-match-inner" style="background:${bg};">
                <div style="display:flex;justify-content:space-between;align-items:center;">
                    <span style="font-weight:900;font-size:12px;color:${color};">${label ? label+' —' : ''} ${result.pct}% মিলেছে</span>
                    <span style="font-size:16px;font-weight:900;color:${color};">${result.grade}</span>
                </div>
                <div class="sub-match-bar" style="margin-top:5px;"><div class="sub-match-bar-fill" style="width:${result.pct}%;background:${color};"></div></div>
                <div style="font-size:11px;font-weight:700;margin-top:5px;color:#475569;">${result.feedback}</div>
                ${result.missing_points.length > 0 ? `<div style="font-size:11px;color:#991b1b;margin-top:3px;">❌ বাদ: ${result.missing_points.slice(0,5).join(', ')}</div>` : ''}
            </div>`;
        }
        ta.disabled = true;
    });
    
    // Overall score
    const avgPct = Math.round(totalPct / textareas.length);
    const color = avgPct >= 80 ? '#10b981' : avgPct >= 60 ? '#6366f1' : avgPct >= 40 ? '#f59e0b' : '#ef4444';
    
    btn.innerHTML = `<div style="display:flex;align-items:center;gap:8px;justify-content:center;">
        <span style="font-size:18px;font-weight:900;color:${color};">${avgPct}%</span>
        <span>সার্বিক স্কোর</span>
        <button onclick="retrySubWrittenAnswer(this)" style="background:rgba(255,255,255,0.3);border:none;padding:4px 10px;border-radius:10px;font-weight:900;font-size:12px;cursor:pointer;">🔄 আবার লিখি</button>
    </div>`;
    btn.style.background = avgPct >= 80 ? 'linear-gradient(135deg,#10b981,#059669)' : avgPct >= 60 ? 'linear-gradient(135deg,#6366f1,#4338ca)' : avgPct >= 40 ? 'linear-gradient(135deg,#f59e0b,#d97706)' : 'linear-gradient(135deg,#ef4444,#dc2626)';
    btn.disabled = false;
    
    // Card feedback
    const card = wrap.closest('.card');
    if (card) {
        card.classList.remove('flash-correct','flash-wrong');
        card.classList.add(avgPct >= 70 ? 'flash-correct' : 'flash-wrong');
        haptic(avgPct >= 70 ? 'correct' : 'wrong');
        playSound(avgPct >= 70 ? 'correct' : 'wrong');
    }
    
    // ✅ FIX: answeredCount সবসময় বাড়বে, কিন্তু XP/correct শুধু ভালো score এ
    answeredCount++;
    updateScore();
    if (avgPct >= 70) { 
        awardXP(5);
        // সঠিক হিসেবে mark করা
        if (idx < quizItems.length) {
            const qId2 = getVal(quizItems[idx], 'id');
            if (qId2 && typeof markAsCorrect === 'function') markAsCorrect(qId2);
        }
    }
    if (typeof updateReadingProgress === 'function') updateReadingProgress();
    try { srUpdateHomeCard(); } catch(e) {}
}

function retrySubWrittenAnswer(btn) {

    const wrap = btn.closest('.sub-written-wrap');
    if (!wrap) return;
    const qId = wrap.dataset.qid;
    // সব textarea রিসেট
    wrap.querySelectorAll('.sub-textarea').forEach(ta => { ta.value=''; ta.disabled=false; });
    // সব result বক্স লুকাই
    wrap.querySelectorAll('.sub-match-result').forEach(r => r.classList.add('hidden'));
    // সাবমিট বাটন রিসেট
    const submitBtn = wrap.querySelector('.written-submit-btn');
    if (submitBtn) {
        submitBtn.innerHTML = '🔍 সব উত্তর মিলিয়ে দেখো';
        submitBtn.style.background = '';
        submitBtn.disabled = false;
    }
    // উত্তর বক্স লুকাই
    const ansBox = document.getElementById('wans-' + qId);
    if (ansBox) ansBox.classList.add('hidden');
}

// ====================================================
// 🔔 IMPROVED IN-APP REMINDER BAR
// ====================================================
function revealWrittenAnswer(btn) {
    var answerBox = btn.nextElementSibling;
    answerBox.classList.remove('hidden');
    btn.style.display = 'none';
    triggerMathJax();
    haptic('light');
}

function selfAssess(btn, result, qId) {
    var box = btn.closest('.self-assess-box');
    if (box.classList.contains('done')) return;
    box.classList.add('done');
    haptic(result === 'correct' ? 'correct' : 'wrong');

    if (result === 'correct') {
        btn.classList.add('self-assess-done-correct');
        markAsCorrect(qId);
        awardXP(5);
        playSound('correct');
        answeredCount++;
        updateScore();
        updateReadingProgress();
    try { srUpdateHomeCard(); } catch(e) {}
        // Track in score
        var card = btn.closest('.card');
        if (card) { card.classList.add('flash-correct'); setTimeout(function(){ card.classList.remove('flash-correct'); }, 600); }
    } else {
        btn.classList.add('self-assess-done-wrong');
        playSound('wrong');
        answeredCount++;
        updateScore();
        updateReadingProgress();
    try { srUpdateHomeCard(); } catch(e) {}
        var wrongCard = btn.closest('.card');
        if (wrongCard) { wrongCard.classList.add('flash-wrong'); setTimeout(function(){ wrongCard.classList.remove('flash-wrong'); }, 600); }
        // Track weak topic
        var item = quizItems[parseInt(btn.closest('.card').querySelector('[class*="rounded-full"]').innerText.replace('#','')) - 1];
        if (item) {
            var topic = getVal(item,'sub_topic') || getVal(item,'subject') || 'অজানা';
            trackWrongAnswer(topic);
        }
    }
    showToast(result === 'correct' ? '✅ দারুণ! +5 XP' : '❌ আরো পড়ো!');
}


// ====================================================
// ✍️ WRITTEN SMART ANSWER MATCHING
// ====================================================

async function checkWrittenAnswer(btn) {
    writingFocusExit();
    var wrap = btn.closest('.written-input-wrap');
    var qId = wrap ? wrap.dataset.qid : '';
    var itemIdx = wrap ? parseInt(wrap.dataset.idx || '0') : 0;
    var textarea = wrap ? wrap.querySelector('.written-textarea') : btn.previousElementSibling;
    var userAnswer = textarea ? textarea.value.trim() : '';
    if (!userAnswer) { showToast('⚠️ আগে উত্তর লিখো!'); return; }

    btn.disabled = true;
    btn.innerHTML = '<span style="animation:spin 1s linear infinite;display:inline-block">⏳</span> মিলিয়ে দেখছি...';

    var ansBox = document.getElementById('wans-' + qId);
    if (ansBox) ansBox.classList.remove('hidden');
    triggerMathJax();

    // --- এখানে পরিবর্তন করা হয়েছে: আসল উত্তর খুঁজে বের করা ---
    var rawCorrectText = '';
    if (ansBox) {
        var ansDiv = ansBox.querySelector('.ans-box, [style*="f0fdf4"]');
        if (ansDiv) rawCorrectText = ansDiv.innerText || ansDiv.textContent;
    }
    if (!rawCorrectText && itemIdx < quizItems.length) {
        rawCorrectText = getVal(quizItems[itemIdx], 'correct') || getVal(quizItems[itemIdx], 'answer') || '';
    }

    // "উত্তর:" বা "Ans:" থাকলে তা বাদ দিয়ে শুধু মূল অংশটি নেওয়া
    var correctText = rawCorrectText.replace(/^(উত্তর|উ|ans|answer|Solution)\s*[:।-]\s*/i, '').trim();

    var result = localMatchAnswer(userAnswer, correctText);
    renderMatchResult(btn, result, qId, itemIdx);
    smartMatchAnswer(userAnswer, correctText).then(function(){}).catch(function(){});
}

// ---- Gemini API Smart Match ----
async function smartMatchAnswer(userAns, correctAns) {
    const GEMINI_API_KEY = "%%GEMINI_API_KEY%%";
        const IMGBB_API_KEY = "3f23d9fd6bdfdb694285773f40569906"; 
    const model = "gemini-1.5-flash";

    if (!correctAns || correctAns.length < 2) {
        return localMatchAnswer(userAns, correctAns);
    }

    // প্রম্পটে আরও কড়া নির্দেশনা দেওয়া হয়েছে
    var prompt = `তুমি একজন দক্ষ শিক্ষক। নিচের শিক্ষার্থীর উত্তরটি সঠিক উত্তরের সাথে তুলনা করো। 
গুরুত্বপূর্ণ: যদি সঠিক উত্তর "গণপ্রজাতন্ত্রী বাংলাদেশ" হয় এবং শিক্ষার্থী শুধু "গণপ্রজাতন্ত্রী বাংলাদেশ" লিখে, তবে তাকে ১০০% নম্বর দাও। "উত্তর:" শব্দটিকে উত্তরের অংশ হিসেবে ধরবে না।

সঠিক উত্তর: ${correctAns}
শিক্ষার্থীর উত্তর: ${userAns}

নিচের JSON ফরম্যাটে উত্তর দাও:
{"pct": 0-100, "grade": "A/B/C/D/F", "feedback": "সংক্ষিপ্ত বাংলায় ফিডব্যাক", "correct_points": ["সঠিক শব্দ"], "missing_points": ["বাদ পড়া শব্দ"]} `;

    try {
        var response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }]
            })
        });

        var data = await response.json();
        var text = data.candidates[0].content.parts[0].text;
        var jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) return JSON.parse(jsonMatch[0]);
    } catch (e) {
        return localMatchAnswer(userAns, correctAns);
    }
}

// ---- Local Fallback (এখানেও পরিষ্কার করার লজিক আপডেট করা হয়েছে) ----
function localMatchAnswer(userAns, correctAns) {
    if (!correctAns) return { pct: 0, grade: 'F', feedback: 'সঠিক উত্তর পাওয়া যায়নি', correct_points: [], missing_points: [] };

    // বাংলা সংখ্যা → ইংরেজি সংখ্যা convert
    function toBnNum(text) {
        const map = {'০':'0','১':'1','২':'2','৩':'3','৪':'4','৫':'5','৬':'6','৭':'7','৮':'8','৯':'9'};
        return text.replace(/[০-৯]/g, d => map[d]);
    }

    function normalize(text) {
        return toBnNum(text)
            // prefix বাদ
            .replace(/^(উত্তর|উ|ans|answer|solution)\s*[:।\-]\s*/i, '')
            // zero-width characters বাদ
            .replace(/[\u200b\u200c\u200d\ufeff]/g, '')
            // সাব-label বাদ (লাইনের শুরুতে বা inline-এও)
            .replace(/(?:^|[\n\r\s])(?:[কখগঘঙচছজঝঞটঠডঢণতথদধনপফবভমযরলশষসহ]|[a-hA-H]|[0-9])\s*[.)।]\s*/g, ' ')
            .toLowerCase()
            // সব চিহ্ন, punctuation, space সহ remove — শুধু শব্দ/সংখ্যা থাকবে
            .replace(/[^\u0980-\u09FFa-z0-9]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim()
            .split(' ')
            .filter(w => w.length > 0);
    }

    var userWords = normalize(userAns);
    var correctWords = normalize(correctAns);

    if (correctWords.length === 0) return { pct: 0, grade:'F', feedback:'উত্তর খালি', correct_points:[], missing_points:[] };

    if (userWords.join(' ') === correctWords.join(' ')) {
        return { pct:100, grade:'A+', feedback:'🌟 অসাধারণ! উত্তর নির্ভুল।', correct_points: correctWords.slice(0,5), missing_points:[] };
    }

    // Smart check: user answer যদি ছোট হয় (1-2 words) এবং correct-এর যেকোনো একটা word-এর সাথে 100% মিলে
    // তাহলে ধরে নেবো এটা সঠিক part-এর উত্তর (parseSubQuestions fail হলেও কাজ করবে)
    // Smart check: user-এর সব word যদি correct-এ থাকে তাহলে সঠিক ধরো
    // fill-in-the-blank বা single-word answer এর জন্য দরকার
    if (userWords.length >= 1 && userWords.every(function(w){ return correctWords.indexOf(w) !== -1; })) {
        var coverRatio = userWords.length / correctWords.length;
        if (coverRatio >= 0.4) {
            return { pct:100, grade:'A+', feedback:'🌟 অসাধারণ! উত্তর নির্ভুল।', correct_points: userWords, missing_points:[] };
        }
    }

    var matched = 0;
    var matchedWords = [];
    var missedWords = [];
    var userSet = {};
    userWords.forEach(function(w){ userSet[w] = (userSet[w]||0)+1; });

    correctWords.forEach(function(w) {
        if (userSet[w] && userSet[w] > 0) {
            matched++;
            userSet[w]--;
            matchedWords.push(w);
        } else {
            missedWords.push(w);
        }
    });

    var total = correctWords.length || 1;
    var pct = Math.min(100, Math.round((matched / total) * 100));
    var grade = pct >= 90 ? 'A+' : pct >= 80 ? 'A' : pct >= 70 ? 'B' : pct >= 60 ? 'C' : pct >= 40 ? 'D': 'F';
    var feedback = pct >= 85 ? '🌟 অসাধারণ! উত্তর প্রায় নির্ভুল।'
        : pct >= 70 ? '👍 ভালো হয়েছে! কিছু অংশ মিস হয়েছে।'
        : pct >= 50 ? '📖 মোটামুটি হয়েছে। আরো পড়ো।'
        : pct >= 30 ? '⚠️ অনেক অংশ বাদ গেছে। আবার পড়ো।'
        : '❌ উত্তর মেলেনি। সঠিক উত্তর দেখো।';

    return {
        pct: pct,
        grade: grade,
        feedback: feedback,
        correct_points: matchedWords.slice(0, 5),
        missing_points: missedWords.slice(0, 6)
    };
}


// ---- Render Match Result (Fixed for showResult compatibility) ----
function renderMatchResult(btn, result, qId, itemIdx) {
    var pct = result.pct || 0;
    var grade = result.grade || 'F';
    var feedback = result.feedback || '';
    var correctPoints = result.correct_points || [];
    var missingPoints = result.missing_points || [];

    // ডিজাইন সেটআপ
    var color = pct >= 80 ? '#10b981' : pct >= 60 ? '#6366f1' : pct >= 40 ? '#f59e0b' : '#ef4444';
    var bgColor = pct >= 80 ? '#f0fdf4' : pct >= 60 ? '#eef2ff' : pct >= 40 ? '#fffbeb' : '#fef2f2';

    var html = '<div class="match-result-wrap" style="background:' + bgColor + ';">'
        + '<div class="match-result-header">'
        + '<div><div class="match-pct-badge" style="color:' + color + '">' + pct + '%</div>'
        + '<div style="font-size:11px;font-weight:800;color:#64748b;">মিল হয়েছে</div></div>'
        + '<div style="text-align:right;"><div style="font-size:28px;font-weight:900;color:' + color + '">' + grade + '</div>'
        + '<div style="font-size:10px;font-weight:700;color:#94a3b8;">গ্রেড</div></div>'
        + '</div>'
        + '<div class="match-bar-bg"><div class="match-bar-fill" style="width:' + pct + '%;background:' + color + ';"></div></div>'
        + '<div class="match-detail"><p style="font-weight:800;margin-bottom:6px;">' + feedback + '</p>';

    if (correctPoints.length > 0) html += '<p style="color:#166534;font-size:12px;">✅ মিলেছে: ' + correctPoints.join(', ') + '</p>';
    if (missingPoints.length > 0) html += '<p style="color:#991b1b;font-size:12px;margin-top:4px;">❌ বাদ: ' + missingPoints.join(', ') + '</p>';
    html += '</div></div>';

    // বাটন রিপ্লেস করা
    var wrap = btn.parentElement;
    wrap.innerHTML = html + '<div class="flex gap-2 mt-3"><button onclick="retryWrittenAnswer(this)" class="flex-1 py-2 bg-indigo-50 border border-indigo-200 text-indigo-600 font-bold rounded-xl text-sm">🔄 আবার লিখি</button></div>';

    // --- আসল পরিবর্তন এখানে (showResult এর সাথে কানেক্ট করা) ---
    var card = wrap.closest('.card');
    if (card) {
        // আগের কোনো ক্লাস থাকলে মুছে ফেলা
        card.classList.remove('flash-correct', 'flash-wrong');
        
        // self-assess-box খুঁজে বের করা বা তৈরি করা (যদি না থাকে)
        var saBox = card.querySelector('.self-assess-box');
        if (!saBox) {
            // যদি বক্সে ক্লাস না থাকে, আমরা কার্ডের ভেতর একটি লুকানো এলিমেন্ট যোগ করবো যা showResult চিনতে পারে
            saBox = document.createElement('div');
            saBox.className = 'self-assess-box hidden';
            card.appendChild(saBox);
        }

        // ৯০% এর বেশি হলে showResult কে জানানোর জন্য ক্লাস যোগ করা
        if (pct >= 90) {
            saBox.innerHTML = '<div class="self-assess-done-correct"></div>';
            card.classList.add('flash-correct');
            haptic('correct');
            playSound('correct');
        } else {
            saBox.innerHTML = '<div class="self-assess-done-wrong"></div>';
            card.classList.add('flash-wrong');
            haptic('wrong');
            playSound('wrong');
        }
    }

    // UI আপডেট
    if (typeof updateScore === "function") updateScore();
    if (typeof updateReadingProgress === "function") updateReadingProgress();
    try { srUpdateHomeCard(); } catch(e) {}
}



    
function retryWrittenAnswer(btn) {

    var wrap = btn.closest('.written-input-wrap');
    if (!wrap) return;
    var qId = wrap.dataset.qid;
    wrap.innerHTML = '<textarea class="written-textarea" placeholder="এখানে তোমার উত্তর লিখো..." onfocus="writingFocusEnter()" onblur="writingFocusLeave()"></textarea>'
        + '<button onclick="checkWrittenAnswer(this)" class="written-submit-btn">🔍 উত্তর মিলিয়ে দেখো</button>';
    var ansBox = document.getElementById('wans-' + qId);
    if (ansBox) ansBox.classList.add('hidden');
}

    
// =====================================================
// AUTH FUNCTIONS
// =====================================================

