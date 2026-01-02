import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Almacenar información de los archivos cargados
let archivosCargados = {
  archivo1: null
};

export function getArchivosCargados() {
  return archivosCargados;
}

export function setArchivo1(archivo) {
  archivosCargados.archivo1 = archivo;
}

export function getArchivo1() {
  return archivosCargados.archivo1;
}

export function clearArchivo1() {
  archivosCargados.archivo1 = null;
}

export function generateTimestamp() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}-${minutes}-${seconds}`;
}

export function getUploadsDir() {
  return path.join(__dirname, '../../uploads');
}

