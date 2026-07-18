# MDCU 4th Medical Tournament 2026 - Operator Guide

An interactive, futuristic web application designed for stage presentation, countdown management, and live leaderboard display during the **4th MDCU Medical Tournament 2026**.

---

## ⌨️ Operator Control Hotkeys

All views and timer controls can be managed seamlessly via keyboard shortcuts:

### 🖥️ Navigation Controls
| Hotkey | View / Action | Description |
| :--- | :--- | :--- |
| <kbd>1</kbd> | **Countdown Timer** | Swaps to Countdown View, resets timer to **15 seconds**, and auto-starts countdown with audio ticks. |
| <kbd>S</kbd> | **Scoreboard** | Swaps to Live Scoreboard View and triggers data refresh from Google Sheet / local standings. |
| <kbd>H</kbd> / <kbd>Esc</kbd> | **Homepage** | Swaps back to Main Event Homepage. |

### ⏱️ Countdown Timer Controls (Active in Countdown View)
| Hotkey | Action | Description |
| :--- | :--- | :--- |
| <kbd>Space</kbd> | **Pause / Resume** | Toggles countdown timer state. |
| <kbd>R</kbd> | **Reset** | Resets timer back to full 15-second duration in `READY` status. |

---

## 🔊 Audio Feedback System

The application utilizes the **Web Audio API** to generate 100% offline-compatible sounds (no external audio files required):

- **Timer Ticks**: Low click on every elapsed second; pitches higher during the final 5 seconds.
- **Time Up Buzzer**: Dual-oscillator detuned digital buzzer when time reaches `00`.
- **Navigation Chimes**: Upward arpeggio chime when opening the scoreboard.

> ℹ️ **Enabling Audio**: Modern browsers may block audio until user interaction. Click the **"Sound Ready"** indicator badge in the top-right corner (or click anywhere on the screen) to enable audio context before live stage presentation.

---

## 📊 Scoreboard & Google Sheets Integration

### How to Connect a Live Google Sheet
1. Create a Google Sheet with team names and scores (e.g., `Team Name` and `Score`).
2. Go to **File** > **Share** > **Publish to web**.
3. Select the target sheet tab and choose **Comma-separated values (.csv)** as the output format.
4. Copy the published CSV link.
5. Open `app.js` and set `googleSheetCsvUrl` in the `CONFIG` object:
   ```javascript
   const CONFIG = {
     countdownDuration: 15,
     googleSheetCsvUrl: 'YOUR_PUBLISHED_CSV_URL_HERE'
   };
   ```

### Intelligent CSV Parser & Fallback
- **Auto-Detect Headers**: Automatically detects column names in both English (`Team`, `Score`, `Points`, `Rank`) and Thai (`ชื่อทีม`, `คะแนน`, `ลำดับ`).
- **Offline Fallback**: If `googleSheetCsvUrl` is blank or network fails, the app automatically loads built-in high-fidelity medical school mock standings (Chula, Siriraj, Rama, CMU, KKU, PCM).

---

## 📁 File Structure

```
mdcu-tournament26/
├── index.html        # Main presentation UI structure & views
├── styles.css        # Cyber-medical aesthetic styling, themes & animations
├── app.js            # Keydown handler, audio synthesizer, CSV fetcher & timer logic
├── README.md         # Operator guide and technical documentation
└── assets/
    └── images/
        └── congresslogo.jpg  # MDCU Congress Logo
```

---

## 🚀 Running Locally

Open `index.html` in any web browser (Chrome, Safari, Edge, Firefox) or serve via any static file server (e.g., Live Server in VS Code, `python3 -m http.server 8000`, or `npx serve .`).
