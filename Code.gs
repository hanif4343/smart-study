var FIREBASE_URL = "https://smartentrydb-default-rtdb.firebaseio.com/";
var SECRET_KEY = "CsFdxaWLLU2AT92kxYFPTOhP1ewDR0jzK3hKjqWO";

// --- ১. ডাটা রিট্রিভ এবং AI সিস্টেম (doGet) ---
function doGet(e) {
  var action = e.parameter.action;
  
  if (action === "getSubjects") {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var tabs = ["Quiz", "Study", "QBank", "Notice"];
    var allSubjects = {};
    tabs.forEach(function(tabName) {
      var sheet = ss.getSheetByName(tabName);
      if (sheet) {
        var data = sheet.getDataRange().getValues();
        if (data.length > 1) {
          var headers = data[0];
          var subIndex = headers.map(function(h){return h.toString().toLowerCase().trim();}).indexOf("subject");
          if (subIndex !== -1) {
            var subjects = data.slice(1).map(function(row) { return row[subIndex]; });
            allSubjects[tabName] = subjects.filter(function(item, pos) {
              return item && subjects.indexOf(item) == pos;
            });
          } else { allSubjects[tabName] = []; }
        } else { allSubjects[tabName] = []; }
      }
    });
    return ContentService.createTextOutput(JSON.stringify(allSubjects)).setMimeType(ContentService.MimeType.JSON);
  }
  
  if (action === "getAI") {
    var promptText = e.parameter.prompt;
    var apiKey = "AIzaSyAMjqlNtqjLnrKzl61XEoi3_cJFYAAjwgc"; 
    var models = ["gemini-2.0-flash-001", "gemini-flash-latest", "gemini-1.5-flash"];
    
    var lastResponse = "";
    for (var i = 0; i < models.length; i++) {
      var url = "https://generativelanguage.googleapis.com/v1beta/models/" + models[i] + ":generateContent?key=" + apiKey;
      var options = {
        "method": "post",
        "contentType": "application/json",
        "payload": JSON.stringify({"contents": [{"parts": [{"text": promptText}]}]}),
        "muteHttpExceptions": true
      };
      try {
        var response = UrlFetchApp.fetch(url, options);
        lastResponse = response.getContentText();
        var json = JSON.parse(lastResponse);
        if (json.candidates && json.candidates[0].content) {
          return ContentService.createTextOutput(lastResponse).setMimeType(ContentService.MimeType.JSON);
        }
      } catch (err) { lastResponse = JSON.stringify({"error": err.toString()}); }
    }
    return ContentService.createTextOutput(lastResponse).setMimeType(ContentService.MimeType.JSON);
  }

  // ডিফল্ট আইডি অনুযায়ী ডাটা খোঁজা
  var id = e.parameter.id;
  var targetTab = e.parameter.tab;
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(targetTab);
  if (!sheet) return ContentService.createTextOutput(JSON.stringify({"status": "error", "message": "Sheet not found"})).setMimeType(ContentService.MimeType.JSON);
  
  var data = sheet.getDataRange().getValues();
  var headers = data[0];
  for (var i = 1; i < data.length; i++) {
    if (data[i][0].toString() == id.toString()) {
      var obj = {};
      for (var j = 0; j < headers.length; j++) { obj[headers[j]] = data[i][j]; }
      return ContentService.createTextOutput(JSON.stringify({"status": "success", "data": obj})).setMimeType(ContentService.MimeType.JSON);
    }
  }
  return ContentService.createTextOutput(JSON.stringify({"status": "error", "message": "ID not found"})).setMimeType(ContentService.MimeType.JSON);
}

// --- ২. ডাটা এন্ট্রি, রিপোর্ট এবং ব্যাখ্যা আপডেট (doPost) ---
function doPost(e) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var params;
    
    if (e.postData.contents) {
      params = JSON.parse(e.postData.contents);
    } else {
      params = e.parameter;
    }

    // লজিক ১: আইডি অনুযায়ী নির্দিষ্ট ফিল্ড (ব্যাখ্যা/টেকনিক) আপডেট
    if (params.type === "update_explanation") {
      var targetSheetName = params.sheet;
      if(targetSheetName.toLowerCase() === 'qbank') targetSheetName = 'QBank';
      if(targetSheetName.toLowerCase() === 'quiz') targetSheetName = 'Quiz';
      if(targetSheetName.toLowerCase() === 'study') targetSheetName = 'Study';
      
      var sheet = ss.getSheetByName(targetSheetName);
      if (!sheet) return ContentService.createTextOutput("Sheet not found: " + targetSheetName).setMimeType(ContentService.MimeType.TEXT);

      var rows = sheet.getDataRange().getValues();
      var headers = rows[0].map(function(h) { return h.toString().toLowerCase().trim(); });
      
      var idCol = headers.indexOf("id");
      var targetField = params.field.toLowerCase().trim();
      var targetCol = headers.indexOf(targetField);

      if (targetCol === -1) {
         for(var c=0; c<headers.length; c++) {
           if(headers[c].includes(targetField)) { targetCol = c; break; }
         }
      }

      if (idCol === -1 || targetCol === -1) return ContentService.createTextOutput("Columns not found (ID or Field)").setMimeType(ContentService.MimeType.TEXT);

      var found = false;
      for (var i = 1; i < rows.length; i++) {
        if (rows[i][idCol].toString().trim() === params.id.toString().trim()) {
          sheet.getRange(i + 1, targetCol + 1).setValue(params.content);
          found = true;
          break;
        }
      }

      if (found) {
        syncToFirebase(targetSheetName, targetSheetName); 
        return ContentService.createTextOutput("Successfully Updated").setMimeType(ContentService.MimeType.TEXT);
      } else {
        return ContentService.createTextOutput("ID match not found: " + params.id).setMimeType(ContentService.MimeType.TEXT);
      }
    }

    // লজিক ২: Users শিটে নতুন ব্যবহারকারী যোগ
    if (params.targetTab === "Users") {
      var sheet = ss.getSheetByName("Users");
      if (!sheet) return ContentService.createTextOutput(JSON.stringify({"result":"error","error":"Users sheet not found"})).setMimeType(ContentService.MimeType.JSON);
      
      // Check if phone already exists
      var data = sheet.getDataRange().getValues();
      var headers = data[0].map(function(h){ return h.toString().toLowerCase().trim(); });
      var phoneCol = headers.indexOf("phone");
      if(phoneCol !== -1) {
        for(var i=1; i<data.length; i++) {
          if(data[i][phoneCol].toString().trim() === (params.phone||'').toString().trim()) {
            return ContentService.createTextOutput(JSON.stringify({"result":"duplicate","error":"Phone already exists"})).setMimeType(ContentService.MimeType.JSON);
          }
        }
      }
      
      // Columns: Name  Phone  Email  Password  Type  Status  Role  ExpiryDate  Timestamp  Picture
      var rowData = [
        params.name || '',
        params.phone || '',
        params.email || '',
        params.password || '',
        params.type || 'Student',
        params.status || 'Inactive',
        params.role || 'User',
        params.expiryDate || '',
        params.timestamp || new Date().toLocaleString(),
        params.picture || ''
      ];
      
      sheet.appendRow(rowData);
      syncToFirebase("Users", "Users");
      return ContentService.createTextOutput(JSON.stringify({"result":"success"})).setMimeType(ContentService.MimeType.JSON);
    }

    // লজিক ৩: XP Update for a user
    if (params.type === "update_xp") {
      var sheet = ss.getSheetByName("Users");
      if (!sheet) return ContentService.createTextOutput("Sheet not found").setMimeType(ContentService.MimeType.TEXT);
      var rows = sheet.getDataRange().getValues();
      var headers = rows[0].map(function(h){ return h.toString().toLowerCase().trim(); });
      var phoneCol = headers.indexOf("phone");
      var xpCol = headers.indexOf("xp");
      if(xpCol === -1) {
        // Add XP column at end if not exists
        xpCol = rows[0].length;
        sheet.getRange(1, xpCol+1).setValue("XP");
      }
      for(var i=1; i<rows.length; i++) {
        if(phoneCol !== -1 && rows[i][phoneCol].toString().trim() === params.phone.toString().trim()) {
          sheet.getRange(i+1, xpCol+1).setValue(params.xp);
          syncToFirebase("Users", "Users");
          return ContentService.createTextOutput("XP Updated").setMimeType(ContentService.MimeType.TEXT);
        }
      }
      return ContentService.createTextOutput("User not found").setMimeType(ContentService.MimeType.TEXT);
    }

    // লজিক ৪: সাধারণ ডাটা এন্ট্রি এবং রিপোর্ট জমা
    var targetTab = params.targetTab || params.sheet;
    if (params.type === "report") targetTab = "Reports"; 
    
    var sheet = ss.getSheetByName(targetTab);
    if (!sheet) return ContentService.createTextOutput("Sheet Not Found: " + targetTab);

    var data = sheet.getDataRange().getValues();
    var rowData = [];
    var editId = params.editId;
    var rowIndex = -1;

    if (editId) {
      for (var i = 1; i < data.length; i++) {
        if (data[i][0].toString() == editId.toString()) { rowIndex = i + 1; break; }
      }
    }

    var finalId = editId;
    if (!editId && ["Quiz", "Study", "QBank"].indexOf(targetTab) > -1) {
      var lock = LockService.getScriptLock();
      lock.waitLock(10000);
      var lastRow = sheet.getLastRow();
      var lastId = 1000;
      if (lastRow > 1) {
        var tempId = parseInt(sheet.getRange(lastRow, 1).getValue());
        if (!isNaN(tempId)) lastId = tempId;
      }
      finalId = lastId + 1;
      lock.releaseLock();
    }

    if (targetTab === "Quiz") {
      rowData = [finalId, params.question, params.opt1, params.opt2, params.opt3, params.opt4, params.correct, params.subject, params.sub_topic, params.explanation, params.technique, params.prevExam || "", params.qType, params.timestamp];
    } 
    else if (targetTab === "QBank") {
      rowData = [finalId, params.question, params.opt1, params.opt2, params.opt3, params.opt4, params.correct, params.subject, params.topic, params.sub_topic, params.explanation, params.technique, params.qType, params.mainQpaper || "", params.timestamp];
    } 
    else if (targetTab === "Study") {
      rowData = [finalId, params.subject, params.sub_topic, params.explanation, params.technique, params.timestamp];
    } 
    else if (targetTab === "Notice") {
      rowData = [params.timestamp ? params.timestamp.split(',')[0] : "", params.n_title, params.n_msg, params.timestamp];
    }
    else if (targetTab === "Reports") {
      rowData = [params.Phone || "", params.Subject || "", params.SubTopic || "", params.Question || "", params.Issue || "", params.timestamp || new Date().toLocaleString()];
    }

    if (rowData.length > 0) {
      if (rowIndex !== -1) { 
        sheet.getRange(rowIndex, 1, 1, rowData.length).setValues([rowData]); 
      } else { 
        sheet.appendRow(rowData); 
      }
      syncToFirebase(targetTab, targetTab); 
      return ContentService.createTextOutput(JSON.stringify({"result":"success", "id": finalId})).setMimeType(ContentService.MimeType.JSON);
    }
    
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({"result":"error", "error": err.toString()})).setMimeType(ContentService.MimeType.JSON);
  }
}

// --- ৩. ফায়ারবেস সিঙ্কিং ---
function syncToFirebase(sheetName, folderName) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(sheetName);
    if (!sheet) return;
    var data = sheet.getDataRange().getValues();
    if (data.length < 2) return; 
    var headers = data[0];
    var jsonData = [];
    for (var i = 1; i < data.length; i++) {
      var obj = {};
      for (var j = 0; j < headers.length; j++) {
        var key = headers[j].toString().trim();
        if (key) {
          var value = data[i][j];
          obj[key] = (value instanceof Date) ? Utilities.formatDate(value, "GMT+6", "dd-MM-yyyy HH:mm:ss") : value;
        }
      }
      jsonData.push(obj);
    }
    var url = FIREBASE_URL + folderName + ".json?auth=" + SECRET_KEY;
    var options = { "method": "put", "contentType": "application/json", "payload": JSON.stringify(jsonData) };
    UrlFetchApp.fetch(url, options);
  } catch (e) { console.log("Firebase Error: " + e.toString()); }
}

// শিটে সরাসরি কোনো পরিবর্তন হলে আপডেট করার জন্য
function onChange(e) {
  var sheets = ["Quiz", "Study", "QBank", "Notice", "Users"];
  sheets.forEach(function(s) { syncToFirebase(s, s); });
}

// Manual sync trigger function (run once to sync all data including Users)
function manualSyncAll() {
  var sheets = ["Quiz", "Study", "QBank", "Notice", "Users"];
  sheets.forEach(function(s) { 
    try { syncToFirebase(s, s); Logger.log("Synced: " + s); }
    catch(e) { Logger.log("Error syncing " + s + ": " + e.toString()); }
  });
}
