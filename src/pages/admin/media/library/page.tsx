import { MediaLibraryCore } from "@/components/admin/media/MediaLibraryCore";

export default function AdminMediaLibraryPage() {
  return (
    <div className="h-full flex flex-col">
      <MediaLibraryCore mode="library" />
    </div>
  );
}