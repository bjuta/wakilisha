import { useEffect, useMemo, useState } from "react";
import {
  PUBLISHING_ASSIGNMENT_ROLES,
  addPublishingItemAssignee,
  addPublishingItemChannel,
  listPublishingAssignableUsers,
  removePublishingItemAssignee,
  removePublishingItemChannel,
  setPublishingItemPrimaryChannel,
  type PublishingAssignableUser,
  type PublishingAssignmentRole,
  type PublishingChannel,
  type PublishingMutationResult,
  type PublishingWorkspaceItem,
} from "@/services/publishing/publishingWorkspaceService";

interface PublishingRelationshipsSectionProps {
  item: PublishingWorkspaceItem;
  channels: PublishingChannel[];
  disabled: boolean;
  onBusyChange: (busy: boolean) => void;
  onReloadLatest: (itemId: string) => Promise<void>;
}

const ASSIGNMENT_ROLE_OPTIONS = PUBLISHING_ASSIGNMENT_ROLES.filter(
  (role) => role !== "owner",
);

function formatChoice(value: string): string {
  return value
    .split("_")
    .map((part) =>
      part.length > 0 ? `${part[0].toUpperCase()}${part.slice(1)}` : part,
    )
    .join(" ");
}

export function PublishingRelationshipsSection({
  item,
  channels,
  disabled,
  onBusyChange,
  onReloadLatest,
}: PublishingRelationshipsSectionProps) {
  const [assignableUsers, setAssignableUsers] = useState<
    PublishingAssignableUser[]
  >([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [userQuery, setUserQuery] = useState("");
  const [assigneeUserId, setAssigneeUserId] = useState("");
  const [assignmentRole, setAssignmentRole] =
    useState<PublishingAssignmentRole>("writer");
  const [channelKey, setChannelKey] = useState("");
  const [channelPrimary, setChannelPrimary] = useState(
    item.channels.length === 0,
  );
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    setLoadingUsers(true);

    void listPublishingAssignableUsers()
      .then((users) => {
        if (active) {
          setAssignableUsers(users);
        }
      })
      .catch((loadError) => {
        if (active) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "We could not load the Publishing team.",
          );
        }
      })
      .finally(() => {
        if (active) {
          setLoadingUsers(false);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    setChannelPrimary(item.channels.length === 0);
  }, [item.channels.length, item.id]);

  const availableUsers = useMemo(() => {
    const query = userQuery.trim().toLowerCase();

    return assignableUsers.filter((user) => {
      const assignmentExists = item.assignees.some(
        (assignee) =>
          assignee.userId === user.userId && assignee.role === assignmentRole,
      );

      if (assignmentExists) {
        return false;
      }

      if (!query) {
        return true;
      }

      return [user.label, user.email ?? "", ...user.roleLabels]
        .join(" ")
        .toLowerCase()
        .includes(query);
    });
  }, [assignableUsers, assignmentRole, item.assignees, userQuery]);

  const availableChannels = useMemo(
    () =>
      channels.filter(
        (channel) =>
          !item.channels.some((attached) => attached.key === channel.key),
      ),
    [channels, item.channels],
  );

  useEffect(() => {
    if (
      assigneeUserId &&
      !availableUsers.some((user) => user.userId === assigneeUserId)
    ) {
      setAssigneeUserId("");
    }
  }, [assigneeUserId, availableUsers]);

  useEffect(() => {
    if (
      channelKey &&
      !availableChannels.some((channel) => channel.key === channelKey)
    ) {
      setChannelKey("");
    }
  }, [availableChannels, channelKey]);

  async function runMutation(
    actionKey: string,
    request: () => Promise<PublishingMutationResult>,
    successMessage: string,
  ): Promise<boolean> {
    setBusyAction(actionKey);
    setError(null);
    setNotice(null);
    onBusyChange(true);

    try {
      const result = await request();

      if (!result.ok) {
        if (result.errorCode === "stale_update") {
          await onReloadLatest(item.id);
          setError(
            `${
              result.error ?? "Someone changed this Publishing item."
            } We loaded the latest values.`,
          );
        } else {
          setError(result.error ?? "We could not change this Publishing item.");
        }

        return false;
      }

      await onReloadLatest(item.id);
      setNotice(successMessage);

      return true;
    } catch (mutationError) {
      setError(
        mutationError instanceof Error
          ? mutationError.message
          : "We could not change this Publishing item.",
      );

      return false;
    } finally {
      setBusyAction(null);
      onBusyChange(false);
    }
  }

  async function handleAddAssignee() {
    if (!assigneeUserId) {
      setError("Choose a person to assign.");
      return;
    }

    const succeeded = await runMutation(
      "add-assignee",
      () =>
        addPublishingItemAssignee({
          itemId: item.id,
          expectedRecordVersion: item.recordVersion,
          userId: assigneeUserId,
          assignmentRole,
        }),
      "We added the assignment.",
    );

    if (succeeded) {
      setAssigneeUserId("");
      setUserQuery("");
    }
  }

  async function handleRemoveAssignee(
    userId: string,
    role: PublishingAssignmentRole,
  ) {
    await runMutation(
      `remove-assignee:${userId}:${role}`,
      () =>
        removePublishingItemAssignee({
          itemId: item.id,
          expectedRecordVersion: item.recordVersion,
          userId,
          assignmentRole: role,
        }),
      "We removed the assignment.",
    );
  }

  async function handleAddChannel() {
    if (!channelKey) {
      setError("Choose a channel to add.");
      return;
    }

    const succeeded = await runMutation(
      "add-channel",
      () =>
        addPublishingItemChannel({
          itemId: item.id,
          expectedRecordVersion: item.recordVersion,
          channelKey,
          isPrimary: channelPrimary,
        }),
      "We added the channel.",
    );

    if (succeeded) {
      setChannelKey("");
      setChannelPrimary(false);
    }
  }

  async function handleRemoveChannel(selectedChannelKey: string) {
    await runMutation(
      `remove-channel:${selectedChannelKey}`,
      () =>
        removePublishingItemChannel({
          itemId: item.id,
          expectedRecordVersion: item.recordVersion,
          channelKey: selectedChannelKey,
        }),
      "We removed the channel.",
    );
  }

  async function handleSetPrimary(selectedChannelKey: string) {
    await runMutation(
      `primary-channel:${selectedChannelKey}`,
      () =>
        setPublishingItemPrimaryChannel({
          itemId: item.id,
          expectedRecordVersion: item.recordVersion,
          channelKey: selectedChannelKey,
        }),
      "We updated the primary channel.",
    );
  }

  const controlsDisabled = disabled || busyAction !== null;

  return (
    <div className="space-y-4">
      {error ? (
        <div className="rounded-xl border border-wk-danger/30 bg-wk-danger-soft px-3 py-2.5 text-[11px] leading-5 text-wk-danger">
          {error}
        </div>
      ) : null}

      {notice ? (
        <div className="rounded-xl border border-wk-success/30 bg-wk-success-soft px-3 py-2.5 text-[11px] leading-5 text-wk-success">
          {notice}
        </div>
      ) : null}

      <section className="space-y-4 rounded-xl border border-wk-border bg-wk-surface-raised p-4">
        <div>
          <h3 className="text-[12px] font-black text-wk-text">Team</h3>
          <p className="mt-1 text-[11px] leading-4 text-wk-text-muted">
            Assign internal production roles. The item owner remains separate.
          </p>
        </div>

        <div className="space-y-2">
          {item.assignees.length > 0 ? (
            item.assignees.map((assignee) => {
              const actionKey = `remove-assignee:${assignee.userId}:${assignee.role}`;

              return (
                <div
                  key={`${assignee.userId}:${assignee.role}`}
                  className="flex items-center justify-between gap-3 rounded-lg border border-wk-border bg-wk-surface px-3 py-2"
                >
                  <div className="min-w-0">
                    <div className="truncate text-[12px] font-bold text-wk-text">
                      {assignee.label}
                    </div>
                    <div className="mt-0.5 text-[10px] text-wk-text-muted">
                      {formatChoice(assignee.role)}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      void handleRemoveAssignee(assignee.userId, assignee.role)
                    }
                    disabled={controlsDisabled}
                    className="wk-button wk-button-ghost wk-button-sm shrink-0 justify-center text-wk-danger disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {busyAction === actionKey ? "Removing" : "Remove"}
                  </button>
                </div>
              );
            })
          ) : (
            <p className="text-[11px] leading-4 text-wk-text-muted">
              This item has no production roles yet.
            </p>
          )}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="text-[11px] font-bold text-wk-text">
              Find Person
            </span>
            <input
              value={userQuery}
              onChange={(event) => {
                setUserQuery(event.target.value);
                setError(null);
              }}
              disabled={controlsDisabled}
              placeholder="Search by name, email, or role"
              className="mt-2 w-full rounded-xl border border-wk-border bg-wk-surface px-3 py-2.5 text-[12px] text-wk-text outline-none placeholder:text-wk-text-faint focus:border-wk-brand disabled:opacity-60"
            />
          </label>

          <label className="block">
            <span className="text-[11px] font-bold text-wk-text">
              Production Role
            </span>
            <select
              value={assignmentRole}
              onChange={(event) => {
                setAssignmentRole(
                  event.target.value as PublishingAssignmentRole,
                );
                setError(null);
              }}
              disabled={controlsDisabled}
              className="mt-2 w-full rounded-xl border border-wk-border bg-wk-surface px-3 py-2.5 text-[12px] text-wk-text outline-none focus:border-wk-brand disabled:opacity-60"
            >
              {ASSIGNMENT_ROLE_OPTIONS.map((role) => (
                <option key={role} value={role}>
                  {formatChoice(role)}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="block">
          <span className="text-[11px] font-bold text-wk-text">Person</span>
          <select
            value={assigneeUserId}
            onChange={(event) => {
              setAssigneeUserId(event.target.value);
              setError(null);
            }}
            disabled={
              controlsDisabled || loadingUsers || availableUsers.length === 0
            }
            className="mt-2 w-full rounded-xl border border-wk-border bg-wk-surface px-3 py-2.5 text-[12px] text-wk-text outline-none focus:border-wk-brand disabled:opacity-60"
          >
            <option value="">
              {loadingUsers
                ? "Loading Team"
                : availableUsers.length === 0
                  ? "No Matching Team Members"
                  : "Choose Team Member"}
            </option>

            {availableUsers.map((user) => (
              <option key={user.userId} value={user.userId}>
                {user.label}
                {user.email && user.email !== user.label
                  ? ` (${user.email})`
                  : ""}
              </option>
            ))}
          </select>
        </label>

        <button
          type="button"
          onClick={() => void handleAddAssignee()}
          disabled={controlsDisabled || !assigneeUserId}
          className="wk-button wk-button-secondary wk-button-sm w-full justify-center disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busyAction === "add-assignee"
            ? "Adding Assignment"
            : "Add Assignment"}
        </button>
      </section>

      <section className="space-y-4 rounded-xl border border-wk-border bg-wk-surface-raised p-4">
        <div>
          <h3 className="text-[12px] font-black text-wk-text">Channels</h3>
          <p className="mt-1 text-[11px] leading-4 text-wk-text-muted">
            Record intended distribution. This does not publish or schedule
            content.
          </p>
        </div>

        <div className="space-y-2">
          {item.channels.length > 0 ? (
            item.channels.map((channel) => (
              <div
                key={channel.key}
                className="rounded-lg border border-wk-border bg-wk-surface px-3 py-2"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[12px] font-bold text-wk-text">
                        {channel.label}
                      </span>

                      {channel.isPrimary ? (
                        <span className="rounded-full border border-wk-brand/30 bg-wk-brand-soft px-2 py-0.5 text-[9px] font-black text-wk-brand">
                          Primary
                        </span>
                      ) : null}
                    </div>
                  </div>

                  <div className="flex shrink-0 flex-wrap justify-end gap-1.5">
                    {!channel.isPrimary ? (
                      <button
                        type="button"
                        onClick={() => void handleSetPrimary(channel.key)}
                        disabled={controlsDisabled}
                        className="wk-button wk-button-ghost wk-button-sm justify-center disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {busyAction === `primary-channel:${channel.key}`
                          ? "Updating"
                          : "Make Primary"}
                      </button>
                    ) : null}

                    <button
                      type="button"
                      onClick={() => void handleRemoveChannel(channel.key)}
                      disabled={controlsDisabled}
                      className="wk-button wk-button-ghost wk-button-sm justify-center text-wk-danger disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {busyAction === `remove-channel:${channel.key}`
                        ? "Removing"
                        : "Remove"}
                    </button>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <p className="text-[11px] leading-4 text-wk-text-muted">
              This item has no distribution channels yet.
            </p>
          )}
        </div>

        <label className="block">
          <span className="text-[11px] font-bold text-wk-text">
            Add Channel
          </span>
          <select
            value={channelKey}
            onChange={(event) => {
              setChannelKey(event.target.value);
              setError(null);
            }}
            disabled={controlsDisabled || availableChannels.length === 0}
            className="mt-2 w-full rounded-xl border border-wk-border bg-wk-surface px-3 py-2.5 text-[12px] text-wk-text outline-none focus:border-wk-brand disabled:opacity-60"
          >
            <option value="">
              {availableChannels.length === 0
                ? "No Channels Left To Add"
                : "Choose Channel"}
            </option>

            {availableChannels.map((channel) => (
              <option key={channel.key} value={channel.key}>
                {channel.label}
              </option>
            ))}
          </select>
        </label>

        <label className="flex items-start gap-2 rounded-lg border border-wk-border bg-wk-surface px-3 py-2.5">
          <input
            type="checkbox"
            checked={channelPrimary}
            onChange={(event) => setChannelPrimary(event.target.checked)}
            disabled={controlsDisabled}
            className="mt-0.5"
          />
          <span>
            <span className="block text-[11px] font-bold text-wk-text">
              Make Primary
            </span>
            <span className="mt-0.5 block text-[10px] leading-4 text-wk-text-muted">
              A primary channel is the main planned destination for this work.
            </span>
          </span>
        </label>

        <button
          type="button"
          onClick={() => void handleAddChannel()}
          disabled={controlsDisabled || !channelKey}
          className="wk-button wk-button-secondary wk-button-sm w-full justify-center disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busyAction === "add-channel" ? "Adding Channel" : "Add Channel"}
        </button>
      </section>
    </div>
  );
}
