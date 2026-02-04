import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface PackagingTransaction {
  id: string;
  company_id: string;
  shipment_id: string | null;
  contractor_id: string;
  type: "Issued" | "Received";
  packaging_type: string;
  quantity: number;
  created_at: string;
  comments: string | null;
}

export interface CreatePackagingTransactionData {
  company_id: string;
  contractor_id: string;
  type: "Issued" | "Received";
  packaging_type: string;
  quantity: number;
  shipment_id?: string;
  comments?: string;
}

export function usePackagingBalances() {
  return useQuery({
    queryKey: ["packaging-balances"],
    queryFn: async () => {
      // Get all transactions grouped by contractor and packaging type
      const { data, error } = await supabase
        .from("t_packaging_transactions")
        .select("contractor_id, type, packaging_type, quantity");

      if (error) throw error;

      // Calculate balances: Issued - Received
      const balances: Record<string, number> = {};
      
      data?.forEach((tx) => {
        const key = `${tx.contractor_id}-${tx.packaging_type}`;
        const value = tx.type === "Issued" ? tx.quantity : -tx.quantity;
        balances[key] = (balances[key] || 0) + value;
      });

      return balances;
    },
  });
}

export function usePackagingTransactions(contractorId: string | undefined) {
  return useQuery({
    queryKey: ["packaging-transactions", contractorId],
    queryFn: async () => {
      if (!contractorId) return [];
      
      const { data, error } = await supabase
        .from("t_packaging_transactions")
        .select("*")
        .eq("contractor_id", contractorId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as PackagingTransaction[];
    },
    enabled: !!contractorId,
  });
}

export function useContractorPackagingBalance(contractorId: string | undefined, packagingType: string) {
  return useQuery({
    queryKey: ["packaging-balance", contractorId, packagingType],
    queryFn: async () => {
      if (!contractorId) return 0;
      
      const { data, error } = await supabase
        .rpc("get_packaging_balance", {
          p_contractor_id: contractorId,
          p_packaging_type: packagingType,
        });

      if (error) throw error;
      return data as number;
    },
    enabled: !!contractorId,
  });
}

export function useCreatePackagingTransaction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreatePackagingTransactionData) => {
      const { data: result, error } = await supabase
        .from("t_packaging_transactions")
        .insert([data])
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["packaging-balances"] });
      queryClient.invalidateQueries({ queryKey: ["packaging-transactions"] });
      queryClient.invalidateQueries({ queryKey: ["packaging-balance", variables.contractor_id] });
      toast.success("Transakcja opakowań zapisana");
    },
    onError: (error: Error) => {
      toast.error(`Błąd: ${error.message}`);
    },
  });
}
