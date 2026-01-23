import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface SourceBatchInfo {
  batchId: string;
  internalBatchNumber: string;
  productId: string;
  productName: string;
  weight: number;
  direction: string | null;
  supplierBatchNumber: string | null;
  receptionDate: string | null;
  deliveryDocumentNumber?: string;
}

export interface OutputBatchInfo {
  batchId: string | null;
  internalBatchNumber: string | null;
  productId: string;
  productName: string;
  weightNet: number;
  weightGross: number;
  packagingType: string | null;
  packagingCount: number | null;
}

export interface RelatedOrder {
  orderId: string;
  orderNumber: string;
  orderType: string;
  productionDate: string | null;
  relation: 'uses_our_output' | 'we_use_their_output';
  batchNumber: string;
  productName: string;
}

export interface OrderTraceabilityData {
  order: {
    id: string;
    orderNumber: string;
    type: string | null;
    status: string | null;
    productionDate: string | null;
    facilityName: string;
    notes: string | null;
  };
  sourceBatches: SourceBatchInfo[];
  outputBatches: OutputBatchInfo[];
  relatedOrders: RelatedOrder[];
  summary: {
    totalInputKg: number;
    totalOutputKg: number;
    yieldPercent: number;
    wasteKg: number;
    uniqueInputProducts: number;
    uniqueOutputProducts: number;
  };
}

export function useOrderTraceability(orderId: string | undefined) {
  return useQuery({
    queryKey: ["order-traceability", orderId],
    queryFn: async (): Promise<OrderTraceabilityData | null> => {
      if (!orderId) return null;

      // Fetch order details
      const { data: order, error: orderError } = await supabase
        .from("t_production_orders")
        .select(`
          id,
          order_number,
          type,
          status,
          production_date,
          notes,
          facility:t_facilities(name)
        `)
        .eq("id", orderId)
        .single();

      if (orderError) throw orderError;
      if (!order) return null;

      // Fetch inputs with batch and product details
      const { data: inputs, error: inputsError } = await supabase
        .from("t_production_inputs")
        .select(`
          id,
          weight,
          direction,
          batch_id,
          product_id,
          batch:t_batches(
            id,
            internal_batch_number,
            supplier_batch_number,
            reception_date
          ),
          product:t_products(id, name)
        `)
        .eq("production_order_id", orderId);

      if (inputsError) throw inputsError;

      // Fetch outputs with batch and product details
      const { data: outputs, error: outputsError } = await supabase
        .from("t_production_logs")
        .select(`
          id,
          weight_net,
          weight_gross,
          packaging_type,
          packaging_count,
          output_batch_id,
          product_id,
          output_batch:t_batches(
            id,
            internal_batch_number
          ),
          product:t_products(id, name)
        `)
        .eq("production_order_id", orderId);

      if (outputsError) throw outputsError;

      // Get output batch IDs for finding related orders
      const outputBatchIds = (outputs || [])
        .map(o => o.output_batch_id)
        .filter(Boolean) as string[];

      // Get input batch IDs
      const inputBatchIds = (inputs || [])
        .map(i => i.batch_id)
        .filter(Boolean) as string[];

      // Find orders that use our output batches
      let relatedOrdersUsingOurs: RelatedOrder[] = [];
      if (outputBatchIds.length > 0) {
        const { data: usingOrders, error: usingError } = await supabase
          .from("t_production_inputs")
          .select(`
            batch_id,
            batch:t_batches(internal_batch_number),
            product:t_products(name),
            production_order:t_production_orders(
              id,
              order_number,
              type,
              production_date
            )
          `)
          .in("batch_id", outputBatchIds)
          .neq("production_order_id", orderId);

        if (!usingError && usingOrders) {
          relatedOrdersUsingOurs = usingOrders.map(u => {
            const po = u.production_order as any;
            const batch = u.batch as any;
            const product = u.product as any;
            return {
              orderId: po?.id || '',
              orderNumber: po?.order_number || '',
              orderType: po?.type || '',
              productionDate: po?.production_date,
              relation: 'uses_our_output' as const,
              batchNumber: batch?.internal_batch_number || '',
              productName: product?.name || ''
            };
          });
        }
      }

      // Find orders whose outputs we use as inputs
      let relatedOrdersWeUse: RelatedOrder[] = [];
      if (inputBatchIds.length > 0) {
        const { data: sourceOrders, error: sourceError } = await supabase
          .from("t_production_logs")
          .select(`
            output_batch_id,
            output_batch:t_batches(internal_batch_number),
            product:t_products(name),
            production_order:t_production_orders(
              id,
              order_number,
              type,
              production_date
            )
          `)
          .in("output_batch_id", inputBatchIds)
          .neq("production_order_id", orderId);

        if (!sourceError && sourceOrders) {
          relatedOrdersWeUse = sourceOrders.map(s => {
            const po = s.production_order as any;
            const batch = s.output_batch as any;
            const product = s.product as any;
            return {
              orderId: po?.id || '',
              orderNumber: po?.order_number || '',
              orderType: po?.type || '',
              productionDate: po?.production_date,
              relation: 'we_use_their_output' as const,
              batchNumber: batch?.internal_batch_number || '',
              productName: product?.name || ''
            };
          });
        }
      }

      // Try to find delivery documents (PZ) for input batches
      let deliveryDocs: Map<string, string> = new Map();
      if (inputBatchIds.length > 0) {
        const { data: movements } = await supabase
          .from("t_warehouse_movement_items")
          .select(`
            batch_id,
            movement:t_warehouse_movements(document_number, type)
          `)
          .in("batch_id", inputBatchIds);

        if (movements) {
          movements.forEach(m => {
            const mov = m.movement as any;
            if (mov?.type === 'PZ' && m.batch_id) {
              deliveryDocs.set(m.batch_id, mov.document_number);
            }
          });
        }
      }

      // Build source batches info
      const sourceBatches: SourceBatchInfo[] = (inputs || []).map(input => {
        const batch = input.batch as any;
        const product = input.product as any;
        return {
          batchId: input.batch_id,
          internalBatchNumber: batch?.internal_batch_number || '-',
          productId: input.product_id,
          productName: product?.name || '-',
          weight: Number(input.weight),
          direction: input.direction,
          supplierBatchNumber: batch?.supplier_batch_number,
          receptionDate: batch?.reception_date,
          deliveryDocumentNumber: deliveryDocs.get(input.batch_id)
        };
      });

      // Build output batches info
      const outputBatches: OutputBatchInfo[] = (outputs || []).map(output => {
        const batch = output.output_batch as any;
        const product = output.product as any;
        return {
          batchId: output.output_batch_id,
          internalBatchNumber: batch?.internal_batch_number || null,
          productId: output.product_id,
          productName: product?.name || '-',
          weightNet: Number(output.weight_net),
          weightGross: Number(output.weight_gross),
          packagingType: output.packaging_type,
          packagingCount: output.packaging_count
        };
      });

      // Calculate summary
      const totalInputKg = sourceBatches.reduce((sum, b) => sum + b.weight, 0);
      const totalOutputKg = outputBatches.reduce((sum, b) => sum + b.weightNet, 0);
      const uniqueInputProducts = new Set(sourceBatches.map(b => b.productId)).size;
      const uniqueOutputProducts = new Set(outputBatches.map(b => b.productId)).size;

      const facility = order.facility as any;

      return {
        order: {
          id: order.id,
          orderNumber: order.order_number,
          type: order.type,
          status: order.status,
          productionDate: order.production_date,
          facilityName: facility?.name || '-',
          notes: order.notes
        },
        sourceBatches,
        outputBatches,
        relatedOrders: [...relatedOrdersWeUse, ...relatedOrdersUsingOurs],
        summary: {
          totalInputKg,
          totalOutputKg,
          yieldPercent: totalInputKg > 0 ? (totalOutputKg / totalInputKg) * 100 : 0,
          wasteKg: Math.max(0, totalInputKg - totalOutputKg),
          uniqueInputProducts,
          uniqueOutputProducts
        }
      };
    },
    enabled: !!orderId
  });
}
