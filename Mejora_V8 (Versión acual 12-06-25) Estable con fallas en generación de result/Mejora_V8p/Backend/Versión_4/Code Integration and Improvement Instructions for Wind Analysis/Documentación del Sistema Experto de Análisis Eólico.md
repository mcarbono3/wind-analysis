# Documentación del Sistema Experto de Análisis Eólico

## Resumen del Proyecto

Se ha desarrollado un sistema experto para evaluar la viabilidad de proyectos eólicos en el Caribe colombiano, integrando dos enfoques complementarios:

1. **Análisis Estadístico del Recurso Eólico**: Evalúa métricas técnicas del viento
2. **Análisis Climatológico del Riesgo Meteorológico**: Analiza eventos extremos históricos

## Arquitectura del Sistema

### Backend (Flask)

#### Estructura de Archivos
```
backend/
├── src/
│   ├── routes/
│   │   ├── ai.py (NUEVO/MODIFICADO)
│   │   ├── climate.py
│   │   └── user.py
│   ├── services/
│   │   └── climate_analysis_module.py (NUEVO)
│   └── models/
├── main.py (MODIFICADO)
├── parsed_hurdat_data.csv (NUEVO)
└── random_forest_model.joblib (NUEVO)
```

#### Componentes Principales

##### 1. ClimateAnalysisModule (`src/services/climate_analysis_module.py`)
- **Función**: Análisis climatológico basado en datos históricos de huracanes
- **Características**:
  - Carga y procesa datos HURDAT
  - Calcula métricas de riesgo climatológico
  - Genera recomendaciones usando machine learning
  - Evalúa eventos dentro de un radio configurable (default: 200km)

##### 2. Endpoint AI Diagnosis (`src/routes/ai.py`)
- **Ruta**: `/api/ai-diagnosis`
- **Método**: POST
- **Función**: Orquestador principal que integra ambos análisis
- **Entrada**:
  ```json
  {
    "latitude": float,
    "longitude": float,
    "radius_km": float (opcional, default: 200)
  }
  ```
- **Salida**:
  ```json
  {
    "success": true,
    "latitude": float,
    "longitude": float,
    "statistical_diagnosis": {
      "wind_speed_avg": float,
      "turbulence_intensity": float,
      "power_density": float,
      "viability_classification": string
    },
    "climate_diagnosis": {
      "metrics": {...},
      "predicted_impact": string,
      "recommendation": string
    },
    "consolidated_viability": string,
    "combined_recommendations": string,
    "detailed_explanations": {...}
  }
  ```

### Frontend (React)

#### Archivo Principal: `AnalysisPage.jsx`

##### Características Implementadas:
1. **Mapa Interactivo**:
   - Selección de coordenadas por clic
   - Entrada manual de coordenadas
   - Visualización de la ubicación seleccionada

2. **Análisis Integrado**:
   - Llamada al endpoint `/api/ai-diagnosis`
   - Procesamiento de respuesta unificada
   - Manejo de errores y estados de carga

3. **Visualización de Resultados**:
   - Resumen ejecutivo con métricas clave
   - Tabs separados para análisis estadístico y climatológico
   - Sección de recomendaciones técnicas
   - Explicaciones detalladas de cada modelo

4. **Exportación**:
   - Generación de reportes en Excel
   - Generación de reportes en PDF
   - Incluye todos los datos del análisis

##### Componentes UI:
- Cards para organización visual
- Badges con colores según viabilidad
- Tabs para navegación entre secciones
- Alertas para manejo de errores
- Botones de exportación

## Métricas Calculadas

### Análisis Climatológico
1. **event_density**: Densidad histórica de eventos en el radio especificado
2. **event_frequency**: Frecuencia anual promedio por tipo de evento
3. **event_intensity_profile**: Perfil histórico de velocidad del viento
4. **energy_opportunity_score**: Proporción de eventos con vientos útiles (12-25 m/s)
5. **extreme_risk_index**: Frecuencia de eventos severos (>30 m/s)
6. **event_duration_stats**: Duración promedio y variabilidad
7. **historical_pressure_min**: Presión mínima histórica registrada

### Análisis Estadístico (Placeholder)
- Velocidad promedio del viento
- Intensidad de turbulencia
- Densidad de potencia
- Clasificación de viabilidad

## Modelo de Machine Learning

### Características:
- **Algoritmo**: Random Forest Classifier
- **Variables de entrada**: 7 métricas climatológicas
- **Clases de salida**: 'positivo', 'neutral', 'negativo'
- **Archivo**: `random_forest_model.joblib`

### Entrenamiento:
El modelo se entrena con datos sintéticos basados en reglas de dominio:
- **Positivo**: Alta oportunidad energética (>0.7) y bajo riesgo extremo (<0.2)
- **Negativo**: Baja oportunidad energética (<0.6) y alto riesgo extremo (>0.3)
- **Neutral**: Casos intermedios

## Instalación y Configuración

### Requisitos del Backend:
```bash
pip install flask flask-cors pandas scikit-learn joblib geopy
```

### Archivos de Datos Necesarios:
1. `parsed_hurdat_data.csv`: Datos históricos de huracanes procesados
2. `random_forest_model.joblib`: Modelo entrenado de machine learning

### Configuración del Frontend:
- El componente `AnalysisPage.jsx` debe reemplazar el archivo existente
- Asegurar que las dependencias de UI (shadcn/ui) estén instaladas
- Configurar la URL base de la API en `API_BASE_URL`

## Flujo de Funcionamiento

1. **Usuario selecciona coordenadas** (clic en mapa o entrada manual)
2. **Frontend envía request** a `/api/ai-diagnosis`
3. **Backend ejecuta análisis climatológico** usando ClimateAnalysisModule
4. **Backend simula análisis estadístico** (placeholder)
5. **Backend consolida resultados** y genera recomendaciones
6. **Frontend recibe respuesta** y actualiza la interfaz
7. **Usuario puede exportar** resultados en Excel/PDF

## Mejoras Implementadas

### Backend:
- ✅ Integración del ClimateAnalysisModule en el endpoint principal
- ✅ Estructura de respuesta unificada
- ✅ Manejo robusto de errores
- ✅ Validación de parámetros de entrada
- ✅ Generación de recomendaciones consolidadas

### Frontend:
- ✅ Interfaz moderna y responsiva
- ✅ Visualización clara de métricas
- ✅ Exportación de reportes
- ✅ Manejo de estados de carga y error
- ✅ Organización por tabs para mejor UX

## Próximos Pasos Recomendados

1. **Integrar el modelo estadístico real** (ai_diagnosis.py original)
2. **Mejorar el algoritmo de consolidación** de diagnósticos
3. **Añadir validación de datos** HURDAT más robusta
4. **Implementar caché** para mejorar rendimiento
5. **Añadir tests unitarios** para ambos módulos
6. **Optimizar el modelo ML** con datos reales etiquetados

## Notas Técnicas

- El sistema está diseñado para ser modular y extensible
- Los datos HURDAT deben actualizarse periódicamente
- El modelo de ML puede reentrenarse con nuevos datos
- La API es compatible con CORS para desarrollo frontend
- Todas las coordenadas se validan antes del procesamiento

## Contacto y Soporte

Para dudas sobre la implementación o mejoras adicionales, consultar la documentación técnica de cada módulo o contactar al equipo de desarrollo.

