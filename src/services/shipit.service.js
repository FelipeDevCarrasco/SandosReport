import fetch from 'node-fetch';
import { SHIPIT_CONFIG } from '../config/constants.js';

/**
 * Obtiene información de una orden desde Shipit
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
      if (response.status === 404) {
        console.warn(`⚠️ Orden ${reference} no encontrada en Shipit`);
      } else {
        console.warn(`⚠️ Error ${response.status} al consultar orden ${reference}`);
      }
      return null;
    }
    
    const data = await response.json();
    const referenceBuscado = String(reference).replace(/^#/, '').trim();
    
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
      console.warn(`⚠️ No se encontró order con referencia exacta para ${reference}`);
      return { courier: '', estado: '' };
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
    console.error(`❌ Error al consultar orden ${reference}:`, error.message);
    return null;
  }
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
 * Obtiene la lista de ventas/órdenes desde Shipit (Orders API)
 * Muestra solo orders, no shipments, tal como en app.shipit.cl/orders
 */
export async function obtenerListaVentas(query = '', page = 1, per = 50) {
  const shipitEmail = process.env.SHIPIT_EMAIL;
  const shipitAccessToken = process.env.SHIPIT_ACCESS_TOKEN;

  if (!shipitEmail || !shipitAccessToken) {
    throw new Error('SHIPIT_EMAIL y SHIPIT_ACCESS_TOKEN deben estar configurados');
  }

  const headers = {
    'X-Shipit-Email': shipitEmail,
    'X-Shipit-Access-Token': shipitAccessToken,
    'Accept': 'application/vnd.orders.v1',
    'Content-Type': 'application/json'
  };

  const params = new URLSearchParams();
  params.set('state', 'confirmed');
  if (query.trim()) params.set('query', query.trim());
  params.set('page', page);
  params.set('per', per);

  const ordersUrl = `${SHIPIT_CONFIG.ORDERS_API}?${params.toString()}`;
  const ordersRes = await fetch(ordersUrl, { method: 'GET', headers });

  if (!ordersRes.ok) {
    const text = await ordersRes.text();
    throw new Error(`Error Orders Shipit ${ordersRes.status}: ${text}`);
  }

  const data = await ordersRes.json();
  const orders = data?.orders ?? (Array.isArray(data) ? data : []);
  const ventas = (Array.isArray(orders) ? orders : (orders?.data || [])).map(mapOrderToVenta);

  console.log(`[shipit] Orders API state=confirmed: ${ventas.length} ventas recibidas`);

  return {
    ventas,
    total: data?.total ?? ventas.length
  };
}

function mapShipmentToVenta(s) {
  const ref = s.reference ? (s.reference.startsWith('#') ? s.reference : `#${s.reference}`) : '';
  const state = mapEstado(s.status || s.courier_status);
  const created = s.created_at ? formatDate(s.created_at) : '';
  const address = s.address?.full || s.address?.street || '';
  const commune = s.address?.commune_name || '';
  return {
    estado: state,
    idVenta: ref,
    fechaCreacion: created,
    fechaIntegracion: created,
    canalVenta: s.origin?.name || s.seller?.name || 'sphinx',
    destinatario: s.full_name || s.destiny?.full_name || '',
    courier: s.courier_for_client || s.courier?.client || '',
    direccion: address,
    comuna: commune,
    tipoEntrega: s.destiny || 'Domicilio',
    reference: (s.reference || '').replace(/^#/, '')
  };
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
    canalVenta: o.seller?.name || 'sphinx',
    destinatario: destiny.full_name || '',
    courier: o.courier?.client || '',
    direccion: address,
    comuna: destiny.commune_name || '',
    tipoEntrega: destiny.kind === 'shopping_retired' ? 'Retiro' : 'Domicilio',
    reference: (o.reference || '').replace(/^#/, '')
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

