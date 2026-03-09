// Single source of truth for all pages that can be access-controlled.
// Add new entries here and they'll automatically appear in the Admin Panel's Page Access column.

export const PAGE_OPTIONS = [
  "Dashboard",
  "Mark Attendance",
  "Absentee Report",
  "Attendance Records",
  "Daily Report",
] as const;

export type PageName = (typeof PAGE_OPTIONS)[number];
