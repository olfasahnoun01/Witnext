// Auto-generated version based on build timestamp
// This file updates automatically on each build

const BUILD_DATE = new Date().toISOString();
const BUILD_TIMESTAMP = Date.now();

// Parse build date for version
const date = new Date(BUILD_DATE);
const year = date.getFullYear();
const month = String(date.getMonth() + 1).padStart(2, '0');
const day = String(date.getDate()).padStart(2, '0');
const hours = String(date.getHours()).padStart(2, '0');
const minutes = String(date.getMinutes()).padStart(2, '0');

// Version format: YYYY.MM.DD.HHmm (e.g., 2026.01.21.1745)
export const APP_VERSION = `${year}.${month}.${day}.${hours}${minutes}`;

// Human readable build date
export const BUILD_DATE_FORMATTED = date.toLocaleDateString('fr-FR', {
  year: 'numeric',
  month: 'long',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit'
});

export const VERSION_INFO = {
  version: APP_VERSION,
  buildDate: BUILD_DATE_FORMATTED,
  timestamp: BUILD_TIMESTAMP
};
