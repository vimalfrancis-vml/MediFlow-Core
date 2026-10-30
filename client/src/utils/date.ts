/**
 * Utility functions for formatting dates in standard DATE/MONTH/YEAR format (DD/MM/YYYY).
 */

/**
 * Formats a date string or Date object into standard DD/MM/YYYY format.
 * Example: 2026-08-24 -> 24/08/2026
 */
export function formatDate(dateInput?: string | Date | null): string {
  if (!dateInput) return '—';

  // Handle YYYY-MM-DD string inputs directly to prevent timezone shift
  if (typeof dateInput === 'string' && /^\d{4}-\d{2}-\d{2}/.test(dateInput) && !dateInput.includes('T')) {
    const parts = dateInput.substring(0, 10).split('-');
    if (parts.length === 3) {
      const [year, month, day] = parts;
      return `${day}/${month}/${year}`;
    }
  }

  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return '—';

  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();

  return `${day}/${month}/${year}`;
}

/**
 * Formats a date string or Date object into standard DD/MM/YYYY, hh:mm AM/PM format.
 * Example: 2026-08-24T14:30:00.000Z -> 24/08/2026, 02:30 PM
 */
export function formatDateTime(dateInput?: string | Date | null): string {
  if (!dateInput) return '—';

  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return '—';

  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();

  let hours = d.getHours();
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12;
  const strHours = String(hours).padStart(2, '0');

  return `${day}/${month}/${year}, ${strHours}:${minutes} ${ampm}`;
}

const MONTH_NAMES_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
];

/**
 * Formats a date string or Date object into human-readable enterprise format: "24 Oct 2026, 5:57 PM"
 */
export function fmtDateTime(dateInput?: string | Date | null): string {
  if (!dateInput) return '—';
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return '—';

  const day = d.getDate();
  const month = MONTH_NAMES_SHORT[d.getMonth()];
  const year = d.getFullYear();

  let hours = d.getHours();
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12;

  return `${day} ${month} ${year}, ${hours}:${minutes} ${ampm}`;
}

/**
 * Formats a date string or Date object into human-readable enterprise format: "24 Oct 2026"
 */
export function fmtDate(dateInput?: string | Date | null): string {
  if (!dateInput) return '—';

  if (typeof dateInput === 'string' && /^\d{4}-\d{2}-\d{2}/.test(dateInput) && !dateInput.includes('T')) {
    const parts = dateInput.substring(0, 10).split('-');
    if (parts.length === 3) {
      const [year, month, day] = parts;
      const mIdx = parseInt(month, 10) - 1;
      return `${parseInt(day, 10)} ${MONTH_NAMES_SHORT[mIdx] || month} ${year}`;
    }
  }

  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return '—';

  const day = d.getDate();
  const month = MONTH_NAMES_SHORT[d.getMonth()];
  const year = d.getFullYear();

  return `${day} ${month} ${year}`;
}

/**
 * Formats bytes into a standardized file size string:
 * - < 1 MB: formatted as KB (e.g. "850 KB")
 * - >= 1 MB: formatted as MB rounded to 1 decimal place (e.g. "4.3 MB")
 */
export function fmtSize(bytes?: number | null): string {
  if (!bytes || bytes <= 0 || isNaN(bytes)) return '0 KB';
  const kb = bytes / 1024;
  if (kb < 1024) {
    return `${Math.round(kb)} KB`;
  }
  const mb = kb / 1024;
  return `${mb.toFixed(1)} MB`;
}
