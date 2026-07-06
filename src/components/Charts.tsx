import React, { useState } from 'react';
import { useTranslation } from '../context/LanguageContext.tsx';

// ==========================================
// 1. CASH FLOW DOUBLE BAR CHART
// ==========================================
interface TrendData {
  month: string;
  year: number;
  income: number;
  expense: number;
}

export const CashFlowChart: React.FC<{ data: TrendData[] }> = ({ data }) => {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const [hoveredType, setHoveredType] = useState<'income' | 'expense' | null>(null);
  const { t } = useTranslation();

  if (!data || data.length === 0) return <div className="text-xs text-slate-400 py-6 text-center">{t("No trend data available")}</div>;

  const maxVal = Math.max(...data.flatMap(d => [d.income, d.expense]), 1000);
  const chartHeight = 150;
  const chartWidth = 500;
  const paddingLeft = 40;
  const paddingRight = 10;
  const paddingTop = 20;
  const paddingBottom = 20;

  const innerHeight = chartHeight - paddingTop - paddingBottom;
  const innerWidth = chartWidth - paddingLeft - paddingRight;

  const colWidth = innerWidth / data.length;
  const barWidth = 14;

  return (
    <div className="relative w-full">
      <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="w-full h-full overflow-visible">
        {/* Horizontal Grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
          const y = paddingTop + innerHeight * (1 - ratio);
          const val = Math.round(maxVal * ratio);
          return (
            <g key={ratio} className="opacity-30 dark:opacity-20">
              <line x1={paddingLeft} y1={y} x2={chartWidth - paddingRight} y2={y} stroke="gray" strokeDasharray="3" />
              <text x={paddingLeft - 8} y={y + 3} textAnchor="end" className="fill-slate-400 font-medium text-[8px]">${val}</text>
            </g>
          );
        })}

        {/* Render columns */}
        {data.map((d, idx) => {
          const colX = paddingLeft + idx * colWidth;
          const centerX = colX + colWidth / 2;

          // Heights
          const incHeight = (d.income / maxVal) * innerHeight;
          const expHeight = (d.expense / maxVal) * innerHeight;

          // Y offsets
          const incY = paddingTop + innerHeight - incHeight;
          const expY = paddingTop + innerHeight - expHeight;

          const xInc = centerX - barWidth - 2;
          const xExp = centerX + 2;

          return (
            <g key={idx}>
              {/* Income bar */}
              <rect
                x={xInc}
                y={incY}
                width={barWidth}
                height={Math.max(incHeight, 2)}
                rx={3}
                className="fill-blue-500 hover:fill-blue-600 transition-colors cursor-pointer"
                onMouseEnter={() => {
                  setHoveredIdx(idx);
                  setHoveredType('income');
                }}
                onMouseLeave={() => {
                  setHoveredIdx(null);
                  setHoveredType(null);
                }}
              />

              {/* Expense bar */}
              <rect
                x={xExp}
                y={expY}
                width={barWidth}
                height={Math.max(expHeight, 2)}
                rx={3}
                className="fill-purple-500 hover:fill-purple-600 transition-colors cursor-pointer"
                onMouseEnter={() => {
                  setHoveredIdx(idx);
                  setHoveredType('expense');
                }}
                onMouseLeave={() => {
                  setHoveredIdx(null);
                  setHoveredType(null);
                }}
              />

              {/* Month label */}
              <text
                x={centerX}
                y={chartHeight - 4}
                textAnchor="middle"
                className="fill-slate-500 dark:fill-slate-400 font-semibold text-[9px]"
              >
                {d.month}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Dynamic Hover Tooltip overlay */}
      {hoveredIdx !== null && hoveredType !== null && (
        <div 
          className="absolute bg-slate-900/90 text-white rounded-lg p-2 text-[10px] shadow-lg pointer-events-none"
          style={{
            left: `${paddingLeft + hoveredIdx * (innerWidth / data.length) + 15}px`,
            top: '5px'
          }}
        >
          <p className="font-bold text-slate-300">{data[hoveredIdx].month} {data[hoveredIdx].year}</p>
          <p className="capitalize flex items-center gap-1 mt-0.5">
            <span className={`w-1.5 h-1.5 rounded-full ${hoveredType === 'income' ? 'bg-blue-400' : 'bg-purple-400'}`} />
            {t(hoveredType === 'income' ? 'Income' : 'Expenses')}: <b>${(hoveredType === 'income' ? data[hoveredIdx].income : data[hoveredIdx].expense).toLocaleString(undefined, { minimumFractionDigits: 2 })}</b>
          </p>
        </div>
      )}
    </div>
  );
};

// ==========================================
// 2. CATEGORY DONUT CHART (Interactive Slices)
// ==========================================
interface CatData {
  category: string;
  value: number;
}

export const CategoryPieChart: React.FC<{ data: CatData[] }> = ({ data }) => {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const { t } = useTranslation();

  if (!data || data.length === 0) {
    return <div className="text-xs text-slate-400 py-12 text-center">{t("No categories registered this month")}</div>;
  }

  const colors = ['#3b82f6', '#a855f7', '#06b6d4', '#eab308', '#ec4899', '#f97316', '#10b981'];
  const total = data.reduce((sum, item) => sum + item.value, 0);

  // Compute SVG arc configurations
  let accumulatedAngle = 0;
  const radius = 35;
  const strokeWidth = 10;
  const circumference = 2 * Math.PI * radius;

  const slices = data.map((item, idx) => {
    const percentage = item.value / total;
    const strokeLength = percentage * circumference;
    const strokeOffset = circumference - strokeLength + accumulatedAngle;
    accumulatedAngle -= strokeLength;

    return {
      label: item.category,
      value: item.value,
      color: colors[idx % colors.length],
      strokeDasharray: `${strokeLength} ${circumference}`,
      strokeDashoffset: strokeOffset,
      pct: Math.round(percentage * 100)
    };
  });

  return (
    <div className="flex flex-col sm:flex-row items-center gap-6 justify-center w-full">
      {/* SVG Ring Graphic */}
      <div className="relative w-36 h-36 shrink-0 flex items-center justify-center">
        <svg viewBox="0 0 100 100" className="w-full h-full transform -rotate-90">
          <circle cx="50" cy="50" r={radius} stroke="transparent" strokeWidth={strokeWidth} fill="transparent" />
          {slices.map((slice, idx) => (
            <circle
              key={idx}
              cx="50"
              cy="50"
              r={radius}
              stroke={slice.color}
              strokeWidth={strokeWidth}
              fill="transparent"
              strokeDasharray={slice.strokeDasharray}
              strokeDashoffset={slice.strokeDashoffset}
              strokeLinecap="round"
              className="origin-center hover:scale-[1.04] transition-all cursor-pointer duration-200"
              style={{ transformBox: 'fill-box' }}
              onMouseEnter={() => setHoveredIdx(idx)}
              onMouseLeave={() => setHoveredIdx(null)}
            />
          ))}
        </svg>

        {/* Center label */}
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/70 dark:bg-slate-900/60 rounded-full w-24 h-24 m-auto shadow-inner text-center backdrop-blur-sm pointer-events-none">
          <span className="text-[9px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider">
            {hoveredIdx !== null ? t(slices[hoveredIdx].label) : t('Total Spent')}
          </span>
          <span className="font-poppins font-extrabold text-xs text-slate-800 dark:text-white mt-0.5">
            ${(hoveredIdx !== null ? slices[hoveredIdx].value : total).toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </span>
          {hoveredIdx !== null && (
            <span className="text-[9px] font-bold text-blue-600 dark:text-blue-400">
              {slices[hoveredIdx].pct}%
            </span>
          )}
        </div>
      </div>

      {/* Grid Legends */}
      <div className="flex-1 flex flex-col gap-1.5 w-full">
        {slices.map((slice, idx) => (
          <div 
            key={idx} 
            className={`flex justify-between items-center text-xs p-1.5 rounded-lg transition-colors ${
              hoveredIdx === idx ? 'bg-slate-100 dark:bg-slate-800/40' : ''
            }`}
            onMouseEnter={() => setHoveredIdx(idx)}
            onMouseLeave={() => setHoveredIdx(null)}
          >
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full inline-block shrink-0" style={{ backgroundColor: slice.color }} />
              <span className="font-semibold text-slate-700 dark:text-slate-300">{t(slice.label)}</span>
            </div>
            <div className="text-right">
              <span className="font-bold text-slate-900 dark:text-white">${slice.value.toFixed(2)}</span>
              <span className="text-[10px] text-slate-400 dark:text-slate-500 ml-1.5">({slice.pct}%)</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// ==========================================
// 3. NET WORTH 3-MONTH FORECASTING AREA CHART
// ==========================================
interface ForecastData {
  month: string;
  projectedBalance: number;
}

export const ForecastAreaChart: React.FC<{ data: ForecastData[]; currentBalance: number }> = ({ data, currentBalance }) => {
  if (!data || data.length === 0) return null;

  // Insert current balance as the baseline start point
  const points = [{ month: 'Now', projectedBalance: currentBalance }, ...data];
  const balances = points.map(p => p.projectedBalance);
  
  const minVal = Math.min(...balances) * 0.98;
  const maxVal = Math.max(...balances) * 1.02;

  const chartHeight = 110;
  const chartWidth = 400;
  const paddingLeft = 10;
  const paddingRight = 10;
  const paddingTop = 15;
  const paddingBottom = 15;

  const innerHeight = chartHeight - paddingTop - paddingBottom;
  const innerWidth = chartWidth - paddingLeft - paddingRight;

  // Compute SVG points
  const svgPoints = points.map((p, idx) => {
    const x = paddingLeft + (idx / (points.length - 1)) * innerWidth;
    const y = paddingTop + innerHeight - ((p.projectedBalance - minVal) / (maxVal - minVal)) * innerHeight;
    return { x, y, label: p.month, val: p.projectedBalance };
  });

  const linePath = svgPoints.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const areaPath = `${linePath} L ${svgPoints[svgPoints.length - 1].x} ${chartHeight - paddingBottom} L ${svgPoints[0].x} ${chartHeight - paddingBottom} Z`;

  return (
    <div className="relative w-full flex flex-col">
      <div className="flex-1">
        <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="w-full h-full overflow-visible">
          {/* Shaded Area */}
          <path d={areaPath} fill="url(#forecastGradient)" className="opacity-30 dark:opacity-20" />

          {/* Line Path */}
          <path d={linePath} fill="transparent" stroke="#3b82f6" strokeWidth="2.5" strokeLinecap="round" />

          {/* Points circles and labels */}
          {svgPoints.map((p, idx) => (
            <g key={idx}>
              <circle cx={p.x} cy={p.y} r="3.5" fill="#3b82f6" stroke="white" strokeWidth="1.5" />
              <text 
                x={p.x} 
                y={p.y - 7} 
                textAnchor="middle" 
                className="fill-slate-800 dark:fill-white font-extrabold text-[8px]"
              >
                ${Math.round(p.val / 1000)}k
              </text>
              <text 
                x={p.x} 
                y={chartHeight - 2} 
                textAnchor="middle" 
                className="fill-slate-400 font-semibold text-[8px]"
              >
                {p.label}
              </text>
            </g>
          ))}

          {/* Linear Gradient Definition */}
          <defs>
            <linearGradient id="forecastGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#3b82f6" />
              <stop offset="100%" stopColor="transparent" />
            </linearGradient>
          </defs>
        </svg>
      </div>
    </div>
  );
};
