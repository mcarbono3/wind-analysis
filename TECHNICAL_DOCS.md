# Documentación Técnica - Sistema de Análisis Eólico

## Tabla de Contenidos

1. [Arquitectura del Sistema](#arquitectura-del-sistema)
2. [Módulos del Backend](#módulos-del-backend)
3. [Componentes del Frontend](#componentes-del-frontend)
4. [Algoritmos y Metodología](#algoritmos-y-metodología)
5. [Base de Datos y APIs](#base-de-datos-y-apis)
6. [Modelo de Inteligencia Artificial](#modelo-de-inteligencia-artificial)
7. [Optimización y Rendimiento](#optimización-y-rendimiento)
8. [Despliegue y Configuración](#despliegue-y-configuración)

## Arquitectura del Sistema

### Visión General

El sistema está diseñado siguiendo una arquitectura de microservicios con separación clara entre frontend y backend. Esta arquitectura permite escalabilidad, mantenibilidad y facilita el desarrollo independiente de cada componente.

### Componentes Principales

#### 1. Frontend (React)
- **Tecnología**: React 18 con Vite
- **Responsabilidades**: 
  - Interfaz de usuario interactiva
  - Visualización de mapas con Leaflet
  - Gráficos y dashboards
  - Gestión de estado de la aplicación

#### 2. Backend (Flask)
- **Tecnología**: Flask con Python 3.11
- **Responsabilidades**:
  - API REST para comunicación con frontend
  - Procesamiento de datos meteorológicos
  - Análisis estadístico y machine learning
  - Integración con ERA5/ECMWF
  - Generación de reportes

#### 3. Servicios Externos
- **ERA5 ECMWF**: Fuente de datos meteorológicos
- **CDS API**: Interfaz para acceso a datos

### Flujo de Datos

```
Usuario → Frontend → Backend API → CDS API → ERA5 Database
                ↓
            Procesamiento
                ↓
        Análisis Estadístico
                ↓
           Modelo de IA
                ↓
         Resultados → Frontend → Usuario
```

## Módulos del Backend

### 1. Módulo Principal (`main.py`)

Configuración central de la aplicación Flask con registro de blueprints y configuración de CORS.

```python
from flask import Flask
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

# Registro de blueprints
app.register_blueprint(era5_bp, url_prefix='/api')
app.register_blueprint(analysis_bp, url_prefix='/api')
app.register_blueprint(ai_bp, url_prefix='/api')
app.register_blueprint(export_bp, url_prefix='/api')
```

### 2. Módulo ERA5 (`routes/era5.py`)

Gestiona la comunicación con la API de Copernicus Climate Data Store para obtener datos meteorológicos.

**Endpoints principales:**
- `GET /api/caribbean-bounds`: Límites geográficos de la región
- `POST /api/era5-data`: Descarga de datos meteorológicos
- `GET /api/available-variables`: Variables disponibles

**Funcionalidades:**
- Validación de parámetros de entrada
- Construcción de consultas CDS
- Procesamiento de archivos NetCDF
- Extracción de series temporales

### 3. Módulo de Análisis (`routes/analysis.py`)

Implementa algoritmos de análisis estadístico para caracterización del recurso eólico.

**Endpoints principales:**
- `POST /api/wind-analysis`: Análisis estadístico básico
- `POST /api/weibull-analysis`: Ajuste de distribución de Weibull
- `POST /api/turbulence-analysis`: Análisis de turbulencia
- `POST /api/power-density`: Cálculo de densidad de potencia

### 4. Módulo de IA (`routes/ai.py`)

Integra el modelo de machine learning para diagnóstico automático.

**Endpoints principales:**
- `POST /api/ai-diagnosis`: Diagnóstico automático
- `GET /api/ai-model-info`: Información del modelo
- `POST /api/predict-batch`: Predicciones en lote

### 5. Módulo de Exportación (`routes/export.py`)

Genera reportes y exporta datos en diferentes formatos.

**Endpoints principales:**
- `POST /api/export-csv`: Exportación a CSV
- `POST /api/generate-pdf-report`: Generación de reportes PDF
- `GET /api/export-formats`: Formatos disponibles

## Componentes del Frontend

### 1. Componente Principal (`App.jsx`)

Gestiona el estado global de la aplicación y la navegación entre pestañas.

```jsx
const [activeTab, setActiveTab] = useState('selection');
const [selectedArea, setSelectedArea] = useState(null);
const [analysisConfig, setAnalysisConfig] = useState({});
const [results, setResults] = useState(null);
```

### 2. Selector de Mapas (`MapSelector`)

Implementa la funcionalidad de selección de áreas geográficas usando Leaflet.

**Características:**
- Selección rectangular por arrastre
- Visualización de coordenadas en tiempo real
- Validación de límites geográficos
- Integración con OpenStreetMap

### 3. Panel de Configuración (`ConfigurationPanel`)

Permite al usuario configurar parámetros del análisis.

**Controles:**
- Selector de fechas
- Checkboxes para variables meteorológicas
- Configuración de análisis avanzados

### 4. Panel de Resultados (`ResultsPanel`)

Muestra los resultados del análisis con visualizaciones interactivas.

**Elementos:**
- Métricas clave en tarjetas
- Gráficos con Recharts
- Diagnóstico de IA
- Opciones de exportación

## Algoritmos y Metodología

### 1. Análisis Estadístico Básico

Implementado en `services/wind_analysis.py`:

```python
def calculate_basic_statistics(wind_speeds):
    return {
        'mean': np.mean(wind_speeds),
        'median': np.median(wind_speeds),
        'std': np.std(wind_speeds),
        'min': np.min(wind_speeds),
        'max': np.max(wind_speeds),
        'percentile_90': np.percentile(wind_speeds, 90),
        'percentile_95': np.percentile(wind_speeds, 95)
    }
```

### 2. Ajuste de Distribución de Weibull

Utiliza el método de máxima verosimilitud para ajustar la distribución:

```python
from scipy import stats

def fit_weibull_distribution(wind_speeds):
    # Filtrar valores válidos
    valid_speeds = wind_speeds[wind_speeds > 0]
    
    # Ajuste por máxima verosimilitud
    shape, loc, scale = stats.weibull_min.fit(valid_speeds, floc=0)
    
    return {
        'k': shape,  # Parámetro de forma
        'c': scale,  # Parámetro de escala
        'location': loc
    }
```

### 3. Análisis de Turbulencia

Calcula el índice de turbulencia por rangos de velocidad:

```python
def calculate_turbulence_intensity(wind_speeds):
    # TI = σ / μ
    mean_speed = np.mean(wind_speeds)
    std_speed = np.std(wind_speeds)
    
    turbulence_intensity = std_speed / mean_speed if mean_speed > 0 else 0
    
    # Clasificación según IEC 61400-1
    if turbulence_intensity < 0.12:
        classification = "Baja"
    elif turbulence_intensity < 0.18:
        classification = "Moderada"
    else:
        classification = "Alta"
    
    return {
        'turbulence_intensity': turbulence_intensity,
        'classification': classification
    }
```

### 4. Densidad de Potencia

Calcula la densidad de potencia eólica disponible:

```python
def calculate_power_density(wind_speeds, air_density=1.225):
    # P = 0.5 * ρ * v³
    power_densities = 0.5 * air_density * np.power(wind_speeds, 3)
    
    return {
        'mean_power_density': np.mean(power_densities),
        'median_power_density': np.median(power_densities),
        'max_power_density': np.max(power_densities)
    }
```

### 5. Factor de Capacidad

Estima el factor de capacidad usando una curva de potencia estándar:

```python
def calculate_capacity_factor(wind_speeds, rated_power=2000):
    # Curva de potencia simplificada
    cut_in = 3.0   # m/s
    rated_speed = 12.0  # m/s
    cut_out = 25.0  # m/s
    
    power_output = []
    for speed in wind_speeds:
        if speed < cut_in or speed > cut_out:
            power = 0
        elif speed < rated_speed:
            # Curva cúbica hasta velocidad nominal
            power = rated_power * ((speed - cut_in) / (rated_speed - cut_in)) ** 3
        else:
            power = rated_power
        
        power_output.append(power)
    
    capacity_factor = np.mean(power_output) / rated_power * 100
    
    return {
        'capacity_factor': capacity_factor,
        'mean_power_output': np.mean(power_output),
        'annual_energy_production': np.mean(power_output) * 8760  # kWh/año
    }
```

## Base de Datos y APIs

### 1. Integración con ERA5

El sistema utiliza la API de Copernicus Climate Data Store para acceder a datos ERA5:

```python
import cdsapi

def download_era5_data(lat_min, lat_max, lon_min, lon_max, start_date, end_date, variables):
    c = cdsapi.Client()
    
    request = {
        'product_type': 'reanalysis',
        'format': 'netcdf',
        'variable': variables,
        'date': f'{start_date}/{end_date}',
        'time': [f'{hour:02d}:00' for hour in range(24)],
        'area': [lat_max, lon_min, lat_min, lon_max],
    }
    
    c.retrieve('reanalysis-era5-single-levels', request, 'output.nc')
```

### 2. Procesamiento de Datos NetCDF

Utiliza xarray para procesar archivos NetCDF:

```python
import xarray as xr

def process_netcdf_data(filepath):
    ds = xr.open_dataset(filepath)
    
    # Extraer componentes de viento
    u_wind = ds['u10'].values  # Componente U a 10m
    v_wind = ds['v10'].values  # Componente V a 10m
    
    # Calcular velocidad del viento
    wind_speed = np.sqrt(u_wind**2 + v_wind**2)
    
    # Calcular dirección del viento
    wind_direction = np.arctan2(v_wind, u_wind) * 180 / np.pi
    wind_direction = (wind_direction + 360) % 360
    
    return {
        'wind_speed': wind_speed,
        'wind_direction': wind_direction,
        'timestamps': ds['time'].values
    }
```

## Modelo de Inteligencia Artificial

### 1. Arquitectura del Modelo

El modelo utiliza Gradient Boosting Classifier de scikit-learn:

```python
from sklearn.ensemble import GradientBoostingClassifier
from sklearn.preprocessing import StandardScaler
from sklearn.pipeline import Pipeline

model = Pipeline([
    ('scaler', StandardScaler()),
    ('classifier', GradientBoostingClassifier(
        n_estimators=200,
        learning_rate=0.1,
        max_depth=6,
        random_state=42
    ))
])
```

### 2. Características de Entrada

El modelo utiliza 12 características derivadas del análisis meteorológico:

1. **mean_wind_speed**: Velocidad media del viento
2. **wind_speed_std**: Desviación estándar
3. **weibull_k**: Parámetro de forma de Weibull
4. **weibull_c**: Parámetro de escala de Weibull
5. **turbulence_intensity**: Índice de turbulencia
6. **power_density**: Densidad media de potencia
7. **capacity_factor**: Factor de capacidad estimado
8. **prob_operational**: Probabilidad de condiciones operacionales
9. **prob_above_8ms**: Probabilidad de vientos >8 m/s
10. **wind_speed_max**: Velocidad máxima registrada
11. **wind_speed_percentile_90**: Percentil 90
12. **seasonal_variation**: Variación estacional

### 3. Entrenamiento del Modelo

```python
def train_model(self, X=None, y=None):
    if X is None or y is None:
        X, y = self.generate_training_data(n_samples=2000)
    
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )
    
    self.model.fit(X_train, y_train)
    
    # Evaluación
    y_pred = self.model.predict(X_test)
    accuracy = accuracy_score(y_test, y_pred)
    
    return accuracy
```

### 4. Generación de Datos Sintéticos

Para entrenar el modelo, se generan datos sintéticos basados en conocimiento experto:

```python
def generate_training_data(self, n_samples=1000):
    data = []
    labels = []
    
    for i in range(n_samples):
        if i < n_samples // 3:  # Clase "Alto"
            mean_wind_speed = np.random.normal(8.5, 1.5)
            turbulence_intensity = np.random.normal(0.12, 0.03)
            power_density = np.random.normal(450, 100)
            label = 'Alto'
        # ... más clases
    
    return np.array(data), np.array(labels)
```

### 5. Interpretación de Resultados

El modelo proporciona:
- **Predicción**: Clase predicha (Alto/Moderado/Bajo)
- **Confianza**: Probabilidad de la predicción
- **Explicación**: Factores clave que influyen en la decisión

## Optimización y Rendimiento

### 1. Optimizaciones del Backend

#### Caché de Datos
```python
from functools import lru_cache

@lru_cache(maxsize=128)
def get_cached_era5_data(lat_min, lat_max, lon_min, lon_max, date_range):
    # Implementación con caché
    pass
```

#### Procesamiento Asíncrono
```python
import asyncio
from concurrent.futures import ThreadPoolExecutor

async def process_multiple_locations(locations):
    with ThreadPoolExecutor(max_workers=4) as executor:
        tasks = [
            loop.run_in_executor(executor, analyze_location, loc)
            for loc in locations
        ]
        results = await asyncio.gather(*tasks)
    return results
```

### 2. Optimizaciones del Frontend

#### Lazy Loading de Componentes
```jsx
import { lazy, Suspense } from 'react';

const ResultsPanel = lazy(() => import('./components/ResultsPanel'));

function App() {
    return (
        <Suspense fallback={<div>Cargando...</div>}>
            <ResultsPanel />
        </Suspense>
    );
}
```

#### Memoización de Cálculos
```jsx
import { useMemo } from 'react';

function MetricsDisplay({ data }) {
    const processedMetrics = useMemo(() => {
        return calculateComplexMetrics(data);
    }, [data]);
    
    return <div>{/* Render metrics */}</div>;
}
```

### 3. Optimización de Consultas a ERA5

- **Filtrado temporal**: Solicitar solo los datos necesarios
- **Resolución espacial**: Ajustar según el área de análisis
- **Variables específicas**: Descargar solo las variables requeridas
- **Compresión**: Utilizar formatos comprimidos cuando sea posible

## Despliegue y Configuración

### 1. Configuración de Producción

#### Variables de Entorno
```bash
# Backend
FLASK_ENV=production
FLASK_DEBUG=False
CDS_API_URL=https://cds.climate.copernicus.eu/api
CDS_API_KEY=your_api_key

# Frontend
REACT_APP_API_URL=https://api.wind-analysis.com
REACT_APP_ENVIRONMENT=production
```

#### Configuración de Nginx
```nginx
server {
    listen 80;
    server_name wind-analysis.com;
    
    location / {
        root /var/www/frontend/dist;
        try_files $uri $uri/ /index.html;
    }
    
    location /api/ {
        proxy_pass http://backend:5000/api/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

### 2. Monitoreo y Logging

#### Configuración de Logs
```python
import logging
from logging.handlers import RotatingFileHandler

if not app.debug:
    file_handler = RotatingFileHandler(
        'logs/wind_analysis.log', 
        maxBytes=10240, 
        backupCount=10
    )
    file_handler.setFormatter(logging.Formatter(
        '%(asctime)s %(levelname)s: %(message)s [in %(pathname)s:%(lineno)d]'
    ))
    file_handler.setLevel(logging.INFO)
    app.logger.addHandler(file_handler)
```

#### Métricas de Rendimiento
```python
import time
from functools import wraps

def monitor_performance(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        start_time = time.time()
        result = f(*args, **kwargs)
        end_time = time.time()
        
        app.logger.info(f'{f.__name__} executed in {end_time - start_time:.2f}s')
        return result
    
    return decorated_function
```

### 3. Seguridad

#### Validación de Entrada
```python
from marshmallow import Schema, fields, validate

class ERA5RequestSchema(Schema):
    lat_min = fields.Float(required=True, validate=validate.Range(min=-90, max=90))
    lat_max = fields.Float(required=True, validate=validate.Range(min=-90, max=90))
    lon_min = fields.Float(required=True, validate=validate.Range(min=-180, max=180))
    lon_max = fields.Float(required=True, validate=validate.Range(min=-180, max=180))
    start_date = fields.Date(required=True)
    end_date = fields.Date(required=True)
```

#### Rate Limiting
```python
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address

limiter = Limiter(
    app,
    key_func=get_remote_address,
    default_limits=["200 per day", "50 per hour"]
)

@app.route('/api/era5-data', methods=['POST'])
@limiter.limit("10 per minute")
def get_era5_data():
    # Implementación
    pass
```

### 4. Backup y Recuperación

#### Backup de Configuración
```bash
#!/bin/bash
# backup_config.sh

DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/backups/wind_analysis_$DATE"

mkdir -p $BACKUP_DIR

# Backup de configuración
cp ~/.cdsapirc $BACKUP_DIR/
cp docker-compose.yml $BACKUP_DIR/
cp -r nginx/ $BACKUP_DIR/

# Comprimir backup
tar -czf "wind_analysis_backup_$DATE.tar.gz" $BACKUP_DIR
```

#### Procedimiento de Recuperación
1. Restaurar archivos de configuración
2. Reconstruir imágenes Docker
3. Verificar conectividad con ERA5
4. Ejecutar pruebas de funcionalidad

---

Esta documentación técnica proporciona una visión completa de la implementación del sistema, desde la arquitectura hasta los detalles de despliegue. Para información adicional o soporte técnico, consultar el repositorio del proyecto o contactar al equipo de desarrollo.

