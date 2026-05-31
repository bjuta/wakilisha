/**
 * CSV Chart Discovery Script
 * Scans data/supabase-imports/2026-05-30/raw/ for CSV files,
 * identifies likely chart CSVs by filename and headers,
 * and generates discovery reports.
 *
 * Usage: npm run charts:discover-csvs
 */
import { createReadStream, mkdirSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import path from "node:path";
import { parse } from "csv-parse";

const IMPORT_DIR = "data/supabase-imports/2026-05-30/raw";
const REPORT_DIR = "data/charts-import/reports";
const TS_OUTPUT = "src/services/chartsIngestion/csv/discoveredChartCsvs.ts";

// Known chart-relevant column names (case-insensitive)
const CHART_COLUMN_PATTERNS = [
  "rank",
  "position",
  "chart",
  "chart_name",
  "chart_week",
  "chart_date",
  "track",
  "track_title",
  "title",
  "artist",
  "artist_name",
  "release",
  "album",
  "isrc",
  "spotify_url",
  "youtube_url",
  "apple_music_url",
  "artwork_url",
];

interface DiscoveredCsv {
  filename: string;
  filepath: string;
  detectedChartType: string;
  confidence: "high" | "medium" | "low";
  rowCount: number;
  headers: string[];
  sampleRows: Record<string, string>[];
  detectedDate: string | null;
  detectedWeek: string | null;
  mappingStatus: "mapped" | "partial" | "unmapped";
  validationStatus: "valid" | "warnings" | "errors";
  validationIssues: string[];
  mappedFields: Record<string, string>;
  sourceSize: number;
}

interface CsvReport {
  discoveredAt: string;
  scanDir: string;
  totalFiles: number;
  chartCsvs: number;
  files: DiscoveredCsv[];
}

function detectChartType(filename: string, headers: string[]): string {
  const lowerName = filename.toLowerCase();
  const lowerHeaders = headers.map((h) => h.toLowerCase());

  if (lowerName.includes("top_40") || lowerName.includes("top40") || lowerName.includes("top-40")) return "top_40";
  if (lowerName.includes("top_100") || lowerName.includes("top100") || lowerName.includes("top-100")) return "top_100";
  if (lowerName.includes("afrobeats")) return "afrobeats";
  if (lowerName.includes("afropop")) return "afropop";
  if (lowerName.includes("gospel")) return "gospel";
  if (lowerName.includes("hiphop") || lowerName.includes("hip-hop") || lowerName.includes("hip_hop")) return "hiphop";
  if (lowerName.includes("rnb") || lowerName.includes("r&b") || lowerName.includes("r_b")) return "rnb";
  if (lowerName.includes("reggae")) return "reggae";
  if (lowerName.includes("dancehall")) return "dancehall";
  if (lowerName.includes("gospel")) return "gospel";

  if (lowerHeaders.includes("rank") || lowerHeaders.includes("position")) return "generic_ranked";
  if (lowerHeaders.includes("chart") || lowerHeaders.includes("chart_name")) return "generic_chart";

  return "unknown";
}

function detectConfidence(headers: string[]): "high" | "medium" | "low" {
  const lowerHeaders = headers.map((h) => h.toLowerCase());
  const matches = CHART_COLUMN_PATTERNS.filter((p) => lowerHeaders.includes(p)).length;
  if (matches >= 5) return "high";
  if (matches >= 3) return "medium";
  return "low";
}

function detectDateFromFilename(filename: string): string | null {
  const dateMatch = filename.match(/(\d{4}-\d{2}-\d{2})/);
  if (dateMatch) return dateMatch[1];

  const weekMatch = filename.match(/(202\d-w?\d{2})/i);
  if (weekMatch) return weekMatch[1];

  return null;
}

function detectWeekFromFilename(filename: string): string | null {
  const weekMatch = filename.match(/(202\d-w\d{2})/i);
  if (weekMatch) return weekMatch[1];
  return null;
}

function computeMappingStatus(headers: string[]): { status: "mapped" | "partial" | "unmapped"; mappedFields: Record<string, string> } {
  const lowerHeaders = headers.map((h) => h.toLowerCase());
  const mappedFields: Record<string, string> = {};

  const mappings: Record<string, string[]> = {
    rank: ["rank", "position"],
    title: ["track", "track_title", "title"],
    artist_line: ["artist", "artist_name"],
    isrc: ["isrc"],
    release_title: ["release", "album"],
    spotify_url: ["spotify_url"],
    youtube_url: ["youtube_url"],
    apple_music_url: ["apple_music_url"],
    artwork_url: ["artwork_url"],
    chart_date: ["chart_date", "chart_week"],
  };

  for (const [field, candidates] of Object.entries(mappings)) {
    for (const candidate of candidates) {
      const idx = lowerHeaders.indexOf(candidate);
      if (idx >= 0) {
        mappedFields[field] = headers[idx];
        break;
      }
    }
  }

  const mappedCount = Object.keys(mappedFields).length;
  const status = mappedCount >= 5 ? "mapped" : mappedCount >= 2 ? "partial" : "unmapped";
  return { status, mappedFields };
}

function validateCsv(headers: string[], rows: Record<string, string>[]): { status: "valid" | "warnings" | "errors"; issues: string[] } {
  const issues: string[] = [];
  const lowerHeaders = headers.map((h) => h.toLowerCase());

  const hasRank = lowerHeaders.includes("rank") || lowerHeaders.includes("position");
  const hasTitle = lowerHeaders.includes("title") || lowerHeaders.includes("track") || lowerHeaders.includes("track_title");
  const hasArtist = lowerHeaders.includes("artist") || lowerHeaders.includes("artist_name");

  if (!hasRank) issues.push("Missing rank/position column");
  if (!hasTitle) issues.push("Missing title/track column");
  if (!hasArtist) issues.push("Missing artist column");

  // Check for missing values in required columns
  let missingTitles = 0;
  let missingArtists = 0;
  let duplicateRows = 0;
  const seenHashes = new Set<string>();

  for (const row of rows) {
    const title = row[headers.find((h) => ["title", "track", "track_title"].includes(h.toLowerCase())) ?? ""];
    const artist = row[headers.find((h) => ["artist", "artist_name"].includes(h.toLowerCase())) ?? ""];
    if (!title || title.trim() === "") missingTitles++;
    if (!artist || artist.trim() === "") missingArtists++;

    const hash = JSON.stringify(row);
    if (seenHashes.has(hash)) duplicateRows++;
    seenHashes.add(hash);
  }

  if (missingTitles > 0) issues.push(`${missingTitles} rows missing title`);
  if (missingArtists > 0) issues.push(`${missingArtists} rows missing artist`);
  if (duplicateRows > 0) issues.push(`${duplicateRows} duplicate rows`);

  if (issues.length === 0) return { status: "valid", issues: [] };
  if (missingTitles > 0 || missingArtists > 0 || !hasRank) return { status: "errors", issues };
  return { status: "warnings", issues };
}

async function parseCsvFile(filepath: string): Promise<{ headers: string[]; rows: Record<string, string>[]; count: number }> {
  const rows: Record<string, string>[] = [];
  const headers: string[] = [];

  return new Promise((resolve, reject) => {
    createReadStream(filepath)
      .pipe(parse({ columns: true, skip_empty_lines: true }))
      .on("headers", (h: string[]) => {
        headers.push(...h);
      })
      .on("data", (row: Record<string, string>) => {
        if (rows.length < 5) {
          rows.push(row);
        }
      })
      .on("end", () => {
        resolve({ headers, rows, count: rows.length });
      })
      .on("error", reject);
  });
}

async function scanDirectory(dir: string): Promise<DiscoveredCsv[]> {
  const files = readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".csv"))
    .map((entry) => entry.name);

  const discovered: DiscoveredCsv[] = [];

  for (const filename of files) {
    const filepath = path.join(dir, filename);
    console.log(`Scanning ${filename}...`);

    try {
      const { headers, rows, count } = await parseCsvFile(filepath);
      const chartType = detectChartType(filename, headers);
      const confidence = detectConfidence(headers);
      const detectedDate = detectDateFromFilename(filename);
      const detectedWeek = detectWeekFromFilename(filename);
      const { status, mappedFields } = computeMappingStatus(headers);
      const { status: validationStatus, issues } = validateCsv(headers, rows);
      const stats = await import("node:fs/promises").then((fs) => fs.stat(filepath));

      discovered.push({
        filename,
        filepath,
        detectedChartType: chartType,
        confidence,
        rowCount: count,
        headers,
        sampleRows: rows,
        detectedDate,
        detectedWeek,
        mappingStatus: status,
        validationStatus,
        validationIssues: issues,
        mappedFields,
        sourceSize: stats.size,
      });
    } catch (err) {
      console.error(`Error parsing ${filename}:`, err);
      discovered.push({
        filename,
        filepath,
        detectedChartType: "error",
        confidence: "low",
        rowCount: 0,
        headers: [],
        sampleRows: [],
        detectedDate: null,
        detectedWeek: null,
        mappingStatus: "unmapped",
        validationStatus: "errors",
        validationIssues: [String(err)],
        mappedFields: {},
        sourceSize: 0,
      });
    }
  }

  return discovered;
}

function generateJsonReport(discovered: DiscoveredCsv[]): string {
  const report: CsvReport = {
    discoveredAt: new Date().toISOString(),
    scanDir: IMPORT_DIR,
    totalFiles: discovered.length,
    chartCsvs: discovered.filter((d) => d.confidence !== "low").length,
    files: discovered,
  };
  return JSON.stringify(report, null, 2);
}

function generateMarkdownReport(discovered: DiscoveredCsv[]): string {
  const lines = [
    "# CSV Chart Discovery Report",
    "",
    `Generated: ${new Date().toISOString()}`,
    `Scan directory: \`${IMPORT_DIR}\``,
    `Total CSV files: ${discovered.length}`,
    `Likely chart CSVs: ${discovered.filter((d) => d.confidence !== "low").length}`,
    "",
    "---",
    "",
  ];

  for (const csv of discovered) {
    lines.push(`## ${csv.filename}`);
    lines.push("");
    lines.push(`- **Chart type**: ${csv.detectedChartType}`);
    lines.push(`- **Confidence**: ${csv.confidence}`);
    lines.push(`- **Row count**: ${csv.rowCount}`);
    lines.push(`- **Detected date**: ${csv.detectedDate ?? "—"}`);
    lines.push(`- **Detected week**: ${csv.detectedWeek ?? "—"}`);
    lines.push(`- **Mapping status**: ${csv.mappingStatus}`);
    lines.push(`- **Validation status**: ${csv.validationStatus}`);
    lines.push(`- **Headers**: ${csv.headers.length > 0 ? csv.headers.join(", ") : "N/A"}`);
    if (csv.validationIssues.length > 0) {
      lines.push(`- **Validation issues**: ${csv.validationIssues.join("; ")}`);
    }
    lines.push("");
    if (csv.sampleRows.length > 0) {
      lines.push("### Sample rows");
      lines.push("");
      lines.push("| " + csv.headers.join(" | ") + " |");
      lines.push("| " + csv.headers.map(() => "---").join(" | ") + " |");
      for (const row of csv.sampleRows) {
        lines.push("| " + csv.headers.map((h) => row[h] ?? "").join(" | ") + " |");
      }
      lines.push("");
    }
    lines.push("---");
    lines.push("");
  }

  return lines.join("\n");
}

function generateTypeScript(discovered: DiscoveredCsv[]): string {
  const lines = [
    "// Generated by npm run charts:discover-csvs",
    "// Do not edit manually — will be overwritten on next discovery run",
    "",
    "import type { DiscoveredCsvFile } from \"./types\";",
    "",
    "export const discoveredChartCsvs: DiscoveredCsvFile[] = ",
    JSON.stringify(
      discovered.map((d) => ({
        filename: d.filename,
        filepath: d.filepath,
        detectedChartType: d.detectedChartType,
        confidence: d.confidence,
        rowCount: d.rowCount,
        headers: d.headers,
        sampleRows: d.sampleRows,
        detectedDate: d.detectedDate,
        detectedWeek: d.detectedWeek,
        mappingStatus: d.mappingStatus,
        validationStatus: d.validationStatus,
        validationIssues: d.validationIssues,
        mappedFields: d.mappedFields,
        sourceSize: d.sourceSize,
      })),
      null,
      2
    ),
    ";",
    "",
    "export const DISCOVERED_AT = \"${new Date().toISOString()}\";",
    "",
    "export function getCsvByFilename(filename: string): DiscoveredCsvFile | undefined {",
    "  return discoveredChartCsvs.find((c) => c.filename === filename);",
    "}",
    "",
    "export function getCsvsByChartType(chartType: string): DiscoveredCsvFile[] {",
    "  return discoveredChartCsvs.filter((c) => c.detectedChartType === chartType);",
    "}",
    "",
    "export function getAllCsvs(): DiscoveredCsvFile[] {",
    "  return discoveredChartCsvs;",
    "}",
    "",
  ];
  return lines.join("\n");
}

async function main(): Promise<void> {
  console.log("CSV Chart Discovery");
  console.log("===================\n");

  if (!existsSync(IMPORT_DIR)) {
    console.log(`Import directory does not exist: ${IMPORT_DIR}`);
    console.log("Run npm run charts:download-csvs first.");
    process.exit(1);
  }

  // Scan
  const discovered = await scanDirectory(IMPORT_DIR);
  console.log(`\nScanned ${discovered.length} CSV file(s).`);
  console.log(`${discovered.filter((d) => d.confidence !== "low").length} likely chart CSV(s).`);

  // Ensure report dir
  mkdirSync(REPORT_DIR, { recursive: true });

  // Write JSON report
  const jsonPath = path.join(REPORT_DIR, "chart-csv-discovery.json");
  writeFileSync(jsonPath, generateJsonReport(discovered));
  console.log(`\nJSON report: ${jsonPath}`);

  // Write MD report
  const mdPath = path.join(REPORT_DIR, "chart-csv-discovery.md");
  writeFileSync(mdPath, generateMarkdownReport(discovered));
  console.log(`Markdown report: ${mdPath}`);

  // Write TypeScript
  mkdirSync(path.dirname(TS_OUTPUT), { recursive: true });
  writeFileSync(TS_OUTPUT, generateTypeScript(discovered));
  console.log(`TypeScript export: ${TS_OUTPUT}`);

  console.log("\nDone.");
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});