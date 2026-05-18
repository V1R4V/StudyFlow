// Utility functions for formatting - Date & Time helpers
// Challenge: Build formatting functions to display time and dates nicely

/**
 * TODO: Convert minutes to HH:MM:SS format
 * @param {number} minutes - Total minutes
 * @returns {string} Formatted time string (e.g., '2h 30m' or '45m')
 * HINT: Calculate hours = Math.floor(minutes / 60), then remainder minutes
 * HINT: Return '0m' if no minutes
 */
export const formatTime = (minutes) => {
  throw new Error('TODO: Implement formatTime');
};

/**
 * TODO: Convert seconds to MM:SS format for timer display
 * @param {number} seconds - Total seconds
 * @returns {string} Formatted time string MM:SS (e.g., '02:45')
 * HINT: Calculate minutes and seconds, pad with zeros using padStart(2, '0')
 * HINT: Use string template: `${minutes}:${secs}`
 */
export const formatTimerDisplay = (seconds) => {
  throw new Error('TODO: Implement formatTimerDisplay');
};

/**
 * TODO: Format date to YYYY-MM-DD
 * @param {Date|string} date - Date object or string
 * @returns {string} Formatted date string (e.g., '2026-04-01')
 * HINT: Create new Date(date), extract year/month/day
 * HINT: Use padStart(2, '0') for month and day to ensure 2 digits
 */
export const formatDate = (date) => {
  throw new Error('TODO: Implement formatDate');
};

/**
 * TODO: Format date to readable format
 * @param {Date|string} date - Date object or string
 * @returns {string} Formatted date string (e.g., 'Apr 1, 2026')
 * HINT: Use toLocaleDateString with options object
 * HINT: Options: { year: 'numeric', month: 'short', day: 'numeric' }
 */
export const formatDateReadable = (date) => {
  throw new Error('TODO: Implement formatDateReadable');
};

/**
 * TODO: Get today's date in YYYY-MM-DD format
 * @returns {string} Today's date (e.g., '2026-04-01')
 * HINT: Call new Date() to get today, pass to formatDate()
 */
export const getTodayDate = () => {
  throw new Error('TODO: Implement getTodayDate');
};

/**
 * TODO: Get week start date (Monday)
 * @returns {string} Week start date in YYYY-MM-DD format
 * HINT: Create date, get day of week (0=Sunday, 1=Monday...)
 * HINT: Adjust to find Monday of current week
 * ADVANCED: Handle Sunday edge case
 */
export const getWeekStartDate = () => {
  throw new Error('TODO: Implement getWeekStartDate');
};

/**
 * TODO: Get last n days dates
 * @param {number} days - Number of days
 * @returns {string[]} Array of dates in YYYY-MM-DD format
 * HINT: Loop from 'days' down to 0
 * HINT: For each iteration, create new Date and subtract i days
 * HINT: Use date.setDate(date.getDate() - i) to go back
 */
export const getLastNDaysDates = (days) => {
  throw new Error('TODO: Implement getLastNDaysDates');
};
