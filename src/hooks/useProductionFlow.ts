import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface FlowNode {
  name: string;
  type: 'raw_material' | 'intermediate' | 'finished' | 'waste' | 'stage';
}

export interface FlowLink {
  source: number;
  target: number;
  value: number;
  productName?: string;
}

export interface ProductionFlowSummary {
  totalInputKg: number;
  totalOutputKg: number;
  yieldPercent: number;
  wasteKg: number;
  ordersCount: number;
  batchesCreated: number;
}

export interface ProductionFlowData {
  nodes: FlowNode[];
  links: FlowLink[];
  summary: ProductionFlowSummary;
}

export interface FlowFilters {
  dateFrom?: string;
  dateTo?: string;
  facilityId?: string;
  orderType?: string;
  productId?: string;
}

export interface ProductionFlowDetail {
  orderId: string;
  orderNumber: string;
  orderType: string;
  orderStatus: string;
  productionDate: string;
  inputBatchNumber: string;
  inputProductName: string;
  inputWeight: number;
  inputDirection: string | null;
  outputProductName: string;
  outputWeight: number;
  outputBatchNumber: string | null;
  yieldPercent: number;
}

// Fetch aggregated flow data for Sankey visualization
export function useProductionFlow(filters: FlowFilters = {}) {
  return useQuery({
    queryKey: ["production-flow", filters],
    queryFn: async (): Promise<ProductionFlowData> => {
      // Build date filter
      let dateFilter = "";
      if (filters.dateFrom) {
        dateFilter += ` AND po.production_date >= '${filters.dateFrom}'`;
      }
      if (filters.dateTo) {
        dateFilter += ` AND po.production_date <= '${filters.dateTo}'`;
      }
      
      // Fetch inputs aggregated by product and order type
      let inputsQuery = supabase
        .from("t_production_inputs")
        .select(`
          weight,
          direction,
          product:t_products(name, is_raw_material),
          production_order:t_production_orders!inner(
            id,
            type,
            status,
            production_date,
            facility_id
          )
        `);

      if (filters.facilityId) {
        inputsQuery = inputsQuery.eq("production_order.facility_id", filters.facilityId);
      }
      if (filters.orderType) {
        inputsQuery = inputsQuery.eq("production_order.type", filters.orderType);
      }

      const { data: inputs, error: inputsError } = await inputsQuery;
      if (inputsError) throw inputsError;

      // Fetch outputs aggregated by product and order type
      let outputsQuery = supabase
        .from("t_production_logs")
        .select(`
          weight_net,
          product:t_products(name, is_raw_material),
          production_order:t_production_orders!inner(
            id,
            type,
            status,
            production_date,
            facility_id
          )
        `);

      if (filters.facilityId) {
        outputsQuery = outputsQuery.eq("production_order.facility_id", filters.facilityId);
      }
      if (filters.orderType) {
        outputsQuery = outputsQuery.eq("production_order.type", filters.orderType);
      }

      const { data: outputs, error: outputsError } = await outputsQuery;
      if (outputsError) throw outputsError;

      // Filter by date manually (Supabase nested filtering limitation)
      const filteredInputs = (inputs || []).filter(i => {
        const order = i.production_order as any;
        if (!order) return false;
        if (filters.dateFrom && order.production_date < filters.dateFrom) return false;
        if (filters.dateTo && order.production_date > filters.dateTo) return false;
        return true;
      });

      const filteredOutputs = (outputs || []).filter(o => {
        const order = o.production_order as any;
        if (!order) return false;
        if (filters.dateFrom && order.production_date < filters.dateFrom) return false;
        if (filters.dateTo && order.production_date > filters.dateTo) return false;
        return true;
      });

      // Build Sankey nodes and links
      const nodeMap = new Map<string, { index: number; type: FlowNode['type']; totalKg: number }>();
      const nodes: FlowNode[] = [];
      const links: FlowLink[] = [];

      // Helper to get or create node
      const getNodeIndex = (name: string, type: FlowNode['type']): number => {
        const key = `${type}:${name}`;
        if (!nodeMap.has(key)) {
          const index = nodes.length;
          nodeMap.set(key, { index, type, totalKg: 0 });
          nodes.push({ name, type });
        }
        return nodeMap.get(key)!.index;
      };

      // Process inputs - group by product and order type
      const inputsByProductAndType = new Map<string, number>();
      filteredInputs.forEach(input => {
        const product = input.product as any;
        const order = input.production_order as any;
        if (!product || !order) return;
        
        const key = `${product.name}|${order.type}`;
        inputsByProductAndType.set(key, (inputsByProductAndType.get(key) || 0) + Number(input.weight));
      });

      // Process outputs - group by product and order type
      const outputsByProductAndType = new Map<string, number>();
      filteredOutputs.forEach(output => {
        const product = output.product as any;
        const order = output.production_order as any;
        if (!product || !order) return;
        
        const key = `${product.name}|${order.type}`;
        outputsByProductAndType.set(key, (outputsByProductAndType.get(key) || 0) + Number(output.weight_net));
      });

      // Create stage nodes
      const stages = ['Decomposition', 'Processing', 'Packing'];
      const stageLabels: Record<string, string> = {
        'Decomposition': 'Rozbór',
        'Processing': 'Przetwórstwo', 
        'Packing': 'Pakowanie'
      };

      // Build flow: Raw Material -> Stage -> Product
      inputsByProductAndType.forEach((weight, key) => {
        const [productName, orderType] = key.split('|');
        const stageLabel = stageLabels[orderType] || orderType;
        
        const sourceIdx = getNodeIndex(productName, 'raw_material');
        const stageIdx = getNodeIndex(stageLabel, 'stage');
        
        // Check if link already exists
        const existingLink = links.find(l => l.source === sourceIdx && l.target === stageIdx);
        if (existingLink) {
          existingLink.value += weight;
        } else {
          links.push({ source: sourceIdx, target: stageIdx, value: weight, productName });
        }
      });

      // Stage -> Output Product
      outputsByProductAndType.forEach((weight, key) => {
        const [productName, orderType] = key.split('|');
        const stageLabel = stageLabels[orderType] || orderType;
        
        const stageIdx = getNodeIndex(stageLabel, 'stage');
        
        // Determine output type based on product characteristics
        const isWaste = productName.toLowerCase().includes('kości') || productName.toLowerCase().includes('odpad');
        const outputType: FlowNode['type'] = isWaste ? 'waste' : 'finished';
        
        const targetIdx = getNodeIndex(productName, outputType);
        
        const existingLink = links.find(l => l.source === stageIdx && l.target === targetIdx);
        if (existingLink) {
          existingLink.value += weight;
        } else {
          links.push({ source: stageIdx, target: targetIdx, value: weight, productName });
        }
      });

      // Calculate summary
      const totalInputKg = filteredInputs.reduce((sum, i) => sum + Number(i.weight), 0);
      const totalOutputKg = filteredOutputs.reduce((sum, o) => sum + Number(o.weight_net), 0);
      
      // Count unique orders
      const orderIds = new Set([
        ...filteredInputs.map(i => (i.production_order as any)?.id),
        ...filteredOutputs.map(o => (o.production_order as any)?.id)
      ].filter(Boolean));

      const summary: ProductionFlowSummary = {
        totalInputKg,
        totalOutputKg,
        yieldPercent: totalInputKg > 0 ? (totalOutputKg / totalInputKg) * 100 : 0,
        wasteKg: Math.max(0, totalInputKg - totalOutputKg),
        ordersCount: orderIds.size,
        batchesCreated: filteredOutputs.length
      };

      return { nodes, links, summary };
    },
  });
}

// Fetch detailed flow data for table
export function useProductionFlowDetails(filters: FlowFilters = {}) {
  return useQuery({
    queryKey: ["production-flow-details", filters],
    queryFn: async (): Promise<ProductionFlowDetail[]> => {
      // Fetch production orders with inputs and outputs
      let query = supabase
        .from("t_production_orders")
        .select(`
          id,
          order_number,
          type,
          status,
          production_date,
          facility_id
        `)
        .order("production_date", { ascending: false });

      // Filter by closed status
      query = query.eq("status", "Closed" as "Open" | "Closed" | "Cancelled");

      if (filters.facilityId) {
        query = query.eq("facility_id", filters.facilityId);
      }
      if (filters.orderType) {
        query = query.eq("type", filters.orderType as "Decomposition" | "Processing" | "Packing");
      }
      if (filters.dateFrom) {
        query = query.gte("production_date", filters.dateFrom);
      }
      if (filters.dateTo) {
        query = query.lte("production_date", filters.dateTo);
      }

      const { data: orders, error: ordersError } = await query;
      if (ordersError) throw ordersError;

      if (!orders || orders.length === 0) return [];

      const orderIds = orders.map(o => o.id);

      // Fetch inputs for these orders
      const { data: inputs, error: inputsError } = await supabase
        .from("t_production_inputs")
        .select(`
          production_order_id,
          weight,
          direction,
          batch:t_batches(internal_batch_number),
          product:t_products(name)
        `)
        .in("production_order_id", orderIds);

      if (inputsError) throw inputsError;

      // Fetch outputs for these orders
      const { data: outputs, error: outputsError } = await supabase
        .from("t_production_logs")
        .select(`
          production_order_id,
          weight_net,
          output_batch:t_batches(internal_batch_number),
          product:t_products(name)
        `)
        .in("production_order_id", orderIds);

      if (outputsError) throw outputsError;

      // Group inputs and outputs by order
      const inputsByOrder = new Map<string, typeof inputs>();
      const outputsByOrder = new Map<string, typeof outputs>();

      (inputs || []).forEach(input => {
        const orderId = input.production_order_id;
        if (!inputsByOrder.has(orderId)) {
          inputsByOrder.set(orderId, []);
        }
        inputsByOrder.get(orderId)!.push(input);
      });

      (outputs || []).forEach(output => {
        const orderId = output.production_order_id;
        if (!outputsByOrder.has(orderId)) {
          outputsByOrder.set(orderId, []);
        }
        outputsByOrder.get(orderId)!.push(output);
      });

      // Build detail rows
      const details: ProductionFlowDetail[] = [];

      orders.forEach(order => {
        const orderInputs = inputsByOrder.get(order.id) || [];
        const orderOutputs = outputsByOrder.get(order.id) || [];

        const totalInput = orderInputs.reduce((sum, i) => sum + Number(i.weight), 0);

        // Create a row for each input-output combination
        orderInputs.forEach(input => {
          orderOutputs.forEach(output => {
            const inputProduct = input.product as any;
            const outputProduct = output.product as any;
            const inputBatch = input.batch as any;
            const outputBatch = output.output_batch as any;

            const outputWeight = Number(output.weight_net);
            const inputWeight = Number(input.weight);
            const yieldPercent = inputWeight > 0 ? (outputWeight / inputWeight) * 100 : 0;

            details.push({
              orderId: order.id,
              orderNumber: order.order_number,
              orderType: order.type || 'Unknown',
              orderStatus: order.status || 'Unknown',
              productionDate: order.production_date || '',
              inputBatchNumber: inputBatch?.internal_batch_number || '-',
              inputProductName: inputProduct?.name || '-',
              inputWeight,
              inputDirection: input.direction,
              outputProductName: outputProduct?.name || '-',
              outputWeight,
              outputBatchNumber: outputBatch?.internal_batch_number || null,
              yieldPercent: Math.round(yieldPercent * 10) / 10
            });
          });
        });
      });

      return details;
    },
  });
}
