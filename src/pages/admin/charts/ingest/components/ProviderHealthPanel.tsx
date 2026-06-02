import { AlertTriangle } from "lucide-react";
import { WkSurface } from "@/components/design-system/primitives/Surface";
import { getIngestionMode } from "@/services/chartsIngestion/client";

export function ProviderHealthPanel() {
  const mode = getIngestionMode();
  const hasSpotify = !!import.meta.env.VITE_SPOTIFY_CLIENT_ID;
  const hasApple = !!import.meta.env.VITE_APPLE_MUSIC_DEVELOPER_TOKEN;

  const services = [
    { name: "Spotify API", ok: mode === "mock" || hasSpotify, hint: mode === "mock" ? "Mocked" : hasSpotify ? "Connected" : "Missing credentials" },
    { name: "Apple Music", ok: mode === "mock" || hasApple, hint: mode === "mock" ? "Mocked" : hasApple ? "Connected" : "Missing token" },
    { name: "Registry DB", ok: true, hint: "LocalStorage store" },
    { name: "Ingest Mode", ok: true, hint: mode === "mock" ? "Mock (dev)" : "WordPress (prod)" },
  ];

  return (
    <WkSurface className="p-4">
      <h2 className="mb-3 text-[14px] font-bold text-wk-text">Provider Health</h2>
      <div className="space-y-2">
        {services.map((svc) => (
          <div key={svc.name} className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className={`inline-block h-2 w-2 rounded-full ${svc.ok ? "bg-wk-success" : "bg-wk-danger"}`} />
              <span className="text-[12px] text-wk-text-soft">{svc.name}</span>
            </div>
            <span className={`text-[11px] font-semibold ${svc.ok ? "text-wk-success" : "text-wk-danger"}`}>{svc.hint}</span>
          </div>
        ))}
      </div>
    </WkSurface>
  );
}