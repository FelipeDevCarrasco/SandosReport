import XLSX from 'xlsx';
import { detectarCategoria } from './category.service.js';
import { CATEGORY_ORDER } from '../config/constants.js';

/**
 * Genera un resumen de productos agrupando por SKU y categoría
 */
export function generarResumen(data) {
  try {
    console.log(`📊 Generando resumen con ${data.length} registros totales`);
    
    const dataFiltrada = data.filter(row => {
      const courierStatus = String(row['Courier Status'] || '').trim().toLowerCase();
      return courierStatus !== 'delivered';
    });
    
    console.log(`✅ Filtrando resumen: ${data.length} registros totales, ${dataFiltrada.length} registros después de excluir "delivered"`);
    
    const resumenPorSKU = {};
    
    dataFiltrada.forEach(row => {
      const sku = String(row['SKU'] || '').trim();
      const producto = String(row['N producto'] || '').trim();
      const cantidad = parseFloat(row['Cantidad'] || 0) || 0;
      
      if (sku) {
        if (!resumenPorSKU[sku]) {
          resumenPorSKU[sku] = {
            SKU: sku,
            Producto: producto || '',
            Cantidad: 0,
            Categoria: detectarCategoria(producto)
          };
        }
        resumenPorSKU[sku].Cantidad += cantidad;
      }
    });
    
    const resumenArray = Object.values(resumenPorSKU);
    
    resumenArray.sort((a, b) => {
      const indexA = CATEGORY_ORDER.indexOf(a.Categoria);
      const indexB = CATEGORY_ORDER.indexOf(b.Categoria);
      
      if (indexA !== indexB) {
        if (indexA === -1) return 1;
        if (indexB === -1) return -1;
        return indexA - indexB;
      }
      
      return String(a.Producto).localeCompare(String(b.Producto));
    });
    
    return resumenArray;
  } catch (error) {
    console.error('Error al generar resumen:', error);
    throw error;
  }
}

/**
 * Escribe un archivo Excel con los datos proporcionados y opcionalmente una hoja de resumen
 */
export function escribirExcel(data, columns, outputPath, incluirResumen = false) {
  try {
    const workbook = XLSX.utils.book_new();
    
    const datosSinGlobal = data.filter(row => {
      const courier = String(row['Courier'] || '').trim().toLowerCase();
      return courier !== 'global_tracking';
    });
    
    console.log(`📊 Total de registros: ${data.length}, Registros sin global_tracking: ${datosSinGlobal.length}`);
    
    const worksheetData = [columns];
    datosSinGlobal.forEach(row => {
      const rowData = columns.map(col => (col === '' ? '' : (row[col] || '')));
      worksheetData.push(rowData);
    });
    
    const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Datos');
    
    const datosGlobal = data.filter(row => {
      const courier = String(row['Courier'] || '').trim().toLowerCase();
      return courier === 'global_tracking';
    });
    
    if (datosGlobal.length > 0) {
      console.log(`📦 Creando hoja "global" con ${datosGlobal.length} registros`);
      const globalData = [columns];
      datosGlobal.forEach(row => {
        const rowData = columns.map(col => (col === '' ? '' : (row[col] || '')));
        globalData.push(rowData);
      });
      const globalWorksheet = XLSX.utils.aoa_to_sheet(globalData);
      XLSX.utils.book_append_sheet(workbook, globalWorksheet, 'Global');
    }
    
    if (incluirResumen) {
      const resumen = generarResumen(data);
      const columnasResumen = ['Categoría', 'Cantidad', 'Producto', 'SKU'];
      const resumenData = [columnasResumen];
      let categoriaActual = '';
      let subtotalCategoria = 0;
      
      resumen.forEach((item, index) => {
        if (categoriaActual && categoriaActual !== item.Categoria) {
          resumenData.push([
            `SUBTOTAL ${categoriaActual}`,
            subtotalCategoria,
            '',
            ''
          ]);
          subtotalCategoria = 0;
        }
        
        if (categoriaActual !== item.Categoria) {
          categoriaActual = item.Categoria;
          if (resumenData.length > 1) {
            resumenData.push(['', '', '', '']);
          }
        }
        
        resumenData.push([
          item.Categoria,
          item.Cantidad,
          item.Producto,
          item.SKU
        ]);
        
        subtotalCategoria += item.Cantidad;
        
        if (index === resumen.length - 1) {
          resumenData.push([
            `SUBTOTAL ${categoriaActual}`,
            subtotalCategoria,
            '',
            ''
          ]);
        }
      });
      
      const totalGeneral = resumen.reduce((sum, item) => sum + item.Cantidad, 0);
      resumenData.push(['', '', '', '']);
      resumenData.push([
        'TOTAL GENERAL',
        totalGeneral,
        '',
        ''
      ]);
      
      const resumenWorksheet = XLSX.utils.aoa_to_sheet(resumenData);
      const colWidths = [
        { wch: 20 },
        { wch: 12 },
        { wch: 60 },
        { wch: 12 }
      ];
      resumenWorksheet['!cols'] = colWidths;
      
      XLSX.utils.book_append_sheet(workbook, resumenWorksheet, 'Resumen');
      console.log(`✓ Resumen generado con ${resumen.length} productos únicos agrupados por categoría`);
    }
    
    XLSX.writeFile(workbook, outputPath);
    console.log(`✓ Archivo Excel generado: ${outputPath}`);
    return true;
  } catch (error) {
    console.error('Error al escribir el archivo Excel:', error);
    throw error;
  }
}

