import { basename, extname } from 'node:path';

import { shortHash, slugify } from './ids.mjs';

export function parseStTranscript(text, { filePath, profileId, sessionId } = {}) {
  const rows = [];
  const metadataRows = [];
  const errors = [];
  text.split(/\r?\n/).forEach((line, sourceIndex) => {
    if (!line.trim()) return;
    let parsed;
    try {
      parsed = JSON.parse(line);
    } catch (error) {
      errors.push({ sourceIndex, reason: `invalid JSON: ${error.message}` });
      return;
    }
    if (!isRecord(parsed)) {
      errors.push({ sourceIndex, reason: 'row is not an object' });
      return;
    }
    const body = firstString(parsed.mes, parsed.content, parsed.text);
    if (body === undefined) {
      metadataRows.push({ ...parsed, sourceIndex });
      return;
    }
    const role = transcriptRole(parsed);
    const timestamp = firstString(parsed.send_date, parsed.create_date, parsed.created_at);
    rows.push({
      role,
      name: firstString(parsed.name),
      body,
      ...(timestamp ? { createdAt: timestamp, send_date: timestamp } : {}),
      swipe_id: finiteNumber(parsed.swipe_id),
      swipes: strings(parsed.swipes),
      swipe_info: Array.isArray(parsed.swipe_info) ? parsed.swipe_info : undefined,
      extra: isRecord(parsed.extra) ? parsed.extra : undefined,
      metadata: { source_index: sourceIndex, source_file: filePath, raw_name: parsed.name },
    });
  });
  if (rows.length === 0) throw new Error(`Transcript ${filePath ?? ''} contains no importable messages.`);
  const timestamps = rows.map((row) => row.createdAt).filter(Boolean).sort();
  const assistantNames = mostCommon(rows.filter((row) => row.role === 'assistant').map((row) => row.name).filter(Boolean));
  const userNames = mostCommon(rows.filter((row) => row.role === 'user').map((row) => row.name).filter(Boolean));
  const title = fileStem(filePath) || `Imported ST chat with ${assistantNames ?? 'character'}`;
  const stableSessionId = sessionId ?? `st-history-${slugify(title)}-${shortHash(`${profileId}:${filePath ?? title}`)}`;
  return {
    sessionId: stableSessionId,
    title,
    rows,
    metadataRows,
    errors,
    assistantName: assistantNames,
    userName: userNames,
    timestampRange: { first: timestamps[0], last: timestamps.at(-1) },
    assistantRows: rows.filter((row) => row.role === 'assistant').length,
    userRows: rows.filter((row) => row.role === 'user').length,
    systemRows: rows.filter((row) => row.role === 'system').length,
    swipeRows: rows.filter((row) => row.swipes.length > 0).length,
  };
}

function transcriptRole(row) {
  if (row.is_system === true || row.role === 'system') return 'system';
  if (row.is_user === true || row.role === 'user' || row.role === 'persona') return 'user';
  return 'assistant';
}

function mostCommon(values) {
  const counts = new Map();
  values.forEach((value) => counts.set(value, (counts.get(value) ?? 0) + 1));
  return [...counts.entries()].sort((left, right) => right[1] - left[1])[0]?.[0];
}

function fileStem(path) {
  const name = basename(path ?? '');
  return name.slice(0, Math.max(0, name.length - extname(name).length));
}

function strings(value) {
  return Array.isArray(value) ? value.filter((item) => typeof item === 'string' && item.length > 0) : [];
}

function firstString(...values) {
  return values.find((value) => typeof value === 'string' && value.trim() !== '')?.trim();
}

function finiteNumber(value) { return typeof value === 'number' && Number.isFinite(value) ? value : undefined; }
function isRecord(value) { return value !== null && typeof value === 'object' && !Array.isArray(value); }
