// Main app — single-screen liquid-glass mortgage visualizer with scenario A/B
// compare mode, one-off lump sums, recurring extras. CAD defaults.

const { useState, useEffect, useMemo, useRef } = React;

const DEFAULTS = {
  purchasePrice: 0,
  downPayment: 0,
  interestRate: 5.25,
  termYears: 25,
  frequency: 'monthly',
  recurringExtra: 0,
  lumpSums: [],
  startDate: '2026-06-01',
};

const DEFAULTS_B = {
  ...DEFAULTS,
  recurringExtra: 200,
  frequency: 'accelerated-bi-weekly',
};

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-01`;
}

function useScenario(initial) {
  const [s, setS] = useState(initial);
  const update = (key, val) => setS(prev => ({ ...prev, [key]: val }));
  const updateLumps = (lumps) => setS(prev => ({ ...prev, lumpSums: lumps }));
  return [s, update, updateLumps, setS];
}

function MoneyField({ label, value, onChange, secondary, min = 0, max = 100000000 }) {
  // Local string state so the user can clear the field without it snapping back
  const [draft, setDraft] = useState(null);
  const display = draft != null
    ? draft
    : (value === 0 ? '' : Number(value).toLocaleString('en-CA'));
  return (
    <div className="field">
      <div className="field-label">
        <span>{label}</span>
        {secondary && <span className="field-value">{secondary}</span>}
      </div>
      <div className="input-shell">
        <span className="prefix">$</span>
        <input
          type="text"
          inputMode="numeric"
          placeholder="0"
          value={display}
          onFocus={() => setDraft(value === 0 ? '' : String(value))}
          onBlur={() => setDraft(null)}
          onChange={(e) => {
            const raw = e.target.value.replace(/[^\d.]/g, '');
            setDraft(raw);
            const n = raw === '' ? 0 : (parseFloat(raw) || 0);
            onChange(Math.max(min, Math.min(max, n)));
          }}
        />
      </div>
    </div>
  );
}

function SliderField({ label, value, onChange, min, max, step, suffix, valueFormat }) {
  return (
    <div className="field slider-field">
      <div className="field-label">
        <span>{label}</span>
        <span className="field-value">{valueFormat ? valueFormat(value) : value + (suffix || '')}</span>
      </div>
      <div className="slider-shell">
        <input type="range" value={value} onChange={(e)=>onChange(Number(e.target.value))}
               min={min} max={max} step={step} />
      </div>
    </div>
  );
}

function Segmented({ label, value, onChange, options }) {
  return (
    <div className="field">
      <div className="field-label"><span>{label}</span></div>
      <div className="segmented">
        {options.map(o => (
          <button key={o.value}
                  className={value === o.value ? 'active' : ''}
                  onClick={() => onChange(o.value)}>{o.label}</button>
        ))}
      </div>
    </div>
  );
}

function LumpSumsField({ lumps, onChange, startDate }) {
  const add = () => {
    const d = new Date(startDate);
    d.setFullYear(d.getFullYear() + Math.max(1, lumps.length + 1));
    onChange([...lumps, { date: MortgageMath.fmtDate(d), amount: 5000 }]);
  };
  const update = (i, key, val) => {
    const next = lumps.slice();
    next[i] = { ...next[i], [key]: val };
    onChange(next);
  };
  const remove = (i) => onChange(lumps.filter((_, j) => j !== i));
  return (
    <div className="field">
      <div className="field-label">
        <span>One-off lump sums</span>
        <span className="field-value">{lumps.length} planned</span>
      </div>
      {lumps.length > 0 && (
        <div className="lumps">
          {lumps.map((ls, i) => (
            <div key={i} className="lump-row">
              <div className="input-shell">
                <input type="date" value={ls.date} onChange={(e)=>update(i,'date',e.target.value)} />
              </div>
              <div className="input-shell">
                <span className="prefix">$</span>
                <input type="text" inputMode="numeric" value={Number(ls.amount).toLocaleString('en-CA')}
                       onChange={(e)=>{
                         const raw = e.target.value.replace(/[^\d.]/g, '');
                         update(i,'amount', parseFloat(raw) || 0);
                       }} />
              </div>
              <button className="lump-remove" onClick={()=>remove(i)} aria-label="Remove">×</button>
            </div>
          ))}
        </div>
      )}
      <button className="lump-add" onClick={add}>+ Add lump-sum payment</button>
    </div>
  );
}

function RecurringExtraField({ scenario, update, basePayment }) {
  const mode = scenario.recurringExtraMode || '$';
  const [draft, setDraft] = useState(null);
  // Convert stored $ → display value depending on mode
  const displayVal = mode === '%'
    ? (basePayment > 0 ? (scenario.recurringExtra / basePayment * 100) : 0)
    : scenario.recurringExtra;
  const display = draft != null
    ? draft
    : (displayVal === 0 ? '' : (mode === '%' ? displayVal.toFixed(1) : Number(Math.round(displayVal)).toLocaleString('en-CA')));
  const dollarsForLabel = mode === '%'
    ? `≈ ${MortgageMath.money(scenario.recurringExtra)}/pmt`
    : (basePayment > 0 ? `${(scenario.recurringExtra / basePayment * 100).toFixed(1)}% of pmt` : '');
  return (
    <div className="field">
      <div className="field-label">
        <span>Recurring extra / payment</span>
        <span className="field-value">{dollarsForLabel}</span>
      </div>
      <div className="input-with-toggle">
        <div className="input-shell">
          <span className="prefix">{mode}</span>
          <input
            type="text"
            inputMode="decimal"
            placeholder="0"
            value={display}
            onFocus={() => setDraft(displayVal === 0 ? '' : String(mode === '%' ? displayVal.toFixed(1) : Math.round(displayVal)))}
            onBlur={() => setDraft(null)}
            onChange={(e) => {
              const raw = e.target.value.replace(/[^\d.]/g, '');
              setDraft(raw);
              const n = raw === '' ? 0 : (parseFloat(raw) || 0);
              const dollars = mode === '%'
                ? (basePayment > 0 ? (n / 100) * basePayment : 0)
                : n;
              update('recurringExtra', Math.max(0, dollars));
            }}
          />
        </div>
        <div className="mode-toggle">
          <button className={mode === '$' ? 'active' : ''} onClick={() => update('recurringExtraMode', '$')}>$</button>
          <button className={mode === '%' ? 'active' : ''} onClick={() => update('recurringExtraMode', '%')}>%</button>
        </div>
      </div>
    </div>
  );
}

function ScenarioInputs({ scenario, update, updateLumps, color, label, compact, basePayment }) {
  const downPct = scenario.purchasePrice > 0 ? (scenario.downPayment / scenario.purchasePrice * 100) : 0;
  return (
    <>
      {label && (
        <div className="compare-col-label">
          <span className="scenario-dot" style={{ background: `var(${color === 'a' ? '--scenario-a' : '--scenario-b'})`, color: `var(${color === 'a' ? '--scenario-a' : '--scenario-b'})` }}></span>
          {label}
        </div>
      )}
      <MoneyField label="Purchase price" value={scenario.purchasePrice}
                  onChange={v => update('purchasePrice', v)} />
      <MoneyField label="Down payment" value={scenario.downPayment}
                  secondary={`${downPct.toFixed(1)}%`}
                  onChange={v => update('downPayment', v)}
                  max={scenario.purchasePrice} />
      <SliderField label="Interest rate" value={scenario.interestRate}
                   onChange={v => update('interestRate', v)} min={0.5} max={12} step={0.05}
                   valueFormat={v => v.toFixed(2) + '%'} />
      <SliderField label="Amortization" value={scenario.termYears}
                   onChange={v => update('termYears', v)} min={5} max={30} step={1}
                   suffix=" yr" />
      <Segmented label="Payment frequency" value={scenario.frequency}
                 onChange={v => update('frequency', v)}
                 options={[
                   { value: 'monthly', label: 'Monthly' },
                   { value: 'bi-weekly', label: 'Bi-weekly' },
                   { value: 'accelerated-bi-weekly', label: 'Accel. bi-wk' },
                 ]} />
      <RecurringExtraField scenario={scenario} update={update} basePayment={basePayment} />
      <LumpSumsField lumps={scenario.lumpSums} onChange={updateLumps} startDate={scenario.startDate} />
      {!compact && (
        <div className="field">
          <div className="field-label"><span>Start date</span></div>
          <div className="input-shell">
            <input type="date" value={scenario.startDate}
                   onChange={(e)=>update('startDate', e.target.value)} />
          </div>
        </div>
      )}
    </>
  );
}

function ScenarioToggle({ mode, onChange }) {
  const idx = mode === 'compare' ? 1 : 0;
  return (
    <div className="scenario-toggle">
      <span className="scenario-thumb" style={{
        width: 'calc(50% - 5px)',
        transform: `translateX(${idx * 100}%)`,
      }}></span>
      <button className={mode === 'single' ? 'active' : ''} onClick={() => onChange('single')}>Single scenario</button>
      <button className={mode === 'compare' ? 'active' : ''} onClick={() => onChange('compare')}>Compare A · B</button>
    </div>
  );
}

function KpiHero({ result, baseline }) {
  const principalAmt = result.principal;
  const hasSchedule = result.schedule.length > 0;
  if (!hasSchedule || principalAmt <= 0) {
    return (
      <div className="kpi-hero glass">
        <div className="cost-headline">
          <div className="cost-amount" style={{fontSize:'34px'}}>Enter a price to begin</div>
          <div className="cost-headline-text">
            Add a purchase price and down payment — we&rsquo;ll show the full cost of borrowing,
            payoff date, and how extra payments change the timeline.
          </div>
        </div>
      </div>
    );
  }
  const interestRatio = principalAmt > 0 ? result.totalInterest / principalAmt : 0;
  const firstPmt = result.schedule[0];
  const daysToPayoff = (result.payoffDateObj - MortgageMath.parseDate(firstPmt.date)) / 86400000;
  const baseDays = baseline && baseline.schedule.length
    ? (baseline.payoffDateObj - MortgageMath.parseDate(baseline.schedule[0].date)) / 86400000
    : daysToPayoff;
  const interestSaved = baseline ? baseline.totalInterest - result.totalInterest : 0;
  const daysSaved = baseline ? baseDays - daysToPayoff : 0;

  return (
    <div className="kpi-hero glass">
      <div className="cost-headline">
        <div className="cost-amount">
          <span className="currency">$</span>{Math.round(result.totalInterest).toLocaleString('en-CA')}
        </div>
        <div className="cost-headline-text">
          extra you'll pay in <span className="interest-word">interest</span> — that's <strong>{(interestRatio * 100).toFixed(0)}¢</strong> of <span className="interest-word">interest</span> for every dollar you borrow.
        </div>
      </div>
      <div className="kpi-row">
        <div className="kpi">
          <div className="kpi-label">Each payment</div>
          <div className="kpi-value">{MortgageMath.moneyExact(result.basePayment + (firstPmt.extraThisPayment || 0))}</div>
          <div className="kpi-sub">{
            firstPmt.extraThisPayment > 0
              ? `incl. ${MortgageMath.money(firstPmt.extraThisPayment)} extra`
              : 'principal + interest'
          }</div>
        </div>
        <div className="kpi principal">
          <div className="kpi-label">Financed</div>
          <div className="kpi-value">{MortgageMath.money(principalAmt)}</div>
          <div className="kpi-sub">after down payment</div>
        </div>
        <div className="kpi accent">
          <div className="kpi-label">Payoff date</div>
          <div className="kpi-value" style={{fontSize:'18px'}}>{MortgageMath.fullDate(result.payoffDateObj)}</div>
          <div className="kpi-sub">{MortgageMath.duration(daysToPayoff)} from start</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Time saved</div>
          <div className="kpi-value" style={{fontSize:'18px'}}>
            {daysSaved > 30 ? MortgageMath.duration(daysSaved) : '—'}
          </div>
          <div className="kpi-sub positive">
            {interestSaved > 0 ? `saves ${MortgageMath.money(interestSaved)} interest` : 'add extras to save'}
          </div>
        </div>
      </div>
    </div>
  );
}

function CompareKpiCard({ resultA, resultB }) {
  if (!resultA.schedule.length || !resultB.schedule.length) {
    return (
      <div className="kpi-hero glass">
        <div className="cost-headline">
          <div className="cost-amount" style={{fontSize:'34px'}}>Fill in both scenarios</div>
          <div className="cost-headline-text">Enter a purchase price for each scenario to see the comparison.</div>
        </div>
      </div>
    );
  }
  const totalA = resultA.totalPaid;
  const totalB = resultB.totalPaid;
  const diff = totalA - totalB;
  const winner = diff > 0 ? 'B' : 'A';
  const savings = Math.abs(diff);
  const daysA = (resultA.payoffDateObj - MortgageMath.parseDate(resultA.schedule[0].date)) / 86400000;
  const daysB = (resultB.payoffDateObj - MortgageMath.parseDate(resultB.schedule[0].date)) / 86400000;
  return (
    <div className="compare-kpi-card glass">
      <div className="compare-kpi-col">
        <div className="compare-kpi-name">
          <span className="scenario-dot" style={{background:'var(--scenario-a)', color:'var(--scenario-a)'}}></span>
          Scenario A
        </div>
        <div className="compare-kpi-big" style={{color:'var(--scenario-a)'}}>
          {MortgageMath.money(resultA.totalInterest, {compact:true})}
        </div>
        <div className="compare-kpi-line">interest · {MortgageMath.duration(daysA)} · paid off {MortgageMath.monthName(resultA.payoffDateObj)}</div>
      </div>
      <div className="compare-divider"></div>
      <div className="compare-kpi-col b">
        <div className="compare-kpi-name">
          <span className="scenario-dot" style={{background:'var(--scenario-b)', color:'var(--scenario-b)'}}></span>
          Scenario B
        </div>
        <div className="compare-kpi-big" style={{color:'var(--scenario-b)'}}>
          {MortgageMath.money(resultB.totalInterest, {compact:true})}
        </div>
        <div className="compare-kpi-line">interest · {MortgageMath.duration(daysB)} · paid off {MortgageMath.monthName(resultB.payoffDateObj)}</div>
      </div>
      <div className="compare-savings" style={{gridColumn:'1 / -1'}}>
        {savings > 100 ? (
          <>Scenario <strong>{winner}</strong> saves <strong>{MortgageMath.money(savings)}</strong> in total cost
          {Math.abs(daysA - daysB) > 30 && (
            <> and {MortgageMath.duration(Math.abs(daysA - daysB))} off the timeline</>
          )}.</>
        ) : (
          <>Both scenarios cost about the same — adjust the inputs to compare.</>
        )}
      </div>
    </div>
  );
}

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "theme": "dark"
}/*EDITMODE-END*/;

function CollapsibleSection({ id, title, subtitle, accent, defaultOpen = true, children, headerExtra }) {
  const [open, setOpen] = useState(defaultOpen);
  const toggle = () => setOpen(o => !o);
  return (
    <section className={`section glass ${open ? 'open' : 'collapsed'}`} data-section={id}>
      <div className="section-head" role="button" tabIndex={0}
           onClick={toggle}
           onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); } }}
           aria-expanded={open}>
        <div className="section-head-text">
          <h2 className="section-title">
            {accent && <span className="section-accent" style={{background: accent, boxShadow: `0 0 16px ${accent}`}}></span>}
            {title}
          </h2>
          {subtitle && <p className="section-sub">{subtitle}</p>}
        </div>
        <div className="section-head-right" onClick={(e) => e.stopPropagation()}>
          {headerExtra}
          <span className={`section-chevron ${open ? 'open' : ''}`} aria-hidden onClick={toggle}>⌃</span>
        </div>
      </div>
      <div className="section-body" style={{display: open ? 'block' : 'none'}}>
        {children}
      </div>
    </section>
  );
}

function App() {
  const [tweaks, setTweak] = useTweaks(TWEAK_DEFAULTS);

  const [mode, setMode] = useState('single');
  const [scenA, updateA, updateLumpsA, setA] = useScenario(DEFAULTS);
  const [scenB, updateB, updateLumpsB, setB] = useScenario(DEFAULTS_B);

  useEffect(() => {
    document.body.classList.toggle('theme-light', tweaks.theme === 'light');
    document.body.classList.toggle('theme-dark', tweaks.theme !== 'light');
  }, [tweaks.theme]);

  const resultA = useMemo(() => MortgageMath.calculate(scenA), [scenA]);
  const resultB = useMemo(() => MortgageMath.calculate(scenB), [scenB]);
  // Baseline for "time/interest saved" KPI (no recurring extra, no lumps, monthly)
  const baselineA = useMemo(() => MortgageMath.calculate({
    ...scenA, recurringExtra: 0, lumpSums: [], frequency: 'monthly',
  }), [scenA]);

  const reset = () => { setA(DEFAULTS); setB(DEFAULTS_B); };

  return (
    <>
      <div className="orbs">
        <div className="orb o1"></div>
        <div className="orb o2"></div>
        <div className="orb o3"></div>
      </div>
      <div className="app">
        <header className="header">
          <div className="brand">
            <div className="brand-mark">Mortgage <em>Visualizer</em></div>
            <div className="brand-tag">See what it really costs</div>
          </div>
          <ScenarioToggle mode={mode} onChange={setMode} />
        </header>

        <div className="stack">
          {/* SECTION 1 — chart (TOP) */}
          <CollapsibleSection
            id="chart"
            title={mode === 'single' ? 'Where your money goes' : 'Total cost over time'}
            subtitle={mode === 'single'
              ? 'Stacked principal + interest paid, with remaining balance overlay. Hover to inspect any payment.'
              : 'Cumulative cost for each scenario. Hover to see the running difference.'}
            accent="var(--principal)"
            headerExtra={
              <div className="legend">
                {mode === 'single' ? (
                  <>
                    <span className="legend-item" style={{color:'var(--principal)'}}>
                      <span className="legend-swatch"></span><span style={{color:'var(--fg-2)'}}>Principal</span>
                    </span>
                    <span className="legend-item" style={{color:'var(--interest)'}}>
                      <span className="legend-swatch"></span><span style={{color:'var(--fg-2)'}}>Interest</span>
                    </span>
                    <span className="legend-item" style={{color:'var(--remaining)'}}>
                      <span className="legend-line"></span><span style={{color:'var(--fg-2)'}}>Remaining</span>
                    </span>
                  </>
                ) : (
                  <>
                    <span className="legend-item" style={{color:'var(--scenario-a)'}}>
                      <span className="legend-line"></span><span style={{color:'var(--fg-2)'}}>A</span>
                    </span>
                    <span className="legend-item" style={{color:'var(--scenario-b)'}}>
                      <span className="legend-line" style={{borderTop:'2px dashed', height:0, background:'transparent', borderColor:'currentColor'}}></span>
                      <span style={{color:'var(--fg-2)'}}>B</span>
                    </span>
                  </>
                )}
              </div>
            }
          >
            <AreaChart
              result={resultA}
              resultB={mode === 'compare' ? resultB : null}
              compareMode={mode === 'compare'}
              lumpSums={scenA.lumpSums}
              lumpSumsB={scenB.lumpSums}
            />
          </CollapsibleSection>

          {/* SECTION 2 — Cost of borrowing (MIDDLE, hidden until data exists, collapsed by default) */}
          {(() => {
            const hasA = resultA.schedule.length > 0 && resultA.principal > 0;
            const hasB = resultB.schedule.length > 0 && resultB.principal > 0;
            const visible = mode === 'single' ? hasA : (hasA && hasB);
            if (!visible) return null;
            const totalLabel = mode === 'single'
              ? `$${Math.round(resultA.totalInterest).toLocaleString('en-CA')}`
              : (() => {
                  const diff = Math.abs(resultA.totalPaid - resultB.totalPaid);
                  const winner = resultA.totalPaid < resultB.totalPaid ? 'A' : 'B';
                  return diff > 100 ? `${winner} saves $${Math.round(diff).toLocaleString('en-CA')}` : 'About even';
                })();
            return (
              <CollapsibleSection
                id="summary"
                title={mode === 'single' ? 'Cost of borrowing' : 'Scenario showdown'}
                subtitle={mode === 'single' ? 'Total interest, payoff date, and time you save with extras.' : 'Two scenarios, side by side — which one wins on total cost?'}
                accent="var(--interest)"
                defaultOpen={false}
                headerExtra={
                  <div className="section-headline">
                    <span className="section-headline-amount">{totalLabel}</span>
                    <span className="section-headline-label">
                      {mode === 'single' ? <>in <span className="interest-word">interest</span></> : 'over the loan'}
                    </span>
                  </div>
                }
              >
                {mode === 'single' ? (
                  <KpiHero result={resultA} baseline={baselineA} />
                ) : (
                  <CompareKpiCard resultA={resultA} resultB={resultB} />
                )}
              </CollapsibleSection>
            );
          })()}

          {/* SECTION 3 — inputs (BOTTOM) */}
          <CollapsibleSection
            id="inputs"
            title={mode === 'single' ? 'Your mortgage' : 'Scenarios A & B'}
            subtitle={mode === 'single' ? 'Start with the purchase price — every other field has a sensible default you can fine-tune.' : 'Tune each column independently — start with the purchase price.'}
            accent="var(--scenario-a)"
            headerExtra={<button className="reset-btn" onClick={(e) => { e.stopPropagation(); reset(); }}>↺ Reset</button>}
          >
            {mode === 'single' ? (
              <div className="inputs-grid">
                <ScenarioInputs scenario={scenA} update={updateA} updateLumps={updateLumpsA} color="a" basePayment={resultA.basePayment || 0} />
              </div>
            ) : (
              <div className="compare-cols">
                <div className="compare-col">
                  <ScenarioInputs scenario={scenA} update={updateA} updateLumps={updateLumpsA} color="a" label="Scenario A" compact basePayment={resultA.basePayment || 0} />
                </div>
                <div className="compare-col">
                  <ScenarioInputs scenario={scenB} update={updateB} updateLumps={updateLumpsB} color="b" label="Scenario B" compact basePayment={resultB.basePayment || 0} />
                </div>
              </div>
            )}
          </CollapsibleSection>

          <div className="footer-note">
            CAD · {mode === 'compare' ? 'Comparing two scenarios — change anything to see the trade-off.' : 'Add a recurring extra or a one-off lump sum above to see how much sooner you’re free.'}
          </div>
        </div>
      </div>

      <TweaksPanel title="Tweaks">
        <TweakSection title="Appearance">
          <TweakRadio label="Theme" value={tweaks.theme}
                      options={[{value:'dark', label:'Dusk'},{value:'light', label:'Dawn'}]}
                      onChange={(v) => setTweak('theme', v)} />
        </TweakSection>
      </TweaksPanel>
    </>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
