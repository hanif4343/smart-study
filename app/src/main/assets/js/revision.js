/* Smart Study — revision.js */
    var dueIds = srGetDueIds();
    if (dueIds.length === 0) { showToast('✅ আজকের সব revision শেষ!'); return; }
    // Find matching items from fullData
    var allItems = [];
    ['QBank','Study','Quiz'].forEach(function(sheet) {
        if (fullData[sheet]) allItems = allItems.concat(fullData[sheet]);
    });
    var dueSet = new Set(dueIds);
    var dueItems = allItems.filter(function(item) {
        var id = getVal(item,'id') || getVal(item,'sl') || '';
        return dueSet.has(String(id)) || dueSet.has('quiz:'+id) || dueSet.has('qbank:'+id);
    });
    // Deduplicate
    var seen = new Set();
    dueItems = dueItems.filter(function(item) {
        var id = getVal(item,'id')||getVal(item,'sl')||'';
        if (seen.has(id)) return false;
        seen.add(id); return true;
    });
    if (dueItems.length === 0) { showToast('⚠️ Revision প্রশ্ন লোড হয়নি'); return; }
    quizItems = dueItems;
    displayLimit = dueItems.length;
    currentMode = 'quiz';
    updateUIMode('quiz');
    renderQuestions();
    showToast('🔁 ' + dueItems.length + 'টি revision প্রশ্ন শুরু!');
}

function srUpdateHomeCard() {
    try {
        var due = srGetDueCount();
        var card = document.getElementById('sr-revision-card');
        var countEl = document.getElementById('sr-due-count');
        var labelEl = document.getElementById('sr-due-label');
        if (!card) return;
        if (due > 0) {
            card.style.display = 'block';
            if (countEl) countEl.textContent = due;
            if (labelEl) labelEl.textContent = due + 'টি প্রশ্ন review বাকি আছে';
        } else {
            card.style.display = 'none';
        }
    } catch(e) {}
}


// ============================================================
// 📊 FULL PROGRESS REPORT — Phase 2 upgrade + Social Signals
// ============================================================

