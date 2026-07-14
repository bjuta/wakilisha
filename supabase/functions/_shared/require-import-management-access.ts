import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

export type ImportManagementAccess =
  | {
      ok: true;
      userId: string;
    }
  | {
      ok: false;
      status: number;
      error: string;
    };

export async function requireImportManagementAccess(
  request: Request,
  supabaseUrl: string,
  authApiKey: string,
): Promise<ImportManagementAccess> {
  const authorization = request.headers.get("Authorization")?.trim() ?? "";

  if (!/^Bearer\s+\S+$/i.test(authorization)) {
    return {
      ok: false,
      status: 401,
      error: "not_authenticated",
    };
  }

  const authClient = createClient(supabaseUrl, authApiKey, {
    global: {
      headers: {
        Authorization: authorization,
      },
    },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  const { data: userData, error: userError } =
    await authClient.auth.getUser();

  if (userError || !userData.user) {
    return {
      ok: false,
      status: 401,
      error: "not_authenticated",
    };
  }

  const [
    { data: isAdministrator, error: administratorError },
    { data: canManageImports, error: capabilityError },
  ] = await Promise.all([
    authClient.rpc("current_user_is_administrator"),
    authClient.rpc("current_user_has_capability", {
      required_capability: "manage_imports",
    }),
  ]);

  if (administratorError || capabilityError) {
    return {
      ok: false,
      status: 500,
      error: "capability_check_failed",
    };
  }

  if (isAdministrator !== true && canManageImports !== true) {
    return {
      ok: false,
      status: 403,
      error: "forbidden",
    };
  }

  return {
    ok: true,
    userId: userData.user.id,
  };
}
