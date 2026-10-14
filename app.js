(() => {
  'use strict';

  const CLAVE = 'mis-gastos.v1';

  const CATEGORIAS = {
    gasto: [
      ['Comida', '🍽️'], ['Transporte', '🚌'], ['Casa', '🏠'], ['Servicios', '💡'],
      ['Salud', '💊'], ['Compras', '🛍️'], ['Educación', '📚'], ['Otros', '📦'],
    ],
    ingreso: [
      ['Internet', '🌐'], ['Salario', '💼'], ['Negocio', '🏪'], ['Ventas', '🧾'], ['Regalo', '🎁'], ['Otros', '💰'],
    ],
  };

  const $ = (id) => document.getElementById(id);
  const p2 = (n) => String(n).padStart(2, '0');

  // ---------- Datos ----------
  // Cada movimiento: { id, tipo: 'gasto'|'ingreso', cents, cat, nota, fecha: 'YYYY-MM-DDTHH:mm' }
  let estado = cargar();

  function cargar() {
    try {
      const s = JSON.parse(localStorage.getItem(CLAVE));
      if (s && Array.isArray(s.items)) {
        return {
          items: s.items.filter(esValido),
          moneda: typeof s.moneda === 'string' && s.moneda ? s.moneda : '$',
          gbnex: s.gbnex && typeof s.gbnex.token === 'string' ? s.gbnex : null,
        };
      }
    } catch (e) { /* datos corruptos: se empieza de cero */ }
    return { items: [], moneda: '$', gbnex: null };
  }

  function guardar() {
    try {
      localStorage.setItem(CLAVE, JSON.stringify(estado));
      return true;
    } catch (e) {
      alert('No se pudo guardar: el almacenamiento del teléfono está lleno o bloqueado.');
      return false;
    }
  }

  function esValido(m) {
    return m && typeof m.id === 'string' &&
      (m.tipo === 'gasto' || m.tipo === 'ingreso') &&
      Number.isInteger(m.cents) && m.cents > 0 &&
      typeof m.cat === 'string' && typeof m.fecha === 'string' &&
      !isNaN(new Date(m.fecha).getTime());
  }

  // ---------- Fechas ----------
  function aInput(d) {
    return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}T${p2(d.getHours())}:${p2(d.getMinutes())}`;
  }
  const claveDia = (d) => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;

  // Devuelve [inicio, fin) del periodo que contiene a d. La semana va de lunes a domingo.
  function rango(vista, d) {
    const y = d.getFullYear(), m = d.getMonth(), dia = d.getDate();
    if (vista === 'dia') return [new Date(y, m, dia), new Date(y, m, dia + 1)];
    if (vista === 'semana') {
      const desdeLunes = (d.getDay() + 6) % 7;
      return [new Date(y, m, dia - desdeLunes), new Date(y, m, dia - desdeLunes + 7)];
    }
    if (vista === 'mes') return [new Date(y, m, 1), new Date(y, m + 1, 1)];
    return [new Date(y, 0, 1), new Date(y + 1, 0, 1)];
  }

  function mover(vista, d, paso) {
    const y = d.getFullYear(), m = d.getMonth(), dia = d.getDate();
    if (vista === 'dia') return new Date(y, m, dia + paso);
    if (vista === 'semana') return new Date(y, m, dia + 7 * paso);
    if (vista === 'mes') return new Date(y, m + paso, 1);
    return new Date(y + paso, 0, 1);
  }

  function etiquetaPeriodo(vista, ini, fin) {
    if (vista === 'dia') {
      const hoy = claveDia(new Date()) === claveDia(ini) ? 'Hoy · ' : '';
      return hoy + ini.toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    }
    if (vista === 'semana') {
      const ult = new Date(fin.getFullYear(), fin.getMonth(), fin.getDate() - 1);
      const a = ini.toLocaleDateString('es', { day: 'numeric', month: 'short' });
      const b = ult.toLocaleDateString('es', { day: 'numeric', month: 'short', year: 'numeric' });
      return `${a} – ${b}`;
    }
    if (vista === 'mes') return ini.toLocaleDateString('es', { month: 'long', year: 'numeric' });
    return String(ini.getFullYear());
  }

  // ---------- Dinero ----------
  function dinero(cents) {
    const n = (Math.abs(cents) / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return `${cents < 0 ? '−' : ''}${estado.moneda}${n}`;
  }

  // Acepta "12.50", "12,50", "1,234.50" y "1.234,50". Devuelve centavos o NaN.
  function leerMonto(txt) {
    let s = String(txt).replace(/[^\d.,]/g, '');
    if (!s) return NaN;
    const coma = s.lastIndexOf(','), punto = s.lastIndexOf('.');
    if (coma >= 0 && punto >= 0) {
      const dec = coma > punto ? ',' : '.';
      const mil = dec === ',' ? '.' : ',';
      s = s.split(mil).join('').replace(dec, '.');
    } else {
      const sep = coma >= 0 ? ',' : punto >= 0 ? '.' : '';
      if (sep) {
        const partes = s.split(sep);
        const esDecimal = partes.length === 2 && partes[1].length <= 2;
        s = esDecimal ? partes.join('.') : partes.join('');
      }
    }
    const n = Number(s);
    return isFinite(n) ? Math.round(n * 100) : NaN;
  }

  function emojiDe(tipo, cat) {
    const c = (CATEGORIAS[tipo] || []).find(([n]) => n === cat);
    return c ? c[1] : (tipo === 'ingreso' ? '💰' : '📦');
  }

  // ---------- Vista ----------
  let vista = 'dia';
  let cursor = new Date();

  function el(tag, clase, texto) {
    const e = document.createElement(tag);
    if (clase) e.className = clase;
    if (texto != null) e.textContent = texto;
    return e;
  }

  function pintar() {
    const [ini, fin] = rango(vista, cursor);
    $('btnHoy').textContent = etiquetaPeriodo(vista, ini, fin);
    document.querySelectorAll('#tabs button').forEach((b) =>
      b.setAttribute('aria-selected', String(b.dataset.vista === vista)));

    const items = estado.items
      .filter((m) => { const t = new Date(m.fecha); return t >= ini && t < fin; })
      .sort((a, b) => (a.fecha < b.fecha ? 1 : a.fecha > b.fecha ? -1 : 0));

    let ingresos = 0, gastos = 0;
    for (const m of items) m.tipo === 'ingreso' ? (ingresos += m.cents) : (gastos += m.cents);
    const balance = ingresos - gastos;

    $('totIngresos').textContent = '+' + dinero(ingresos);
    $('totGastos').textContent = '−' + dinero(gastos);
    const b = $('balance');
    b.textContent = dinero(balance);
    b.className = 'balance' + (balance < 0 ? ' gasto' : '');

    pintarGrafica(items, ini, fin);
    pintarCategorias(items, gastos);
    pintarLista(items);
  }

  function pintarGrafica(items, ini, fin) {
    const card = $('cardGrafica');
    if (vista === 'dia' || !items.length) { card.hidden = true; return; }
    card.hidden = false;

    let n, indice, etiqueta;
    if (vista === 'semana') {
      n = 7;
      indice = (t) => (t.getDay() + 6) % 7;
      etiqueta = (i) => 'LMXJVSD'[i];
      $('tituloGrafica').textContent = 'Por día';
    } else if (vista === 'mes') {
      n = new Date(ini.getFullYear(), ini.getMonth() + 1, 0).getDate();
      indice = (t) => t.getDate() - 1;
      etiqueta = (i) => (i === 0 || (i + 1) % 5 === 0 ? String(i + 1) : '');
      $('tituloGrafica').textContent = 'Por día';
    } else {
      n = 12;
      indice = (t) => t.getMonth();
      etiqueta = (i) => 'EFMAMJJASOND'[i];
      $('tituloGrafica').textContent = 'Por mes';
    }

    const ing = new Array(n).fill(0), gas = new Array(n).fill(0);
    for (const m of items) {
      const i = indice(new Date(m.fecha));
      (m.tipo === 'ingreso' ? ing : gas)[i] += m.cents;
    }
    const max = Math.max(1, ...ing, ...gas);

    const g = $('grafica'), ejes = $('graficaEjes');
    g.textContent = ''; ejes.textContent = '';
    for (let i = 0; i < n; i++) {
      const col = el('div', 'col');
      for (const [v, c] of [[ing[i], 'i'], [gas[i], 'g']]) {
        const barra = el('div', 'barra ' + (v ? c : 'cero'));
        barra.style.height = v ? Math.max(3, (v / max) * 100) + '%' : '2px';
        col.appendChild(barra);
      }
      g.appendChild(col);
      ejes.appendChild(el('span', '', etiqueta(i)));
    }
    g.setAttribute('aria-label', 'Gráfica de ingresos (verde) y gastos (rojo) del periodo');
  }

  function pintarCategorias(items, totalGastos) {
    const card = $('cardCategorias');
    const porCat = new Map();
    for (const m of items) if (m.tipo === 'gasto') porCat.set(m.cat, (porCat.get(m.cat) || 0) + m.cents);
    if (!porCat.size) { card.hidden = true; return; }
    card.hidden = false;

    const ul = $('categorias');
    ul.textContent = '';
    [...porCat.entries()].sort((a, b) => b[1] - a[1]).forEach(([cat, cents]) => {
      const pct = Math.round((cents / totalGastos) * 100);
      const li = el('li');
      const fila = el('div', 'fila');
      fila.appendChild(el('span', '', `${emojiDe('gasto', cat)} ${cat}`));
      fila.appendChild(el('span', '', `${dinero(cents)} · ${pct}%`));
      const pista = el('div', 'pista');
      const relleno = el('div');
      relleno.style.width = Math.max(2, pct) + '%';
      pista.appendChild(relleno);
      li.append(fila, pista);
      ul.appendChild(li);
    });
  }

  function pintarLista(items) {
    const lista = $('lista');
    lista.textContent = '';
    $('vacio').hidden = items.length > 0;

    const grupos = new Map();
    for (const m of items) {
      const k = m.fecha.slice(0, 10);
      if (!grupos.has(k)) grupos.set(k, []);
      grupos.get(k).push(m);
    }

    for (const [k, movs] of grupos) {
      const fecha = new Date(k + 'T00:00');
      const neto = movs.reduce((s, m) => s + (m.tipo === 'ingreso' ? m.cents : -m.cents), 0);
      const titulo = el('div', 'dia-titulo');
      titulo.appendChild(el('span', '', fecha.toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'long' })));
      titulo.appendChild(el('span', '', (neto > 0 ? '+' : '') + dinero(neto)));
      lista.appendChild(titulo);

      const grupo = el('div', 'grupo');
      for (const m of movs) {
        const hora = new Date(m.fecha).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' });
        const fila = el('button', 'mov');
        fila.type = 'button';
        fila.dataset.id = m.id;
        fila.appendChild(el('span', 'emoji', emojiDe(m.tipo, m.cat)));
        const info = el('span', 'info');
        info.appendChild(el('div', 'cat', m.cat));
        info.appendChild(el('div', 'sub', m.nota ? `${hora} · ${m.nota}` : hora));
        fila.appendChild(info);
        fila.appendChild(el('span', 'cant ' + m.tipo, (m.tipo === 'ingreso' ? '+' : '−') + dinero(m.cents)));
        grupo.appendChild(fila);
      }
      lista.appendChild(grupo);
    }
  }

  function pintarReloj() {
    const a = new Date();
    $('reloj').textContent =
      a.toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'long' }) + ' · ' +
      a.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' });
  }

  // ---------- Formulario ----------
  let editando = null;   // id del movimiento en edición, o null si es nuevo
  let tipoSel = 'gasto';
  let catSel = 'Comida';

  function pintarTipo() {
    document.querySelectorAll('.tipo button').forEach((b) =>
      b.setAttribute('aria-checked', String(b.dataset.tipo === tipoSel)));
    const chips = $('chips');
    chips.textContent = '';
    const cats = CATEGORIAS[tipoSel];
    if (!cats.some(([n]) => n === catSel)) catSel = cats[0][0];
    for (const [nombre, emoji] of cats) {
      const b = el('button', '', `${emoji} ${nombre}`);
      b.type = 'button';
      b.dataset.cat = nombre;
      b.setAttribute('aria-pressed', String(nombre === catSel));
      chips.appendChild(b);
    }
  }

  function abrirMov(mov) {
    editando = mov ? mov.id : null;
    tipoSel = mov ? mov.tipo : 'gasto';
    catSel = mov ? mov.cat : CATEGORIAS.gasto[0][0];
    $('tituloMov').textContent = mov ? 'Editar movimiento' : 'Nuevo movimiento';
    $('simboloMonto').textContent = estado.moneda;
    $('inMonto').value = mov ? (mov.cents / 100).toFixed(2) : '';
    $('inFecha').value = mov ? mov.fecha.slice(0, 16) : aInput(new Date());
    $('inNota').value = mov ? mov.nota || '' : '';
    $('btnBorrar').hidden = !mov;
    $('errorMov').hidden = true;
    pintarTipo();
    abrir('hojaMov');
    if (!mov) $('inMonto').focus();
  }

  function errorMov(msg) {
    const e = $('errorMov');
    e.textContent = msg;
    e.hidden = false;
  }

  function guardarMov(ev) {
    ev.preventDefault();
    const cents = leerMonto($('inMonto').value);
    if (!(cents > 0)) return errorMov('Escribe un monto mayor que cero.');
    const fecha = $('inFecha').value;
    if (!fecha || isNaN(new Date(fecha).getTime())) return errorMov('Elige la fecha y la hora.');

    const datos = { tipo: tipoSel, cents, cat: catSel, nota: $('inNota').value.trim(), fecha: fecha.slice(0, 16) };
    if (editando) {
      const i = estado.items.findIndex((m) => m.id === editando);
      if (i >= 0) estado.items[i] = { ...estado.items[i], ...datos };
    } else {
      estado.items.push({ id: Date.now().toString(36) + Math.random().toString(36).slice(2, 8), ...datos });
    }
    if (!guardar()) return;
    cursor = new Date(datos.fecha);   // lleva al periodo donde quedó el movimiento
    cerrar();
    pintar();
  }

  function borrarMov() {
    if (!editando || !confirm('¿Eliminar este movimiento?')) return;
    // Un pago de GBNex borrado aquí no se vuelve a traer.
    if (estado.gbnex && editando.startsWith('gbnex-')) estado.gbnex.borrados = [...(estado.gbnex.borrados || []), editando];
    estado.items = estado.items.filter((m) => m.id !== editando);
    guardar();
    cerrar();
    pintar();
  }

  // ---------- Hojas ----------
  function abrir(id) {
    $(id).hidden = false;
    document.body.style.overflow = 'hidden';
  }
  function cerrar() {
    document.querySelectorAll('.overlay').forEach((o) => (o.hidden = true));
    document.body.style.overflow = '';
    if (document.activeElement) document.activeElement.blur();
  }

  // ---------- Copias y exportación ----------
  async function entregarArchivo(nombre, contenido, tipo) {
    const archivo = new File([contenido], nombre, { type: tipo });
    if (navigator.canShare && navigator.canShare({ files: [archivo] })) {
      try { await navigator.share({ files: [archivo], title: nombre }); return; }
      catch (e) { if (e && e.name === 'AbortError') return; }
    }
    const url = URL.createObjectURL(archivo);
    const a = document.createElement('a');
    a.href = url; a.download = nombre;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }

  function csvCampo(v) {
    let s = String(v == null ? '' : v);
    if (/^[=+\-@]/.test(s)) s = "'" + s;   // evita que Excel lo interprete como fórmula
    return '"' + s.replace(/"/g, '""') + '"';
  }

  function exportarCsv() {
    const filas = [['Fecha', 'Hora', 'Tipo', 'Categoría', 'Nota', 'Monto']];
    [...estado.items].sort((a, b) => (a.fecha < b.fecha ? -1 : 1)).forEach((m) => {
      const signo = m.tipo === 'ingreso' ? 1 : -1;
      filas.push([m.fecha.slice(0, 10), m.fecha.slice(11, 16), m.tipo, m.cat, m.nota || '', (signo * m.cents / 100).toFixed(2)]);
    });
    const csv = '﻿' + filas.map((f) => f.map((v, i) => (i === 5 && f !== filas[0] ? v : csvCampo(v))).join(',')).join('\r\n');
    entregarArchivo(`mis-gastos-${claveDia(new Date())}.csv`, csv, 'text/csv');
  }

  function restaurar(archivo) {
    const lector = new FileReader();
    lector.onload = () => {
      let nuevos;
      try {
        const datos = JSON.parse(lector.result);
        nuevos = (Array.isArray(datos) ? datos : datos.items || []).filter(esValido);
      } catch (e) { nuevos = null; }
      if (!nuevos || !nuevos.length) {
        $('msgAjustes').textContent = 'Ese archivo no es una copia válida de Mis Gastos Saganet.';
        return;
      }
      const porId = new Map(estado.items.map((m) => [m.id, m]));
      let agregados = 0;
      for (const m of nuevos) {
        if (!porId.has(m.id)) agregados++;
        porId.set(m.id, { id: m.id, tipo: m.tipo, cents: m.cents, cat: m.cat, nota: String(m.nota || ''), fecha: m.fecha.slice(0, 16) });
      }
      estado.items = [...porId.values()];
      guardar();
      pintar();
      $('msgAjustes').textContent = `Copia restaurada: ${agregados} movimientos nuevos.`;
    };
    lector.readAsText(archivo);
  }

  // ---------- Eventos ----------
  $('tabs').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-vista]');
    if (!b) return;
    vista = b.dataset.vista;
    pintar();
  });
  $('btnAnterior').addEventListener('click', () => { cursor = mover(vista, cursor, -1); pintar(); });
  $('btnSiguiente').addEventListener('click', () => { cursor = mover(vista, cursor, 1); pintar(); });
  $('btnHoy').addEventListener('click', () => { cursor = new Date(); pintar(); });

  $('btnNuevo').addEventListener('click', () => abrirMov(null));
  $('lista').addEventListener('click', (e) => {
    const fila = e.target.closest('.mov');
    if (!fila) return;
    const mov = estado.items.find((m) => m.id === fila.dataset.id);
    if (mov) abrirMov(mov);
  });

  document.querySelector('.tipo').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-tipo]');
    if (!b) return;
    tipoSel = b.dataset.tipo;
    pintarTipo();
  });
  $('chips').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-cat]');
    if (!b) return;
    catSel = b.dataset.cat;
    pintarTipo();
  });
  $('formMov').addEventListener('submit', guardarMov);
  $('btnBorrar').addEventListener('click', borrarMov);

  document.querySelectorAll('.overlay').forEach((o) =>
    o.addEventListener('click', (e) => {
      if (e.target === o || e.target.closest('[data-cerrar]')) cerrar();
    }));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') cerrar(); });

  $('btnAjustes').addEventListener('click', () => {
    $('inMoneda').value = estado.moneda;
    $('msgAjustes').textContent = '';
    abrir('hojaAjustes');
  });
  $('inMoneda').addEventListener('change', () => {
    estado.moneda = $('inMoneda').value.trim() || '$';
    guardar();
    pintar();
  });
  $('btnCopia').addEventListener('click', () =>
    entregarArchivo(`mis-gastos-copia-${claveDia(new Date())}.json`, JSON.stringify(estado, null, 2), 'application/json'));
  $('btnCsv').addEventListener('click', exportarCsv);
  $('btnRestaurar').addEventListener('click', () => $('inArchivo').click());
  $('inArchivo').addEventListener('change', (e) => {
    if (e.target.files[0]) restaurar(e.target.files[0]);
    e.target.value = '';
  });
  $('btnBorrarTodo').addEventListener('click', () => {
    if (!estado.items.length) { $('msgAjustes').textContent = 'No hay movimientos que borrar.'; return; }
    if (!confirm(`Se borrarán los ${estado.items.length} movimientos. Esto no se puede deshacer. ¿Continuar?`)) return;
    estado.items = [];
    guardar();
    pintar();
    $('msgAjustes').textContent = 'Movimientos borrados.';
  });

  // ---------- Pagos de GBNex (llegan solos como ingresos) ----------
  // El enlace de GBNex trae la llave: .../gastos/?gbnex=<llave>. La app la guarda y la quita de la barra.
  (function conectarDesdeEnlace() {
    const params = new URLSearchParams(location.search);
    const token = params.get('gbnex');
    if (!token) return;
    if (!estado.gbnex || estado.gbnex.token !== token) {
      const hoy = new Date();
      estado.gbnex = {
        api: location.origin,
        token,
        desde: `${hoy.getFullYear()}-${p2(hoy.getMonth() + 1)}-01`,   // la primera vez trae los pagos de este mes
        ultima: null,
        error: null,
        borrados: (estado.gbnex && estado.gbnex.borrados) || [],
      };
      guardar();
    }
    history.replaceState(null, '', location.pathname);
  })();

  let sincronizando = false;
  async function sincronizar(avisar) {
    const g = estado.gbnex;
    if (!g || sincronizando) return;
    sincronizando = true;
    try {
      const r = await fetch(`${g.api}/api/publico/gastos/${encodeURIComponent(g.token)}/ingresos?desde=${g.desde}`, { cache: 'no-store' });
      const d = await r.json().catch(() => ({}));
      if (!r.ok || !d.ok) throw new Error(d.mensaje || 'GBNex no respondió bien.');
      const ids = new Set(estado.items.map((m) => m.id));
      const borrados = new Set(g.borrados || []);
      let nuevos = 0;
      for (const p of d.pagos) {
        const id = `gbnex-${p.id}`;
        if (ids.has(id) || borrados.has(id)) continue;
        const cents = Math.round(Number(p.monto) * 100);
        if (!(cents > 0) || isNaN(new Date(p.fecha).getTime())) continue;
        estado.items.push({ id, tipo: 'ingreso', cents, cat: 'Internet', nota: [p.folio, p.cliente, p.metodo].filter(Boolean).join(' · ').slice(0, 80), fecha: p.fecha.slice(0, 16) });
        nuevos++;
      }
      // La próxima vez solo se piden los últimos días (los repetidos se ignoran por su id).
      const hace3 = new Date(Date.now() - 3 * 86400000);
      g.desde = `${hace3.getFullYear()}-${p2(hace3.getMonth() + 1)}-${p2(hace3.getDate())}`;
      g.empresa = d.empresa;
      g.ultima = aInput(new Date());
      g.error = null;
      guardar();
      if (nuevos) pintar();
      if (avisar) $('msgAjustes').textContent = nuevos ? `${nuevos} pago(s) nuevo(s) de GBNex.` : 'Sin pagos nuevos.';
    } catch (e) {
      g.error = e && e.message && !/fetch|network|load/i.test(e.message) ? e.message : 'Sin conexión con GBNex (¿estás en tu red?).';
      guardar();
      if (avisar) $('msgAjustes').textContent = g.error;
    } finally {
      sincronizando = false;
      pintarGbnex();
    }
  }

  function pintarGbnex() {
    const g = estado.gbnex;
    $('estadoGbnex').hidden = !g;
    $('btnSincronizar').hidden = !g;
    $('btnDesconectar').hidden = !g;
    if (!g) {
      $('infoGbnex').textContent = 'No conectada. Para conectarla, abre esta app desde el enlace de GBNex (Configuración → Integraciones → App de gastos).';
      return;
    }
    const hora = g.ultima ? new Date(g.ultima).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' }) : '—';
    $('estadoGbnex').textContent = g.error ? `GBNex: ${g.error}` : `GBNex conectado · pagos al día (${hora})`;
    $('infoGbnex').textContent = `Conectada${g.empresa ? ' a ' + g.empresa : ''}. Cada pago que registras en GBNex llega solo como ingreso (categoría Internet). Última revisión: ${hora}.`;
  }

  $('btnSincronizar').addEventListener('click', () => sincronizar(true));
  $('btnDesconectar').addEventListener('click', () => {
    if (!confirm('Ya no llegarán los pagos de GBNex. Los que ya llegaron se quedan. ¿Desconectar?')) return;
    estado.gbnex = null;
    guardar();
    pintarGbnex();
    $('msgAjustes').textContent = 'Desconectada de GBNex.';
  });

  // ---------- Inicio ----------
  pintarGbnex();
  sincronizar(false);
  setInterval(() => sincronizar(false), 60000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) sincronizar(false); });
  pintarReloj();
  setInterval(pintarReloj, 20000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) { pintarReloj(); pintar(); } });
  pintar();

  // Pide al navegador que no borre los datos por falta de espacio.
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});

  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
})();
