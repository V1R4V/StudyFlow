# StudyFlow Architecture Planning

## Overview
This folder contains the architectural design and planning documents for the StudyFlow application.

## Documents

### 1. [APP_MINDMAP.md](./APP_MINDMAP.md)
- Complete app structure visualization
- All pages and their features
- Data flow diagram
- Key pages overview table

### 2. [FIRESTORE_SCHEMA.md](./FIRESTORE_SCHEMA.md)
- Complete Firestore database schema
- Hierarchical structure with subcollections
- Sample data examples in JSON format
- Query patterns for different features
- Denormalization strategy
- Performance considerations
- Indexing recommendations

---

## Key Design Decisions

### Database Structure: Hierarchical with Subcollections
- **User Level**: uid, username, email, denormalized totals
- **Subjects**: Organized under each user, with color and order
- **Sessions**: Nested under subjects for natural grouping
- **Goals, Streaks, Achievements**: Separate subcollections under user

### Denormalization Strategy
- `totalStudyTime` at user level (for quick dashboard access)
- `currentStreak` at user level (for streak display)
- `totalTimeSpent` at subject level (for subject analytics)

### Query Optimization
- Date field in YYYY-MM-DD format for efficient range queries
- Organized by subject for easy filtering
- Separate goals collection for goal management queries

---

## Next Steps

1. ✅ Architecture designed
2. ⏳ Firebase configuration setup
3. ⏳ Build components (Timer, Dashboard, etc.)
4. ⏳ Implement data persistence
5. ⏳ Deploy to GitHub Pages

---

## Learning Resources

- **Firestore Best Practices**: Use subcollections for one-to-many relationships
- **Query Optimization**: Index on frequently queried fields (date, subject, status)
- **React + Firebase**: Use hooks for real-time listeners
- **Data Denormalization**: Duplicate data for frequently accessed fields (not a bad practice in NoSQL)

