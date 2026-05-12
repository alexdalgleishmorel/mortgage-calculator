// Stacked-area chart with optional scenario overlay. Pure SVG, no chart lib.

const { useState, useRef, useMemo, useCallback, useEffect } = React;

function AreaChart({ result, resultB, compareMode, lumpSums = [], lumpSumsB = [] }) {
  const wrapRef = useRef(null);
  const [size, setSize] = useState({ w: 800, h: 380 });
  const [hover, setHover] = useState(null); // { x, idx }

  useEffect(() => {
    if (!wrapRef.current) return;
    const ro = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      setSize({ w: Math.max(320, width), h: Math.max(220, height) });
    });
    ro.observe(wrapRef.current);
    return () => ro.disconnect();
  }, []);

  const hasData = (result?.schedule?.length || 0) > 0 || (resultB?.schedule?.length || 0) > 0;

  const padding = { top: 16, right: 16, bottom: 28, left: 56 };
  const W = size.w;
  const H = size.h;
  const innerW = W - padding.left - padding.right;
  const innerH = H - padding.top - padding.bottom;

  // Build the chart from the longest schedule so both fit on the same axis
  const schedA = result?.schedule || [];
  const schedB = resultB?.schedule || [];
  const maxLen = Math.max(schedA.length, schedB.length);

  // X domain: payment count (0..maxLen-1)
  // Y domain: max of any series we'll show
  const cumulativeMaxA = schedA.length ? Math.max(schedA[schedA.length-1].cumPrincipal + schedA[schedA.length-1].cumInterest, schedA[0].remaining) : 0;
  const cumulativeMaxB = schedB.length ? Math.max(schedB[schedB.length-1].cumPrincipal + schedB[schedB.length-1].cumInterest, schedB[0].remaining) : 0;
  const yMax = Math.max(cumulativeMaxA, cumulativeMaxB) * 1.05 || 1;

  const xScale = (i) => padding.left + (i / Math.max(1, maxLen - 1)) * innerW;
  const yScale = (v) => padding.top + innerH - (v / yMax) * innerH;

  // Build paths
  const buildAreas = (sched) => {
    if (!sched.length) return { principalArea: '', interestArea: '', remainingLine: '' };
    // Stacked: interest from 0 to cumInterest, principal stacked on top from cumInterest to cumInterest+cumPrincipal
    const pts = sched;
    const interestTopPts = pts.map((p, i) => `${xScale(i)},${yScale(p.cumInterest)}`);
    const principalTopPts = pts.map((p, i) => `${xScale(i)},${yScale(p.cumInterest + p.cumPrincipal)}`);
    const baseline = `${xScale(pts.length-1)},${yScale(0)} ${xScale(0)},${yScale(0)}`;
    const interestArea = `M ${interestTopPts.join(' L ')} L ${baseline} Z`;
    const principalArea = `M ${principalTopPts.join(' L ')} L ${interestTopPts.slice().reverse().join(' L ')} Z`;
    const remainingLine = `M ${pts.map((p,i)=> `${xScale(i)},${yScale(p.remaining)}`).join(' L ')}`;
    return { principalArea, interestArea, remainingLine };
  };

  const A = buildAreas(schedA);
  const B = buildAreas(schedB);

  // Total-cost area (compare mode): cumPrincipal+cumInterest single area
  const buildTotalArea = (sched) => {
    if (!sched.length) return '';
    const pts = sched.map((p,i) => `${xScale(i)},${yScale(p.cumPrincipal + p.cumInterest)}`);
    const baseline = `${xScale(sched.length-1)},${yScale(0)} ${xScale(0)},${yScale(0)}`;
    return `M ${pts.join(' L ')} L ${baseline} Z`;
  };
  const totalLineA = schedA.length ? `M ${schedA.map((p,i)=>`${xScale(i)},${yScale(p.cumPrincipal + p.cumInterest)}`).join(' L ')}` : '';
  const totalLineB = schedB.length ? `M ${schedB.map((p,i)=>`${xScale(i)},${yScale(p.cumPrincipal + p.cumInterest)}`).join(' L ')}` : '';
  const totalAreaA = buildTotalArea(schedA);
  const totalAreaB = buildTotalArea(schedB);

  // Y axis ticks
  const yTicks = useMemo(() => {
    const step = niceStep(yMax / 5);
    const out = [];
    for (let v = 0; v <= yMax; v += step) out.push(v);
    return out;
  }, [yMax]);

  // X axis ticks - 4 markers
  const longest = schedA.length >= schedB.length ? schedA : schedB;
  const xTicks = useMemo(() => {
    if (!longest.length) return [];
    const n = longest.length;
    const idxs = [0, Math.floor(n*0.33), Math.floor(n*0.66), n-1];
    return idxs.map(i => ({ i, date: longest[i].dateObj }));
  }, [longest]);

  // Hover
  const onMove = useCallback((e) => {
    const svg = e.currentTarget;
    const rect = svg.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * W;
    if (x < padding.left || x > W - padding.right) { setHover(null); return; }
    const t = (x - padding.left) / innerW;
    const idx = Math.round(t * (maxLen - 1));
    setHover({ x: xScale(idx), idx });
  }, [W, innerW, maxLen]);

  // Lump-sum markers — show on scenario A by default (or both)
  const lumpMarkers = useMemo(() => {
    const list = [];
    const map = new Map();
    schedA.forEach((p, i) => map.set(p.date, i));
    for (const ls of (compareMode ? lumpSumsB : lumpSums)) {
      if (!ls.date || !ls.amount) continue;
      // Find first payment on/after the lump date
      const targetIdx = schedA.findIndex(p => p.date >= ls.date);
      if (targetIdx >= 0) list.push({ idx: targetIdx, amount: ls.amount, date: ls.date });
    }
    return list;
  }, [schedA, lumpSums, lumpSumsB, compareMode]);

  const hoverDataA = hover && schedA[Math.min(hover.idx, schedA.length-1)];
  const hoverDataB = hover && schedB[Math.min(hover.idx, schedB.length-1)];
  const tooltipX = hover ? hover.x : 0;
  const tooltipPos = tooltipX > W / 2 ? -1 : 1;

  if (!hasData || maxLen === 0) {
    return (
      <div className="chart-wrap empty-chart" ref={wrapRef}>
        <div className="empty-illustration">
          <svg width="120" height="80" viewBox="0 0 120 80" fill="none" aria-hidden>
            <path d="M8 70 L8 12 M8 70 L112 70" stroke="currentColor" strokeOpacity=".25" strokeWidth="1.2" strokeLinecap="round"/>
            <path d="M14 60 Q40 56 56 44 T108 16" stroke="var(--remaining)" strokeOpacity=".55" strokeWidth="1.6" strokeDasharray="4 4" fill="none" strokeLinecap="round"/>
            <path d="M14 66 Q40 60 56 48 T108 22 L108 70 L14 70 Z" fill="var(--principal)" fillOpacity=".18"/>
            <path d="M14 68 Q40 64 56 56 T108 38 L108 70 L14 70 Z" fill="var(--interest)" fillOpacity=".22"/>
          </svg>
        </div>
        <div className="empty-title">Your chart appears here</div>
        <div className="empty-sub">Enter a <strong>purchase price</strong> in the configuration below to see where your payments go over time.</div>
      </div>
    );
  }

  return (
    <div ref={wrapRef} className="chart-wrap">
      <svg
        className="chart-svg"
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        onMouseMove={onMove}
        onMouseLeave={() => setHover(null)}
      >
        <defs>
          <linearGradient id="grad-principal" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="var(--principal)" stopOpacity="0.55" />
            <stop offset="100%" stopColor="var(--principal)" stopOpacity="0.10" />
          </linearGradient>
          <linearGradient id="grad-interest" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="var(--interest)" stopOpacity="0.45" />
            <stop offset="100%" stopColor="var(--interest)" stopOpacity="0.08" />
          </linearGradient>
        </defs>

        {/* Grid */}
        {yTicks.map((v) => (
          <g key={v}>
            <line className="grid-line" x1={padding.left} x2={W - padding.right} y1={yScale(v)} y2={yScale(v)} />
            <text className="axis-label" x={padding.left - 8} y={yScale(v)} textAnchor="end" dominantBaseline="central">
              {compactMoney(v)}
            </text>
          </g>
        ))}

        {/* X axis labels */}
        {xTicks.map((t) => (
          <text key={t.i} className="axis-label" x={xScale(t.i)} y={H - padding.bottom + 16} textAnchor="middle">
            {t.date.toLocaleDateString('en-CA', { month: 'short', year: 'numeric' })}
          </text>
        ))}

        {/* Areas / lines */}
        {!compareMode && (
          <>
            <path className="area-interest" d={A.interestArea} />
            <path className="area-principal" d={A.principalArea} />
            <path className="line-remaining" d={A.remainingLine} />
          </>
        )}
        {compareMode && (
          <>
            <path className="scen-area-a" d={totalAreaA} />
            <path className="scen-area-b" d={totalAreaB} />
            <path className="scen-line-a" d={totalLineA} />
            <path className="scen-line-b" d={totalLineB} />
          </>
        )}

        {/* Lump-sum markers */}
        {lumpMarkers.map((m, i) => (
          <g key={i}>
            <line className="grid-line" x1={xScale(m.idx)} x2={xScale(m.idx)}
                  y1={padding.top} y2={H - padding.bottom}
                  style={{ stroke: 'var(--gold)', opacity: 0.4, strokeDasharray: '2 3' }} />
            <circle className="lump-marker" cx={xScale(m.idx)} cy={padding.top + 8} r="5" />
          </g>
        ))}

        {/* Hover */}
        {hover && (
          <g>
            <line className="cursor-line" x1={hover.x} x2={hover.x} y1={padding.top} y2={H - padding.bottom} />
            {!compareMode && hoverDataA && (
              <circle className="cursor-dot" cx={hover.x} cy={yScale(hoverDataA.remaining)} r="5" />
            )}
            {compareMode && hoverDataA && (
              <circle cx={hover.x} cy={yScale(hoverDataA.cumPrincipal + hoverDataA.cumInterest)} r="4"
                      fill="var(--scenario-a)" stroke="white" strokeWidth="1.5" />
            )}
            {compareMode && hoverDataB && (
              <circle cx={hover.x} cy={yScale(hoverDataB.cumPrincipal + hoverDataB.cumInterest)} r="4"
                      fill="var(--scenario-b)" stroke="white" strokeWidth="1.5" />
            )}
          </g>
        )}
      </svg>

      {hover && (hoverDataA || hoverDataB) && (
        <div className="chart-tooltip" style={{
          left: `${(tooltipX / W) * 100}%`,
          top: '50%',
          transform: `translate(${tooltipPos > 0 ? '12px' : 'calc(-100% - 12px)'}, -50%)`,
        }}>
          <div className="tooltip-date">{(hoverDataA || hoverDataB).dateObj.toLocaleDateString('en-CA', { month: 'long', day: 'numeric', year: 'numeric' })}</div>
          {!compareMode && hoverDataA && (
            <>
              <div className="tooltip-row">
                <span><span className="tooltip-swatch" style={{background:'var(--principal)'}}></span>Principal paid</span>
                <span>{MortgageMath.moneyExact(hoverDataA.principalPaid)}</span>
              </div>
              <div className="tooltip-row">
                <span><span className="tooltip-swatch" style={{background:'var(--interest)'}}></span>Interest paid</span>
                <span>{MortgageMath.moneyExact(hoverDataA.interestPaid)}</span>
              </div>
              <div className="tooltip-row divider">
                <span>Remaining</span>
                <span>{MortgageMath.money(hoverDataA.remaining)}</span>
              </div>
              {hoverDataA.extraThisPayment > 0 && (
                <div className="tooltip-row" style={{ color: 'var(--gold)' }}>
                  <span>+ Extra</span>
                  <span>{MortgageMath.money(hoverDataA.extraThisPayment)}</span>
                </div>
              )}
            </>
          )}
          {compareMode && (
            <>
              {hoverDataA && (
                <div className="tooltip-row">
                  <span><span className="tooltip-swatch" style={{background:'var(--scenario-a)'}}></span>Scenario A total</span>
                  <span>{MortgageMath.money(hoverDataA.cumPrincipal + hoverDataA.cumInterest)}</span>
                </div>
              )}
              {hoverDataB && (
                <div className="tooltip-row">
                  <span><span className="tooltip-swatch" style={{background:'var(--scenario-b)'}}></span>Scenario B total</span>
                  <span>{MortgageMath.money(hoverDataB.cumPrincipal + hoverDataB.cumInterest)}</span>
                </div>
              )}
              {hoverDataA && hoverDataB && (
                <div className="tooltip-row divider">
                  <span>Difference</span>
                  <span>{MortgageMath.money(Math.abs((hoverDataA.cumPrincipal+hoverDataA.cumInterest) - (hoverDataB.cumPrincipal+hoverDataB.cumInterest)))}</span>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function niceStep(raw) {
  const exp = Math.floor(Math.log10(raw));
  const base = Math.pow(10, exp);
  const n = raw / base;
  let nice;
  if (n < 1.5) nice = 1;
  else if (n < 3) nice = 2;
  else if (n < 7) nice = 5;
  else nice = 10;
  return nice * base;
}

function compactMoney(n) {
  if (n === 0) return '$0';
  if (Math.abs(n) >= 1e6) return '$' + (n/1e6).toFixed(n >= 1e7 ? 0 : 1).replace(/\.0$/, '') + 'M';
  if (Math.abs(n) >= 1e3) return '$' + Math.round(n/1e3) + 'k';
  return '$' + Math.round(n);
}

window.AreaChart = AreaChart;
