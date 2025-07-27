/**
 * Utility functions for JWT validation status management
 */

// Check if the user's JWT was validated during login
export const isJwtValidated = (): boolean => {
  const validated = localStorage.getItem('wp_jwt_validated');
  const validationTime = localStorage.getItem('wp_jwt_validation_time');
  
  if (validated !== 'true' || !validationTime) {
    return false;
  }
  
  // Check if validation is still fresh (within 24 hours)
  const validationTimestamp = parseInt(validationTime);
  const now = Date.now();
  const twentyFourHours = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
  
  if (now - validationTimestamp > twentyFourHours) {
    // Validation is stale, clear it
    clearJwtValidation();
    return false;
  }
  
  return true;
};

// Clear JWT validation status
export const clearJwtValidation = (): void => {
  localStorage.removeItem('wp_jwt_validated');
  localStorage.removeItem('wp_jwt_validation_time');
};

// Set JWT validation status (called from useAuth)
export const setJwtValidated = (validated: boolean): void => {
  if (validated) {
    localStorage.setItem('wp_jwt_validated', 'true');
    localStorage.setItem('wp_jwt_validation_time', Date.now().toString());
  } else {
    localStorage.setItem('wp_jwt_validated', 'false');
    localStorage.removeItem('wp_jwt_validation_time');
  }
};

// Get JWT validation info for debugging
export const getJwtValidationInfo = () => {
  return {
    validated: localStorage.getItem('wp_jwt_validated'),
    validationTime: localStorage.getItem('wp_jwt_validation_time'),
    isValid: isJwtValidated()
  };
};