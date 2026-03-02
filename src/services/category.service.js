import { CATEGORIES } from '../config/constants.js';

/**
 * Detecta la categoría del producto basándose en palabras clave
 * @param {string} producto - Nombre del producto
 * @returns {string} Categoría del producto
 */
export function detectarCategoria(producto) {
  const nombre = String(producto || '').toLowerCase();
  
  for (const categoria of CATEGORIES) {
    if (categoria.verificar(nombre)) {
      return categoria.nombre;
    }
  }
  
  return 'Otros';
}

