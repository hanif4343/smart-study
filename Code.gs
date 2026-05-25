/*
══════════════════════════════════════════════════════════
  SMART STUDY — MASTER GAS
  Script Properties এ এগুলো set করুন:
    FIREBASE_URL     → https://yourproject-default-rtdb.firebaseio.com/
    SECRET_KEY       → your-firebase-secret
    FCM_PROJECT_ID   → your-project-id
    FCM_CLIENT_EMAIL → firebase-adminsdk-xxx@your-project.iam.gserviceaccount.com
    PRIVATE_KEY      → -----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n
    GEMINI_API_KEY   → AIza...
══════════════════════════════════════════════════════════
*/

function getProps() {
  var p = PropertiesService.getScriptProperties();
  return {
    FIREBASE_URL:     p.getProperty("FIREBASE_URL")     || "",
    SECRET_KEY:       p.getProperty("SECRET_KEY")       || "",
    FCM_PROJECT_ID:   p.getProperty("FCM_PROJECT_ID")   || "",
    FCM_CLIENT_EMAIL: p.getProperty("FCM_CLIENT_EMAIL") || "",
    PRIVATE_KEY:      p.getProperty("PRIVATE_KEY")      || "",
    GEMINI_API_KEY:   p.getProperty("GEMINI_API_KEY")   || "",
  };
}

// ── পাসওয়ার্ড হ্যাশিং (SHA-256) ──
function hashPassword(password) {
  var rawBytes = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    password,
    Utilities.Charset.UTF_8
  );
  return rawBytes.map(function(b) {
    return ('0' + (b & 0xFF).toString(16)).slice(-2);
  }).join('');
}

/*
══════════════════════════════════════════════════════════
FCM V1 API
══════════════════════════════════════════════════════════
*/
function getFCMAccessToken() {
  var cfg = getProps();
  // PRIVATE_KEY এ \\n literal থাকলে actual newline এ convert করো
  var privateKey = cfg.PRIVATE_KEY.replace(/\\n/g, '\n');
  var now = Math.floor(Date.now() / 1000);
  var header = Utilities.base64EncodeWebSafe(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  var claim  = Utilities.base64EncodeWebSafe(JSON.stringify({
    iss:   cfg.FCM_CLIENT_EMAIL,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud:   "https://oauth2.googleapis.com/token",
    exp:   now + 3600,
    iat:   now
  }));
  var signInput = header + "." + claim;
  var signature = Utilities.base64EncodeWebSafe(
    Utilities.computeRsaSha256Signature(signInput, privateKey)
  );
  var jwt = signInput + "." + signature;
  var tokenResp = UrlFetchApp.fetch("https://oauth2.googleapis.com/token", {
    method: "post",
    contentType: "application/x-www-form-urlencoded",
    payload: "grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=" + jwt,
    muteHttpExceptions: true
  });
  return JSON.parse(tokenResp.getContentText()).access_token;
}

function sendFCMToToken(fcmToken, title, body, data) {
  try {
    var cfg = getProps();
    var accessToken = getFCMAccessToken();
    // শুধু data payload — notification block নেই
    // এতে সব সময় onMessageReceived fire হবে, double notification হবে না
    var extraData = data || {};
    extraData.title = title;
    extraData.body = body;
    var message = {
      message: {
        token: fcmToken,
        data: extraData,
        android: { priority: "high" }
      }
    };
    var resp = UrlFetchApp.fetch(
      "https://fcm.googleapis.com/v1/projects/" + cfg.FCM_PROJECT_ID + "/messages:send",
      { method:"post", contentType:"application/json", headers:{"Authorization":"Bearer "+accessToken}, payload:JSON.stringify(message), muteHttpExceptions:true }
    );
    var result = JSON.parse(resp.getContentText());
    Logger.log("FCM sent: " + JSON.stringify(result));
    return result;
  } catch(e) {
    Logger.log("FCM Error: " + e.toString());
    return { error: e.toString() };
  }
}

function getFCMTokenByPhone(phone) {
  try {
    var cfg = getProps();
    var safePhone = phone.toString().trim().replace(/[.#$\[\]\s]/g, '_');
    var resp = UrlFetchApp.fetch(cfg.FIREBASE_URL + "FCMTokens/" + safePhone + ".json?auth=" + cfg.SECRET_KEY, { muteHttpExceptions:true });
    var data = JSON.parse(resp.getContentText());
    return (data && data.token) ? data.token : null;
  } catch(e) { return null; }
}

function sendFCMToPhone(phone, title, body, extraData) {
  var token = getFCMTokenByPhone(phone);
  if (!token) { Logger.log("FCM Token পাওয়া যায়নি: " + phone); return { error: "Token not found for " + phone }; }
  return sendFCMToToken(token, title, body, extraData || {});
}

function sendFCMToAll(title, body, extraData) {
  try {
    var cfg = getProps();
    var resp = UrlFetchApp.fetch(cfg.FIREBASE_URL + "FCMTokens.json?auth=" + cfg.SECRET_KEY, { muteHttpExceptions:true });
    var tokens = JSON.parse(resp.getContentText());
    if (!tokens || typeof tokens !== 'object') return { error: "No tokens found" };
    var sent = 0, failed = 0;
    Object.keys(tokens).forEach(function(phone) {
      var token = tokens[phone] && tokens[phone].token;
      if (token) {
        var result = sendFCMToToken(token, title, body, extraData || {});
        if (result.error) failed++; else sent++;
        Utilities.sleep(100);
      }
    });
    Logger.log("FCM All: sent=" + sent + " failed=" + failed);
    return { sent: sent, failed: failed };
  } catch(e) { return { error: e.toString() }; }
}

/*
══════════════════════════════════════════════════════════
HELPER — Atomic ID
══════════════════════════════════════════════════════════
*/
function getNextId(sheetName) {
  var lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    var prop = PropertiesService.getScriptProperties();
    var key  = "MAX_ID_" + sheetName.toUpperCase();
    var ss   = SpreadsheetApp.getActiveSpreadsheet();
    var sh   = ss.getSheetByName(sheetName);
    var cur  = parseInt(prop.getProperty(key) || "0");
    if (cur < 1000 && sh && sh.getLastRow() > 1) {
      var ids = sh.getRange(2, 1, sh.getLastRow()-1, 1).getValues().map(function(r){ return parseInt(r[0])||0; });
      cur = Math.max.apply(null, ids);
    }
    if (cur < 1000) cur = 1000;
    var next = cur + 1;
    prop.setProperty(key, next.toString());
    return next;
  } finally { lock.releaseLock(); }
}

/*
══════════════════════════════════════════════════════════
HELPER — Duplicate check (question + subject + sub_topic)
══════════════════════════════════════════════════════════
*/
function isDuplicate(sheet, subject, questionText, sub_topic) {
  var data = sheet.getDataRange().getValues();
  if (data.length < 2) return false;
  var hdr  = data[0].map(function(h){ return h.toString().toLowerCase().trim(); });
  var qIdx = hdr.indexOf("question");
  var subIdx = hdr.indexOf("subject");
  var stIdx  = hdr.indexOf("sub_topic");
  if (stIdx===-1) stIdx = hdr.indexOf("subtopic");
  if (stIdx===-1) stIdx = hdr.indexOf("sub-topic");
  if (stIdx===-1) { for(var i=0;i<hdr.length;i++){ if(hdr[i].includes("sub")&&hdr[i].includes("topic")){stIdx=i;break;} } }
  if (qIdx===-1) return false;
  var norm = function(s){ return s.toString().toLowerCase().replace(/\s+/g,' ').trim().substring(0,100); };
  var needleQ=norm(questionText), needleST=norm(sub_topic||''), needleSub=norm(subject||'');
  for (var r=1;r<data.length;r++) {
    if (norm(data[r][qIdx])!==needleQ) continue;
    var rowST  = stIdx  !==-1 ? norm(data[r][stIdx])  : '';
    var rowSub = subIdx !==-1 ? norm(data[r][subIdx]) : '';
    if (rowST===needleST && rowSub===needleSub) return true;
  }
  return false;
}

/*
══════════════════════════════════════════════════════════
FIREBASE SYNC
══════════════════════════════════════════════════════════
*/
function syncToFirebase(sheetName, folderName) {
  try {
    var cfg  = getProps();
    var ss   = SpreadsheetApp.getActiveSpreadsheet();
    var fbSh = ss.getSheetByName(sheetName);
    if (!fbSh) return;
    var fbData = fbSh.getDataRange().getValues();
    if (fbData.length < 2) return;
    var fbHdr = fbData[0];

    // Reports — keyed object দিয়ে save করো (row number key)
    // এতে specific row delete করা যাবে
    if (sheetName === "Reports") {
      var keyedData = {};
      for (var i=1;i<fbData.length;i++) {
        var rec={};
        for (var j=0;j<fbHdr.length;j++) {
          var k=fbHdr[j].toString().trim();
          if(k){ var v=fbData[i][j]; rec[k]=(v instanceof Date)?Utilities.formatDate(v,"GMT+6","dd-MM-yyyy HH:mm:ss"):v.toString(); }
        }
        // key = "row_X" — unique এবং row number track করে
        keyedData["row_"+i] = rec;
      }
      UrlFetchApp.fetch(cfg.FIREBASE_URL+folderName+".json?auth="+cfg.SECRET_KEY, {method:"put",contentType:"application/json",payload:JSON.stringify(keyedData)});
      return;
    }

    var jsonData = [];
    for (var i2=1;i2<fbData.length;i2++) {
      var rec2={};
      for (var j2=0;j2<fbHdr.length;j2++) {
        var k2=fbHdr[j2].toString().trim();
        if (k2) { var v2=fbData[i2][j2]; rec2[k2]=(v2 instanceof Date)?Utilities.formatDate(v2,"GMT+6","dd-MM-yyyy HH:mm:ss"):v2; }
      }
      jsonData.push(rec2);
    }
    UrlFetchApp.fetch(cfg.FIREBASE_URL+folderName+".json?auth="+cfg.SECRET_KEY, { method:"put", contentType:"application/json", payload:JSON.stringify(jsonData) });
  } catch(e){ console.log("Firebase Error: "+e.toString()); }
}

/*
══════════════════════════════════════════════════════════
doGet
══════════════════════════════════════════════════════════
*/
function doGet(e) {
  var action = e.parameter.action;
  var cfg    = getProps();

  // ── verifyLogin ──
  if (action === "verifyLogin") {
    var phone = (e.parameter.phone || "").toString().trim().replace(/\s/g, '');
    var pass  = (e.parameter.password || "").toString().trim();
    if (!phone || !pass) return json({ result:"error", error:"missing credentials" });
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var uSh = ss.getSheetByName("Users");
    if (!uSh) return json({ result:"error", error:"Users sheet not found" });
    var uData = uSh.getDataRange().getValues();
    var uHdr  = uData[0].map(function(h){ return h.toString().toLowerCase().trim(); });
    var phCol = uHdr.indexOf("phone");
    var pwCol = uHdr.indexOf("password");
    var normP = phone.replace(/^0+/, '');
    var hashedPass = hashPassword(pass);
    for (var i = 1; i < uData.length; i++) {
      var uPhone = (phCol !== -1 ? uData[i][phCol] : "").toString().trim().replace(/['\s]/g, '');
      var normU  = uPhone.replace(/^0+/, '');
      if (uPhone !== phone && normU !== normP) continue;
      var storedPass = (pwCol !== -1 ? uData[i][pwCol] : "").toString().trim();
      var passOk = (storedPass === hashedPass) || (storedPass === pass);
      if (!passOk) return json({ result:"error", error:"wrong password" });
      var rec = {};
      for (var j = 0; j < uHdr.length; j++) {
        var key = uData[0][j].toString().trim();
        if (key) rec[key] = uData[i][j].toString();
      }
      return json({ result:"success", user: rec });
    }
    return json({ result:"error", error:"user not found" });
  }

  // ── updateField ──
  if (action==="updateField") {
    var ss=SpreadsheetApp.getActiveSpreadsheet();
    var shName=e.parameter.sheet||"";
    var shMap={quiz:"Quiz",qbank:"QBank",study:"Study",users:"Users",typing:"Typing"};
    shName=shMap[shName.toLowerCase()]||shName;
    var uSheet=ss.getSheetByName(shName);
    if (!uSheet) return json({result:"error",error:"Sheet not found: "+shName});
    var uRows=uSheet.getDataRange().getValues();
    var uHdr=uRows[0].map(function(h){return h.toString().toLowerCase().trim();});
    var idC=uHdr.indexOf("id"); if(idC===-1) idC=uHdr.indexOf("phone");
    var fld=(e.parameter.field||"").toLowerCase().trim();
    var fldC=uHdr.indexOf(fld);
    if(fldC===-1){for(var fc=0;fc<uHdr.length;fc++){if(uHdr[fc].includes(fld)){fldC=fc;break;}}}
    if(idC===-1||fldC===-1) return json({result:"error",error:"Column not found: "+fld});
    var targetId=(e.parameter.id||"").toString().trim();
    var content=decodeURIComponent(e.parameter.content||"");
    for(var ur=1;ur<uRows.length;ur++){
      if(uRows[ur][idC].toString().trim()===targetId){
        uSheet.getRange(ur+1,fldC+1).setValue(content);
        syncToFirebase(shName,shName);
        return json({result:"success"});
      }
    }
    return json({result:"error",error:"ID not found: "+targetId});
  }

  // ── activateUser ──
  if (action==="activateUser") {
    var ss=SpreadsheetApp.getActiveSpreadsheet();
    var phone=(e.parameter.phone||"").toString().trim();
    if(!phone) return json({result:"error",error:"phone missing"});
    var uSh=ss.getSheetByName("Users");
    if(!uSh) return json({result:"error",error:"Users sheet not found"});
    var uData=uSh.getDataRange().getValues();
    var uHdr=uData[0].map(function(h){return h.toString().toLowerCase().trim();});
    var phCol=uHdr.indexOf("phone"), stCol=uHdr.indexOf("status");
    if(stCol===-1){stCol=uData[0].length;uSh.getRange(1,stCol+1).setValue("Status");}
    var normPhone=phone.replace(/^0+/,'');
    for(var i=1;i<uData.length;i++){
      var rowPhone=(phCol!==-1?uData[i][phCol]:"").toString().trim().replace(/^'+/,'').replace(/^0+/,'');
      if(rowPhone===normPhone||uData[i][phCol].toString().trim()===phone){
        uSh.getRange(i+1,stCol+1).setValue("Active");
        syncToFirebase("Users","Users");
        var fcmResult=sendFCMToPhone(phone,"🎉 আপনার অ্যাকাউন্ট অ্যাক্টিভ হয়েছে!","Smart Study-তে আপনাকে স্বাগতম! এখন পড়াশোনা শুরু করুন।",{type:"account_activated"});
        return json({result:"success",fcm:fcmResult});
      }
    }
    return json({result:"error",error:"User not found: "+phone});
  }

  // ── deleteReport ── report solve হলে Firebase + Sheet থেকে মুছে দাও
  if (action==="deleteReport") {
    var cfg3=getProps();
    var key=(e.parameter.key||"").toString().trim();
    if(!key) return json({result:"error",error:"key missing"});

    // 1. Firebase থেকে delete করো
    try{
      UrlFetchApp.fetch(cfg3.FIREBASE_URL+"Reports/"+key+".json?auth="+cfg3.SECRET_KEY,{method:"delete",muteHttpExceptions:true});
    }catch(fe){Logger.log("FB delete error: "+fe);}

    // 2. Sheet থেকে delete করো
    var ss2=SpreadsheetApp.getActiveSpreadsheet();
    var rs=ss2.getSheetByName("Reports");
    if(rs){
      // key format: "row_X" → row index X, or plain number
      var rowNum = -1;
      if(key.indexOf("row_")===0){
        rowNum = parseInt(key.replace("row_",""),10);
      } else if(!isNaN(parseInt(key,10))){
        rowNum = parseInt(key,10);
      }
      if(rowNum>=1 && rowNum<rs.getLastRow()){
        rs.deleteRow(rowNum+1); // +1 because header is row 1
      }
    }

    // 3. Firebase Reports resync
    try{syncToFirebase("Reports","Reports");}catch(_){}
    return json({result:"success",key:key});
  }

  // ── renameField ── subject/topic rename across sheet
  if (action==="renameField") {
    var shName=e.parameter.sheet||"QBank";
    var field=decodeURIComponent(e.parameter.field||"subject");
    var oldV=decodeURIComponent(e.parameter.oldVal||"");
    var newV=decodeURIComponent(e.parameter.newVal||"");
    if(!oldV||!newV) return json({result:"error",error:"missing values"});
    var ss3=SpreadsheetApp.getActiveSpreadsheet();
    var sh3=ss3.getSheetByName(shName);
    if(!sh3) return json({result:"error",error:"sheet not found"});
    var d3=sh3.getDataRange().getValues();
    var h3=d3[0];
    var fIdx=h3.findIndex ? h3.findIndex(function(h){return h.toString().toLowerCase()===field.toLowerCase();}) : -1;
    if(fIdx<0) return json({result:"error",error:"field not found"});
    var count=0;
    for(var i3=1;i3<d3.length;i3++){
      if(d3[i3][fIdx].toString().trim()===oldV.trim()){
        sh3.getRange(i3+1,fIdx+1).setValue(newV);
        count++;
      }
    }
    return json({result:"success",count:count});
  }

  // ── deleteByIds ── delete questions by id list
  if (action==="deleteByIds") {
    var shName2=e.parameter.sheet||"QBank";
    var ids=(decodeURIComponent(e.parameter.ids||"")).split(",").map(function(x){return x.trim();}).filter(Boolean);
    if(!ids.length) return json({result:"error",error:"no ids"});
    var ss4=SpreadsheetApp.getActiveSpreadsheet();
    var sh4=ss4.getSheetByName(shName2);
    if(!sh4) return json({result:"error",error:"sheet not found"});
    var d4=sh4.getDataRange().getValues();
    var h4=d4[0];
    var idIdx=h4.findIndex ? h4.findIndex(function(h){return h.toString().toLowerCase()==="id"||h.toString().toLowerCase()==="sl";}) : -1;
    var deleted=0;
    for(var i4=d4.length-1;i4>=1;i4--){
      var rowId=idIdx>=0?d4[i4][idIdx].toString():"";
      if(ids.indexOf(rowId)>=0){sh4.deleteRow(i4+1);deleted++;}
    }
    return json({result:"success",deleted:deleted});
  }

  // ── adminNotify ── admin কে FCM notify করো (new signup / login)
  if (action==="adminNotify") {
    var cfg2=getProps();
    var adminPhone=(cfg2.ADMIN_PHONE||"").toString().replace(/^'+/,'').trim();
    if(!adminPhone) return json({result:"error",error:"ADMIN_PHONE not set in Script Properties"});
    var evType=e.parameter.event||"login"; // "signup" or "login"
    var uName=decodeURIComponent(e.parameter.name||"কেউ");
    var uPhone=decodeURIComponent(e.parameter.phone||"");
    var uType=decodeURIComponent(e.parameter.userType||"");
    var title = evType==="signup"
      ? "🆕 নতুন Signup!"
      : "👤 User লগইন করেছে";
    var body = evType==="signup"
      ? uName+" ("+uPhone+") নতুন অ্যাকাউন্ট তৈরি করেছে।"+(uType?" ["+uType+"]":"")
      : uName+" ("+uPhone+") লগইন করেছে।";
    var fcmResult=sendFCMToPhone(adminPhone,title,body,{type:"admin_"+evType,url:"signups"});
    return json({result:"success",fcm:fcmResult});
  }

  // ── resolveReport ──
  if (action==="resolveReport") {
    var phone=(e.parameter.phone||"").toString().replace(/^'+/,'').trim();
    var subject=decodeURIComponent(e.parameter.subject||"প্রশ্নটি");
    var qid=e.parameter.questionId||"";
    var qsheet=decodeURIComponent(e.parameter.qsheet||"");
    if(!phone) return json({result:"error",error:"phone missing"});
    var safePhone=phone.replace(/[.#$\[\]\s]/g,'_');
    var notifKey='notif_'+Date.now();
    var payload={type:'report_resolved',title:'✅ আপনার রিপোর্ট সমাধান হয়েছে!',body:'"'+subject+'" সংশোধন করা হয়েছে।',questionId:qid,qsheet:qsheet,time:new Date().toLocaleString(),read:false};
    UrlFetchApp.fetch(cfg.FIREBASE_URL+"Notifications/"+safePhone+"/"+notifKey+".json?auth="+cfg.SECRET_KEY,{method:"put",contentType:"application/json",payload:JSON.stringify(payload),muteHttpExceptions:true});
    var fcmData={type:"report_resolved",questionId:qid,url:"report"};
    if(qsheet) fcmData.qsheet=qsheet;
    var fcmResult=sendFCMToPhone(phone,"✅ রিপোর্ট সমাধান হয়েছে!",'"'+subject+'" সংশোধন করা হয়েছে।',fcmData);
    return json({result:"success",fcm:fcmResult});
  }

  // ── personalNotify ── নির্দিষ্ট user কে FCM পাঠায়
  if (action==="personalNotify") {
    var phone=(e.parameter.phone||"").toString().replace(/^'+/,'').trim();
    var title=decodeURIComponent(e.parameter.title||"Smart Study");
    var body=decodeURIComponent(e.parameter.body||"");
    var notifUrl=decodeURIComponent(e.parameter.url||"");
    var notifQid=decodeURIComponent(e.parameter.questionId||"");
    var notifQsheet=decodeURIComponent(e.parameter.qsheet||"");
    if(!phone) return json({result:"error",error:"phone missing"});
    var extraData={type:"personal_notification"};
    if(notifUrl) extraData.url=notifUrl;
    if(notifQid) extraData.questionId=notifQid;
    if(notifQsheet) extraData.qsheet=notifQsheet;
    var fcmResult=sendFCMToPhone(phone,title,body,extraData);
    return json({result:"success",fcm:fcmResult});
  }

  // ── broadcastNotification ──
  if (action==="broadcastNotification") {
    var title=decodeURIComponent(e.parameter.title||'Smart Study');
    var body=decodeURIComponent(e.parameter.body||'');
    var bUrl=decodeURIComponent(e.parameter.url||'qbank');
    return json({result:"success",fcm:sendFCMToAll(title,body,{type:"broadcast",url:bUrl})});
  }

  // ── postNotice (GET) ──
  if (action==="postNotice") {
    var ss=SpreadsheetApp.getActiveSpreadsheet();
    var nSh=ss.getSheetByName("Notice");
    if(!nSh){nSh=ss.insertSheet("Notice");nSh.appendRow(["Date","Title","Message","Timestamp"]);}
    var nTitle=decodeURIComponent(e.parameter.n_title||"");
    var nMsg=decodeURIComponent(e.parameter.n_msg||"");
    var nTs=decodeURIComponent(e.parameter.timestamp||new Date().toLocaleString());
    var nDate=nTs.split(",")[0]||Utilities.formatDate(new Date(),"GMT+6","dd/MM/yyyy");
    if(!nTitle||!nMsg) return json({result:"error",error:"title or message missing"});
    nSh.appendRow([nDate,nTitle,nMsg,nTs]);
    syncToFirebase("Notice","Notice");
    return json({result:"success"});
  }

  // ── getDashboard — topic/subtopic hierarchy সহ ──
  if (action==="getDashboard") {
    var ss=SpreadsheetApp.getActiveSpreadsheet();
    var out={quiz:{},qbank:{},study:{},reports:[],totalToday:0};
    var today=Utilities.formatDate(new Date(),"GMT+6","dd/MM/yyyy");

    // Quiz
    var qSh=ss.getSheetByName("Quiz");
    if(qSh&&qSh.getLastRow()>1){
      var qData=qSh.getDataRange().getValues();
      var qHdr=qData[0].map(function(h){return h.toString().toLowerCase().trim();});
      var qSubI=qHdr.indexOf("subject");
      var qTypI=qHdr.indexOf("qtype"); if(qTypI===-1)qTypI=qHdr.indexOf("question type");
      var qTsI=qHdr.indexOf("timestamp");
      var qStI=qHdr.indexOf("sub_topic"); if(qStI===-1)qStI=qHdr.indexOf("subtopic");
      for(var i=1;i<qData.length;i++){
        var sub=(qSubI!==-1?qData[i][qSubI]:"").toString().trim()||"Unknown";
        var qtyp=(qTypI!==-1?qData[i][qTypI]:"MCQ").toString().trim()||"MCQ";
        var stRaw=(qStI!==-1?qData[i][qStI]:"").toString().trim()||"General";
        var isWritten=qtyp.toLowerCase()==="written";
        if(!out.quiz[sub])out.quiz[sub]={total:0,mcq:0,written:0,topics:{}};
        out.quiz[sub].total++;
        if(isWritten)out.quiz[sub].written++;else out.quiz[sub].mcq++;
        // topic/subtopic: "Topic > SubTopic" format বা শুধু sub_topic
        var parts=stRaw.indexOf(" > ")!==-1?stRaw.split(" > "):[stRaw,stRaw];
        var topic=parts[0].trim()||"General";
        var st=parts.length>1?parts[1].trim():stRaw;
        if(!out.quiz[sub].topics[topic])out.quiz[sub].topics[topic]={total:0,subtopics:{}};
        out.quiz[sub].topics[topic].total++;
        if(!out.quiz[sub].topics[topic].subtopics[st])out.quiz[sub].topics[topic].subtopics[st]={total:0,mcq:0,written:0};
        out.quiz[sub].topics[topic].subtopics[st].total++;
        if(isWritten)out.quiz[sub].topics[topic].subtopics[st].written++;
        else out.quiz[sub].topics[topic].subtopics[st].mcq++;
        if(qTsI!==-1&&qData[i][qTsI].toString().indexOf(today)!==-1)out.totalToday++;
      }
    }

    // QBank — আলাদা topic column আছে
    var bSh=ss.getSheetByName("QBank");
    if(bSh&&bSh.getLastRow()>1){
      var bData=bSh.getDataRange().getValues();
      var bHdr=bData[0].map(function(h){return h.toString().toLowerCase().trim();});
      var bSubI=bHdr.indexOf("subject");
      var bTypI=bHdr.indexOf("qtype"); if(bTypI===-1)bTypI=bHdr.indexOf("question type");
      var bTsI=bHdr.indexOf("timestamp");
      var bTopI=bHdr.indexOf("topic");
      var bStI=bHdr.indexOf("sub_topic"); if(bStI===-1)bStI=bHdr.indexOf("subtopic");
      for(var j=1;j<bData.length;j++){
        var bsub=(bSubI!==-1?bData[j][bSubI]:"").toString().trim()||"Unknown";
        var btyp=(bTypI!==-1?bData[j][bTypI]:"MCQ").toString().trim()||"MCQ";
        var btop=(bTopI!==-1?bData[j][bTopI]:"").toString().trim()||"General";
        var bst=(bStI!==-1?bData[j][bStI]:"").toString().trim()||"General";
        var bIsWr=btyp.toLowerCase()==="written";
        if(!out.qbank[bsub])out.qbank[bsub]={total:0,mcq:0,written:0,topics:{}};
        out.qbank[bsub].total++;
        if(bIsWr)out.qbank[bsub].written++;else out.qbank[bsub].mcq++;
        if(!out.qbank[bsub].topics[btop])out.qbank[bsub].topics[btop]={total:0,subtopics:{}};
        out.qbank[bsub].topics[btop].total++;
        if(!out.qbank[bsub].topics[btop].subtopics[bst])out.qbank[bsub].topics[btop].subtopics[bst]={total:0,mcq:0,written:0};
        out.qbank[bsub].topics[btop].subtopics[bst].total++;
        if(bIsWr)out.qbank[bsub].topics[btop].subtopics[bst].written++;
        else out.qbank[bsub].topics[btop].subtopics[bst].mcq++;
        if(bTsI!==-1&&bData[j][bTsI].toString().indexOf(today)!==-1)out.totalToday++;
      }
    }

    // Study
    var sSh=ss.getSheetByName("Study");
    if(sSh&&sSh.getLastRow()>1){
      var sData=sSh.getDataRange().getValues();
      var sHdr=sData[0].map(function(h){return h.toString().toLowerCase().trim();});
      var sSubI=sHdr.indexOf("subject");
      var sStI=sHdr.indexOf("sub_topic"); if(sStI===-1)sStI=sHdr.indexOf("subtopic");
      for(var k=1;k<sData.length;k++){
        var ssub=(sSubI!==-1?sData[k][sSubI]:"").toString().trim()||"Unknown";
        var sst=(sStI!==-1?sData[k][sStI]:"").toString().trim()||"General";
        if(!out.study[ssub])out.study[ssub]={total:0,subtopics:{}};
        out.study[ssub].total++;
        if(!out.study[ssub].subtopics[sst])out.study[ssub].subtopics[sst]=0;
        out.study[ssub].subtopics[sst]++;
      }
    }

    // Reports
    var rSh=ss.getSheetByName("Reports");
    if(rSh&&rSh.getLastRow()>1){
      var rData=rSh.getDataRange().getValues();
      var rHdr=rData[0].map(function(h){return h.toString().toLowerCase().trim();});
      var rPhI=rHdr.indexOf("phone"),rSubI=rHdr.indexOf("subject");
      var rStI=rHdr.indexOf("subtopic");if(rStI===-1)rStI=rHdr.indexOf("sub_topic");
      var rQidI=rHdr.indexOf("questionid");if(rQidI===-1)rQidI=rHdr.indexOf("question_id");
      var rQI=rHdr.indexOf("question"),rIsI=rHdr.indexOf("issue"),rTsI=rHdr.indexOf("timestamp");
      var start=Math.max(1,rData.length-30);
      for(var r=rData.length-1;r>=start;r--){
        out.reports.push({
          row:r+1,
          phone:rPhI!==-1?rData[r][rPhI].toString():"",
          subject:rSubI!==-1?rData[r][rSubI].toString():"",
          subtopic:rStI!==-1?rData[r][rStI].toString():"",
          questionId:rQidI!==-1?rData[r][rQidI].toString():"",
          question:rQI!==-1?rData[r][rQI].toString():"",
          issue:rIsI!==-1?rData[r][rIsI].toString():"",
          time:rTsI!==-1?rData[r][rTsI].toString():""
        });
      }
    }
    return ContentService.createTextOutput(JSON.stringify(out)).setMimeType(ContentService.MimeType.JSON);
  }

  // ── getUsers ──
  if (action==="getUsers") {
    var ss=SpreadsheetApp.getActiveSpreadsheet();
    var uSh=ss.getSheetByName("Users");
    if(!uSh) return json({error:"Users sheet not found"});
    var uData=uSh.getDataRange().getValues();
    var uHdr=uData[0].map(function(h){return h.toString().trim();});
    var users=[];
    for(var i=1;i<uData.length;i++){
      var rec={};
      for(var j=0;j<uHdr.length;j++){var v=uData[i][j];rec[uHdr[j]]=(v instanceof Date)?Utilities.formatDate(v,"GMT+6","dd-MM-yyyy"):v.toString();}
      users.push(rec);
    }
    // lite=1 হলে Firebase Analytics skip করো (fast load)
    var lite = (e.parameter.lite||"") === "1";
    if(!lite){
      try{
        var fbResp=UrlFetchApp.fetch(cfg.FIREBASE_URL+'Analytics/Summary.json?auth='+cfg.SECRET_KEY,{muteHttpExceptions:true});
        var summary=JSON.parse(fbResp.getContentText());
        if(summary&&typeof summary==='object'){
          users=users.map(function(u){
            var phone=(u.Phone||u.phone||'').toString().trim().replace(/^0+/,'').replace(/\s/g,'');
            var matched=null;
            Object.keys(summary).forEach(function(k){var kNorm=k.replace(/_/g,'').replace(/^0+/,'');if(kNorm===phone||k.replace(/^0+/,'')===phone)matched=summary[k];});
            if(matched){u._totalCorrect=matched.totalCorrect||0;u._totalWrong=matched.totalWrong||0;u._totalQuizzes=matched.totalQuizzes||0;u._totalQuestions=matched.totalQuestions||0;u._lastActive=matched.lastActive||'';}
            return u;
          });
          var timeResp=UrlFetchApp.fetch(cfg.FIREBASE_URL+'Analytics/Time.json?auth='+cfg.SECRET_KEY,{muteHttpExceptions:true});
          var timeData=JSON.parse(timeResp.getContentText());
          if(timeData&&typeof timeData==='object'){
            users=users.map(function(u){
              var phone=(u.Phone||u.phone||'').toString().trim().replace(/^0+/,'').replace(/\s/g,'');
              var totalMins=0;
              Object.keys(timeData).forEach(function(k){var kNorm=k.replace(/_/g,'').replace(/^0+/,'');if(kNorm===phone||k.replace(/^0+/,'')===phone){var dayData=timeData[k];if(typeof dayData==='object'){Object.values(dayData).forEach(function(m){totalMins+=(parseInt(m)||0);});}}});
              u._totalMinutes=totalMins;
              return u;
            });
          }
        }
      }catch(fe){}
    }
    return json({users:users});
  }

  // ── findQuestion ──
  if (action==="findQuestion") {
    var ss=SpreadsheetApp.getActiveSpreadsheet();
    var qTxt=(e.parameter.q||'').toString().toLowerCase().trim().substring(0,80);
    var results=[];
    ["Quiz","QBank"].forEach(function(tabName){
      var sh=ss.getSheetByName(tabName);if(!sh)return;
      var data=sh.getDataRange().getValues();
      var hdr=data[0].map(function(h){return h.toString().toLowerCase().trim();});
      var qIdx=hdr.indexOf("question"),subI=hdr.indexOf("subject");
      if(qIdx===-1)return;
      for(var i=1;i<data.length;i++){
        if(data[i][qIdx].toString().toLowerCase().trim().substring(0,80).indexOf(qTxt.substring(0,40))!==-1){
          results.push({id:data[i][0].toString(),tab:tabName,subject:subI!==-1?data[i][subI].toString():'',question:data[i][qIdx].toString().substring(0,120)});
          if(results.length>=5)break;
        }
      }
    });
    return json({results:results});
  }

  // ── findByTag ──
  if (action==="findByTag") {
    var ss=SpreadsheetApp.getActiveSpreadsheet();
    var qTxt=(e.parameter.q||'').toString().toLowerCase().trim();
    var results=[];
    ["Quiz","QBank"].forEach(function(tabName){
      var sh=ss.getSheetByName(tabName);if(!sh)return;
      var data=sh.getDataRange().getValues();
      var hdr=data[0].map(function(h){return h.toString().toLowerCase().trim();});
      var qIdx=hdr.indexOf("question"),cIdx=hdr.indexOf("correct");
      var stIdx=hdr.indexOf("sub_topic");if(stIdx===-1)stIdx=hdr.indexOf("subtopic");
      var subIdx=hdr.indexOf("subject"),techI=hdr.indexOf("technique");
      if(qIdx===-1)return;
      for(var i=1;i<data.length;i++){
        if(data[i][qIdx].toString().toLowerCase().includes(qTxt)||
           (cIdx!==-1&&data[i][cIdx].toString().toLowerCase().includes(qTxt))||
           (stIdx!==-1&&data[i][stIdx].toString().toLowerCase().includes(qTxt))||
           (subIdx!==-1&&data[i][subIdx].toString().toLowerCase().includes(qTxt))){
          results.push({id:data[i][0].toString(),tab:tabName,question:data[i][qIdx].toString().substring(0,120),correct:cIdx!==-1?data[i][cIdx].toString():'',technique:techI!==-1?data[i][techI].toString():'',subject:subIdx!==-1?data[i][subIdx].toString():''});
          if(results.length>=20)break;
        }
      }
    });
    return json({results:results});
  }

  // ── findByCorrect ──
  if (action==="findByCorrect") {
    var ss=SpreadsheetApp.getActiveSpreadsheet();
    var qTxt=(e.parameter.q||'').toString().toLowerCase().trim();
    var results=[];
    ["Quiz","QBank"].forEach(function(tabName){
      var sh=ss.getSheetByName(tabName);if(!sh)return;
      var data=sh.getDataRange().getValues();
      var hdr=data[0].map(function(h){return h.toString().toLowerCase().trim();});
      var qIdx=hdr.indexOf("question"),cIdx=hdr.indexOf("correct"),techI=hdr.indexOf("technique");
      if(qIdx===-1||cIdx===-1)return;
      for(var i=1;i<data.length;i++){
        var correctVal=data[i][cIdx].toString().toLowerCase().trim();
        if(correctVal.includes(qTxt)||qTxt.includes(correctVal)){
          results.push({id:data[i][0].toString(),tab:tabName,question:data[i][qIdx].toString().substring(0,120),correct:data[i][cIdx].toString(),technique:techI!==-1?data[i][techI].toString():''});
        }
      }
    });
    return json({results:results});
  }

  // ── getSubjects ──
  if (action==="getSubjects") {
    var ss=SpreadsheetApp.getActiveSpreadsheet();
    var allSubjects={};
    ["Quiz","Study","QBank","Notice"].forEach(function(tabName){
      var tabSheet=ss.getSheetByName(tabName);
      if(tabSheet){
        var tabData=tabSheet.getDataRange().getValues();
        if(tabData.length>1){
          var tabHdr=tabData[0].map(function(h){return h.toString().toLowerCase().trim();});
          var subIdx=tabHdr.indexOf("subject");
          if(subIdx!==-1){var subs=tabData.slice(1).map(function(r){return r[subIdx];});allSubjects[tabName]=subs.filter(function(v,i){return v&&subs.indexOf(v)===i;});}
          else allSubjects[tabName]=[];
        }else allSubjects[tabName]=[];
      }
    });
    return ContentService.createTextOutput(JSON.stringify(allSubjects)).setMimeType(ContentService.MimeType.JSON);
  }

  // ── getTechniques ──
  if (action==="getTechniques") {
    var ss=SpreadsheetApp.getActiveSpreadsheet();
    var tSh=ss.getSheetByName("Techniques");
    if(!tSh||tSh.getLastRow()<2)return json({techniques:[]});
    var tData=tSh.getDataRange().getValues();
    var tHdr=tData[0].map(function(h){return h.toString().toLowerCase().trim();});
    var idI=tHdr.indexOf("id"),techI=tHdr.indexOf("technique"),tagI=tHdr.indexOf("tags");
    if(techI===-1)return json({techniques:[]});
    var techs=[];
    for(var i=1;i<tData.length;i++){
      var techVal=tData[i][techI]?tData[i][techI].toString().trim():'';
      if(!techVal)continue;
      techs.push({id:idI!==-1?tData[i][idI].toString():'',technique:techVal,tags:tagI!==-1?tData[i][tagI].toString():''});
    }
    return json({techniques:techs});
  }

  // ── getAI ──
  if (action==="getAI") {
    var promptText=e.parameter.prompt;
    var apiKey=cfg.GEMINI_API_KEY;
    var models=["gemini-2.0-flash-001","gemini-flash-latest","gemini-1.5-flash"];
    var lastResp="";
    for(var m=0;m<models.length;m++){
      var aiUrl="https://generativelanguage.googleapis.com/v1beta/models/"+models[m]+":generateContent?key="+apiKey;
      try{
        var aiResp=UrlFetchApp.fetch(aiUrl,{method:"post",contentType:"application/json",muteHttpExceptions:true,payload:JSON.stringify({contents:[{parts:[{text:promptText}]}]})});
        lastResp=aiResp.getContentText();
        var aiJson=JSON.parse(lastResp);
        if(aiJson.candidates&&aiJson.candidates[0].content)return ContentService.createTextOutput(lastResp).setMimeType(ContentService.MimeType.JSON);
      }catch(aiErr){lastResp=JSON.stringify({error:aiErr.toString()});}
    }
    return ContentService.createTextOutput(lastResp).setMimeType(ContentService.MimeType.JSON);
  }

  // ── fallback: get by id+tab ──
  var id=e.parameter.id, tabName=e.parameter.tab;
  if(id&&tabName){
    var ss2=SpreadsheetApp.getActiveSpreadsheet();
    var getSheet=ss2.getSheetByName(tabName);
    if(!getSheet)return ContentService.createTextOutput(JSON.stringify({status:"error",message:"Sheet not found"})).setMimeType(ContentService.MimeType.JSON);
    var gData=getSheet.getDataRange().getValues();
    var gHdr=gData[0];
    for(var gi=1;gi<gData.length;gi++){
      if(gData[gi][0].toString()==id.toString()){
        var obj={};
        for(var gj=0;gj<gHdr.length;gj++)obj[gHdr[gj]]=gData[gi][gj];
        return ContentService.createTextOutput(JSON.stringify({status:"success",data:obj})).setMimeType(ContentService.MimeType.JSON);
      }
    }
    return ContentService.createTextOutput(JSON.stringify({status:"error",message:"ID not found"})).setMimeType(ContentService.MimeType.JSON);
  }
  return json({error:"Unknown action: "+action});
}

/*
══════════════════════════════════════════════════════════
doPost
══════════════════════════════════════════════════════════
*/
function doPost(e) {
  try {
    var ss=SpreadsheetApp.getActiveSpreadsheet();
    var cfg=getProps();
    var params=(e.postData&&e.postData.contents)?JSON.parse(e.postData.contents):e.parameter;
     // ── getAI via POST ──
    if (params.action === "getAI" || e.parameter.action === "getAI") {
      var promptText = params.prompt || e.parameter.prompt || "";
      var apiKey = cfg.GEMINI_API_KEY;
      var models = ["gemini-2.0-flash-001", "gemini-flash-latest", "gemini-1.5-flash"];
      var lastResp = "";
      for (var m = 0; m < models.length; m++) {
        var aiUrl = "https://generativelanguage.googleapis.com/v1beta/models/" + models[m] + ":generateContent?key=" + apiKey;
        try {
          var aiResp = UrlFetchApp.fetch(aiUrl, {method:"post", contentType:"application/json", muteHttpExceptions:true, payload:JSON.stringify({contents:[{parts:[{text:promptText}]}]})});
          lastResp = aiResp.getContentText();
          var aiJson = JSON.parse(lastResp);
          if (aiJson.candidates && aiJson.candidates[0].content) return ContentService.createTextOutput(lastResp).setMimeType(ContentService.MimeType.JSON);
        } catch(aiErr) { lastResp = JSON.stringify({error: aiErr.toString()}); }
      }
      return ContentService.createTextOutput(lastResp).setMimeType(ContentService.MimeType.JSON);
    }
    if(params.type==="save_fcm_token"){
      var phone=(params.phone||'').toString().trim(), token=(params.token||'').toString().trim();
      if(!phone||!token)return json({result:"error",error:"phone or token missing"});
      var safePhone=phone.replace(/[.#$\[\]\s]/g,'_');
      UrlFetchApp.fetch(cfg.FIREBASE_URL+"FCMTokens/"+safePhone+".json?auth="+cfg.SECRET_KEY,{method:"put",contentType:"application/json",payload:JSON.stringify({token:token,phone:phone,updatedAt:new Date().toLocaleString()}),muteHttpExceptions:true});
      return json({result:"success"});
    }

    if(params.type==="save_technique"){
      var tSh=ss.getSheetByName("Techniques");
      if(!tSh){tSh=ss.insertSheet("Techniques");tSh.appendRow(["id","Technique","Tags","timestamp"]);}
      var editId=(params.editId||'').toString().trim();
      if(editId){
        var tData=tSh.getDataRange().getValues();
        for(var ti=1;ti<tData.length;ti++){
          if(tData[ti][0].toString()===editId){tSh.getRange(ti+1,1,1,4).setValues([[editId,params.technique||'',params.tags||'',params.timestamp||new Date().toLocaleString()]]);return json({result:"success",id:editId});}
        }
      }
      var tId="T"+Date.now();
      tSh.appendRow([tId,params.technique||'',params.tags||'',params.timestamp||new Date().toLocaleString()]);
      return json({result:"success",id:tId});
    }

    if(params.type==="batch_apply_technique"){
      var questions=params.questions||[], technique=params.technique||'';
      if(!questions.length||!technique)return json({result:"error",error:"missing data"});
      var sheets={}, done=0;
      questions.forEach(function(q){
        var tabN=q.tab==='QBank'?'QBank':'Quiz';
        if(!sheets[tabN]){var sh=ss.getSheetByName(tabN);if(!sh)return;var data=sh.getDataRange().getValues();var hdr=data[0].map(function(h){return h.toString().toLowerCase().trim();});sheets[tabN]={sh:sh,data:data,idI:hdr.indexOf("id"),techI:hdr.indexOf("technique")};}
        var s=sheets[tabN];if(!s||s.techI===-1)return;
        for(var i=1;i<s.data.length;i++){
          if(s.data[i][s.idI!==-1?s.idI:0].toString()===q.id.toString()){
            var existing=s.data[i][s.techI].toString().trim();
            s.sh.getRange(i+1,s.techI+1).setValue(existing?existing+"\n\n"+technique:technique);
            s.data[i][s.techI]=existing?existing+"\n\n"+technique:technique;
            done++;break;
          }
        }
      });
      Object.keys(sheets).forEach(function(tabN){try{syncToFirebase(tabN,tabN);}catch(_){}});
      return json({result:"success",done:done});
    }

    if(params.type==="update_audience_tags"){
      var tabN=params.tab==='QBank'?'QBank':'Quiz';
      var apSh=ss.getSheetByName(tabN);
      if(!apSh)return json({result:"error",error:"Sheet not found"});
      var apData=apSh.getDataRange().getValues();
      var apHdr=apData[0].map(function(h){return h.toString().toLowerCase().trim();});
      var idIdx=apHdr.indexOf("id"),tagIdx=apHdr.indexOf("audiencetags");
      if(tagIdx===-1){tagIdx=apData[0].length;apSh.getRange(1,tagIdx+1).setValue("AudienceTags");}
      for(var ai=1;ai<apData.length;ai++){
        if(apData[ai][idIdx!==-1?idIdx:0].toString()===params.id.toString()){
          apSh.getRange(ai+1,tagIdx+1).setValue(params.audienceTags||'General');
          try{syncToFirebase(tabN,tabN);}catch(_){}
          return json({result:"success"});
        }
      }
      return json({result:"error",error:"ID not found"});
    }

    if(params.type==="apply_technique"){
      var tabN=params.tab==='QBank'?'QBank':'Quiz';
      var apSh=ss.getSheetByName(tabN);
      if(!apSh)return json({result:"error",error:"Sheet not found"});
      var apData=apSh.getDataRange().getValues();
      var apHdr=apData[0].map(function(h){return h.toString().toLowerCase().trim();});
      var idIdx=apHdr.indexOf("id"),techIdx=apHdr.indexOf("technique");
      if(techIdx===-1)return json({result:"error",error:"technique column not found"});
      for(var ai=1;ai<apData.length;ai++){
        if(apData[ai][idIdx!==-1?idIdx:0].toString()===params.id.toString()){
          var existing=apData[ai][techIdx].toString().trim();
          apSh.getRange(ai+1,techIdx+1).setValue(existing?existing+"\n\n"+params.technique:params.technique);
          try{syncToFirebase(tabN,tabN);}catch(_){}
          return json({result:"success"});
        }
      }
      return json({result:"error",error:"ID not found"});
    }

    if(params.type==="resolve_report"){
      var phone=params.phone||'', subject=params.subject||'প্রশ্নটি', qid=params.questionId||'';
      if(phone){
        var safePhone=phone.toString().trim().replace(/[.#$\[\]\s]/g,'_');
        var notifKey='notif_'+Date.now();
        var payload={type:'report_resolved',title:'✅ আপনার রিপোর্ট সমাধান হয়েছে!',body:'"'+subject+'" সংশোধন করা হয়েছে।',questionId:qid,time:new Date().toLocaleString(),read:false};
        UrlFetchApp.fetch(cfg.FIREBASE_URL+"Notifications/"+safePhone+"/"+notifKey+".json?auth="+cfg.SECRET_KEY,{method:"put",contentType:"application/json",payload:JSON.stringify(payload),muteHttpExceptions:true});
        var fcmResult=sendFCMToPhone(phone,"✅ রিপোর্ট সমাধান হয়েছে!",'"'+subject+'" সংশোধন করা হয়েছে।',{type:"report_resolved",questionId:qid});
        return json({result:"success",fcm:fcmResult});
      }
      return json({result:"error",error:"phone missing"});
    }

    if(params.type==="broadcast_notification"){
      return json({result:"success",fcm:sendFCMToAll(params.title||'Smart Study',params.body||'',{type:"broadcast"})});
    }

    if(params.type==="update_explanation"){
      var sName=params.sheet;
      var shMap2={qbank:"QBank",quiz:"Quiz",study:"Study",typing:"Typing"};
      sName=shMap2[sName.toLowerCase()]||sName;
      var uSheet=ss.getSheetByName(sName);
      if(!uSheet)return txt("Sheet not found");
      var uRows=uSheet.getDataRange().getValues();
      var uHdr=uRows[0].map(function(h){return h.toString().toLowerCase().trim();});
      var idC=uHdr.indexOf("id"), fld=params.field.toLowerCase().trim(), fldC=uHdr.indexOf(fld);
      if(fldC===-1){for(var fc=0;fc<uHdr.length;fc++){if(uHdr[fc].includes(fld)){fldC=fc;break;}}}
      if(idC===-1||fldC===-1)return txt("Column not found");
      for(var ur=1;ur<uRows.length;ur++){
        if(uRows[ur][idC].toString().trim()===params.id.toString().trim()){
          uSheet.getRange(ur+1,fldC+1).setValue(params.content);
          syncToFirebase(sName,sName);
          return txt("Successfully Updated");
        }
      }
      return txt("ID not found: "+params.id);
    }

    if(params.type==="update_xp"){
      var xpSh=ss.getSheetByName("Users");
      if(!xpSh)return txt("Users sheet not found");
      var xpRows=xpSh.getDataRange().getValues();
      var xpHdr=xpRows[0].map(function(h){return h.toString().toLowerCase().trim();});
      var xpPh=xpHdr.indexOf("phone"), xpCol=xpHdr.indexOf("xp");
      if(xpCol===-1){xpCol=xpRows[0].length;xpSh.getRange(1,xpCol+1).setValue("XP");}
      for(var xr=1;xr<xpRows.length;xr++){
        if(xpPh!==-1&&xpRows[xr][xpPh].toString().trim()===params.phone.toString().trim()){
          xpSh.getRange(xr+1,xpCol+1).setValue(params.xp);
          syncToFirebase("Users","Users");
          return txt("XP Updated");
        }
      }
      return txt("User not found");
    }

    if(params.type==="update_picture"){
      var pSh=ss.getSheetByName("Users");
      if(!pSh)return txt("Sheet not found");
      var pRows=pSh.getDataRange().getValues();
      var pHdr=pRows[0].map(function(h){return h.toString().toLowerCase().trim();});
      var pPhCol=pHdr.indexOf("phone"), pPicCol=pHdr.indexOf("picture");
      if(pPhCol===-1||pPicCol===-1)return txt("Column not found");
      var searchPhone=params.phone.toString().trim().replace(/^'+/,'');
      for(var pr=1;pr<pRows.length;pr++){
        var rowPhone=pRows[pr][pPhCol].toString().trim().replace(/^'+/,'');
        if(rowPhone.replace(/^0+/,'')===searchPhone.replace(/^0+/,'')){
          pSh.getRange(pr+1,pPicCol+1).setValue(params.picture_url);
          syncToFirebase("Users","Users");
          return txt("Picture Updated");
        }
      }
      return txt("User not found");
    }

    // ── নতুন User signup ──
    if(params.targetTab==="Users"){
      var usSh=ss.getSheetByName("Users");
      if(!usSh)return json({result:"error",error:"Users sheet not found"});
      var usData=usSh.getDataRange().getValues();
      var usHdr=usData[0].map(function(h){return h.toString().toLowerCase().trim();});
      var usPh=usHdr.indexOf("phone");
      if(usHdr.indexOf("usertype")===-1){usSh.getRange(1,usData[0].length+1).setValue("UserType");}
      if(usHdr.indexOf("classlevel")===-1){usSh.getRange(1,usSh.getLastColumn()+1).setValue("ClassLevel");}
      if(usPh!==-1){
        for(var ud=1;ud<usData.length;ud++){
          if(usData[ud][usPh].toString().trim()===(params.phone||'').toString().trim())return json({result:"duplicate",error:"Phone exists"});
        }
      }
      usSh.appendRow([
        params.name||'',
        params.phone||'',
        params.email||'',
        hashPassword(params.password||''),
        params.type||'Student',
        params.status||'Active',
        'User','',
        params.timestamp||new Date().toLocaleString(),
        params.picture||'',
        params.userType||'',
        params.classLevel||''
      ]);
      syncToFirebase("Users","Users");
      return json({result:"success"});
    }

    var tTab=params.targetTab||params.sheet;
    var bulkMode=params.bulkMode===true||params.bulkMode==="true";
    var dupCheck=params.dupCheck===true||params.dupCheck==="true";
    if(params.type==="report")tTab="Reports";

    if(params.type==="bulkSyncDone"){
      var syncTabs=(params.tabs||"").split(",").map(function(t){return t.trim();}).filter(Boolean);
      syncTabs.forEach(function(t){try{syncToFirebase(t,t);}catch(_){}});
      return json({result:"synced",tabs:syncTabs});
    }

    var mSh=ss.getSheetByName(tTab);
    if(!mSh)return txt("Sheet not found: "+tTab);

    if(dupCheck&&params.question){
      if(isDuplicate(mSh,params.subject||'',params.question,params.sub_topic||''))
        return json({result:"duplicate",message:"এই sub-topic-এ প্রশ্নটি আগে থেকেই আছে"});
    }

    var eId=params.editId, rIdx=-1, mData=mSh.getDataRange().getValues(), finalId=eId;
    if(eId){for(var ei=1;ei<mData.length;ei++){if(mData[ei][0].toString()===eId.toString()){rIdx=ei+1;break;}}}
    if(!eId&&["Quiz","Study","QBank","Typing"].indexOf(tTab)>-1)finalId=getNextId(tTab);

    var rData=[];
    if(tTab==="Quiz")      rData=[finalId,params.question,params.opt1,params.opt2,params.opt3,params.opt4,params.correct,params.subject,params.sub_topic,params.explanation,params.technique,params.prevExam||"",params.qType,params.timestamp,params.audienceTags||""];
    else if(tTab==="QBank")rData=[finalId,params.question,params.opt1,params.opt2,params.opt3,params.opt4,params.correct,params.subject,params.topic,params.sub_topic,params.explanation,params.technique,params.qType,params.mainQpaper||"",params.timestamp,params.audienceTags||""];
    else if(tTab==="Study")rData=[finalId,params.subject,params.sub_topic,params.question||"",params.correct||"",params.explanation,params.technique,params.timestamp,params.audienceTags||"",params.visualUrl||""];
    else if(tTab==="Typing")rData=[finalId,params.title||"",params.language||"",params.level||"",params.content||""];
    else if(tTab==="Notice")rData=[params.timestamp?params.timestamp.split(',')[0]:"",params.n_title,params.n_msg,params.timestamp];
    else if(tTab==="Reports"){
      // Column order: Phone | QSheet | Subject | SubTopic | QuestionID | Question | Issue | Timestamp
      var phone = (params.Phone||"").toString().replace(/^'+/,'').trim();
      // Sheets এ number format এড়াতে apostrophe prefix — leading 0 রক্ষা করে
      var phoneForSheet = phone ? ("'" + phone) : "";
      rData=[
        phoneForSheet,
        params.QSheet||"",
        params.Subject||"",
        params.SubTopic||params.Topic||"",
        params.QuestionID||"",
        params.Question||"",
        params.Issue||"",
        params.Timestamp||params.timestamp||new Date().toLocaleString('bn-BD')
      ];
    }

    if(rData.length===0)return json({result:"error",error:"Unknown tab"});
    if(rIdx!==-1)mSh.getRange(rIdx,1,1,rData.length).setValues([rData]);else mSh.appendRow(rData);
    if(!bulkMode)syncToFirebase(tTab,tTab);
    return json({result:"success",id:finalId});

  }catch(err){return json({result:"error",error:err.toString()});}
}

/*
══════════════════════════════════════════════════════════
Dashboard Stats Cache — Firebase _DashStats এ save করে
Admin app instantly পাবে, পুরো Quiz array আনতে হবে না
══════════════════════════════════════════════════════════
*/
function updateDashStats() {
  try {
    var cfg = getProps();
    var ss  = SpreadsheetApp.getActiveSpreadsheet();
    var out = { quiz:{}, qbank:{}, study:{}, quizTotal:0, qbankTotal:0, studyTotal:0, reportTotal:0, updatedAt:new Date().toISOString() };

    var qSh = ss.getSheetByName("Quiz");
    if(qSh && qSh.getLastRow()>1) {
      var qData = qSh.getDataRange().getValues();
      var qHdr  = qData[0].map(function(h){return h.toString().toLowerCase().trim();});
      var qSubI = qHdr.indexOf("subject");
      var qTypI = qHdr.indexOf("qtype"); if(qTypI===-1) qTypI=qHdr.indexOf("question type");
      var qStI  = qHdr.indexOf("sub_topic"); if(qStI===-1) qStI=qHdr.indexOf("subtopic");
      for(var i=1;i<qData.length;i++){
        var sub   = (qSubI!==-1?qData[i][qSubI]:"").toString().trim()||"Unknown";
        var qtyp  = (qTypI!==-1?qData[i][qTypI]:"MCQ").toString().trim()||"MCQ";
        var stRaw = (qStI !==-1?qData[i][qStI] :"").toString().trim()||"General";
        var isWr  = qtyp.toLowerCase()==="written";
        if(!out.quiz[sub]) out.quiz[sub]={total:0,mcq:0,written:0,topics:{}};
        out.quiz[sub].total++; out.quizTotal++;
        if(isWr) out.quiz[sub].written++; else out.quiz[sub].mcq++;
        var parts = stRaw.indexOf(" > ")!==-1?stRaw.split(" > "):[stRaw,stRaw];
        var topic = parts[0].trim()||"General";
        var st    = parts.length>1?parts[1].trim():stRaw;
        if(!out.quiz[sub].topics[topic]) out.quiz[sub].topics[topic]={total:0,subtopics:{}};
        out.quiz[sub].topics[topic].total++;
        if(!out.quiz[sub].topics[topic].subtopics[st]) out.quiz[sub].topics[topic].subtopics[st]={total:0,mcq:0,written:0};
        out.quiz[sub].topics[topic].subtopics[st].total++;
        if(isWr) out.quiz[sub].topics[topic].subtopics[st].written++; else out.quiz[sub].topics[topic].subtopics[st].mcq++;
      }
    }

    var bSh = ss.getSheetByName("QBank");
    if(bSh && bSh.getLastRow()>1) {
      var bData = bSh.getDataRange().getValues();
      var bHdr  = bData[0].map(function(h){return h.toString().toLowerCase().trim();});
      var bSubI = bHdr.indexOf("subject");
      var bTypI = bHdr.indexOf("qtype"); if(bTypI===-1) bTypI=bHdr.indexOf("question type");
      var bTopI = bHdr.indexOf("topic");
      var bStI  = bHdr.indexOf("sub_topic"); if(bStI===-1) bStI=bHdr.indexOf("subtopic");
      for(var j=1;j<bData.length;j++){
        var bsub = (bSubI!==-1?bData[j][bSubI]:"").toString().trim()||"Unknown";
        var btyp = (bTypI!==-1?bData[j][bTypI]:"MCQ").toString().trim()||"MCQ";
        var btop = (bTopI!==-1?bData[j][bTopI]:"").toString().trim()||"General";
        var bst  = (bStI !==-1?bData[j][bStI] :"").toString().trim()||"General";
        var bIsWr= btyp.toLowerCase()==="written";
        if(!out.qbank[bsub]) out.qbank[bsub]={total:0,mcq:0,written:0,topics:{}};
        out.qbank[bsub].total++; out.qbankTotal++;
        if(bIsWr) out.qbank[bsub].written++; else out.qbank[bsub].mcq++;
        if(!out.qbank[bsub].topics[btop]) out.qbank[bsub].topics[btop]={total:0,subtopics:{}};
        out.qbank[bsub].topics[btop].total++;
        if(!out.qbank[bsub].topics[btop].subtopics[bst]) out.qbank[bsub].topics[btop].subtopics[bst]={total:0,mcq:0,written:0};
        out.qbank[bsub].topics[btop].subtopics[bst].total++;
        if(bIsWr) out.qbank[bsub].topics[btop].subtopics[bst].written++; else out.qbank[bsub].topics[btop].subtopics[bst].mcq++;
      }
    }

    var sSh = ss.getSheetByName("Study");
    if(sSh && sSh.getLastRow()>1) out.studyTotal = sSh.getLastRow()-1;

    var rSh = ss.getSheetByName("Reports");
    if(rSh && rSh.getLastRow()>1) out.reportTotal = rSh.getLastRow()-1;

    // Firebase _DashStats এ PUT করো
    UrlFetchApp.fetch(cfg.FIREBASE_URL+"_DashStats.json?auth="+cfg.SECRET_KEY, {
      method:"put", contentType:"application/json", payload:JSON.stringify(out)
    });
    Logger.log("✅ DashStats updated: quiz="+out.quizTotal+" qbank="+out.qbankTotal);
  } catch(e) { Logger.log("DashStats error: "+e.toString()); }
}

/*
══════════════════════════════════════════════════════════
Triggers
══════════════════════════════════════════════════════════
*/
function onChange(e) {
  ["Quiz","Study","QBank","Notice","Users","Typing"].forEach(function(s){
    try{syncToFirebase(s,s);}catch(ex){}
  });
  // DashStats update — Quiz বা QBank change হলে
  try { updateDashStats(); } catch(ex) {}
}

function manualSyncAll() {
  ["Quiz","Study","QBank","Notice","Users","Typing"].forEach(function(s){
    try{syncToFirebase(s,s);Logger.log("OK: "+s);}
    catch(ex){Logger.log("ERR "+s+": "+ex.toString());}
  });
  // Dashboard stats cache update
  try { updateDashStats(); Logger.log("✅ DashStats updated"); }
  catch(ex){ Logger.log("DashStats ERR: "+ex.toString()); }
}

function txt(s){return ContentService.createTextOutput(s).setMimeType(ContentService.MimeType.TEXT);}
function json(o){return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);}