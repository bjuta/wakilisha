import { DEFAULT_CHART_METHODOLOGIES, getDefaultMethodology } from "./defaultMethodologies";
import type { ChartMethodology } from "./methodologyTypes";

const METHODOLOGY_STORE_KEY = "wkcharts_methodologies_v1";

type MethodologyStore = {
  methodologies: ChartMethodology[];
};

function defaultStore(): MethodologyStore {
  return { methodologies: DEFAULT_CHART_METHODOLOGIES };
}

function readStore(): MethodologyStore {
  if (typeof window === "undefined") return defaultStore();
  try {
    const raw = localStorage.getItem(METHODOLOGY_STORE_KEY);
    if (!raw) return defaultStore();
    const parsed = JSON.parse(raw) as Partial<MethodologyStore>;
    if (!Array.isArray(parsed.methodologies)) return defaultStore();
    const versions = new Set(parsed.methodologies.map((methodology) => methodology.version));
    const missingDefaults = DEFAULT_CHART_METHODOLOGIES.filter((methodology) => !versions.has(methodology.version));
    return { methodologies: [...parsed.methodologies, ...missingDefaults] };
  } catch {
    return defaultStore();
  }
}

function writeStore(store: MethodologyStore): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(METHODOLOGY_STORE_KEY, JSON.stringify(store));
}

export function listChartMethodologies(): ChartMethodology[] {
  return readStore().methodologies;
}

export function getChartMethodology(version = "top_songs_weighted_v1"): ChartMethodology {
  return listChartMethodologies().find((methodology) => methodology.version === version || methodology.id === version) ?? getDefaultMethodology(version);
}

export function saveChartMethodology(methodology: ChartMethodology): ChartMethodology {
  const store = readStore();
  const next = { ...methodology, updatedAt: new Date().toISOString() };
  const index = store.methodologies.findIndex((item) => item.id === next.id || item.version === next.version);
  if (index >= 0) store.methodologies[index] = next;
  else store.methodologies.push(next);
  writeStore(store);
  return next;
}

export function resetChartMethodologyStore(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(METHODOLOGY_STORE_KEY);
}

export function validateMethodologyWeights(methodology: ChartMethodology): { ok: boolean; totalPositiveWeight: number; warnings: string[] } {
  const totalPositiveWeight = methodology.components
    .filter((component) => component.enabled && component.direction === "positive")
    .reduce((sum, component) => sum + Math.max(0, component.weight), 0);
  const warnings: string[] = [];
  if (totalPositiveWeight <= 0) warnings.push("At least one positive scoring component must be enabled with weight above zero.");
  if (Math.abs(totalPositiveWeight - 1) > 0.001) warnings.push(`Positive weights currently total ${totalPositiveWeight.toFixed(3)}. The engine will normalize them at scoring time.`);
  return { ok: totalPositiveWeight > 0, totalPositiveWeight, warnings };
}
