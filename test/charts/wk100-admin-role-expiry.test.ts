import { beforeEach, expect, test, vi } from "vitest";

type RoleRow = {
  id: string;
  role_key: string;
  status: string;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
};
const fixtures = vi.hoisted(() => ({ assignments: [] as RoleRow[] }));
vi.mock("@/lib/supabase", () => ({
  supabase: {
    from(table: string) {
      let queriedRoles: string[] = [];
      const response = () => {
        if (table === "user_role_assignments") return { data: fixtures.assignments, error: null };
        if (table === "role_capabilities") {
          const capabilities = queriedRoles.includes("administrator")
            ? ["view_charts_admin", "manage_charts"]
            : ["view_public_account"];
          return { data: capabilities.map((capability_key) => ({ capability_key })), error: null };
        }
        return { data: [], error: null };
      };
      const query = {
        select() { return query; },
        eq() { return query; },
        in(column: string, values: string[]) {
          if (table === "role_capabilities" && column === "role_key") queriedRoles = values;
          return query;
        },
        maybeSingle: async () => ({ data: { display_name: "Synthetic Test" }, error: null }),
        then(resolve: (value: ReturnType<typeof response>) => unknown, reject?: (reason: unknown) => unknown) {
          return Promise.resolve(response()).then(resolve, reject);
        },
      };
      return query;
    },
  },
}));
import { fetchUserRole } from "../../src/services/userRoles";

const USER_ID = "00000000-0000-4000-8000-000000000001";
function assignment(role_key: string, expires_at: string | null): RoleRow {
  return { id: `role-${role_key}`, role_key, status: "active", expires_at,
    created_at: "2026-10-21T00:00:00Z", updated_at: "2026-10-21T00:00:00Z" };
}
beforeEach(() => { fixtures.assignments = []; });
test("expired administrator is excluded before choosing the primary Admin role", async () => {
  fixtures.assignments = [assignment("administrator", "2020-01-01T00:00:00Z"), assignment("subscriber", null)];
  const role = await fetchUserRole(USER_ID);
  expect(role?.role).toBe("subscriber");
  expect(role?.roles).toEqual(["subscriber"]);
  expect(role?.capabilities).not.toContain("manage_charts");
});
test("active unexpired administrator remains authorized in frontend projection", async () => {
  fixtures.assignments = [assignment("subscriber", null), assignment("administrator", "2999-01-01T00:00:00Z")];
  const role = await fetchUserRole(USER_ID);
  expect(role?.role).toBe("administrator");
  expect(role?.roles).toContain("administrator");
  expect(role?.capabilities).toContain("view_charts_admin");
});
test("open-ended administrator assignment remains active", async () => {
  fixtures.assignments = [assignment("administrator", null)];
  expect((await fetchUserRole(USER_ID))?.role).toBe("administrator");
});
test("malformed and already-expired assignments fail closed", async () => {
  for (const expiry of ["not-a-date", "2020-01-01T00:00:00Z"]) {
    fixtures.assignments = [assignment("administrator", expiry)];
    const role = await fetchUserRole(USER_ID);
    expect(role?.role).toBe("subscriber");
    expect(role?.capabilities).not.toContain("manage_charts");
  }
});
