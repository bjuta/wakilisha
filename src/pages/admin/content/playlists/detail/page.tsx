import { useParams } from "react-router-dom";
import { PlaylistEditorWorkspace } from "./PlaylistEditorWorkspace";

export default function AdminPlaylistDetailPage() {
  const { playlistId } = useParams<{ playlistId: string }>();
  return <PlaylistEditorWorkspace playlistId={playlistId} />;
}
