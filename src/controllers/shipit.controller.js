import fetch from 'node-fetch';
import { procesarPedidosEnLotes } from '../services/shipit.service.js';
import { escribirExcel } from '../services/report.service.js';
import { getArchivo1 } from '../utils/fileStorage.js';
import { generateTimestamp, getUploadsDir } from '../utils/fileStorage.js';
import path from 'path';
import fs from 'fs';

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

export async function mergeAndDownload(req, res) {
  try {
    const archivo1 = getArchivo1();
    
    if (!archivo1) {
      return res.status(400).json({ 
        error: 'El archivo debe estar cargado para procesarlo' 
      });
    }

    let archivo1Data = [...archivo1.data];

    console.log(`📊 Procesando ${archivo1Data.length} filas...`);
    
    // Extraer pedidos únicos desde la columna Doc
    // Juntar el texto de Doc: "BVE 12345" → "BVE12345"
    const pedidosUnicos = [...new Set(archivo1Data.map(row => {
      const doc = String(row['Doc'] || '').trim();
      // Juntar el texto eliminando espacios: "BVE 12345" → "BVE12345"
      const pedido = doc.replace(/\s+/g, '');
      return pedido;
    }).filter(p => p && p !== ''))];
    
    console.log(`📦 Encontrados ${pedidosUnicos.length} pedidos únicos`);

    const mapaShipit = await procesarPedidosEnLotes(pedidosUnicos);

    archivo1Data = archivo1Data.map((row) => {
      const nuevoRow = { ...row };
      
      // Usar columna Doc y juntar el texto: "BVE 12345" → "BVE12345"
      const doc = String(row['Doc'] || '').trim();
      const referencia = doc.replace(/\s+/g, ''); // Elimina todos los espacios
      
      if (referencia && mapaShipit[referencia]) {
        nuevoRow['Courier'] = mapaShipit[referencia].courier || '';
        nuevoRow['Estado'] = mapaShipit[referencia].estado || '';
        nuevoRow['Courier Status'] = mapaShipit[referencia].courier_status || '';
      } else {
        nuevoRow['Courier'] = '';
        nuevoRow['Estado'] = '';
        nuevoRow['Courier Status'] = '';
      }
      
      return nuevoRow;
    });
    
    console.log(`✅ Archivo procesado con ${archivo1Data.length} filas`);

    const columnas = [...archivo1.columns, 'Courier', 'Estado', 'Courier Status'];
    
    const columnasReordenadas = [...columnas];
    const indiceCantidad = columnasReordenadas.indexOf('Cantidad');
    const indiceProducto = columnasReordenadas.indexOf('N producto');
    
    if (indiceCantidad !== -1 && indiceProducto !== -1) {
      [columnasReordenadas[indiceCantidad], columnasReordenadas[indiceProducto]] = 
      [columnasReordenadas[indiceProducto], columnasReordenadas[indiceCantidad]];
    }

    const timestamp = generateTimestamp();
    const outputFileName = `archivo_procesado_${timestamp}.xlsx`;
    const outputPath = path.join(getUploadsDir(), outputFileName);
    
    escribirExcel(archivo1Data, columnasReordenadas, outputPath, true);

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
      console.error('Error al descargar el archivo:', err);
      if (!res.headersSent) {
        res.status(500).json({ 
          error: 'Error al generar el archivo',
          message: err.message 
        });
      }
    });
  } catch (error) {
    res.status(500).json({ 
      error: 'Error al procesar el archivo',
      message: error.message 
    });
  }
}

