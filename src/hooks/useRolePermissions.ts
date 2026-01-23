import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type AppRole = "global_admin" | "facility_admin" | "operator" | "viewer";

export type Resource = 
  | "companies"
  | "facilities"
  | "employees"
  | "products"
  | "batches"
  | "production_orders"
  | "shipments"
  | "warehouse_movements"
  | "users"
  | "settings";

export interface RolePermission {
  id: string;
  role: AppRole;
  resource: Resource;
  can_create: boolean;
  can_read: boolean;
  can_update: boolean;
  can_delete: boolean;
  created_at: string;
  updated_at: string;
}

export const ROLE_LABELS: Record<AppRole, string> = {
  global_admin: "Administrator Globalny",
  facility_admin: "Administrator Zakładu",
  operator: "Operator",
  viewer: "Podgląd",
};

export const RESOURCE_LABELS: Record<Resource, string> = {
  companies: "Firmy",
  facilities: "Zakłady",
  employees: "Pracownicy",
  products: "Produkty",
  batches: "Partie/Batche",
  production_orders: "Zlecenia produkcji",
  shipments: "Wysyłki",
  warehouse_movements: "Ruchy magazynowe",
  users: "Użytkownicy systemu",
  settings: "Ustawienia",
};

export function useRolePermissions(role?: AppRole) {
  return useQuery({
    queryKey: ["role-permissions", role],
    queryFn: async () => {
      let query = supabase
        .from("t_role_permissions")
        .select("*")
        .order("resource");

      if (role) {
        query = query.eq("role", role);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as RolePermission[];
    },
  });
}

export function useUpdateRolePermission() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      can_create,
      can_read,
      can_update,
      can_delete,
    }: {
      id: string;
      can_create?: boolean;
      can_read?: boolean;
      can_update?: boolean;
      can_delete?: boolean;
    }) => {
      const { data, error } = await supabase
        .from("t_role_permissions")
        .update({
          can_create,
          can_read,
          can_update,
          can_delete,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["role-permissions"] });
      toast.success("Uprawnienia zaktualizowane");
    },
    onError: (error: Error) => {
      toast.error(`Błąd: ${error.message}`);
    },
  });
}

// Hook to check current user's permissions
export function usePermissions() {
  const { data: userRoles } = useQuery({
    queryKey: ["current-user-roles"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      const { data, error } = await supabase
        .from("t_user_roles")
        .select("role")
        .eq("user_id", user.id);

      if (error) throw error;
      return data.map(r => r.role as AppRole);
    },
  });

  const { data: allPermissions } = useRolePermissions();

  const can = (action: "create" | "read" | "update" | "delete", resource: Resource): boolean => {
    if (!userRoles || !allPermissions) return false;

    // Check if any of user's roles has the required permission
    return userRoles.some(role => {
      const permission = allPermissions.find(
        p => p.role === role && p.resource === resource
      );
      if (!permission) return false;

      switch (action) {
        case "create": return permission.can_create;
        case "read": return permission.can_read;
        case "update": return permission.can_update;
        case "delete": return permission.can_delete;
        default: return false;
      }
    });
  };

  const isGlobalAdmin = userRoles?.includes("global_admin") ?? false;

  return {
    can,
    isGlobalAdmin,
    userRoles: userRoles ?? [],
    isLoading: !userRoles || !allPermissions,
  };
}
