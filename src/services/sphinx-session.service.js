import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SESSION_FILE = path.join(__dirname, '../../data/sphinx-session.json');

/**
 * Asegura que exista el directorio data
 */
function ensureDataDir() {
  const dir = path.dirname(SESSION_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

/**
 * Obtiene la sesión de Sphinx.
 * Orden de prioridad: archivo sphinx-session.json > variables de entorno
 */
export function getSession() {
  try {
    if (fs.existsSync(SESSION_FILE)) {
      const data = JSON.parse(fs.readFileSync(SESSION_FILE, 'utf-8'));
      if (data.jsessionId && data.sphinxSession) {
        return {
          jsessionId: data.jsessionId,
          sphinxSession: data.sphinxSession,
          sphinxBase: data.sphinxBase || process.env.SPHINX_BASE || 'sandos',
          updatedAt: data.updatedAt
        };
      }
    }
  } catch (err) {
    console.warn('⚠️ No se pudo leer sphinx-session.json, usando .env:', err.message);
  }

  const jsessionId = process.env.SPHINX_JSESSIONID;
  const sphinxSession = process.env.SPHINX_SESSION;
  const sphinxBase = process.env.SPHINX_BASE || 'sandos';

  if (jsessionId && sphinxSession) {
    return { jsessionId, sphinxSession, sphinxBase, updatedAt: null };
  }

  return null;
}

/**
 * Guarda la sesión en archivo (permite actualizar sin reiniciar el servidor)
 */
export function setSession({ jsessionId, sphinxSession, sphinxBase = 'sandos' }) {
  ensureDataDir();
  const data = {
    jsessionId,
    sphinxSession,
    sphinxBase,
    updatedAt: new Date().toISOString()
  };
  fs.writeFileSync(SESSION_FILE, JSON.stringify(data, null, 2), 'utf-8');
  console.log('✓ Sesión Sphinx actualizada en', SESSION_FILE);
  return data;
}

/**
 * Verifica si hay sesión válida (archivo o .env)
 */
export function hasValidSession() {
  return !!getSession();
}
