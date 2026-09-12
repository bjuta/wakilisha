import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  Input,
  Label,
  TextField,
} from "react-aria-components";
import { Modal } from "./Modal";
import { WkButton } from "./Button";

interface DialogCopy {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
}

export interface WkConfirmOptions extends DialogCopy {
  destructive?: boolean;
}

export interface WkPromptOptions extends DialogCopy {
  label: string;
  initialValue?: string;
  placeholder?: string;
  required?: boolean;
  minLength?: number;
}

export interface WkAlertOptions extends Pick<DialogCopy, "title" | "message" | "confirmLabel"> {}

interface DialogApi {
  confirm: (options: WkConfirmOptions) => Promise<boolean>;
  prompt: (options: WkPromptOptions) => Promise<string | null>;
  alert: (options: WkAlertOptions) => Promise<void>;
}

type DialogRequest =
  | {
      id: number;
      kind: "confirm";
      options: WkConfirmOptions;
      resolve: (value: boolean) => void;
    }
  | {
      id: number;
      kind: "prompt";
      options: WkPromptOptions;
      resolve: (value: string | null) => void;
    }
  | {
      id: number;
      kind: "alert";
      options: WkAlertOptions;
      resolve: () => void;
    };

const DialogContext = createContext<DialogApi | null>(null);
let nextDialogId = 1;
let activeDialogApi: DialogApi | null = null;

function requireDialogApi(): DialogApi {
  if (!activeDialogApi) {
    throw new Error("WAKILISHA dialog authority is not mounted.");
  }
  return activeDialogApi;
}

export const wakilishaDialog: DialogApi = {
  confirm: (options) => requireDialogApi().confirm(options),
  prompt: (options) => requireDialogApi().prompt(options),
  alert: (options) => requireDialogApi().alert(options),
};

function PromptBody({
  request,
  onCancel,
  onConfirm,
}: {
  request: Extract<DialogRequest, { kind: "prompt" }>;
  onCancel: () => void;
  onConfirm: (value: string) => void;
}) {
  const {
    label,
    initialValue = "",
    placeholder,
    required = false,
    minLength,
    confirmLabel = "Continue",
    cancelLabel = "Cancel",
    message,
  } = request.options;
  const [value, setValue] = useState(initialValue);
  const trimmed = value.trim();
  const valid = (!required || trimmed.length > 0)
    && (minLength == null || trimmed.length >= minLength);

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (valid) onConfirm(value);
      }}
      className="space-y-4"
    >
      {message ? (
        <p className="text-sm leading-relaxed text-wk-text-muted">{message}</p>
      ) : null}
      <TextField
        value={value}
        onChange={setValue}
        isRequired={required}
        className="space-y-1.5"
      >
        <Label className="block text-xs font-black text-wk-text">{label}</Label>
        <Input
          autoFocus
          placeholder={placeholder}
          minLength={minLength}
          className="wk-input w-full rounded-xl border-wk-border bg-wk-surface text-[13px] text-wk-text"
        />
      </TextField>
      <div className="flex flex-wrap justify-end gap-2">
        <WkButton type="button" variant="ghost" onClick={onCancel}>
          {cancelLabel}
        </WkButton>
        <WkButton type="submit" disabled={!valid}>
          {confirmLabel}
        </WkButton>
      </div>
    </form>
  );
}

export function WakilishaDialogProvider({ children }: { children: ReactNode }) {
  const [queue, setQueue] = useState<DialogRequest[]>([]);
  const active = queue[0] ?? null;

  const enqueue = useCallback(<T,>(build: (resolve: (value: T) => void) => DialogRequest) => {
    return new Promise<T>((resolve) => {
      setQueue((current) => [...current, build(resolve)]);
    });
  }, []);

  const confirm = useCallback<DialogApi["confirm"]>(
    (options) => enqueue<boolean>((resolve) => ({
      id: nextDialogId++,
      kind: "confirm",
      options,
      resolve,
    })),
    [enqueue],
  );

  const prompt = useCallback<DialogApi["prompt"]>(
    (options) => enqueue<string | null>((resolve) => ({
      id: nextDialogId++,
      kind: "prompt",
      options,
      resolve,
    })),
    [enqueue],
  );

  const alert = useCallback<DialogApi["alert"]>(
    (options) => enqueue<void>((resolve) => ({
      id: nextDialogId++,
      kind: "alert",
      options,
      resolve,
    })),
    [enqueue],
  );

  const closeActive = useCallback(() => {
    setQueue((current) => current.slice(1));
  }, []);

  const cancelActive = useCallback(() => {
    if (!active) return;
    if (active.kind === "confirm") active.resolve(false);
    else if (active.kind === "prompt") active.resolve(null);
    else active.resolve();
    closeActive();
  }, [active, closeActive]);

  const api = useMemo<DialogApi>(() => ({ confirm, prompt, alert }), [alert, confirm, prompt]);

  useEffect(() => {
    activeDialogApi = api;
    return () => {
      if (activeDialogApi === api) activeDialogApi = null;
    };
  }, [api]);

  return (
    <DialogContext.Provider value={api}>
      {children}
      <Modal
        open={Boolean(active)}
        onClose={cancelActive}
        title={active?.options.title}
        maxWidth="sm"
      >
        {active?.kind === "confirm" ? (
          <div className="space-y-4">
            {active.options.message ? (
              <p className="whitespace-pre-line text-sm leading-relaxed text-wk-text-muted">
                {active.options.message}
              </p>
            ) : null}
            <div className="flex flex-wrap justify-end gap-2">
              <WkButton type="button" variant="ghost" onClick={cancelActive}>
                {active.options.cancelLabel ?? "Cancel"}
              </WkButton>
              <WkButton
                type="button"
                className={active.options.destructive ? "!bg-wk-danger !text-white" : ""}
                onClick={() => {
                  active.resolve(true);
                  closeActive();
                }}
              >
                {active.options.confirmLabel ?? "Continue"}
              </WkButton>
            </div>
          </div>
        ) : active?.kind === "prompt" ? (
          <PromptBody
            key={active.id}
            request={active}
            onCancel={cancelActive}
            onConfirm={(value) => {
              active.resolve(value);
              closeActive();
            }}
          />
        ) : active?.kind === "alert" ? (
          <div className="space-y-4">
            {active.options.message ? (
              <p className="whitespace-pre-line text-sm leading-relaxed text-wk-text-muted">
                {active.options.message}
              </p>
            ) : null}
            <div className="flex justify-end">
              <WkButton
                type="button"
                onClick={() => {
                  active.resolve();
                  closeActive();
                }}
              >
                {active.options.confirmLabel ?? "OK"}
              </WkButton>
            </div>
          </div>
        ) : null}
      </Modal>
    </DialogContext.Provider>
  );
}

export function useWakilishaDialog(): DialogApi {
  const value = useContext(DialogContext);
  if (!value) {
    throw new Error("useWakilishaDialog must be used inside WakilishaDialogProvider.");
  }
  return value;
}
