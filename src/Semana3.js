import React, { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from './supabase';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';

const C = {
  dark:'#0F1923', dark2:'#1A2535', card:'#1E2D3D', border:'#2A3F55',
  green:'#00C48C', yellow:'#FFB800', blue:'#0A84FF', red:'#FF5A5F',
  purple:'#A29BFE', teal:'#00CEC9', text:'#E8F0F8', muted:'#7A93AC', header:'#0D1F2D',
};
const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const ANOS = ['2026','2027','2028','2029','2030','2031','2032','2033','2034','2035','2036'];
const fmt = n => { const v = Math.round(n||0); return v === 0 ? '$ 0' : `$ ${v.toLocaleString('es-CO')}`; };
const fmtK = n => { if(!n) return '0'; if(Math.abs(n)>=1000000) return `${(n/1000000).toFixed(1)}M`; if(Math.abs(n)>=1000) return `${(n/1000).toFixed(0)}k`; return `${n}`; };

function CInput({ value, onChange, color = C.purple, size = 13 }) {
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
      <input type="text" inputMode="numeric" value={disp} onChange={handle} placeholder="0"
        style={{ width: '100%', background: C.dark2, border: `1.5px solid ${C.border}`, borderRadius: 7, padding: `7px 8px 7px ${size + 8}px`, color, fontFamily: 'Syne, sans-serif', fontSize: size, fontWeight: 700, outline: 'none', textAlign: 'right', boxSizing: 'border-box' }}
        onFocus={e => e.target.style.borderColor = color} onBlur={e => e.target.style.borderColor = C.border} />
    </div>
  );
}

function emptyMeta() {
  return { nombre: '', porque: '', valorMeta: 0, ahorroInicial: 0, plazoSemanas: 12, ingreso: 0, registros: [] };
}

export default function Semana3({ user, onBack }) {
  const [tab, setTab] = useState('meta');
  const [metas, setMetas] = useState([emptyMeta()]);
  const [metaIdx, setMetaIdx] = useState(0);
  const [mes, setMes] = useState(new Date().getMonth());
  const [ano, setAno] = useState('2026');
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');
  const timer = useRef(null);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const { data } = await supabase.from('panel_financiero').select('data').eq('user_id', user.id).single();
      if (data?.data?.s3_metas) setMetas(data.data.s3_metas);
      if (data?.data?.s3_mesActual !== undefined) setMes(data.data.s3_mesActual);
      if (data?.data?.s3_anoActual) setAno(data.data.s3_anoActual);
    };
    load();
  }, [user]);

  const saveData = useCallback(async (m) => {
    if (!user) return;
    setSaving(true);
    const { data: existing } = await supabase.from('panel_financiero').select('data').eq('user_id', user.id).single();
    const merged = { ...(existing?.data || {}), s3_metas: m, s3_mesActual: mes, s3_anoActual: ano };
    await supabase.from('panel_financiero').update({ data: merged }).eq('user_id', user.id);
    setSaving(false); setSaveMsg('✓ Guardado'); setTimeout(() => setSaveMsg(''), 2000);
  }, [user, mes, ano]);

  const trig = useCallback((m) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => saveData(m), 1000);
  }, [saveData]);

  const meta = metas[metaIdx] || emptyMeta();

  const updMeta = (path, val) => {
    const nm = JSON.parse(JSON.stringify(metas));
    const keys = path.split('.');
    let obj = nm[metaIdx];
    for (let i = 0; i < keys.length - 1; i++) obj = obj[keys[i]];
    obj[keys[keys.length - 1]] = val;
    setMetas(nm); trig(nm);
  };

  const addRegistroMes = () => {
    const nm = JSON.parse(JSON.stringify(metas));
    const key = `${ano}-${MESES[mes]}`;
    if (!nm[metaIdx].registros) nm[metaIdx].registros = [];
    const exists = nm[metaIdx].registros.find(r => r.key === key);
    if (!exists) nm[metaIdx].registros.push({ key, valor: 0, nota: '' });
    setMetas(nm); trig(nm);
  };

  const updRegistro = (key, field, val) => {
    const nm = JSON.parse(JSON.stringify(metas));
    const idx = nm[metaIdx].registros.findIndex(r => r.key === key);
    if (idx >= 0) nm[metaIdx].registros[idx][field] = val;
    setMetas(nm); trig(nm);
  };

  const delRegistro = (key) => {
    const nm = JSON.parse(JSON.stringify(metas));
    nm[metaIdx].registros = nm[metaIdx].registros.filter(r => r.key !== key);
    setMetas(nm); trig(nm);
  };

  // Cálculos
  const faltante = Math.max(0, meta.valorMeta - meta.ahorroInicial);
  const porSemana = meta.plazoSemanas > 0 ? faltante / meta.plazoSemanas : 0;
  const porMes = porSemana * 4.3;
  const pctIngreso = meta.ingreso > 0 ? (porMes / meta.ingreso) * 100 : 0;

  // Total ahorrado acumulado
  const totalAhorrado = meta.ahorroInicial + (meta.registros || []).reduce((s, r) => s + (r.valor || 0), 0);
  const pctAvance = meta.valorMeta > 0 ? Math.min((totalAhorrado / meta.valorMeta) * 100, 100) : 0;
  const mesesRestantes = porMes > 0 ? Math.ceil((meta.valorMeta - totalAhorrado) / porMes) : 0;

  // Datos para gráfico de progreso
  const chartData = (() => {
    const regs = (meta.registros || []).sort((a, b) => a.key.localeCompare(b.key));
    let acum = meta.ahorroInicial;
    const data = [{ label: 'Inicio', valor: acum, meta: meta.valorMeta }];
    regs.forEach(r => {
      acum += r.valor || 0;
      data.push({ label: r.key.split('-')[1]?.substring(0, 3) || r.key, valor: acum, meta: meta.valorMeta });
    });
    return data;
  })();

  const TABS = [
    { id: 'meta', label: '🎯 Mi Meta' },
    { id: 'seguimiento', label: '📅 Seguimiento' },
    { id: 'proyeccion', label: '📈 Proyección' },
  ];

  const inp = { width: '100%', background: C.dark2, border: `1.5px solid ${C.border}`, borderRadius: 7, padding: '9px 12px', color: C.text, fontFamily: "'DM Sans', sans-serif", fontSize: 13, outline: 'none', boxSizing: 'border-box' };

  return (
    <div style={{ background: C.dark, minHeight: '100vh', fontFamily: "'DM Sans', sans-serif", color: C.text }}>
      <div style={{ background: C.header, borderBottom: `1px solid ${C.border}`, padding: '10px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 50 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button onClick={onBack} style={{ background: C.dark2, border: `1px solid ${C.border}`, borderRadius: 7, padding: '5px 10px', color: C.muted, fontSize: 11, cursor: 'pointer' }}>← Volver</button>
          <div style={{ background: C.purple, color: '#fff', fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 10, letterSpacing: 1, padding: '4px 9px', borderRadius: 4 }}>SEMANA 3</div>
          <span style={{ fontSize: 11, color: C.muted }}>Brújula Financiera</span>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {saving && <span style={{ fontSize: 10, color: C.muted }}>Guardando...</span>}
          {saveMsg && <span style={{ fontSize: 10, color: C.green }}>{saveMsg}</span>}
        </div>
      </div>

      <div style={{ background: C.header, borderBottom: `1px solid ${C.border}`, display: 'flex' }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{ background: 'transparent', border: 'none', borderBottom: tab === t.id ? `3px solid ${C.purple}` : '3px solid transparent', padding: '11px 16px', color: tab === t.id ? C.purple : C.muted, fontFamily: 'Syne, sans-serif', fontSize: 11, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>
            {t.label}
          </button>
        ))}
      </div>

      <div style={{ padding: '16px 16px 40px', maxWidth: 820, margin: '0 auto' }}>

        {/* Selector de meta */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 16, alignItems: 'center', flexWrap: 'wrap' }}>
          {metas.map((m, i) => (
            <button key={i} onClick={() => setMetaIdx(i)}
              style={{ background: metaIdx === i ? `${C.purple}20` : C.card, border: `1.5px solid ${metaIdx === i ? C.purple : C.border}`, borderRadius: 20, padding: '6px 14px', color: metaIdx === i ? C.purple : C.muted, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
              {m.nombre || `Meta ${i + 1}`}
            </button>
          ))}
          <button onClick={() => { const nm = [...metas, emptyMeta()]; setMetas(nm); setMetaIdx(nm.length - 1); trig(nm); }}
            style={{ background: 'transparent', border: `1.5px dashed ${C.purple}`, borderRadius: 20, padding: '6px 14px', color: C.purple, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
            + Nueva meta
          </button>
        </div>

        {/* ── MI META ── */}
        {tab === 'meta' && (
          <div>
            <div style={{ background: C.card, borderRadius: 14, padding: 18, marginBottom: 14, border: `1px solid ${C.purple}40` }}>
              <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 12, fontWeight: 700, color: C.purple, marginBottom: 14 }}>🎯 Define tu meta</div>

              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 9, color: C.muted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>¿Cuál es tu meta?</div>
                <input value={meta.nombre} onChange={e => updMeta('nombre', e.target.value)} placeholder="Ej: Fondo de emergencia" style={{ ...inp }} onFocus={e => e.target.style.borderColor = C.purple} onBlur={e => e.target.style.borderColor = C.border} />
              </div>

              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 9, color: C.muted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>¿Para qué es esta meta? (el porqué)</div>
                <input value={meta.porque} onChange={e => updMeta('porque', e.target.value)} placeholder="Ej: Para tener tranquilidad ante emergencias" style={{ ...inp }} onFocus={e => e.target.style.borderColor = C.purple} onBlur={e => e.target.style.borderColor = C.border} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
                <div>
                  <div style={{ fontSize: 9, color: C.muted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>Valor de la meta</div>
                  <CInput value={meta.valorMeta} onChange={v => updMeta('valorMeta', v)} color={C.purple} />
                </div>
                <div>
                  <div style={{ fontSize: 9, color: C.muted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>Ya tengo ahorrado</div>
                  <CInput value={meta.ahorroInicial} onChange={v => updMeta('ahorroInicial', v)} color={C.green} />
                </div>
                <div>
                  <div style={{ fontSize: 9, color: C.muted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>Plazo (semanas)</div>
                  <input type="number" value={meta.plazoSemanas} onChange={e => updMeta('plazoSemanas', parseInt(e.target.value) || 0)}
                    style={{ width: '100%', background: C.dark2, border: `1.5px solid ${C.border}`, borderRadius: 7, padding: '9px 12px', color: C.purple, fontFamily: 'Syne, sans-serif', fontSize: 14, fontWeight: 700, outline: 'none', textAlign: 'center', boxSizing: 'border-box' }}
                    onFocus={e => e.target.style.borderColor = C.purple} onBlur={e => e.target.style.borderColor = C.border} />
                </div>
                <div>
                  <div style={{ fontSize: 9, color: C.muted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>Tu ingreso mensual</div>
                  <CInput value={meta.ingreso} onChange={v => updMeta('ingreso', v)} color={C.green} />
                </div>
              </div>

              {/* Resultados */}
              {meta.valorMeta > 0 && meta.plazoSemanas > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 14 }}>
                  {[
                    { label: 'Te falta', val: fmt(faltante), color: C.purple },
                    { label: 'Por semana', val: fmt(porSemana), color: C.blue },
                    { label: 'Por mes', val: fmt(porMes), color: C.green },
                  ].map((k, i) => (
                    <div key={i} style={{ background: C.dark2, borderRadius: 10, padding: '12px 8px', textAlign: 'center', border: `1px solid ${k.color}30` }}>
                      <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 15, fontWeight: 800, color: k.color }}>{k.val}</div>
                      <div style={{ fontSize: 9, color: C.muted, textTransform: 'uppercase', letterSpacing: 1, marginTop: 3 }}>{k.label}</div>
                    </div>
                  ))}
                </div>
              )}

              {/* Alerta % ingreso */}
              {pctIngreso > 0 && (
                <div style={{ background: pctIngreso > 30 ? `${C.red}12` : `${C.green}10`, border: `1px solid ${pctIngreso > 30 ? C.red + '40' : C.green + '25'}`, borderRadius: 10, padding: '10px 14px', fontSize: 11, color: C.text }}>
                  {pctIngreso > 30
                    ? `⚠️ Ahorrar ${fmt(porMes)}/mes representa el ${pctIngreso.toFixed(0)}% de tu ingreso. Considera extender el plazo.`
                    : `✅ Ahorrar ${fmt(porMes)}/mes es el ${pctIngreso.toFixed(0)}% de tu ingreso — un objetivo alcanzable.`}
                </div>
              )}
            </div>

            {/* Barra de progreso */}
            {meta.valorMeta > 0 && (
              <div style={{ background: C.card, borderRadius: 14, padding: 16, border: `1px solid ${C.border}` }}>
                <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 11, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>Progreso hacia la meta</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: C.muted, marginBottom: 6 }}>
                  <span>Ahorrado: <strong style={{ color: C.green }}>{fmt(totalAhorrado)}</strong></span>
                  <span>{pctAvance.toFixed(1)}%</span>
                  <span>Meta: <strong style={{ color: C.purple }}>{fmt(meta.valorMeta)}</strong></span>
                </div>
                <div style={{ background: C.dark2, borderRadius: 20, height: 12, overflow: 'hidden', marginBottom: 8 }}>
                  <div style={{ background: `linear-gradient(90deg, ${C.purple}, ${C.blue})`, height: '100%', width: `${pctAvance}%`, borderRadius: 20, transition: 'width 0.5s' }} />
                </div>
                {mesesRestantes > 0 && totalAhorrado < meta.valorMeta && (
                  <div style={{ fontSize: 11, color: C.muted, textAlign: 'center' }}>
                    A este ritmo llegas en aproximadamente <strong style={{ color: C.purple }}>{mesesRestantes}</strong> mes{mesesRestantes !== 1 ? 'es' : ''}
                  </div>
                )}
                {totalAhorrado >= meta.valorMeta && (
                  <div style={{ fontSize: 12, color: C.green, textAlign: 'center', fontWeight: 700 }}>
                    🎉 ¡Meta alcanzada! Felicitaciones.
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── SEGUIMIENTO ── */}
        {tab === 'seguimiento' && (
          <div>
            <div style={{ background: C.card, borderRadius: 14, padding: 16, marginBottom: 14, border: `1px solid ${C.border}` }}>
              <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 12, fontWeight: 700, color: C.muted, marginBottom: 12 }}>📅 Registro mensual de ahorro</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
                <div>
                  <div style={{ fontSize: 9, color: C.muted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 5 }}>Mes</div>
                  <select value={mes} onChange={e => setMes(parseInt(e.target.value))}
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
              <button onClick={addRegistroMes}
                style={{ width: '100%', background: C.dark2, border: `1.5px dashed ${C.purple}`, borderRadius: 10, padding: '10px', color: C.purple, fontFamily: 'Syne, sans-serif', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                + Registrar ahorro de {MESES[mes]} {ano}
              </button>
            </div>

            {/* Registros existentes */}
            {(meta.registros || []).length === 0 ? (
              <div style={{ background: C.card, borderRadius: 14, padding: 24, textAlign: 'center', border: `1px solid ${C.border}` }}>
                <div style={{ fontSize: 28, marginBottom: 8 }}>📅</div>
                <div style={{ color: C.muted, fontSize: 13 }}>Aún no hay registros de seguimiento. Agrega el primero arriba.</div>
              </div>
            ) : (
              <div>
                {(meta.registros || []).sort((a, b) => a.key.localeCompare(b.key)).map(reg => {
                  const cumple = reg.valor >= porMes;
                  return (
                    <div key={reg.key} style={{ background: C.card, borderRadius: 12, padding: 14, marginBottom: 10, border: `1px solid ${cumple ? C.green + '40' : C.border}` }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                        <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 12, fontWeight: 700, color: C.purple }}>{reg.key}</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: 10, color: cumple ? C.green : C.yellow, fontWeight: 700 }}>
                            {cumple ? '✅ Meta cumplida' : '⚠️ Bajo la meta'}
                          </span>
                          <button onClick={() => delRegistro(reg.key)}
                            style={{ background: C.dark2, border: `1px solid ${C.border}`, borderRadius: 6, padding: '2px 8px', color: C.red, cursor: 'pointer', fontSize: 11 }}>✕</button>
                        </div>
                      </div>
                      <div style={{ marginBottom: 8 }}>
                        <div style={{ fontSize: 9, color: C.muted, marginBottom: 4 }}>Cuánto ahorré este mes</div>
                        <CInput value={reg.valor || 0} onChange={v => updRegistro(reg.key, 'valor', v)} color={C.purple} />
                      </div>
                      <input value={reg.nota || ''} onChange={e => updRegistro(reg.key, 'nota', e.target.value)}
                        placeholder="Nota opcional…"
                        style={{ width: '100%', background: C.dark2, border: `1.5px solid ${C.border}`, borderRadius: 7, padding: '7px 10px', color: C.text, fontSize: 11, outline: 'none', boxSizing: 'border-box' }}
                        onFocus={e => e.target.style.borderColor = C.purple} onBlur={e => e.target.style.borderColor = C.border} />
                      {porMes > 0 && (
                        <div style={{ marginTop: 8 }}>
                          <div style={{ background: C.dark, borderRadius: 8, height: 5, overflow: 'hidden' }}>
                            <div style={{ background: cumple ? C.green : C.yellow, height: '100%', width: `${Math.min((reg.valor / porMes) * 100, 100)}%`, borderRadius: 8 }} />
                          </div>
                          <div style={{ fontSize: 9, color: C.muted, marginTop: 3, textAlign: 'right' }}>
                            {((reg.valor / porMes) * 100).toFixed(0)}% de la meta mensual ({fmt(porMes)})
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── PROYECCIÓN ── */}
        {tab === 'proyeccion' && (
          <div>
            <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 18, fontWeight: 800, color: '#fff', marginBottom: 14 }}>📈 Proyección de la meta</div>

            {meta.valorMeta === 0 ? (
              <div style={{ background: C.card, borderRadius: 14, padding: 24, textAlign: 'center', border: `1px solid ${C.border}` }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>🧭</div>
                <div style={{ color: C.muted, fontSize: 13 }}>Define tu meta en la pestaña "Mi Meta" para ver la proyección</div>
              </div>
            ) : (
              <>
                {/* KPIs */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
                  {[
                    { label: 'Meta', val: fmt(meta.valorMeta), color: C.purple },
                    { label: 'Ahorrado', val: fmt(totalAhorrado), color: C.green },
                    { label: 'Faltante', val: fmt(Math.max(0, meta.valorMeta - totalAhorrado)), color: C.blue },
                    { label: 'Avance', val: `${pctAvance.toFixed(1)}%`, color: pctAvance >= 50 ? C.green : C.yellow },
                  ].map((k, i) => (
                    <div key={i} style={{ background: C.card, borderRadius: 10, padding: '12px', textAlign: 'center', border: `1px solid ${k.color}30` }}>
                      <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 16, fontWeight: 800, color: k.color }}>{k.val}</div>
                      <div style={{ fontSize: 9, color: C.muted, textTransform: 'uppercase', letterSpacing: 1, marginTop: 3 }}>{k.label}</div>
                    </div>
                  ))}
                </div>

                {/* Gráfico de progreso */}
                {chartData.length > 1 && (
                  <div style={{ background: C.card, borderRadius: 14, padding: 16, marginBottom: 14, border: `1px solid ${C.border}` }}>
                    <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 11, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>Progreso acumulado vs meta</div>
                    <ResponsiveContainer width="100%" height={160}>
                      <LineChart data={chartData}>
                        <XAxis dataKey="label" tick={{ fill: C.muted, fontSize: 9 }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fill: C.muted, fontSize: 8 }} tickFormatter={v => `$${fmtK(v)}`} axisLine={false} tickLine={false} />
                        <Tooltip formatter={(v, n) => [fmt(v), n]} contentStyle={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 11 }} />
                        <ReferenceLine y={meta.valorMeta} stroke={C.purple} strokeDasharray="4 4" />
                        <Line type="monotone" dataKey="valor" name="Ahorrado" stroke={C.green} strokeWidth={2} dot={{ fill: C.green, r: 4 }} />
                        <Line type="monotone" dataKey="meta" name="Meta" stroke={C.purple} strokeWidth={1} strokeDasharray="4 4" dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}

                {/* Plan de acción */}
                <div style={{ background: C.card, borderRadius: 14, padding: 16, border: `1px solid ${C.purple}30` }}>
                  <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 12, fontWeight: 700, color: C.purple, marginBottom: 12 }}>📋 Tu plan de ahorro</div>
                  {[
                    { label: 'Meta', val: meta.nombre || 'Sin definir', color: C.purple },
                    { label: 'Por qué', val: meta.porque || 'Sin definir', color: C.muted },
                    { label: 'Plazo total', val: `${meta.plazoSemanas} semanas`, color: C.blue },
                    { label: 'Ahorro semanal', val: fmt(porSemana), color: C.green },
                    { label: 'Ahorro mensual', val: fmt(porMes), color: C.green },
                    { label: '% del ingreso', val: `${pctIngreso.toFixed(1)}%`, color: pctIngreso > 30 ? C.red : C.green },
                  ].map((item, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: i < 5 ? `1px dashed ${C.border}` : 'none' }}>
                      <span style={{ fontSize: 11, color: C.muted }}>{item.label}</span>
                      <span style={{ fontSize: 11, fontWeight: 700, color: item.color }}>{item.val}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
