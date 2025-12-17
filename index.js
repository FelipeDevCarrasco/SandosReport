import express from 'express';
import multer from 'multer';
import cors from 'cors';
import XLSX from 'xlsx';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import fetch from 'node-fetch';

// Cargar variables de entorno
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Configurar multer para almacenar archivos temporalmente
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, 'uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const fileNumber = req.body.fileNumber || '1';
    const ext = path.extname(file.originalname);
    const name = `archivo${fileNumber}${ext}`;
    cb(null, name);
  }
});

const upload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['.xlsx', '.xls'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedTypes.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Solo se permiten archivos Excel (.xlsx, .xls)'), false);
    }
  },
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB máximo
});

// Almacenar información de los archivos cargados
let archivosCargados = {
  archivo1: null
};

/**
 * Lee un archivo Excel y retorna los datos
 */
function leerExcel(filePath) {
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
 * Detecta la categoría del producto basándose en palabras clave
 * IMPORTANTE: El orden importa - categorías más específicas primero
 * @param {string} producto - Nombre del producto
 * @returns {string} Categoría del producto
 */
function detectarCategoria(producto) {
  const nombre = String(producto || '').toLowerCase();
  
  // Definir categorías en orden de especificidad (más específicas primero)
  // Array de objetos con categoria y función de verificación
  const categorias = [
    {
      nombre: 'Tarjetas Gráficas',
      // Verificar primero porque puede contener "ddr" pero es más específico
      verificar: (n) => {
        return n.includes('tarjeta gráfica') || 
               n.includes('tarjeta de video') ||
               n.includes('gpu') ||
               n.includes('geforce') ||
               n.includes('radeon') ||
               n.includes('rtx') ||
               n.includes('gtx') ||
               n.includes('video card');
      }
    },
    {
      nombre: 'Motherboards',
      // Verificar antes que RAM porque las placas pueden mencionar DDR
      verificar: (n) => {
        return n.includes('motherboard') || 
               n.includes('placa madre') ||
               n.includes('placa base') ||
               n.includes('mainboard') ||
               n.includes('mobo');
      }
    },
    {
      nombre: 'Memoria RAM',
      // Más específico: debe contener "memoria" o "ram" pero NO ser placa o tarjeta
      verificar: (n) => {
        // Excluir si es placa madre o tarjeta gráfica
        if (n.includes('placa madre') || n.includes('placa base') || 
            n.includes('motherboard') || n.includes('mainboard') ||
            n.includes('tarjeta gráfica') || n.includes('tarjeta de video') ||
            n.includes('gpu') || n.includes('geforce') || n.includes('radeon')) {
          return false;
        }
        // Buscar patrones específicos de RAM
        return (n.includes('memoria ram') || 
                n.includes('memoria para notebook') ||
                n.includes('memoria para pc') ||
                n.includes('memoria ddr') ||
                (n.includes('ram') && (n.includes('ddr') || n.includes('so-dimm') || n.includes('dimension'))) ||
                n.includes('memory module'));
      }
    },
    {
      nombre: 'Procesadores',
      verificar: (n) => {
        return n.includes('procesador') || 
               n.includes('cpu') ||
               n.includes('ryzen') ||
               n.includes('intel core') ||
               n.includes(' i3 ') ||
               n.includes(' i5 ') ||
               n.includes(' i7 ') ||
               n.includes(' i9 ') ||
               n.includes('pentium') ||
               n.includes('celeron');
      }
    },
    {
      nombre: 'SSD',
      verificar: (n) => {
        return n.includes('ssd') || 
               n.includes('disco sólido') ||
               n.includes('solid state') ||
               n.includes('nvme') ||
               n.includes('m.2');
      }
    },
    {
      nombre: 'HDD',
      verificar: (n) => {
        return n.includes('hdd') || 
               n.includes('disco duro') ||
               n.includes('hard disk');
      }
    },
    {
      nombre: 'Fuentes de Poder',
      verificar: (n) => {
        return n.includes('fuente de poder') || 
               n.includes('power supply') ||
               n.includes('psu') ||
               (n.includes('fuente') && !n.includes('aliment'));
      }
    },
    {
      nombre: 'Monitores',
      verificar: (n) => {
        return n.includes('monitor') || 
               n.includes('pantalla') ||
               n.includes('display') ||
               n.includes('screen');
      }
    },
    {
      nombre: 'Teclados',
      verificar: (n) => {
        return n.includes('teclado') || 
               n.includes('keyboard');
      }
    },
    {
      nombre: 'Mouse',
      verificar: (n) => {
        return n.includes('mouse') || 
               n.includes('ratón');
      }
    },
    {
      nombre: 'Auriculares',
      verificar: (n) => {
        return n.includes('auricular') || 
               n.includes('headset') ||
               n.includes('audífono');
      }
    },
    {
      nombre: 'Refrigeración',
      verificar: (n) => {
        return n.includes('cooler') || 
               n.includes('ventilador') ||
               n.includes('fan') ||
               n.includes('water cooling') ||
               n.includes('aio') ||
               n.includes('refrigeración');
      }
    },
    {
      nombre: 'Gabinetes',
      verificar: (n) => {
        return n.includes('gabinete') || 
               n.includes('case') ||
               n.includes('chassis') ||
               n.includes('torre');
      }
    },
    {
      nombre: 'Cables',
      verificar: (n) => {
        return n.includes('cable') || 
               n.includes('conector');
      }
    }
  ];
  
  // Buscar coincidencias en orden (más específicas primero)
  for (const categoria of categorias) {
    if (categoria.verificar(nombre)) {
      return categoria.nombre;
    }
  }
  
  return 'Otros';
}

/**
 * Genera un resumen de productos agrupando por SKU y categoría, optimizado para bodega
 * @param {Array} data - Array de objetos con los datos
 * @returns {Array} Array de objetos con Categoría, Producto, Cantidad (suma), SKU, ordenado por categoría
 */
function generarResumen(data) {
  try {
    // Objeto para agrupar por SKU
    const resumenPorSKU = {};
    
    data.forEach(row => {
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
        // Sumar la cantidad
        resumenPorSKU[sku].Cantidad += cantidad;
      }
    });
    
    // Convertir el objeto a array
    const resumenArray = Object.values(resumenPorSKU);
    
    // Ordenar por categoría primero, luego por nombre de producto dentro de cada categoría
    const ordenCategorias = [
      'Monitores',
      'Fuentes de Poder',
      'SSD',
      'HDD',
      'Memoria RAM',
      'Procesadores',
      'Tarjetas Gráficas',
      'Motherboards',
      'Gabinetes',
      'Refrigeración',
      'Teclados',
      'Mouse',
      'Auriculares',
      'Cables',
      'Otros'
    ];
    
    resumenArray.sort((a, b) => {
      // Primero ordenar por categoría
      const indexA = ordenCategorias.indexOf(a.Categoria);
      const indexB = ordenCategorias.indexOf(b.Categoria);
      
      if (indexA !== indexB) {
        // Si una categoría no está en la lista, va al final
        if (indexA === -1) return 1;
        if (indexB === -1) return -1;
        return indexA - indexB;
      }
      
      // Si es la misma categoría, ordenar por nombre de producto
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
 * @param {Array} data - Array de objetos con los datos
 * @param {Array} columns - Array con los nombres de las columnas
 * @param {string} outputPath - Ruta donde guardar el archivo
 * @param {boolean} incluirResumen - Si es true, agrega una hoja "Resumen"
 */
function escribirExcel(data, columns, outputPath, incluirResumen = false) {
  try {
    // Crear un nuevo workbook
    const workbook = XLSX.utils.book_new();
    
    // Preparar los datos: primero las cabeceras, luego los datos
    const worksheetData = [columns]; // Primera fila: cabeceras
    
    // Agregar los datos
    data.forEach(row => {
      const rowData = columns.map(col => row[col] || '');
      worksheetData.push(rowData);
    });
    
    // Crear la hoja de trabajo principal
    const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);
    
    // Agregar la hoja al workbook
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Datos');
    
    // Si se solicita, agregar hoja de resumen
    if (incluirResumen) {
      const resumen = generarResumen(data);
      // Orden de columnas: Categoría, Cantidad, Producto, SKU (intercambiado Producto y Cantidad)
      const columnasResumen = ['Categoría', 'Cantidad', 'Producto', 'SKU'];
      
      // Preparar datos del resumen con agrupación por categoría y subtotales
      const resumenData = [columnasResumen];
      let categoriaActual = '';
      let subtotalCategoria = 0;
      
      resumen.forEach((item, index) => {
        // Si cambió la categoría, agregar subtotal de la categoría anterior
        if (categoriaActual && categoriaActual !== item.Categoria) {
          resumenData.push([
            `SUBTOTAL ${categoriaActual}`,
            subtotalCategoria,
            '',
            ''
          ]);
          subtotalCategoria = 0;
        }
        
        // Si es la primera fila o cambió la categoría, agregar encabezado de categoría
        if (categoriaActual !== item.Categoria) {
          categoriaActual = item.Categoria;
          // Agregar fila separadora (opcional, para mejor visualización)
          if (resumenData.length > 1) {
            resumenData.push(['', '', '', '']); // Fila vacía como separador
          }
        }
        
        // Agregar el producto (orden: Categoría, Cantidad, Producto, SKU)
        resumenData.push([
          item.Categoria,
          item.Cantidad,
          item.Producto,
          item.SKU
        ]);
        
        subtotalCategoria += item.Cantidad;
        
        // Si es el último elemento, agregar el subtotal final
        if (index === resumen.length - 1) {
          resumenData.push([
            `SUBTOTAL ${categoriaActual}`,
            subtotalCategoria,
            '',
            ''
          ]);
        }
      });
      
      // Agregar total general al final
      const totalGeneral = resumen.reduce((sum, item) => sum + item.Cantidad, 0);
      resumenData.push(['', '', '', '']); // Fila vacía
      resumenData.push([
        'TOTAL GENERAL',
        totalGeneral,
        '',
        ''
      ]);
      
      // Crear hoja de resumen
      const resumenWorksheet = XLSX.utils.aoa_to_sheet(resumenData);
      
      // Aplicar formato básico (ancho de columnas aproximado)
      const colWidths = [
        { wch: 20 }, // Categoría
        { wch: 12 }, // Cantidad
        { wch: 60 }, // Producto
        { wch: 12 }  // SKU
      ];
      resumenWorksheet['!cols'] = colWidths;
      
      XLSX.utils.book_append_sheet(workbook, resumenWorksheet, 'Resumen');
      
      console.log(`✓ Resumen generado con ${resumen.length} productos únicos agrupados por categoría`);
    }
    
    // Escribir el archivo
    XLSX.writeFile(workbook, outputPath);
    
    console.log(`✓ Archivo Excel generado: ${outputPath}`);
    return true;
  } catch (error) {
    console.error('Error al escribir el archivo Excel:', error);
    throw error;
  }
}

/**
 * Lee un archivo Excel eliminando las primeras N filas y filtrando solo columnas específicas (para archivo 1)
 * @param {string} filePath - Ruta del archivo
 * @param {number} filasAEliminar - Número de filas a eliminar desde el inicio
 * @param {Array} columnasPermitidas - Array con los nombres de las columnas a mantener
 */
function leerExcelEliminandoFilas(filePath, filasAEliminar = 5, columnasPermitidas = ['Doc', 'Folio', 'Observaciones', 'D_cantidad', 'Codigo', 'D_descripcion']) {
  try {
    if (!fs.existsSync(filePath)) {
      throw new Error(`El archivo ${filePath} no existe`);
    }

    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    
    // Convertir a JSON sin usar la primera fila como header
    const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
    
    // Eliminar las primeras N filas
    const dataSinFilasIniciales = rawData.slice(filasAEliminar);
    
    if (dataSinFilasIniciales.length === 0) {
      throw new Error('El archivo no tiene suficientes filas después de eliminar las filas iniciales');
    }
    
    // La primera fila después de eliminar será la cabecera
    const headers = dataSinFilasIniciales[0];
    const dataRows = dataSinFilasIniciales.slice(1);
    
    // Encontrar los índices de las columnas permitidas
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
    
    // Convertir a array de objetos usando solo las columnas permitidas
    const data = dataRows.map(row => {
      const obj = {};
      indicesColumnas.forEach(({ nombre, indice }) => {
        obj[nombre] = row[indice] !== undefined ? row[indice] : '';
      });
      return obj;
    });

    // Filtrar filas que tengan "BVE Pend" o "BVE Nula" en la columna "Doc"
    const valoresAEliminar = ['BVE Pend', 'BVE Nula'];
    const dataFiltrada = data.filter(row => {
      const valorDoc = String(row.Doc || '').trim();
      return !valoresAEliminar.includes(valorDoc);
    });

    // Limpiar la columna "Observaciones" para extraer solo el número del pedido
    // Formato original: "Pedido Nº15425 creado en WEB" -> Resultado: "15425"
    const dataLimpia = dataFiltrada.map(row => {
      if (row.Observaciones) {
        const observaciones = String(row.Observaciones);
        // Buscar el patrón "Pedido Nº" seguido de números
        const match = observaciones.match(/Pedido\s*N[º°]\s*(\d+)/i);
        if (match && match[1]) {
          row.Observaciones = match[1]; // Solo el número del pedido
        } else {
          // Si no coincide el patrón, mantener el valor original
          row.Observaciones = observaciones;
        }
      }
      return row;
    });

    // Renombrar las columnas según las especificaciones
    const mapeoColumnas = {
      'Folio': 'N boleta',
      'Observaciones': 'N pedido',
      'D_cantidad': 'Cantidad',
      'Codigo': 'SKU',
      'D_descripcion': 'N producto'
      // 'Doc' se mantiene igual
    };

    const dataRenombrada = dataLimpia.map(row => {
      const nuevoRow = {};
      Object.keys(row).forEach(key => {
        const nuevoKey = mapeoColumnas[key] || key;
        nuevoRow[nuevoKey] = row[key];
      });
      return nuevoRow;
    });

    // Actualizar las columnas con los nuevos nombres
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

// Endpoint para cargar el primer archivo
app.post('/api/upload/file1', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No se proporcionó ningún archivo' });
    }

    const filePath = req.file.path;
    
    // Procesar el archivo con delay para simular progreso
    // Esto permite que el frontend muestre el progreso
    await new Promise(resolve => setTimeout(resolve, 300)); // Simular lectura
    
    // Eliminar las primeras 5 filas del archivo 1
    const resultado = leerExcelEliminandoFilas(filePath, 5);

    await new Promise(resolve => setTimeout(resolve, 200)); // Simular procesamiento

    // Generar y guardar el archivo procesado en la raíz del proyecto
    let processedFilePath = null;
    let processedFileName = null;
    try {
      const archivo1 = resultado.data;
      const columnas = resultado.columns;
      
      // Reordenar columnas: intercambiar Cantidad con N producto
      const columnasReordenadas = [...columnas];
      const indiceCantidad = columnasReordenadas.indexOf('Cantidad');
      const indiceProducto = columnasReordenadas.indexOf('N producto');
      
      if (indiceCantidad !== -1 && indiceProducto !== -1) {
        [columnasReordenadas[indiceCantidad], columnasReordenadas[indiceProducto]] = 
        [columnasReordenadas[indiceProducto], columnasReordenadas[indiceCantidad]];
      }

      // Generar nombre del archivo con timestamp
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');
      const hours = String(now.getHours()).padStart(2, '0');
      const minutes = String(now.getMinutes()).padStart(2, '0');
      const seconds = String(now.getSeconds()).padStart(2, '0');
      const timestamp = `${year}-${month}-${day}T${hours}-${minutes}-${seconds}`;
      processedFileName = `archivo1_procesado_${timestamp}.xlsx`;
      processedFilePath = path.join(__dirname, processedFileName);
      
      // Escribir el archivo Excel procesado en la raíz con resumen
      escribirExcel(archivo1, columnasReordenadas, processedFilePath, true);
      
      console.log(`✓ Archivo procesado guardado en la raíz: ${processedFileName}`);
    } catch (error) {
      console.error('Error al guardar archivo procesado en la raíz:', error);
      // No fallar la respuesta si hay error al guardar
    }

    archivosCargados.archivo1 = {
      filename: req.file.originalname,
      path: filePath,
      processedFilePath: processedFilePath,
      processedFileName: processedFileName,
      ...resultado
    };

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
});


// Endpoint para obtener el estado de los archivos cargados
app.get('/api/status', (req, res) => {
  res.json({
    archivo1: archivosCargados.archivo1 ? {
      filename: archivosCargados.archivo1.filename,
      rows: archivosCargados.archivo1.rowCount,
      columns: archivosCargados.archivo1.columns.length,
      processedFileName: archivosCargados.archivo1.processedFileName
    } : null
  });
});

/**
 * Función helper para obtener información de una orden desde Shipit
 * @param {string} reference - Referencia de la orden (N Pedido)
 * @returns {Promise<Object|null>} Objeto con courier y estado, o null si hay error
 */
async function obtenerDatosShipit(reference) {
  try {
    const shipitEmail = process.env.SHIPIT_EMAIL;
    const shipitAccessToken = process.env.SHIPIT_ACCESS_TOKEN;
    
    if (!shipitEmail || !shipitAccessToken) {
      console.warn(`⚠️ Variables de entorno de Shipit no configuradas para referencia ${reference}`);
      return null;
    }
    
    const url = `https://orders.shipit.cl/v/orders?reference=${reference}`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'X-Shipit-Email': shipitEmail,
        'X-Shipit-Access-Token': shipitAccessToken,
        'Accept': 'application/vnd.orders.v1'
      }
    });
    
    if (!response.ok) {
      if (response.status === 404) {
        console.warn(`⚠️ Orden ${reference} no encontrada en Shipit`);
      } else {
        console.warn(`⚠️ Error ${response.status} al consultar orden ${reference}`);
      }
      return null;
    }
    
    const data = await response.json();
    
    // La respuesta de Shipit viene como objeto con estructura:
    // { orders: [{ ... }], total: 1 }
    // Necesitamos extraer el primer elemento del array orders
    let orderData = null;
    
    if (data && data.orders && Array.isArray(data.orders) && data.orders.length > 0) {
      // La respuesta tiene la estructura { orders: [...] }
      orderData = data.orders[0];
      console.log(`📋 Estructura correcta: data.orders[0] para ${reference}`);
    } else if (Array.isArray(data) && data.length > 0) {
      // Si viene directamente como array
      orderData = data[0];
      console.log(`📋 Estructura: array directo para ${reference}`);
    } else if (data && typeof data === 'object') {
      // Si viene como objeto directo (sin orders)
      orderData = data;
      console.log(`📋 Estructura: objeto directo para ${reference}`);
    }
    
    if (!orderData) {
      console.warn(`⚠️ No se pudo extraer orderData para ${reference}`);
      console.log(`📋 Estructura recibida:`, JSON.stringify(data, null, 2));
      return { courier: '', estado: '' };
    }
    
    console.log(`📋 OrderData para ${reference}:`, JSON.stringify(orderData, null, 2));
    
    // Extraer courier.client y state
    let courier = '';
    let estado = '';
    
    // Extraer courier.client
    if (orderData.courier && orderData.courier.client) {
      courier = String(orderData.courier.client);
      console.log(`✅ Courier extraído: "${courier}"`);
    } else {
      console.warn(`⚠️ No se encontró courier.client para ${reference}`);
      if (orderData.courier) {
        console.log(`📦 Estructura courier disponible:`, JSON.stringify(orderData.courier));
      }
    }
    
    // Extraer state
    if (orderData.state) {
      const stateLower = String(orderData.state).toLowerCase();
      console.log(`📊 Estado original: "${orderData.state}" (lowercase: "${stateLower}")`);
      
      if (stateLower === 'deliver' || stateLower === 'delivered') {
        estado = 'Enviado';
      } else if (stateLower === 'confirmed' || stateLower === 'confirm') {
        estado = 'Listo para enviar';
      } else {
        estado = String(orderData.state);
      }
      console.log(`✅ Estado mapeado: "${estado}"`);
    } else {
      console.warn(`⚠️ No se encontró state para ${reference}`);
    }
    
    console.log(`✅ RESULTADO FINAL para ${reference}: courier="${courier}", estado="${estado}"`);
    
    return { courier, estado };
  } catch (error) {
    console.error(`❌ Error al consultar orden ${reference}:`, error.message);
    return null;
  }
}

// Endpoint para obtener información de una orden desde Shipit
app.get('/api/shipit/order/:reference', async (req, res) => {
  try {
    const { reference } = req.params;
    
    // Validar que las variables de entorno estén configuradas
    const shipitEmail = process.env.SHIPIT_EMAIL;
    const shipitAccessToken = process.env.SHIPIT_ACCESS_TOKEN;
    
    if (!shipitEmail || !shipitAccessToken) {
      console.error('❌ Variables de entorno de Shipit no configuradas');
      return res.status(500).json({ 
        error: 'Variables de entorno de Shipit no configuradas',
        message: 'SHIPIT_EMAIL y SHIPIT_ACCESS_TOKEN deben estar configuradas en el archivo .env'
      });
    }
    
    // Construir la URL del endpoint
    const url = `https://orders.shipit.cl/v/orders?reference=${reference}`;
    
    console.log(`🔍 Consultando API de Shipit para referencia: ${reference}`);
    console.log(`📧 Email: ${shipitEmail}`);
    console.log(`🔗 URL: ${url}`);
    
    // Realizar la petición a la API de Shipit
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'X-Shipit-Email': shipitEmail,
        'X-Shipit-Access-Token': shipitAccessToken,
        'Accept': 'application/vnd.orders.v1'
      }
    });
    
    console.log(`📡 Respuesta de Shipit: ${response.status} ${response.statusText}`);
    
    // Verificar el estado de la respuesta
    if (!response.ok) {
      let errorText;
      try {
        errorText = await response.text();
        // Intentar parsear como JSON si es posible
        try {
          const errorJson = JSON.parse(errorText);
          errorText = JSON.stringify(errorJson, null, 2);
        } catch (e) {
          // Si no es JSON, usar el texto tal cual
        }
      } catch (e) {
        errorText = `HTTP ${response.status}: ${response.statusText}`;
      }
      
      console.error(`❌ Error ${response.status} de Shipit:`, errorText);
      
      // Mensajes más específicos según el código de estado
      let errorMessage = errorText;
      if (response.status === 404) {
        errorMessage = `La orden con referencia "${reference}" no fue encontrada en Shipit. Verifica que la referencia sea correcta.`;
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
    
    // Parsear la respuesta JSON
    const data = await response.json();
    
    console.log(`✅ Orden encontrada: ${reference}`);
    
    res.json({
      success: true,
      data: data,
      reference: reference
    });
  } catch (error) {
    console.error('❌ Error al consultar API de Shipit:', error);
    res.status(500).json({ 
      error: 'Error al consultar la API de Shipit',
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Endpoint para descargar el archivo procesado
app.get('/api/download/processed', (req, res) => {
  try {
    if (!archivosCargados.archivo1 || !archivosCargados.archivo1.processedFilePath) {
      return res.status(400).json({ 
        error: 'No hay archivo procesado disponible para descargar' 
      });
    }

    const processedFilePath = archivosCargados.archivo1.processedFilePath;
    const processedFileName = archivosCargados.archivo1.processedFileName || 'archivo_procesado.xlsx';

    if (!fs.existsSync(processedFilePath)) {
      return res.status(404).json({ 
        error: 'El archivo procesado no existe' 
      });
    }

    // Enviar el archivo como descarga
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
});

// Endpoint para procesar y descargar el archivo
app.get('/api/merge', async (req, res) => {
  try {
    // Verificar que el archivo esté cargado
    if (!archivosCargados.archivo1) {
      return res.status(400).json({ 
        error: 'El archivo debe estar cargado para procesarlo' 
      });
    }

    let archivo1 = [...archivosCargados.archivo1.data];

    console.log(`📊 Procesando ${archivo1.length} filas...`);
    console.log(`🔍 Consultando API de Shipit para obtener Courier y Estado...`);

    // Obtener valores únicos de N Pedido para optimizar consultas
    // Primero, verificar qué columnas tenemos disponibles
    if (archivo1.length > 0) {
      console.log(`📋 Columnas disponibles:`, Object.keys(archivo1[0]));
      console.log(`📋 Primera fila de ejemplo:`, archivo1[0]);
    }
    
    const pedidosUnicos = [...new Set(archivo1.map(row => {
      // Intentar diferentes variaciones del nombre de la columna
      const pedido = String(
        row['N pedido'] || 
        row['N Pedido'] || 
        row['n pedido'] || 
        row['N° pedido'] ||
        row['N° Pedido'] ||
        ''
      ).trim();
      return pedido;
    }).filter(p => p && p !== ''))];
    
    console.log(`📦 Encontrados ${pedidosUnicos.length} pedidos únicos:`, pedidosUnicos.slice(0, 10));

    // Crear un mapa de pedido -> datos de Shipit
    const mapaShipit = {};
    
    // Consultar Shipit para cada pedido único (con límite de concurrencia)
    const BATCH_SIZE = 10; // Procesar 10 pedidos a la vez para no sobrecargar la API
    for (let i = 0; i < pedidosUnicos.length; i += BATCH_SIZE) {
      const batch = pedidosUnicos.slice(i, i + BATCH_SIZE);
      const promesas = batch.map(async (pedido) => {
        const datos = await obtenerDatosShipit(pedido);
        return { pedido, datos };
      });
      
      const resultados = await Promise.all(promesas);
      resultados.forEach(({ pedido, datos }) => {
        if (datos && typeof datos === 'object') {
          mapaShipit[pedido] = datos;
        } else {
          // Si no hay datos, guardar valores vacíos pero registrar el pedido
          mapaShipit[pedido] = { courier: '', estado: '' };
          console.log(`⚠️ No se obtuvieron datos para pedido: ${pedido}`);
        }
      });
      
      console.log(`✅ Procesados ${Math.min(i + BATCH_SIZE, pedidosUnicos.length)}/${pedidosUnicos.length} pedidos`);
    }
    
    // Verificar qué datos tenemos en el mapa
    console.log(`🗺️ MapaShipit contiene ${Object.keys(mapaShipit).length} entradas`);
    const primerosPedidos = Object.keys(mapaShipit).slice(0, 5);
    primerosPedidos.forEach(pedido => {
      console.log(`  - Pedido ${pedido}:`, mapaShipit[pedido]);
    });

    // Agregar columnas Courier y Estado a cada fila
    archivo1 = archivo1.map((row, index) => {
      const nuevoRow = { ...row };
      
      // Intentar diferentes variaciones del nombre de la columna
      const nPedido = String(
        row['N pedido'] || 
        row['N Pedido'] || 
        row['n pedido'] || 
        row['N° pedido'] ||
        row['N° Pedido'] ||
        ''
      ).trim();
      
      if (nPedido && mapaShipit[nPedido]) {
        nuevoRow['Courier'] = mapaShipit[nPedido].courier || '';
        nuevoRow['Estado'] = mapaShipit[nPedido].estado || '';
        
        // Log para las primeras filas para debugging
        if (index < 5) {
          console.log(`📝 Fila ${index + 1}: N pedido="${nPedido}" -> Courier="${nuevoRow['Courier']}", Estado="${nuevoRow['Estado']}"`);
          console.log(`   Datos en mapaShipit:`, mapaShipit[nPedido]);
        }
      } else {
        nuevoRow['Courier'] = '';
        nuevoRow['Estado'] = '';
        
        // Log si no encontramos datos para debugging
        if (index < 5) {
          if (!nPedido) {
            console.log(`⚠️ Fila ${index + 1}: No se encontró valor de "N pedido"`);
            console.log(`   Columnas disponibles:`, Object.keys(row));
          } else {
            console.log(`⚠️ Fila ${index + 1}: N pedido="${nPedido}" no encontrado en mapaShipit`);
            console.log(`   Pedidos en mapaShipit:`, Object.keys(mapaShipit).slice(0, 10));
          }
        }
      }
      
      return nuevoRow;
    });
    
    console.log(`✅ Archivo procesado con ${archivo1.length} filas`);

    // Obtener las columnas del archivo 1 y agregar Courier y Estado
    const columnas = [...archivosCargados.archivo1.columns, 'Courier', 'Estado'];
    
    // Reordenar columnas: intercambiar Cantidad (columna C) con N producto (columna B)
    const columnasReordenadas = [...columnas];
    const indiceCantidad = columnasReordenadas.indexOf('Cantidad');
    const indiceProducto = columnasReordenadas.indexOf('N producto');
    
    if (indiceCantidad !== -1 && indiceProducto !== -1) {
      // Intercambiar las posiciones: Cantidad va a la posición de N producto y viceversa
      [columnasReordenadas[indiceCantidad], columnasReordenadas[indiceProducto]] = 
      [columnasReordenadas[indiceProducto], columnasReordenadas[indiceCantidad]];
    }

    // Generar el archivo Excel
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    const timestamp = `${year}-${month}-${day}T${hours}-${minutes}-${seconds}`;
    const outputFileName = `archivo_procesado_${timestamp}.xlsx`;
    const outputPath = path.join(__dirname, 'uploads', outputFileName);
    
    // Escribir el archivo Excel con la hoja de datos y la hoja de resumen
    escribirExcel(archivo1, columnasReordenadas, outputPath, true);

    // Enviar el archivo como descarga con headers explícitos
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    // Codificar el nombre del archivo para evitar problemas con caracteres especiales
    const encodedFileName = encodeURIComponent(outputFileName);
    res.setHeader('Content-Disposition', `attachment; filename="${outputFileName}"; filename*=UTF-8''${encodedFileName}`);
    
    const fileStream = fs.createReadStream(outputPath);
    fileStream.pipe(res);
    
    fileStream.on('end', () => {
      // Eliminar el archivo temporal después de enviarlo
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
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`=== Servidor Sandos Report ===`);
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
  console.log(`Abre tu navegador y visita la URL para usar la aplicación\n`);
});
