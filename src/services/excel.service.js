import XLSX from 'xlsx';
import fs from 'fs';
import { EXCEL_CONFIG } from '../config/constants.js';

/**
 * Lee un archivo Excel y retorna los datos
 */
export function leerExcel(filePath) {
  try {
    if (!fs.existsSync(filePath)) {
      throw new Error(`El archivo ${filePath} no existe`);
    }

    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet);

    return {
      data,
      sheetNames: workbook.SheetNames,
      rowCount: data.length,
      columns: data.length > 0 ? Object.keys(data[0]) : []
    };
  } catch (error) {
    throw error;
  }
}

/**
 * Lee un archivo Excel eliminando las primeras N filas y filtrando columnas específicas
 */
export function leerExcelEliminandoFilas(
  filePath, 
  filasAEliminar = EXCEL_CONFIG.SPHINX_ROWS_TO_SKIP, 
  columnasPermitidas = EXCEL_CONFIG.SPHINX_COLUMNS
) {
  try {
    if (!fs.existsSync(filePath)) {
      throw new Error(`El archivo ${filePath} no existe`);
    }

    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    
    const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
    const dataSinFilasIniciales = rawData.slice(filasAEliminar);
    
    if (dataSinFilasIniciales.length === 0) {
      throw new Error('El archivo no tiene suficientes filas después de eliminar las filas iniciales');
    }
    
    const headers = dataSinFilasIniciales[0];
    const dataRows = dataSinFilasIniciales.slice(1);
    
    const indicesColumnas = columnasPermitidas.map(col => {
      const index = headers.findIndex(h => h === col);
      if (index === -1) {
        console.warn(`Advertencia: La columna "${col}" no se encontró en el archivo`);
      }
      return { nombre: col, indice: index };
    }).filter(item => item.indice !== -1);
    
    if (indicesColumnas.length === 0) {
      throw new Error('No se encontraron ninguna de las columnas especificadas en el archivo');
    }
    
    const data = dataRows.map(row => {
      const obj = {};
      indicesColumnas.forEach(({ nombre, indice }) => {
        obj[nombre] = row[indice] !== undefined ? row[indice] : '';
      });
      return obj;
    });

    // Filtrar filas no válidas
    // Mantener solo filas que contengan "BVE" o "FVE"
    // Eliminar si contiene "Pend" o "Nula" (incluso si es "BVE Pend" o "FVE Nula")
    // Eliminar si la columna D_descripcion (N producto) contiene "Servicio"
    const dataFiltrada = data.filter(row => {
      const valorDoc = String(row.Doc || '').trim();
      const valorProducto = String(row.D_descripcion || '').trim();
      
      // Eliminar si contiene "Pend" o "Nula" en Doc
      if (valorDoc.includes('Pend') || valorDoc.includes('Nula')) {
        return false;
      }
      
      // Eliminar si el producto contiene "Servicio"
      if (valorProducto.toLowerCase().includes('servicio')) {
        return false;
      }
      
      // Solo mantener filas que contengan "BVE" o "FVE" en Doc
      const contieneBVE = valorDoc.includes('BVE');
      const contieneFVE = valorDoc.includes('FVE');
      
      return contieneBVE || contieneFVE;
    });

    // Renombrar columnas
    // NOTA: Observaciones ya no se incluye, solo mantenemos Doc, Cantidad, SKU y N producto
    const mapeoColumnas = {
      'D_cantidad': 'Cantidad',
      'Codigo': 'SKU',
      'D_descripcion': 'N producto'
      // 'Doc' se mantiene igual (no se renombra)
      // 'Observaciones' ya no se incluye en el Excel final
    };

    const dataRenombrada = dataFiltrada.map(row => {
      const nuevoRow = {};
      Object.keys(row).forEach(key => {
        const nuevoKey = mapeoColumnas[key] || key;
        nuevoRow[nuevoKey] = row[key];
      });
      return nuevoRow;
    });

    const columnasRenombradas = columnasPermitidas.map(col => mapeoColumnas[col] || col);

    return {
      data: dataRenombrada,
      sheetNames: workbook.SheetNames,
      rowCount: dataRenombrada.length,
      columns: columnasRenombradas.filter(col => 
        dataRenombrada.length > 0 && Object.keys(dataRenombrada[0]).includes(col)
      )
    };
  } catch (error) {
    throw error;
  }
}

