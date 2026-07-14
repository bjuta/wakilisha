import fs from "node:fs";

const data = JSON.parse(
  fs.readFileSync(process.argv[2], "utf8"),
);

let answer = null;

function visit(value, path = []) {
  if (answer) return;

  if (Array.isArray(value)) {
    for (const item of value) {
      visit(item, path);
    }
    return;
  }

  if (!value || typeof value !== "object") {
    return;
  }

  const label = String(
    value.name ??
      value.type ??
      value.key_type ??
      value.role ??
      "",
  ).toLowerCase();

  const directValue =
    value.api_key ??
    value.key ??
    value.value ??
    value.token ??
    null;

  if (
    typeof directValue === "string" &&
    (
      label.includes("anon") ||
      label.includes("publishable")
    ) &&
    !label.includes("service") &&
    !label.includes("secret")
  ) {
    answer = directValue;
    return;
  }

  for (const [key, child] of Object.entries(value)) {
    const keyLabel = [...path, key]
      .join(".")
      .toLowerCase();

    if (
      typeof child === "string" &&
      (
        keyLabel.includes("anon") ||
        keyLabel.includes("publishable")
      ) &&
      !keyLabel.includes("service") &&
      !keyLabel.includes("secret")
    ) {
      answer = child;
      return;
    }

    visit(child, [...path, key]);
  }
}

visit(data);

if (!answer) {
  throw new Error(
    "Could not resolve the public Supabase API key.",
  );
}

process.stdout.write(answer);
