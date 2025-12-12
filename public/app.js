// Referencias a los elementos del DOM
const fileInput1 = document.getElementById('fileInput1');
const fileInput2 = document.getElementById('fileInput2');
const uploadArea1 = document.getElementById('uploadArea1');
const uploadArea2 = document.getElementById('uploadArea2');
const fileInfo1 = document.getElementById('fileInfo1');
const fileInfo2 = document.getElementById('fileInfo2');
const messageContainer = document.getElementById('messageContainer');

// Estado de los archivos
let currentFiles = {
    file1: null,
    file2: null
};

// Inicializar eventos
function init() {
    // Archivo 1
    uploadArea1.addEventListener('click', () => fileInput1.click());
    fileInput1.addEventListener('change', (e) => handleFileSelect(e, 1));
    setupDragAndDrop(uploadArea1, fileInput1, 1);

    // Archivo 2
    uploadArea2.addEventListener('click', () => fileInput2.click());
    fileInput2.addEventListener('change', (e) => handleFileSelect(e, 2));
    setupDragAndDrop(uploadArea2, fileInput2, 2);

    // Botones de eliminar
    document.getElementById('removeFile1').addEventListener('click', (e) => {
        e.stopPropagation();
        removeFile(1);
    });
    document.getElementById('removeFile2').addEventListener('click', (e) => {
        e.stopPropagation();
        removeFile(2);
    });

    // Botón para unir archivos
    document.getElementById('btnMerge').addEventListener('click', mergeAndDownload);
}

// Configurar drag and drop
function setupDragAndDrop(area, input, fileNumber) {
    area.addEventListener('dragover', (e) => {
        e.preventDefault();
        area.classList.add('dragover');
    });

    area.addEventListener('dragleave', () => {
        area.classList.remove('dragover');
    });

    area.addEventListener('drop', (e) => {
        e.preventDefault();
        area.classList.remove('dragover');
        
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            input.files = files;
            handleFileSelect({ target: input }, fileNumber);
        }
    });
}

// Manejar selección de archivo
function handleFileSelect(event, fileNumber) {
    const file = event.target.files[0];
    if (!file) return;

    // Validar tipo de archivo
    const validTypes = [
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-excel'
    ];
    const validExtensions = ['.xlsx', '.xls'];
    const fileExt = '.' + file.name.split('.').pop().toLowerCase();

    if (!validExtensions.includes(fileExt)) {
        showMessage('Por favor, selecciona un archivo Excel (.xlsx o .xls)', 'error');
        return;
    }

    currentFiles[`file${fileNumber}`] = file;
    uploadFile(file, fileNumber);
}

// Subir archivo al servidor
async function uploadFile(file, fileNumber) {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('fileNumber', fileNumber);

    const progressContainer = document.getElementById(`progressContainer${fileNumber}`);
    const progressFill = document.getElementById(`progressFill${fileNumber}`);
    const progressText = document.getElementById(`progressText${fileNumber}`);
    const uploadArea = document.getElementById(`uploadArea${fileNumber}`);
    const fileInfo = document.getElementById(`fileInfo${fileNumber}`);

    // Mostrar barra de progreso
    progressContainer.style.display = 'flex';
    uploadArea.style.display = 'none';

    // Progreso específico para cada archivo
    let progressInterval;
    if (fileNumber === 1) {
        // Etapas del procesamiento del archivo 1 (Sphinx)
        const etapas = [
            { porcentaje: 10, mensaje: 'Cargando archivo...' },
            { porcentaje: 25, mensaje: 'Leyendo datos...' },
            { porcentaje: 40, mensaje: 'Eliminando filas iniciales...' },
            { porcentaje: 55, mensaje: 'Filtrando columnas...' },
            { porcentaje: 70, mensaje: 'Eliminando filas no válidas...' },
            { porcentaje: 85, mensaje: 'Limpiando datos...' },
            { porcentaje: 95, mensaje: 'Generando archivo modificado...' }
        ];

        let etapaActual = 0;
        progressInterval = setInterval(() => {
            if (etapaActual < etapas.length) {
                const etapa = etapas[etapaActual];
                progressFill.style.width = `${etapa.porcentaje}%`;
                progressText.textContent = `${etapa.porcentaje}% - ${etapa.mensaje}`;
                etapaActual++;
            } else {
                clearInterval(progressInterval);
            }
        }, 400);
    } else {
        // Etapas del procesamiento del archivo 2 (Shipit)
        const etapas = [
            { porcentaje: 15, mensaje: 'Cargando archivo...' },
            { porcentaje: 35, mensaje: 'Leyendo datos...' },
            { porcentaje: 55, mensaje: 'Filtrando columnas...' },
            { porcentaje: 75, mensaje: 'Limpiando ID orden...' },
            { porcentaje: 90, mensaje: 'Generando archivo modificado...' }
        ];

        let etapaActual = 0;
        progressInterval = setInterval(() => {
            if (etapaActual < etapas.length) {
                const etapa = etapas[etapaActual];
                progressFill.style.width = `${etapa.porcentaje}%`;
                progressText.textContent = `${etapa.porcentaje}% - ${etapa.mensaje}`;
                etapaActual++;
            } else {
                clearInterval(progressInterval);
            }
        }, 400);
    }

    try {
        const response = await fetch(`/api/upload/file${fileNumber}`, {
            method: 'POST',
            body: formData
        });

        clearInterval(progressInterval);
        
        // Asegurar que el progreso llegue al 100%
        progressFill.style.width = '100%';
        progressText.textContent = '100% - Completado';

        const result = await response.json();

        if (response.ok) {
            setTimeout(() => {
                progressContainer.style.display = 'none';
                fileInfo.style.display = 'flex';
                
                // Mostrar información del archivo
                document.getElementById(`fileName${fileNumber}`).textContent = result.info.filename;
                const statsText = `${result.info.rows} filas • ${result.info.columns.length} columnas`;
                document.getElementById(`fileStats${fileNumber}`).textContent = statsText;

                showMessage(result.message, 'success');
                
                // Verificar si ambos archivos están cargados para mostrar el botón de unir
                checkFilesLoaded();
            }, 500);
        } else {
            throw new Error(result.message || result.error);
        }
    } catch (error) {
        if (progressInterval) clearInterval(progressInterval);
        progressContainer.style.display = 'none';
        uploadArea.style.display = 'block';
        currentFiles[`file${fileNumber}`] = null;
        showMessage(`Error al cargar el archivo: ${error.message}`, 'error');
    }
}

// Eliminar archivo
function removeFile(fileNumber) {
    currentFiles[`file${fileNumber}`] = null;
    const fileInput = document.getElementById(`fileInput${fileNumber}`);
    const uploadArea = document.getElementById(`uploadArea${fileNumber}`);
    const fileInfo = document.getElementById(`fileInfo${fileNumber}`);
    const progressContainer = document.getElementById(`progressContainer${fileNumber}`);

    fileInput.value = '';
    fileInfo.style.display = 'none';
    progressContainer.style.display = 'none';
    uploadArea.style.display = 'block';

    showMessage(`Archivo ${fileNumber} eliminado`, 'info');
    checkFilesLoaded();
}

// Verificar si ambos archivos están cargados
function checkFilesLoaded() {
    const fileInfo1 = document.getElementById('fileInfo1');
    const fileInfo2 = document.getElementById('fileInfo2');
    const mergeSection = document.getElementById('mergeSection');
    
    if (fileInfo1.style.display !== 'none' && fileInfo2.style.display !== 'none') {
        mergeSection.style.display = 'block';
    } else {
        mergeSection.style.display = 'none';
    }
}

// Unir archivos y descargar
async function mergeAndDownload() {
    const btnMerge = document.getElementById('btnMerge');
    const originalText = btnMerge.textContent;
    
    btnMerge.disabled = true;
    btnMerge.textContent = '⏳ Uniendo archivos...';
    
    try {
        const response = await fetch('/api/merge');
        
        if (response.ok) {
            // Obtener el nombre del archivo del header Content-Disposition
            const contentDisposition = response.headers.get('Content-Disposition');
            let filename = 'archivo_unido.xlsx';
            if (contentDisposition) {
                // Extraer el nombre del archivo, manejando diferentes formatos
                const filenameMatch = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
                if (filenameMatch && filenameMatch[1]) {
                    filename = filenameMatch[1].replace(/['"]/g, '').trim();
                    // Asegurar que termine en .xlsx
                    if (!filename.endsWith('.xlsx')) {
                        filename = filename.replace(/\.xlsx.*$/i, '') + '.xlsx';
                    }
                }
            }
            
            // Descargar el archivo
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
            
            showMessage('Archivos unidos y descargados correctamente', 'success');
        } else {
            const error = await response.json();
            throw new Error(error.message || error.error || 'Error al unir los archivos');
        }
    } catch (error) {
        showMessage(`Error al unir los archivos: ${error.message}`, 'error');
    } finally {
        btnMerge.disabled = false;
        btnMerge.textContent = originalText;
    }
}

// Mostrar mensaje
function showMessage(text, type = 'info') {
    const message = document.createElement('div');
    message.className = `message ${type}`;
    message.textContent = text;
    
    messageContainer.appendChild(message);

    // Eliminar mensaje después de 5 segundos
    setTimeout(() => {
        message.style.animation = 'slideIn 0.3s ease reverse';
        setTimeout(() => message.remove(), 300);
    }, 5000);
}

// Inicializar cuando el DOM esté listo
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

