# Guía de Instalación y Configuración

## Tabla de Contenidos

1. [Requisitos del Sistema](#requisitos-del-sistema)
2. [Instalación Paso a Paso](#instalación-paso-a-paso)
3. [Configuración de ERA5](#configuración-de-era5)
4. [Instalación con Docker](#instalación-con-docker)
5. [Instalación Manual](#instalación-manual)
6. [Configuración de Producción](#configuración-de-producción)
7. [Solución de Problemas](#solución-de-problemas)
8. [Mantenimiento](#mantenimiento)

## Requisitos del Sistema

### Requisitos Mínimos

- **Sistema Operativo**: Linux (Ubuntu 20.04+), macOS (10.15+), Windows 10+
- **RAM**: 4 GB mínimo, 8 GB recomendado
- **Almacenamiento**: 10 GB de espacio libre
- **Conexión a Internet**: Requerida para acceso a ERA5

### Software Requerido

#### Para Instalación con Docker (Recomendado)
- Docker 20.10+
- Docker Compose 2.0+

#### Para Instalación Manual
- Python 3.11+
- Node.js 20+
- npm 9+ o yarn 1.22+

### Cuenta ERA5/CDS

- Cuenta registrada en [Copernicus Climate Data Store](https://cds.climate.copernicus.eu)
- Token de API válido
- Aceptación de términos de uso de ERA5

## Instalación Paso a Paso

### Paso 1: Clonar el Repositorio

```bash
# Clonar desde GitHub
git clone https://github.com/tu-usuario/wind-analysis-caribbean.git
cd wind-analysis-caribbean

# Verificar contenido
ls -la
```

### Paso 2: Configurar Credenciales ERA5

#### 2.1 Registrarse en CDS

1. Ir a [https://cds.climate.copernicus.eu/user/register](https://cds.climate.copernicus.eu/user/register)
2. Completar el formulario de registro
3. Verificar email y activar cuenta
4. Iniciar sesión en el portal

#### 2.2 Obtener Token de API

1. Navegar a [https://cds.climate.copernicus.eu/how-to-api](https://cds.climate.copernicus.eu/how-to-api)
2. Copiar el User ID y API Key mostrados
3. Crear archivo de configuración:

```bash
# Linux/macOS
nano ~/.cdsapirc

# Windows
notepad %USERPROFILE%\.cdsapirc
```

#### 2.3 Configurar Archivo .cdsapirc

```ini
url: https://cds.climate.copernicus.eu/api
key: TU_USER_ID:TU_API_KEY
```

**Ejemplo:**
```ini
url: https://cds.climate.copernicus.eu/api
key: 12345:abcdef12-3456-7890-abcd-ef1234567890
```

#### 2.4 Aceptar Términos de Uso

1. Ir a [ERA5 hourly data](https://cds.climate.copernicus.eu/cdsapp#!/dataset/reanalysis-era5-single-levels)
2. Hacer clic en "Download data"
3. Aceptar los términos de uso al final del formulario

### Paso 3: Verificar Configuración

```bash
# Probar conexión con CDS API
python3 -c "
import cdsapi
c = cdsapi.Client()
print('✅ Conexión exitosa con CDS API')
"
```

## Configuración de ERA5

### Variables Disponibles

El sistema puede acceder a las siguientes variables de ERA5:

#### Viento
- `10m_u_component_of_wind`: Componente U del viento a 10m
- `10m_v_component_of_wind`: Componente V del viento a 10m
- `100m_u_component_of_wind`: Componente U del viento a 100m
- `100m_v_component_of_wind`: Componente V del viento a 100m

#### Presión y Temperatura
- `surface_pressure`: Presión atmosférica superficial
- `2m_temperature`: Temperatura a 2 metros

### Límites Geográficos

El sistema está optimizado para la región Caribe de Colombia:

- **Latitud**: 8°N a 16°N
- **Longitud**: 82°W a 70°W

### Resolución Temporal

- **Datos horarios**: Disponibles desde 1940 hasta presente
- **Actualización**: Datos en tiempo real con retraso de ~5 días

## Instalación con Docker

### Opción 1: Docker Compose (Recomendado)

```bash
# Construir y ejecutar todos los servicios
docker-compose up --build

# Ejecutar en segundo plano
docker-compose up -d --build

# Ver logs
docker-compose logs -f

# Detener servicios
docker-compose down
```

### Opción 2: Contenedores Individuales

#### Backend

```bash
# Construir imagen del backend
cd backend
docker build -t wind-analysis-backend .

# Ejecutar contenedor
docker run -d \
  --name wind-backend \
  -p 5000:5000 \
  -v ~/.cdsapirc:/root/.cdsapirc:ro \
  -v $(pwd)/temp:/app/temp \
  wind-analysis-backend
```

#### Frontend

```bash
# Construir imagen del frontend
cd frontend
docker build -t wind-analysis-frontend .

# Ejecutar contenedor
docker run -d \
  --name wind-frontend \
  -p 80:80 \
  --link wind-backend:backend \
  wind-analysis-frontend
```

### Verificación de Instalación Docker

```bash
# Verificar contenedores en ejecución
docker ps

# Probar backend
curl http://localhost:5000/api/caribbean-bounds

# Probar frontend
curl http://localhost/
```

## Instalación Manual

### Backend (Flask)

#### 1. Configurar Entorno Virtual

```bash
cd backend

# Crear entorno virtual
python3 -m venv venv

# Activar entorno virtual
# Linux/macOS:
source venv/bin/activate
# Windows:
venv\Scripts\activate
```

#### 2. Instalar Dependencias

```bash
# Actualizar pip
pip install --upgrade pip

# Instalar dependencias
pip install -r requirements.txt

# Verificar instalación
pip list
```

#### 3. Configurar Variables de Entorno

```bash
# Linux/macOS
export FLASK_APP=src/main.py
export FLASK_ENV=development
export PYTHONPATH=$(pwd)

# Windows
set FLASK_APP=src/main.py
set FLASK_ENV=development
set PYTHONPATH=%cd%
```

#### 4. Ejecutar Servidor

```bash
# Opción 1: Flask run
flask run --host=0.0.0.0 --port=5000

# Opción 2: Python directo
python src/main.py
```

### Frontend (React)

#### 1. Instalar Dependencias

```bash
cd frontend

# Con npm
npm install

# Con yarn (alternativo)
yarn install
```

#### 2. Configurar Variables de Entorno

```bash
# Crear archivo .env
echo "VITE_API_URL=http://localhost:5000/api" > .env
```

#### 3. Ejecutar Servidor de Desarrollo

```bash
# Con npm
npm run dev

# Con yarn
yarn dev

# Especificar host y puerto
npm run dev -- --host 0.0.0.0 --port 3000
```

### Verificación de Instalación Manual

```bash
# Probar backend
curl http://localhost:5000/api/caribbean-bounds

# Probar frontend (en navegador)
# http://localhost:3000
```

## Configuración de Producción

### 1. Variables de Entorno de Producción

#### Backend (.env)

```bash
FLASK_ENV=production
FLASK_DEBUG=False
SECRET_KEY=tu_clave_secreta_muy_segura
CDS_API_URL=https://cds.climate.copernicus.eu/api
CDS_API_KEY=tu_user_id:tu_api_key
CORS_ORIGINS=https://tu-dominio.com
LOG_LEVEL=INFO
```

#### Frontend (.env.production)

```bash
VITE_API_URL=https://api.tu-dominio.com
VITE_ENVIRONMENT=production
VITE_SENTRY_DSN=tu_sentry_dsn_opcional
```

### 2. Configuración de Nginx

```nginx
# /etc/nginx/sites-available/wind-analysis
server {
    listen 80;
    server_name tu-dominio.com www.tu-dominio.com;
    
    # Redirigir a HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name tu-dominio.com www.tu-dominio.com;
    
    # Certificados SSL
    ssl_certificate /path/to/certificate.crt;
    ssl_certificate_key /path/to/private.key;
    
    # Frontend estático
    location / {
        root /var/www/wind-analysis/frontend/dist;
        try_files $uri $uri/ /index.html;
        
        # Headers de seguridad
        add_header X-Frame-Options "SAMEORIGIN" always;
        add_header X-Content-Type-Options "nosniff" always;
        add_header X-XSS-Protection "1; mode=block" always;
    }
    
    # API Backend
    location /api/ {
        proxy_pass http://127.0.0.1:5000/api/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Timeouts para descargas de ERA5
        proxy_connect_timeout 300s;
        proxy_send_timeout 300s;
        proxy_read_timeout 300s;
    }
    
    # Archivos estáticos con caché
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
        root /var/www/wind-analysis/frontend/dist;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

### 3. Configuración de Systemd

#### Backend Service

```ini
# /etc/systemd/system/wind-analysis-backend.service
[Unit]
Description=Wind Analysis Backend
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/var/www/wind-analysis/backend
Environment=PATH=/var/www/wind-analysis/backend/venv/bin
Environment=FLASK_APP=src/main.py
Environment=FLASK_ENV=production
ExecStart=/var/www/wind-analysis/backend/venv/bin/python src/main.py
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

#### Habilitar y Iniciar Servicio

```bash
# Recargar systemd
sudo systemctl daemon-reload

# Habilitar servicio
sudo systemctl enable wind-analysis-backend

# Iniciar servicio
sudo systemctl start wind-analysis-backend

# Verificar estado
sudo systemctl status wind-analysis-backend
```

### 4. Configuración de Logs

#### Logrotate

```bash
# /etc/logrotate.d/wind-analysis
/var/log/wind-analysis/*.log {
    daily
    missingok
    rotate 52
    compress
    delaycompress
    notifempty
    create 644 www-data www-data
    postrotate
        systemctl reload wind-analysis-backend
    endscript
}
```

## Solución de Problemas

### Problemas Comunes

#### 1. Error de Conexión con CDS API

**Síntoma**: `cdsapi.api.ApiError: Authentication failed`

**Solución**:
```bash
# Verificar archivo .cdsapirc
cat ~/.cdsapirc

# Verificar permisos
chmod 600 ~/.cdsapirc

# Probar conexión
python3 -c "import cdsapi; c = cdsapi.Client(); print('OK')"
```

#### 2. Error de Instalación de Dependencias

**Síntoma**: `ERROR: Failed building wheel for package`

**Solución**:
```bash
# Actualizar herramientas de construcción
pip install --upgrade pip setuptools wheel

# Instalar dependencias del sistema (Ubuntu/Debian)
sudo apt-get update
sudo apt-get install python3-dev build-essential

# Instalar dependencias del sistema (CentOS/RHEL)
sudo yum groupinstall "Development Tools"
sudo yum install python3-devel
```

#### 3. Error de CORS en Frontend

**Síntoma**: `Access to fetch at 'http://localhost:5000' from origin 'http://localhost:3000' has been blocked by CORS policy`

**Solución**:
```python
# En backend/src/main.py
from flask_cors import CORS

app = Flask(__name__)
CORS(app, origins=['http://localhost:3000', 'http://localhost:5173'])
```

#### 4. Error de Memoria en Análisis

**Síntoma**: `MemoryError` durante procesamiento de datos

**Solución**:
```python
# Procesar datos en chunks más pequeños
def process_large_dataset(data, chunk_size=1000):
    for i in range(0, len(data), chunk_size):
        chunk = data[i:i+chunk_size]
        yield process_chunk(chunk)
```

### Logs de Depuración

#### Backend

```bash
# Ver logs en tiempo real
tail -f /var/log/wind-analysis/backend.log

# Buscar errores específicos
grep "ERROR" /var/log/wind-analysis/backend.log

# Logs de systemd
journalctl -u wind-analysis-backend -f
```

#### Frontend

```bash
# Logs de construcción
npm run build 2>&1 | tee build.log

# Logs de desarrollo
npm run dev 2>&1 | tee dev.log
```

### Herramientas de Diagnóstico

#### Script de Verificación

```bash
#!/bin/bash
# check_system.sh

echo "=== Verificación del Sistema ==="

# Verificar Python
python3 --version || echo "❌ Python no encontrado"

# Verificar Node.js
node --version || echo "❌ Node.js no encontrado"

# Verificar Docker
docker --version || echo "❌ Docker no encontrado"

# Verificar CDS API
python3 -c "
try:
    import cdsapi
    c = cdsapi.Client()
    print('✅ CDS API configurado correctamente')
except Exception as e:
    print(f'❌ Error CDS API: {e}')
"

# Verificar puertos
netstat -tlnp | grep -E ':(3000|5000|80|443)' || echo "❌ Puertos no disponibles"

echo "=== Verificación Completada ==="
```

## Mantenimiento

### Actualizaciones Regulares

#### 1. Actualizar Dependencias

```bash
# Backend
cd backend
source venv/bin/activate
pip list --outdated
pip install --upgrade package_name

# Frontend
cd frontend
npm outdated
npm update
```

#### 2. Actualizar Sistema

```bash
# Ubuntu/Debian
sudo apt update && sudo apt upgrade

# CentOS/RHEL
sudo yum update
```

### Backup y Restauración

#### 1. Backup de Configuración

```bash
#!/bin/bash
# backup.sh

DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/backups/wind_analysis_$DATE"

mkdir -p $BACKUP_DIR

# Configuración
cp ~/.cdsapirc $BACKUP_DIR/
cp -r /etc/nginx/sites-available/wind-analysis $BACKUP_DIR/
cp /etc/systemd/system/wind-analysis-backend.service $BACKUP_DIR/

# Código fuente
tar -czf $BACKUP_DIR/source_code.tar.gz /var/www/wind-analysis/

# Logs importantes
cp -r /var/log/wind-analysis/ $BACKUP_DIR/logs/

echo "Backup completado en $BACKUP_DIR"
```

#### 2. Restauración

```bash
#!/bin/bash
# restore.sh

BACKUP_DIR=$1

if [ -z "$BACKUP_DIR" ]; then
    echo "Uso: $0 /path/to/backup"
    exit 1
fi

# Restaurar configuración
cp $BACKUP_DIR/.cdsapirc ~/
cp $BACKUP_DIR/wind-analysis /etc/nginx/sites-available/
cp $BACKUP_DIR/wind-analysis-backend.service /etc/systemd/system/

# Restaurar código fuente
tar -xzf $BACKUP_DIR/source_code.tar.gz -C /

# Reiniciar servicios
sudo systemctl daemon-reload
sudo systemctl restart wind-analysis-backend
sudo systemctl reload nginx

echo "Restauración completada"
```

### Monitoreo de Rendimiento

#### 1. Script de Monitoreo

```bash
#!/bin/bash
# monitor.sh

while true; do
    echo "=== $(date) ==="
    
    # CPU y memoria
    top -bn1 | grep "wind-analysis" || echo "Proceso no encontrado"
    
    # Espacio en disco
    df -h /var/www/wind-analysis/
    
    # Estado del servicio
    systemctl is-active wind-analysis-backend
    
    # Logs recientes
    tail -n 5 /var/log/wind-analysis/backend.log
    
    echo "========================"
    sleep 300  # 5 minutos
done
```

#### 2. Alertas por Email

```bash
#!/bin/bash
# alerts.sh

SERVICE="wind-analysis-backend"
EMAIL="admin@tu-dominio.com"

if ! systemctl is-active --quiet $SERVICE; then
    echo "El servicio $SERVICE está inactivo" | mail -s "Alerta: Servicio Inactivo" $EMAIL
fi

# Verificar espacio en disco
DISK_USAGE=$(df /var/www/wind-analysis/ | awk 'NR==2 {print $5}' | sed 's/%//')
if [ $DISK_USAGE -gt 80 ]; then
    echo "Espacio en disco al $DISK_USAGE%" | mail -s "Alerta: Espacio en Disco" $EMAIL
fi
```

### Optimización de Rendimiento

#### 1. Configuración de Cache

```python
# Backend cache configuration
from flask_caching import Cache

cache = Cache(app, config={
    'CACHE_TYPE': 'redis',
    'CACHE_REDIS_URL': 'redis://localhost:6379/0',
    'CACHE_DEFAULT_TIMEOUT': 3600
})

@cache.memoize(timeout=3600)
def get_era5_data_cached(params):
    return get_era5_data(params)
```

#### 2. Optimización de Base de Datos

```bash
# Configurar Redis para cache
sudo apt install redis-server
sudo systemctl enable redis-server
sudo systemctl start redis-server

# Configurar en aplicación
pip install redis flask-caching
```

---

Esta guía de instalación proporciona instrucciones detalladas para configurar el sistema en diferentes entornos. Para soporte adicional, consultar la documentación técnica o contactar al equipo de desarrollo.

