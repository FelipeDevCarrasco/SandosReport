import { leerExcelEliminandoFilas } from '../services/excel.service.js';
import { escribirExcel } from '../services/report.service.js';
import { getArchivo1, setArchivo1 } from '../utils/fileStorage.js';
import { generateTimestamp } from '../utils/fileStorage.js';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function uploadFile1(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No se proporcionó ningún archivo' });
    }

    const filePath = req.file.path;
    
    await new Promise(resolve => setTimeout(resolve, 300));
    
    const resultado = leerExcelEliminandoFilas(filePath, 5);
    
    await new Promise(resolve => setTimeout(resolve, 200));

    let processedFilePath = null;
    let processedFileName = null;
    
    try {
      const archivo1 = resultado.data;
      const columnas = resultado.columns;
      
      const columnasReordenadas = [...columnas];
      const indiceCantidad = columnasReordenadas.indexOf('Cantidad');
      const indiceProducto = columnasReordenadas.indexOf('N producto');
      
      if (indiceCantidad !== -1 && indiceProducto !== -1) {
        [columnasReordenadas[indiceCantidad], columnasReordenadas[indiceProducto]] = 
        [columnasReordenadas[indiceProducto], columnasReordenadas[indiceCantidad]];
      }

      const timestamp = generateTimestamp();
      processedFileName = `archivo1_procesado_${timestamp}.xlsx`;
      processedFilePath = path.join(__dirname, '../../', processedFileName);
      
      escribirExcel(archivo1, columnasReordenadas, processedFilePath, true);
      
      console.log(`✓ Archivo procesado guardado en la raíz: ${processedFileName}`);
    } catch (error) {
      console.error('Error al guardar archivo procesado en la raíz:', error);
    }

    setArchivo1({
      filename: req.file.originalname,
      path: filePath,
      processedFilePath: processedFilePath,
      processedFileName: processedFileName,
      ...resultado
    });

    res.json({
      success: true,
      message: 'Archivo de Sphinx procesado correctamente',
      info: {
        filename: req.file.originalname,
        rows: resultado.rowCount,
        columns: resultado.columns,
        sheets: resultado.sheetNames
      }
    });
  } catch (error) {
    res.status(500).json({ 
      error: 'Error al procesar el archivo',
      message: error.message 
    });
  }
}

export function getStatus(req, res) {
  const archivo1 = getArchivo1();
  res.json({
    archivo1: archivo1 ? {
      filename: archivo1.filename,
      rows: archivo1.rowCount,
      columns: archivo1.columns.length,
      processedFileName: archivo1.processedFileName
    } : null
  });
}

export function downloadProcessed(req, res) {
  try {
    const archivo1 = getArchivo1();
    
    if (!archivo1 || !archivo1.processedFilePath) {
      return res.status(400).json({ 
        error: 'No hay archivo procesado disponible para descargar' 
      });
    }

    const processedFilePath = archivo1.processedFilePath;
    const processedFileName = archivo1.processedFileName || 'archivo_procesado.xlsx';

    if (!fs.existsSync(processedFilePath)) {
      return res.status(404).json({ 
        error: 'El archivo procesado no existe' 
      });
    }

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    const encodedFileName = encodeURIComponent(processedFileName);
    res.setHeader('Content-Disposition', `attachment; filename="${processedFileName}"; filename*=UTF-8''${encodedFileName}`);
    
    const fileStream = fs.createReadStream(processedFilePath);
    fileStream.pipe(res);
    
    fileStream.on('error', (err) => {
      console.error('Error al descargar el archivo procesado:', err);
      if (!res.headersSent) {
        res.status(500).json({ 
          error: 'Error al descargar el archivo',
          message: err.message 
        });
      }
    });
  } catch (error) {
    res.status(500).json({ 
      error: 'Error al descargar el archivo procesado',
      message: error.message 
    });
  }
}

