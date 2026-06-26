const BASE_URL = process.env.WAKILISHA_VERIFY_BASE_URL || "https://wakilisha.africa";

const checks = [
  { path: "/wp-login.php", purpose: "WordPress login probe must not reach live WordPress", acceptedStatuses: [301, 302, 403, 404, 410] },
  { path: "/wp-admin/", purpose: "WordPress admin probe must not reach live WordPress", acceptedStatuses: [301, 302, 403, 404, 410] },
  { path: "/xmlrpc.php", purpose: "XML-RPC must be blocked or gone", acceptedStatuses: [403, 404, 410] },
  { path: "/wp-json/", purpose: "WordPress REST API must be blocked or gone after imports freeze", acceptedStatuses: [403, 404, 410] },
  { path: "/.env", purpose: "Environment file probe must be blocked or not found", acceptedStatuses: [403, 404] },
  { path: "/.git/config", purpose: "Git config probe must be blocked or not found", acceptedStatuses: [403, 404] },
  { path: "/category/music/", purpose: "Legacy category URL should redirect or resolve safely", acceptedStatuses: [200, 301, 302, 404] },
  { path: "/tag/music/", purpose: "Legacy tag URL should redirect or resolve safely", acceptedStatuses: [200, 301, 302, 404] },
  { path: "/author/admin/", purpose: "Legacy author URL should redirect, resolve safely, or be gone", acceptedStatuses: [200, 301, 302, 403, 404, 410] }
];

function absoluteUrl(path) {
  return `${BASE_URL.replace(/\/+$/, "")}${path}`;
}

async function checkRoute(check) {
  const url = absoluteUrl(check.path);

  try {
    const response = await fetch(url, {
      method: "GET",
      redirect: "manual",
      headers: { "User-Agent": "wakilisha-wordpress-deprecation-verifier/1.0" }
    });

    return {
      ...check,
      url,
      status: response.status,
      location: response.headers.get("location") || "",
      ok: check.acceptedStatuses.includes(response.status)
    };
  } catch (error) {
    return {
      ...check,
      url,
      status: "NETWORK_ERROR",
      location: "",
      ok: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

const results = [];
for (const check of checks) {
  results.push(await checkRoute(check));
}

const failures = results.filter((result) => !result.ok);

console.log("");
console.log("WordPress edge route verification");
console.log(`Base URL: ${BASE_URL}`);
console.log("");

for (const result of results) {
  const mark = result.ok ? "PASS" : "FAIL";
  const location = result.location ? ` -> ${result.location}` : "";
  console.log(`${mark} ${result.status} ${result.path}${location}`);
  console.log(`     ${result.purpose}`);
  if (result.error) console.log(`     ${result.error}`);
}

if (failures.length > 0) {
  console.error("");
  console.error(`${failures.length} route check(s) failed.`);
  process.exit(1);
}

console.log("");
console.log("All WordPress edge route checks passed.");
