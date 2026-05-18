# StudyFlow Firestore Schema Design

## Database Information
- **Database Name**: `studyflow-vb`
- **Collection Name**: `studyflow_v1`

---

## Complete Schema Structure

```
Firestore Database: studyflow-vb
│
└── Collection: studyflow_v1
    │
    └── Document: {userUID} (e.g., "user_12345")
        │
        ├── Fields (User-level data):
        │   ├── uid (string): User's Firebase UID
        │   ├── username (string): Display name
        │   ├── email (string): User email
        │   ├── createdAt (timestamp): Account creation date
        │   ├── totalStudyTime (number): Total minutes studied (denormalized for quick access)
        │   └── currentStreak (number): Current study streak days
        │
        ├── Subcollection: subjects
        │   │
        │   └── Document: {subjectId} (e.g., "subject_math_123")
        │       ├── Fields:
        │       │   ├── subjectId (string): Unique identifier
        │       │   ├── name (string): e.g., "Math", "Computer Science"
        │       │   ├── color (string): Hex color code e.g., "#FF5733"
        │       │   ├── order (number): For sorting/reordering (1, 2, 3...)
        │       │   ├── createdAt (timestamp): When subject was created
        │       │   └── totalTimeSpent (number): Total minutes on this subject (denormalized)
        │       │
        │       └── Subcollection: sessions
        │           │
        │           └── Document: {sessionId} (e.g., "session_12345")
        │               ├── Fields:
        │               │   ├── sessionId (string): Unique session identifier
        │               │   ├── duration (number): Time studied in minutes
        │               │   ├── focusRating (number): 1-5 scale
        │               │   ├── notes (string): User's notes about the session
        │               │   ├── date (string): YYYY-MM-DD format for easy querying
        │               │   ├── startTime (string): ISO 8601 timestamp
        │               │   ├── endTime (string): ISO 8601 timestamp
        │               │   ├── timerMode (string): "stopwatch" or "pomodoro"
        │               │   ├── pomodoroIntervals (array): [25, 5, 25, 5...] if pomodoro
        │               │   └── createdAt (timestamp): When session was created
        │
        ├── Subcollection: goals
        │   │
        │   └── Document: {goalId} (e.g., "goal_daily_123")
        │       ├── Fields:
        │       │   ├── goalId (string): Unique identifier
        │       │   ├── type (string): "daily" or "weekly"
        │       │   ├── targetMinutes (number): Goal in minutes (e.g., 120)
        │       │   ├── targetSubjects (array): ["Math", "CS"] or empty for all subjects
        │       │   ├── createdAt (timestamp): When goal was created
        │       │   └── status (string): "active" or "archived"
        │
        ├── Subcollection: streaks
        │   │
        │   └── Document: "streakData"
        │       ├── Fields:
        │       │   ├── currentStreak (number): Current consecutive days
        │       │   ├── longestStreak (number): Longest streak ever
        │       │   ├── lastStudyDate (string): YYYY-MM-DD of last study day
        │       │   └── updatedAt (timestamp): Last update time
        │
        └── Subcollection: achievements
            │
            └── Document: {achievementId} (e.g., "achievement_first_hour")
                ├── Fields:
                │   ├── achievementId (string): Unique identifier
                │   ├── title (string): e.g., "First Hour"
                │   ├── description (string): What you did to earn it
                │   ├── icon (string): Emoji or icon identifier
                │   └── unlockedAt (timestamp): When unlocked
```

---

## Sample Data Example

```json
{
  "uid": "user_12345",
  "username": "vibhrav",
  "email": "vibhrav@email.com",
  "createdAt": "2024-01-15T10:30:00Z",
  "totalStudyTime": 1250,
  "currentStreak": 5
}

Subject Document:
{
  "subjectId": "subject_math_001",
  "name": "Math",
  "color": "#FF5733",
  "order": 1,
  "createdAt": "2024-01-15T10:30:00Z",
  "totalTimeSpent": 450
}

Session Document (nested under subject):
{
  "sessionId": "session_001",
  "duration": 45,
  "focusRating": 4,
  "notes": "Completed calculus homework",
  "date": "2024-03-25",
  "startTime": "2024-03-25T14:00:00Z",
  "endTime": "2024-03-25T14:45:00Z",
  "timerMode": "pomodoro",
  "pomodoroIntervals": [25, 5, 25, 5],
  "createdAt": "2024-03-25T14:45:00Z"
}

Goal Document:
{
  "goalId": "goal_daily_001",
  "type": "daily",
  "targetMinutes": 120,
  "targetSubjects": [],
  "createdAt": "2024-01-15T10:30:00Z",
  "status": "active"
}

Streak Document:
{
  "currentStreak": 5,
  "longestStreak": 12,
  "lastStudyDate": "2024-03-25",
  "updatedAt": "2024-03-25T15:00:00Z"
}

Achievement Document:
{
  "achievementId": "ach_first_hour",
  "title": "First Hour",
  "description": "Study for 60 minutes in one session",
  "icon": "⏱️",
  "unlockedAt": "2024-02-10T18:00:00Z"
}
```

---

## Query Patterns & Performance Considerations

### 1. **Dashboard Query** - Get all sessions for today
```
For each subject in user.subjects:
  Query sessions where date == "2024-03-25"
  Calculate total duration
  Group by subject with color coding
```
**Performance**: Multiple reads but organized by subject hierarchy

### 2. **Weekly Analytics** - Get sessions for past 7 days grouped by subject
```
For each subject in user.subjects:
  Query sessions where date >= "2024-03-18" AND date <= "2024-03-25"
  Calculate total per subject
```
**Performance**: Uses date field for efficient filtering

### 3. **Calendar Heatmap** - Get daily study activity for past 90 days
```
For each subject in user.subjects:
  Query sessions where date >= 90 days ago
  Group by date
  Show activity level
```
**Performance**: Date field enables range queries

### 4. **Session History** - Search and filter all sessions
```
For each subject:
  Query sessions with filters (date range, focus rating, keyword in notes)
```
**Performance**: Efficient with compound indexes

---

## Denormalization Strategy

The following fields are denormalized (duplicated) for performance:

- `user.totalStudyTime` - Denormalized from all sessions
- `user.currentStreak` - Denormalized from streaks collection
- `subject.totalTimeSpent` - Denormalized from all sessions under that subject

**Why?** These are frequently accessed on the dashboard without needing to aggregate all sessions.

---

## Indexing Recommendations

Required indexes for efficient queries:

1. **Sessions by Date**: `(userId, subjectId, date)`
2. **Goals by Type**: `(userId, type, status)`
3. **Achievements by Unlock Date**: `(userId, unlockedAt)`
4. **Sessions for Analytics**: `(userId, subjectId, date DESC)`

---

## Why This Structure Works for StudyFlow

✅ **User Privacy**: All data lives under user UID  
✅ **Subject Organization**: Sessions grouped by subject  
✅ **Efficient Queries**: Date field enables range queries for analytics  
✅ **Scalability**: Subcollections prevent document size limits  
✅ **Real-time Updates**: Can listen to subcollections for live updates  
✅ **Denormalization**: Frequently accessed totals don't require aggregation  

