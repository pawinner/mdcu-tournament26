/* -------------------------------------------------------------
 * MDCU Medical Tournament 2026 - Controller Logic
 * ------------------------------------------------------------- */

// Configuration
const CONFIG = {
  countdownDuration: 15, // seconds
  // The user will paste their published Google Sheet CSV URL here in the future.
  // Example: 'https://docs.google.com/spreadsheets/d/e/2PACX-1v.../pub?output=csv'
  googleSheetCsvUrl: '' 
};

// State Variables
let activeView = 'home'; // 'home' | 'countdown' | 'scoreboard'
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
  
  // Clean up timer if navigating away from countdown
  if (activeView === 'countdown') {
    pauseTimer();
  }
  
  // Remove active from current view
  document.getElementById(`view-${activeView}`).classList.remove('active');
  
  // Set new active view
  activeView = viewName;
  document.getElementById(`view-${activeView}`).classList.add('active');
  
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
  viewEl.classList.remove('timer-paused', 'timer-finished');
  viewEl.classList.add('timer-running');
  document.getElementById('timer-status').textContent = 'RUNNING';
  
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
    if (currentLeft <= 5 && currentLeft > 0) {
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
  viewEl.classList.remove('timer-running');
  viewEl.classList.add('timer-paused');
  document.getElementById('timer-status').textContent = 'PAUSED';
}

function resetTimer() {
  isTimerRunning = false;
  cancelAnimationFrame(animationFrameId);
  
  timeLeft = timerDuration;
  pauseTimeElapsed = 0;
  
  const viewEl = document.getElementById('view-countdown');
  viewEl.classList.remove('timer-running', 'timer-paused', 'timer-finished', 'timer-warning');
  document.getElementById('timer-status').textContent = 'READY';
  
  updateTimerUI();
}

function finishTimer() {
  isTimerRunning = false;
  timeLeft = 0;
  cancelAnimationFrame(animationFrameId);
  
  const viewEl = document.getElementById('view-countdown');
  viewEl.classList.remove('timer-running', 'timer-warning');
  viewEl.classList.add('timer-finished');
  
  const digitsEl = document.getElementById('timer-digits');
  if (digitsEl) digitsEl.textContent = '00';
  
  document.getElementById('timer-status').textContent = 'TIME UP';
  setProgress(0);
  playBuzzer();
}

// Trigger timer workflow directly (pressing '1' key)
function triggerTimerFlow() {
  switchView('countdown');
  resetTimer();
  // Delay slightly to allow transition animation to begin nicely before sound/start
  setTimeout(() => {
    startTimer();
  }, 100);
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

// Render team list onto table rows
function renderStandings(standings) {
  const tbody = document.getElementById('scoreboard-rows');
  if (!tbody) return;
  
  tbody.innerHTML = '';
  
  // Sort descending by score
  const sorted = [...standings].sort((a, b) => b.score - a.score);
  
  sorted.forEach((team, index) => {
    const rank = index + 1;
    const tr = document.createElement('tr');
    
    // Assign top 3 formatting classes
    if (rank <= 3) {
      tr.className = `rank-${rank}`;
    }
    
    // Adding animation delay so the lines slide in sequentially (staggered)
    tr.style.animationDelay = `${index * 0.08}s`;
    
    tr.innerHTML = `
      <td class="col-rank"><span>${rank}</span></td>
      <td class="col-team">${team.name}</td>
      <td class="col-score">${team.score}</td>
    `;
    tbody.appendChild(tr);
  });
  
  document.getElementById('last-updated').textContent = `Last updated: ${new Date().toLocaleTimeString()}`;
}

// Load Scoreboard Core
async function loadScoreboard() {
  const url = CONFIG.googleSheetCsvUrl;
  
  if (!url) {
    // No URL configured, load high-fidelity local mock data
    console.log("No Google Sheet CSV URL set. Loading mock data...");
    renderStandings(MOCK_STANDINGS);
    return;
  }
  
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error("Network response error loading sheet.");
    
    const csvText = await response.text();
    const rows = csvText.split(/\r?\n/);
    const parsedTeams = [];
    
    rows.forEach((rowText, idx) => {
      if (!rowText.trim()) return;
      const cols = parseCSVLine(rowText);
      
      // Auto-detect & skip headers (Thai/English indicators)
      const isHeader = cols.some(c => {
        const val = c.toLowerCase();
        return val === 'team' || val === 'score' || val === 'points' || val === 'rank' || val === 'ชื่อทีม' || val === 'คะแนน' || val === 'ลำดับ';
      });
      if (isHeader && idx === 0) return;
      
      // Intelligent parser finds team name and score regardless of columns order
      let score = null;
      let teamName = '';
      
      cols.forEach(col => {
        const cleaned = col.replace(/^["']|["']$/g, '').trim();
        if (cleaned === '') return;
        
        const num = parseFloat(cleaned);
        if (!isNaN(num)) {
          score = num;
        } else {
          // Keep the longest text cell as the team name to handle potential rank text
          if (!teamName || cleaned.length > teamName.length) {
            teamName = cleaned;
          }
        }
      });
      
      if (teamName && score !== null) {
        parsedTeams.push({ name: teamName, score: score });
      }
    });
    
    if (parsedTeams.length > 0) {
      renderStandings(parsedTeams);
    } else {
      throw new Error("No teams parsed from published sheet.");
    }
    
  } catch (error) {
    console.error("Failed to load live scoreboard:", error);
    // Graceful fallback to mock data so display doesn't break during live round
    renderStandings(MOCK_STANDINGS);
    
    // Add brief alert indicator in bottom footer
    const refreshText = document.getElementById('last-updated');
    if (refreshText) {
      refreshText.textContent = "Offline Fallback Mode (Loading Mock)";
      refreshText.style.color = "#ff007f";
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
      switchView('scoreboard');
      break;
      
    case 'h':
    case 'escape':
      e.preventDefault();
      switchView('home');
      break;
      
    case ' ':
      // Space toggles pause/resume ONLY if we are in the countdown view
      if (activeView === 'countdown') {
        e.preventDefault();
        if (isTimerRunning) {
          pauseTimer();
        } else if (timeLeft > 0) {
          startTimer();
        }
      }
      break;
      
    case 'r':
      if (activeView === 'countdown') {
        e.preventDefault();
        resetTimer();
      }
      break;
  }
});

// Sound activation banner (resolves Chrome/Safari autoplay policy)
document.getElementById('audio-indicator').addEventListener('click', () => {
  initAudio();
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  // Play a quick chime to verify audio works
  playChime();
});

// Automatically trigger audio context initialization on first click anywhere
window.addEventListener('click', () => {
  initAudio();
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
}, { once: true });
