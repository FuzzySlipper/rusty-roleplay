import { createHash } from 'node:crypto';

export function slugify(value, fallback = 'imported') {
  const slug = String(value ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 72);
  return slug || fallback;
}

export function shortHash(value) {
  return createHash('sha256').update(String(value)).digest('hex').slice(0, 12);
}

export function timestampId(date = new Date()) {
  return date.toISOString().replace(/[-:.TZ]/g, '').slice(0, 14);
}
