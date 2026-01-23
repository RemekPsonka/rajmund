import { Sankey, Tooltip, Layer, Rectangle } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { FlowNode, FlowLink } from "@/hooks/useProductionFlow";

interface ProductionFlowChartProps {
  nodes: FlowNode[];
  links: FlowLink[];
  isLoading?: boolean;
}

// Custom node component for Sankey
const SankeyNode = ({ x, y, width, height, index, payload }: any) => {
  const node = payload as FlowNode & { value?: number };
  
  // Color based on node type
  const getColor = () => {
    switch (node.type) {
      case 'raw_material':
        return 'hsl(var(--primary))';
      case 'stage':
        return 'hsl(var(--accent))';
      case 'finished':
        return 'hsl(142, 76%, 36%)'; // green
      case 'waste':
        return 'hsl(var(--muted-foreground))';
      default:
        return 'hsl(var(--secondary))';
    }
  };

  return (
    <Layer key={`node-${index}`}>
      <Rectangle
        x={x}
        y={y}
        width={width}
        height={height}
        fill={getColor()}
        fillOpacity={0.9}
        rx={4}
        ry={4}
      />
      <text
        x={x + width + 8}
        y={y + height / 2}
        textAnchor="start"
        dominantBaseline="middle"
        className="fill-foreground text-xs font-medium"
      >
        {node.name}
      </text>
      {node.value && (
        <text
          x={x + width + 8}
          y={y + height / 2 + 14}
          textAnchor="start"
          dominantBaseline="middle"
          className="fill-muted-foreground text-xs"
        >
          {node.value.toLocaleString('pl-PL')} kg
        </text>
      )}
    </Layer>
  );
};

// Custom link component
const SankeyLink = ({ sourceX, targetX, sourceY, targetY, sourceControlX, targetControlX, linkWidth, index }: any) => {
  const gradientId = `gradient-${index}`;
  
  return (
    <Layer key={`link-${index}`}>
      <defs>
        <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.5} />
          <stop offset="100%" stopColor="hsl(var(--accent))" stopOpacity={0.5} />
        </linearGradient>
      </defs>
      <path
        d={`
          M${sourceX},${sourceY}
          C${sourceControlX},${sourceY} ${targetControlX},${targetY} ${targetX},${targetY}
        `}
        fill="none"
        stroke={`url(#${gradientId})`}
        strokeWidth={linkWidth}
        strokeOpacity={0.5}
      />
    </Layer>
  );
};

export function ProductionFlowChart({ nodes, links, isLoading }: ProductionFlowChartProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Przepływ materiałów</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[400px] flex items-center justify-center">
            <div className="animate-pulse text-muted-foreground">Ładowanie wykresu...</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (nodes.length === 0 || links.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Przepływ materiałów</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[400px] flex items-center justify-center text-muted-foreground">
            Brak danych do wyświetlenia. Wybierz inny zakres dat lub uruchom symulację.
          </div>
        </CardContent>
      </Card>
    );
  }

  // Calculate node values from links
  const nodeValues = new Map<number, number>();
  links.forEach(link => {
    nodeValues.set(link.source, (nodeValues.get(link.source) || 0) + link.value);
    nodeValues.set(link.target, (nodeValues.get(link.target) || 0) + link.value);
  });

  const nodesWithValues = nodes.map((node, idx) => ({
    ...node,
    value: nodeValues.get(idx) || 0
  }));

  const data = {
    nodes: nodesWithValues,
    links: links.map(l => ({
      ...l,
      value: Math.max(l.value, 1) // Ensure minimum value for visibility
    }))
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          Przepływ materiałów
          <span className="text-xs font-normal text-muted-foreground">
            (Sankey Diagram)
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[400px] w-full">
          <Sankey
            width={800}
            height={380}
            data={data}
            nodeWidth={12}
            nodePadding={40}
            margin={{ top: 20, right: 180, bottom: 20, left: 20 }}
            link={<SankeyLink />}
            node={<SankeyNode />}
          >
            <Tooltip
              content={({ payload }) => {
                if (!payload || !payload.length) return null;
                const data = payload[0].payload;
                
                if (data.source !== undefined && data.target !== undefined) {
                  // Link tooltip
                  const sourceNode = nodes[data.source];
                  const targetNode = nodes[data.target];
                  return (
                    <div className="bg-popover border rounded-lg p-3 shadow-lg">
                      <div className="font-medium">{sourceNode?.name} → {targetNode?.name}</div>
                      <div className="text-sm text-muted-foreground">
                        {data.value?.toLocaleString('pl-PL')} kg
                      </div>
                    </div>
                  );
                }
                
                // Node tooltip
                return (
                  <div className="bg-popover border rounded-lg p-3 shadow-lg">
                    <div className="font-medium">{data.name}</div>
                    <div className="text-sm text-muted-foreground">
                      {data.value?.toLocaleString('pl-PL')} kg
                    </div>
                  </div>
                );
              }}
            />
          </Sankey>
        </div>
        
        {/* Legend */}
        <div className="flex gap-6 mt-4 justify-center text-sm">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded" style={{ backgroundColor: 'hsl(var(--primary))' }} />
            <span>Surowiec</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded" style={{ backgroundColor: 'hsl(var(--accent))' }} />
            <span>Etap produkcji</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded" style={{ backgroundColor: 'hsl(142, 76%, 36%)' }} />
            <span>Produkt gotowy</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-muted-foreground" />
            <span>Odpady</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
