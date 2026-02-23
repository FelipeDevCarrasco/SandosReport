/**
 * Genera reporte combinando datos de Shipit + Sphinx
 * Flujo: referencia (Shipit) → extraer folio → Sphinx factura/boleta → Shipit courier/estado → Excel
 */
import { consultarFacturaID, consultarBoletaID, getVendedorPorReferencia } from './sphinx.service.js';
import { procesarPedidosEnLotes, obtenerListaVentas } from './shipit.service.js';
import { escribirExcel } from './report.service.js';
import { generateTimestamp, getUploadsDir } from '../utils/fileStorage.js';
import path from 'path';

/**
 * Extrae folio y tipo de documento desde la referencia
 * "BVE 4201" → { folio: "4201", tipo: "boleta" } (BVE = Boleta Venta Electrónica)
 * "FVE 25036" → { folio: "25036", tipo: "factura" } (FVE = Factura Venta Electrónica)
 * "4201" → { folio: "4201", tipo: "factura" } (default)
 */
export function parseReference(reference, tipoOverride) {
  const ref = String(reference || '').trim();
  const sinEspacios = ref.replace(/\s+/g, '');
  const folio = (ref.match(/\d+/) || [ref])[0] || ref;

  if (tipoOverride === 'boleta') {
    return { folio, tipo: 'boleta' };
  }
  if (tipoOverride === 'factura') {
    return { folio, tipo: 'factura' };
  }

  if (sinEspacios.toUpperCase().startsWith('BVE')) {
    return { folio, tipo: 'boleta' };
  }
  return { folio, tipo: 'factura' };
}

/**
 * Extrae valor de campo que puede ser primitivo u objeto { parsedValue, source }
 */
function extraerValor(v) {
  if (v == null) return '';
  if (typeof v === 'object' && !Array.isArray(v)) {
    if (v.parsedValue != null) return v.parsedValue;
    if (v.source != null) return v.source;
  }
  return v;
}

/**
 * Mapeo explícito de la respuesta Sphinx al formato esperado:
 * Doc => doc, Cantidad => dCantidad, N producto => dDescripcion, SKU => codigo, Observación => dObservacion/observaciones
 * Sphinx puede devolver data.retorno (array) con dCantidad como objeto { parsedValue, source }
 * Aplica filtros: excluye Pend/Nula y productos que contengan 'Servicio'
 */
function normalizarRespuestaSphinx(data, docValue) {
  if (!data) return [];

  let rows = [];
  if (Array.isArray(data)) {
    rows = data;
  } else if (data.data && data.data.retorno && Array.isArray(data.data.retorno)) {
    rows = data.data.retorno;
  } else if (data.data && Array.isArray(data.data)) {
    rows = data.data;
  } else if (data.retorno && Array.isArray(data.retorno)) {
    rows = data.retorno;
  } else if (data.rows && Array.isArray(data.rows)) {
    rows = data.rows;
  } else if (data.result && Array.isArray(data.result)) {
    rows = data.result;
  } else if (data.aaData && Array.isArray(data.aaData)) {
    rows = data.aaData;
  } else if (data.records && Array.isArray(data.records)) {
    rows = data.records;
  } else if (data.value && Array.isArray(data.value)) {
    rows = data.value;
  } else if (typeof data === 'object' && !Array.isArray(data)) {
    const keys = Object.keys(data).filter(k => Array.isArray(data[k]));
    if (keys.length > 0) rows = data[keys[0]];
    else rows = [data];
  }

  const mapRow = (row) => {
    const cant = extraerValor(row.dCantidad) || row.D_cantidad || row.cantidad || '';
    const obs = [row.dObservacion, row.dObservacion2, row.dObservacion3, row.observaciones]
      .filter(Boolean)
      .map(String)
      .join(' | ') || '';
    return {
      Doc: docValue || row.doc || row.Doc || row.folio || '',
      Cantidad: cant,
      'N producto': row.dDescripcion || row.D_descripcion || row.descripcion || '',
      SKU: row.codigo || row.Codigo || row.sku || '',
      Observacion: obs
    };
  };

  return rows
    .map(mapRow)
    .filter((r) => {
      const docStr = String(r.Doc || '').trim();
      const nProducto = String(r['N producto'] || '').trim();
      if (docStr.includes('Pend') || docStr.includes('Nula')) return false;
      if (nProducto.toLowerCase().includes('servicio')) return false;
      return true;
    });
}

/**
 * Genera reporte Excel combinando Sphinx + Shipit
 * @param {string} reference - Referencia (ej: "BVE 4201", "FVE 25036")
 * @param {string} tipo - "factura" | "boleta" (opcional, se infiere de referencia)
 */
export async function generarReportePorReferencia(reference, tipo) {
  const { folio, tipo: docTipo } = parseReference(reference, tipo);
  const referenciaNormalizada = reference.replace(/\s+/g, '');

  const sphinxData = docTipo === 'boleta'
    ? await consultarBoletaID(folio)
    : await consultarFacturaID(folio);

  const rows = normalizarRespuestaSphinx(sphinxData, referenciaNormalizada || `BVE ${folio}`);
  if (rows.length === 0) {
    throw new Error(`No se obtuvieron datos de Sphinx para folio ${folio}`);
  }

  const mapaShipit = await procesarPedidosEnLotes([referenciaNormalizada]);

  const datosShipit = mapaShipit[referenciaNormalizada] || {
    courier: '',
    estado: '',
    courier_status: ''
  };

  const vendedor = await getVendedorPorReferencia('#' + referenciaNormalizada).catch(() => '');
  const dataConShipit = rows.map((row) => ({
    ...row,
    Courier: datosShipit.courier,
    Estado: datosShipit.estado,
    'Courier Status': datosShipit.courier_status,
    Vendedor: vendedor || ''
  }));

  const columns = ['Doc', '', '', 'Cantidad', 'N producto', 'SKU', 'Courier', 'Estado', 'Courier Status', 'Vendedor'];
  const timestamp = generateTimestamp();
  const outputFileName = `reporte_${docTipo}_${folio}_${timestamp}.xlsx`;
  const outputPath = path.join(getUploadsDir(), outputFileName);

  escribirExcel(dataConShipit, columns, outputPath, true);

  return { outputPath, outputFileName, rowCount: dataConShipit.length };
}

/**
 * Obtiene el detalle de productos (Doc, Cantidad, N producto, SKU) desde Sphinx para una referencia
 * @param {string} reference - Referencia (ej: "BVE4201", "FVE25036")
 * @param {string} tipo - "factura" | "boleta" (opcional, se infiere de referencia)
 * @returns {Promise<Array<{Doc, Cantidad, 'N producto', SKU}>>}
 */
export async function obtenerDetallePorReferencia(reference, tipo) {
  const { folio, tipo: docTipo } = parseReference(reference, tipo);
  const referenciaNormalizada = reference.replace(/\s+/g, '');

  const sphinxData = docTipo === 'boleta'
    ? await consultarBoletaID(folio)
    : await consultarFacturaID(folio);

  return normalizarRespuestaSphinx(sphinxData, referenciaNormalizada || `BVE ${folio}`);
}

/**
 * Genera reporte Excel combinado (Sphinx + Shipit) para todas las ventas que coinciden con el query
 * Usa el flujo: ventas Shipit → Sphinx detalle por referencia → Shipit courier → Excel
 * @param {string} query - Búsqueda para filtrar ventas (vacío = todas)
 */
export async function generarReporteExcelVentas(query = '') {
  const { ventas } = await obtenerListaVentas(query, 1, 10000);
  const referencias = (ventas || [])
    .map((v) => (v.reference || v.idVenta || '').replace(/^#/, '').trim())
    .filter(Boolean);

  const referenciasUnicas = [...new Set(referencias)];
  if (referenciasUnicas.length === 0) {
    throw new Error('No hay ventas con referencia para generar el reporte');
  }

  const todasLasFilas = [];
  const mapaShipit = await procesarPedidosEnLotes(referenciasUnicas);

  for (const reference of referenciasUnicas) {
    try {
      const [rows, vendedor] = await Promise.all([
        obtenerDetallePorReferencia(reference),
        getVendedorPorReferencia('#' + reference).catch(() => '')
      ]);
      const datosShipit = mapaShipit[reference] || {
        courier: '',
        estado: '',
        courier_status: ''
      };
      rows.forEach((row) => {
        todasLasFilas.push({
          ...row,
          Courier: datosShipit.courier,
          Estado: datosShipit.estado,
          'Courier Status': datosShipit.courier_status,
          Vendedor: vendedor || ''
        });
      });
    } catch (err) {
      console.warn(`⚠️ No se pudo obtener detalle Sphinx para ${reference}:`, err.message);
    }
  }

  if (todasLasFilas.length === 0) {
    throw new Error('No se obtuvieron datos de Sphinx para ninguna venta');
  }

  const columns = ['Doc', '', '', 'Cantidad', 'N producto', 'SKU', 'Courier', 'Estado', 'Courier Status', 'Vendedor'];
  const timestamp = generateTimestamp();
  const outputFileName = `reporte_combinado_${timestamp}.xlsx`;
  const outputPath = path.join(getUploadsDir(), outputFileName);

  escribirExcel(todasLasFilas, columns, outputPath, true);

  return { outputPath, outputFileName, rowCount: todasLasFilas.length };
}
