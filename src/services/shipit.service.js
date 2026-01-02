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

