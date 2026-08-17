import { useEffect } from "react";
import { Portal } from "@/components/base/Portal";
import { PostComposer } from "@/components/community/PostComposer";
import type { CommunityPost } from "@/services/community/posts";

export function PostEditDialog({
  open,
  post,
  onClose,
  onEdited,
}: {
  open: boolean;
  post: CommunityPost;
  onClose: () => void;
  onEdited: (editedPost: CommunityPost) => void;
}) {
  useEffect(() => {
    if (!open) return;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <Portal>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Edit Post"
        className="fixed inset-0 z-[155] flex items-center justify-center bg-black/45 p-0 sm:p-6"
        onMouseDown={onClose}
      >
        <div
          className="h-full w-full sm:h-auto sm:max-w-[640px]"
          onMouseDown={(event) => event.stopPropagation()}
        >
          <PostComposer
            actor={post.actor}
            editingPost={post}
            defaultOpen
            onSaved={(editedPost) => {
              onEdited(editedPost);
              onClose();
            }}
            onCancelEdit={onClose}
          />
        </div>
      </div>
    </Portal>
  );
}
