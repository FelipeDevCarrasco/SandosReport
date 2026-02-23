import fetch from 'node-fetch';
import XLSX from 'xlsx';
import { obtenerListaVentas } from '../services/shipit.service.js';
import { getVendedorPorReferencia } from '../services/sphinx.service.js';
import { hasValidSession } from '../services/sphinx-session.service.js';
import { generateTimestamp } from '../utils/fileStorage.js';

export async function getVentas(req, res) {
  try {
    const { query, page, per } = req.query;
    console.log(`[ventas] GET ventas query="${query || ''}" page=${page || 1} per=${per || 50}`);
    const result = await obtenerListaVentas(
      query || '',
      parseInt(page, 10) || 1,
      parseInt(per, 10) || 50
    );

    if (hasValidSession() && result.ventas?.length > 0) {
      const ventasConVendedor = await Promise.all(
        result.ventas.map(async (v) => {
          const ref = v.idVenta || (v.reference ? `#${v.reference}` : '');
          const vendedor = ref ? await getVendedorPorReferencia(ref) : '';
          return { ...v, vendedor };
        })
      );
      result.ventas = ventasConVendedor;
    }

    console.log(`[ventas] Respuesta: ${result.ventas?.length ?? 0} ventas (total ${result.total ?? 0})`);
    res.json({ success: true, ...result });
  } catch (error) {
    console.error('[ventas] Error:', error.message);
    res.status(500).json({
      error: 'Error al obtener ventas de Shipit',
      message: error.message
    });
  }
}

export async function exportVentasExcel(req, res) {
  try {
    const { query } = req.query;
    const result = await obtenerListaVentas(query || '', 1, 10000);
    let ventas = result.ventas || [];

    if (hasValidSession() && ventas.length > 0) {
      ventas = await Promise.all(
        ventas.map(async (v) => {
          const ref = v.idVenta || (v.reference ? `#${v.reference}` : '');
          const vendedor = ref ? await getVendedorPorReferencia(ref) : '';
          return { ...v, vendedor };
        })
      );
    }

    const columns = [
      'Estado', 'ID Venta', 'Fecha Creación', 'Vendedor', 'Destinatario', 'Courier', 'Dirección', 'Comuna'
    ];
    const rows = ventas.map((v) => [
      v.estado || '',
      v.idVenta || '',
      v.fechaCreacion || '',
      v.vendedor ?? '',
      v.destinatario || '',
      v.courier || '',
      v.direccion || '',
      v.comuna || ''
    ]);

    const worksheetData = [columns, ...rows];
    const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Ventas');

    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    const filename = `reporte-ventas-${generateTimestamp()}.xlsx`;

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  } catch (error) {
    console.error('Error exportVentasExcel:', error.message);
    res.status(500).json({
      error: 'Error al generar el reporte Excel',
      message: error.message
    });
  }
}

export async function getOrder(req, res) {
  try {
    const { reference } = req.params;
    
    const shipitEmail = process.env.SHIPIT_EMAIL;
    const shipitAccessToken = process.env.SHIPIT_ACCESS_TOKEN;
    
    if (!shipitEmail || !shipitAccessToken) {
      return res.status(500).json({ 
        error: 'Variables de entorno de Shipit no configuradas',
        message: 'SHIPIT_EMAIL y SHIPIT_ACCESS_TOKEN deben estar configuradas en el archivo .env'
      });
    }
    
    const url = `https://orders.shipit.cl/v/orders?reference=${reference}`;
    
    console.log(`🔍 Consultando API de Shipit para referencia: ${reference}`);
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'X-Shipit-Email': shipitEmail,
        'X-Shipit-Access-Token': shipitAccessToken,
        'Accept': 'application/vnd.orders.v1'
      }
    });
    
    if (!response.ok) {
      let errorText;
      try {
        errorText = await response.text();
        try {
          const errorJson = JSON.parse(errorText);
          errorText = JSON.stringify(errorJson, null, 2);
        } catch (e) {}
      } catch (e) {
        errorText = `HTTP ${response.status}: ${response.statusText}`;
      }
      
      let errorMessage = errorText;
      if (response.status === 404) {
        errorMessage = `La orden con referencia "${reference}" no fue encontrada en Shipit.`;
      } else if (response.status === 401 || response.status === 403) {
        errorMessage = `Error de autenticación. Verifica que SHIPIT_EMAIL y SHIPIT_ACCESS_TOKEN sean correctos.`;
      }
      
      return res.status(response.status).json({ 
        error: 'Error al consultar la API de Shipit',
        message: errorMessage,
        statusCode: response.status,
        reference: reference
      });
    }
    
    const data = await response.json();
    
    res.json({
      success: true,
      data: data,
      reference: reference
    });
  } catch (error) {
    res.status(500).json({ 
      error: 'Error al consultar la API de Shipit',
      message: error.message
    });
  }
}

