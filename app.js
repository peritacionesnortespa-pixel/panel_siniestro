const SUPABASE_URL = 'https://ovutwmrbwtzmngilowor.supabase.co';
const SUPABASE_KEY = 'sb_publishable_T4RNYqzNFPeKnTOr-9UsLg_X9WksCbC';
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let siniestros = [];
let editingId = null;
let currentSiniestroId = null;
let textoBusqueda = '';

// --- CONFIGURACIÓN DE TODOS LOS ESTADOS ---
const ESTADOS_CONTAR = [
  'En curso',
  'Pendiente peritar',
  'Pérdida Total',
  'Cancelado',
  'Cerrado',
  'Fraude Parcial',
  'Fraude Total',
  'Ausente',
  'Pendiente documentación',
  'Pendiente Compromiso',
  'Autorizada reparación',
  'Pendiente iniciar trabajos',
  'Pendiente desmontar',
  'En proceso reparación',
  'Verificando siniestro',
  'Para cerrar',
  'Pendiente precios',
  'Pendiente valores',
  'Pendiente entrar a reparar',
  'Autorizacion asegurado',
  'Pendiente restos'
];

// ---------------------------------------------------------
// 1. CARGA DE DATOS
// ---------------------------------------------------------
async function cargarSiniestros() {
  try {
    const { data, error } = await supabaseClient
      .from('siniestros')
      .select('*')
      .order('fecha_peritacion', { ascending: false });

    if (error) throw error;
    siniestros = data || [];
    renderizarTodo();
  } catch (err) {
    console.error('Error al cargar:', err.message);
    mostrarNotificacion('⚠️ Error cargando datos: ' + err.message, 'danger');
  }
}

// ---------------------------------------------------------
// 2. RENDERIZADO Y LÓGICA DE PESTAÑAS (FILTRADO VISUAL)
// ---------------------------------------------------------
function renderizarTodo() {
  actualizarContadores();

  const tabActiva = document.querySelector('.tab-btn.active')?.dataset.tab || 'en-curso';

  const contenedores = ['lista-en-curso', 'lista-cerrados', 'lista-cancelado', 'lista-ausentes'];
  contenedores.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = '';
  });

  let listaFiltrada = [];
  let contenedorDestino = '';

  if (tabActiva === 'en-curso') {
    // Se muestran todos los estados excepto los archivados definitivamente
    listaFiltrada = siniestros.filter(s =>
      s.estado !== 'Cerrado' &&
      s.estado !== 'Archivo_Ausente' &&
      s.estado !== 'Archivo_Cancelado'
    );
    contenedorDestino = 'lista-en-curso';
  } else if (tabActiva === 'cerrados') {
    listaFiltrada = siniestros.filter(s => s.estado === 'Cerrado');
    contenedorDestino = 'lista-cerrados';
  } else if (tabActiva === 'cancelado') {
    listaFiltrada = siniestros.filter(s => s.estado === 'Archivo_Cancelado');
    contenedorDestino = 'lista-cancelado';
  } else if (tabActiva === 'ausentes') {
    listaFiltrada = siniestros.filter(s => s.estado === 'Archivo_Ausente');
    contenedorDestino = 'lista-ausentes';
  }

  const elDestino = document.getElementById(contenedorDestino);
  if (elDestino) {
    elDestino.innerHTML = crearTablaHTML(listaFiltrada);
  }
}

function crearTablaHTML(lista) {
  // 🔍 FILTRO POR TEXTO (siniestro, matrícula, taller, garantía Y ESTADO)
  if (textoBusqueda) {
    const q = textoBusqueda.toLowerCase();
    lista = lista.filter(s => {
      const num      = (s.numero_siniestro || '').toLowerCase();
      const matr     = (s.matricula || '').toLowerCase();
      const taller   = (s.taller || '').toLowerCase();
      const garantia = (s.garantia || '').toLowerCase();
      const estado   = (s.estado || '').toLowerCase();

      return (
        num.includes(q) ||
        matr.includes(q) ||
        taller.includes(q) ||
        garantia.includes(q) ||
        estado.includes(q)     // ← ahora busca “en curso”, “para cerrar”, etc.
      );
    });
  }

  let html = `
  <table>
    <thead>
      <tr>
        <th>Foto</th>
        <th>Siniestro</th>
        <th>Fecha</th>
        <th>Matrícula</th>
        <th>Taller</th>
        <th>Garantía</th>
        <th>Pago</th>
        <th>Estado</th>
        <th>Acciones</th>
      </tr>
    </thead>
    <tbody>`;

  lista.forEach(s => {
    const fecha = s.fecha_peritacion
      ? new Date(s.fecha_peritacion).toLocaleDateString('es-ES')
      : '---';

    const pago = s.compromiso_pago || s.compromisoPago || '---';

    let fotoHtml = '📷';
    if (s.fotos && s.fotos.length > 0) {
      const urlImagen = s.fotos.find(url => url.match(/\.(jpeg|jpg|png|gif)/i));
      if (urlImagen) {
        fotoHtml = `<img src="${urlImagen}" style="width:35px;height:35px;object-fit:cover;border-radius:4px;border:1px solid #ddd;" onerror="this.outerHTML='📷'">`;
      }
    }

    const idSiniestroTexto = String(s.numero_siniestro || s.id || '').trim();

    html += `
      <tr data-siniestro-id="${idSiniestroTexto}">
        <td>
          <div class="foto-mini" onclick="verArchivos(${s.id})" style="cursor:pointer">
            ${fotoHtml}
          </div>
        </td>
        <td><strong>${s.numero_siniestro || '---'}</strong></td>
        <td>${fecha}</td>
        <td><code class="tag-matricula">${s.matricula || '---'}</code></td>
        <td>${s.taller || '---'}</td>
        <td>${s.garantia || '---'}</td>
        <td>${pago}</td>
        <td><span class="badge-estado">${s.estado}</span></td>
        <td>
          <div class="btn-group-acciones">
            <button class="btn-icon" title="Editar" onclick="editarSiniestro(${s.id})">✏️</button>
            ${!['Cerrado', 'Archivo_Ausente', 'Archivo_Cancelado'].includes(s.estado)
              ? `<button class="btn-icon btn-check" title="Finalizar" onclick="finalizarSiniestroSQL(${s.id})" style="background:#ccffcc;border-color:#28a745;">✅</button>`
              : ''
            }
            <button class="btn-icon btn-clip" title="Adjuntos" onclick="verArchivos(${s.id})">📎</button>
            <button class="btn-icon" title="Notas / Recordatorio" onclick="abrirModalNotas('${idSiniestroTexto}')">📝</button>
            <button class="btn-icon btn-trash" title="Borrar" onclick="borrarSiniestroSQL(${s.id})">🗑️</button>
          </div>
        </td>
      </tr>`;
  });

  html += '</tbody></table>';
  return html;
}

// ---------------------------------------------------------
// 3. GESTIÓN DE ARCHIVOS
// ---------------------------------------------------------
async function eliminarArchivoIndividual(urlCompleta, siniestroId) {
  if (!confirm('¿Eliminar este archivo permanentemente?')) return;
  try {
    const nombreArchivo = urlCompleta.split('/').pop();
    const { error: deleteError } = await supabaseClient.storage
      .from('siniestros_files')
      .remove([nombreArchivo]);
    if (deleteError) throw deleteError;

    const siniestro = siniestros.find(s => s.id === siniestroId);
    if (!siniestro) return;
    const fotosActualizadas = siniestro.fotos.filter(url => url !== urlCompleta);

    const { error: updateError } = await supabaseClient
      .from('siniestros')
      .update({ fotos: fotosActualizadas })
      .eq('id', siniestroId);
    if (updateError) throw updateError;

    mostrarNotificacion('🗑️ Archivo eliminado', 'success');
    await cargarSiniestros();
    verArchivos(siniestroId);
  } catch (err) {
    mostrarNotificacion('❌ Error: ' + err.message, 'danger');
  }
}

async function subirArchivosSeleccionados(event) {
  const input = document.getElementById('file-modal-subir');
  if (!input || !input.files.length) {
    mostrarNotificacion('⚠️ Selecciona archivos', 'warning');
    return;
  }
  const btn = event.target;
  const textoOriginal = btn.textContent;
  btn.disabled = true;
  btn.textContent = '⏳ Subiendo...';

  try {
    const files = Array.from(input.files);
    const siniestro = siniestros.find(s => s.id === currentSiniestroId);
    const fotosActuales = Array.isArray(siniestro.fotos) ? siniestro.fotos : [];
    const nuevasUrls = [];

    for (const file of files) {
      const fileName = `${siniestro.numero_siniestro || 'doc'}_${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
      const { error: uploadError } = await supabaseClient.storage
        .from('siniestros_files')
        .upload(fileName, file);
      if (uploadError) throw uploadError;

      const { data: urlData } = supabaseClient.storage
        .from('siniestros_files')
        .getPublicUrl(fileName);
      nuevasUrls.push(urlData.publicUrl);
    }

    const { error: dbError } = await supabaseClient
      .from('siniestros')
      .update({ fotos: [...fotosActuales, ...nuevasUrls] })
      .eq('id', currentSiniestroId);
    if (dbError) throw dbError;

    mostrarNotificacion('✅ Subida completada', 'success');
    input.value = '';
    await cargarSiniestros();
    cerrarModalArchivos();
  } catch (err) {
    mostrarNotificacion('❌ Error: ' + err.message, 'danger');
  } finally {
    btn.disabled = false;
    btn.textContent = textoOriginal;
  }
}

function verArchivos(id) {
  currentSiniestroId = id;
  const siniestro = siniestros.find(s => s.id === id);
  const modal = document.getElementById('modal-archivos');
  const lista = document.getElementById('lista-archivos');
  const titulo = document.getElementById('modal-titulo');

  if (titulo) titulo.textContent = `Archivos - ${siniestro?.numero_siniestro || ''}`;

  if (siniestro && siniestro.fotos && siniestro.fotos.length > 0) {
    lista.innerHTML = `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:15px;">
      ${siniestro.fotos.map(url => `
        <div style="border:1px solid #ddd;padding:10px;border-radius:8px;text-align:center;">
          ${url.match(/\.(jpg|jpeg|png|gif)/i)
            ? `<img src="${url}" style="width:100%;height:100px;object-fit:cover;">`
            : '<div style="font-size:40px">📎</div>'}
          <div style="margin-top:10px;display:flex;gap:5px;">
            <button onclick="abrirArchivo('${url}')" style="flex:1;background:#3b82f6;color:white;border:none;padding:5px;border-radius:4px;cursor:pointer;">👁️</button>
            <button onclick="eliminarArchivoIndividual('${url}', ${id})" style="flex:1;background:#ef4444;color:white;border:none;padding:5px;border-radius:4px;cursor:pointer;">🗑️</button>
          </div>
        </div>`).join('')}
    </div>`;
  } else {
    lista.innerHTML = '<p style="text-align:center;padding:20px;">Sin archivos.</p>';
  }

  const uploadDiv = document.createElement('div');
  uploadDiv.innerHTML = `
      <div style="margin-top:20px;padding:15px;background:#f8f9fa;border-radius:8px;text-align:center;">
        <input type="file" id="file-modal-subir" multiple style="margin-bottom:10px;">
        <button onclick="subirArchivosSeleccionados(event)" style="background:#6366f1;color:white;border:none;padding:8px 15px;border-radius:5px;cursor:pointer;">📤 Subir</button>
      </div>`;
  lista.appendChild(uploadDiv);

  modal.classList.add('active');
}

function abrirArchivo(url) { window.open(url, '_blank'); }
function cerrarModalArchivos() { document.getElementById('modal-archivos').classList.remove('active'); }

// ---------------------------------------------------------
// 4. ACCIONES (ARCHIVADO)
// ---------------------------------------------------------
async function finalizarSiniestroSQL(id) {
  const siniestro = siniestros.find(s => s.id === id);
  if (!siniestro) return;

  let nuevoEstadoBD = 'Cerrado';
  let mensaje = '¿Pasar a la lista de Cerrados?';

  if (siniestro.estado === 'Ausente') {
    nuevoEstadoBD = 'Archivo_Ausente';
    mensaje = '¿Mover definitivamente a la pestaña de Ausentes?';
  } else if (siniestro.estado === 'Cancelado') {
    nuevoEstadoBD = 'Archivo_Cancelado';
    mensaje = '¿Mover definitivamente a la pestaña de Cancelados?';
  }

  if (!confirm(mensaje)) return;

  const { error } = await supabaseClient
    .from('siniestros')
    .update({ estado: nuevoEstadoBD })
    .eq('id', id);
  if (error) mostrarNotificacion('❌ Error: ' + error.message, 'danger');
  else {
    mostrarNotificacion('✅ Expediente archivado', 'success');
    await cargarSiniestros();
  }
}

async function borrarSiniestroSQL(id) {
  if (!confirm('¿Borrar PERMANENTEMENTE este siniestro?')) return;
  const { error } = await supabaseClient
    .from('siniestros')
    .delete()
    .eq('id', id);
  if (error) mostrarNotificacion('❌ Error: ' + error.message, 'danger');
  else {
    mostrarNotificacion('🗑️ Eliminado', 'danger');
    await cargarSiniestros();
  }
}

// ---------------------------------------------------------
// 5. CONTADORES (CORREGIDO PARA SINCRONIZAR PESTAÑAS)
// ---------------------------------------------------------
function actualizarContadores() {
  const totalEl = document.getElementById('count-total');
  if (totalEl) totalEl.textContent = siniestros.length;

  const countEnCursoEl = document.getElementById('count-en-curso');
  if (countEnCursoEl) {
    const totalEnCursoPestana = siniestros.filter(s =>
      s.estado !== 'Cerrado' &&
      s.estado !== 'Archivo_Ausente' &&
      s.estado !== 'Archivo_Cancelado'
    ).length;
    countEnCursoEl.textContent = totalEnCursoPestana;
  }

  const countCanceladoEl = document.getElementById('count-cancelado');
  if (countCanceladoEl) {
    const totalCancelados = siniestros.filter(s =>
      s.estado === 'Cancelado' || s.estado === 'Archivo_Cancelado'
    ).length;
    countCanceladoEl.textContent = totalCancelados;
  }

  const countCerradoEl = document.getElementById('count-cerrado');
  if (countCerradoEl) {
    const totalCerrados = siniestros.filter(s => s.estado === 'Cerrado').length;
    countCerradoEl.textContent = totalCerrados;
  }

  ESTADOS_CONTAR.forEach(estado => {
    if (['En curso', 'Cancelado', 'Cerrado'].includes(estado)) return;

    const count = siniestros.filter(s => s.estado === estado).length;
    const id = `count-${estado
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/ /g, '-')}`;
    const el = document.getElementById(id);
    if (el) el.textContent = count;
  });
}

function mostrarNotificacion(mensaje, tipo = 'info') {
  const toast = document.createElement('div');
  toast.textContent = mensaje;
  toast.style.cssText = `position:fixed;top:20px;right:20px;padding:15px 25px;border-radius:12px;color:white;font-weight:600;z-index:10000;background:${
    tipo === 'success' ? '#10b981' : tipo === 'danger' ? '#ef4444' : '#3b82f6'
  };box-shadow:0 10px 30px rgba(0,0,0,0.3);transition:0.3s;`;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

// ---------------------------------------------------------
// 6. FORMULARIO DE EDICIÓN Y GUARDADO
// ---------------------------------------------------------
function editarSiniestro(id) {
  const siniestro = siniestros.find(s => s.id === id);
  if (!siniestro) return;

  editingId = id;

  document.getElementById('compania').value = siniestro.compania || '';
  document.getElementById('numero_siniestro').value = siniestro.numero_siniestro || '';
  document.getElementById('fecha_peritacion').value = siniestro.fecha_peritacion
    ? new Date(siniestro.fecha_peritacion).toISOString().split('T')[0]
    : '';
  document.getElementById('marca_modelo').value = siniestro.marca_modelo || '';
  document.getElementById('matricula').value = siniestro.matricula || '';
  document.getElementById('taller').value = siniestro.taller || '';
  document.getElementById('estado').value = siniestro.estado || 'En curso';
  document.getElementById('garantia').value = siniestro.garantia || '';
  document.getElementById('compromiso_pago').value = siniestro.compromiso_pago || '';

  const btnGuardar = document.querySelector('#form-siniestro button[type="submit"]');
  if (btnGuardar) {
    btnGuardar.textContent = '💾 Actualizar Expediente';
    btnGuardar.style.background = '#f59e0b';
  }

  const tabEnCurso = document.querySelector('[data-tab="en-curso"]');
  if (tabEnCurso) tabEnCurso.click();

  const formSection = document.querySelector('.form-section');
  if (formSection) {
    setTimeout(() => {
      formSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 100);
  }
}

async function guardarSiniestro(event) {
  if (event) event.preventDefault();

  const data = {
    compania: document.getElementById('compania').value,
    numero_siniestro: document.getElementById('numero_siniestro').value,
    fecha_peritacion: document.getElementById('fecha_peritacion').value || null,
    marca_modelo: document.getElementById('marca_modelo').value,
    matricula: document.getElementById('matricula').value,
    taller: document.getElementById('taller').value,
    estado: document.getElementById('estado').value,
    garantia: document.getElementById('garantia').value,
    compromiso_pago: document.getElementById('compromiso_pago').value
  };

  try {
    if (editingId) {
      const { error } = await supabaseClient
        .from('siniestros')
        .update(data)
        .eq('id', editingId);
      if (error) throw error;
      mostrarNotificacion('✅ Actualizado con éxito', 'success');
    } else {
      const { error } = await supabaseClient
        .from('siniestros')
        .insert([data]);
      if (error) throw error;
      mostrarNotificacion('✅ Creado con éxito', 'success');
    }

    document.getElementById('form-siniestro').reset();
    editingId = null;
    await cargarSiniestros();
  } catch (err) {
    mostrarNotificacion('❌ Error: ' + err.message, 'danger');
  }
}

// ---------------------------------------------------------
// 7. INICIALIZACIÓN E IMPORTACIÓN
// ---------------------------------------------------------
document.addEventListener('DOMContentLoaded', async () => {
  await cargarSiniestros();

  const selectEstado = document.getElementById('estado');
  if (selectEstado) {
    selectEstado.innerHTML = ESTADOS_CONTAR
      .map(e => `<option value="${e}">${e}</option>`)
      .join('');
  }

  const form = document.getElementById('form-siniestro');
  if (form) form.onsubmit = guardarSiniestro;

  const buscador = document.getElementById('buscador');
  if (buscador) {
    buscador.oninput = e => {
      textoBusqueda = e.target.value || '';
      renderizarTodo();
    };
  }

  const tabs = document.querySelectorAll('.tab-btn');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      renderizarTodo();
    });
  });

  const btnImport = document.getElementById('file-import-json');
  if (btnImport) {
    btnImport.addEventListener('change', async function (e) {
      try {
        const file = e.target.files[0];
        if (!file) return;
        const text = await file.text();
        const rawData = JSON.parse(text);

        const cleanData = rawData.map(item => {
          const getVal = keys => {
            const foundKey = Object.keys(item).find(k => {
              const normalizedKey = k.toUpperCase().replace(/_/g, '').trim();
              return keys.some(searchKey => normalizedKey === searchKey.toUpperCase());
            });
            return foundKey ? item[foundKey] : '';
          };

          return {
            compania: getVal(['COMPANIA', 'COMPAÑIA', 'COMPANY']),
            numero_siniestro: getVal(['SINIESTRO', 'NUMEROSINIESTRO', 'NUMERO', 'EXPEDIENTE']),
            fecha_peritacion: getVal(['FECHA', 'FECHAPERITACION', 'DATE']) || null,
            marca_modelo: getVal(['MARCA', 'MODELO', 'MARCAMODELO', 'VEHICULO']),
            matricula: getVal(['MATRICULA', 'PLATE']),
            taller: getVal(['TALLER', 'SHOP']),
            estado: getVal(['ESTADO', 'STATUS']) || 'En curso',
            garantia: getVal(['GARANTIA', 'GARANTÍA']),
            compromiso_pago: getVal(['PAGO', 'COMPROMISOPAGO', 'COMPROMISODEPAGO'])
          };
        });

        const { error } = await supabaseClient
          .from('siniestros')
          .insert(cleanData);
        if (error) throw error;

        mostrarNotificacion('✅ Importación exitosa', 'success');
        e.target.value = '';
        await cargarSiniestros();
      } catch (err) {
        mostrarNotificacion('❌ Error importando: ' + err.message, 'danger');
        console.error(err);
      }
    });
  }

  revisarRecordatoriosNotas();
});

// ---------------------------------------------------------
// 8. NOTAS Y RECORDATORIOS POR SINIESTRO (localStorage)
// ---------------------------------------------------------

let siniestroNotasActual = null;

function claveNotas(idSiniestro) {
  return 'notas_siniestro_' + idSiniestro;
}

function abrirModalNotas(idSiniestro) {
  siniestroNotasActual = idSiniestro;

  const spanId = document.getElementById('modal-notas-siniestro-id');
  const textarea = document.getElementById('modal-notas-texto');
  const inputFecha = document.getElementById('modal-notas-fecha');
  const modal = document.getElementById('modal-notas');

  if (spanId) spanId.textContent = idSiniestro;

  const guardado = localStorage.getItem(claveNotas(idSiniestro));
  if (guardado) {
    try {
      const datos = JSON.parse(guardado);
      if (textarea) textarea.value = datos.texto || '';
      if (inputFecha) inputFecha.value = datos.fecha || '';
    } catch (e) {
      if (textarea) textarea.value = '';
      if (inputFecha) inputFecha.value = '';
    }
  } else {
    if (textarea) textarea.value = '';
    if (inputFecha) inputFecha.value = '';
  }

  if (modal) modal.classList.add('active');
}

function cerrarModalNotas() {
  const modal = document.getElementById('modal-notas');
  if (modal) modal.classList.remove('active');
  siniestroNotasActual = null;
}

function guardarNotasSiniestro() {
  if (!siniestroNotasActual) return;

  const textarea = document.getElementById('modal-notas-texto');
  const inputFecha = document.getElementById('modal-notas-fecha');

  const datos = {
    texto: textarea ? (textarea.value || '') : '',
    fecha: inputFecha ? (inputFecha.value || '') : ''
  };

  localStorage.setItem(claveNotas(siniestroNotasActual), JSON.stringify(datos));

  marcarFilaRecordatorioNotas(siniestroNotasActual, datos.fecha);

  cerrarModalNotas();
}

function marcarFilaRecordatorioNotas(idSiniestro, fechaISO) {
  const fila = document.querySelector('tr[data-siniestro-id="' + idSiniestro + '"]');
  if (!fila) return;

  fila.classList.remove('recordatorio-activo');
  fila.classList.remove('recordatorio-vencido');

  if (!fechaISO) return;

  const ahora = new Date();
  const cuando = new Date(fechaISO);

  if (isNaN(cuando.getTime())) return;

  if (cuando.getTime() <= ahora.getTime()) {
    fila.classList.add('recordatorio-vencido');
  } else {
    fila.classList.add('recordatorio-activo');
  }
}

function revisarRecordatoriosNotas() {
  const ahora = new Date().getTime();

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key || !key.startsWith('notas_siniestro_')) continue;

    const valor = localStorage.getItem(key);
    if (!valor) continue;

    let datos;
    try {
      datos = JSON.parse(valor);
    } catch (e) {
      continue;
    }
    if (!datos || !datos.fecha) continue;

    const cuando = new Date(datos.fecha).getTime();
    if (isNaN(cuando)) continue;

    const idSiniestro = key.replace('notas_siniestro_', '');

    marcarFilaRecordatorioNotas(idSiniestro, datos.fecha);

    if (cuando <= ahora) {
      alert('Recordatorio siniestro ' + idSiniestro + ':\n\n' + (datos.texto || 'Sin notas'));

      datos.fecha = '';
      localStorage.setItem(key, JSON.stringify(datos));

      marcarFilaRecordatorioNotas(idSiniestro, '');
    }
  }
}

setInterval(revisarRecordatoriosNotas, 60000);
