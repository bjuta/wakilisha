# Legacy Institute freeze

The standalone Institute workspace is frozen.

## Product boundary

- It is removed from normal admin navigation.
- Existing direct routes remain temporarily available for legacy inspection and data recovery.
- No new feature, workflow, field, screen, service, or assistant behaviour may be added to the legacy Institute.
- Existing production data and routes are not deleted by this control-plane change.
- Deletion and archival of legacy code remain allowed when a later canonical replacement is ready.
- Existing legacy Institute UI files may receive narrow platform-maintenance changes only when the control plane proves that each modified file strictly reduces native browser-chrome debt without increasing any native-chrome debt class. This exception does not reopen Institute product development.

## Frozen paths

Authority-bearing paths remain deletion-only:

- `src/services/institute/`
- `supabase/functions/institute-assistant/`
- `test/institute/`

Legacy UI remains frozen against expansion:

- `src/pages/admin/institute/`

New, renamed or copied files beneath the legacy UI root fail the critical control-plane check. Modifications to existing UI files are permitted only for verified native browser-chrome debt reduction. Deletions remain permitted.

New inquiry capability will be implemented later inside canonical editorial and Registry workspaces according to the governing platform plan.
