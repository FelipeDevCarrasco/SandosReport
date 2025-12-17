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

### Desplegar en Servidor Clouding (187.33.154.42)

#### Paso 1: Conectarse al servidor por SSH

```bash
# Conectarse al servidor Clouding
ssh root@187.33.154.42

# Te pedirá la contraseña (la que aparece en el panel de Clouding)
# Si es la primera vez, también te pedirá confirmar la conexión (escribe "yes")
```

#### Paso 2: Preparar el servidor (primera vez)

Una vez conectado al servidor, instala las dependencias necesarias:

```bash
# Actualizar el sistema
sudo apt update && sudo apt upgrade -y

# Instalar Docker y Docker Compose (si no están instalados)
sudo apt install -y docker.io docker-compose

# Agregar tu usuario al grupo docker (opcional, para no usar sudo)
sudo usermod -aG docker $USER
# Luego cierra sesión y vuelve a conectarte para que tome efecto
```

#### Paso 3: Subir los archivos del proyecto

Desde tu máquina local, sube los archivos al servidor:

```bash
# Desde tu máquina local, en el directorio del proyecto
# Excluir node_modules y otros archivos innecesarios
rsync -avz --exclude 'node_modules' --exclude '.git' --exclude 'uploads/*' \
  ./ root@187.33.154.42:/root/sandos-report/

# O usando scp (más simple pero más lento)
scp -r . root@187.33.154.42:/root/sandos-report/
```

**Alternativa:** Si prefieres usar Git:

```bash
# En el servidor
cd /root
git clone tu-repositorio-url sandos-report
cd sandos-report
```

#### Paso 4: Desplegar la aplicación

Conectado al servidor:

```bash
# Ir al directorio del proyecto
cd /root/sandos-report

# Construir y ejecutar con Docker Compose
docker-compose up -d --build

# Ver los logs para verificar que todo funciona
docker-compose logs -f
```

#### Paso 5: Verificar que la aplicación está corriendo

```bash
# Verificar que el contenedor está corriendo
docker ps

# Verificar que el puerto está escuchando
sudo netstat -tlnp | grep 3000
# o
sudo ss -tlnp | grep 3000
```

#### Paso 6: Acceder a la aplicación

La aplicación estará disponible en:
- `http://187.33.154.42:3000`

#### Solución de problemas de conexión

Si la conexión se demora mucho o no puedes acceder, sigue estos pasos de diagnóstico:

**1. Verificar que el contenedor está corriendo:**
```bash
# Conectado al servidor
docker ps
# Deberías ver un contenedor llamado "sandos-report" con estado "Up"
```

**2. Verificar los logs de la aplicación:**
```bash
docker-compose logs -f
# Presiona Ctrl+C para salir
# Busca errores o mensajes que indiquen problemas
```

**3. Verificar que el puerto 3000 está escuchando:**
```bash
sudo ss -tlnp | grep 3000
# Deberías ver algo como: LISTEN 0 4096 *:3000
```

**4. Verificar el firewall (MUY IMPORTANTE):**
```bash
# Verificar si UFW está activo
sudo ufw status

# Si está activo, abrir el puerto 3000
sudo ufw allow 3000/tcp
sudo ufw reload

# Verificar reglas de iptables
sudo iptables -L -n | grep 3000
```

**5. Verificar desde el servidor que la app responde localmente:**
```bash
# Probar desde dentro del servidor
curl http://localhost:3000
# Deberías ver el HTML de la aplicación

# O probar desde el contenedor
docker exec sandos-report curl http://localhost:3000
```

**6. Verificar que Docker está mapeando el puerto correctamente:**
```bash
docker port sandos-report
# Deberías ver: 3000/tcp -> 0.0.0.0:3000
```

**7. Si el contenedor no está corriendo, reiniciarlo:**
```bash
cd /root/sandos-report
docker-compose down
docker-compose up -d --build
docker-compose logs -f
```

**8. Verificar reglas de firewall en Clouding:**
- Ve al panel de Clouding
- Revisa las reglas de firewall/seguridad
- Asegúrate de que el puerto 3000 TCP esté permitido para tráfico entrante

**9. Probar conexión desde tu máquina local:**
```bash
# Desde tu máquina local
curl -v http://187.33.154.42:3000
# O con timeout
timeout 5 curl http://187.33.154.42:3000
```

**Problemas comunes:**
- **Timeout/No responde:** Generalmente es el firewall bloqueando el puerto
- **Connection refused:** La aplicación no está corriendo o el puerto no está mapeado
- **Muy lento:** Puede ser problema de red o el servidor está sobrecargado

#### Comandos útiles para gestión

```bash
# Ver logs en tiempo real
docker-compose logs -f

# Detener la aplicación
docker-compose down

# Reiniciar la aplicación
docker-compose restart

# Ver el estado
docker-compose ps

# Reconstruir después de cambios
docker-compose up -d --build
```

#### Configurar firewall (si es necesario)

Si no puedes acceder desde fuera, puede que necesites abrir el puerto:

```bash
# Con UFW (si está instalado)
sudo ufw allow 3000/tcp
sudo ufw reload

# O con iptables
sudo iptables -A INPUT -p tcp --dport 3000 -j ACCEPT
```

#### Configurar Nginx como proxy reverso (Recomendado para producción)

Si quieres usar un dominio y HTTPS:

```bash
# Instalar Nginx
sudo apt install -y nginx

# Crear configuración
sudo nano /etc/nginx/sites-available/sandos-report
```

Contenido del archivo de configuración:

```nginx
server {
    listen 80;
    server_name tu-dominio.com;  # o 187.33.154.42

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Activar la configuración:

```bash
sudo ln -s /etc/nginx/sites-available/sandos-report /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
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
- `dotenv` - Manejo de variables de entorno
- `node-fetch` - Cliente HTTP para consumir APIs externas

## API Endpoints

### Endpoints de archivos

- `POST /api/upload/file1` - Cargar y procesar archivo de Sphinx
- `GET /api/status` - Obtener estado de los archivos cargados
- `GET /api/download/processed` - Descargar archivo procesado
- `GET /api/merge` - Procesar y descargar archivo con resumen

### Endpoints de Shipit

- `GET /api/shipit/order/:reference` - Obtener información de una orden desde Shipit

**Ejemplo de uso:**
```bash
curl http://localhost:3000/api/shipit/order/15744
```

Este endpoint requiere que las variables de entorno `SHIPIT_EMAIL` y `SHIPIT_ACCESS_TOKEN` estén configuradas.

## Variables de Entorno

Crea un archivo `.env` en la raíz del proyecto con las siguientes variables:

```env
PORT=3000
SHIPIT_EMAIL=tu_email@ejemplo.com
SHIPIT_ACCESS_TOKEN=tu_access_token_aqui
```

### Variables disponibles:

- `PORT` - Puerto del servidor (por defecto: 3000)
- `NODE_ENV` - Entorno de ejecución (production/development)
- `SHIPIT_EMAIL` - Email para autenticación en la API de Shipit
- `SHIPIT_ACCESS_TOKEN` - Token de acceso para la API de Shipit

### Configuración con Docker

Cuando uses Docker Compose, el archivo `.env` se cargará automáticamente. Asegúrate de crear el archivo `.env` antes de ejecutar `docker-compose up`.

**Importante:** El archivo `.env` está en `.gitignore` y no se subirá al repositorio. Crea un archivo `.env.example` como plantilla si lo necesitas.

