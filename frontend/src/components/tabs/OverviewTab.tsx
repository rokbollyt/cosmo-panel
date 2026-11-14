import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowDownLeft, ArrowUpRight, Cpu, HardDrive } from 'lucide-react';
import { LiquidGlassCard } from '../shaders/LiquidGlassSurface';
import { TRAFFIC_SERIES } from '../../data/mockData';
import type { TrafficPoint, VpnKey } from '../../types/vpn';
import type { SystemStats } from '../../api/client';
import { JELLY_ITEM_VARIANTS, JELLY_SNAP } from '../../utils/motion';
import { triggerHaptic } from '../../utils/haptics';

interface OverviewTabProps {
  keys: VpnKey[];
  domain: string;
  stats?: SystemStats | null;
  trafficSeries?: TrafficPoint[];
}

type PeriodKey = '24h' | '7d' | '30d';

const PERIODS: { id: PeriodKey; label: string }[] = [
  { id: '24h', label: '24ч' },
  { id: '7d', label: '7д' },
  { id: '30d', label: '30д' },
];

// 28 сегментов стабильности аптайма (строго монохромная шкала прозрачности)
const UPTIME_SEGMENTS = [
  1, 1, 1, 1, 1, 1, 0.92, 1, 1, 1, 1, 1, 1, 1,
  1, 0.85, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
];

function buildSmoothPath(points: { x: number; y: number }[]): string {
  if (points.length === 0) return '';
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i === 0 ? i : i - 1];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2 < points.length ? i + 2 : i + 1];

    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;

    d += ` C ${cp1x.toFixed(2)} ${cp1y.toFixed(2)}, ${cp2x.toFixed(2)} ${cp2y.toFixed(2)}, ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`;
  }
  return d;
}

export const OverviewTab: React.FC<OverviewTabProps> = ({
  keys,
  domain,
  stats,
  trafficSeries,
}) => {
  // Живой тикающий аптайм хоста
  const [uptimeSeconds, setUptimeSeconds] = useState(
    stats?.uptimeSeconds ?? 0
  );
  const [period, setPeriod] = useState<PeriodKey>('24h');
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  useEffect(() => {
    if (stats?.uptimeSeconds) {
      setUptimeSeconds(stats.uptimeSeconds);
    }
  }, [stats?.uptimeSeconds]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setUptimeSeconds((prev) => prev + 1);
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);

  const formattedUptime = useMemo(() => {
    const d = Math.floor(uptimeSeconds / 86400);
    const h = Math.floor((uptimeSeconds % 86400) / 3600);
    const m = Math.floor((uptimeSeconds % 3600) / 60);
    const s = uptimeSeconds % 60;
    return {
      d: String(d),
      h: String(h).padStart(2, '0'),
      m: String(m).padStart(2, '0'),
      s: String(s).padStart(2, '0'),
    };
  }, [uptimeSeconds]);

  const series: TrafficPoint[] = useMemo(() => {
    if (trafficSeries && trafficSeries.length > 0) {
      return trafficSeries;
    }
    return TRAFFIC_SERIES[period];
  }, [trafficSeries, period]);

  const activePoint =
    selectedIndex !== null && series[selectedIndex]
      ? series[selectedIndex]
      : null;

  const periodTotals = useMemo(() => {
    const down = series.reduce((acc, p) => acc + p.downGb, 0);
    const up = series.reduce((acc, p) => acc + p.upGb, 0);
    return {
      total: (down + up).toFixed(1),
      down: down.toFixed(1),
      up: up.toFixed(1),
    };
  }, [series]);

  // Геометрия монохромного SVG-графика
  const chartW = 330;
  const chartH = 128;
  const padX = 12;
  const padTop = 18;
  const padBottom = 14;

  const { coords, linePath, areaPath } = useMemo(() => {
    const maxVal = Math.max(...series.map((p) => p.totalGb), 1) * 1.15;
    const stepX =
      series.length > 1 ? (chartW - padX * 2) / (series.length - 1) : 0;

    const pts = series.map((p, idx) => ({
      x: padX + idx * stepX,
      y: padTop + (1 - p.totalGb / maxVal) * (chartH - padTop - padBottom),
    }));

    const line = buildSmoothPath(pts);
    const area =
      pts.length > 0
        ? `${line} L ${pts[pts.length - 1].x} ${chartH} L ${pts[0].x} ${chartH} Z`
        : '';

    return { coords: pts, linePath: line, areaPath: area };
  }, [series]);

  const enabledCount = keys.filter((k) => k.enabled).length;

  return (
    <div className="space-y-3.5 pb-4">
      {/* 1. КАРТОЧКА АПТАЙМА И СТАТУСА ХОСТА (с живым WebGL Liquid Shader) */}
      <motion.div
        custom={0}
        variants={JELLY_ITEM_VARIANTS}
        initial="hidden"
        animate="visible"
      >
        <LiquidGlassCard strong shader shaderIntensity={0.85} className="p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="h-2.5 w-2.5 rounded-full bg-white animate-pulse-mono" />
              <span className="text-[12px] font-medium tracking-[0.14em] text-white/80 uppercase">
                Узел онлайн
              </span>
            </div>
            <span className="font-mono-tech rounded-full border border-white/15 bg-white/[0.06] px-2.5 py-0.5 text-[11px] text-white/75">
              {domain || 'host.local'}
            </span>
          </div>

          <div className="mt-4 flex items-baseline justify-between gap-2">
            <div>
              <div className="text-[11px] font-medium tracking-wider text-white/45 uppercase">
                Аптайм сервера
              </div>
              <div className="mt-1 flex items-baseline gap-1.5 font-mono-tech text-[28px] font-semibold tracking-tight text-white">
                <span>{formattedUptime.d}д</span>
                <span className="text-white/35">:</span>
                <span>{formattedUptime.h}ч</span>
                <span className="text-white/35">:</span>
                <span>{formattedUptime.m}м</span>
                <span className="text-[16px] font-normal text-white/50">
                  {formattedUptime.s}с
                </span>
              </div>
            </div>

            <div className="text-right">
              <div className="text-[11px] text-white/45">Статус узла</div>
              <div className="font-mono-tech mt-0.5 text-[15px] font-semibold text-white">
                {stats ? 'В сети' : 'Ожидание'}
              </div>
            </div>
          </div>

          {/* 28-сегментная монохромная шкала аптайма */}
          <div className="mt-4">
            <div className="flex h-6 items-end gap-[3.5px]">
              {UPTIME_SEGMENTS.map((val, idx) => (
                <motion.div
                  key={idx}
                  initial={{ scaleY: 0.2, opacity: 0 }}
                  animate={{ scaleY: 1, opacity: val }}
                  transition={{
                    delay: 0.08 + idx * 0.012,
                    type: 'spring',
                    stiffness: 420,
                    damping: 20,
                  }}
                  style={{
                    height: `${Math.round(val * 100)}%`,
                    originY: 1,
                  }}
                  className="flex-1 rounded-full bg-white/85 shadow-[0_0_8px_rgba(255,255,255,0.22)]"
                />
              ))}
            </div>
            <div className="mt-2 flex items-center justify-between text-[11px] text-white/40">
              <span>28 дней назад</span>
              <span>{enabledCount} активн. из {keys.length} в /sub</span>
              <span>Сейчас</span>
            </div>
          </div>
        </LiquidGlassCard>
      </motion.div>

      {/* 2. КАРТОЧКА ИНТЕРАКТИВНОГО ГРАФИКА ТРАФИКА */}
      <motion.div
        custom={1}
        variants={JELLY_ITEM_VARIANTS}
        initial="hidden"
        animate="visible"
      >
        <LiquidGlassCard className="p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-[12px] font-medium text-white/50">
                {activePoint ? `Точка · ${activePoint.label}` : 'Трафик за период'}
              </div>
              <div className="font-mono-tech mt-0.5 text-[26px] font-semibold tracking-tight text-white">
                {activePoint ? `${activePoint.totalGb.toFixed(1)}` : periodTotals.total}{' '}
                <span className="text-[14px] font-normal text-white/50">ГБ</span>
              </div>
            </div>

            {/* Желейный переключатель периодов */}
            <div className="flex items-center rounded-[14px] border border-white/14 bg-white/[0.04] p-1">
              {PERIODS.map((p) => {
                const isSelected = period === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      triggerHaptic('selection');
                      setPeriod(p.id);
                      setSelectedIndex(null);
                    }}
                    className="relative cursor-pointer px-2.5 py-1 text-[12px] font-medium transition-colors"
                  >
                    {isSelected && (
                      <motion.span
                        layoutId="traffic-period-pill"
                        transition={JELLY_SNAP}
                        className="absolute inset-0 rounded-[10px] bg-white shadow-[0_2px_10px_rgba(255,255,255,0.25)]"
                      />
                    )}
                    <span
                      className={`relative z-10 ${
                        isSelected ? 'text-black font-semibold' : 'text-white/55'
                      }`}
                    >
                      {p.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Детализация Вход / Исход */}
          <div className="mt-2 flex items-center gap-4 text-[12px] text-white/60">
            <span className="inline-flex items-center gap-1 font-mono-tech">
              <ArrowDownLeft className="h-3.5 w-3.5 text-white/80" />
              {activePoint ? activePoint.downGb.toFixed(1) : periodTotals.down} ГБ
            </span>
            <span className="inline-flex items-center gap-1 font-mono-tech">
              <ArrowUpRight className="h-3.5 w-3.5 text-white/55" />
              {activePoint ? activePoint.upGb.toFixed(1) : periodTotals.up} ГБ
            </span>
          </div>

          {/* Монохромный гладкий график */}
          <div className="relative mt-4">
            <svg
              viewBox={`0 0 ${chartW} ${chartH}`}
              className="h-[132px] w-full overflow-visible select-none"
              onPointerLeave={() => setSelectedIndex(null)}
            >
              <defs>
                <linearGradient id="monoAreaGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#ffffff" stopOpacity="0.34" />
                  <stop offset="70%" stopColor="#ffffff" stopOpacity="0.06" />
                  <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
                </linearGradient>
                <filter id="lineGlow" x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="3" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>

              {/* Тонкие направляющие */}
              {[0.25, 0.6, 0.92].map((ratio, idx) => (
                <line
                  key={idx}
                  x1={padX}
                  x2={chartW - padX}
                  y1={chartH * ratio}
                  y2={chartH * ratio}
                  stroke="rgba(255,255,255,0.07)"
                  strokeDasharray="3 5"
                  strokeWidth="1"
                />
              ))}

              {/* Заливка под кривой */}
              <motion.path
                key={`area-${period}`}
                d={areaPath}
                fill="url(#monoAreaGrad)"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.38 }}
              />

              {/* Основная кривая */}
              <motion.path
                key={`line-${period}`}
                d={linePath}
                fill="none"
                stroke="#ffffff"
                strokeWidth="2.2"
                strokeLinecap="round"
                filter="url(#lineGlow)"
                initial={{ pathLength: 0.05, opacity: 0.4 }}
                animate={{ pathLength: 1, opacity: 1 }}
                transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
              />

              {/* Вертикальная линия выбранной точки */}
              {selectedIndex !== null && coords[selectedIndex] && (
                <line
                  x1={coords[selectedIndex].x}
                  x2={coords[selectedIndex].x}
                  y1={padTop - 4}
                  y2={chartH}
                  stroke="rgba(255,255,255,0.3)"
                  strokeDasharray="2 3"
                  strokeWidth="1"
                />
              )}

              {/* Интерактивные зоны и точки */}
              {coords.map((pt, idx) => {
                const isSelected = selectedIndex === idx;
                const isLastDefault =
                  selectedIndex === null && idx === coords.length - 1;
                return (
                  <g key={`${period}-${idx}`}>
                    {(isSelected || isLastDefault) && (
                      <>
                        <circle
                          cx={pt.x}
                          cy={pt.y}
                          r={isSelected ? 9 : 7}
                          fill="rgba(255,255,255,0.18)"
                        />
                        <circle
                          cx={pt.x}
                          cy={pt.y}
                          r={3.8}
                          fill="#ffffff"
                          stroke="#000000"
                          strokeWidth="1.5"
                        />
                      </>
                    )}
                    <rect
                      x={pt.x - 18}
                      y={0}
                      width={36}
                      height={chartH}
                      fill="transparent"
                      className="cursor-pointer"
                      onPointerEnter={() => setSelectedIndex(idx)}
                      onClick={() => {
                        triggerHaptic('selection');
                        setSelectedIndex(isSelected ? null : idx);
                      }}
                    />
                  </g>
                );
              })}
            </svg>

            {/* Подписи оси X */}
            <div className="mt-1.5 flex items-center justify-between px-1 font-mono-tech text-[10px] text-white/40">
              <span>{series[0]?.label}</span>
              <span>{series[Math.floor(series.length / 2)]?.label}</span>
              <span>{series[series.length - 1]?.label}</span>
            </div>
          </div>
        </LiquidGlassCard>
      </motion.div>

      {/* 3. КОМПАКТНАЯ СЕТКА: ПОТРАЧЕНО И РЕСУРСЫ ХОСТА */}
      <div className="grid grid-cols-2 gap-3.5">
        <motion.div
          custom={2}
          variants={JELLY_ITEM_VARIANTS}
          initial="hidden"
          animate="visible"
        >
          <LiquidGlassCard className="h-full p-4">
            <div className="flex items-center justify-between text-white/50">
              <span className="text-[12px] font-medium">Потрачено</span>
              <HardDrive className="h-3.5 w-3.5 text-white/45" />
            </div>
            <div className="font-mono-tech mt-2.5 text-[22px] font-semibold tracking-tight text-white">
              {Number(periodTotals.total || 0).toFixed(1)}{' '}
              <span className="text-[12px] font-normal text-white/45">ГБ</span>
            </div>
            <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
              <motion.div
                initial={{ width: 0 }}
                animate={{
                  width: `${Math.max(
                    0,
                    Math.min(100, (Number(periodTotals.total || 0) / 1000) * 100)
                  )}%`,
                }}
                transition={{ delay: 0.2, type: 'spring', stiffness: 180, damping: 20 }}
                className="h-full rounded-full bg-white shadow-[0_0_10px_rgba(255,255,255,0.55)]"
              />
            </div>
            <div className="mt-2 font-mono-tech text-[11px] text-white/40">
              {((Number(periodTotals.total || 0) / 1000) * 100).toFixed(1)}% от 1 ТБ / мес
            </div>
          </LiquidGlassCard>
        </motion.div>

        <motion.div
          custom={3}
          variants={JELLY_ITEM_VARIANTS}
          initial="hidden"
          animate="visible"
        >
          <LiquidGlassCard className="h-full p-4">
            <div className="flex items-center justify-between text-white/50">
              <span className="text-[12px] font-medium">Хост</span>
              <Cpu className="h-3.5 w-3.5 text-white/45" />
            </div>

            <div className="mt-3 space-y-2.5">
              <div>
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-white/50">CPU</span>
                  <span className="font-mono-tech text-white">
                    {stats
                      ? stats.cpuUsagePercent < 1.0
                        ? `${stats.cpuUsagePercent.toFixed(1)}%`
                        : `${Math.round(stats.cpuUsagePercent)}%`
                      : '—'}
                  </span>
                </div>
                <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{
                      width: stats
                        ? `${Math.min(100, Math.max(3, Math.round(stats.cpuUsagePercent)))}%`
                        : '0%',
                    }}
                    transition={{ delay: 0.25, type: 'spring', stiffness: 180, damping: 20 }}
                    className="h-full rounded-full bg-white"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-white/50">RAM</span>
                  <span className="font-mono-tech text-white">
                    {stats && stats.memoryTotalMb > 0
                      ? `${Math.round((stats.memoryUsedMb / stats.memoryTotalMb) * 100)}% (${stats.memoryUsedMb} МБ / ${stats.memoryTotalMb} МБ)`
                      : '—'}
                  </span>
                </div>
                <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{
                      width:
                        stats && stats.memoryTotalMb > 0
                          ? `${Math.min(
                              100,
                              Math.max(
                                3,
                                Math.round((stats.memoryUsedMb / stats.memoryTotalMb) * 100)
                              )
                            )}%`
                          : '0%',
                    }}
                    transition={{ delay: 0.3, type: 'spring', stiffness: 180, damping: 20 }}
                    className="h-full rounded-full bg-white/80"
                  />
                </div>
              </div>
            </div>
          </LiquidGlassCard>
        </motion.div>
      </div>
    </div>
  );
};
