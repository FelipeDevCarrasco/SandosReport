import fetch from 'node-fetch';
import { SPHINX_CONFIG } from '../config/constants.js';
import { getSession, setSession } from './sphinx-session.service.js';

function getBaseUrl() {
  return process.env.SPHINX_BASE_URL || SPHINX_CONFIG.BASE_URL;
}

function getCookies() {
  const session = getSession();

  if (!session || !session.jsessionId || !session.sphinxSession) {
    throw new Error('Sesión Sphinx no configurada. Usa data/sphinx-session.json o .env. Actualiza con POST /api/sphinx/session o POST /api/sphinx/refresh');
  }

  const { jsessionId, sphinxSession, sphinxBase } = session;
  return `JSESSIONID=${jsessionId}; SPHINX_BASE=${sphinxBase}; SPHINX=${sphinxSession}`;
}

function isSesionExpirada(data) {
  if (!data) return false;
  const status = data?.status ?? data?.data?.status ?? '';
  return String(status).includes('No esta conectado') || String(status).includes('No está conectado');
}

/**
 * Llama al servicio Documento$reporte.service de Sphinx
 * Si detecta sesión expirada, intenta renovar con Puppeteer y reintenta una vez
 */
async function callReporteService(param, intento = 1) {
  const baseUrl = getBaseUrl().replace(/\/$/, '');
  const url = `${baseUrl}${SPHINX_CONFIG.REPORTE_SERVICE}`;
  const cookies = getCookies();

  const body = new URLSearchParams({
    param: JSON.stringify(param)
  }).toString();

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
      'Accept': '*/*',
      'Cookie': cookies,
      'Origin': baseUrl,
    },
    compress: true,
    body
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Sphinx reporte.service error ${response.status}: ${text || response.statusText}`);
  }

  const contentType = response.headers.get('content-type');
  let data;
  if (contentType && contentType.includes('application/json')) {
    data = await response.json();
  } else {
    return response.text();
  }

  if (isSesionExpirada(data) && intento === 1) {
    console.log('🔄 Sesión Sphinx expirada, intentando renovar automáticamente...');
    try {
      const { loginSphinxWithPuppeteer } = await import('./sphinx-login.service.js');
      const nuevaSesion = await loginSphinxWithPuppeteer();
      setSession(nuevaSesion);
      return callReporteService(param, 2);
    } catch (err) {
      console.warn('⚠️ No se pudo renovar sesión automáticamente:', err.message);
      throw new Error(`Sesión Sphinx expirada. ${err.message}`);
    }
  }

  return data;
}

/**
 * ConsultarFacturaID - Consulta una factura por folio
 * obs: true y detalle: true son necesarios para obtener observaciones y detalle de ítems
 * @param {string} folio - Número de folio de la factura (ej: "4227")
 * @param {Object} options - Opciones adicionales
 * @param {string} options.idTipo - Tipo de documento (default: "70")
 * @param {string} options.idSucursal - ID sucursal (default: "1")
 * @param {string} options.fechaDesde - Fecha desde (YYYY-MM-DD)
 * @param {string} options.fechaHasta - Fecha hasta (YYYY-MM-DD)
 * @param {number} options.page - Página (default: 1)
 * @param {number} options.maxRow - Filas por página (default: 100)
 */
export async function consultarFacturaID(folio, options = {}) {
  const hoy = new Date().toISOString().slice(0, 10);
  const hace7dias = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const param = {
    idFamilia: '',
    obs: true,
    fechaHasta: options.fechaHasta || hoy,
    fechaDesde: options.fechaDesde || hace7dias,
    idClasificacion: '',
    obsProducto: options.obsProducto !== undefined ? options.obsProducto : '',
    fechaTipo: 'D',
    producto: '',
    idUser: '',
    rut: '',
    idSucursal: options.idSucursal || SPHINX_CONFIG.DEFAULT_ID_SUCURSAL,
    promo: false,
    idDepartamento: '',
    idTipoDoc: '',
    idBodega: '',
    maxRow: options.maxRow ?? 100,
    idPaso: '',
    idSucursalDestino: '',
    idMarca: '',
    maxPage: options.maxPage ?? 1,
    idFormaPago: '',
    transito: false,
    pendiente: '',
    count: null,
    detalle: options.detalle !== undefined ? options.detalle : true,
    idFormaEntrega: '',
    monto: '',
    folio: String(folio),
    idTipo: options.idTipo || SPHINX_CONFIG.DEFAULT_ID_TIPO,
    page: options.page ?? 1,
    idGrupo: null,
    ...options.extra
  };

  return callReporteService(param);
}

/**
 * ConsultarBoletas - Consulta una boleta por folio
 * Similar a factura pero idTipo 74, obs true, detalle true
 * @param {string} folio - Número de folio de la boleta (ej: "25036")
 * @param {Object} options - Opciones adicionales
 */
export async function consultarBoletaID(folio, options = {}) {
  const hoy = new Date().toISOString().slice(0, 10);
  const hace7dias = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const param = {
    idFamilia: '',
    obs: true,
    fechaHasta: options.fechaHasta || hoy,
    fechaDesde: options.fechaDesde || hace7dias,
    idClasificacion: '',
    obsProducto: '',
    fechaTipo: 'D',
    producto: '',
    idUser: '',
    rut: '',
    idSucursal: options.idSucursal || SPHINX_CONFIG.DEFAULT_ID_SUCURSAL,
    promo: false,
    idDepartamento: '',
    idTipoDoc: '',
    idBodega: '',
    maxRow: options.maxRow ?? 15,
    idPaso: '',
    idSucursalDestino: '',
    idMarca: '',
    maxPage: options.maxPage ?? 1,
    idFormaPago: '',
    transito: false,
    pendiente: '',
    count: null,
    detalle: options.detalle ?? true,
    idFormaEntrega: '',
    monto: '',
    folio: String(folio),
    idTipo: options.idTipo || SPHINX_CONFIG.DEFAULT_ID_TIPO_BOLETA,
    page: options.page ?? 1,
    idGrupo: null,
    ...options.extra
  };

  return callReporteService(param);
}

/**
 * Obtiene el vendedor desde Sphinx para una referencia
 * #BVE24161 → consulta Boletas con folio 24161
 * #FVE3990 → consulta Factura electrónica con folio 3990
 * Extrae "ven", o "observaciones" si ven es null
 */
export async function getVendedorPorReferencia(reference) {
  const ref = String(reference || '').replace(/^#/, '').trim();
  if (!ref) return '';

  const esBoleta = ref.toUpperCase().startsWith('BVE');
  const folio = ref.replace(/^\D+/, '').trim();

  if (!folio) return '';

  try {
    const data = esBoleta
      ? await consultarBoletaID(folio)
      : await consultarFacturaID(folio);

    return extraerVendedorDeRespuesta(data);
  } catch (err) {
    console.warn(`⚠️ No se pudo obtener vendedor para ${reference}:`, err.message);
    return '';
  }
}

function extraerVendedorDeRespuesta(data) {
  if (!data) return 'WEB';
  const ven = buscarEnObjeto(data, 'ven');
  if (ven != null && String(ven).trim() !== '') return String(ven).trim();
  return 'WEB';
}

function buscarEnObjeto(obj, key) {
  if (!obj || typeof obj !== 'object') return undefined;
  if (key in obj && obj[key] != null && obj[key] !== '') return obj[key];
  for (const v of Object.values(obj)) {
    if (Array.isArray(v) && v.length > 0) {
      const found = buscarEnObjeto(v[0], key);
      if (found !== undefined) return found;
    } else if (v && typeof v === 'object') {
      const found = buscarEnObjeto(v, key);
      if (found !== undefined) return found;
    }
  }
  return undefined;
}
