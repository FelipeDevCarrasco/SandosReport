export const CATEGORIES = [
  {
    nombre: 'Tarjetas Gráficas',
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
    verificar: (n) => {
      if (n.includes('placa madre') || n.includes('placa base') || 
          n.includes('motherboard') || n.includes('mainboard') ||
          n.includes('tarjeta gráfica') || n.includes('tarjeta de video') ||
          n.includes('gpu') || n.includes('geforce') || n.includes('radeon')) {
        return false;
      }
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

export const CATEGORY_ORDER = [
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

export const EXCEL_CONFIG = {
  ALLOWED_TYPES: ['.xlsx', '.xls'],
  MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB
  SPHINX_ROWS_TO_SKIP: 5,
  SPHINX_COLUMNS: ['Doc', 'D_cantidad', 'Codigo', 'D_descripcion'],
  VALUES_TO_REMOVE: ['BVE Pend', 'BVE Nula'],
  VALUES_TO_REMOVE_CONTAINS: ['NCE', 'GDE']
};

export const SHIPIT_CONFIG = {
  BATCH_SIZE: 10,
  ORDERS_API: 'https://orders.shipit.cl/v/orders',
  SHIPMENTS_API: 'https://api.shipit.cl/v/shipments',
  SEARCH_API: 'https://api.shipit.cl/v/searchs'
};

export const SPHINX_CONFIG = {
  BASE_URL: 'https://sandos.sphinx.cl',
  REPORTE_SERVICE: '/Documento$reporte.service',
  DEFAULT_ID_TIPO: '70', // Tipo documento factura
  DEFAULT_ID_TIPO_BOLETA: '74', // Tipo documento boleta
  DEFAULT_ID_SUCURSAL: '1',
};

