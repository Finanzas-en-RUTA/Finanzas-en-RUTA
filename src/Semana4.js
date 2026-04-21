import React, { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from './supabase';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

const C = {
  dark:'#0F1923', dark2:'#1A2535', card:'#1E2D3D', border:'#2A3F55',
  green:'#00C48C', yellow:'#FFB800', blue:'#0A84FF', red:'#FF5A5F',
  purple:'#A29BFE', teal:'#00CEC9', text:'#E8F0F8', muted:'#7A93AC', header:'#0D1F2D',
};
const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const ANOS = ['2026','2027','2028','2029','2030','2031','2032','2033','2034','2035','2036'];
const fmt = n => { const v = Math.round(n||0); return v === 0 ? '$ 0' : `$ ${v.toLocaleString('es-CO')}`; };
const fmtK = n => { if(!n) return '0'; if(Math.abs(n)>=1000000) return `${(n/1000000).toFixed(1)}M`; if(Math.abs(n)>=1000) return `${(n/1000).toFixed(0)}k`; return `${n}`; };

const PALANCAS = [
  { id: 'cdt', label: 'Hacer rendir el ahorro', icon: '🏦', desc: 'CDT, fondos de inversión, cuentas de alto rendimiento.', retorno: 'Bajo riesgo · 8-15% anual', color: C.green },
  { id: 'habilidad', label: 'Monetizar una habilidad', icon: '💡', desc: 'Freelance, consultoría, clases, servicios con lo que ya sabes hacer.', retorno: 'Riesgo medio · Retorno rápido', color: C.blue },
  { id: 'digital', label: 'Ingreso digital', icon: '📱', desc: 'Curso online, producto digital, contenido, afiliados.', retorno: 'Escalable · Requiere tiempo inicial', color: C.purple },
  { id: 'negocio', label: 'Emprender con lo que tienes', icon: '🏪', desc: 'Reventa, servicio local, producto artesanal.', retorno: 'Riesgo moderado · Ingreso inmediato', color: C.yellow },
  { id: 'inversion', label: 'Invertir (acciones/finca raíz)', icon: '📈', desc: 'Acciones, ETFs, apartamento en arriendo.', retorno: 'Largo plazo · Requiere capital', color: C.teal },
];

function CInput({ value, onChange, color = C.red, size = 13 }) {
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

function emptyData() {
  return {
    palancaElegida: '',
    porQue: '',
    primerPaso: '',
    fechaPrimerPaso: '',
    rutinaSemanal: '',
    metaIngresoExtra: 0,
    acciones: [],
    registrosMensuales: {},
    reflexion: '',
  };
}

export default function Semana4({ user, onBack }) {
  const [tab, setTab] = useState('palanca');
  const [data, setData] = useState(emptyData());
  const [mes, setMes] = useState(new Date().getMonth());
  const [ano, setAno] = useState('2026');
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');
  const timer = useRef(null);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const { data: db } = await supabase.from('panel_financiero').select('data').eq('user_id', user.id).single();
      if (db?.data?.s4_data) setData(db.data.s4_data);
      if (db?.data?.s4_mes !== undefined) setMes(db.data.s4_mes);
      if (db?.data?.s4_ano) setAno(db.data.s4_ano);
    };
    load();
  }, [user]);

  const saveData = useCallback(async (d) => {
    if (!user) return;
    setSaving(true);
    const { data: existing } = await supabase.from('panel_financiero').select('data').eq('user_id', user.id).single();
    const merged = { ...(existing?.data || {}), s4_data: d, s4_mes: mes, s4_ano: ano };
    await supabase.from('panel_financiero').update({ data: merged }).eq('user_id', user.id);
    setSaving(false); setSaveMsg('✓ Guardado'); setTimeout(() => setSaveMsg(''), 2000);
  }, [user, mes, ano]);

  const trig = useCallback((d) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => saveData(d), 1000);
  }, [saveData]);

  const upd = (path, val) => {
    const nd = JSON.parse(JSON.stringify(data));
    const keys = path.split('.');
    let obj = nd;
    for (let i = 0; i < keys.length - 1; i++) obj = obj[keys[i]];
    obj[keys[keys.length - 1]] = val;
    setData(nd); trig(nd);
  };

  const palancaActual = PALANCAS.find(p => p.id === data.palancaElegida);
  const mesKey = `${ano}-${MESES[mes]}`;
  const regMes = data.registrosMensuales?.[mesKey] || { ingreso: 0, horas: 0, logro: '', nextPaso: '' };

  const updReg = (field, val) => {
    const nd = JSON.parse(JSON.stringify(data));
    if (!nd.registrosMensuales) nd.registrosMensuales = {};
    if (!nd.registrosMensuales[mesKey]) nd.registrosMensuales[mesKey] = { ingreso: 0, horas: 0, logro: '', nextPaso: '' };
    nd.registrosMensuales[mesKey][field] = val;
    setData(nd); trig(nd);
  };

  const addAccion = () => {
    const nd = JSON.parse(JSON.stringify(data));
    nd.acciones.push({ texto: '', completada: false, fecha: '' });
    setData(nd); trig(nd);
  };

  const chartData = Object.entries(data.registrosMensuales || {})
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, d]) => ({ label: key.split('-')[1]?.substring(0, 3) || key, ingreso: d.ingreso || 0 }));

  const totalIngresoExtra = Object.values(data.registrosMensuales || {}).reduce((s, r) => s + (r.ingreso || 0), 0);
  const accionesDone = (data.acciones || []).filter(a => a.completada).length;

  const inp = { width: '100%', background: C.dark2, border: `1.5px solid ${C.border}`, borderRadius: 7, padding: '9px 12px', color: C.text, fontFamily: "'DM Sans', sans-serif", fontSize: 13, outline: 'none', boxSizing: 'border-box' };

  const TABS = [
    { id: 'palanca', label: '🚀 Mi Palanca' },
    { id: 'plan', label: '📋 Plan de Acción' },
    { id: 'resultados', label: '📊 Resultados' },
  ];

  return (
    <div style={{ background: C.dark, minHeight: '100vh', fontFamily: "'DM Sans', sans-serif", color: C.text }}>
      <div style={{ background: C.header, borderBottom: `1px solid ${C.border}`, padding: '10px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 50 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button onClick={onBack} style={{ background: C.dark2, border: `1px solid ${C.border}`, borderRadius: 7, padding: '5px 10px', color: C.muted, fontSize: 11, cursor: 'pointer' }}>← Volver</button>
          <div style={{ background: C.red, color: '#fff', fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 10, letterSpacing: 1, padding: '4px 9px', borderRadius: 4 }}>SEMANA 4</div>
          <span style={{ fontSize: 11, color: C.muted }}>Palanca de Crecimiento</span>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {saving && <span style={{ fontSize: 10, color: C.muted }}>Guardando...</span>}
          {saveMsg && <span style={{ fontSize: 10, color: C.green }}>{saveMsg}</span>}
        </div>
      </div>

      <div style={{ background: C.header, borderBottom: `1px solid ${C.border}`, display: 'flex' }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{ background: 'transparent', border: 'none', borderBottom: tab === t.id ? `3px solid ${C.red}` : '3px solid transparent', padding: '11px 16px', color: tab === t.id ? C.red : C.muted, fontFamily: 'Syne, sans-serif', fontSize: 11, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>
            {t.label}
          </button>
        ))}
      </div>

      <div style={{ padding: '16px 16px 40px', maxWidth: 820, margin: '0 auto' }}>

        {/* ── PALANCA ── */}
        {tab === 'palanca' && (
          <div>
            <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 17, fontWeight: 800, color: '#fff', marginBottom: 4 }}>🚀 Elige tu palanca de crecimiento</div>
            <p style={{ fontSize: 12, color: C.muted, marginBottom: 16 }}>La palanca que eliges debe apalancarse en lo que ya tienes: tiempo, habilidades o dinero.</p>

            {PALANCAS.map(p => {
              const sel = data.palancaElegida === p.id;
              return (
                <div key={p.id} onClick={() => upd('palancaElegida', p.id)}
                  style={{ background: sel ? `${p.color}12` : C.card, border: `1.5px solid ${sel ? p.color : C.border}`, borderRadius: 12, padding: '14px 16px', marginBottom: 10, cursor: 'pointer', transition: 'all 0.15s' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span style={{ fontSize: 24 }}>{p.icon}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 12, fontWeight: 700, color: sel ? p.color : C.text }}>{sel ? '✓ ' : ''}{p.label}</div>
                      <div style={{ fontSize: 11, color: C.muted, marginTop: 3 }}>{p.desc}</div>
                      <div style={{ fontSize: 10, color: p.color, marginTop: 4, fontWeight: 600 }}>📊 {p.retorno}</div>
                    </div>
                  </div>
                </div>
              );
            })}

            {palancaActual && (
              <div style={{ background: `${palancaActual.color}12`, border: `1.5px solid ${palancaActual.color}40`, borderRadius: 14, padding: 16, marginTop: 6 }}>
                <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 12, fontWeight: 700, color: palancaActual.color, marginBottom: 12 }}>
                  {palancaActual.icon} Elegiste: {palancaActual.label}
                </div>
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 9, color: C.muted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>¿Por qué elegiste esta palanca?</div>
                  <textarea value={data.porQue} onChange={e => upd('porQue', e.target.value)} placeholder="¿Qué tienes tú que te permita activar esta palanca?" rows={3}
                    style={{ ...inp, resize: 'none' }} onFocus={e => e.target.style.borderColor = palancaActual.color} onBlur={e => e.target.style.borderColor = C.border} />
                </div>
                <div>
                  <div style={{ fontSize: 9, color: C.muted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>Meta de ingreso extra mensual</div>
                  <CInput value={data.metaIngresoExtra} onChange={v => upd('metaIngresoExtra', v)} color={palancaActual.color} />
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── PLAN ── */}
        {tab === 'plan' && (
          <div>
            <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 17, fontWeight: 800, color: '#fff', marginBottom: 14 }}>📋 Plan de los próximos 30 días</div>

            <div style={{ background: C.card, borderRadius: 14, padding: 16, marginBottom: 14, border: `1px solid ${C.border}` }}>
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 9, color: C.muted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>Primer paso concreto (esta semana)</div>
                <textarea value={data.primerPaso} onChange={e => upd('primerPaso', e.target.value)} placeholder="¿Qué vas a hacer ESTA semana para activar tu palanca?" rows={2}
                  style={{ ...inp, resize: 'none' }} onFocus={e => e.target.style.borderColor = C.red} onBlur={e => e.target.style.borderColor = C.border} />
              </div>
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 9, color: C.muted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>Fecha de ejecución del primer paso</div>
                <input type="date" value={data.fechaPrimerPaso} onChange={e => upd('fechaPrimerPaso', e.target.value)}
                  style={{ ...inp, color: C.red }} onFocus={e => e.target.style.borderColor = C.red} onBlur={e => e.target.style.borderColor = C.border} />
              </div>
              <div>
                <div style={{ fontSize: 9, color: C.muted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>Mi rutina semanal para la palanca</div>
                <textarea value={data.rutinaSemanal} onChange={e => upd('rutinaSemanal', e.target.value)} placeholder="¿Qué días y cuánto tiempo dedicas a la palanca cada semana?" rows={2}
                  style={{ ...inp, resize: 'none' }} onFocus={e => e.target.style.borderColor = C.red} onBlur={e => e.target.style.borderColor = C.border} />
              </div>
            </div>

            {/* Lista de acciones */}
            <div style={{ background: C.card, borderRadius: 14, padding: 16, marginBottom: 14, border: `1px solid ${C.border}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 12, fontWeight: 700, color: C.red }}>
                  ✅ Acciones del plan <span style={{ color: C.muted, fontWeight: 400, fontSize: 10 }}>({accionesDone}/{data.acciones.length} completadas)</span>
                </div>
              </div>

              {(data.acciones || []).length === 0 ? (
                <div style={{ fontSize: 12, color: C.muted, textAlign: 'center', padding: '10px 0' }}>Agrega las acciones concretas de tu plan</div>
              ) : (
                (data.acciones || []).map((accion, idx) => (
                  <div key={idx} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginBottom: 8, background: accion.completada ? `${C.green}08` : C.dark2, borderRadius: 8, padding: '10px 12px', border: `1px solid ${accion.completada ? C.green + '30' : C.border}` }}>
                    <input type="checkbox" checked={accion.completada} onChange={e => {
                      const nd = JSON.parse(JSON.stringify(data));
                      nd.acciones[idx].completada = e.target.checked;
                      setData(nd); trig(nd);
                    }} style={{ marginTop: 2, width: 16, height: 16, cursor: 'pointer', accentColor: C.green }} />
                    <input value={accion.texto} onChange={e => {
                      const nd = JSON.parse(JSON.stringify(data));
                      nd.acciones[idx].texto = e.target.value;
                      setData(nd); trig(nd);
                    }} placeholder="Describe la acción…"
                      style={{ flex: 1, background: 'transparent', border: 'none', color: accion.completada ? C.muted : C.text, fontSize: 12, outline: 'none', textDecoration: accion.completada ? 'line-through' : 'none' }} />
                    <button onClick={() => {
                      const nd = JSON.parse(JSON.stringify(data));
                      nd.acciones.splice(idx, 1);
                      setData(nd); trig(nd);
                    }} style={{ background: 'transparent', border: 'none', color: C.red, cursor: 'pointer', fontSize: 13 }}>✕</button>
                  </div>
                ))
              )}

              <button onClick={addAccion}
                style={{ background: 'transparent', border: `1.5px dashed ${C.red}`, borderRadius: 8, padding: '8px', width: '100%', color: C.red, fontSize: 11, fontWeight: 700, cursor: 'pointer', marginTop: 6 }}>
                + Agregar acción
              </button>

              {data.acciones.length > 0 && (
                <div style={{ marginTop: 12 }}>
                  <div style={{ background: C.dark, borderRadius: 8, height: 6, overflow: 'hidden' }}>
                    <div style={{ background: C.green, height: '100%', width: `${data.acciones.length > 0 ? (accionesDone / data.acciones.length) * 100 : 0}%`, borderRadius: 8, transition: 'width 0.4s' }} />
                  </div>
                </div>
              )}
            </div>

            {/* Reflexión */}
            <div style={{ background: C.card, borderRadius: 14, padding: 16, border: `1px solid ${C.border}` }}>
              <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 12, fontWeight: 700, color: C.muted, marginBottom: 8 }}>💬 Reflexión final</div>
              <textarea value={data.reflexion} onChange={e => upd('reflexion', e.target.value)}
                placeholder="¿Cuál es el mayor cambio que notaste en tu relación con el dinero en estas 4 semanas?" rows={4}
                style={{ ...inp, resize: 'none' }} onFocus={e => e.target.style.borderColor = C.yellow} onBlur={e => e.target.style.borderColor = C.border} />
            </div>
          </div>
        )}

        {/* ── RESULTADOS ── */}
        {tab === 'resultados' && (
          <div>
            <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 17, fontWeight: 800, color: '#fff', marginBottom: 14 }}>📊 Resultados de la palanca</div>

            {/* Selector mes */}
            <div style={{ background: C.card, borderRadius: 14, padding: 16, marginBottom: 14, border: `1px solid ${C.border}` }}>
              <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 12, fontWeight: 700, color: C.muted, marginBottom: 10 }}>Registra el mes</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
                <div>
                  <div style={{ fontSize: 9, color: C.muted, marginBottom: 5 }}>Mes</div>
                  <select value={mes} onChange={e => setMes(parseInt(e.target.value))}
                    style={{ width: '100%', background: C.dark2, border: `1.5px solid ${C.border}`, borderRadius: 7, padding: '8px 10px', color: C.text, fontSize: 13, outline: 'none' }}>
                    {MESES.map((m, i) => <option key={m} value={i}>{m}</option>)}
                  </select>
                </div>
                <div>
                  <div style={{ fontSize: 9, color: C.muted, marginBottom: 5 }}>Año</div>
                  <select value={ano} onChange={e => setAno(e.target.value)}
                    style={{ width: '100%', background: C.dark2, border: `1.5px solid ${C.border}`, borderRadius: 7, padding: '8px 10px', color: C.text, fontSize: 13, outline: 'none' }}>
                    {ANOS.map(a => <option key={a} value={a}>{a}</option>)}
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                <div>
                  <div style={{ fontSize: 9, color: C.muted, marginBottom: 5 }}>Ingreso extra generado</div>
                  <CInput value={regMes.ingreso} onChange={v => updReg('ingreso', v)} color={C.red} />
                </div>
                <div>
                  <div style={{ fontSize: 9, color: C.muted, marginBottom: 5 }}>Horas invertidas</div>
                  <input type="number" value={regMes.horas} onChange={e => updReg('horas', parseInt(e.target.value) || 0)}
                    style={{ width: '100%', background: C.dark2, border: `1.5px solid ${C.border}`, borderRadius: 7, padding: '9px 12px', color: C.red, fontFamily: 'Syne, sans-serif', fontSize: 13, fontWeight: 700, outline: 'none', boxSizing: 'border-box' }}
                    onFocus={e => e.target.style.borderColor = C.red} onBlur={e => e.target.style.borderColor = C.border} />
                </div>
              </div>

              <div style={{ marginBottom: 8 }}>
                <div style={{ fontSize: 9, color: C.muted, marginBottom: 5 }}>Principal logro del mes</div>
                <input value={regMes.logro} onChange={e => updReg('logro', e.target.value)} placeholder="¿Qué lograste este mes con tu palanca?"
                  style={{ width: '100%', background: C.dark2, border: `1.5px solid ${C.border}`, borderRadius: 7, padding: '9px 12px', color: C.text, fontSize: 12, outline: 'none', boxSizing: 'border-box' }}
                  onFocus={e => e.target.style.borderColor = C.red} onBlur={e => e.target.style.borderColor = C.border} />
              </div>

              <div>
                <div style={{ fontSize: 9, color: C.muted, marginBottom: 5 }}>Próximo paso para el siguiente mes</div>
                <input value={regMes.nextPaso} onChange={e => updReg('nextPaso', e.target.value)} placeholder="¿Qué harás diferente o adicional?"
                  style={{ width: '100%', background: C.dark2, border: `1.5px solid ${C.border}`, borderRadius: 7, padding: '9px 12px', color: C.text, fontSize: 12, outline: 'none', boxSizing: 'border-box' }}
                  onFocus={e => e.target.style.borderColor = C.green} onBlur={e => e.target.style.borderColor = C.border} />
              </div>
            </div>

            {/* KPIs */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 14 }}>
              {[
                { label: 'Total generado', val: fmt(totalIngresoExtra), color: C.red },
                { label: 'Meta mensual', val: fmt(data.metaIngresoExtra), color: C.yellow },
                { label: '% de la meta', val: data.metaIngresoExtra > 0 ? `${Math.round((totalIngresoExtra / (data.metaIngresoExtra * Object.keys(data.registrosMensuales || {}).length || 1)) * 100)}%` : '—', color: C.green },
              ].map((k, i) => (
                <div key={i} style={{ background: C.card, borderRadius: 10, padding: '12px 8px', textAlign: 'center', border: `1px solid ${k.color}30` }}>
                  <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 14, fontWeight: 800, color: k.color }}>{k.val}</div>
                  <div style={{ fontSize: 9, color: C.muted, textTransform: 'uppercase', letterSpacing: 1, marginTop: 3 }}>{k.label}</div>
                </div>
              ))}
            </div>

            {/* Gráfico */}
            {chartData.length > 0 && (
              <div style={{ background: C.card, borderRadius: 14, padding: 16, border: `1px solid ${C.border}` }}>
                <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 11, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>Ingreso extra por mes</div>
                <ResponsiveContainer width="100%" height={150}>
                  <BarChart data={chartData} barSize={20}>
                    <XAxis dataKey="label" tick={{ fill: C.muted, fontSize: 9 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: C.muted, fontSize: 8 }} tickFormatter={v => `$${fmtK(v)}`} axisLine={false} tickLine={false} />
                    <Tooltip formatter={v => [fmt(v), 'Ingreso extra']} contentStyle={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 11 }} />
                    <Bar dataKey="ingreso" fill={C.red} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
