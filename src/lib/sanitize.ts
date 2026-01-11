/**
 * Sanitization utilities for user input to prevent SQL injection and pattern injection attacks
 */

/**
 * Sanitizes user input for use in SQL ILIKE patterns
 * Escapes SQL wildcards (% and _) to prevent pattern injection attacks
 * Also limits input length to prevent performance issues
 */
export const sanitizeSearchInput = (input: string, maxLength: number = 100): string => {
  if (!input || typeof input !== 'string') return '';
  
  // Trim and limit length
  const trimmed = input.trim().slice(0, maxLength);
  
  // Escape SQL wildcards to prevent pattern injection
  // % and _ are special characters in ILIKE patterns
  return trimmed.replace(/[%_\\]/g, '\\$&');
};

/**
 * Validates and sanitizes numeric input for price filters
 */
export const sanitizeNumericInput = (value: string): number | null => {
  if (!value || value.trim() === '') return null;
  
  const num = parseFloat(value);
  
  // Validate it's a reasonable number
  if (isNaN(num) || !isFinite(num) || num < 0 || num > 1000000000) {
    return null;
  }
  
  return num;
};

/**
 * Validates category input - only allows alphanumeric, spaces, and common punctuation
 */
export const sanitizeCategoryInput = (input: string): string => {
  if (!input || typeof input !== 'string') return '';
  
  // Allow alphanumeric, spaces, hyphens, and French accents
  return input.trim().replace(/[^a-zA-Z0-9\s\-àâäéèêëïîôùûüÿçÀÂÄÉÈÊËÏÎÔÙÛÜŸÇ]/g, '').slice(0, 100);
};
