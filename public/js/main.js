import * as api from './api.js';
import * as ui from './ui.js';

function init() {
  const ventasBody = document.getElementById('ventasBody');
  const searchInput = document.getElementById('searchInput');
  const btnRefresh = document.getElementById('btnRefresh');
  const btnExcel = document.getElementById('btnExcel');
  const messageContainer = document.getElementById('messageContainer');

  function loadVentas() {
    ventasBody.innerHTML = '<tr class="loading-row"><td colspan="9">Cargando ventas y vendedores...</td></tr>';
    api.getVentas(searchInput.value.trim())
      .then(({ ventas }) => {
        if (!ventas || ventas.length === 0) {
          ventasBody.innerHTML = '<tr><td colspan="9" class="empty-row">No hay ventas para mostrar</td></tr>';
          return;
        }
        ventasBody.innerHTML = ventas.map((v) => renderRow(v)).join('');
        bindDetalleButtons();
      })
      .catch((err) => {
        ventasBody.innerHTML = `<tr><td colspan="9" class="error-row">${err.message}</td></tr>`;
        ui.showMessage(err.message, 'error', messageContainer);
      });
  }

  btnRefresh.addEventListener('click', loadVentas);
  searchInput.addEventListener('keypress', (e) => e.key === 'Enter' && loadVentas());

  const reportProgress = document.getElementById('reportProgress');

  btnExcel.addEventListener('click', async () => {
    btnExcel.disabled = true;
    reportProgress.classList.add('visible');
    reportProgress.setAttribute('aria-hidden', 'false');
    try {
      await api.downloadReporteCombinadoExcel(searchInput.value.trim());
      ui.showMessage('Reporte Excel generado correctamente', 'success', messageContainer);
    } catch (err) {
      ui.showMessage(err.message, 'error', messageContainer);
    } finally {
      btnExcel.disabled = false;
      reportProgress.classList.remove('visible');
      reportProgress.setAttribute('aria-hidden', 'true');
    }
  });

  initModal();
  loadVentas();
}

function inferirTipo(idVenta) {
  const ref = String(idVenta || '').toUpperCase().replace(/^#/, '');
  return ref.startsWith('BVE') ? 'boleta' : 'factura';
}

function renderRow(v) {
  const estadoClass = (v.estado || '').toLowerCase().includes('cancel') ? 'estado-cancelada' : '';
  const reference = (v.reference || v.idVenta || '').replace(/^#/, '').trim();
  const hasReference = !!reference;
  return `<tr>
    <td><span class="estado-badge ${estadoClass}">${escapeHtml(v.estado || '-')}</span></td>
    <td>${escapeHtml(v.idVenta || '-')}</td>
    <td>${escapeHtml(v.fechaCreacion || '-')}</td>
    <td>${escapeHtml(v.vendedor ?? '-')}</td>
    <td>${escapeHtml(v.destinatario || '-')}</td>
    <td>${escapeHtml(v.courier || '-')}</td>
    <td>${escapeHtml(v.direccion || '-')}</td>
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
    if (e.key === 'Escape') closeDetalleModal();
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
