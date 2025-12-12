# Sandos Report

Proyecto Node.js con interfaz web para leer y unir archivos Excel.

## Instalación Local

```bash
npm install
```

## Uso Local

1. Inicia el servidor:
```bash
npm start
```

2. Abre tu navegador en: `http://localhost:3000`

## Dockerización

### Construir y ejecutar con Docker

```bash
# Construir la imagen
docker build -t sandos-report .

# Ejecutar el contenedor
docker run -d -p 3000:3000 --name sandos-report sandos-report
```

### Usar Docker Compose (Recomendado)

```bash
# Construir y ejecutar
docker-compose up -d

# Ver logs
docker-compose logs -f

# Detener
docker-compose down
```

### Desplegar en VPS

1. **Subir los archivos al servidor:**
   ```bash
   scp -r . usuario@tu-vps:/ruta/destino/sandos-report
   ```

2. **Conectarse al VPS:**
   ```bash
   ssh usuario@tu-vps
   cd /ruta/destino/sandos-report
   ```

3. **Construir y ejecutar:**
   ```bash
   docker-compose up -d --build
   ```

4. **Configurar Nginx como proxy reverso (opcional):**
   ```nginx
   server {
       listen 80;
       server_name tu-dominio.com;

       location / {
           proxy_pass http://localhost:3000;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_cache_bypass $http_upgrade;
       }
   }
   ```

## Características

- ✅ Interfaz web moderna y responsive
- ✅ Carga de archivos por clic o arrastrar y soltar
- ✅ Barra de progreso visual
- ✅ Validación de tipos de archivo
- ✅ Información detallada de archivos cargados
- ✅ Procesamiento automático de archivos Excel
- ✅ Unión de archivos con búsqueda VLOOKUP
- ✅ Descarga automática del resultado

## Estructura

- `index.js` - Servidor Express con endpoints para cargar archivos
- `public/` - Frontend (HTML, CSS, JavaScript)
- `uploads/` - Archivos temporales cargados (se crea automáticamente)
- `Dockerfile` - Configuración de Docker
- `docker-compose.yml` - Orquestación de contenedores

## Dependencias

- `express` - Servidor web
- `multer` - Manejo de carga de archivos
- `xlsx` - Para leer archivos Excel
- `cors` - Habilitar CORS

## Variables de Entorno

- `PORT` - Puerto del servidor (por defecto: 3000)
- `NODE_ENV` - Entorno de ejecución (production/development)

