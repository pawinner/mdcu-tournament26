/**
 * ============================================================================
 * MDCU Medical Tournament 2026 - Scoreboard Google Apps Script API
 * ============================================================================
 * 
 * INSTRUCTIONS TO DEPLOY:
 * 1. Open your Google Spreadsheet containing the tournament leaderboard/scores.
 * 2. Click Extensions > Apps Script in the menu bar.
 * 3. Delete any code in Code.gs and paste this entire file into Code.gs.
 * 4. Click "Deploy" button (top right) > "New deployment".
 * 5. Select type (gear icon): "Web app".
 * 6. Set Description: "MDCU Tournament Scoreboard API".
 * 7. Set Execute as: "Me" (your Google account).
 * 8. Set Who has access: "Anyone" (crucial for CORS & access without login).
 * 9. Click "Deploy", authorize permissions if prompted, and copy the Web App URL.
 * 10. Paste the Web App URL into app.js under CONFIG.appsScriptUrl (or prelimAppsScriptUrl / finalAppsScriptUrl).
 * 
 * OPTIONAL QUERY PARAMETERS:
 * - ?sheet=Prelim   => Reads from sheet tab named "Prelim" (or "Preliminary")
 * - ?sheet=Final    => Reads from sheet tab named "Final"
 * If no ?sheet param is provided, it automatically reads the first sheet tab.
 */

function doGet(e) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheetName = e && e.parameter && e.parameter.sheet ? e.parameter.sheet : null;
    var sheet = null;

    if (sheetName) {
      sheet = ss.getSheetByName(sheetName);
    }
    
    // Fallback: try common aliases or default to the first sheet tab
    if (!sheet && sheetName) {
      var lowerTarget = sheetName.toLowerCase();
      var sheets = ss.getSheets();
      for (var i = 0; i < sheets.length; i++) {
        var name = sheets[i].getName().toLowerCase();
        if (name.indexOf(lowerTarget) !== -1 || lowerTarget.indexOf(name) !== -1) {
          sheet = sheets[i];
          break;
        }
      }
    }

    if (!sheet) {
      sheet = ss.getSheets()[0];
    }

    var data = sheet.getDataRange().getValues();
    if (!data || data.length < 2) {
      return responseJSON({ standings: [], count: 0, sheet: sheet ? sheet.getName() : "Unknown" });
    }

    // Header index detection
    var headers = data[0].map(function(h) { 
      return String(h !== null && h !== undefined ? h : '').trim().toLowerCase(); 
    });

    var nameIdx = headers.findIndex(function(h) {
      return h === 'team' || h === 'name' || h === 'team name' || h === 'ชื่อทีม' || h === 'ทีม' || h === 'teamname';
    });

    var scoreIdx = headers.findIndex(function(h) {
      return h === 'score' || h === 'scores' || h === 'points' || h === 'pts' || h === 'คะแนน' || h === 'แต้ม';
    });

    // Fallbacks if header names are not explicitly recognized
    if (nameIdx === -1) nameIdx = 0;
    if (scoreIdx === -1) scoreIdx = (data[0].length > 1) ? 1 : 0;

    var standings = [];

    for (var r = 1; r < data.length; r++) {
      var row = data[r];
      if (!row || row.length === 0) continue;

      var rawName = row[nameIdx];
      var rawScore = row[scoreIdx];

      // Convert name to String, ensuring numeric team names like "67 78" or "101" are preserved as strings
      var nameStr = String(rawName !== null && rawName !== undefined ? rawName : '').trim();
      var scoreNum = parseFloat(rawScore);

      if (nameStr !== '' && !isNaN(scoreNum)) {
        standings.push({
          name: nameStr,
          score: scoreNum
        });
      }
    }

    return responseJSON({
      standings: standings,
      count: standings.length,
      sheet: sheet.getName(),
      updatedAt: new Date().toISOString()
    });

  } catch (error) {
    return responseJSON({
      error: error.toString(),
      standings: []
    });
  }
}

function responseJSON(payload) {
  return ContentService.createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}
