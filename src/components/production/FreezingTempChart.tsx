import { useMemo } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
} from "recharts";
import { format } from "date-fns";
import { ThermometerSnowflake } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { useFreezingTempStream } from "@/hooks/useFreezingTempStream";

interface FreezingTempChartProps {
  productionLogId: string;
  targetTempC?: number;
  ambientLine?: boolean;
  title?: string;
}

interface ChartPoint {
  ts: number;
  label: string;
  core: number;
  ambient: number | null;
  source: "manual" | "auto";
}

function CustomTooltip({ active, payload }: any) {
  if (!active || !payload || payload.length === 0) return null;
  const p = payload[0]?.payload as ChartPoint | undefined;
  if (!p) return null;
  return (
    <div className="rounded-md border bg-popover px-3 py-2 text-xs shadow-md">
      <div className="font-medium text-foreground">
        {format(new Date(p.ts), "HH:mm:ss")}
      </div>
      <div className="mt-1 text-foreground">
        Rdzeń: <span className="font-mono">{p.core.toFixed(1)}°C</span>
      </div>
      {p.ambient != null && (
        <div className="text-muted-foreground">
          Otoczenie: <span className="font-mono">{p.ambient.toFixed(1)}°C</span>
        </div>
      )}
      <div className="mt-1 text-muted-foreground">
        Źródło: {p.source === "auto" ? "auto (sonda)" : "ręczny"}
      </div>
    </div>
  );
}

export function FreezingTempChart({
  productionLogId,
  targetTempC = -18,
  ambientLine = false,
  title = "Krzywa temperatury rdzenia",
}: FreezingTempChartProps) {
  const { readings, isLoading } = useFreezingTempStream(productionLogId);

  const data: ChartPoint[] = useMemo(
    () =>
      readings.map((r) => ({
        ts: new Date(r.recorded_at).getTime(),
        label: format(new Date(r.recorded_at), "HH:mm"),
        core: Number(r.core_temp_c),
        ambient: r.ambient_temp_c != null ? Number(r.ambient_temp_c) : null,
        source: r.source,
      })),
    [readings]
  );

  const last = data[data.length - 1];
  const reachedTarget = last ? last.core <= targetTempC : false;
  const remaining = last ? Math.abs(last.core - targetTempC) : 0;

  // Auto skala Y z paddingiem (typowo +10 do -25)
  const yDomain: [number, number] = useMemo(() => {
    if (data.length === 0) return [-25, 10];
    const cores = data.map((d) => d.core);
    const min = Math.min(...cores, targetTempC);
    const max = Math.max(...cores, 4);
    return [Math.floor(min - 3), Math.ceil(max + 2)];
  }, [data, targetTempC]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <ThermometerSnowflake className="h-5 w-5 text-primary" />
              {title}
            </CardTitle>
            <div className="mt-1 text-xs text-muted-foreground">
              Target ≤ {targetTempC}°C (CCP) ·{" "}
              {data.length > 0 ? `${data.length} pomiarów` : "brak pomiarów"}
            </div>
          </div>

          <div className="flex flex-col items-end gap-2">
            <div
              className="font-mono leading-none tabular-nums text-foreground"
              style={{ fontSize: 48 }}
            >
              {last ? `${last.core.toFixed(1)}°C` : "—"}
            </div>
            {last && (
              <Badge
                className={
                  reachedTarget
                    ? "bg-success text-success-foreground hover:bg-success"
                    : "bg-warning text-warning-foreground hover:bg-warning"
                }
              >
                {reachedTarget
                  ? "OSIĄGNIĘTO TARGET — można zakończyć mrożenie"
                  : `OZIĘBIANIE — pozostało ${remaining.toFixed(1)}°C`}
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {isLoading ? (
          <Skeleton className="h-[300px] w-full" />
        ) : data.length === 0 ? (
          <EmptyState
            icon={ThermometerSnowflake}
            title="Oczekiwanie na pierwszy pomiar..."
            description="Dane pojawią się automatycznie po pierwszym odczycie z sondy (co 30s) lub po ręcznym zapisie."
          />
        ) : (
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={data}
                margin={{ top: 8, right: 16, bottom: 8, left: -8 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="hsl(var(--border))"
                />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                  stroke="hsl(var(--border))"
                />
                <YAxis
                  domain={yDomain}
                  tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                  stroke="hsl(var(--border))"
                  tickFormatter={(v: number) => `${v}°`}
                />
                <Tooltip content={<CustomTooltip />} />
                <ReferenceLine
                  y={targetTempC}
                  stroke="hsl(var(--destructive))"
                  strokeDasharray="5 5"
                  label={{
                    value: `Target ${targetTempC}°C`,
                    position: "insideTopRight",
                    fontSize: 11,
                    fill: "hsl(var(--destructive))",
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="core"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  dot={(props: any) => {
                    const { cx, cy, index } = props;
                    const isRecent = index >= data.length - 3;
                    if (!isRecent) {
                      return <g key={`dot-${index}`} />;
                    }
                    return (
                      <circle
                        key={`dot-${index}`}
                        cx={cx}
                        cy={cy}
                        r={4}
                        fill="hsl(var(--primary))"
                        stroke="hsl(var(--background))"
                        strokeWidth={2}
                      />
                    );
                  }}
                  activeDot={{ r: 6 }}
                  isAnimationActive={false}
                  name="Rdzeń"
                />
                {ambientLine && (
                  <Line
                    type="monotone"
                    dataKey="ambient"
                    stroke="hsl(var(--muted-foreground))"
                    strokeWidth={1}
                    strokeDasharray="3 3"
                    dot={false}
                    isAnimationActive={false}
                    name="Otoczenie"
                  />
                )}
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
