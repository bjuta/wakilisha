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
      <h2 className="mb-3 text-[14px] font-bold text-foreground-950">Provider Health</h2>
      <div className="space-y-2">
        {services.map((svc) => (
          <div key={svc.name} className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className={`inline-block h-2 w-2 rounded-full ${svc.ok ? "bg-green-500" : "bg-red-500"}`} />
              <span className="text-[12px] text-foreground-700">{svc.name}</span>
            </div>
            <span className={`text-[11px] font-semibold ${svc.ok ? "text-green-600" : "text-red-600"}`}>{svc.hint}</span>
          </div>
        ))}
      </div>
    </WkSurface>
  );
}