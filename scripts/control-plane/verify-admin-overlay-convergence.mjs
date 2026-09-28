#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const roots = [
  "src/pages/admin",
  "src/components/admin",
];

const semanticViewportOverlays = new Map([
  [
    "src/components/admin/AdminCommandPalette.tsx",
    "command palette is a distinct keyboard-first full-screen search interaction",
  ],
  [
    "src/components/admin/MediaPickerModal.tsx",
    "Media picker is a purpose-built large viewport workspace",
  ],
  [
    "src/components/admin/media/MediaEditModal.tsx",
    "Media editing is a purpose-built two-pane asset workspace",
  ],
  [
    "src/pages/admin/content/articles/detail/components/ArticlePreviewModal.tsx",
    "Article preview is a full-screen public-reading simulation",
  ],
  [
    "src/pages/admin/settings/email-briefings/components/IssuePreviewPanel.tsx",
    "Email preview is a full-screen desktop/mobile rendering simulator",
  ],
  [
    "src/pages/admin/content/articles/detail/ArticleEditorWorkspace.tsx",
    "Article saved-suggestion composition is editor-owned full-screen workspace state",
  ],
  [
    "src/pages/admin/content/articles/detail/components/ArticleWriteContextDrawer.tsx",
    "Article writing context is a purpose-built editor drawer already portaled",
  ],
  [
    "src/pages/admin/content/publishing/components/CreatePublishingItemDrawer.tsx",
    "Publishing creation is a purpose-built full-height workflow drawer already portaled",
  ],
  [
    "src/pages/admin/content/publishing/components/EditPublishingItemDrawer.tsx",
    "Publishing editing is a purpose-built full-height workflow drawer already portaled",
  ],
  [
    "src/pages/admin/content/playlists/detail/components/PlaylistDetailsDrawer.tsx",
    "Playlist details is a purpose-built editorial workspace drawer already portaled",
  ],
  [
    "src/pages/admin/institute/inquiry-interface/NativeInstituteInquiryInterface.tsx",
    "Institute inquiry is a full-screen domain workspace",
  ],
]);

const nonDialogViewportChrome = new Map([
  [
    "src/pages/admin/AdminShell.tsx",
    "mobile Admin navigation backdrop and sidebar",
  ],
  [
    "src/pages/admin/settings/AdminSettingsLayout.tsx",
    "mobile Settings navigation backdrop and sidebar",
  ],
  [
    "src/pages/admin/charts/AdminChartsLayout.tsx",
    "mobile Charts navigation backdrop and sidebar",
  ],
  [
    "src/pages/admin/registry/tracks/page.tsx",
    "card hover affordance and toast only",
  ],
  [
    "src/pages/admin/registry/releases/page.tsx",
    "card hover affordance and toast only",
  ],
  [
    "src/components/admin/media/MediaLibraryCore.tsx",
    "Media hover affordance and toast only",
  ],
]);

function walk(root) {
  if (!fs.existsSync(root)) return [];
  return fs.readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const next = path.join(root, entry.name);
    if (entry.isDirectory()) return walk(next);
    return /\.(?:tsx|jsx)$/.test(entry.name) ? [next] : [];
  });
}

function usesViewportPortal(source) {
  return (
    source.includes('from "@/components/base/Portal"')
    || source.includes('from "../../../components/base/Portal"')
    || source.includes("createPortal(")
  );
}

function looksLikeCustomOverlay(source) {
  if (!source.includes("fixed inset-0")) return false;

  return (
    /role=["'](?:dialog|alertdialog)["']/.test(source)
    || /aria-modal=["']true["']/.test(source)
    || /fixed inset-0[^"'\x60]{0,180}(?:items-center|items-end|items-start)[^"'\x60]{0,180}(?:justify-center|justify-end)/.test(source)
    || /(?:Modal|Dialog|Drawer)/.test(source)
  );
}

const failures = [];

for (const file of roots.flatMap(walk).sort()) {
  const source = fs.readFileSync(file, "utf8");

  if (!looksLikeCustomOverlay(source)) continue;

  if (nonDialogViewportChrome.has(file)) continue;

  if (semanticViewportOverlays.has(file)) {
    if (!usesViewportPortal(source)) {
      failures.push(
        `${file}: semantic viewport overlay must render through the shared document-body Portal (${semanticViewportOverlays.get(file)})`,
      );
    }
    continue;
  }

  failures.push(
    `${file}: modal/drawer geometry is locally owned; compose the shared Modal or Sheet primitive instead`,
  );
}

if (failures.length) {
  console.error("WAKILISHA_ADMIN_OVERLAY_CONVERGENCE_FAIL");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(
  `WAKILISHA_ADMIN_OVERLAY_CONVERGENCE_PASS semantic_exceptions=${semanticViewportOverlays.size} navigation_exceptions=${nonDialogViewportChrome.size}`,
);
