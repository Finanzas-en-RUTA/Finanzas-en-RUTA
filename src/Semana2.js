import React, { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from './supabase';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, PieChart, Pie, Cell } from 'recharts';

const C = {
  dark:'#0F1923', dark2:'#1A2535', card:'#1E2D3D', border:'#2A3F55',
  green:'#00C48C', yellow:'#FFB800', blue:'#0A84FF', red:'#FF5A5F',
  purple:'#A29BFE', teal:'#00CEC9', text:'#E8F0F8', muted:'#7A93AC', header:'#0D1F2D',
};

const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const ANOS = ['2026','2027','2028','2029','2030','2031','2032','2033','2034','2035','2036'];

const FIJOS_DEFAULT = ['Arriendo / cuota vivienda','Agua','Luz','Gas','Internet','Celular','Transporte fijo','Crédito bancario','Tarjeta de crédito','Seguro'];
const VARIABLES_DEFAULT = ['Mercado','Restaurantes y domicilios','Entretenimiento','Ropa y accesorios','Salud','Educación','Otros gastos'];
const AHORRO_DEFAULT = ['Fondo de emergencia','Meta corto plazo','Inversión','Abono a deuda'];

const fmt = n => { const v = Math.round(n||0); return v === 0 ? '$ 0' : `$ ${v.toLocaleString('es-CO')}`; };
const fmtK = n => { if(!n) return '0'; if(Math.abs(n)>=1000000) return `${(n/1000000).toFixed(1)}M`; if(Math.abs(n)>=1000) return `${(n/1000).toFixed(0)}k`; return `${n}`; };

function emptyMes(ingreso = 0) {
  return {
    ingreso,
    pcts: { fijos: 50, variables: 30, ahorro: 20 },
    fijos: Object.fromEntries(FIJOS_DEFAULT.map((_, i) => [i, 0])),
    variables: Object.fromEntries(VARIABLES_DEFAULT.map((_, i) => [i, 0])),
    ahorro: Object.fromEntries(AHORRO_DEFAULT.map((_, i) => [i, 0])),
    fijosExtras: [], variablesExtras: [], ahorroExtras: [],
    ahorroRealizado: 0,
    transferido: false,
    notas: '',
  };
}

function CInput({ value, onChange, color = C.green, size = 13, placeholder = '0' }) {
  const [disp, setDisp] = useState('');
  useEffect(() => { setDisp(value > 0 ? Math.round(value).toLocaleString('es-CO') : ''); }, [value]);
  const handle = e => {
    const raw = e.target.value.replace(/\D/g, '');
    setDisp(raw ? parseInt(raw).toLocaleString('es-CO') : '');
    onChange(raw ? parseInt(raw) : 0);
  };
  return (
    <div style={{ position: 'relative' }}>
      <span style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color, fontSize: size - 1, fontWeight: 700, pointerEvents: 'none' }}>$</span>
      <input type="text" inputMode="numeric" value={disp} onChange={handle} placeholder={placeholder}
        style={{ width: '100%', background: C.dark2, border: `1.5px solid ${C.border}`, borderRadius: 7, padding: `7px 8px 7px ${size + 8}px`, color, fontFamily: 'Syne, sans-serif', fontSize: size, fontWeight: 700, outline: 'none', textAlign: 'right', boxSizing: 'border-box' }}
        onFocus={e => e.target.style.borderColor = color} onBlur={e => e.target.style.borderColor = C.border} />
    </div>
  );
}

function PctControl({ value, onChange, color }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <button onClick={() => onChange(Math.max(0, value - 5))}
        style={{ background: C.dark2, border: `1px solid ${C.border}`, borderRadius: 6, width: 28, height: 28, color: C.muted, cursor: 'pointer', fontSize: 16, fontWeight: 700 }}>−</button>
      <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 22, fontWeight: 800, color, minWidth: 60, textAlign: 'center' }}>{value}%</div>
      <button onClick={() => onChange(Math.min(100, value + 5))}
        style={{ background: C.dark2, border: `1px solid ${C.border}`, borderRadius: 6, width: 28, height: 28, color: C.muted, cursor: 'pointer', fontSize: 16, fontWeight: 700 }}>+</button>
    </div>
  );
}

function CuentaCard({ titulo, icon, color, pct, monto, items, defaultItems, extras, onPct, onItem, onAddExtra, onDelExtra, onExtraConcepto, onExtraValor, usado, expanded, onToggle }) {
  const libre = monto - usado;
  const pctUsado = monto > 0 ? Math.min((usado / monto) * 100, 100) : 0;
  return (
    <div style={{ background: C.card, borderRadius: 14, border: `1px solid ${color}40`, overflow: 'hidden', marginBottom: 14 }}>
      <div style={{ padding: '14px 16px', borderLeft: `4px solid ${color}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <span style={{ fontSize: 22 }}>{icon}</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 13, fontWeight: 800, color }}>{titulo}</div>
            <div style={{ fontSize: 10, color: C.muted, marginTop: 2 }}>Asignación del ingreso</div>
          </div>
          <PctControl value={pct} onChange={onPct} color={color} />
        </div>
        <div style={{ background: C.dark2, borderRadius: 10, padding: '10px 14px', marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 11, color: C.muted }}>Monto asignado</span>
          <span style={{ fontFamily: 'Syne, sans-serif', fontSize: 18, fontWeight: 800, color }}>{fmt(monto)}</span>
        </div>
        <div style={{ background: C.dark, borderRadius: 8, height: 8, overflow: 'hidden', marginBottom: 6 }}>
          <div style={{ background: libre < 0 ? C.red : color, height: '100%', width: `${pctUsado}%`, borderRadius: 8, transition: 'width 0.4s' }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10 }}>
          <span style={{ color: C.muted }}>Desglosado: <strong style={{ color }}>{fmt(usado)}</strong></span>
          <span style={{ color: libre < 0 ? C.red : C.muted }}>{libre < 0 ? `⚠️ Excede ${fmt(Math.abs(libre))}` : `${fmt(libre)} sin desglosar`}</span>
        </div>
      </div>
      <div style={{ borderTop: `1px solid ${C.border}` }}>
        <button onClick={onToggle}
          style={{ width: '100%', background: 'transparent', border: 'none', padding: '10px 16px', color: C.muted, fontSize: 10, fontWeight: 700, cursor: 'pointer', textAlign: 'left', display: 'flex', justifyContent: 'space-between' }}>
          <span>Desglosar por concepto (opcional)</span>
          <span style={{ color }}>{expanded ? '▲ Cerrar' : '▼ Abrir'}</span>
        </button>
        {expanded && (
          <div style={{ padding: '0 16px 16px', background: C.dark2 }}>
            {defaultItems.map((item, idx) => (
              <div key={idx} style={{ marginBottom: 8 }}>
                <div style={{ fontSize: 9, color: C.muted, marginBottom: 4 }}>{item}</div>
                <CInput value={items[idx] || 0} onChange={v => onItem(idx, v)} color={color} size={11} />
              </div>
            ))}
            {extras.map((ex, idx) => (
              <div key={idx} style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                <input value={ex.concepto || ''} onChange={e => onExtraConcepto(idx, e.target.value)}
                  placeholder="Concepto…"
                  style={{ flex: 1, background: C.dark, border: `1.5px solid ${C.border}`, borderRadius: 6, padding: '6px 8px', color: C.text, fontSize: 11, outline: 'none' }} />
                <div style={{ width: 120 }}>
                  <CInput value={ex.valor || 0} onChange={v => onExtraValor(idx, v)} color={color} size={11} />
                </div>
                <button onClick={() => onDelExtra(idx)}
                  style={{ background: C.dark, border: `1px solid ${C.border}`, borderRadius: 6, padding: '0 8px', color: C.red, cursor: 'pointer', fontSize: 13 }}>✕</button>
              </div>
            ))}
            <button onClick={onAddExtra}
              style={{ background: 'transparent', border: `1.5px dashed ${color}`, borderRadius: 7, padding: '6px', width: '100%', color, fontSize: 10, fontWeight: 700, cursor: 'pointer' }}>
              + Agregar concepto
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function Semana2({ user, onBack }) {
  const [tab, setTab] = useState('presupuesto');
  const [mes, setMes] = useState(new Date().getMonth());
  const [ano, setAno] = useState('2026');
  const [hist, setHist] = useState({});
  const [perfil, setPerfil] = useState({ nombre: '' });
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');
  const [expanded, setExpanded] = useState({});
  const timer = useRef(null);

  const mesKey = `${ano}-${MESES[mes]}`;
  const mesData = hist[mesKey] || emptyMes();

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const { data } = await supabase.from('panel_financiero').select('data').eq('user_id', user.id).single();
      if (data?.data) {
        if (data.data.s2_hist) setHist(data.data.s2_hist);
        if (data.data.perfil) setPerfil(data.data.perfil);
        if (data.data.mesActual !== undefined) setMes(data.data.mesActual);
        if (data.data.anoActual) setAno(data.data.anoActual);
      }
    };
    load();
  }, [user]);

  const saveData = useCallback(async (h) => {
    if (!user) return;
    setSaving(true);
    const { data: existing } = await supabase.from('panel_financiero').select('data').eq('user_id', user.id).single();
    const merged = { ...(existing?.data || {}), s2_hist: h };
    await supabase.from('panel_financiero').update({ data: merged }).eq('user_id', user.id);
    setSaving(false); setSaveMsg('✓ Guardado'); setTimeout(() => setSaveMsg(''), 2000);
  }, [user]);

  const trig = useCallback((h) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => saveData(h), 1000);
  }, [saveData]);

  const updMes = useCallback(nd => {
    const nh = { ...hist, [mesKey]: nd };
    setHist(nh); trig(nh);
  }, [hist, mesKey, trig]);

  const upd = (path, val) => {
    const nd = JSON.parse(JSON.stringify(mesData));
    const keys = path.split('.');
    let obj = nd;
    for (let i = 0; i < keys.length - 1; i++) obj = obj[keys[i]];
    obj[keys[keys.length - 1]] = val;
    updMes(nd);
  };

  // Calculations
  const ing = mesData.ingreso || 0;
  const asigFijos = Math.round(ing * (mesData.pcts.fijos / 100));
  const asigVars = Math.round(ing * (mesData.pcts.variables / 100));
  const asigAhorro = Math.round(ing * (mesData.pcts.ahorro / 100));
  const totalPct = mesData.pcts.fijos + mesData.pcts.variables + mesData.pcts.ahorro;

  const calcUsado = (tipo) => {
    const base = Object.values(mesData[tipo] || {}).reduce((a, b) => a + (b || 0), 0);
    const extras = (mesData[`${tipo}Extras`] || []).reduce((a, b) => a + (b.valor || 0), 0);
    return base + extras;
  };
  const usadoFijos = calcUsado('fijos');
  const usadoVars = calcUsado('variables');
  const usadoAhorro = calcUsado('ahorro');
  const totalGastos = usadoFijos + usadoVars + usadoAhorro;

  // Chart data
  const ultimos6 = (() => {
    const r = []; let m = mes, a = parseInt(ano);
    for (let i = 0; i < 6; i++) {
      const k = `${a}-${MESES[m]}`; const d = hist[k];
      r.unshift({
        label: MESES[m].substring(0, 3),
        fijos: d ? Object.values(d.fijos || {}).reduce((s, v) => s + (v || 0), 0) + (d.fijosExtras || []).reduce((s, b) => s + (b.valor || 0), 0) : 0,
        variables: d ? Object.values(d.variables || {}).reduce((s, v) => s + (v || 0), 0) + (d.variablesExtras || []).reduce((s, b) => s + (b.valor || 0), 0) : 0,
        ahorro: d ? Object.values(d.ahorro || {}).reduce((s, v) => s + (v || 0), 0) + (d.ahorroExtras || []).reduce((s, b) => s + (b.valor || 0), 0) : 0,
      });
      m--; if (m < 0) { m = 11; a--; }
    }
    return r;
  })();

  const pieData = [
    { name: 'Fijos', value: usadoFijos, color: C.blue },
    { name: 'Variables', value: usadoVars, color: C.yellow },
    { name: 'Ahorro', value: usadoAhorro, color: C.green },
  ].filter(d => d.value > 0);

  const cuentaProps = (tipo, titulo, icon, color, defaultItems, asig, usado) => ({
    titulo, icon, color,
    pct: mesData.pcts[tipo],
    monto: asig,
    items: mesData[tipo],
    defaultItems,
    extras: mesData[`${tipo}Extras`] || [],
    onPct: v => upd(`pcts.${tipo}`, v),
    onItem: (idx, val) => upd(`${tipo}.${idx}`, val),
    onAddExtra: () => {
      const nd = JSON.parse(JSON.stringify(mesData));
      if (!nd[`${tipo}Extras`]) nd[`${tipo}Extras`] = [];
      nd[`${tipo}Extras`].push({ concepto: '', valor: 0 });
      updMes(nd);
    },
    onDelExtra: idx => {
      const nd = JSON.parse(JSON.stringify(mesData));
      nd[`${tipo}Extras`].splice(idx, 1);
      updMes(nd);
    },
    onExtraConcepto: (idx, val) => {
      const nd = JSON.parse(JSON.stringify(mesData));
      nd[`${tipo}Extras`][idx].concepto = val;
      updMes(nd);
    },
    onExtraValor: (idx, val) => {
      const nd = JSON.parse(JSON.stringify(mesData));
      nd[`${tipo}Extras`][idx].valor = val;
      updMes(nd);
    },
    usado,
    expanded: expanded[tipo],
    onToggle: () => setExpanded(p => ({ ...p, [tipo]: !p[tipo] })),
  });

  const TABS = [
    { id: 'presupuesto', label: '💼 Presupuesto' },
    { id: 'cuentas', label: '🏦 3 Cuentas' },
    { id: 'comparativo', label: '📊 Comparativo' },
  ];

  return (
    <div style={{ background: C.dark, minHeight: '100vh', fontFamily: "'DM Sans', sans-serif", color: C.text }}>
      {/* TOP BAR */}
      <div style={{ background: C.header, borderBottom: `1px solid ${C.border}`, padding: '10px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 50 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button onClick={onBack} style={{ background: C.dark2, border: `1px solid ${C.border}`, borderRadius: 7, padding: '5px 10px', color: C.muted, fontSize: 11, cursor: 'pointer' }}>← Volver</button>
          <div style={{ background: C.blue, color: '#fff', fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 10, letterSpacing: 1, padding: '4px 9px', borderRadius: 4 }}>SEMANA 2</div>
          <span style={{ fontSize: 11, color: C.muted }}>Presupuesto y 3 Cuentas</span>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {saving && <span style={{ fontSize: 10, color: C.muted }}>Guardando...</span>}
          {saveMsg && <span style={{ fontSize: 10, color: C.green }}>{saveMsg}</span>}
        </div>
      </div>

      {/* TABS */}
      <div style={{ background: C.header, borderBottom: `1px solid ${C.border}`, display: 'flex' }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{ background: 'transparent', border: 'none', borderBottom: tab === t.id ? `3px solid ${C.blue}` : '3px solid transparent', padding: '11px 16px', color: tab === t.id ? C.blue : C.muted, fontFamily: 'Syne, sans-serif', fontSize: 11, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>
            {t.label}
          </button>
        ))}
      </div>

      <div style={{ padding: '16px 16px 40px', maxWidth: 820, margin: '0 auto' }}>

        {/* ── PRESUPUESTO ── */}
        {tab === 'presupuesto' && (
          <div>
            {/* Selector mes/año */}
            <div style={{ background: C.card, borderRadius: 14, padding: 16, marginBottom: 14, border: `1px solid ${C.border}` }}>
              <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 12, fontWeight: 700, color: C.blue, marginBottom: 10 }}>📅 Mes del presupuesto</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <div style={{ fontSize: 9, color: C.muted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 5 }}>Mes</div>
                  <select value={mes} onChange={e => { setMes(parseInt(e.target.value)); }}
                    style={{ width: '100%', background: C.dark2, border: `1.5px solid ${C.border}`, borderRadius: 7, padding: '8px 10px', color: C.text, fontSize: 13, outline: 'none' }}>
                    {MESES.map((m, i) => <option key={m} value={i}>{m}</option>)}
                  </select>
                </div>
                <div>
                  <div style={{ fontSize: 9, color: C.muted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 5 }}>Año</div>
                  <select value={ano} onChange={e => setAno(e.target.value)}
                    style={{ width: '100%', background: C.dark2, border: `1.5px solid ${C.border}`, borderRadius: 7, padding: '8px 10px', color: C.text, fontSize: 13, outline: 'none' }}>
                    {ANOS.map(a => <option key={a} value={a}>{a}</option>)}
                  </select>
                </div>
              </div>
            </div>

            {/* Ingreso neto */}
            <div style={{ background: C.card, borderRadius: 14, padding: 16, marginBottom: 14, border: `1px solid ${C.green}40` }}>
              <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 12, fontWeight: 700, color: C.green, marginBottom: 8 }}>💰 Ingreso neto del mes</div>
              <div style={{ fontSize: 11, color: C.muted, marginBottom: 10 }}>Lo que realmente llega a tu cuenta (no el salario bruto)</div>
              <CInput value={ing} onChange={v => upd('ingreso', v)} color={C.green} size={16} />
            </div>

            {/* Distribución % */}
            <div style={{ background: C.card, borderRadius: 14, padding: 16, marginBottom: 14, border: `1px solid ${C.border}` }}>
              <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 12, fontWeight: 700, color: C.text, marginBottom: 4 }}>⚙️ Distribución del ingreso</div>
              <div style={{ fontSize: 10, color: C.muted, marginBottom: 14 }}>Los porcentajes deben sumar 100%. Ajusta según tu situación.</div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 14 }}>
                {[
                  ['fijos', '🏠', 'Fijos', C.blue],
                  ['variables', '🎯', 'Variables', C.yellow],
                  ['ahorro', '🚀', 'Ahorro', C.green],
                ].map(([tipo, icon, label, color]) => (
                  <div key={tipo} style={{ background: C.dark2, borderRadius: 12, padding: '14px 10px', textAlign: 'center', border: `1px solid ${color}30` }}>
                    <div style={{ fontSize: 20, marginBottom: 6 }}>{icon}</div>
                    <div style={{ fontSize: 10, color: C.muted, marginBottom: 8 }}>{label}</div>
                    <PctControl value={mesData.pcts[tipo]} onChange={v => upd(`pcts.${tipo}`, v)} color={color} />
                    <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 14, fontWeight: 800, color, marginTop: 8 }}>
                      {fmt(Math.round(ing * (mesData.pcts[tipo] / 100)))}
                    </div>
                  </div>
                ))}
              </div>

              {/* Alerta si no suma 100 */}
              {totalPct !== 100 && (
                <div style={{ background: `${C.yellow}15`, border: `1px solid ${C.yellow}40`, borderRadius: 8, padding: '10px 14px', fontSize: 11, color: C.text, textAlign: 'center' }}>
                  ⚠️ Los porcentajes suman <strong style={{ color: C.yellow }}>{totalPct}%</strong>. Deben sumar exactamente <strong>100%</strong>.
                </div>
              )}
              {totalPct === 100 && (
                <div style={{ background: `${C.green}10`, border: `1px solid ${C.green}25`, borderRadius: 8, padding: '10px 14px', fontSize: 11, color: C.text, textAlign: 'center' }}>
                  ✅ Perfecto — la distribución suma 100%
                </div>
              )}
            </div>

            {/* Resumen de las 3 cuentas */}
            {ing > 0 && (
              <div style={{ background: C.card, borderRadius: 14, padding: 16, border: `1px solid ${C.border}` }}>
                <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 12, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>Resumen del presupuesto</div>
                {[
                  ['🏠 Cuenta 1 — Gastos Fijos', asigFijos, C.blue],
                  ['🎯 Cuenta 2 — Gastos Variables', asigVars, C.yellow],
                  ['🚀 Cuenta 3 — Ahorro', asigAhorro, C.green],
                ].map(([label, val, color]) => (
                  <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', background: C.dark2, borderRadius: 8, marginBottom: 8, borderLeft: `3px solid ${color}` }}>
                    <span style={{ fontSize: 12, color: C.text }}>{label}</span>
                    <span style={{ fontFamily: 'Syne, sans-serif', fontSize: 14, fontWeight: 800, color }}>{fmt(val)}</span>
                  </div>
                ))}
                <div style={{ marginTop: 8, padding: '8px 0', borderTop: `1px dashed ${C.border}` }}>
                  <div style={{ fontSize: 11, color: C.muted, textAlign: 'center' }}>
                    💡 El ahorro se transfiere <strong style={{ color: C.green }}>PRIMERO</strong> el día que recibes el sueldo
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── 3 CUENTAS ── */}
        {tab === 'cuentas' && (
          <div>
            <div style={{ background: `${C.blue}10`, border: `1px solid ${C.blue}30`, borderRadius: 12, padding: '12px 16px', marginBottom: 16, fontSize: 12, color: C.text, lineHeight: 1.6 }}>
              💡 <strong style={{ color: C.blue }}>El sistema de 3 cuentas:</strong> Desglosamos cada cuenta para ver exactamente a dónde va cada peso. El desglose es opcional — si no tienes el detalle, deja solo el total en la pestaña Presupuesto.
            </div>

            <CuentaCard {...cuentaProps('fijos', 'Cuenta 1 — Gastos Fijos', '🏠', C.blue, FIJOS_DEFAULT, asigFijos, usadoFijos)} />
            <CuentaCard {...cuentaProps('variables', 'Cuenta 2 — Gastos Variables', '🎯', C.yellow, VARIABLES_DEFAULT, asigVars, usadoVars)} />
            <CuentaCard {...cuentaProps('ahorro', 'Cuenta 3 — Ahorro', '🚀', C.green, AHORRO_DEFAULT, asigAhorro, usadoAhorro)} />

            {/* Confirmación de transferencia */}
            <div style={{ background: C.card, borderRadius: 14, padding: 16, border: `1px solid ${C.green}40`, marginBottom: 14 }}>
              <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 12, fontWeight: 700, color: C.green, marginBottom: 10 }}>✅ Confirmación de transferencia</div>
              <div style={{ fontSize: 11, color: C.muted, marginBottom: 12, lineHeight: 1.6 }}>
                El paso más importante del sistema: transferir el ahorro el mismo día que llega el sueldo, antes de gastar un solo peso.
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', background: C.dark2, borderRadius: 10 }}>
                <input type="checkbox" id="transferido" checked={mesData.transferido || false}
                  onChange={e => upd('transferido', e.target.checked)}
                  style={{ width: 18, height: 18, cursor: 'pointer', accentColor: C.green }} />
                <label htmlFor="transferido" style={{ fontSize: 12, color: C.text, cursor: 'pointer', lineHeight: 1.5 }}>
                  Confirmé que transferí <strong style={{ color: C.green }}>{fmt(asigAhorro)}</strong> a mi cuenta de ahorro este mes
                </label>
              </div>
              {mesData.transferido && (
                <div style={{ marginTop: 10, fontSize: 11, color: C.green, textAlign: 'center' }}>
                  🎉 ¡Excelente! Ese es el hábito más poderoso del sistema.
                </div>
              )}
            </div>

            {/* Cuánto ahorrar */}
            <div style={{ background: C.card, borderRadius: 14, padding: 16, border: `1px solid ${C.border}` }}>
              <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 12, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>Ahorro real este mes</div>
              <CInput value={mesData.ahorroRealizado || 0} onChange={v => upd('ahorroRealizado', v)} color={C.green} size={14} />
              {mesData.ahorroRealizado > 0 && asigAhorro > 0 && (
                <div style={{ marginTop: 10, fontSize: 11, color: C.muted }}>
                  {mesData.ahorroRealizado >= asigAhorro
                    ? <span style={{ color: C.green }}>✅ Cumpliste la meta de ahorro del mes</span>
                    : <span style={{ color: C.yellow }}>⚠️ Faltaron {fmt(asigAhorro - mesData.ahorroRealizado)} para cumplir la meta</span>}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── COMPARATIVO ── */}
        {tab === 'comparativo' && (
          <div>
            <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 18, fontWeight: 800, color: '#fff', marginBottom: 14 }}>📊 Evolución del presupuesto</div>

            {/* Barras últimos 6 meses */}
            <div style={{ background: C.card, borderRadius: 14, padding: 16, marginBottom: 14, border: `1px solid ${C.border}` }}>
              <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 11, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>Distribución por cuenta — Últimos 6 meses</div>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={ultimos6} barSize={12} barGap={2}>
                  <XAxis dataKey="label" tick={{ fill: C.muted, fontSize: 9 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: C.muted, fontSize: 8 }} tickFormatter={v => `$${fmtK(v)}`} axisLine={false} tickLine={false} />
                  <Tooltip formatter={(v, n) => [fmt(v), n]} contentStyle={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 11 }} />
                  <Legend wrapperStyle={{ fontSize: 10 }} />
                  <Bar dataKey="fijos" name="Fijos" fill={C.blue} radius={[2, 2, 0, 0]} stackId="a" />
                  <Bar dataKey="variables" name="Variables" fill={C.yellow} radius={[0, 0, 0, 0]} stackId="a" />
                  <Bar dataKey="ahorro" name="Ahorro" fill={C.green} radius={[2, 2, 0, 0]} stackId="a" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Pie actual */}
            {pieData.length > 0 && (
              <div style={{ background: C.card, borderRadius: 14, padding: 16, marginBottom: 14, border: `1px solid ${C.border}` }}>
                <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 11, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>Distribución actual — {MESES[mes]} {ano}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                  <ResponsiveContainer width={140} height={140}>
                    <PieChart>
                      <Pie data={pieData} cx="50%" cy="50%" outerRadius={60} innerRadius={25} dataKey="value">
                        {pieData.map((e, i) => <Cell key={i} fill={e.color} />)}
                      </Pie>
                      <Tooltip formatter={v => [fmt(v), '']} contentStyle={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 11 }} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div style={{ flex: 1 }}>
                    {pieData.map((e, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                        <div style={{ width: 10, height: 10, borderRadius: 2, background: e.color, flexShrink: 0 }} />
                        <span style={{ fontSize: 11, color: C.muted, flex: 1 }}>{e.name}</span>
                        <span style={{ fontSize: 11, fontWeight: 700, color: e.color }}>{fmt(e.value)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Historial */}
            {Object.keys(hist).length > 0 && (
              <div style={{ background: C.card, borderRadius: 14, padding: 16, border: `1px solid ${C.border}` }}>
                <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 11, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>Historial de presupuestos</div>
                {Object.entries(hist).sort().reverse().map(([key, d]) => {
                  const f = Object.values(d.fijos || {}).reduce((s, v) => s + (v || 0), 0) + (d.fijosExtras || []).reduce((s, b) => s + (b.valor || 0), 0);
                  const v2 = Object.values(d.variables || {}).reduce((s, v) => s + (v || 0), 0) + (d.variablesExtras || []).reduce((s, b) => s + (b.valor || 0), 0);
                  const a = Object.values(d.ahorro || {}).reduce((s, v) => s + (v || 0), 0) + (d.ahorroExtras || []).reduce((s, b) => s + (b.valor || 0), 0);
                  return (
                    <div key={key} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 10px', background: C.dark2, borderRadius: 8, marginBottom: 6 }}>
                      <span style={{ fontSize: 11, color: C.text, fontWeight: 600 }}>{key}</span>
                      <div style={{ display: 'flex', gap: 10, fontSize: 10 }}>
                        <span style={{ color: C.blue }}>{fmt(f)}</span>
                        <span style={{ color: C.yellow }}>{fmt(v2)}</span>
                        <span style={{ color: C.green, fontWeight: 700 }}>{fmt(a)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
