// =========================================================================
// ⚙️ NEXUS HRIS - REST API BACKEND (HEADLESS SHEETS)
// =========================================================================

var CONFIG = {
  SHEET_MASTER: "Master_List",
  SHEET_DB: "DB_Penilaian"
};

// =========================================================================
// 1. GET METHOD (Frontend minta daftar nama untuk di-render)
// Endpoint: URL_WEB_APP?action=getUsers
// =========================================================================
function doGet(e) {
  var action = e.parameter.action;
  var penilai = e.parameter.penilai; 
  
  if (action === "getUsers") {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(CONFIG.SHEET_MASTER);
    var data = sheet.getDataRange().getValues();
    
    var users = [];
    var infoPenilai = "";

    if (penilai) {
      for (var i = 1; i < data.length; i++) {
        if (data[i][1] === penilai) {
          infoPenilai = (data[i][2] + " " + data[i][3]).toUpperCase();
          break;
        }
      }
    }

    for (var i = 1; i < data.length; i++) {
      var nama = String(data[i][1] || "").trim();
      var posisi = String(data[i][2] || "").trim();
      var outlet = String(data[i][3] || "").trim();
      
      if (!nama || nama === "Nama Lengkap") continue;

      var roleUpper = posisi.toUpperCase();
      var outletUpper = outlet.toUpperCase();
      var fullIdentity = (posisi + " " + outlet).toUpperCase();

      // 🔥 THE ULTIMATE BLACKLIST (EGC, FRC, HCP, MBA)
      var blacklist = ["EGC", "FRC", "HCP", "MBA", "HEALTOPIA"];
      var isBlacklisted = blacklist.some(b => fullIdentity.includes(b));
      
      if (isBlacklisted) continue;

      var isManager = roleUpper.includes("MANAGER");
      var isSPV = roleUpper.includes("SPV");
      var isBTM = outletUpper.includes("BTM") || outletUpper.includes("BTMF");
      var isTSF = outletUpper.includes("TSF");

      if (!penilai) {
        if (isManager || isSPV) {
          users.push({ nama: nama, posisi: posisi + " " + outlet });
        }
      } else {
        if (infoPenilai.includes("MANAGER")) {
          if (!roleUpper.includes("MANAGER")) {
             users.push({ nama: nama, posisi: posisi + " " + outlet });
          }
        }
        else if (infoPenilai.includes("SPV") && (infoPenilai.includes("BTM") || infoPenilai.includes("BTMF"))) {
          if (isBTM && !isSPV) {
             users.push({ nama: nama, posisi: posisi + " " + outlet });
          }
        }
        else if (infoPenilai.includes("SPV") && infoPenilai.includes("TSF")) {
          if (isTSF && !isSPV) {
             users.push({ nama: nama, posisi: posisi + " " + outlet });
          }
        }
      }
    }
    
    return ContentService.createTextOutput(JSON.stringify({
      status: "success",
      data: users
    })).setMimeType(ContentService.MimeType.JSON);
  }
  
  // NEW: Get all evaluations for leaderboard and ranking
  if (action === "getEvaluations") {
    try {
      Logger.log("=== getEvaluations START ===");
      
      var ss = SpreadsheetApp.getActiveSpreadsheet();
      Logger.log("Spreadsheet: " + ss.getName());
      
      var sheet = ss.getSheetByName(CONFIG.SHEET_DB);
      
      // Check if sheet exists
      if (!sheet) {
        Logger.log("Sheet DB_Penilaian tidak ditemukan");
        return ContentService.createTextOutput(JSON.stringify({
          status: "error",
          message: "Sheet DB_Penilaian tidak ditemukan"
        })).setMimeType(ContentService.MimeType.JSON);
      }
      
      Logger.log("Sheet DB_Penilaian ditemukan");
      
      var data = sheet.getDataRange().getValues();
      Logger.log("Total rows in sheet: " + data.length);
      
      var evaluations = [];
      
      // Check if sheet has data
      if (!data || data.length <= 1) {
        Logger.log("Sheet kosong atau hanya ada header");
        return ContentService.createTextOutput(JSON.stringify({
          status: "success",
          data: []
        })).setMimeType(ContentService.MimeType.JSON);
      }
      
      // Get header row to determine structure
      var headers = data[0];
      Logger.log("Headers: " + JSON.stringify(headers));
      
      var hasPosition = headers.some(h => h && h.toString().toLowerCase().includes('posisi'));
      var hasOutlet = headers.some(h => h && h.toString().toLowerCase().includes('outlet'));
      var hasCategory = headers.some(h => h && h.toString().toLowerCase().includes('category'));
      
      Logger.log("hasPosition: " + hasPosition + ", hasOutlet: " + hasOutlet + ", hasCategory: " + hasCategory);
      
      // Map columns by name
      var colIndex = {};
      for (var h = 0; h < headers.length; h++) {
        var header = headers[h] ? headers[h].toString().toLowerCase() : "";
        colIndex[header] = h;
      }
      Logger.log("Column index mapping: " + JSON.stringify(colIndex));
      
      // Skip header row, start from index 1
      for (var i = 1; i < data.length; i++) {
        var row = data[i];
        
        // Skip empty rows
        if (!row[1]) {
          Logger.log("Row " + i + " skipped (empty penilai)");
          continue;
        }
        
        Logger.log("Processing row " + i + ": " + JSON.stringify(row));
        
        var evaluation = {
          timestamp: row[0] ? new Date(row[0]).toISOString() : null,
          penilai: row[1] || "",
          yangDinilai: row[2] || "",
          posisi: "",
          outlet: "",
          category: "",
          ss1: "", ss2: "", ss3: "", ss4: "",
          hs1: "", hs2: "", hs3: "", hs4: "",
          at1: "", at2: "", at3: "", at4: "", at5: "",
          sholat: "",
          puasa: ""
        };
        
        // Get position and outlet from row if available, otherwise from master data
        if (hasPosition && colIndex['posisi'] !== undefined) {
          evaluation.posisi = row[colIndex['posisi']] || "";
        }
        if (hasOutlet && colIndex['outlet'] !== undefined) {
          evaluation.outlet = row[colIndex['outlet']] || "";
        }
        if (hasCategory && colIndex['category'] !== undefined) {
          evaluation.category = row[colIndex['category']] || "";
        }
        
        // Get score columns
        var scoreColumns = ['ss1', 'ss2', 'ss3', 'ss4', 'hs1', 'hs2', 'hs3', 'hs4', 
                           'at1', 'at2', 'at3', 'at4', 'at5', 'sholat', 'puasa'];
        
        for (var s = 0; s < scoreColumns.length; s++) {
          var colName = scoreColumns[s];
          if (colIndex[colName] !== undefined) {
            evaluation[colName] = row[colIndex[colName]] || "";
          }
        }
        
        // If position/outlet not in row, get from master data
        if (!evaluation.posisi || !evaluation.outlet) {
          var masterSheet = ss.getSheetByName(CONFIG.SHEET_MASTER);
          if (masterSheet) {
            var masterData = masterSheet.getDataRange().getValues();
            for (var j = 1; j < masterData.length; j++) {
              if (masterData[j][1] === evaluation.yangDinilai) {
                if (!evaluation.posisi) evaluation.posisi = masterData[j][2] || "";
                if (!evaluation.outlet) evaluation.outlet = masterData[j][3] || "";
                break;
              }
            }
          }
        }
        
        // Add category if not set
        if (!evaluation.category) {
          evaluation.category = categorizeByPosition(evaluation.posisi);
        }
        
        Logger.log("Evaluation object: " + JSON.stringify(evaluation));
        evaluations.push(evaluation);
      }
      
      Logger.log("Total evaluations loaded: " + evaluations.length);
      Logger.log("=== getEvaluations SUCCESS ===");
      
      return ContentService.createTextOutput(JSON.stringify({
        status: "success",
        data: evaluations
      })).setMimeType(ContentService.MimeType.JSON);
      
    } catch (error) {
      Logger.log("=== getEvaluations ERROR ===");
      Logger.log("Error: " + error.toString());
      Logger.log("Error stack: " + error.stack);
      
      return ContentService.createTextOutput(JSON.stringify({
        status: "error",
        message: error.toString()
      })).setMimeType(ContentService.MimeType.JSON);
    }
  }
  
  return ContentService.createTextOutput("Invalid Action").setMimeType(ContentService.MimeType.TEXT);
}

// =========================================================================
// 2. POST METHOD (Frontend ngirim paket hasil nilai ke Database)
// =========================================================================
function doPost(e) {
  try {
    var payload = JSON.parse(e.postData.contents);
    
    // Handle different actions
    if (payload.action === "saveEvaluation") {
      return saveSingleEvaluation(payload.data);
    } else {
      // Legacy batch insert
      return saveBatchEvaluations(payload.data);
    }
    
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      status: "error",
      message: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

// NEW: Save single evaluation with all fields
function saveSingleEvaluation(evaluation) {
  try {
    Logger.log("=== saveSingleEvaluation START ===");
    Logger.log("Evaluation data: " + JSON.stringify(evaluation));
    
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    Logger.log("Spreadsheet: " + ss.getName());
    
    var sheetDb = ss.getSheetByName(CONFIG.SHEET_DB);
    
    if (!sheetDb) {
      Logger.log("Sheet DB_Penilaian tidak ditemukan, membuat baru...");
      // Create sheet if doesn't exist
      sheetDb = ss.insertSheet(CONFIG.SHEET_DB);
      // Add header
      sheetDb.appendRow([
        'Timestamp', 'Penilai', 'Yang Dinilai', 'Posisi', 'Outlet', 'Category',
        'SS1', 'SS2', 'SS3', 'SS4', 
        'HS1', 'HS2', 'HS3', 'HS4', 
        'AT1', 'AT2', 'AT3', 'AT4', 'AT5',
        'Sholat', 'Puasa'
      ]);
      Logger.log("Sheet DB_Penilaian berhasil dibuat");
    }
    
    Logger.log("Sheet DB_Penilaian ditemukan, last row: " + sheetDb.getLastRow());
    
    var row = [
      new Date(),
      evaluation.penilai,
      evaluation.yangDinilai,
      evaluation.posisi,
      evaluation.outlet,
      evaluation.category,
      evaluation.ss1, evaluation.ss2, evaluation.ss3, evaluation.ss4,
      evaluation.hs1, evaluation.hs2, evaluation.hs3, evaluation.hs4,
      evaluation.at1, evaluation.at2, evaluation.at3, evaluation.at4, evaluation.at5,
      evaluation.sholat,
      evaluation.puasa
    ];
    
    Logger.log("Row data: " + JSON.stringify(row));
    
    sheetDb.appendRow(row);
    
    Logger.log("Data berhasil di-append, new last row: " + sheetDb.getLastRow());
    Logger.log("=== saveSingleEvaluation SUCCESS ===");
    
    return ContentService.createTextOutput(JSON.stringify({
      status: "success",
      message: "Evaluasi berhasil disimpan!"
    })).setMimeType(ContentService.MimeType.JSON);
    
  } catch (error) {
    Logger.log("=== saveSingleEvaluation ERROR ===");
    Logger.log("Error: " + error.toString());
    Logger.log("Error stack: " + error.stack);
    
    return ContentService.createTextOutput(JSON.stringify({
      status: "error",
      message: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

// Legacy: Batch insert evaluations
function saveBatchEvaluations(records) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheetDb = ss.getSheetByName(CONFIG.SHEET_DB);
    
    if (!sheetDb) {
      sheetDb = ss.insertSheet(CONFIG.SHEET_DB);
      sheetDb.appendRow([
        'Timestamp', 'Penilai', 'Yang Dinilai', 
        'SS1', 'SS2', 'SS3', 'SS4', 
        'HS1', 'HS2', 'HS3', 'HS4', 
        'AT1', 'AT2', 'AT3', 'AT4', 'AT5',
        'Sholat', 'Puasa'
      ]);
    }
    
    var timestamp = new Date();
    var rowsToInsert = [];
    
    for (var i = 0; i < records.length; i++) {
      var row = [
        timestamp,
        records[i].penilai,
        records[i].yangDinilai,
        records[i].ss1, records[i].ss2, records[i].ss3, records[i].ss4,
        records[i].hs1, records[i].hs2, records[i].hs3, records[i].hs4,
        records[i].at1, records[i].at2, records[i].at3, records[i].at4, records[i].at5,
        records[i].sholat,
        records[i].puasa
      ];
      rowsToInsert.push(row);
    }
    
    if (rowsToInsert.length > 0) {
      sheetDb.getRange(sheetDb.getLastRow() + 1, 1, rowsToInsert.length, rowsToInsert[0].length).setValues(rowsToInsert);
    }
    
    return ContentService.createTextOutput(JSON.stringify({
      status: "success",
      message: rowsToInsert.length + " data berhasil masuk ke DB!"
    })).setMimeType(ContentService.MimeType.JSON);
    
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      status: "error",
      message: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

// Helper function to categorize by position
function categorizeByPosition(position) {
  if (!position) return "Karyawan";
  var pos = position.toUpperCase();
  if (pos.includes('MANAGER')) return 'Manager';
  if (pos.includes('SPV') || pos.includes('SUPERVISOR')) return 'SPV';
  if (pos.includes('FREELANCE') || pos.includes('FREELANCER')) return 'Freelance';
  if (pos.includes('OUTLET')) return 'Outlet';
  return 'Karyawan';
}
