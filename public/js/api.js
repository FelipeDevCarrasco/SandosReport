const API_BASE = '/api';

export async function getVentas(query = '', page = 1, per = 50) {
  const params = new URLSearchParams();
  if (query) params.set('query', query);
  params.set('page', page);
  params.set('per', per);
  const res = await fetch(`${API_BASE}/shipit/ventas?${params}`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || data.error || 'Error al cargar ventas');
  return data;
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
export async function downloadReporteCombinadoExcel(query = '') {
  const params = new URLSearchParams();
  if (query) params.set('query', query);
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
