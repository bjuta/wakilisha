# Legacy Institute freeze

The standalone Institute workspace is frozen.

## Product boundary

- It is removed from normal admin navigation.
- Existing direct routes remain temporarily available for legacy inspection and data recovery.
- No new feature, workflow, field, screen, service, or assistant behaviour may be added to the legacy Institute.
- Existing production data and routes are not deleted by this control-plane change.
- Deletion and archival of legacy code remain allowed when a later canonical replacement is ready.

## Frozen paths

- `src/pages/admin/institute/`
- `src/services/institute/`
- `supabase/functions/institute-assistant/`
- `test/institute/`

Pull requests that add or modify files beneath these paths fail the critical control-plane check. Deletions remain permitted.

New inquiry capability will be implemented later inside canonical editorial and Registry workspaces according to the governing platform plan.
