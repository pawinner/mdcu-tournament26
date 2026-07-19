/* -------------------------------------------------------------
 * MDCU Medical Tournament 2026 - Controller Logic
 * ------------------------------------------------------------- */

// Configuration
const CONFIG = {
  countdownDuration: 15, // seconds
  appsScriptUrl: 'https://script.google.com/macros/s/AKfycbwCnmz4RZnz9sl8t0vgVbj7N2pCYW0aj1YU36yPBmUbU1jeMKIwqcGjxlY__-qQ5A0/exec', // Deployed Apps Script Web App API endpoint
  prelimAppsScriptUrl: '', // Optional: Prelim Apps Script Web App URL override
  finalAppsScriptUrl: '', // Optional: Final Apps Script Web App URL override
  prelimSheetCsvUrl: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vShiFlPfYdFdhnR7pMbce-btJ9ZSfXFatonn62ZDvGofF9ldfcuqhLdXgnLWqxmmRT2hGV7fD0RHTyz/pub?gid=0&single=true&output=csv',
  finalSheetCsvUrl: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vShiFlPfYdFdhnR7pMbce-btJ9ZSfXFatonn62ZDvGofF9ldfcuqhLdXgnLWqxmmRT2hGV7fD0RHTyz/pub?gid=1034909864&single=true&output=csv',
  maxTeamsPrelim: 6,
  maxTeamsFinal: 4,
  googleSheetCsvUrl: '' 
};

// State Variables
let activeView = 'home'; // 'home' | 'countdown' | 'scoreboard' | 'jeopardy' | 'question'
let lastNonScoreboardView = 'home';
let timerDuration = CONFIG.countdownDuration;
let timeLeft = CONFIG.countdownDuration;
let isTimerRunning = false;
let startTime = null;
let pauseTimeElapsed = 0;
let animationFrameId = null;
let audioCtx = null;

// Mock Standings Data (Thai medical school teams for realism)
const MOCK_STANDINGS = [
  { name: "ฝ่ายวิชาการ คณะแพทยศาสตร์ จุฬาฯ (Chula Med A)", score: 95 },
  { name: "สโมสรนิสิตแพทย์ จุฬาลงกรณ์ (Chula Med B)", score: 92 },
  { name: "คณะแพทยศาสตร์ ศิริราชพยาบาล (Siriraj Med)", score: 87 },
  { name: "คณะแพทยศาสตร์ โรงพยาบาลรามาธิบดี (Rama Med)", score: 84 },
  { name: "คณะแพทยศาสตร์ มหาวิทยาลัยเชียงใหม่ (CMU)", score: 79 },
  { name: "คณะแพทยศาสตร์ มหาวิทยาลัยขอนแก่น (KKU)", score: 70 },
  { name: "วิทยาลัยแพทยศาสตร์พระมงกุฎเกล้า (PCM)", score: 68 }
];

// Circular Progress Ring Calculations
const PROGRESS_CIRCUMFERENCE = 2 * Math.PI * 180; // Radius = 180 (1130.97px)
const progressRingBar = document.querySelector('.progress-ring-bar');

if (progressRingBar) {
  progressRingBar.style.strokeDasharray = `${PROGRESS_CIRCUMFERENCE} ${PROGRESS_CIRCUMFERENCE}`;
  progressRingBar.style.strokeDashoffset = PROGRESS_CIRCUMFERENCE;
}

/* -------------------------------------------------------------
 * Web Audio API Sound Synthesizers (100% Offline Compatible)
 * ------------------------------------------------------------- */

function initAudio() {
  if (audioCtx) return;
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  const indicator = document.getElementById('audio-indicator');
  if (indicator) {
    indicator.classList.remove('audio-indicator-muted');
    indicator.classList.add('audio-indicator-active');
  }
}

// Tick Sound (plays every elapsed second)
function playTick(isWarning = false) {
  initAudio();
  if (!audioCtx || audioCtx.state === 'suspended') return;
  
  const now = audioCtx.currentTime;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  
  osc.type = 'triangle';
  // Warning ticks (last 5 seconds) are higher frequency
  osc.frequency.setValueAtTime(isWarning ? 1200 : 700, now);
  osc.frequency.exponentialRampToValueAtTime(80, now + 0.06);
  
  gain.gain.setValueAtTime(isWarning ? 0.25 : 0.15, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
  
  osc.start(now);
  osc.stop(now + 0.08);
}

// End-of-timer Buzzer
function playBuzzer() {
  initAudio();
  if (!audioCtx || audioCtx.state === 'suspended') return;
  
  const now = audioCtx.currentTime;
  
  // Use two slightly detuned oscillators for a retro digital buzzer thickness
  const osc1 = audioCtx.createOscillator();
  const osc2 = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  const filter = audioCtx.createBiquadFilter();
  
  osc1.type = 'sawtooth';
  osc2.type = 'sawtooth';
  osc1.frequency.setValueAtTime(105, now);
  osc2.frequency.setValueAtTime(108, now); // Detuned by 3 Hz
  
  filter.type = 'bandpass';
  filter.frequency.setValueAtTime(350, now);
  filter.frequency.exponentialRampToValueAtTime(120, now + 1.2);
  
  gain.gain.setValueAtTime(0.3, now);
  gain.gain.linearRampToValueAtTime(0.3, now + 0.8);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 1.3);
  
  osc1.connect(filter);
  osc2.connect(filter);
  filter.connect(gain);
  gain.connect(audioCtx.destination);
  
  osc1.start(now);
  osc2.start(now);
  
  osc1.stop(now + 1.3);
  osc2.stop(now + 1.3);
}

// Navigation transition chime
function playChime() {
  initAudio();
  if (!audioCtx || audioCtx.state === 'suspended') return;
  
  const now = audioCtx.currentTime;
  // Upward arpeggio: C4 -> E4 -> G4 -> C5
  const notes = [261.63, 329.63, 392.00, 523.25];
  
  notes.forEach((freq, idx) => {
    const noteTime = now + idx * 0.07;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, noteTime);
    
    gain.gain.setValueAtTime(0.12, noteTime);
    gain.gain.exponentialRampToValueAtTime(0.001, noteTime + 0.5);
    
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    
    osc.start(noteTime);
    osc.stop(noteTime + 0.55);
  });
}

/* -------------------------------------------------------------
 * Views Swapping Controller
 * ------------------------------------------------------------- */

function switchView(viewName) {
  if (viewName === activeView) return;
  
  if (activeView !== 'scoreboard') {
    lastNonScoreboardView = activeView;
  }
  
  // Clean up timers if navigating away
  if (activeView === 'countdown') {
    pauseTimer();
  }
  if (activeView === 'question') {
    pauseModalTimer();
  }
  
  // Remove active from current view if present
  const currentViewEl = document.getElementById(`view-${activeView}`);
  if (currentViewEl) currentViewEl.classList.remove('active');
  
  // Set new active view
  activeView = viewName;
  const newViewEl = document.getElementById(`view-${activeView}`);
  if (newViewEl) newViewEl.classList.add('active');
  
  // Update top-left navigation button text dynamically based on active view
  const navBackText = document.getElementById('nav-back-text');
  if (navBackText) {
    if (activeView === 'question' || activeView === 'scoreboard') {
      navBackText.textContent = 'Jeopardy Board';
    } else if (activeView === 'jeopardy') {
      navBackText.textContent = 'Landing Page';
    } else {
      navBackText.textContent = 'Home Portal';
    }
  }
  
  // Extra view load hooks
  if (activeView === 'scoreboard') {
    playChime();
    loadScoreboard();
  }
}

/* -------------------------------------------------------------
 * Countdown Timer Mechanism
 * ------------------------------------------------------------- */

function setProgress(percent) {
  if (!progressRingBar) return;
  const offset = PROGRESS_CIRCUMFERENCE * (1 - percent);
  progressRingBar.style.strokeDashoffset = offset;
}

function updateTimerUI() {
  const displayVal = Math.ceil(timeLeft);
  const digitsEl = document.getElementById('timer-digits');
  if (digitsEl) {
    digitsEl.textContent = displayVal < 10 ? `0${displayVal}` : displayVal;
  }
  
  // Percent calculated for the circle ring
  const percent = timeLeft / timerDuration;
  setProgress(percent);
}

function startTimer() {
  initAudio();
  if (isTimerRunning) return;
  
  isTimerRunning = true;
  const viewEl = document.getElementById('view-countdown');
  if (viewEl) {
    viewEl.classList.remove('timer-paused', 'timer-finished');
    viewEl.classList.add('timer-running');
  }
  const statusEl = document.getElementById('timer-status');
  if (statusEl) statusEl.textContent = 'RUNNING';
  
  // calculate base time based on remaining duration
  startTime = performance.now() - (pauseTimeElapsed * 1000);
  
  function tick() {
    if (!isTimerRunning) return;
    
    const now = performance.now();
    const elapsed = (now - startTime) / 1000;
    const currentLeft = Math.max(0, timerDuration - elapsed);
    
    // Check if we crossed a whole second threshold (for playing tick sound)
    const currentInt = Math.ceil(currentLeft);
    const lastInt = Math.ceil(timeLeft);
    
    timeLeft = currentLeft;
    updateTimerUI();
    
    if (currentInt < lastInt && currentInt > 0) {
      playTick(currentInt <= 5);
    }
    
    // Visual warnings
    if (currentLeft <= 5 && currentLeft > 0 && viewEl) {
      viewEl.classList.add('timer-warning');
    }
    
    if (currentLeft <= 0) {
      finishTimer();
    } else {
      animationFrameId = requestAnimationFrame(tick);
    }
  }
  
  animationFrameId = requestAnimationFrame(tick);
}

function pauseTimer() {
  if (!isTimerRunning) return;
  
  isTimerRunning = false;
  cancelAnimationFrame(animationFrameId);
  
  // Record elapsed fraction so we can resume properly
  pauseTimeElapsed = timerDuration - timeLeft;
  
  const viewEl = document.getElementById('view-countdown');
  if (viewEl) {
    viewEl.classList.remove('timer-running');
    viewEl.classList.add('timer-paused');
  }
  const statusEl = document.getElementById('timer-status');
  if (statusEl) statusEl.textContent = 'PAUSED';
}

function resetTimer() {
  isTimerRunning = false;
  cancelAnimationFrame(animationFrameId);
  
  timeLeft = timerDuration;
  pauseTimeElapsed = 0;
  
  const viewEl = document.getElementById('view-countdown');
  if (viewEl) {
    viewEl.classList.remove('timer-running', 'timer-paused', 'timer-finished', 'timer-warning');
  }
  const statusEl = document.getElementById('timer-status');
  if (statusEl) statusEl.textContent = 'READY';
  
  updateTimerUI();
}

function finishTimer() {
  isTimerRunning = false;
  timeLeft = 0;
  cancelAnimationFrame(animationFrameId);
  
  const viewEl = document.getElementById('view-countdown');
  if (viewEl) {
    viewEl.classList.remove('timer-running', 'timer-warning');
    viewEl.classList.add('timer-finished');
  }
  
  const digitsEl = document.getElementById('timer-digits');
  if (digitsEl) digitsEl.textContent = '00';
  
  const statusEl = document.getElementById('timer-status');
  if (statusEl) statusEl.textContent = 'TIME UP';
  setProgress(0);
  playBuzzer();
}

// Trigger timer workflow (pressing '1' key)
function triggerTimerFlow() {
  const countdownEl = document.getElementById('view-countdown');
  if (!countdownEl) {
    // On Final page: if inside Question view, key '1' starts/toggles the 10s question timer!
    if (activeView === 'question') {
      toggleModalTimer();
    }
    return;
  }
  
  if (activeView !== 'countdown') {
    switchView('countdown');
    resetTimer();
  } else {
    startTimer();
  }
}

/* -------------------------------------------------------------
 * Scoreboard & Google Sheet Integrations
 * ------------------------------------------------------------- */

// Simple robust CSV line parser
function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

// HTML escaping utility
function escapeHtml(str) {
  return String(str !== null && str !== undefined ? str : '')
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// In-memory state tracking for Stale-While-Revalidate and FLIP animations
let currentRenderedStandings = [];

// Render team list onto table rows with FLIP rank swapping animation & SWR
function renderStandings(standings, maxTeams = 6) {
  const tbody = document.getElementById('scoreboard-rows');
  if (!tbody) return;
  
  // Sort descending by score and slice to maxTeams
  const newSorted = [...standings].sort((a, b) => b.score - a.score).slice(0, maxTeams);
  
  const existingRows = Array.from(tbody.querySelectorAll('tr'));
  const isInitialRender = existingRows.length === 0 || currentRenderedStandings.length === 0;
  
  if (isInitialRender) {
    tbody.innerHTML = '';
    newSorted.forEach((team, index) => {
      const rank = index + 1;
      const tr = document.createElement('tr');
      tr.dataset.teamName = team.name;
      
      if (rank <= 3) {
        tr.className = `rank-${rank}`;
      }
      
      tr.style.animationDelay = `${index * 0.08}s`;
      tr.innerHTML = `
        <td class="col-rank"><span>${rank}</span></td>
        <td class="col-team">${escapeHtml(team.name)}</td>
        <td class="col-score">${team.score}</td>
      `;
      tbody.appendChild(tr);
    });
    currentRenderedStandings = newSorted;
  } else {
    // 1. FIRST: Capture old bounding box positions
    const firstPositions = {};
    existingRows.forEach(row => {
      const name = row.dataset.teamName;
      if (name) {
        firstPositions[name] = row.getBoundingClientRect().top;
      }
    });

    // 2. LAST: Render updated DOM elements
    tbody.innerHTML = '';
    const newRowElements = [];

    newSorted.forEach((team, index) => {
      const rank = index + 1;
      const tr = document.createElement('tr');
      tr.dataset.teamName = team.name;
      tr.className = 'rank-row-animating';
      
      if (rank <= 3) {
        tr.classList.add(`rank-${rank}`);
      }
      
      // Check if score changed
      const oldItem = currentRenderedStandings.find(item => item.name === team.name);
      if (oldItem && oldItem.score !== team.score) {
        tr.classList.add('score-updated');
      }

      tr.innerHTML = `
        <td class="col-rank"><span>${rank}</span></td>
        <td class="col-team">${escapeHtml(team.name)}</td>
        <td class="col-score">${team.score}</td>
      `;
      tbody.appendChild(tr);
      newRowElements.push(tr);
    });

    // 3. INVERT: Measure new positions and apply transform offsets
    const lastPositions = {};
    newRowElements.forEach(row => {
      const name = row.dataset.teamName;
      if (name) {
        lastPositions[name] = row.getBoundingClientRect().top;
      }
    });

    newRowElements.forEach(row => {
      const name = row.dataset.teamName;
      const firstTop = firstPositions[name];
      const lastTop = lastPositions[name];

      if (firstTop !== undefined && lastTop !== undefined) {
        const deltaY = firstTop - lastTop;
        if (deltaY !== 0) {
          row.classList.add('rank-swapping');
          row.style.transform = `translateY(${deltaY}px)`;
          row.style.transition = 'none';
        }
      } else {
        // Entering row
        row.style.opacity = '0';
        row.style.transform = 'translateY(15px)';
      }
    });

    // Force browser layout reflow
    void tbody.offsetHeight;

    // 4. PLAY: Animate smoothly to natural position
    requestAnimationFrame(() => {
      newRowElements.forEach(row => {
        row.style.transition = 'transform 0.6s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.4s ease';
        row.style.transform = '';
        row.style.opacity = '';
      });
    });

    setTimeout(() => {
      newRowElements.forEach(row => {
        row.classList.remove('rank-swapping', 'score-updated', 'rank-row-animating');
        row.style.transition = '';
      });
    }, 700);

    currentRenderedStandings = newSorted;
  }
  
  const lastUpdatedEl = document.getElementById('last-updated');
  if (lastUpdatedEl) {
    lastUpdatedEl.textContent = `Last updated: ${new Date().toLocaleTimeString()}`;
    lastUpdatedEl.style.color = '';
  }
}

// Load Scoreboard Core (Supports Apps Script Web App API & Published CSV with Header-based parsing)
async function loadScoreboard() {
  const isFinalPage = !!document.getElementById('view-jeopardy');
  const maxTeams = isFinalPage ? CONFIG.maxTeamsFinal : CONFIG.maxTeamsPrelim;
  
  // Prioritize Apps Script URL if configured, otherwise fallback to CSV
  const appsScriptUrl = CONFIG.appsScriptUrl || (isFinalPage ? CONFIG.finalAppsScriptUrl : CONFIG.prelimAppsScriptUrl);
  const csvUrl = CONFIG.googleSheetCsvUrl || (isFinalPage ? CONFIG.finalSheetCsvUrl : CONFIG.prelimSheetCsvUrl);
  const targetUrl = appsScriptUrl || csvUrl;
  
  // If no URL is set and we have no stored standings, load mock data
  if (!targetUrl) {
    console.log("No Google Sheet / Apps Script URL set. Loading mock data...");
    if (currentRenderedStandings.length === 0) {
      renderStandings(MOCK_STANDINGS, maxTeams);
    }
    return;
  }
  
  // STALE-WHILE-REVALIDATE: If data is already rendered, keep showing it while fetching
  const lastUpdatedEl = document.getElementById('last-updated');
  if (lastUpdatedEl && currentRenderedStandings.length > 0) {
    lastUpdatedEl.textContent = `Updating live... (${new Date().toLocaleTimeString()})`;
  }

  try {
    const response = await fetch(targetUrl);
    if (!response.ok) throw new Error("Network response error loading sheet.");
    
    const textData = await response.text();
    let parsedTeams = [];
    
    // Attempt 1: Try parsing as JSON (Apps Script Web App response)
    const trimmedText = textData.trim();
    if (trimmedText.startsWith('{') || trimmedText.startsWith('[')) {
      try {
        const jsonData = JSON.parse(trimmedText);
        const list = Array.isArray(jsonData) ? jsonData : (jsonData.standings || []);
        
        parsedTeams = list.map(item => {
          const rawName = item.name !== undefined ? item.name : (item.team || item.teamName || '');
          const rawScore = item.score !== undefined ? item.score : (item.points || 0);
          return {
            name: String(rawName).trim(),
            score: parseFloat(rawScore)
          };
        }).filter(t => t.name !== '' && !isNaN(t.score));
      } catch (jsonErr) {
        console.warn("Text looked like JSON but failed to parse, falling back to CSV parser:", jsonErr);
      }
    }

    // Attempt 2: CSV Parser with Header-Based Column Indexing
    if (parsedTeams.length === 0) {
      const rows = textData.split(/\r?\n/).filter(r => r.trim().length > 0);
      if (rows.length > 0) {
        const firstRowCols = parseCSVLine(rows[0]);
        
        // Detect Header Row
        let nameColIdx = -1;
        let scoreColIdx = -1;
        let startRowIdx = 0;

        // Header detection rules
        firstRowCols.forEach((colText, i) => {
          const val = colText.replace(/^["']|["']$/g, '').trim().toLowerCase();
          if (val === 'team' || val === 'name' || val === 'team name' || val === 'ชื่อทีม' || val === 'ทีม' || val === 'teamname') {
            nameColIdx = i;
          } else if (val === 'score' || val === 'scores' || val === 'points' || val === 'pts' || val === 'คะแนน' || val === 'แต้ม') {
            scoreColIdx = i;
          }
        });

        if (nameColIdx !== -1 || scoreColIdx !== -1) {
          startRowIdx = 1; // Skip header line
        }

        // Fallbacks if header labels were missing or not explicitly matched
        if (nameColIdx === -1) nameColIdx = 0;
        if (scoreColIdx === -1) scoreColIdx = firstRowCols.length > 1 ? 1 : 0;

        for (let i = startRowIdx; i < rows.length; i++) {
          const cols = parseCSVLine(rows[i]);
          if (!cols || cols.length === 0) continue;

          const rawName = cols[nameColIdx];
          const rawScore = cols[scoreColIdx];

          const teamName = String(rawName !== undefined ? rawName : '').replace(/^["']|["']$/g, '').trim();
          const scoreNum = parseFloat(String(rawScore !== undefined ? rawScore : '').replace(/^["']|["']$/g, '').trim());

          if (teamName !== '' && !isNaN(scoreNum)) {
            parsedTeams.push({ name: teamName, score: scoreNum });
          }
        }
      }
    }
    
    if (parsedTeams.length > 0) {
      renderStandings(parsedTeams, maxTeams);
    } else {
      throw new Error("No valid teams parsed from response.");
    }
    
  } catch (error) {
    console.error("Failed to load live scoreboard:", error);
    
    // If we have no cached data rendered yet, fall back to mock data
    if (currentRenderedStandings.length === 0) {
      renderStandings(MOCK_STANDINGS, maxTeams);
    }
    
    if (lastUpdatedEl) {
      lastUpdatedEl.textContent = currentRenderedStandings.length > 0
        ? `Last updated: ${new Date().toLocaleTimeString()} (Fetch retry failed)`
        : "Offline Fallback Mode (Loading Mock)";
      lastUpdatedEl.style.color = "#ff007f";
    }
  }
}

/* -------------------------------------------------------------
 * Event Handlers & Initializations
 * ------------------------------------------------------------- */

// Keyboard Hotkey Actions
window.addEventListener('keydown', (e) => {
  // Prevent browser default search behaviors, but allow standard refresh controls
  if (e.key === 'F5' || (e.metaKey && e.key === 'r') || (e.ctrlKey && e.key === 'r')) {
    return;
  }

  // Hotkey mapping
  switch (e.key.toLowerCase()) {
    case '1':
      // Prevent default page scroll etc.
      e.preventDefault();
      triggerTimerFlow();
      break;
      
    case 's':
      e.preventDefault();
      if (activeView === 'scoreboard') {
        const isFinalPage = !!document.getElementById('view-jeopardy');
        const fallbackView = isFinalPage ? 'jeopardy' : 'home';
        switchView(lastNonScoreboardView || fallbackView);
      } else {
        lastNonScoreboardView = activeView;
        switchView('scoreboard');
      }
      break;
      
    case 'h':
      e.preventDefault();
      switchView('home');
      break;
      
    case 'escape':
      if (activeView === 'question') {
        e.preventDefault();
        switchView('jeopardy');
      } else if (activeView === 'scoreboard') {
        e.preventDefault();
        const isFinalPage = !!document.getElementById('view-jeopardy');
        const fallbackView = isFinalPage ? 'jeopardy' : 'home';
        switchView(lastNonScoreboardView || fallbackView);
      } else if (activeView === 'countdown') {
        e.preventDefault();
        resetTimer();
      } else {
        e.preventDefault();
        switchView('home');
      }
      break;
      
    case ' ':
      if (activeView === 'countdown') {
        e.preventDefault();
        if (isTimerRunning) {
          pauseTimer();
        } else if (timeLeft > 0) {
          startTimer();
        }
      } else if (activeView === 'question') {
        e.preventDefault();
        toggleModalTimer();
      }
      break;
      
    case 'r':
      if (activeView === 'countdown') {
        e.preventDefault();
        resetTimer();
      } else if (activeView === 'question') {
        e.preventDefault();
        resetModalTimer();
      }
      break;
  }
});

// Sound activation banner (resolves Chrome/Safari autoplay policy)
const audioIndicator = document.getElementById('audio-indicator');
if (audioIndicator) {
  audioIndicator.addEventListener('click', () => {
    initAudio();
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
    // Play a quick chime to verify audio works
    playChime();
  });
}

// Automatically trigger audio context initialization on first click anywhere
window.addEventListener('click', () => {
  initAudio();
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
}, { once: true });

// Top-left Nav Back Button handler
const navBackBtn = document.getElementById('nav-back-btn');
if (navBackBtn) {
  navBackBtn.addEventListener('click', (e) => {
    if (activeView === 'question' || activeView === 'scoreboard') {
      e.preventDefault();
      initAudio();
      playChime();
      const isFinalPage = !!document.getElementById('view-jeopardy');
      const fallbackView = isFinalPage ? 'jeopardy' : 'home';
      switchView(lastNonScoreboardView || fallbackView);
    } else if (activeView === 'jeopardy') {
      e.preventDefault();
      initAudio();
      playChime();
      switchView('home');
    }
    // On Landing Page ('home'), standard link proceeds to index.html
  });
}

// Secret logo click trigger to enter Jeopardy stage (Final Round)
const logoTrigger = document.getElementById('logo-trigger');
if (logoTrigger) {
  logoTrigger.addEventListener('click', () => {
    initAudio();
    playChime();
    switchView('jeopardy');
  });
}

// Logo click trigger to enter Countdown stage without starting (Preliminary Round)
const prelimLogoTrigger = document.getElementById('logo-trigger-prelim');
if (prelimLogoTrigger) {
  prelimLogoTrigger.addEventListener('click', () => {
    initAudio();
    playChime();
    switchView('countdown');
    resetTimer();
  });
}

/* -------------------------------------------------------------
 * Final Round Question Modal & 30-Second Timer Mechanism
 * ------------------------------------------------------------- */
const FINAL_QUESTIONS_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vShiFlPfYdFdhnR7pMbce-btJ9ZSfXFatonn62ZDvGofF9ldfcuqhLdXgnLWqxmmRT2hGV7fD0RHTyz/pub?gid=1869660564&single=true&output=csv';

const finalQuestionsAuthors = {};
let currentQuestionCard = null;
let modalTimerDuration = 30;
let modalTimeLeft = 30;
let isModalTimerRunning = false;
let modalStartTime = null;
let modalPauseTimeElapsed = 0;
let modalAnimationFrameId = null;
const MODAL_RING_CIRCUMFERENCE = 2 * Math.PI * 115;

// Initialize Modal Progress Ring Circumference
const modalRingBar = document.getElementById('modal-ring-bar');
if (modalRingBar) {
  modalRingBar.style.strokeDasharray = `${MODAL_RING_CIRCUMFERENCE} ${MODAL_RING_CIRCUMFERENCE}`;
  modalRingBar.style.strokeDashoffset = 0;
}

// Fetch "Final_Questions" sheet tab data on page load
async function loadFinalQuestionsAuthors() {
  try {
    const res = await fetch(FINAL_QUESTIONS_CSV_URL);
    if (!res.ok) throw new Error("Network response error loading questions sheet.");
    const csvText = await res.text();
    const lines = csvText.split(/\r?\n/);
    lines.forEach((line, idx) => {
      if (!line.trim()) return;
      const cols = parseCSVLine(line);
      if (cols.length >= 3 && idx > 0) {
        const itemKey = cols[0].replace(/^["']|["']$/g, '').trim();
        const author = cols[2].replace(/^["']|["']$/g, '').trim();
        if (itemKey && author) {
          finalQuestionsAuthors[itemKey] = author;
        }
      }
    });
    console.log("Loaded Final Questions Authors:", finalQuestionsAuthors);
  } catch (err) {
    console.warn("Could not fetch questions sheet, using default fallback author:", err);
  }
}

if (document.querySelectorAll('.jeopardy-card').length > 0) {
  loadFinalQuestionsAuthors();
}

function setModalRingProgress(percent) {
  const ringBar = document.getElementById('modal-ring-bar');
  if (!ringBar) return;
  const offset = MODAL_RING_CIRCUMFERENCE * (1 - percent);
  ringBar.style.strokeDashoffset = offset;
}

function updateModalTimerUI() {
  const displayVal = Math.ceil(modalTimeLeft);
  const digitsEl = document.getElementById('modal-timer-digits');
  if (digitsEl) {
    digitsEl.textContent = displayVal < 10 ? `0${displayVal}` : displayVal;
  }
  const percent = modalTimeLeft / modalTimerDuration;
  setModalRingProgress(percent);
}

function resetModalTimer() {
  isModalTimerRunning = false;
  cancelAnimationFrame(modalAnimationFrameId);
  modalTimeLeft = modalTimerDuration;
  modalPauseTimeElapsed = 0;
  
  const statusEl = document.getElementById('modal-timer-status');
  if (statusEl) {
    statusEl.textContent = 'READY';
    statusEl.style.color = 'var(--neon-cyan)';
    statusEl.style.borderColor = 'rgba(0, 255, 210, 0.25)';
  }
  
  const btnText = document.getElementById('modal-timer-toggle-text');
  if (btnText) btnText.textContent = 'START TIMER';
  
  const digitsEl = document.getElementById('modal-timer-digits');
  if (digitsEl) {
    digitsEl.style.color = '#ffffff';
    digitsEl.style.textShadow = '0 0 25px var(--neon-cyan-glow)';
  }
  
  updateModalTimerUI();
}

function startModalTimer() {
  initAudio();
  if (isModalTimerRunning) return;
  
  // Mark card clicked ONLY when timer is started at least once
  if (currentQuestionCard) {
    currentQuestionCard.classList.add('clicked');
  }
  
  isModalTimerRunning = true;
  
  const statusEl = document.getElementById('modal-timer-status');
  if (statusEl) {
    statusEl.textContent = 'RUNNING';
    statusEl.style.color = 'var(--neon-green)';
    statusEl.style.borderColor = 'rgba(0, 255, 102, 0.3)';
  }
  
  const btnText = document.getElementById('modal-timer-toggle-text');
  if (btnText) btnText.textContent = 'PAUSE TIMER';
  
  modalStartTime = performance.now() - (modalPauseTimeElapsed * 1000);
  
  function modalTick() {
    if (!isModalTimerRunning) return;
    
    const now = performance.now();
    const elapsed = (now - modalStartTime) / 1000;
    const currentLeft = Math.max(0, modalTimerDuration - elapsed);
    
    const currentInt = Math.ceil(currentLeft);
    const lastInt = Math.ceil(modalTimeLeft);
    
    modalTimeLeft = currentLeft;
    updateModalTimerUI();
    
    if (currentInt < lastInt && currentInt > 0) {
      playTick(currentInt <= 5);
    }
    
    const digitsEl = document.getElementById('modal-timer-digits');
    if (currentLeft <= 5 && currentLeft > 0 && digitsEl) {
      digitsEl.style.color = 'var(--neon-pink)';
      digitsEl.style.textShadow = '0 0 25px var(--neon-pink)';
    }
    
    if (currentLeft <= 0) {
      finishModalTimer();
    } else {
      modalAnimationFrameId = requestAnimationFrame(modalTick);
    }
  }
  
  modalAnimationFrameId = requestAnimationFrame(modalTick);
}

function pauseModalTimer() {
  if (!isModalTimerRunning) return;
  
  isModalTimerRunning = false;
  cancelAnimationFrame(modalAnimationFrameId);
  modalPauseTimeElapsed = modalTimerDuration - modalTimeLeft;
  
  const statusEl = document.getElementById('modal-timer-status');
  if (statusEl) {
    statusEl.textContent = 'PAUSED';
    statusEl.style.color = '#eab308';
    statusEl.style.borderColor = 'rgba(234, 179, 8, 0.3)';
  }
  
  const btnText = document.getElementById('modal-timer-toggle-text');
  if (btnText) btnText.textContent = 'RESUME TIMER';
}

function toggleModalTimer() {
  if (isModalTimerRunning) {
    pauseModalTimer();
  } else if (modalTimeLeft > 0) {
    startModalTimer();
  }
}

function finishModalTimer() {
  isModalTimerRunning = false;
  modalTimeLeft = 0;
  cancelAnimationFrame(modalAnimationFrameId);
  
  const digitsEl = document.getElementById('modal-timer-digits');
  if (digitsEl) {
    digitsEl.textContent = '00';
    digitsEl.style.color = '#ff0033';
    digitsEl.style.textShadow = '0 0 30px #ff0033';
  }
  
  const statusEl = document.getElementById('modal-timer-status');
  if (statusEl) {
    statusEl.textContent = 'TIME UP';
    statusEl.style.color = '#ff0033';
    statusEl.style.borderColor = 'rgba(255, 0, 51, 0.3)';
  }
  
  const btnText = document.getElementById('modal-timer-toggle-text');
  if (btnText) btnText.textContent = 'START TIMER';
  
  setModalRingProgress(0);
  playBuzzer();
}

function openQuestionModal(card) {
  currentQuestionCard = card;
  const topic = card.dataset.topic;
  const item = card.dataset.item;
  const score = card.dataset.score;
  
  const itemKey = `${topic} - ${item}`;
  const authorName = finalQuestionsAuthors[itemKey] || 'ผศ.ดร.นพ.ดนัย วังสตุรค';
  
  const topicEl = document.getElementById('modal-q-topic');
  if (topicEl) topicEl.textContent = topic;
  
  const itemEl = document.getElementById('modal-q-item');
  if (itemEl) itemEl.textContent = `NO. ${item}`;
  
  const scoreEl = document.getElementById('modal-q-score');
  if (scoreEl) scoreEl.textContent = score;
  
  const authorEl = document.getElementById('modal-q-author');
  if (authorEl) authorEl.textContent = authorName;
  
  resetModalTimer();
  switchView('question');
}

// Jeopardy Card Click Handlers (Final Round)
document.querySelectorAll('.jeopardy-card').forEach(card => {
  card.addEventListener('click', () => {
    initAudio();
    playChime();
    openQuestionModal(card);
  });
});

// Modal Timer Controls Handlers
const modalTimerToggleBtn = document.getElementById('modal-timer-toggle-btn');
if (modalTimerToggleBtn) {
  modalTimerToggleBtn.addEventListener('click', () => {
    toggleModalTimer();
  });
}

const modalTimerResetBtn = document.getElementById('modal-timer-reset-btn');
if (modalTimerResetBtn) {
  modalTimerResetBtn.addEventListener('click', () => {
    resetModalTimer();
  });
}



