// Retention for scripts/leads.mjs purge-emails. The period itself lives in
// src/data/privacy.js, next to the policy text that promises it.

const DAY_MS = 24 * 60 * 60 * 1000;

// Leads created before this instant have outlived the retention period.
export function emailPurgeCutoff(now, days) {
  if (!Number.isFinite(days) || days <= 0) {
    throw new RangeError(`retention period must be a positive number of days, got ${days}`);
  }
  return new Date(now.getTime() - days * DAY_MS).toISOString();
}
