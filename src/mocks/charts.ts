import {
  buildChartEditionSummary,
  getChartSeriesSummaries,
  getLatestChartEdition,
  getLatestChartRows,
  hasImportedChartData,
} from '@/data/registry/registry';

const hasCharts = hasImportedChartData();
const latestEdition = getLatestChartEdition();

export const CHART_DATA = hasCharts ? getLatestChartRows() : [];
export const CHART_SERIES = hasCharts ? getChartSeriesSummaries() : [];
export const CHART_EDITION = buildChartEditionSummary(CHART_DATA, latestEdition ?? undefined);
export const NEW_ENTRIES = CHART_DATA.filter((entry) => entry.movement === 'new').slice(0, 12);
export const BIGGEST_MOVERS = CHART_DATA.filter((entry) => entry.movement === 'up').sort((a, b) => (b.movementAmount ?? 0) - (a.movementAmount ?? 0)).slice(0, 12);
