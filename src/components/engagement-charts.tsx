import { useEffect, useRef } from "react";
import type { Engagement, Slice } from "@/lib/engagement";

type Chart = { setOption: (option: unknown) => void; resize: () => void; dispose: () => void };

function readToken(name: string, fallback: string) {
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback;
}

function palette() {
  return {
    ember: readToken("--color-ember", "#e8956a"),
    foam: readToken("--color-foam", "#e8f3ee"),
    mist: readToken("--color-mist", "#93b0a8"),
    teal: "#4eb8a8",
    blue: "#408eb0",
    rose: "#d67066",
  };
}

const GRID = "rgba(232,243,238,0.08)";
const AXIS = "rgba(232,243,238,0.15)";

/** Mounts an Apache ECharts instance and rebuilds it when the data changes. */
function useEchart(build: (colors: ReturnType<typeof palette>) => unknown, deps: unknown[]) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    let chart: Chart | null = null;
    let dead = false;
    const observer = new ResizeObserver(() => chart?.resize());
    observer.observe(node);
    void import("echarts").then((echarts) => {
      if (dead || !node) return;
      chart = echarts.init(node, undefined, { renderer: "canvas" }) as Chart;
      chart.setOption(build(palette()));
    });
    return () => {
      dead = true;
      observer.disconnect();
      chart?.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return ref;
}

const baseText = { fontFamily: "Outfit, sans-serif" };

export function ActivityChart({ days }: { days: Engagement["days"] }) {
  const ref = useEchart(
    (c) => ({
      animationDuration: 400,
      textStyle: { ...baseText, color: c.mist },
      tooltip: { trigger: "axis" },
      legend: { bottom: 0, textStyle: { color: c.mist }, itemWidth: 12, itemHeight: 8 },
      grid: { left: 36, right: 12, top: 16, bottom: 48 },
      xAxis: {
        type: "category",
        data: days.map((row) => row.day.slice(5)),
        axisLine: { lineStyle: { color: AXIS } },
        axisLabel: { color: c.mist },
      },
      yAxis: { type: "value", minInterval: 1, splitLine: { lineStyle: { color: GRID } }, axisLabel: { color: c.mist } },
      series: [
        { name: "Visits", type: "line", smooth: true, showSymbol: false, data: days.map((r) => r.opens), lineStyle: { width: 2, color: c.mist }, itemStyle: { color: c.mist } },
        { name: "Plays", type: "line", smooth: true, showSymbol: false, data: days.map((r) => r.starts), lineStyle: { width: 2, color: c.foam }, itemStyle: { color: c.foam } },
        { name: "Finishes", type: "line", smooth: true, showSymbol: false, data: days.map((r) => r.finishes), lineStyle: { width: 2.5, color: c.ember }, itemStyle: { color: c.ember } },
        { name: "Quits", type: "line", smooth: true, showSymbol: false, data: days.map((r) => r.quits), lineStyle: { width: 2, color: c.rose, type: "dashed" }, itemStyle: { color: c.rose } },
      ],
    }),
    [days],
  );
  return <div ref={ref} className="h-64 w-full" />;
}

export function HourChart({ hours }: { hours: Engagement["hours"] }) {
  const ref = useEchart(
    (c) => ({
      animationDuration: 400,
      textStyle: { ...baseText, color: c.mist },
      tooltip: { trigger: "axis" },
      legend: { bottom: 0, textStyle: { color: c.mist }, itemWidth: 12, itemHeight: 8 },
      grid: { left: 36, right: 12, top: 16, bottom: 48 },
      xAxis: {
        type: "category",
        data: hours.map((row) => String(row.hour)),
        axisLine: { lineStyle: { color: AXIS } },
        axisLabel: { color: c.mist, interval: 2 },
      },
      yAxis: { type: "value", minInterval: 1, splitLine: { lineStyle: { color: GRID } }, axisLabel: { color: c.mist } },
      series: [
        { name: "Plays", type: "bar", stack: "h", data: hours.map((r) => r.starts), itemStyle: { color: c.foam } },
        { name: "Finishes", type: "bar", stack: "h2", data: hours.map((r) => r.finishes), itemStyle: { color: c.ember, borderRadius: [4, 4, 0, 0] } },
      ],
    }),
    [hours],
  );
  return <div ref={ref} className="h-56 w-full" />;
}

export function BarChart({ data, horizontal = false, height = "h-56" }: { data: Slice[]; horizontal?: boolean; height?: string }) {
  const ref = useEchart(
    (c) => {
      const labels = data.map((row) => row.label);
      const values = data.map((row) => row.count);
      const category = {
        type: "category",
        data: horizontal ? [...labels].reverse() : labels,
        axisLine: { lineStyle: { color: AXIS } },
        axisLabel: { color: c.mist },
      };
      const value = { type: "value", minInterval: 1, splitLine: { lineStyle: { color: GRID } }, axisLabel: { color: c.mist } };
      return {
        animationDuration: 400,
        textStyle: { ...baseText, color: c.mist },
        tooltip: { trigger: "axis", axisPointer: { type: "shadow" } },
        grid: horizontal ? { left: 8, right: 24, top: 8, bottom: 8, containLabel: true } : { left: 36, right: 12, top: 16, bottom: 28 },
        xAxis: horizontal ? value : category,
        yAxis: horizontal ? category : value,
        series: [
          {
            type: "bar",
            barWidth: "48%",
            data: horizontal ? [...values].reverse() : values,
            itemStyle: { color: c.ember, borderRadius: horizontal ? [0, 6, 6, 0] : [6, 6, 0, 0] },
          },
        ],
      };
    },
    [data, horizontal],
  );
  return <div ref={ref} className={`${height} w-full`} />;
}

export function DonutChart({ data }: { data: Slice[] }) {
  const ref = useEchart(
    (c) => ({
      animationDuration: 400,
      textStyle: { ...baseText, color: c.mist },
      color: [c.ember, c.teal, c.blue, c.foam],
      tooltip: { trigger: "item" },
      legend: { bottom: 0, textStyle: { color: c.mist }, itemWidth: 12, itemHeight: 8 },
      series: [
        {
          type: "pie",
          radius: ["46%", "68%"],
          center: ["50%", "44%"],
          label: { color: c.foam, formatter: "{b}\n{c}" },
          labelLine: { lineStyle: { color: AXIS } },
          itemStyle: { borderColor: "#061016", borderWidth: 2 },
          data: data.map((row) => ({ name: row.label, value: row.count })),
        },
      ],
    }),
    [data],
  );
  return <div ref={ref} className="h-56 w-full" />;
}

export function ScoreChart({ buckets }: { buckets: Slice[] }) {
  return <BarChart data={buckets} />;
}
