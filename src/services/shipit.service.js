import fetch from 'node-fetch';
import { SHIPIT_CONFIG } from '../config/constants.js';

/**
 * Obtiene información de una orden desde Shipit
 * Si no encuentra en Orders, busca en Shipments (envíos directos/manuales)
 */
export async function obtenerDatosShipit(reference) {
  try {
    const shipitEmail = process.env.SHIPIT_EMAIL;
    const shipitAccessToken = process.env.SHIPIT_ACCESS_TOKEN;
    
    if (!shipitEmail || !shipitAccessToken) {
      console.warn(`⚠️ Variables de entorno de Shipit no configuradas para referencia ${reference}`);
      return null;
    }
    
    const referenceParaURL = String(reference).replace(/^#/, '').trim();
    const referenceBuscado = referenceParaURL;
    
    const orderResult = await buscarEnOrders(referenceParaURL, referenceBuscado, shipitEmail, shipitAccessToken);
    if (orderResult && (orderResult.courier || orderResult.estado)) {
      return orderResult;
    }
    
    console.log(`🔍 No encontrado en Orders, buscando en Shipments: ${reference}`);
    const shipmentResult = await buscarEnShipments(referenceParaURL, referenceBuscado, shipitEmail, shipitAccessToken);
    if (shipmentResult && (shipmentResult.courier || shipmentResult.estado)) {
      console.log(`✅ Encontrado en Shipments: ${reference}`);
      return shipmentResult;
    }
    
    console.warn(`⚠️ No se encontró ${reference} ni en Orders ni en Shipments`);
    return { courier: '', estado: '' };
    
  } catch (error) {
    console.error(`❌ Error al consultar ${reference}:`, error.message);
    return null;
  }
}

async function buscarEnOrders(referenceParaURL, referenceBuscado, shipitEmail, shipitAccessToken) {
  try {
    const url = `${SHIPIT_CONFIG.ORDERS_API}?reference=${referenceParaURL}`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'X-Shipit-Email': shipitEmail,
        'X-Shipit-Access-Token': shipitAccessToken,
        'Accept': 'application/vnd.orders.v1'
      }
    });
    
    if (!response.ok) {
      return null;
    }
    
    const data = await response.json();
    let orderData = null;
    
    if (data && data.orders && Array.isArray(data.orders) && data.orders.length > 0) {
      orderData = data.orders.find(order => {
        const orderRef = String(order.reference || '').replace(/^#/, '').trim();
        return orderRef === referenceBuscado;
      });
    } else if (Array.isArray(data) && data.length > 0) {
      orderData = data.find(order => {
        const orderRef = String(order.reference || '').replace(/^#/, '').trim();
        return orderRef === referenceBuscado;
      });
    } else if (data && typeof data === 'object' && data.reference) {
      const orderRef = String(data.reference || '').replace(/^#/, '').trim();
      if (orderRef === referenceBuscado) {
        orderData = data;
      }
    }
    
    if (!orderData) {
      return null;
    }
    
    let courier = '';
    let estado = '';
    
    if (orderData.courier && orderData.courier.client) {
      courier = String(orderData.courier.client);
    }
    
    if (orderData.state) {
      const stateLower = String(orderData.state).toLowerCase();
      if (stateLower === 'deliver' || stateLower === 'delivered') {
        estado = 'Enviado';
      } else if (stateLower === 'confirmed' || stateLower === 'confirm') {
        estado = 'Listo para enviar';
      } else {
        estado = String(orderData.state);
      }
    }
    
    return { courier, estado };
  } catch (error) {
    return null;
  }
}

let shipmentsCache = null;
let shipmentsCacheTime = 0;
const CACHE_TTL = 60000;

async function buscarEnShipments(referenceParaURL, referenceBuscado, shipitEmail, shipitAccessToken) {
  try {
    const url = `${SHIPIT_CONFIG.SHIPMENTS_API}?reference=${referenceParaURL}`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'X-Shipit-Email': shipitEmail,
        'X-Shipit-Access-Token': shipitAccessToken,
        'Accept': 'application/vnd.shipit.v4',
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      return await buscarEnShipmentsRecientes(referenceBuscado, shipitEmail, shipitAccessToken);
    }
    
    const data = await response.json();
    let shipmentData = null;
    
    if (data && data.shipments && Array.isArray(data.shipments)) {
      shipmentData = data.shipments.find(shipment => {
        const shipmentRef = String(shipment.reference || '').replace(/^#/, '').trim();
        return shipmentRef === referenceBuscado;
      });
    } else if (Array.isArray(data) && data.length > 0) {
      shipmentData = data.find(shipment => {
        const shipmentRef = String(shipment.reference || '').replace(/^#/, '').trim();
        return shipmentRef === referenceBuscado;
      });
    }
    
    if (!shipmentData) {
      return await buscarEnShipmentsRecientes(referenceBuscado, shipitEmail, shipitAccessToken);
    }
    
    const courier = shipmentData.courier_for_client || '';
    const courierStatus = shipmentData.courier_status || '';
    const estado = courierStatus || mapEstadoShipmentStatus(shipmentData.status);
    
    return { courier, estado };
  } catch (error) {
    return null;
  }
}

async function buscarEnShipmentsRecientes(referenceBuscado, shipitEmail, shipitAccessToken) {
  try {
    const now = Date.now();
    if (shipmentsCache && (now - shipmentsCacheTime) < CACHE_TTL) {
      const shipmentData = shipmentsCache.find(s => {
        const ref = String(s.reference || '').replace(/^#/, '').trim();
        return ref === referenceBuscado;
      });
      if (shipmentData) {
        return {
          courier: shipmentData.courier_for_client || '',
          estado: shipmentData.courier_status || mapEstadoShipmentStatus(shipmentData.status)
        };
      }
      return null;
    }

    const url = `${SHIPIT_CONFIG.SHIPMENTS_API}?per=300&page=1`;
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'X-Shipit-Email': shipitEmail,
        'X-Shipit-Access-Token': shipitAccessToken,
        'Accept': 'application/vnd.shipit.v4',
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) return null;

    const data = await response.json();
    const shipments = data?.shipments || [];
    
    shipmentsCache = shipments;
    shipmentsCacheTime = now;

    const shipmentData = shipments.find(s => {
      const ref = String(s.reference || '').replace(/^#/, '').trim();
      return ref === referenceBuscado;
    });

    if (!shipmentData) return null;

    return {
      courier: shipmentData.courier_for_client || '',
      estado: shipmentData.courier_status || mapEstadoShipmentStatus(shipmentData.status)
    };
  } catch (error) {
    return null;
  }
}

function mapEstadoShipmentStatus(status) {
  if (!status) return '';
  const s = String(status).toLowerCase();
  if (s.includes('deliver')) return 'Entregado';
  if (s.includes('transit')) return 'En tránsito';
  if (s.includes('preparation')) return 'En preparación';
  return status;
}

/**
 * Obtiene información de un shipment desde Shipit
 */
export async function obtenerDatosShipment(reference) {
  try {
    const shipitEmail = process.env.SHIPIT_EMAIL;
    const shipitAccessToken = process.env.SHIPIT_ACCESS_TOKEN;
    
    if (!shipitEmail || !shipitAccessToken) {
      console.warn(`⚠️ Variables de entorno de Shipit no configuradas para referencia ${reference}`);
      return null;
    }
    
    const referenceParaURL = String(reference).replace(/^#/, '').trim();
    const url = `${SHIPIT_CONFIG.SHIPMENTS_API}?reference=${referenceParaURL}`;
    
    console.log(`🔍 Consultando shipments para referencia: ${reference} (URL: ${referenceParaURL})`);
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'X-Shipit-Email': shipitEmail,
        'X-Shipit-Access-Token': shipitAccessToken,
        'Accept': 'application/vnd.shipit.v4',
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      if (response.status === 404) {
        console.warn(`⚠️ Shipment ${reference} no encontrado en Shipit (404)`);
      } else {
        console.warn(`⚠️ Error ${response.status} al consultar shipment ${reference}`);
      }
      return { courier_status: 'Envio No Solicitado' };
    }
    
    const data = await response.json();
    const referenceBuscado = String(reference).replace(/^#/, '').trim();
    
    let shipmentData = null;
    
    if (data && data.shipments && Array.isArray(data.shipments)) {
      shipmentData = data.shipments.find(shipment => {
        const shipmentRef = String(shipment.reference || '').replace(/^#/, '').trim();
        return shipmentRef === referenceBuscado;
      });
    } else if (Array.isArray(data) && data.length > 0) {
      shipmentData = data.find(shipment => {
        const shipmentRef = String(shipment.reference || '').replace(/^#/, '').trim();
        return shipmentRef === referenceBuscado;
      });
    } else if (data && typeof data === 'object' && data.reference) {
      const shipmentRef = String(data.reference || '').replace(/^#/, '').trim();
      if (shipmentRef === referenceBuscado) {
        shipmentData = data;
      }
    }
    
    if (!shipmentData) {
      return { courier_status: 'Envio No Solicitado' };
    }
    
    let courierStatus = '';
    
    if (shipmentData.courier_status) {
      courierStatus = String(shipmentData.courier_status);
    } else {
      courierStatus = 'Envio No Solicitado';
    }
    
    return { courier_status: courierStatus };
  } catch (error) {
    console.error(`❌ Error al consultar shipment ${reference}:`, error.message);
    return { courier_status: 'Envio No Solicitado' };
  }
}

/**
 * Procesa múltiples pedidos en lotes
 */
export async function procesarPedidosEnLotes(pedidosUnicos) {
  const mapaShipit = {};
  const { BATCH_SIZE } = SHIPIT_CONFIG;
  
  for (let i = 0; i < pedidosUnicos.length; i += BATCH_SIZE) {
    const batch = pedidosUnicos.slice(i, i + BATCH_SIZE);
    const promesas = batch.map(async (pedido) => {
      const [datosOrder, datosShipment] = await Promise.all([
        obtenerDatosShipit(pedido),
        obtenerDatosShipment(pedido)
      ]);
      
      const datosCombinados = {
        courier: datosOrder?.courier || '',
        estado: datosOrder?.estado || '',
        courier_status: datosShipment?.courier_status || 'Envio No Solicitado'
      };
      
      return { pedido, datos: datosCombinados };
    });
    
    const resultados = await Promise.all(promesas);
    resultados.forEach(({ pedido, datos }) => {
      if (datos && typeof datos === 'object') {
        mapaShipit[pedido] = datos;
      } else {
        mapaShipit[pedido] = { courier: '', estado: '', courier_status: '' };
      }
    });
    
    console.log(`✅ Procesados ${Math.min(i + BATCH_SIZE, pedidosUnicos.length)}/${pedidosUnicos.length} pedidos`);
  }
  
  return mapaShipit;
}

/**
 * Obtiene la lista de ventas (orders) y envíos (shipments) desde Shipit
 * Combina ambas fuentes y elimina duplicados por referencia
 * @param {string} query - Búsqueda por referencia/destinatario
 * @param {number} page - Página (1-indexed)
 * @param {number} per - Resultados por página
 * @param {string} fechaDesde - Fecha desde (YYYY-MM-DD)
 * @param {string} fechaHasta - Fecha hasta (YYYY-MM-DD)
 * @param {boolean} fetchAll - Si es true, obtiene todos los resultados (para reportes)
 */
export async function obtenerListaVentas(query = '', page = 1, per = 50, fechaDesde = '', fechaHasta = '', fetchAll = false) {
  const shipitEmail = process.env.SHIPIT_EMAIL;
  const shipitAccessToken = process.env.SHIPIT_ACCESS_TOKEN;

  if (!shipitEmail || !shipitAccessToken) {
    throw new Error('SHIPIT_EMAIL y SHIPIT_ACCESS_TOKEN deben estar configurados');
  }

  const headersOrders = {
    'X-Shipit-Email': shipitEmail,
    'X-Shipit-Access-Token': shipitAccessToken,
    'Accept': 'application/vnd.orders.v1',
    'Content-Type': 'application/json'
  };

  const headersShipments = {
    'X-Shipit-Email': shipitEmail,
    'X-Shipit-Access-Token': shipitAccessToken,
    'Accept': 'application/vnd.shipit.v4',
    'Content-Type': 'application/json'
  };

  const perValue = fetchAll ? 500 : per;
  const pageValue = fetchAll ? 1 : page;

  const ordersParams = new URLSearchParams();
  ordersParams.set('state', 'confirmed');
  if (query.trim()) ordersParams.set('query', query.trim());
  ordersParams.set('page', pageValue);
  ordersParams.set('per', perValue);

  const shipmentsParams = new URLSearchParams();
  if (query.trim()) shipmentsParams.set('q', query.trim());
  shipmentsParams.set('page', pageValue);
  shipmentsParams.set('per', perValue);

  const ordersUrl = `${SHIPIT_CONFIG.ORDERS_API}?${ordersParams.toString()}`;
  const shipmentsUrl = `${SHIPIT_CONFIG.SHIPMENTS_API}?${shipmentsParams.toString()}`;

  const [ordersRes, shipmentsRes] = await Promise.all([
    fetch(ordersUrl, { method: 'GET', headers: headersOrders }),
    fetch(shipmentsUrl, { method: 'GET', headers: headersShipments })
  ]);

  let ventas = [];
  let envios = [];

  if (ordersRes.ok) {
    const data = await ordersRes.json();
    const orders = data?.orders ?? (Array.isArray(data) ? data : []);
    ventas = (Array.isArray(orders) ? orders : (orders?.data || [])).map(mapOrderToVenta);
    console.log(`[shipit] Orders API: ${ventas.length} ventas`);
  } else {
    console.warn(`[shipit] Error Orders API: ${ordersRes.status}`);
  }

  if (shipmentsRes.ok) {
    const data = await shipmentsRes.json();
    const shipments = data?.shipments ?? (Array.isArray(data) ? data : []);
    envios = (Array.isArray(shipments) ? shipments : []).map(mapShipmentToVenta);
    console.log(`[shipit] Shipments API: ${envios.length} envíos`);
  } else {
    console.warn(`[shipit] Error Shipments API: ${shipmentsRes.status}`);
  }

  const referenciasProcesadas = new Set();
  const resultados = [];

  for (const item of [...envios, ...ventas]) {
    const ref = item.reference || '';
    if (ref && referenciasProcesadas.has(ref)) continue;
    if (ref) referenciasProcesadas.add(ref);
    resultados.push(item);
  }

  let filtrados = resultados;

  if (fechaDesde || fechaHasta) {
    const desde = fechaDesde ? new Date(fechaDesde + 'T00:00:00') : null;
    const hasta = fechaHasta ? new Date(fechaHasta + 'T23:59:59') : null;

    filtrados = resultados.filter((v) => {
      if (!v.fechaOriginal) return false;
      const fechaVenta = new Date(v.fechaOriginal);
      if (desde && fechaVenta < desde) return false;
      if (hasta && fechaVenta > hasta) return false;
      return true;
    });

    console.log(`[shipit] Filtrado por fechas (${fechaDesde} - ${fechaHasta}): ${filtrados.length} resultados`);
  }

  const estadosPendientes = [
    'en preparación',
    'preparación',
    'preparacion',
    'solicitado',
    'listo para enviar',
    'listo',
    'confirmado',
    'confirmed',
    'pending',
    'pendiente'
  ];

  filtrados = filtrados.filter((v) => {
    const estado = (v.estado || '').toLowerCase();
    return estadosPendientes.some(ep => estado.includes(ep));
  });

  console.log(`[shipit] Filtrado por estados pendientes: ${filtrados.length} resultados`);

  filtrados.sort((a, b) => {
    const fechaA = a.fechaOriginal ? new Date(a.fechaOriginal) : new Date(0);
    const fechaB = b.fechaOriginal ? new Date(b.fechaOriginal) : new Date(0);
    return fechaB - fechaA;
  });

  const totalFiltrados = filtrados.length;
  
  if (!fetchAll) {
    const startIndex = (page - 1) * per;
    const endIndex = startIndex + per;
    filtrados = filtrados.slice(startIndex, endIndex);
  }

  console.log(`[shipit] Total combinado: ${totalFiltrados} (mostrando ${filtrados.length})`);

  return {
    ventas: filtrados,
    total: totalFiltrados,
    page,
    per: fetchAll ? totalFiltrados : per,
    hasMore: !fetchAll && (page * per < totalFiltrados)
  };
}

function mapShipmentToVenta(s) {
  const ref = s.reference ? (s.reference.startsWith('#') ? s.reference : `#${s.reference}`) : '';
  const state = mapEstadoShipment(s);
  const createdRaw = s.created_at || '';
  const created = createdRaw ? formatDate(createdRaw) : '';
  const address = s.address?.full || s.address?.street || '';
  const commune = s.address?.commune_name || '';
  return {
    estado: state,
    idVenta: ref,
    fechaCreacion: created,
    fechaIntegracion: created,
    fechaOriginal: createdRaw,
    canalVenta: s.origin?.name || s.seller?.name || 'sphinx',
    destinatario: s.full_name || s.destiny?.full_name || '',
    courier: s.courier_for_client || s.courier?.client || '',
    direccion: address,
    comuna: commune,
    tipoEntrega: s.destiny || 'Domicilio',
    reference: (s.reference || '').replace(/^#/, ''),
    tipo: 'envio'
  };
}

function mapEstadoShipment(s) {
  const courierStatus = s.courier_status || '';
  const status = s.status || '';
  
  if (courierStatus) {
    const cs = String(courierStatus).toLowerCase();
    if (cs.includes('entreg') || cs.includes('deliver')) return 'Entregado';
    if (cs.includes('reparto') || cs.includes('distribution')) return 'En reparto';
    if (cs.includes('transit') || cs.includes('tránsito') || cs.includes('camino')) return 'En tránsito';
    if (cs.includes('bodega') || cs.includes('sucursal') || cs.includes('oficina')) return 'En sucursal';
    if (cs.includes('retirar')) return 'Listo para retiro';
    if (cs.includes('devuel') || cs.includes('return')) return 'Devuelto';
    if (cs.includes('cancel')) return 'Cancelado';
    if (cs.includes('problem') || cs.includes('incidencia') || cs.includes('excep')) return 'Con incidencia';
    return courierStatus;
  }
  
  if (status) {
    return mapEstado(status);
  }
  
  return 'Enviado';
}

function mapOrderToVenta(o) {
  const ref = o.reference ? (o.reference.startsWith('#') ? o.reference : `#${o.reference}`) : '';
  const state = mapEstadoOrden(o.state);
  const created = o.state_track?.confirmed || o.created_at || o.seller?.created_at || '';
  const destiny = o.destiny || {};
  const address = destiny.street && destiny.number
    ? `${(destiny.street || '').toUpperCase()} ${destiny.number}${destiny.complement ? ', ' + destiny.complement : ''}`
    : destiny.full || '';
  return {
    estado: state,
    idVenta: ref,
    fechaCreacion: formatDate(created),
    fechaIntegracion: formatDate(created),
    fechaOriginal: created,
    canalVenta: o.seller?.name || 'sphinx',
    destinatario: destiny.full_name || '',
    courier: o.courier?.client || '',
    direccion: address,
    comuna: destiny.commune_name || '',
    tipoEntrega: destiny.kind === 'shopping_retired' ? 'Retiro' : 'Domicilio',
    reference: (o.reference || '').replace(/^#/, ''),
    tipo: 'venta'
  };
}

function mapEstado(status) {
  if (!status) return '';
  const s = String(status).toLowerCase();
  if (s.includes('cancel') || s === 'canceled') return 'Cancelada';
  if (s.includes('deliver') || s.includes('entreg')) return 'Entregado';
  if (s.includes('confirm') || s.includes('prepar')) return 'Listo para enviar';
  if (s.includes('transit') || s.includes('tránsito')) return 'En tránsito';
  return status;
}

function mapEstadoOrden(state) {
  if (!state) return '';
  const s = String(state).toLowerCase();
  if (s === 'canceled' || s === 'cancelled' || s === '3') return 'Cancelada';
  if (s === 'deliver' || s === 'delivered' || s === '2') return 'Enviado';
  if (s === 'confirmed' || s === 'confirm' || s === '1') return 'Listo para enviar';
  if (s === 'draft' || s === '0') return 'Borrador';
  return state;
}

function formatDate(str) {
  if (!str) return '';
  try {
    const d = new Date(str);
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  } catch {
    return str;
  }
}

