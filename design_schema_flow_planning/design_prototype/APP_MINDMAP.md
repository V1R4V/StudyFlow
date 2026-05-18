# StudyFlow App Architecture Mind Map

## App Structure Overview

```
🎓 StudyFlow App
├── 🏠 Home/Authentication
├── 📊 Dashboard
│   ├── Total Study Time Card
│   ├── Time by Subject (Color-coded Chart)
│   ├── Weekly Trends (Bar/Line Chart)
│   ├── Focus Rating Stats
│   └── Calendar Heatmap
├── ⏱️ Study Session
│   ├── Select Subject
│   ├── Choose Timer Mode (Stopwatch/Pomodoro)
│   ├── Start/Pause Timer
│   ├── Rate Focus 1-5
│   ├── Add Notes
│   └── Save Session
├── 📚 Subject Manager
│   ├── View All Subjects
│   ├── Add Subject
│   ├── Edit Subject
│   ├── Assign Color
│   ├── Reorder Subjects
│   └── Delete Subject
├── 📋 Session History
│   ├── Search Sessions
│   ├── Filter by Subject
│   ├── Filter by Date
│   ├── Edit Session
│   └── Delete Session
└── 🎯 Goals & Streaks
    ├── Daily Goals
    ├── Weekly Goals
    ├── Study Streak Counter
    └── Achievements/Badges
```

## Key Pages

| Page | Purpose | Key Features |
|------|---------|--------------|
| **Dashboard** | Overview of study activity | Charts, stats, heatmap (Apple ScreenTime style) |
| **Study Session** | Record a new study session | Timer, subject selection, focus rating |
| **Subject Manager** | Manage subjects | Add, edit, delete, reorder, assign colors |
| **Session History** | View all past sessions | Search, filter, edit, delete |
| **Goals & Streaks** | Track progress | Daily/weekly goals, achievements, streaks |
| **Authentication** | Login/Signup | User uid management |

## Data Flow

```
User Login (UID) 
    ↓
Create Subject (e.g., "Math")
    ↓
Start Study Session → Select Subject → Start Timer
    ↓
Complete Session → Rate Focus → Add Notes
    ↓
Session Saved to Firestore
    ↓
Dashboard updates with new data
    ↓
Charts/Analytics recalculate
    ↓
Streaks/Goals check if reached
```
