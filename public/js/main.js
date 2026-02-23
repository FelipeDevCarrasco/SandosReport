import * as api from './api.js';
import * as ui from './ui.js';

let currentJobId = null;
let pollingInterval = null;
let currentVentas = [];

function init() {
  const ventasBody = document.getElementById('ventasBody');
  const searchInput = document.getElementById('searchInput');
  const fechaDesdeInput = document.getElementById('fechaDesde');
  const fechaHastaInput = document.getElementById('fechaHasta');
  const btnBuscar = document.getElementById('btnBuscar');
  const btnExcel = document.getElementById('btnExcel');
  const btnLogout = document.getElementById('btnLogout');
  const btnArchivos = document.getElementById('btnArchivos');
  const messageContainer = document.getElementById('messageContainer');
  const resultsCount = document.getElementById('resultsCount');

  btnLogout.addEventListener('click', async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch (e) {}
    window.location.href = '/login.html';
  });

  function validarFechas() {
    const desde = fechaDesdeInput.value;
    const hasta = fechaHastaInput.value;
    if (!desde || !hasta) {
      ui.showMessage('Debes seleccionar ambas fechas (Desde y Hasta)', 'error', messageContainer);
      return false;
    }
    if (desde > hasta) {
      ui.showMessage('La fecha "Desde" no puede ser mayor que "Hasta"', 'error', messageContainer);
      return false;
    }
    return true;
  }

  async function loadVendedoresEnBackground(ventas) {
    const referencias = ventas
      .map(v => v.idVenta || (v.reference ? `#${v.reference}` : ''))
      .filter(Boolean);

    if (referencias.length === 0) return;

    const BATCH_SIZE = 15;
    
    for (let i = 0; i < referencias.length; i += BATCH_SIZE) {
      const batch = referencias.slice(i, i + BATCH_SIZE);
      
      try {
        const vendedores = await api.getVendedores(batch);
        
        batch.forEach((ref, idx) => {
          const vendedor = vendedores[ref] || '';
          if (vendedor) {
            const globalIdx = i + idx;
            if (currentVentas[globalIdx]) {
              currentVentas[globalIdx].vendedor = vendedor;
            }
            const row = ventasBody.children[globalIdx];
            if (row) {
              const vendedorCell = row.cells[4];
              if (vendedorCell && vendedorCell.textContent === '-') {
                vendedorCell.textContent = vendedor;
              }
            }
          }
        });

        resultsCount.textContent = `Total: ${ventas.length} ventas/envíos (cargando vendedores... ${Math.min(i + BATCH_SIZE, referencias.length)}/${referencias.length})`;
        
      } catch (err) {
        console.warn('Error cargando vendedores batch:', err);
      }
    }

    resultsCount.textContent = `Total: ${ventas.length} ventas/envíos`;
  }

  function loadVentas() {
    if (!validarFechas()) return;

    ventasBody.innerHTML = '<tr class="loading-row"><td colspan="8">Cargando ventas...</td></tr>';
    resultsCount.textContent = '';

    const fechaDesde = fechaDesdeInput.value;
    const fechaHasta = fechaHastaInput.value;
    
    api.getVentas(searchInput.value.trim(), fechaDesde, fechaHasta)
      .then(({ ventas, total }) => {
        if (!ventas || ventas.length === 0) {
          ventasBody.innerHTML = '<tr><td colspan="8" class="empty-row">No hay ventas para mostrar</td></tr>';
          resultsCount.textContent = '';
          currentVentas = [];
          return;
        }

        currentVentas = ventas;
        ventasBody.innerHTML = ventas.map((v) => renderRow(v)).join('');
        resultsCount.textContent = `Total: ${total} ventas/envíos (cargando vendedores...)`;
        bindDetalleButtons();

        loadVendedoresEnBackground(ventas);
      })
      .catch((err) => {
        ventasBody.innerHTML = `<tr><td colspan="8" class="error-row">${err.message}</td></tr>`;
        ui.showMessage(err.message, 'error', messageContainer);
      });
  }

  btnBuscar.addEventListener('click', loadVentas);
  searchInput.addEventListener('keypress', (e) => e.key === 'Enter' && loadVentas());

  const reportProgress = document.getElementById('reportProgress');
  const progressBar = reportProgress.querySelector('.report-progress-bar');
  const progressText = reportProgress.querySelector('.report-progress-text');

  function updateProgress(pct, msg) {
    progressBar.style.setProperty('--progress', `${pct}%`);
    progressText.textContent = msg || `${pct}%`;
    if (pct > 0 && pct < 100) {
      reportProgress.classList.remove('indeterminate');
    }
  }

  async function pollJobStatus(jobId) {
    try {
      const { job } = await api.getJobStatus(jobId);
      
      updateProgress(job.progress, job.message);
      
      if (job.status === 'completed') {
        clearInterval(pollingInterval);
        pollingInterval = null;
        btnExcel.disabled = false;
        reportProgress.classList.remove('visible');
        reportProgress.setAttribute('aria-hidden', 'true');
        
        showJobNotification(jobId);
        ui.showMessage('Reporte generado correctamente', 'success', messageContainer);
        
      } else if (job.status === 'failed') {
        clearInterval(pollingInterval);
        pollingInterval = null;
        btnExcel.disabled = false;
        reportProgress.classList.remove('visible');
        reportProgress.setAttribute('aria-hidden', 'true');
        
        ui.showMessage(`Error: ${job.error || job.message}`, 'error', messageContainer);
      }
    } catch (err) {
      console.error('Error polling job:', err);
    }
  }

  btnExcel.addEventListener('click', async () => {
    if (!validarFechas()) return;
    if (pollingInterval) return;

    btnExcel.disabled = true;
    reportProgress.classList.add('visible', 'indeterminate');
    reportProgress.setAttribute('aria-hidden', 'false');
    updateProgress(0, 'Iniciando generación...');

    const fechaDesde = fechaDesdeInput.value;
    const fechaHasta = fechaHastaInput.value;

    try {
      const { jobId } = await api.startReportJob(searchInput.value.trim(), fechaDesde, fechaHasta);
      currentJobId = jobId;
      
      pollingInterval = setInterval(() => pollJobStatus(jobId), 2000);
      
    } catch (err) {
      btnExcel.disabled = false;
      reportProgress.classList.remove('visible', 'indeterminate');
      reportProgress.setAttribute('aria-hidden', 'true');
      ui.showMessage(err.message, 'error', messageContainer);
    }
  });

  btnArchivos.addEventListener('click', openArchivosModal);

  initModal();
  initArchivosModal();
  initJobNotification();
  
  ventasBody.innerHTML = '<tr><td colspan="8" class="empty-row">Verificando sesión Sphinx...</td></tr>';
  
  api.ensureSphinxSession()
    .then((result) => {
      if (result.success) {
        const statusMsg = result.status === 'renewed' ? '(sesión renovada)' : '';
        console.log(`✅ Sphinx: ${result.message} ${statusMsg}`);
        ventasBody.innerHTML = '<tr><td colspan="8" class="empty-row">Selecciona un rango de fechas y presiona "Buscar"</td></tr>';
      } else {
        console.warn('⚠️ Error verificando Sphinx:', result.message);
        ventasBody.innerHTML = '<tr><td colspan="8" class="error-row">Error al conectar con Sphinx. Intenta recargar.</td></tr>';
      }
    })
    .catch((err) => {
      console.error('❌ Error verificando Sphinx:', err);
      ventasBody.innerHTML = '<tr><td colspan="8" class="empty-row">Selecciona un rango de fechas y presiona "Buscar"</td></tr>';
    });
}

function showJobNotification(jobId) {
  const notification = document.getElementById('jobNotification');
  const downloadBtn = document.getElementById('jobDownloadBtn');
  
  notification.classList.add('visible');
  notification.setAttribute('aria-hidden', 'false');
  
  downloadBtn.onclick = () => {
    window.open(api.getReportDownloadUrl(jobId), '_blank');
    hideJobNotification();
  };
}

function hideJobNotification() {
  const notification = document.getElementById('jobNotification');
  notification.classList.remove('visible');
  notification.setAttribute('aria-hidden', 'true');
}

function initJobNotification() {
  document.getElementById('jobNotificationClose').addEventListener('click', hideJobNotification);
}

async function openArchivosModal() {
  const modal = document.getElementById('modalArchivos');
  const loading = document.getElementById('archivosLoading');
  const content = document.getElementById('archivosContent');
  const empty = document.getElementById('archivosEmpty');
  const list = document.getElementById('archivosList');
  
  modal.classList.add('modal-open');
  modal.setAttribute('aria-hidden', 'false');
  loading.style.display = 'block';
  content.style.display = 'none';
  
  try {
    const { reports } = await api.listReports();
    
    loading.style.display = 'none';
    content.style.display = 'block';
    
    if (!reports || reports.length === 0) {
      empty.style.display = 'block';
      list.innerHTML = '';
    } else {
      empty.style.display = 'none';
      list.innerHTML = reports.map(r => {
        const fecha = new Date(r.createdAt).toLocaleString('es-CL');
        const params = r.params || {};
        const rango = (params.fechaDesde && params.fechaHasta) 
          ? `${params.fechaDesde} al ${params.fechaHasta}` 
          : '';
        return `
          <li>
            <div class="archivo-info">
              <span class="archivo-nombre">${escapeHtml(r.fileName)}</span>
              <span class="archivo-fecha">${fecha}</span>
              ${rango ? `<span class="archivo-params">Rango: ${rango}</span>` : ''}
            </div>
            <button class="btn-download-archivo" data-job-id="${r.id}">Descargar</button>
          </li>
        `;
      }).join('');
      
      list.querySelectorAll('.btn-download-archivo').forEach(btn => {
        btn.addEventListener('click', () => {
          const jobId = btn.dataset.jobId;
          window.open(api.getReportDownloadUrl(jobId), '_blank');
        });
      });
    }
  } catch (err) {
    loading.style.display = 'none';
    content.style.display = 'block';
    empty.style.display = 'block';
    empty.textContent = `Error: ${err.message}`;
    list.innerHTML = '';
  }
}

function closeArchivosModal() {
  const modal = document.getElementById('modalArchivos');
  modal.classList.remove('modal-open');
  modal.setAttribute('aria-hidden', 'true');
}

function initArchivosModal() {
  document.getElementById('modalArchivosClose').addEventListener('click', closeArchivosModal);
  document.getElementById('modalArchivos').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeArchivosModal();
  });
}

function inferirTipo(idVenta) {
  const ref = String(idVenta || '').toUpperCase().replace(/^#/, '');
  return ref.startsWith('BVE') ? 'boleta' : 'factura';
}

const COURIER_LOGOS = {
  starken: 'https://s3.us-west-2.amazonaws.com/shipit-docs/images/couriers/starken.png',
  chilexpress: 'https://s3.us-west-2.amazonaws.com/shipit-docs/images/couriers/chilexpress.png',
  bluexpress: 'https://s3.us-west-2.amazonaws.com/shipit-docs/images/couriers/bluexpress.png',
  global_tracking: 'https://s3.us-west-2.amazonaws.com/shipit-docs/images/couriers/global_tracking.png',
  spread: 'https://s3.us-west-2.amazonaws.com/shipit-docs/images/couriers/spread.png'
};

function renderCourier(courier) {
  if (!courier) return '-';
  const key = courier.toLowerCase().replace(/\s+/g, '_');
  const logoUrl = COURIER_LOGOS[key];
  if (logoUrl) {
    return `<img src="${logoUrl}" alt="${escapeHtml(courier)}" class="courier-logo" title="${escapeHtml(courier)}">`;
  }
  return escapeHtml(courier);
}

function getEstadoClass(estado) {
  const s = (estado || '').toLowerCase();
  if (s.includes('entreg') || s.includes('deliver')) return 'estado-entregado';
  if (s.includes('reparto') || s.includes('distribution')) return 'estado-reparto';
  if (s.includes('transit') || s.includes('tránsito') || s.includes('camino')) return 'estado-transito';
  if (s.includes('sucursal') || s.includes('bodega') || s.includes('oficina')) return 'estado-sucursal';
  if (s.includes('retir')) return 'estado-retiro';
  if (s.includes('cancel') || s.includes('devuel') || s.includes('return')) return 'estado-cancelado';
  if (s.includes('problem') || s.includes('incidencia') || s.includes('excep')) return 'estado-incidencia';
  if (s.includes('listo') || s.includes('confirm') || s.includes('enviado')) return 'estado-listo';
  if (s.includes('preparación') || s.includes('preparacion') || s.includes('prepar')) return 'estado-preparacion';
  if (s.includes('solicit') || s.includes('pendiente') || s.includes('nuevo')) return 'estado-solicitado';
  return 'estado-default';
}

function renderTipo(tipo) {
  if (tipo === 'envio') {
    return '<span class="tipo-badge tipo-envio">Envío</span>';
  }
  return '<span class="tipo-badge tipo-venta">Venta</span>';
}

function renderRow(v) {
  const estadoClass = getEstadoClass(v.estado);
  const reference = (v.reference || v.idVenta || '').replace(/^#/, '').trim();
  const hasReference = !!reference;
  return `<tr>
    <td><span class="estado-badge ${estadoClass}">${escapeHtml(v.estado || '-')}</span></td>
    <td>${escapeHtml(v.idVenta || '-')}</td>
    <td>${renderTipo(v.tipo)}</td>
    <td>${escapeHtml(v.fechaCreacion || '-')}</td>
    <td>${escapeHtml(v.vendedor ?? '-')}</td>
    <td>${renderCourier(v.courier)}</td>
    <td>${escapeHtml(v.comuna || '-')}</td>
    <td>${hasReference ? '<button type="button" class="btn-detalle">Detalle</button>' : '-'}</td>
  </tr>`;
}

function bindDetalleButtons() {
  const rows = ventasBody.querySelectorAll('tr');
  rows.forEach((row, i) => {
    const btn = row.querySelector('.btn-detalle');
    if (!btn) return;
    const idVenta = row.cells[1]?.textContent?.trim() || '';
    const reference = (row.cells[1]?.textContent || '').replace(/^#/, '').trim();
    if (!reference) return;
    btn.addEventListener('click', () => openDetalleModal(reference, inferirTipo(idVenta), idVenta));
  });
}

function openDetalleModal(reference, tipo, idVenta) {
  const modal = document.getElementById('modalDetalle');
  const modalTitulo = document.getElementById('modalTitulo');
  const modalLoading = document.getElementById('modalLoading');
  const modalContent = document.getElementById('modalContent');
  const modalTableBody = document.getElementById('modalTableBody');

  modal.classList.add('modal-open');
  modal.setAttribute('aria-hidden', 'false');
  modalTitulo.textContent = idVenta || reference;
  modalLoading.style.display = 'block';
  modalContent.style.display = 'none';

  api.getDetalle(reference, tipo)
    .then(({ detalle }) => {
      modalLoading.style.display = 'none';
      modalContent.style.display = 'block';
      modalTableBody.innerHTML = detalle.map((r) => `
        <tr>
          <td>${escapeHtml(r.Doc || '')}</td>
          <td>${escapeHtml(String(r.Cantidad ?? ''))}</td>
          <td>${escapeHtml(r['N producto'] || '')}</td>
          <td>${escapeHtml(r.SKU || '')}</td>
        </tr>
      `).join('');
    })
    .catch((err) => {
      modalLoading.style.display = 'none';
      modalContent.style.display = 'block';
      modalTableBody.innerHTML = `<tr><td colspan="4" class="error-row">${escapeHtml(err.message)}</td></tr>`;
    });
}

function closeDetalleModal() {
  const modal = document.getElementById('modalDetalle');
  modal.classList.remove('modal-open');
  modal.setAttribute('aria-hidden', 'true');
}

function initModal() {
  document.getElementById('modalClose').addEventListener('click', closeDetalleModal);
  document.getElementById('modalDetalle').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeDetalleModal();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeDetalleModal();
      closeArchivosModal();
      hideJobNotification();
    }
  });
}

function escapeHtml(s) {
  const div = document.createElement('div');
  div.textContent = s;
  return div.innerHTML;
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
