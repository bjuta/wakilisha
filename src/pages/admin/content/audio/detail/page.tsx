import { useParams } from "react-router-dom";
import { AudioEditorWorkspace } from "./AudioEditorWorkspace";

export default function AdminAudioDetailPage() {
  const { publicationId } = useParams<{ publicationId: string }>();
  return <AudioEditorWorkspace publicationId={publicationId} />;
}
