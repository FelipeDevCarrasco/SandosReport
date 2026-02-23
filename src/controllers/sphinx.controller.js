import * as sphinxService from '../services/sphinx.service.js';
import * as sessionService from '../services/sphinx-session.service.js';
import { loginSphinxWithPuppeteer, verificarSesion } from '../services/sphinx-login.service.js';

/**
 * Verifica que haya sesión válida (archivo o .env)
 */
function checkCredentials(res) {
  if (!sessionService.hasValidSession()) {
    res.status(500).json({
      error: 'Sesión Sphinx no configurada',
      message: 'Configura data/sphinx-session.json o .env (SPHINX_JSESSIONID, SPHINX_SESSION). Actualiza con POST /api/sphinx/session o POST /api/sphinx/refresh'
    });
    return false;
  }
  return true;
}

/**
 * GET /api/sphinx/status
 */
export function getStatus(req, res) {
  try {
    if (!checkCredentials(res)) return;

    const session = sessionService.getSession();
    res.json({
      success: true,
      message: 'Sphinx configurado correctamente',
      baseUrl: process.env.SPHINX_BASE_URL || 'https://sandos.sphinx.cl',
      sessionUpdatedAt: session?.updatedAt || null
    });
  } catch (error) {
    res.status(500).json({
      error: 'Error al verificar estado de Sphinx',
      message: error.message
    });
  }
}

/**
 * GET /api/sphinx/factura/:folio
 * ConsultarFacturaID
 */
export async function consultarFactura(req, res) {
  try {
    if (!checkCredentials(res)) return;

    const { folio } = req.params;
    const { idTipo, idSucursal, fechaDesde, fechaHasta, detalle, page, maxRow } = req.query;

    if (!folio) {
      return res.status(400).json({
        error: 'Falta el folio',
        message: 'Debe indicar el número de folio en la URL: /api/sphinx/factura/4201'
      });
    }

    const data = await sphinxService.consultarFacturaID(folio, {
      idTipo,
      idSucursal,
      fechaDesde,
      fechaHasta,
      detalle: detalle === 'false' ? false : true,
      page: page ? parseInt(page, 10) : undefined,
      maxRow: maxRow ? parseInt(maxRow, 10) : undefined
    });

    res.json({ success: true, data });
  } catch (error) {
    console.error('Error consultarFactura:', error.message);
    res.status(500).json({
      error: 'Error al consultar factura en Sphinx',
      message: error.message
    });
  }
}

/**
 * GET /api/sphinx/boleta/:folio
 * ConsultarBoletas
 */
export async function consultarBoleta(req, res) {
  try {
    if (!checkCredentials(res)) return;

    const { folio } = req.params;
    const { idTipo, idSucursal, fechaDesde, fechaHasta, detalle, page, maxRow } = req.query;

    if (!folio) {
      return res.status(400).json({
        error: 'Falta el folio',
        message: 'Debe indicar el número de folio en la URL: /api/sphinx/boleta/25036'
      });
    }

    const data = await sphinxService.consultarBoletaID(folio, {
      idTipo,
      idSucursal,
      fechaDesde,
      fechaHasta,
      detalle: detalle === 'false' ? false : true,
      page: page ? parseInt(page, 10) : undefined,
      maxRow: maxRow ? parseInt(maxRow, 10) : undefined
    });

    res.json({ success: true, data });
  } catch (error) {
    console.error('Error consultarBoleta:', error.message);
    res.status(500).json({
      error: 'Error al consultar boleta en Sphinx',
      message: error.message
    });
  }
}

/**
 * POST /api/sphinx/session
 * Actualizar sesión manualmente (cuando expira, copiar cookies del navegador)
 * Body: { jsessionId, sphinxSession, sphinxBase? }
 */
export async function updateSession(req, res) {
  try {
    const { jsessionId, sphinxSession, sphinxBase } = req.body || {};

    if (!jsessionId || !sphinxSession) {
      return res.status(400).json({
        error: 'Faltan datos',
        message: 'Envía { "jsessionId": "...", "sphinxSession": "..." } en el body'
      });
    }

    const session = sessionService.setSession({
      jsessionId: String(jsessionId).trim(),
      sphinxSession: String(sphinxSession).trim(),
      sphinxBase: (sphinxBase || 'sandos').toString()
    });

    res.json({
      success: true,
      message: 'Sesión actualizada. Se usará en las próximas consultas.',
      updatedAt: session.updatedAt
    });
  } catch (error) {
    res.status(500).json({
      error: 'Error al actualizar sesión',
      message: error.message
    });
  }
}

/**
 * POST /api/sphinx/refresh
 * Login automático con Puppeteer (obtiene cookies nuevas)
 * Requiere: SPHINX_USER, SPHINX_PASSWORD en .env
 */
export async function refreshSession(req, res) {
  try {
    const session = await loginSphinxWithPuppeteer();
    sessionService.setSession(session);

    res.json({
      success: true,
      message: 'Sesión renovada automáticamente mediante login.',
      updatedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error refreshSession:', error.message);
    res.status(500).json({
      error: 'Error al renovar sesión automáticamente',
      message: error.message
    });
  }
}

/**
 * POST /api/sphinx/ensure-session
 * Verifica la sesión actual y la renueva automáticamente si es necesario
 */
export async function ensureSession(req, res) {
  try {
    const currentSession = sessionService.getSession();
    
    if (currentSession && currentSession.jsessionId && currentSession.sphinxSession) {
      console.log('🔍 Verificando sesión Sphinx existente...');
      const isValid = await verificarSesion(currentSession);
      
      if (isValid) {
        console.log('✅ Sesión Sphinx válida');
        return res.json({
          success: true,
          status: 'valid',
          message: 'Sesión Sphinx activa y válida'
        });
      }
      
      console.log('⚠️ Sesión Sphinx expirada, renovando...');
    } else {
      console.log('⚠️ No hay sesión Sphinx configurada, iniciando login...');
    }
    
    const newSession = await loginSphinxWithPuppeteer();
    sessionService.setSession(newSession);
    
    console.log('✅ Sesión Sphinx renovada exitosamente');
    return res.json({
      success: true,
      status: 'renewed',
      message: 'Sesión Sphinx renovada exitosamente'
    });
    
  } catch (error) {
    console.error('❌ Error en ensureSession:', error.message);
    res.status(500).json({
      success: false,
      status: 'error',
      error: 'Error al verificar/renovar sesión Sphinx',
      message: error.message
    });
  }
}
