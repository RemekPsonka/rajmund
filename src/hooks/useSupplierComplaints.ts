import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type ComplaintType =
  | "CCP1_TEMPERATURE"
  | "QUALITY"
  | "QUANTITY"
  | "DOCUMENTATION"
  | "OTHER";

export type ComplaintSeverity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export type ComplaintStatus = "NEW" | "ACKNOWLEDGED" | "RESOLVED" | "REJECTED";

export interface SupplierComplaint {
  id: string;
  supplier_id: string | null;
  movement_id: string | null;
  complaint_type: ComplaintType;
  severity: ComplaintSeverity;
  status: ComplaintStatus;
  payload: Record<string, unknown> | null;
  notes: string | null;
  created_at: string;
  resolved_at: string | null;
  resolved_by: string | null;
  supplier?: { name: string } | null;
  movement?: { document_number: string } | null;
}

interface ComplaintFilters {
  status?: ComplaintStatus | "ALL";
  severity?: ComplaintSeverity | "ALL";
}

export function useSupplierComplaints(filters: ComplaintFilters = {}) {
  return useQuery({
    queryKey: ["supplier-complaints", filters],
    queryFn: async () => {
      let q = supabase
        .from("t_supplier_complaints")
        .select(
          `*,
           supplier:t_contractors(name),
           movement:t_warehouse_movements(document_number)`
        )
        .order("created_at", { ascending: false });

      if (filters.status && filters.status !== "ALL") {
        q = q.eq("status", filters.status);
      }
      if (filters.severity && filters.severity !== "ALL") {
        q = q.eq("severity", filters.severity);
      }

      const { data, error } = await q;
      if (error) throw error;
      return data as unknown as SupplierComplaint[];
    },
  });
}

export function useUpdateComplaintStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      status,
    }: {
      id: string;
      status: ComplaintStatus;
    }) => {
      const isFinal = status === "RESOLVED" || status === "REJECTED";
      const update: {
        status: ComplaintStatus;
        resolved_at?: string | null;
      } = { status };
      if (isFinal) update.resolved_at = new Date().toISOString();

      const { error } = await supabase
        .from("t_supplier_complaints")
        .update(update)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["supplier-complaints"] });
      toast.success("Status reklamacji zaktualizowany");
    },
    onError: (error: Error) => {
      toast.error(`Błąd: ${error.message}`);
    },
  });
}
