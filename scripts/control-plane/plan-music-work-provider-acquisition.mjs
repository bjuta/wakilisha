#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const manifestPath = path.join(
  root,
  "config/music-work-provider-field-policy.v1.json",
);

function parseArgs(argv) {
  const args = {
    profile: null,
    providers: null,
    include: [],
    exclude: [],
    json: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];

    if (value === "--profile") {
      args.profile = argv[++index] || null;
      continue;
    }

    if (value === "--providers") {
      args.providers = (argv[++index] || "")
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
      continue;
    }

    if (value === "--include") {
      args.include.push(argv[++index] || "");
      continue;
    }

    if (value === "--exclude") {
      args.exclude.push(argv[++index] || "");
      continue;
    }

    if (value === "--json") {
      args.json = true;
      continue;
    }

    if (value === "--help" || value === "-h") {
      printHelp();
      process.exit(0);
    }

    throw new Error(`Unknown argument: ${value}`);
  }

  return args;
}

function printHelp() {
  process.stdout.write(
    [
      "Usage: node scripts/control-plane/plan-music-work-provider-acquisition.mjs [options]",
      "",
      "Options:",
      "  --profile <name>       Acquisition profile.",
      "  --providers <csv>      Restrict to provider keys.",
      "  --include <p.field>    Explicitly include one policy-eligible field.",
      "  --exclude <p.field>    Explicitly exclude one field.",
      "  --json                 Emit machine-readable JSON.",
      "  --help                 Show this help.",
      "",
      "This command never calls provider APIs and never writes Registry data.",
      "",
    ].join("\n"),
  );
}

function readManifest() {
  return JSON.parse(fs.readFileSync(manifestPath, "utf8"));
}

function fieldRef(providerKey, fieldKey) {
  return `${providerKey}.${fieldKey}`;
}

function selectable(field) {
  return !String(field.retention || "").startsWith("policy_blocked");
}

function planAcquisition(manifest, args) {
  const profileName =
    args.profile || manifest.defaultProfile;
  const profile = manifest.profiles[profileName];

  if (!profile) {
    throw new Error(
      `Unknown profile "${profileName}". Available: ${Object.keys(
        manifest.profiles,
      ).join(", ")}`,
    );
  }

  const requestedProviders =
    args.providers || Object.keys(manifest.providers);

  for (const provider of requestedProviders) {
    if (!manifest.providers[provider]) {
      throw new Error(
        `Unknown provider "${provider}".`,
      );
    }
  }

  const include = new Set(args.include.filter(Boolean));
  const exclude = new Set(args.exclude.filter(Boolean));
  const knownRefs = new Set();

  for (const [providerKey, provider] of Object.entries(
    manifest.providers,
  )) {
    for (const field of provider.fields) {
      knownRefs.add(fieldRef(providerKey, field.key));
    }
  }

  for (const ref of [...include, ...exclude]) {
    if (!knownRefs.has(ref)) {
      throw new Error(
        `Unknown field selector "${ref}". Use provider.field.`,
      );
    }
  }

  const providers = [];

  for (const providerKey of requestedProviders) {
    const provider = manifest.providers[providerKey];
    const selected = [];
    const optionalAvailable = [];
    const blocked = [];

    for (const field of provider.fields) {
      const ref = fieldRef(providerKey, field.key);
      const isBlocked = !selectable(field);

      if (isBlocked) {
        if (include.has(ref)) {
          throw new Error(
            `Field "${ref}" is policy-blocked and cannot be selected.`,
          );
        }

        blocked.push(field);
        continue;
      }

      const selectedByProfile =
        profile.categories.includes(field.category);
      const selectedByDefault =
        profileName === "work-evidence-only"
          ? Boolean(field.defaultSelected)
          : selectedByProfile;
      const shouldSelect =
        !exclude.has(ref) &&
        (include.has(ref) ||
          selectedByDefault ||
          (profileName !== "work-evidence-only" &&
            selectedByProfile));

      if (shouldSelect) {
        selected.push(field);
      } else {
        optionalAvailable.push(field);
      }
    }

    providers.push({
      key: providerKey,
      label: provider.label,
      acquisitionMode: provider.acquisitionMode,
      workEvidenceStrength: provider.workEvidenceStrength,
      policyStatus: provider.policyStatus,
      policyNote: provider.policyNote,
      docs: provider.docs,
      selected,
      optionalAvailable,
      blocked,
    });
  }

  return {
    manifestVersion: manifest.version,
    profile: profileName,
    profileDescription: profile.description,
    mutationAuthority: "none",
    networkCalls: "none",
    providers,
  };
}

function printHuman(plan) {
  process.stdout.write(
    `MUSIC_WORK_PROVIDER_ACQUISITION_PROFILE=${plan.profile}\n`,
  );
  process.stdout.write(
    "MUTATION_AUTHORITY=NONE\nNETWORK_CALLS=NONE\n",
  );

  for (const provider of plan.providers) {
    process.stdout.write(
      `\n[${provider.key}] ${provider.label}\n`,
    );
    process.stdout.write(
      `policy=${provider.policyStatus} work_evidence=${provider.workEvidenceStrength}\n`,
    );

    process.stdout.write("selected:\n");
    if (provider.selected.length === 0) {
      process.stdout.write("  (none)\n");
    } else {
      for (const field of provider.selected) {
        process.stdout.write(
          `  + ${field.key} [${field.category}]\n`,
        );
      }
    }

    process.stdout.write("optional_available:\n");
    if (provider.optionalAvailable.length === 0) {
      process.stdout.write("  (none)\n");
    } else {
      for (const field of provider.optionalAvailable) {
        process.stdout.write(
          `  ? ${field.key} [${field.category}]\n`,
        );
      }
    }

    process.stdout.write("policy_blocked:\n");
    if (provider.blocked.length === 0) {
      process.stdout.write("  (none)\n");
    } else {
      for (const field of provider.blocked) {
        process.stdout.write(
          `  ! ${field.key}\n`,
        );
      }
    }
  }
}

const args = parseArgs(process.argv.slice(2));
const manifest = readManifest();
const plan = planAcquisition(manifest, args);

if (args.json) {
  process.stdout.write(
    `${JSON.stringify(plan, null, 2)}\n`,
  );
} else {
  printHuman(plan);
}
