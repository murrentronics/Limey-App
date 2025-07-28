/**
 * Utility functions for JWT validation status management
 */

// Check if the user's JWT was validated during login
export const isJwtValidated = (): boolean => {
  const validated = localStorage.getItem('wp_jwt_validated');
  const token = localStorage.getItem('wp_jwt_token');
  
  // If validation status is true, trust it regardless of token presence
  // The token might be missing due to wallet unlinking, but credentials still match
  return validated === 'true';
};

// Clear JWT validation status
export const clearJwtValidation = (): void => {
  localStorage.removeItem('wp_jwt_validated');
  localStorage.removeItem('wp_jwt_validation_time');
  localStorage.removeItem('wp_jwt_token');
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
    isValid: isJwtValidated(),
    note: 'JWT validation does not expire - valid until logout'
  };
};