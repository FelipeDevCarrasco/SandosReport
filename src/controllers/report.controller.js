import { generarReportePorReferencia, obtenerDetallePorReferencia, generarReporteExcelVentas } from '../services/report-combined.service.js';
import fs from 'fs';
import * as sessionService from '../services/sphinx-session.service.js';

function checkSphinxSession(res) {
  if (!sessionService.hasValidSession()) {
    res.status(500).json({
      error: 'Sesión Sphinx no configurada',
      message: 'Configura la sesión con POST /api/sphinx/session o POST /api/sphinx/refresh'
    });
    return false;
  }
  return true;
}

/**
 * GET /api/report/generate?reference=BVE%204201&tipo=factura
 * Genera reporte combinando Shipit + Sphinx por referencia
 */
export async function generateReport(req, res) {
  try {
    if (!checkSphinxSession(res)) return;

    const { reference, tipo } = req.query;

    if (!reference || !reference.trim()) {
      return res.status(400).json({
        error: 'Falta la referencia',
        message: 'Debe indicar reference en query: ?reference=BVE%204201 o ?reference=25036&tipo=boleta'
      });
    }

    const { outputPath, outputFileName, rowCount } = await generarReportePorReferencia(
      reference.trim(),
      tipo
    );

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    const encodedFileName = encodeURIComponent(outputFileName);
    res.setHeader('Content-Disposition', `attachment; filename="${outputFileName}"; filename*=UTF-8''${encodedFileName}`);

    const fileStream = fs.createReadStream(outputPath);
    fileStream.pipe(res);

    fileStream.on('end', () => {
      setTimeout(() => {
        if (fs.existsSync(outputPath)) {
          fs.unlinkSync(outputPath);
        }
      }, 1000);
    });

    fileStream.on('error', (err) => {
      console.error('Error al descargar reporte:', err);
      if (!res.headersSent) {
        res.status(500).json({
          error: 'Error al generar el reporte',
          message: err.message
        });
      }
    });
  } catch (error) {
    console.error('Error generateReport:', error.message);
    res.status(500).json({
      error: 'Error al generar el reporte',
      message: error.message
    });
  }
}

/**
 * GET /api/report/detail?reference=BVE4201&tipo=boleta
 * Obtiene el detalle de productos (Doc, Cantidad, N producto, SKU) desde Sphinx
 */
export async function getDetail(req, res) {
  try {
    if (!checkSphinxSession(res)) return;

    const { reference, tipo } = req.query;

    if (!reference || !reference.trim()) {
      return res.status(400).json({
        error: 'Falta la referencia',
        message: 'Debe indicar reference en query: ?reference=BVE4201 o ?reference=25036&tipo=boleta'
      });
    }

    const detalle = await obtenerDetallePorReferencia(reference.trim(), tipo);
    res.json({ success: true, detalle });
  } catch (error) {
    console.error('Error getDetail:', error.message);
    res.status(500).json({
      error: 'Error al obtener detalle',
      message: error.message
    });
  }
}

/**
 * GET /api/report/excel?query=&fechaDesde=&fechaHasta=
 * Genera reporte Excel combinado (Sphinx + Shipit) para las ventas que coinciden con el query y rango de fechas
 */
export async function generateExcelReport(req, res) {
  try {
    if (!checkSphinxSession(res)) return;

    const { query, fechaDesde, fechaHasta } = req.query;

    const { outputPath, outputFileName } = await generarReporteExcelVentas(
      query || '',
      fechaDesde || '',
      fechaHasta || ''
    );

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    const encodedFileName = encodeURIComponent(outputFileName);
    res.setHeader('Content-Disposition', `attachment; filename="${outputFileName}"; filename*=UTF-8''${encodedFileName}`);

    const fileStream = fs.createReadStream(outputPath);
    fileStream.pipe(res);

    fileStream.on('end', () => {
      setTimeout(() => {
        if (fs.existsSync(outputPath)) {
          fs.unlinkSync(outputPath);
        }
      }, 1000);
    });

    fileStream.on('error', (err) => {
      console.error('Error al descargar reporte Excel:', err);
      if (!res.headersSent) {
        res.status(500).json({
          error: 'Error al generar el reporte',
          message: err.message
        });
      }
    });
  } catch (error) {
    console.error('Error generateExcelReport:', error.message);
    res.status(500).json({
      error: 'Error al generar el reporte Excel',
      message: error.message
    });
  }
}
