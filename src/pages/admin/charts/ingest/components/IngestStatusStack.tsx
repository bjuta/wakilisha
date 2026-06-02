import { StatusBanner } from "./StatusBanner";

type IngestStatusStackProps = {
  formError: string | null;
  successMessage: string | null;
  editionExistsWarning: string | null;
};

export function IngestStatusStack({ formError, successMessage, editionExistsWarning }: IngestStatusStackProps) {
  return (
    <>
      {formError && <StatusBanner tone="danger" icon="AlertCircle" message={formError} />}
      {successMessage && <StatusBanner tone="success" icon="CheckCircle2" message={successMessage} />}
      {editionExistsWarning && <StatusBanner tone="warning" icon="AlertTriangle" message={editionExistsWarning} />}
    </>
  );
}
