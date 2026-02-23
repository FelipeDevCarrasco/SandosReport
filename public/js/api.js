const API_BASE = '/api';

export async function getVentas(query = '', fechaDesde = '', fechaHasta = '') {
  const params = new URLSearchParams();
  if (query) params.set('query', query);
  if (fechaDesde) params.set('fechaDesde', fechaDesde);
  if (fechaHasta) params.set('fechaHasta', fechaHasta);
  const res = await fetch(`${API_BASE}/shipit/ventas?${params}`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || data.error || 'Error al cargar ventas');
  return data;
}

export async function getVendedores(referencias) {
  const res = await fetch(`${API_BASE}/shipit/vendedores`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ referencias })
  });
  const data = await res.json();
  return data.vendedores || {};
}

export async function downloadVentasExcel(query = '') {
  const params = new URLSearchParams();
  if (query) params.set('query', query);
  const res = await fetch(`${API_BASE}/shipit/ventas/excel?${params}`);
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message || data.error || 'Error al generar el reporte Excel');
  }
  const blob = await res.blob();
  const disposition = res.headers.get('Content-Disposition');
  const match = disposition && disposition.match(/filename="(.+)"/);
  const filename = match ? match[1] : `reporte-ventas-${new Date().toISOString().slice(0, 10)}.xlsx`;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Descarga el reporte combinado (Sphinx + Shipit) en Excel
 * Usa el query de búsqueda para filtrar ventas
 */
export async function downloadReporteCombinadoExcel(query = '', fechaDesde = '', fechaHasta = '') {
  const params = new URLSearchParams();
  if (query) params.set('query', query);
  if (fechaDesde) params.set('fechaDesde', fechaDesde);
  if (fechaHasta) params.set('fechaHasta', fechaHasta);
  const res = await fetch(`${API_BASE}/report/excel?${params}`);
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message || data.error || 'Error al generar el reporte Excel');
  }
  const blob = await res.blob();
  const disposition = res.headers.get('Content-Disposition');
  const match = disposition && disposition.match(/filename="(.+)"/);
  const filename = match ? match[1] : `reporte-combinado-${new Date().toISOString().slice(0, 10)}.xlsx`;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export async function getReport(reference, tipo = 'factura') {
  const params = new URLSearchParams({ reference: reference.trim(), tipo });
  const response = await fetch(`${API_BASE}/report/generate?${params}`);
  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.message || err.error || 'Error al generar el reporte');
  }
  return response;
}

export async function getDetalle(reference, tipo = 'factura') {
  const params = new URLSearchParams({ reference: reference.trim(), tipo });
  const res = await fetch(`${API_BASE}/report/detail?${params}`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || data.error || 'Error al obtener detalle');
  return data;
}

/**
 * Verifica y renueva la sesión de Sphinx si es necesario
 */
export async function ensureSphinxSession() {
  const res = await fetch(`${API_BASE}/sphinx/ensure-session`, { method: 'POST' });
  const data = await res.json();
  return data;
}

/**
 * Inicia un job para generar el reporte Excel en background
 * @returns {Promise<{success: boolean, jobId: string}>}
 */
export async function startReportJob(query = '', fechaDesde = '', fechaHasta = '') {
  const params = new URLSearchParams();
  if (query) params.set('query', query);
  if (fechaDesde) params.set('fechaDesde', fechaDesde);
  if (fechaHasta) params.set('fechaHasta', fechaHasta);
  
  const res = await fetch(`${API_BASE}/jobs/report?${params}`, { method: 'POST' });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Error al iniciar el reporte');
  return data;
}

/**
 * Obtiene el estado de un job
 * @returns {Promise<{success: boolean, job: object}>}
 */
export async function getJobStatus(jobId) {
  const res = await fetch(`${API_BASE}/jobs/status/${jobId}`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Error al obtener estado');
  return data;
}

/**
 * Lista los reportes generados
 * @returns {Promise<{success: boolean, reports: Array}>}
 */
export async function listReports() {
  const res = await fetch(`${API_BASE}/jobs/reports`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Error al listar reportes');
  return data;
}

/**
 * Descarga un reporte por jobId
 */
export function getReportDownloadUrl(jobId) {
  return `${API_BASE}/jobs/download/${jobId}`;
}
