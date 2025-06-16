# Sistema de Análisis del Potencial Eólico - Región Caribe de Colombia

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Python 3.11+](https://img.shields.io/badge/python-3.11+-blue.svg)](https://www.python.org/downloads/)
[![React 18](https://img.shields.io/badge/react-18.0+-blue.svg)](https://reactjs.org/)
[![Flask](https://img.shields.io/badge/flask-2.3+-green.svg)](https://flask.palletsprojects.com/)

## 🌊 Descripción

Sistema web avanzado para el análisis del potencial eólico en la región Caribe de Colombia, desarrollado con tecnologías modernas y conectado directamente a la base de datos ERA5 del ECMWF (European Centre for Medium-Range Weather Forecasts). La aplicación proporciona análisis estadístico completo, visualizaciones interactivas y diagnóstico automático con inteligencia artificial para evaluar la viabilidad de proyectos eólicos.

### ✨ Características Principales

- **🗺️ Mapas Interactivos**: Selección de áreas de análisis sobre mapas de la región Caribe
- **📊 Análisis Estadístico Avanzado**: Distribución de Weibull, análisis de turbulencia, densidad de potencia
- **🤖 Diagnóstico con IA**: Modelo de machine learning con >99% de precisión para evaluación automática
- **📈 Visualizaciones Dinámicas**: Gráficos interactivos y métricas en tiempo real
- **📄 Exportación de Datos**: Reportes PDF completos y datos CSV para análisis posterior
- **🌐 Acceso a ERA5**: Conexión directa a datos meteorológicos históricos y en tiempo real
- **📱 Diseño Responsivo**: Compatible con dispositivos móviles y de escritorio

## 🏗️ Arquitectura del Sistema

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │    Backend      │    │   ERA5 ECMWF    │
│   (React)       │◄──►│   (Flask)       │◄──►│   Database      │
│                 │    │                 │    │                 │
│ • Mapas Leaflet │    │ • API REST      │    │ • Datos         │
│ • Visualización │    │ • Análisis ML   │    │   Meteorológicos│
│ • UI/UX         │    │ • Procesamiento │    │ • ERA5 Reanalysis│
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## 📖 Guía de Uso

### 1. Selección de Área

1. Abrir la aplicación en el navegador
2. Navegar a la pestaña "Selección de Área"
3. Hacer clic y arrastrar en el mapa para seleccionar la zona de análisis
4. La aplicación automáticamente detectará las coordenadas del área seleccionada

### 2. Configuración del Análisis

1. Ir a la pestaña "Configuración"
2. Seleccionar el rango de fechas para el análisis
3. Elegir las variables meteorológicas:
   - Velocidad del viento (10m, 100m)
   - Presión atmosférica
   - Temperatura
4. Activar análisis adicionales (Weibull, turbulencia, etc.)

### 3. Ejecutar Análisis

1. Hacer clic en "Iniciar Análisis Eólico"
2. El sistema descargará datos de ERA5 automáticamente
3. Se ejecutarán todos los análisis estadísticos
4. El modelo de IA proporcionará un diagnóstico automático

### 4. Visualizar Resultados

1. Navegar a la pestaña "Resultados"
2. Revisar las métricas clave y el diagnóstico de IA
3. Explorar gráficos interactivos y visualizaciones
4. Consultar recomendaciones específicas para el proyecto

### 5. Exportar Datos

1. Seleccionar el formato de exportación deseado:
   - **CSV**: Datos tabulares para análisis en Excel
   - **PDF**: Reporte completo con gráficos y análisis
   - **JSON**: Resumen ejecutivo para integración
2. Descargar el archivo generado

## 🔧 API Reference

### Endpoints Principales

#### Datos Meteorológicos

```http
GET /api/caribbean-bounds
```
Obtiene los límites geográficos de la región Caribe.

```http
POST /api/era5-data
Content-Type: application/json

{
  "lat_min": 10.0,
  "lat_max": 14.0,
  "lon_min": -76.0,
  "lon_max": -72.0,
  "start_date": "2024-01-01",
  "end_date": "2024-01-31",
  "variables": ["wind_speed_10m", "wind_speed_100m"]
}
```

#### Análisis Estadístico

```http
POST /api/wind-analysis
Content-Type: application/json

{
  "wind_speeds": [5.2, 6.1, 4.8, 7.3, 8.1, 5.9, 6.7]
}
```

```http
POST /api/weibull-analysis
Content-Type: application/json

{
  "wind_speeds": [5.2, 6.1, 4.8, 7.3, 8.1, 5.9, 6.7]
}
```

#### Diagnóstico con IA

```http
POST /api/ai-diagnosis
Content-Type: application/json

{
  "analysis_data": {
    "basic_statistics": {...},
    "weibull_analysis": {...},
    "turbulence_analysis": {...}
  }
}
```

#### Exportación

```http
POST /api/export-csv
Content-Type: application/json

{
  "analysis_data": {...},
  "location_info": {...}
}
```

```http
POST /api/generate-pdf-report
Content-Type: application/json

{
  "analysis_data": {...},
  "location_info": {...},
  "ai_diagnosis": {...}
}
```

## 🧠 Modelo de Inteligencia Artificial

### Características del Modelo

- **Algoritmo**: Gradient Boosting Classifier
- **Precisión**: >99% en validación cruzada
- **Variables de entrada**: 12 características meteorológicas y estadísticas
- **Clases de salida**: Alto, Moderado, Bajo potencial eólico

### Variables Analizadas

1. **Velocidad media del viento**
2. **Desviación estándar de velocidad**
3. **Parámetros de Weibull (k, c)**
4. **Índice de turbulencia**
5. **Densidad de potencia**
6. **Factor de capacidad**
7. **Probabilidades operacionales**
8. **Velocidades extremas**
9. **Variación estacional**

### Interpretación de Resultados

- **Alto Potencial (>70 puntos)**: ✅ Excelente recurso eólico, proyecto viable
- **Potencial Moderado (40-70 puntos)**: ⚠️ Recurso moderado, requiere análisis detallado
- **Bajo Potencial (<40 puntos)**: ❌ Recurso insuficiente, no recomendado

## 📊 Métricas y Análisis

### Estadísticas Básicas

- Media, mediana, desviación estándar
- Percentiles (25, 75, 90, 95)
- Disponibilidad de datos
- Valores extremos

### Distribución de Weibull

- Parámetros k (forma) y c (escala)
- Bondad del ajuste (R², test KS)
- Velocidad modal y media
- Clasificación de la distribución

### Análisis de Turbulencia

- Índice de turbulencia por rangos de velocidad
- Clasificación según estándares IEC
- Impacto en fatiga de aerogeneradores

### Potencial Energético

- Densidad de potencia (W/m²)
- Factor de capacidad estimado
- Producción anual de energía
- Probabilidades operacionales

## 🛠️ Desarrollo

### Estructura del Proyecto

```
wind-analysis-caribbean/
├── backend/                 # API Flask
│   ├── src/
│   │   ├── main.py         # Aplicación principal
│   │   ├── routes/         # Endpoints de la API
│   │   └── services/       # Lógica de negocio
│   ├── requirements.txt    # Dependencias Python
│   └── Dockerfile         # Imagen Docker backend
├── frontend/               # Aplicación React
│   ├── src/
│   │   ├── App.jsx        # Componente principal
│   │   └── components/    # Componentes React
│   ├── package.json       # Dependencias Node.js
│   └── Dockerfile        # Imagen Docker frontend
├── docker-compose.yml     # Orquestación de servicios
└── README.md             # Documentación
```

### Tecnologías Utilizadas

#### Backend
- **Flask**: Framework web Python
- **NumPy/SciPy**: Computación científica
- **Pandas**: Manipulación de datos
- **Scikit-learn**: Machine learning
- **Matplotlib/Seaborn**: Visualización
- **CDS API**: Acceso a datos ERA5

#### Frontend
- **React 18**: Framework de interfaz
- **Leaflet**: Mapas interactivos
- **Axios**: Cliente HTTP
- **Tailwind CSS**: Estilos
- **Recharts**: Gráficos interactivos

### Contribuir al Proyecto

1. Fork el repositorio
2. Crear una rama para la nueva funcionalidad (`git checkout -b feature/nueva-funcionalidad`)
3. Realizar cambios y commit (`git commit -am 'Agregar nueva funcionalidad'`)
4. Push a la rama (`git push origin feature/nueva-funcionalidad`)
5. Crear un Pull Request

### Ejecutar Pruebas

```bash
# Backend
cd backend
python -m pytest tests/

# Frontend
cd frontend
npm test
```

## 🌍 Datos y Fuentes

### ERA5 Reanalysis

El sistema utiliza datos del reanálisis ERA5 del ECMWF, que proporciona:

- **Resolución temporal**: Datos horarios
- **Resolución espacial**: ~31 km (0.25° x 0.25°)
- **Cobertura temporal**: 1940 - presente
- **Variables**: Velocidad del viento, presión, temperatura, humedad

### Variables Meteorológicas

- **Velocidad del viento a 10m**: `10m_u_component_of_wind`, `10m_v_component_of_wind`
- **Velocidad del viento a 100m**: `100m_u_component_of_wind`, `100m_v_component_of_wind`
- **Presión atmosférica**: `surface_pressure`
- **Temperatura**: `2m_temperature`

## 📈 Casos de Uso

### 1. Evaluación Preliminar de Sitios

Identificar rápidamente áreas con alto potencial eólico en la región Caribe para estudios más detallados.

### 2. Análisis de Micrositing

Comparar múltiples ubicaciones dentro de una zona para optimizar la ubicación de aerogeneradores.

### 3. Estudios de Factibilidad

Generar reportes técnicos completos para presentar a inversionistas y autoridades.

### 4. Investigación Académica

Analizar patrones de viento y cambio climático en la región Caribe.

### 5. Planificación Energética

Apoyar la planificación de políticas energéticas y metas de energía renovable.

## 🔒 Seguridad y Privacidad

- Las credenciales de API se almacenan de forma segura
- No se almacenan datos personales de usuarios
- Comunicación HTTPS en producción
- Validación de entrada en todos los endpoints

## 📞 Soporte y Contacto

- **Issues**: [GitHub Issues](https://github.com/tu-usuario/wind-analysis-caribbean/issues)
- **Documentación**: [Wiki del proyecto](https://github.com/tu-usuario/wind-analysis-caribbean/wiki)
- **Email**: info.sanaltek@gmail.com

## 📄 Licencia

Este proyecto está licenciado bajo la Licencia MIT. Ver el archivo [LICENSE](LICENSE) para más detalles.

## 🙏 Agradecimientos

- **ECMWF** por proporcionar acceso a los datos ERA5
- **Copernicus Climate Change Service** por la infraestructura de datos
- **Comunidad open source** por las librerías y herramientas utilizadas

## 📚 Referencias

1. [ERA5 Reanalysis Documentation](https://confluence.ecmwf.int/display/CKB/ERA5)
2. [Wind Energy Resource Assessment](https://www.irena.org/publications)
3. [IEC 61400-1 Wind Turbine Standard](https://webstore.iec.ch/publication/5426)
4. [Weibull Distribution in Wind Energy](https://www.sciencedirect.com/topics/engineering/weibull-distribution)

---

**Desarrollado con ❤️ para el avance de la energía eólica en Colombia**

