import { useCallback, useEffect, useMemo, useState } from "react";
import { WakilishaToggle } from "@/components/design-system/primitives/WakilishaToggle";
import {
  getMessagePreferences,
  updateMessagePreference,
  type FirstContactDisposition,
  type MessagePreference,
  type MessageSenderCategory,
} from "@/services/messages";

const ACTIVE_CATEGORIES = ["staff"] as const;

const CATEGORY_LABELS: Record<
  (typeof ACTIVE_CATEGORIES)[number],
  { title: string; note: string }
> = {
  staff: {
    title: "WAKILISHA staff",
    note: "Editors, reviewers, operators, and other authorized staff.",
  },
};

const DISPOSITIONS: Array<{ value: FirstContactDisposition; label: string }> = [
  { value: "inbox", label: "Inbox" },
  { value: "requests", label: "Requests" },
  { value: "reject", label: "Do not accept" },
];

export function MessagesSettingsPane() {
  const [policies, setPolicies] = useState<MessagePreference[]>([]);
  const [drafts, setDrafts] = useState<Record<string, MessagePreference>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const rows = await getMessagePreferences();
      setPolicies(rows);
      setDrafts(Object.fromEntries(rows.map((row) => [row.sender_category, row])));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load Messages privacy settings.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const dirty = useMemo(() => {
    const original = new Map(policies.map((row) => [row.sender_category, row]));
    return new Set(
      Object.values(drafts)
        .filter((draft) => JSON.stringify(draft) !== JSON.stringify(original.get(draft.sender_category)))
        .map((draft) => draft.sender_category),
    );
  }, [drafts, policies]);

  const patchDraft = (
    category: MessageSenderCategory,
    patch: Partial<MessagePreference>,
  ) => {
    setDrafts((current) => ({
      ...current,
      [category]: {
        ...current[category],
        ...patch,
      },
    }));
  };

  const save = async (category: MessageSenderCategory) => {
    const draft = drafts[category];
    if (!draft) return;
    setSaving(category);
    setError(null);
    try {
      const saved = await updateMessagePreference(draft);
      setPolicies((current) => current.map((row) => row.sender_category === category ? saved : row));
      setDrafts((current) => ({ ...current, [category]: saved }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save Messages privacy settings.");
      await load();
    } finally {
      setSaving(null);
    }
  };

  if (loading) {
    return (
      <div className="space-y-3" aria-busy="true" aria-label="Loading Messages privacy settings">
        {[0, 1, 2].map((item) => (
          <div key={item} className="h-36 animate-pulse rounded-2xl bg-[var(--wk-surface-raised)]" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-bg-subtle)] p-4">
        <div className="text-[13px] font-black text-[var(--wk-text)]">Who can reach you</div>
        <p className="mt-1 text-[11px] leading-relaxed text-[var(--wk-text-muted)]">
          These choices are enforced by the server. The platform audience can remain narrower than your preference.
        </p>
      </div>

      {error && (
        <div className="rounded-xl border border-[var(--wk-danger)]/30 bg-[var(--wk-danger)]/10 px-4 py-3 text-[12px] font-bold text-[var(--wk-danger)]">
          {error}
        </div>
      )}

      {ACTIVE_CATEGORIES.map((category) => {
        const draft = drafts[category];
        if (!draft) return null;
        const meta = CATEGORY_LABELS[category];
        const changed = dirty.has(category);
        return (
          <section key={category} className="rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-4 sm:p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-[14px] font-black text-[var(--wk-text)]">{meta.title}</h3>
                <p className="mt-1 text-[11px] leading-relaxed text-[var(--wk-text-muted)]">{meta.note}</p>
              </div>
              <span className="rounded-full bg-[var(--wk-surface-raised)] px-2.5 py-1 text-[10px] font-black tracking-[0.12em] text-[var(--wk-text-faint)]">
                rev {draft.revision}
              </span>
            </div>

            <div className="mt-4">
              <div className="mb-2 text-[10px] font-black tracking-[0.14em] text-[var(--wk-text-faint)]">First contact</div>
              <div className="grid grid-cols-3 gap-2" role="group" aria-label={`${meta.title} first-contact routing`}>
                {DISPOSITIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => patchDraft(category, { first_contact_disposition: option.value })}
                    className={`min-h-10 rounded-xl border px-2.5 py-2 text-[11px] font-black transition-colors ${
                      draft.first_contact_disposition === option.value
                        ? "border-[var(--wk-brand)] bg-[var(--wk-brand-soft)] text-[var(--wk-brand)]"
                        : "border-[var(--wk-border)] bg-[var(--wk-bg)] text-[var(--wk-text-muted)] hover:text-[var(--wk-text)]"
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-4 divide-y divide-[var(--wk-divider)] border-y border-[var(--wk-divider)]">
              {[
                ["Links", "Allow links in first-contact Messages from this category.", "allow_links"],
                ["Read receipts", "Let senders in this category see when you have read their Messages.", "show_read_receipts"],
              ].map(([title, note, key]) => (
                <div key={key} className="flex items-center justify-between gap-4 py-3.5">
                  <div className="min-w-0 flex-1">
                    <div className="text-[12px] font-black text-[var(--wk-text)]">{title}</div>
                    <div className="mt-0.5 text-[10px] leading-relaxed text-[var(--wk-text-muted)]">{note}</div>
                  </div>
                  <WakilishaToggle
                    value={Boolean(draft[key as keyof MessagePreference])}
                    onChange={(value) => patchDraft(category, { [key]: value } as Partial<MessagePreference>)}
                  />
                </div>
              ))}
            </div>

            <div className="mt-4 flex items-center justify-between gap-3">
              <span className={`text-[10px] font-bold ${changed ? "text-[var(--wk-warning)]" : "text-[var(--wk-text-faint)]"}`}>
                {changed ? "Unsaved Messages changes" : "Up to date"}
              </span>
              <button
                type="button"
                disabled={!changed || saving === category}
                onClick={() => void save(category)}
                className="wk-button wk-button-sm wk-button-primary disabled:cursor-not-allowed disabled:opacity-45"
              >
                {saving === category ? "Saving..." : "Save"}
              </button>
            </div>
          </section>
        );
      })}
    </div>
  );
}
