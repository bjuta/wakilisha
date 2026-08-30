import { useParams } from "react-router-dom";
import { VideoEditorWorkspace } from "./VideoEditorWorkspace";

export default function AdminVideoDetailPage() {
  const { publicationId } = useParams<{ publicationId: string }>();
  return <VideoEditorWorkspace publicationId={publicationId} />;
}
