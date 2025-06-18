# Reporte de Viabilidad de Proyectos Eólicos en el Caribe Colombiano

## Introducción

Este documento presenta un análisis de la viabilidad de proyectos eólicos en el Caribe colombiano, considerando la influencia histórica de eventos climáticos extremos como huracanes, tormentas y depresiones tropicales. El objetivo es proporcionar una herramienta complementaria al sistema de diagnóstico de viabilidad eólica existente, permitiendo una cuantificación más precisa de los riesgos y oportunidades asociados a estos fenómenos.

## Metodología

El desarrollo de este componente de inteligencia artificial climatológica se ha dividido en varias etapas:

### 1. Análisis de la Base de Datos Climática Histórica

Se utilizó la base de datos HURDAT2, que contiene información histórica de huracanes y tormentas tropicales en el Atlántico. Se desarrolló un script en Python (`parse_hurdat.py`) para parsear y estructurar estos datos en un formato CSV, facilitando su posterior procesamiento. Se verificaron los rangos de latitud, longitud y tipo de tormenta para asegurar la coherencia de los datos.

### 2. Desarrollo del Motor de Análisis Estadístico y Geoespacial

Se construyó el módulo `statistical_geospatial_analysis.py`, encargado de calcular métricas clave a partir de los datos históricos. Este módulo integra la librería `geopy` para realizar cálculos geográficos de proximidad. Se definió un cuadro delimitador para el Caribe colombiano y se generaron métricas por punto geográfico, incluyendo:

*   **Densidad de eventos:** Número de eventos únicos dentro de un radio definido.
*   **Frecuencia de eventos:** Frecuencia anual promedio de cada tipo de evento (huracán, tormenta tropical, depresión tropical).
*   **Perfil de intensidad de eventos:** Velocidad promedio del viento sostenido por tipo de tormenta.
*   **Puntuación de oportunidad energética:** Proporción de eventos con vientos útiles para la generación eólica (12–25 m/s).
*   **Índice de riesgo extremo:** Frecuencia de eventos severos (>30 m/s).
*   **Estadísticas de duración de eventos:** Duración promedio y desviación estándar de los eventos.
*   **Presión mínima histórica:** Indicador de afectación ciclónica severa.

### 3. Implementación del Módulo de Aprendizaje Automático

Se entrenó un modelo de clasificación Random Forest (`ml_module.py`) utilizando las métricas generadas en la etapa anterior. El modelo predice un "impacto neto" (positivo, neutral, negativo) en la viabilidad del proyecto eólico. Las variables de entrada incluyen la densidad de eventos, la intensidad media del viento, la frecuencia, la duración, entre otras. El modelo entrenado se guardó como `random_forest_model.joblib`.

### 4. Desarrollo del Motor de Interpretación y Recomendación

El módulo `recommendation_engine.py` traduce la salida del modelo de aprendizaje automático en recomendaciones textuales técnicas. Basándose en el "impacto neto" predicho, genera recomendaciones específicas sobre la viabilidad del proyecto, los riesgos asociados y las oportunidades energéticas. Este motor incluye reglas para interpretar el `net_effect` y ofrecer directrices según el riesgo o la oportunidad energética.

## Resultados y Discusión

Los resultados del análisis estadístico y geoespacial proporcionan una visión detallada del comportamiento histórico de los eventos climáticos extremos en el Caribe colombiano. Las métricas generadas son fundamentales para alimentar el modelo de aprendizaje automático, que a su vez clasifica la viabilidad de los proyectos eólicos en categorías de impacto (positivo, neutral, negativo).

El motor de interpretación y recomendación ofrece una guía práctica para los tomadores de decisiones, transformando las predicciones del modelo en acciones concretas. Por ejemplo, un impacto "positivo" sugiere alta viabilidad y la recomendación de proceder con estudios detallados, mientras que un impacto "negativo" indica un alto riesgo y la necesidad de reevaluar la inversión o buscar ubicaciones alternativas.

## Conclusiones

Este componente de inteligencia artificial climatológica representa un avance significativo en la evaluación de la viabilidad de proyectos eólicos en regiones propensas a eventos extremos. Al integrar datos históricos, análisis geoespacial y aprendizaje automático, se proporciona una herramienta robusta para la toma de decisiones informadas, mitigando riesgos y optimizando la inversión en energía eólica en el Caribe colombiano.

## Anexos

### Archivos Generados:

*   `parsed_hurdat_data.csv`: Datos de huracanes parseados y estructurados.
*   `random_forest_model.joblib`: Modelo de clasificación Random Forest entrenado.



