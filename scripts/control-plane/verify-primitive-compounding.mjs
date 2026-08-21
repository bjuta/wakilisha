#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

function walkFiles(root, extensions = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs'])) {
  if (!fs.existsSync(root)) return [];
  const entries = fs.readdirSync(root, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const absolute = path.join(root, entry.name);
    if (entry.isDirectory()) files.push(...walkFiles(absolute, extensions));
    else if (extensions.has(path.extname(entry.name))) files.push(absolute);
  }
  return files;
}

function normalize(relative) {
  return relative.split(path.sep).join('/');
}

function importTokenFor(primitivePath) {
  return `@/${primitivePath.replace(/^src\//, '').replace(/\.(tsx?|jsx?|mjs)$/, '')}`;
}

function importsToken(source, token) {
  const quoted = [`'${token}'`, `\"${token}\"`, `'${token}.tsx'`, `\"${token}.tsx\"`];
  return quoted.some((needle) => source.includes(needle));
}

function sameSet(a, b) {
  if (a.length !== b.length) return false;
  const left = [...a].sort();
  const right = [...b].sort();
  return left.every((value, index) => value === right[index]);
}

function surfaceRoots(root, registry) {
  const surfaces = [];
  for (const group of registry.surfaceDiscovery ?? []) {
    const parent = path.join(root, group.childrenOf);
    if (!fs.existsSync(parent)) continue;
    for (const entry of fs.readdirSync(parent, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      surfaces.push({
        id: `${group.idPrefix}${entry.name}`,
        path: normalize(path.join(group.childrenOf, entry.name)),
      });
    }
  }
  for (const surface of registry.surfaces ?? []) {
    const absolute = path.join(root, surface.path);
    if (!fs.existsSync(absolute)) {
      if (surface.required) surfaces.push({ ...surface, missing: true });
      continue;
    }
    surfaces.push({ id: surface.id, path: normalize(surface.path) });
  }
  const deduped = new Map();
  for (const surface of surfaces) deduped.set(surface.id, surface);
  return [...deduped.values()];
}

function gitDiffNames(root, baseRef, { diffFilter = null, paths = [] } = {}) {
  if (!baseRef) return [];
  try {
    const args = ['diff', '--name-only'];
    if (diffFilter) args.push(`--diff-filter=${diffFilter}`);
    args.push(`${baseRef}...HEAD`);
    if (paths.length) args.push('--', ...paths);
    const output = execFileSync('git', args, {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    return output
      .split('\n')
      .map((value) => value.trim())
      .filter(Boolean)
      .map(normalize);
  } catch {
    return [];
  }
}

export function verifyPrimitiveCompounding({
  root = process.cwd(),
  registryPath = 'scripts/control-plane/primitive-registry.json',
  baseRef = process.env.CONTROL_PLANE_BASE_REF ?? null,
  changedPaths = null,
} = {}) {
  const errors = [];
  const absoluteRegistry = path.join(root, registryPath);
  if (!fs.existsSync(absoluteRegistry)) {
    return { errors: [`Primitive registry is missing: ${registryPath}`], surfaces: [], consumers: {} };
  }

  let registry;
  try {
    registry = JSON.parse(fs.readFileSync(absoluteRegistry, 'utf8'));
  } catch (error) {
    return { errors: [`Primitive registry is invalid JSON: ${error.message}`], surfaces: [], consumers: {} };
  }

  if (registry.version !== 1) errors.push('Primitive registry version must be 1.');

  const allowedKinds = new Set(['presentation', 'interaction', 'authority']);
  const allowedMaturity = new Set(['candidate', 'canonical', 'foundation']);
  const allowedExceptionClasses = new Set(['legacy', 'semantic']);
  const primitives = Array.isArray(registry.primitives) ? registry.primitives : [];
  const ids = new Set();
  const paths = new Set();
  const surfaces = surfaceRoots(root, registry);
  const consumers = {};
  const effectiveChangedPaths = new Set(
    (changedPaths ?? gitDiffNames(root, baseRef)).map(normalize),
  );

  for (const surface of surfaces) {
    if (surface.missing) errors.push(`Required primitive surface is missing: ${surface.id} (${surface.path})`);
  }

  for (const primitive of primitives) {
    if (!primitive.id || ids.has(primitive.id)) errors.push(`Primitive id is missing or duplicated: ${primitive.id ?? '<missing>'}`);
    ids.add(primitive.id);
    if (!primitive.path || paths.has(primitive.path)) errors.push(`Primitive path is missing or duplicated: ${primitive.path ?? '<missing>'}`);
    paths.add(primitive.path);
    if (!allowedKinds.has(primitive.kind)) errors.push(`${primitive.id}: unsupported kind ${primitive.kind}`);
    if (!allowedMaturity.has(primitive.maturity)) errors.push(`${primitive.id}: unsupported maturity ${primitive.maturity}`);
    if (!primitive.concept || !String(primitive.concept).trim()) errors.push(`${primitive.id}: concept is required.`);
    if (!primitive.authorityOwner) errors.push(`${primitive.id}: authorityOwner is required.`);

    const absolutePrimitive = path.join(root, primitive.path ?? '');
    if (!fs.existsSync(absolutePrimitive)) {
      errors.push(`${primitive.id}: primitive file is missing at ${primitive.path}`);
      continue;
    }

    const primitiveSource = fs.readFileSync(absolutePrimitive, 'utf8');
    if (primitive.authorityOwner === 'consumer') {
      const forbidden = ['@/services/', '@/pages/', '@/lib/supabase'];
      for (const needle of forbidden) {
        if (primitiveSource.includes(needle)) errors.push(`${primitive.id}: consumer-owned primitive imports forbidden authority path ${needle}`);
      }
      if (/from\s+["'][^"']*\/(?:pages|services)\//.test(primitiveSource)) {
        errors.push(`${primitive.id}: consumer-owned primitive imports a page or service through a relative path.`);
      }
    }

    const token = importTokenFor(primitive.path);
    const actualConsumers = [];
    for (const surface of surfaces) {
      if (surface.missing) continue;
      const files = walkFiles(path.join(root, surface.path));
      if (files.some((file) => importsToken(fs.readFileSync(file, 'utf8'), token))) actualConsumers.push(surface.id);
    }
    consumers[primitive.id] = actualConsumers;

    const declared = Array.isArray(primitive.consumers) ? primitive.consumers : [];
    if (!sameSet(declared, actualConsumers)) {
      errors.push(`${primitive.id}: declared consumers [${declared.join(', ')}] do not match actual consumers [${actualConsumers.join(', ')}].`);
    }

    if (primitive.maturity === 'candidate' && actualConsumers.length !== 1) {
      errors.push(`${primitive.id}: candidate primitives require exactly one proven domain consumer; found ${actualConsumers.length}. ${actualConsumers.length > 1 ? 'Promote it to canonical.' : ''}`.trim());
    }
    if (primitive.maturity === 'canonical' && actualConsumers.length < 2) {
      errors.push(`${primitive.id}: canonical primitives require at least two distinct domain consumers; found ${actualConsumers.length}.`);
    }
    if (primitive.maturity === 'foundation' && actualConsumers.length < 1) {
      errors.push(`${primitive.id}: foundation primitives require at least one real consumer.`);
    }

    const exceptionList = Array.isArray(primitive.competingImplementationExceptions)
      ? primitive.competingImplementationExceptions
      : [];
    const exceptions = new Map();
    for (const exception of exceptionList) {
      const exceptionPath = normalize(exception.path ?? '');
      if (!exceptionPath || exceptions.has(exceptionPath)) {
        errors.push(`${primitive.id}: competing implementation exception path is missing or duplicated: ${exceptionPath || '<missing>'}.`);
        continue;
      }
      if (!allowedExceptionClasses.has(exception.classification)) {
        errors.push(`${primitive.id}: ${exceptionPath} has unsupported exception classification ${exception.classification}.`);
      }
      if (!exception.reason || !String(exception.reason).trim()) {
        errors.push(`${primitive.id}: ${exceptionPath} exception requires a reason.`);
      }
      exceptions.set(exceptionPath, exception);
    }
    const matchedExceptions = new Set();

    for (const patternSource of primitive.competingImplementationPatterns ?? []) {
      let pattern;
      try {
        pattern = new RegExp(patternSource, 'm');
      } catch (error) {
        errors.push(`${primitive.id}: invalid competingImplementationPattern ${patternSource}: ${error.message}`);
        continue;
      }
      for (const surface of surfaces) {
        if (surface.missing) continue;
        for (const file of walkFiles(path.join(root, surface.path))) {
          const source = fs.readFileSync(file, 'utf8');
          if (!pattern.test(source)) continue;

          const relative = normalize(path.relative(root, file));
          const exception = exceptions.get(relative);
          if (!exception) {
            errors.push(`${primitive.id}: competing local implementation found in ${relative} matching /${patternSource}/.`);
            continue;
          }

          matchedExceptions.add(relative);
          if (exception.classification === 'legacy' && effectiveChangedPaths.has(relative)) {
            errors.push(`${primitive.id}: legacy competing implementation ${relative} was touched. Migrate it to the canonical primitive and remove the legacy exception instead of renewing the debt.`);
          }
        }
      }
    }

    for (const exceptionPath of exceptions.keys()) {
      if (!matchedExceptions.has(exceptionPath)) {
        errors.push(`${primitive.id}: stale competing implementation exception ${exceptionPath}. Remove the exception because the competing implementation is no longer present.`);
      }
    }
  }

  const registeredPaths = new Set(primitives.map((primitive) => normalize(primitive.path)));
  const addedPrimitiveFiles = gitDiffNames(root, baseRef, {
    diffFilter: 'A',
    paths: registry.primitiveDirectories ?? [],
  });
  for (const added of addedPrimitiveFiles) {
    if (!registeredPaths.has(added)) {
      errors.push(`New design-system primitive ${added} is not registered. Register it as candidate/canonical/foundation or keep the implementation inside its domain.`);
    }
  }

  return {
    errors,
    surfaces: surfaces.map(({ id, path: surfacePath }) => ({ id, path: surfacePath })),
    consumers,
  };
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (isMain) {
  const result = verifyPrimitiveCompounding();
  if (result.errors.length) {
    console.error('PRIMITIVE_COMPOUNDING_FAIL');
    for (const error of result.errors) console.error(`- ${error}`);
    process.exit(1);
  }
  console.log('PRIMITIVE_COMPOUNDING_PASS');
  for (const [id, consumerList] of Object.entries(result.consumers)) console.log(`${id}: ${consumerList.join(', ')}`);
}
