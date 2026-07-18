# 🏥 MDCU 4th Medical Tournament 2026 - Operator Guide

An interactive, futuristic web application designed for stage presentation, countdown management, Jeopardy-style competition, and live leaderboard displays for **The 4th MDCU Medical Tournament 2026** (23–24 July 2026).

---

## 🌟 Overview & Key Features

- **Multi-Stage Architecture**: Seamless portal navigation connecting the **Preliminary Round** (23 July 2026) and **Final Round** (24 July 2026).
- **Preliminary Round**: Includes interactive 15-second countdown timer, live leaderboard, and secret logo shortcut.
- **Final Round (Jeopardy Board)**: 3-column interactive question board across 3 categories (*Basic Medical Science*, *Clinical Science*, *MDCU*) with point values (100–250 pts), dynamic Question Author lookup from Google Sheets, and integrated 10-second question timer.
- **Live Leaderboard Integration**: Syncs real-time standings directly from published Google Sheets (CSV), featuring top 6 team display for Preliminary and top 4 for Final, with offline mock fallback.
- **Web Audio API Synthesizer**: 100% offline audio generation for countdown ticking sounds, warning pitch shifts, detuned digital time-up buzzers, and navigation arpeggio chimes.

---

## ⌨️ Operator Control Hotkeys

All views, navigation, and timing controls can be managed seamlessly via keyboard shortcuts:

### 🖥️ Navigation & General Controls
| Hotkey | Context / View | Action / Description |
| :--- | :--- | :--- |
| <kbd>1</kbd> | Preliminary Round | Swaps to 15-second Countdown View and auto-starts or resets timer. |
| <kbd>1</kbd> | Final Round (Question View) | Starts or toggles the 10-second Question timer. |
| <kbd>S</kbd> | Any Page | Toggles the **Scoreboard / Leaderboard View** (triggers live sheet refresh). |
| <kbd>H</kbd> | Any Page | Returns to the stage **Landing Page**. |
| <kbd>Space</kbd> | Countdown / Question View | **Pause / Resume** timer toggle. |
| <kbd>R</kbd> | Countdown / Question View | **Reset** timer back to ready status. |
| <kbd>Esc</kbd> | Question View | Exits question detail and returns to Jeopardy Board. |
| <kbd>Esc</kbd> | Scoreboard View | Closes scoreboard and returns to previous active view. |
| <kbd>Esc</kbd> | Countdown View | Resets countdown timer. |
| <kbd>Esc</kbd> | Home / General | Swaps back to stage Landing Page. |

---

## 🏆 Round Breakdown & Operations

### 1. 📍 Main Portal (`index.html`)
- Entry hub providing stage selection cards for Preliminary Round and Final Round.

### 2. ⏱️ Preliminary Round (`prelim.html`)
- **Landing Page**: Event branding view. Click the MDCU Logo (`logo-trigger-prelim`) or press <kbd>1</kbd> to enter Countdown mode.
- **15-Second Timer View**: Features a cybernetic circular progress ring with color warning transitions (cyan -> pink) during the final 5 seconds.
- **Leaderboard**: Displays the **Top 6 teams** fetched live from Google Sheets.

### 3. 🎯 Final Round (`final.html`)
- **Landing Page**: Click the MDCU Logo (`logo-trigger`) to access the Jeopardy Board.
- **Jeopardy Quiz Board**: 3 Categories with 4 questions each:
  - **Basic Medical Science**: No. 1 (100 pts), No. 2 (200 pts), No. 3 (200 pts), No. 4 (250 pts)
  - **Clinical Science**: No. 1 (100 pts), No. 2 (200 pts), No. 3 (200 pts), No. 4 (250 pts)
  - **MDCU**: No. 1 (100 pts), No. 2 (200 pts), No. 3 (200 pts), No. 4 (250 pts)
- **Question Detail & 10s Timer**:
  - Displays category, question item number, point value, and question author (*อาจารย์ผู้ออกข้อสอบ*).
  - Authors are loaded dynamically from the `Final_Questions` sheet tab.
  - Interactive 10-second countdown timer with circular ring visualizer.
  - Selected cards dim after timer start to indicate played items.
- **Leaderboard**: Displays the **Top 4 finalist teams**.

---

## 📊 Scoreboard & Google Sheets Integration

### Published Sheet URLs (`app.js`)
The application fetches data via published CSV endpoints configured in `CONFIG`:

```javascript
const CONFIG = {
  countdownDuration: 15,
  prelimSheetCsvUrl: 'YOUR_PUBLISHED_PRELIM_CSV_URL',
  finalSheetCsvUrl: 'YOUR_PUBLISHED_FINAL_CSV_URL',
  maxTeamsPrelim: 6,
  maxTeamsFinal: 4
};
```

### How to Publish Google Sheets as CSV
1. Open your tournament Google Sheet.
2. Navigate to **File** > **Share** > **Publish to web**.
3. Select the tab for **Preliminary Standings**, **Final Standings**, or **Final_Questions**.
4. Set the output format to **Comma-separated values (.csv)** and copy the published link into `app.js`.

### Features
- **Auto-Detect Headers**: Automatically recognizes column headers in English (`Team`, `Score`, `Points`, `Rank`) and Thai (`ชื่อทีม`, `คะแนน`, `ลำดับ`).
- **Offline Fallback**: Automatically loads built-in high-fidelity medical school mock standings (Chula, Siriraj, Rama, CMU, KKU, PCM) if offline or network fails.

---

## 🔊 Audio Feedback System

The application utilizes the **Web Audio API** to generate 100% offline-compatible sounds (no external MP3/WAV assets required):

- **Timer Ticks**: Low click on every elapsed second; shifts to higher warning pitch during final seconds (<=5s for Preliminary, <=3s for Final Question timer).
- **Time Up Buzzer**: Dual-oscillator detuned digital buzzer when time reaches `00`.
- **Navigation Chimes**: Upward arpeggio chime (C4 -> E4 -> G4 -> C5) on view transitions.

> ℹ️ **Enabling Audio Context**: Web browsers require user interaction before playing audio. Click anywhere on the page before live stage presentation to enable audio playback.

---

## 📁 File Structure

```
mdcu-tournament26/
├── index.html        # Main Tournament Portal & Stage Selection
├── prelim.html       # Preliminary Round UI (Timer & Top 6 Scoreboard)
├── final.html        # Final Round UI (Jeopardy Board, Question View & Top 4 Scoreboard)
├── styles.css        # Cyber-medical dark theme styles, animations & glassmorphism
├── app.js            # Controller logic, hotkey handlers, audio synth & sheet CSV fetchers
├── README.md         # Operator guide and technical documentation
└── assets/
    └── images/
        └── congresslogo.jpg  # MDCU Congress Logo
```

---

## 🚀 Running Locally

Open `index.html` in any modern web browser (Chrome, Safari, Edge, Firefox) or serve via any static file server:

```bash
# Using Python
python3 -m http.server 8000

# Using Node.js serve
npx serve .
```
