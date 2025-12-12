import express from 'express';
import multer from 'multer';
import cors from 'cors';
import XLSX from 'xlsx';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

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
  archivo1: null,
  archivo2: null
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
 * Procesa el archivo 2 (Shipit): mantiene solo "ID orden" y "Courier", y elimina "#" de ID orden
 * @param {string} filePath - Ruta del archivo
 */
function procesarArchivoShipit(filePath) {
  try {
    if (!fs.existsSync(filePath)) {
      throw new Error(`El archivo ${filePath} no existe`);
    }

    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet);

    // Columnas a mantener
    const columnasPermitidas = ['ID orden', 'Courier'];
    
    // Verificar que las columnas existan
    if (data.length === 0) {
      throw new Error('El archivo está vacío');
    }

    const columnasDisponibles = Object.keys(data[0]);
    const columnasEncontradas = columnasPermitidas.filter(col => 
      columnasDisponibles.includes(col)
    );

    if (columnasEncontradas.length === 0) {
      throw new Error('No se encontraron las columnas "ID orden" o "Courier" en el archivo');
    }

    // Filtrar datos: mantener solo las columnas permitidas y limpiar "ID orden"
    const dataProcesada = data.map(row => {
      const nuevoRow = {};
      
      // Procesar "ID orden": quitar el "#"
      if (row['ID orden']) {
        nuevoRow['ID orden'] = String(row['ID orden']).replace(/^#/, '').trim();
      } else {
        nuevoRow['ID orden'] = '';
      }
      
      // Mantener "Courier"
      if (row['Courier']) {
        nuevoRow['Courier'] = String(row['Courier']).trim();
      } else {
        nuevoRow['Courier'] = '';
      }
      
      return nuevoRow;
    });

    return {
      data: dataProcesada,
      sheetNames: workbook.SheetNames,
      rowCount: dataProcesada.length,
      columns: columnasEncontradas
    };
  } catch (error) {
    throw error;
  }
}

/**
 * Escribe un archivo Excel con los datos proporcionados
 * @param {Array} data - Array de objetos con los datos
 * @param {Array} columns - Array con los nombres de las columnas
 * @param {string} outputPath - Ruta donde guardar el archivo
 */
function escribirExcel(data, columns, outputPath) {
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
    
    // Crear la hoja de trabajo
    const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);
    
    // Agregar la hoja al workbook
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Datos');
    
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

    archivosCargados.archivo1 = {
      filename: req.file.originalname,
      path: filePath,
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

// Endpoint para cargar el segundo archivo
app.post('/api/upload/file2', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No se proporcionó ningún archivo' });
    }

    const filePath = req.file.path;
    // Procesar el archivo 2 (Shipit): mantener solo ID orden y Courier, quitar "#" de ID orden
    const resultado = procesarArchivoShipit(filePath);

    archivosCargados.archivo2 = {
      filename: req.file.originalname,
      path: filePath,
      ...resultado
    };

    res.json({
      success: true,
      message: 'Archivo de Shipit procesado correctamente',
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
      columns: archivosCargados.archivo1.columns.length
    } : null,
    archivo2: archivosCargados.archivo2 ? {
      filename: archivosCargados.archivo2.filename,
      rows: archivosCargados.archivo2.rowCount,
      columns: archivosCargados.archivo2.columns.length
    } : null
  });
});

// Endpoint para unir los archivos y descargar el resultado
app.get('/api/merge', (req, res) => {
  try {
    // Verificar que ambos archivos estén cargados
    if (!archivosCargados.archivo1 || !archivosCargados.archivo2) {
      return res.status(400).json({ 
        error: 'Ambos archivos deben estar cargados para realizar la unión' 
      });
    }

    const archivo1 = archivosCargados.archivo1.data;
    const archivo2 = archivosCargados.archivo2.data;

    // Crear un mapa del archivo 2: ID orden -> Courier
    const mapaCourier = {};
    archivo2.forEach(row => {
      const idOrden = String(row['ID orden'] || '').trim();
      const courier = String(row['Courier'] || '').trim();
      if (idOrden) {
        mapaCourier[idOrden] = courier;
      }
    });

    // Agregar la columna "Courier" al archivo 1 basándose en "N pedido"
    const archivoUnido = archivo1.map(row => {
      const nuevoRow = { ...row };
      const nPedido = String(row['N pedido'] || '').trim();
      
      // Buscar el Courier correspondiente en el mapa
      if (mapaCourier[nPedido]) {
        nuevoRow['Courier'] = mapaCourier[nPedido];
      } else {
        nuevoRow['Courier'] = ''; // Si no hay coincidencia, dejar vacío
      }
      
      return nuevoRow;
    });

    // Obtener las columnas del archivo 1 y agregar "Courier" al final
    const columnas = [...archivosCargados.archivo1.columns, 'Courier'];

    // Generar el archivo Excel
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    const timestamp = `${year}-${month}-${day}T${hours}-${minutes}-${seconds}`;
    const outputFileName = `archivo_unido_${timestamp}.xlsx`;
    const outputPath = path.join(__dirname, 'uploads', outputFileName);
    
    escribirExcel(archivoUnido, columnas, outputPath);

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
      error: 'Error al unir los archivos',
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
