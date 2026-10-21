export function isWk100PrivilegedReader(rows, at = Date.now()) {
  return Array.isArray(rows) && rows.some(row => row &&
    (row.role_key === 'super_admin' || row.role_key === 'administrator') &&
    row.status === 'active' &&
    (!row.expires_at || Date.parse(row.expires_at) > at));
}

export function makeWk100RestrictedPreview(input, audit) {
  if (input.dataset_mode !== 'synthetic' || audit.can_publish !== false) {
    throw new Error('wk100_preview_not_available');
  }
  return {
    status: 'synthetic_preview',
    week_start_eat: audit.week_start_eat,
    method_status: 'provisional',
    operator_count: audit.operator_count,
    behavior_count: audit.behavior_count,
    coverage_status: audit.coverage_status,
    recording_count: audit.recording_count,
    corroborated_top100: audit.corroborated_top100,
    failure_codes: audit.failures,
    entries: audit.top100.slice(0, 100).map(row => ({
      rank: row.position,
      recording_id: row.recording_id,
      corroborating_operators: row.operator_count,
    })),
    can_publish: false,
  };
}
