/* Smart Study — review.js */
function openReviewPopup() {
    var overlay = document.getElementById('review-popup-overlay');
    var sheet   = document.getElementById('review-popup-sheet');
    if (!overlay || !sheet) return;
    overlay.style.display = 'block';
    sheet.style.display   = 'flex';
    history.pushState({_reviewPopup: true}, '');
    renderReviewPopupList();
}

function closeReviewPopup() {
    var overlay = document.getElementById('review-popup-overlay');
    var sheet   = document.getElementById('review-popup-sheet');
    if (overlay) overlay.style.display = 'none';
    if (sheet)   sheet.style.display   = 'none';
    window.history.replaceState({mode: 'home', path: [], _base: true}, '');
    // Always re-render home to show updated review counts
    if (currentMode === 'home' || path.length === 0) {
        setTimeout(function() { renderView(); }, 100);
    }
}

function refreshReviewPopup() {
    var sheet = document.getElementById('review-popup-sheet');
    if (!sheet || sheet.style.display === 'none') return;
    _checkReviewComplete();
}

function renderReviewPopupList() {
    var listEl  = document.getElementById('review-popup-list');
    var countEl = document.getElementById('review-popup-count');
    if (!listEl) return;

    var wrongQIds  = JSON.parse(localStorage.getItem('wrong_q_ids')   || '[]');
    var wrongCount = JSON.parse(localStorage.getItem('wrong_q_count') || '{}');

    // ONLY questions that were actually attempted wrong
    // wrongQIds format: "quiz:1001" or "qbank:1001"
    var quizItems2  = (fullData['Quiz']  || []);
    var qbankItems2 = (fullData['QBank'] || []);
    var wrongItems  = [];
    wrongQIds.forEach(function(entry) {
        var parts = entry.split(':');
        if (parts.length < 2) return; // skip old format
        var sheet = parts[0]; // 'quiz' or 'qbank'
        var qid   = parts.slice(1).join(':');
        var pool  = sheet === 'qbank' ? qbankItems2 : quizItems2;
        var found = pool.find(function(i) { return String(getVal(i,'id')||'') === qid; });
        if (found) wrongItems.push({item: found, key: entry});
    });

    if (countEl) {
        var _ch = JSON.parse(localStorage.getItem('correct_history') || '[]').length;
        countEl.innerHTML = '<span style="color:#dc2626;font-weight:900;">' + wrongItems.length + ' ভুল বাকি</span>' +
            '<span style="color:#64748b;margin:0 6px;">·</span>' +
            '<span style="color:#16a34a;font-weight:900;">' + _ch + ' সঠিক</span>';
    }

    if (wrongItems.length === 0) {
        listEl.innerHTML =
            '<div style="text-align:center;padding:50px 20px;">' +
            '<div style="font-size:48px;margin-bottom:14px;">🎉</div>' +
            '<div style="font-weight:900;font-size:17px;color:#16a34a;margin-bottom:8px;">সব সঠিক করা হয়েছে!</div>' +
            '<div style="font-size:13px;color:#64748b;">চমৎকার! আরো পড়াশোনা চালিয়ে যাও।</div>' +
            '</div>';
        return;
    }

    listEl.innerHTML = '';

    wrongItems.forEach(function(wObj) { var item = wObj.item; var _wKey = wObj.key;
        var qId     = String(getVal(item,'id') || '');
        // Use EXACT same field name as main renderQuestions
        var rawType  = (getVal(item,'Question Type') || getVal(item,'qType') || getVal(item,'type') || '').toString().toLowerCase().trim();
        // Use same column reading as main renderQuestions
        var opt1     = (getVal(item,'option1') || getVal(item,'opt1') || '').toString().trim();
        var opt2     = (getVal(item,'option2') || getVal(item,'opt2') || '').toString().trim();
        var opt3     = (getVal(item,'option3') || getVal(item,'opt3') || '').toString().trim();
        var opt4     = (getVal(item,'option4') || getVal(item,'opt4') || '').toString().trim();
        var correct  = (getVal(item,'correct') || '').toString().trim();
        var expl     = (getVal(item,'explanation') || '').toString().trim();
        var subTopic = (getVal(item,'sub_topic') || getVal(item,'subject') || '').toString().trim();
        var wrongCnt = parseInt(wrongCount[_wKey] || 1);
        var opts     = [opt1,opt2,opt3,opt4].filter(function(o){ return o.length > 0; });
        var isWritten = rawType === 'written';
        var badgeClr  = wrongCnt >= 3 ? '#dc2626' : wrongCnt === 2 ? '#f97316' : '#f59e0b';

        // ── Card wrapper ──
        var card = document.createElement('div');
        card.id = 'rp-card-' + qId;
        card.style.cssText = 'background:#fff;border:1.5px solid #fecaca;border-radius:16px;padding:14px 14px 12px;margin-bottom:12px;transition:opacity .4s ease,max-height .5s ease,margin .4s ease,padding .4s ease;overflow:hidden;';

        // ── Sub-topic + wrong count badge ──
        var hdr = document.createElement('div');
        hdr.style.cssText = 'display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;';
        var topicSpan = document.createElement('span');
        topicSpan.style.cssText = 'font-size:10px;color:#94a3b8;font-weight:700;';
        topicSpan.textContent = subTopic;
        var badge = document.createElement('span');
        badge.style.cssText = 'background:'+badgeClr+';color:white;font-size:10px;font-weight:900;padding:3px 9px;border-radius:20px;';
        badge.textContent = '❌ ' + wrongCnt + 'বার ভুল';
        hdr.appendChild(topicSpan);
        hdr.appendChild(badge);
        card.appendChild(hdr);

        // ── Question text ──
        var qDiv = document.createElement('div');
        qDiv.style.cssText = 'font-size:14px;font-weight:700;color:#1e293b;line-height:1.55;margin-bottom:12px;';
        qDiv.innerHTML = getVal(item,'question') || '';
        card.appendChild(qDiv);

        // ── Result div (shared) ──
        var resDiv = document.createElement('div');
        resDiv.id = 'rp-res-' + qId;

        if (isWritten) {
            // ════ WRITTEN ════
            var ta = document.createElement('textarea');
            ta.id = 'rp-ta-' + qId;
            ta.placeholder = 'উত্তর লিখুন...';
            ta.style.cssText = 'width:100%;border:1.5px solid #e2e8f0;border-radius:12px;padding:10px 12px;font-size:13px;min-height:70px;resize:none;outline:none;font-family:inherit;box-sizing:border-box;margin-bottom:8px;';
            card.appendChild(ta);

            var submitBtn = document.createElement('button');
            submitBtn.textContent = '🔍 মিলিয়ে দেখো';
            submitBtn.style.cssText = 'width:100%;padding:11px;background:#4f46e5;color:white;border:none;border-radius:12px;font-weight:900;font-size:13px;cursor:pointer;margin-bottom:6px;';
            (function(id, cor, wkey) {
                submitBtn.addEventListener('click', function() {
                    _checkReviewWritten(id, cor, this, wkey);
                });
            })(qId, correct, _wKey);
            card.appendChild(submitBtn);

        } else {
            // ════ MCQ ════
            opts.forEach(function(optTxt, oi) {
                var btn = document.createElement('button');
                btn.id = 'rp-opt-' + qId + '-' + oi;
                btn.style.cssText = 'display:block;width:100%;text-align:left;padding:10px 14px;margin-bottom:7px;background:#f8fafc;border:1.5px solid #e2e8f0;border-radius:12px;font-size:13px;font-weight:600;color:#334155;cursor:pointer;transition:background .2s,border-color .2s;';
                btn.innerHTML = '<span style="display:inline-block;width:20px;height:20px;border-radius:50%;border:2px solid #cbd5e1;margin-right:8px;vertical-align:middle;"></span>' + optTxt;
                (function(id, chosen, cor, expl2, allOpts, wkey) {
                    btn.addEventListener('click', function() {
                        _checkReviewMCQ(id, chosen, cor, expl2, allOpts, oi, wkey);
                    });
                })(qId, optTxt, correct, expl, opts, _wKey);
                card.appendChild(btn);
            });
        }

        card.appendChild(resDiv);
        listEl.appendChild(card);
    });
}

// Internal MCQ check
function _checkReviewMCQ(qId, chosen, correct, expl, allOpts, selectedOi, wKey) {
    var isCorrect = chosen.trim().toLowerCase() === correct.trim().toLowerCase();

    // Color all options
    allOpts.forEach(function(optTxt, oi) {
        var btn = document.getElementById('rp-opt-' + qId + '-' + oi);
        if (!btn) return;
        btn.style.pointerEvents = 'none';
        if (optTxt.trim().toLowerCase() === correct.trim().toLowerCase()) {
            btn.style.background   = '#dcfce7';
            btn.style.borderColor  = '#16a34a';
            btn.style.color        = '#15803d';
            btn.style.fontWeight   = '900';
            btn.querySelector('span').style.cssText = 'display:inline-block;width:20px;height:20px;border-radius:50%;background:#16a34a;border:2px solid #16a34a;margin-right:8px;vertical-align:middle;';
        } else if (oi === selectedOi && !isCorrect) {
            btn.style.background  = '#fee2e2';
            btn.style.borderColor = '#dc2626';
            btn.style.color       = '#dc2626';
            btn.querySelector('span').style.cssText = 'display:inline-block;width:20px;height:20px;border-radius:50%;background:#dc2626;border:2px solid #dc2626;margin-right:8px;vertical-align:middle;';
        }
    });

    var resDiv = document.getElementById('rp-res-' + qId);
    if (!resDiv) return;

    if (isCorrect) {
        resDiv.innerHTML = '<div style="background:#f0fdf4;border:1px solid #86efac;border-radius:10px;padding:10px 12px;margin-top:6px;">' +
            '<div style="color:#15803d;font-weight:900;font-size:13px;">✅ সঠিক! চমৎকার!</div>' +
            (expl ? '<div style="color:#166534;font-size:12px;margin-top:4px;line-height:1.5;">💡 ' + expl + '</div>' : '') +
            '</div>';
        _markReviewCorrect(wKey, qId);
        awardXP(5);
    } else {
        var wrongCount = JSON.parse(localStorage.getItem('wrong_q_count') || '{}');
        wrongCount[wKey] = (wrongCount[wKey] || 1) + 1;
        localStorage.setItem('wrong_q_count', JSON.stringify(wrongCount));
        resDiv.innerHTML = '<div style="background:#fef2f2;border:1px solid #fecaca;border-radius:10px;padding:10px 12px;margin-top:6px;">' +
            '<div style="color:#dc2626;font-weight:900;font-size:13px;">❌ ভুল হয়েছে</div>' +
            '<div style="color:#15803d;font-size:12px;font-weight:700;margin-top:4px;">✅ সঠিক উত্তর: ' + correct + '</div>' +
            (expl ? '<div style="color:#64748b;font-size:12px;margin-top:4px;line-height:1.5;">💡 ' + expl + '</div>' : '') +
            '</div>';
        var card = document.getElementById('rp-card-' + qId);
        if (card) {
            var badge = card.querySelectorAll('span')[1];
            if (badge) { badge.textContent = '❌ ' + wrongCount[wKey] + 'বার ভুল'; }
        }
    }
}

// Internal Written check  
function _checkReviewWritten(qId, correct, btn, wKey) {
    var ta = document.getElementById('rp-ta-' + qId);
    if (!ta) return;
    var userAns = ta.value.trim();
    if (!userAns) { showToast('উত্তর লিখুন'); return; }

    btn.textContent = '⏳ মিলিয়ে দেখছি...';
    btn.disabled = true;
    btn.style.background = '#94a3b8';

    var result = localMatchAnswer(userAns, correct);
    var pct    = result ? (result.pct || 0) : 0;
    var resDiv = document.getElementById('rp-res-' + qId);
    if (!resDiv) return;

    btn.style.display = 'none';

    if (pct >= 70) {
        resDiv.innerHTML =
            '<div style="background:#f0fdf4;border:1px solid #86efac;border-radius:10px;padding:10px 12px;margin-top:6px;">' +
            '<div style="color:#15803d;font-weight:900;font-size:13px;">✅ সঠিক! (' + pct + '%)</div>' +
            '<div style="background:#dcfce7;border-radius:8px;padding:8px 10px;margin-top:6px;font-size:12px;color:#166534;font-weight:700;">সঠিক উত্তর:<br>' + correct + '</div>' +
            '</div>';
        _markReviewCorrect(wKey || qId, qId);
        awardXP(5);
    } else {
        resDiv.innerHTML =
            '<div style="background:#fef2f2;border:1px solid #fecaca;border-radius:10px;padding:10px 12px;margin-top:6px;">' +
            '<div style="color:#dc2626;font-weight:900;font-size:13px;">' + (pct >= 40 ? '⚠️ আংশিক সঠিক (' + pct + '%)' : '❌ ভুল হয়েছে') + '</div>' +
            '<div style="background:#fef9c3;border-radius:8px;padding:8px 10px;margin-top:6px;font-size:12px;color:#854d0e;font-weight:700;">সঠিক উত্তর:<br>' + correct + '</div>' +
            '</div>';
        var wrongCount = JSON.parse(localStorage.getItem('wrong_q_count') || '{}');
        var _wk = wKey || qId;
        wrongCount[_wk] = (wrongCount[_wk] || 1) + 1;
        localStorage.setItem('wrong_q_count', JSON.stringify(wrongCount));
        // Show retry button
        var retry = document.createElement('button');
        retry.textContent = '🔄 আবার চেষ্টা করো';
        retry.style.cssText = 'width:100%;padding:10px;background:#f1f5f9;color:#475569;border:1.5px solid #e2e8f0;border-radius:12px;font-weight:900;font-size:12px;cursor:pointer;margin-top:8px;';
        (function(id, cor, b) {
            retry.addEventListener('click', function() {
                resDiv.innerHTML = '';
                var ta2 = document.getElementById('rp-ta-' + id);
                if (ta2) { ta2.value = ''; ta2.style.display = ''; }
                b.textContent = '🔍 মিলিয়ে দেখো';
                b.disabled = false;
                b.style.background = '#4f46e5';
                b.style.display = '';
                retry.remove();
            });
        })(qId, correct, btn);
        resDiv.appendChild(retry);
    }
}

// Smooth hide a card then refresh
function _hideReviewCard(qId) {
    var card = document.getElementById('rp-card-' + qId);
    if (!card) return;
    card.style.opacity    = '0';
    card.style.maxHeight  = card.offsetHeight + 'px';
    // Force reflow
    card.offsetHeight;
    card.style.maxHeight  = '0';
    card.style.marginBottom = '0';
    card.style.padding    = '0';
    card.style.border     = 'none';
    setTimeout(function() {
        if (card.parentNode) card.parentNode.removeChild(card);
        _checkReviewComplete();
    }, 520);
}

// Check if all done
function _checkReviewComplete() {
    var wrongQIds = JSON.parse(localStorage.getItem('wrong_q_ids') || '[]');
    var remaining = wrongQIds; // just count entries
    var countEl = document.getElementById('review-popup-count');
    if (countEl) countEl.textContent = remaining.length + 'টি ভুল প্রশ্ন বাকি';

    if (remaining.length === 0) {
        var listEl = document.getElementById('review-popup-list');
        if (listEl) {
            listEl.innerHTML =
                '<div style="text-align:center;padding:50px 20px;animation:fadeIn .5s ease;">' +
                '<div style="font-size:52px;margin-bottom:14px;">🎉</div>' +
                '<div style="font-weight:900;font-size:18px;color:#16a34a;margin-bottom:8px;">অসাধারণ!</div>' +
                '<div style="font-size:13px;color:#64748b;">সব ভুল প্রশ্ন সঠিক করা হয়েছে!</div>' +
                '</div>';
        }
        showToast('🎉 সব ভুল প্রশ্ন সঠিক করা হয়েছে!');
        setTimeout(function() {
            closeReviewPopup();
            // Re-render home to remove review section
            if (currentMode === 'home' || !currentMode) {
                renderView();
            }
        }, 2200);
    }
}







// Remove from wrong_q_ids by mode:id key, then hide card
function _markReviewCorrect(wKey, qId) {
    var wrongIds = JSON.parse(localStorage.getItem('wrong_q_ids') || '[]');
    var idx = wrongIds.indexOf(wKey);
    if (idx !== -1) {
        wrongIds.splice(idx, 1);
        localStorage.setItem('wrong_q_ids', JSON.stringify(wrongIds));
    }
    // Also update correct_history
    var correct_h = JSON.parse(localStorage.getItem('correct_history') || '[]');
    if (!correct_h.includes(wKey)) {
        correct_h.push(wKey);
        localStorage.setItem('correct_history', JSON.stringify(correct_h));
    }
    setTimeout(function() { _hideReviewCard(qId); }, 1200);
}

