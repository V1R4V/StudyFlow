// Validation functions - Form & Data validation
// Challenge: Build validators for user inputs

/**
 * TODO: Validate email format
 * @param {string} email - Email to validate
 * @returns {boolean} True if valid
 * HINT: Use regex: /^[^\s@]+@[^\s@]+\.[^\s@]+$/
 * HINT: Check .test(email) against regex
 */
export const isValidEmail = (email) => {
  throw new Error('TODO: Implement isValidEmail');
};

/**
 * TODO: Validate password strength
 * @param {string} password - Password to validate
 * @returns {object} Validation result { isValid: boolean, message: string }
 * HINT: Check password.length >= 6
 * HINT: Return { isValid: true, message: '' } if valid
 * HINT: Return { isValid: false, message: 'error...' } if invalid
 */
export const validatePassword = (password) => {
  throw new Error('TODO: Implement validatePassword');
};

/**
 * TODO: Validate subject name
 * @param {string} name - Subject name to validate
 * @returns {boolean} True if valid
 * HINT: Check name is non-empty, trimmed length > 0, and length <= 50
 */
export const isValidSubjectName = (name) => {
  throw new Error('TODO: Implement isValidSubjectName');
};

/**
 * TODO: Validate duration (in minutes)
 * @param {number} duration - Duration in minutes
 * @returns {boolean} True if valid
 * HINT: Check duration > 0 and duration <= 1440 (24 hours max)
 */
export const isValidDuration = (duration) => {
  throw new Error('TODO: Implement isValidDuration');
};

/**
 * TODO: Validate focus rating (1-5 scale)
 * @param {number} rating - Focus rating
 * @returns {boolean} True if valid
 * HINT: Check rating >= 1 and rating <= 5
 */
export const isValidFocusRating = (rating) => {
  throw new Error('TODO: Implement isValidFocusRating');
};

/**
 * TODO: Validate hex color
 * @param {string} color - Hex color code
 * @returns {boolean} True if valid
 * HINT: Use regex: /^#[0-9A-F]{6}$/i
 * HINT: Format should be #RRGGBB (e.g., '#2b4bee')
 */
export const isValidHexColor = (color) => {
  throw new Error('TODO: Implement isValidHexColor');
};

/**
 * TODO: Validate form data for new subject
 * @param {object} data - Subject data { name, color }
 * @returns {object} { isValid: boolean, errors: {} }
 * HINT: Check name using isValidSubjectName()
 * HINT: Check color using isValidHexColor()
 * HINT: Build errors object with field-level error messages
 * HINT: Return { isValid: true, errors: {} } if all valid
 */
export const validateSubjectForm = (data) => {
  throw new Error('TODO: Implement validateSubjectForm');
};

/**
 * TODO: Validate form data for new session
 * @param {object} data - Session data { subjectId, duration, focusRating }
 * @returns {object} { isValid: boolean, errors: {} }
 * HINT: Check subjectId exists
 * HINT: Check duration using isValidDuration()
 * HINT: Check focusRating (if provided) using isValidFocusRating()
 * HINT: Build errors object for each invalid field
 */
export const validateSessionForm = (data) => {
  throw new Error('TODO: Implement validateSessionForm');
};
