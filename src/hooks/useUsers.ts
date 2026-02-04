import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface AppUser {
  id: string;
  full_name: string | null;
  ui_theme: string | null;
  created_at: string | null;
  email?: string;
  roles: UserRole[];
}

export interface UserRole {
  id: string;
  user_id: string;
  role: "global_admin" | "facility_admin" | "operator" | "viewer";
  company_id: string | null;
  facility_id: string | null;
  company_name?: string;
  facility_name?: string;
}

export function useUsers() {
  return useQuery({
    queryKey: ["users"],
    queryFn: async (): Promise<AppUser[]> => {
      // Fetch app users
      const { data: appUsers, error: usersError } = await supabase
        .from("t_app_users")
        .select("*")
        .order("created_at", { ascending: false });

      if (usersError) throw usersError;

      // Fetch roles with company and facility names
      const { data: roles, error: rolesError } = await supabase
        .from("t_user_roles")
        .select(`
          id,
          user_id,
          role,
          company_id,
          facility_id,
          company:t_companies(name),
          facility:t_facilities(name)
        `);

      if (rolesError) throw rolesError;

      // Map roles by user_id
      const rolesByUser = new Map<string, UserRole[]>();
      (roles || []).forEach((r) => {
        const company = r.company as any;
        const facility = r.facility as any;
        const role: UserRole = {
          id: r.id,
          user_id: r.user_id,
          role: r.role,
          company_id: r.company_id,
          facility_id: r.facility_id,
          company_name: company?.name,
          facility_name: facility?.name,
        };
        if (!rolesByUser.has(r.user_id)) {
          rolesByUser.set(r.user_id, []);
        }
        rolesByUser.get(r.user_id)!.push(role);
      });

      // Combine users with their roles
      return (appUsers || []).map((user) => ({
        id: user.id,
        full_name: user.full_name,
        ui_theme: user.ui_theme,
        created_at: user.created_at,
        roles: rolesByUser.get(user.id) || [],
      }));
    },
  });
}

export function useUpdateUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      userId,
      fullName,
    }: {
      userId: string;
      fullName: string;
    }) => {
      const { error } = await supabase
        .from("t_app_users")
        .update({ full_name: fullName, updated_at: new Date().toISOString() })
        .eq("id", userId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      toast.success("Dane użytkownika zaktualizowane");
    },
    onError: (error) => {
      toast.error("Błąd aktualizacji: " + error.message);
    },
  });
}

export function useAddUserRole() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      userId,
      role,
      companyId,
      facilityId,
    }: {
      userId: string;
      role: "global_admin" | "facility_admin" | "operator" | "viewer";
      companyId?: string | null;
      facilityId?: string | null;
    }) => {
      const { error } = await supabase.from("t_user_roles").insert({
        user_id: userId,
        role,
        company_id: companyId || null,
        facility_id: facilityId || null,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      toast.success("Rola dodana");
    },
    onError: (error) => {
      toast.error("Błąd dodawania roli: " + error.message);
    },
  });
}

export function useRemoveUserRole() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (roleId: string) => {
      const { error } = await supabase
        .from("t_user_roles")
        .delete()
        .eq("id", roleId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      toast.success("Rola usunięta");
    },
    onError: (error) => {
      toast.error("Błąd usuwania roli: " + error.message);
    },
  });
}

export function useInviteUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      email,
      fullName,
      password,
      role,
      companyId,
    }: {
      email: string;
      fullName: string;
      password: string;
      role: "global_admin" | "facility_admin" | "operator" | "viewer";
      companyId?: string;
    }) => {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: window.location.origin,
          data: {
            full_name: fullName,
          },
        },
      });

      if (error) throw error;
      if (!data.user) throw new Error("Nie udało się utworzyć użytkownika");

      // Add role for the new user
      const { error: roleError } = await supabase.from("t_user_roles").insert({
        user_id: data.user.id,
        role,
        company_id: companyId || null,
      });

      if (roleError) {
        console.error("Role assignment error:", roleError);
        // Don't throw - user was created, role can be added later
      }

      return data.user;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      toast.success("Użytkownik utworzony pomyślnie");
    },
    onError: (error) => {
      toast.error("Błąd tworzenia użytkownika: " + error.message);
    },
  });
}

export function useUpdateUserPassword() {
  return useMutation({
    mutationFn: async ({
      userId,
      password,
    }: {
      userId: string;
      password: string;
    }) => {
      const { data, error } = await supabase.functions.invoke("admin-update-user", {
        body: { userId, password },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      
      return data;
    },
    onSuccess: () => {
      toast.success("Hasło użytkownika zostało zmienione");
    },
    onError: (error) => {
      toast.error("Błąd zmiany hasła: " + error.message);
    },
  });
}
