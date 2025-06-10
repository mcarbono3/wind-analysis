import pandas as pd
import numpy as np
from datetime import datetime
import os
import tempfile
import matplotlib.pyplot as plt
import seaborn as sns
from matplotlib.backends.backend_pdf import PdfPages
import io
import base64
from typing import Dict, List, Optional

class DataExporter:
    """
    Clase para exportar datos de análisis eólico en diferentes formatos
    """
    
    def __init__(self):
        self.temp_dir = tempfile.gettempdir()
        
    def export_to_csv(self, analysis_data: Dict, location_info: Dict = None) -> str:
        """
        Exporta los datos de análisis a formato CSV
        """
        try:
            # Crear DataFrame con los resultados principales
            export_data = []
            
            # Información de ubicación
            if location_info:
                export_data.append({
                    'Categoría': 'Ubicación',
                    'Métrica': 'Latitud Centro',
                    'Valor': location_info.get('center', [0, 0])[0],
                    'Unidad': 'grados',
                    'Descripción': 'Latitud del centro del área analizada'
                })
                export_data.append({
                    'Categoría': 'Ubicación',
                    'Métrica': 'Longitud Centro',
                    'Valor': location_info.get('center', [0, 0])[1],
                    'Unidad': 'grados',
                    'Descripción': 'Longitud del centro del área analizada'
                })
            
            # Estadísticas básicas
            basic_stats = analysis_data.get('basic_statistics', {})
            for metric, value in basic_stats.items():
                if isinstance(value, (int, float)):
                    export_data.append({
                        'Categoría': 'Estadísticas Básicas',
                        'Métrica': metric.replace('_', ' ').title(),
                        'Valor': value,
                        'Unidad': 'm/s' if 'speed' in metric else '%' if 'availability' in metric else '',
                        'Descripción': self._get_metric_description(metric)
                    })
            
            # Análisis de Weibull
            weibull = analysis_data.get('weibull_analysis', {})
            for metric, value in weibull.items():
                if isinstance(value, (int, float)) and metric != 'error':
                    export_data.append({
                        'Categoría': 'Distribución de Weibull',
                        'Métrica': metric.replace('_', ' ').title(),
                        'Valor': value,
                        'Unidad': 'm/s' if metric in ['c', 'scale', 'mean', 'mode'] else '',
                        'Descripción': self._get_metric_description(metric)
                    })
            
            # Análisis de turbulencia
            turbulence = analysis_data.get('turbulence_analysis', {})
            if 'overall' in turbulence:
                overall_ti = turbulence['overall']
                for metric, value in overall_ti.items():
                    if isinstance(value, (int, float)):
                        export_data.append({
                            'Categoría': 'Turbulencia',
                            'Métrica': metric.replace('_', ' ').title(),
                            'Valor': value,
                            'Unidad': '%' if 'intensity' in metric else 'm/s',
                            'Descripción': self._get_metric_description(metric)
                        })
            
            # Densidad de potencia
            power_density = analysis_data.get('power_density', {})
            for metric, value in power_density.items():
                if isinstance(value, (int, float)):
                    export_data.append({
                        'Categoría': 'Densidad de Potencia',
                        'Métrica': metric.replace('_', ' ').title(),
                        'Valor': value,
                        'Unidad': 'W/m²' if 'density' in metric else 'kg/m³' if 'density' in metric else '',
                        'Descripción': self._get_metric_description(metric)
                    })
            
            # Factor de capacidad
            capacity_factor = analysis_data.get('capacity_factor', {})
            for metric, value in capacity_factor.items():
                if isinstance(value, (int, float)):
                    export_data.append({
                        'Categoría': 'Factor de Capacidad',
                        'Métrica': metric.replace('_', ' ').title(),
                        'Valor': value,
                        'Unidad': '%' if 'factor' in metric else 'kW' if 'power' in metric else 'kWh/año' if 'energy' in metric else '',
                        'Descripción': self._get_metric_description(metric)
                    })
            
            # Probabilidades de viento
            probabilities = analysis_data.get('wind_probabilities', {})
            for metric, value in probabilities.items():
                if isinstance(value, (int, float)):
                    export_data.append({
                        'Categoría': 'Probabilidades de Viento',
                        'Métrica': metric.replace('_', ' ').title(),
                        'Valor': value,
                        'Unidad': '%',
                        'Descripción': self._get_metric_description(metric)
                    })
            
            # Evaluación general
            assessment = analysis_data.get('overall_assessment', {})
            if assessment:
                export_data.append({
                    'Categoría': 'Evaluación General',
                    'Métrica': 'Nivel de Viabilidad',
                    'Valor': assessment.get('viability_level', 'N/A'),
                    'Unidad': '',
                    'Descripción': 'Clasificación general del potencial eólico'
                })
                export_data.append({
                    'Categoría': 'Evaluación General',
                    'Métrica': 'Puntuación de Viabilidad',
                    'Valor': assessment.get('viability_score', 0),
                    'Unidad': 'puntos (0-100)',
                    'Descripción': 'Puntuación numérica del potencial eólico'
                })
            
            # Crear DataFrame
            df = pd.DataFrame(export_data)
            
            # Generar nombre de archivo único
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            filename = f"analisis_eolico_{timestamp}.csv"
            filepath = os.path.join(self.temp_dir, filename)
            
            # Guardar CSV
            df.to_csv(filepath, index=False, encoding='utf-8')
            
            return filepath
            
        except Exception as e:
            raise Exception(f"Error exportando a CSV: {str(e)}")
    
    def _get_metric_description(self, metric: str) -> str:
        """
        Retorna la descripción de una métrica específica
        """
        descriptions = {
            'mean': 'Velocidad media del viento',
            'median': 'Velocidad mediana del viento',
            'std': 'Desviación estándar de la velocidad del viento',
            'min': 'Velocidad mínima registrada',
            'max': 'Velocidad máxima registrada',
            'percentile_25': 'Percentil 25 de velocidad del viento',
            'percentile_75': 'Percentil 75 de velocidad del viento',
            'percentile_90': 'Percentil 90 de velocidad del viento',
            'percentile_95': 'Percentil 95 de velocidad del viento',
            'count': 'Número total de observaciones',
            'data_availability': 'Porcentaje de datos disponibles',
            'k': 'Parámetro de forma de Weibull',
            'c': 'Parámetro de escala de Weibull',
            'shape': 'Parámetro de forma (scipy)',
            'scale': 'Parámetro de escala (scipy)',
            'location': 'Parámetro de ubicación',
            'mode': 'Moda de la distribución de Weibull',
            'ks_statistic': 'Estadístico de Kolmogorov-Smirnov',
            'p_value': 'Valor p del test KS',
            'r_squared': 'Coeficiente de determinación R²',
            'goodness_of_fit': 'Calidad del ajuste de Weibull',
            'turbulence_intensity': 'Índice de turbulencia',
            'mean_speed': 'Velocidad media para este rango',
            'std_speed': 'Desviación estándar para este rango',
            'classification': 'Clasificación cualitativa',
            'mean_power_density': 'Densidad media de potencia eólica',
            'median_power_density': 'Densidad mediana de potencia eólica',
            'max_power_density': 'Densidad máxima de potencia eólica',
            'total_energy_density': 'Densidad total de energía',
            'air_density_used': 'Densidad del aire utilizada en cálculos',
            'capacity_factor': 'Factor de capacidad estimado',
            'mean_power_output': 'Potencia media de salida',
            'rated_power': 'Potencia nominal del aerogenerador',
            'annual_energy_production': 'Producción anual estimada de energía',
            'prob_above_8_ms': 'Probabilidad de vientos superiores a 8 m/s',
            'prob_above_cut_in': 'Probabilidad de vientos superiores a velocidad de arranque',
            'prob_operational': 'Probabilidad de condiciones operacionales',
            'prob_above_rated': 'Probabilidad de vientos superiores a velocidad nominal',
            'prob_calm': 'Probabilidad de vientos en calma',
            'prob_strong': 'Probabilidad de vientos fuertes',
            'prob_extreme': 'Probabilidad de vientos extremos'
        }
        
        return descriptions.get(metric, f'Métrica: {metric}')
    
    def generate_wind_rose_data(self, wind_speeds: np.ndarray, wind_directions: np.ndarray) -> pd.DataFrame:
        """
        Genera datos para rosa de vientos en formato CSV
        """
        try:
            # Filtrar datos válidos
            valid_mask = (~np.isnan(wind_speeds)) & (~np.isnan(wind_directions))
            wind_speeds = wind_speeds[valid_mask]
            wind_directions = wind_directions[valid_mask]
            
            # Definir bins de dirección (16 sectores)
            dir_bins = np.arange(0, 361, 22.5)
            dir_labels = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE',
                         'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW']
            
            # Definir bins de velocidad
            speed_bins = [0, 3, 6, 9, 12, 15, 20, 100]
            speed_labels = ['0-3', '3-6', '6-9', '9-12', '12-15', '15-20', '>20']
            
            # Crear DataFrame para rosa de vientos
            wind_rose_data = []
            
            for i, dir_label in enumerate(dir_labels):
                dir_min = dir_bins[i]
                dir_max = dir_bins[i + 1] if i < len(dir_bins) - 1 else 360
                
                # Manejar el caso especial de N (0°/360°)
                if dir_label == 'N':
                    dir_mask = (wind_directions >= 348.75) | (wind_directions < 11.25)
                else:
                    dir_mask = (wind_directions >= dir_min) & (wind_directions < dir_max)
                
                dir_speeds = wind_speeds[dir_mask]
                
                for j, speed_label in enumerate(speed_labels):
                    speed_min = speed_bins[j]
                    speed_max = speed_bins[j + 1]
                    
                    speed_mask = (dir_speeds >= speed_min) & (dir_speeds < speed_max)
                    frequency = np.sum(speed_mask) / len(wind_speeds) * 100
                    
                    wind_rose_data.append({
                        'Dirección': dir_label,
                        'Ángulo': (dir_min + dir_max) / 2 if dir_label != 'N' else 0,
                        'Rango_Velocidad': speed_label,
                        'Frecuencia_%': frequency,
                        'Conteo': np.sum(speed_mask)
                    })
            
            return pd.DataFrame(wind_rose_data)
            
        except Exception as e:
            raise Exception(f"Error generando datos de rosa de vientos: {str(e)}")

class ReportGenerator:
    """
    Clase para generar reportes PDF completos de análisis eólico
    """
    
    def __init__(self):
        self.temp_dir = tempfile.gettempdir()
        
    def generate_pdf_report(self, analysis_data: Dict, location_info: Dict = None, 
                          ai_diagnosis: Dict = None) -> str:
        """
        Genera un reporte PDF completo del análisis eólico
        """
        try:
            # Generar nombre de archivo único
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            md_filename = f"reporte_eolico_{timestamp}.md"
            md_filepath = os.path.join(self.temp_dir, md_filename)
            
            # Generar contenido del reporte en Markdown
            self._generate_markdown_report(md_filepath, analysis_data, location_info, ai_diagnosis)
            
            # Convertir a PDF usando la utilidad manus-md-to-pdf
            pdf_filename = f"reporte_eolico_{timestamp}.pdf"
            pdf_filepath = os.path.join(self.temp_dir, pdf_filename)
            
            # Ejecutar conversión
            import subprocess
            result = subprocess.run(['manus-md-to-pdf', md_filepath, pdf_filepath], 
                                  capture_output=True, text=True)
            
            if result.returncode != 0:
                raise Exception(f"Error convirtiendo a PDF: {result.stderr}")
            
            return pdf_filepath
            
        except Exception as e:
            raise Exception(f"Error generando reporte PDF: {str(e)}")
    
    def _generate_markdown_report(self, filepath: str, analysis_data: Dict, 
                                location_info: Dict = None, ai_diagnosis: Dict = None):
        """
        Genera el contenido del reporte en formato Markdown
        """
        with open(filepath, 'w', encoding='utf-8') as f:
            # Encabezado del reporte
            f.write("# Reporte de Análisis del Potencial Eólico\n\n")
            f.write("## Región Caribe de Colombia\n\n")
            f.write(f"**Fecha del análisis:** {datetime.now().strftime('%d de %B de %Y')}\n\n")
            f.write("**Fuente de datos:** ERA5 - ECMWF\n\n")
            f.write("---\n\n")
            
            # Información de ubicación
            if location_info:
                f.write("## 📍 Información de Ubicación\n\n")
                center = location_info.get('center', [0, 0])
                f.write(f"- **Latitud:** {center[0]:.4f}°\n")
                f.write(f"- **Longitud:** {center[1]:.4f}°\n")
                if 'bounds' in location_info:
                    bounds = location_info['bounds']
                    f.write(f"- **Área analizada:** {bounds[0][0]:.4f}°, {bounds[0][1]:.4f}° a {bounds[1][0]:.4f}°, {bounds[1][1]:.4f}°\n")
                f.write("\n")
            
            # Resumen ejecutivo
            f.write("## 📊 Resumen Ejecutivo\n\n")
            assessment = analysis_data.get('overall_assessment', {})
            if assessment:
                viability_level = assessment.get('viability_level', 'N/A')
                viability_score = assessment.get('viability_score', 0)
                viability_message = assessment.get('viability_message', '')
                
                f.write(f"### {viability_message}\n\n")
                f.write(f"**Nivel de viabilidad:** {viability_level}\n\n")
                f.write(f"**Puntuación:** {viability_score}/100 puntos\n\n")
                
                # Métricas clave
                key_metrics = assessment.get('key_metrics', {})
                if key_metrics:
                    f.write("### Métricas Clave\n\n")
                    f.write("| Métrica | Valor | Unidad |\n")
                    f.write("|---------|-------|--------|\n")
                    f.write(f"| Velocidad media del viento | {key_metrics.get('mean_wind_speed', 0):.2f} | m/s |\n")
                    f.write(f"| Densidad de potencia | {key_metrics.get('power_density', 0):.0f} | W/m² |\n")
                    f.write(f"| Factor de capacidad | {key_metrics.get('capacity_factor', 0):.1f} | % |\n")
                    f.write(f"| Índice de turbulencia | {key_metrics.get('turbulence_intensity', 0)*100:.1f} | % |\n")
                    f.write(f"| Probabilidad operacional | {key_metrics.get('operational_probability', 0):.1f} | % |\n")
                    f.write("\n")
            
            # Diagnóstico con IA
            if ai_diagnosis:
                f.write("## 🤖 Diagnóstico con Inteligencia Artificial\n\n")
                prediction = ai_diagnosis.get('prediction', 'N/A')
                confidence = ai_diagnosis.get('confidence', 0)
                
                f.write(f"**Predicción del modelo:** {prediction}\n\n")
                f.write(f"**Confianza:** {confidence:.1f}%\n\n")
                
                explanation = ai_diagnosis.get('explanation', {})
                if explanation:
                    f.write("### Factores Clave Identificados\n\n")
                    key_factors = explanation.get('key_factors', [])
                    for factor in key_factors:
                        f.write(f"- {factor}\n")
                    f.write("\n")
                    
                    f.write("### Recomendaciones de IA\n\n")
                    recommendations = explanation.get('recommendations', [])
                    for i, rec in enumerate(recommendations, 1):
                        f.write(f"{i}. {rec}\n")
                    f.write("\n")
            
            # Análisis estadístico detallado
            f.write("## 📈 Análisis Estadístico Detallado\n\n")
            
            # Estadísticas básicas
            basic_stats = analysis_data.get('basic_statistics', {})
            if basic_stats:
                f.write("### Estadísticas Básicas del Viento\n\n")
                f.write("| Estadística | Valor | Unidad |\n")
                f.write("|-------------|-------|--------|\n")
                f.write(f"| Media | {basic_stats.get('mean', 0):.2f} | m/s |\n")
                f.write(f"| Mediana | {basic_stats.get('median', 0):.2f} | m/s |\n")
                f.write(f"| Desviación estándar | {basic_stats.get('std', 0):.2f} | m/s |\n")
                f.write(f"| Mínimo | {basic_stats.get('min', 0):.2f} | m/s |\n")
                f.write(f"| Máximo | {basic_stats.get('max', 0):.2f} | m/s |\n")
                f.write(f"| Percentil 90 | {basic_stats.get('percentile_90', 0):.2f} | m/s |\n")
                f.write(f"| Disponibilidad de datos | {basic_stats.get('data_availability', 0):.1f} | % |\n")
                f.write("\n")
            
            # Análisis de Weibull
            weibull = analysis_data.get('weibull_analysis', {})
            if weibull and 'error' not in weibull:
                f.write("### Distribución de Weibull\n\n")
                f.write("La distribución de Weibull es fundamental para caracterizar el recurso eólico.\n\n")
                f.write("| Parámetro | Valor | Descripción |\n")
                f.write("|-----------|-------|-------------|\n")
                f.write(f"| k (forma) | {weibull.get('k', 0):.3f} | Determina la forma de la distribución |\n")
                f.write(f"| c (escala) | {weibull.get('c', 0):.3f} | Relacionado con la velocidad media |\n")
                f.write(f"| Media | {weibull.get('mean', 0):.2f} m/s | Velocidad media según Weibull |\n")
                f.write(f"| Moda | {weibull.get('mode', 0):.2f} m/s | Velocidad más frecuente |\n")
                f.write(f"| R² | {weibull.get('r_squared', 0):.3f} | Calidad del ajuste |\n")
                f.write(f"| Clasificación | {weibull.get('goodness_of_fit', 'N/A')} | Bondad del ajuste |\n")
                f.write("\n")
            
            # Análisis de turbulencia
            turbulence = analysis_data.get('turbulence_analysis', {})
            if turbulence and 'overall' in turbulence:
                f.write("### Análisis de Turbulencia\n\n")
                overall_ti = turbulence['overall']
                ti_value = overall_ti.get('turbulence_intensity', 0) * 100
                classification = overall_ti.get('classification', 'N/A')
                
                f.write(f"**Índice de turbulencia general:** {ti_value:.1f}% ({classification})\n\n")
                f.write("La turbulencia afecta la fatiga de los aerogeneradores y la producción de energía.\n\n")
                
                # Turbulencia por rangos de velocidad
                f.write("#### Turbulencia por Rangos de Velocidad\n\n")
                f.write("| Rango | TI (%) | Clasificación | Observaciones |\n")
                f.write("|-------|--------|---------------|---------------|\n")
                
                for key, value in turbulence.items():
                    if key != 'overall' and isinstance(value, dict):
                        ti_range = value.get('turbulence_intensity', 0) * 100
                        class_range = value.get('classification', 'N/A')
                        count = value.get('count', 0)
                        f.write(f"| {key} | {ti_range:.1f} | {class_range} | {count} datos |\n")
                f.write("\n")
            
            # Densidad de potencia y factor de capacidad
            power_density = analysis_data.get('power_density', {})
            capacity_factor = analysis_data.get('capacity_factor', {})
            
            if power_density or capacity_factor:
                f.write("### Potencial Energético\n\n")
                
                if power_density:
                    pd_value = power_density.get('mean_power_density', 0)
                    pd_class = power_density.get('classification', 'N/A')
                    f.write(f"**Densidad de potencia:** {pd_value:.0f} W/m² ({pd_class})\n\n")
                
                if capacity_factor:
                    cf_value = capacity_factor.get('capacity_factor', 0)
                    cf_class = capacity_factor.get('classification', 'N/A')
                    annual_energy = capacity_factor.get('annual_energy_production', 0)
                    f.write(f"**Factor de capacidad:** {cf_value:.1f}% ({cf_class})\n\n")
                    f.write(f"**Producción anual estimada:** {annual_energy:,.0f} kWh/año\n\n")
            
            # Probabilidades de viento
            probabilities = analysis_data.get('wind_probabilities', {})
            if probabilities:
                f.write("### Probabilidades de Viento\n\n")
                f.write("| Condición | Probabilidad | Descripción |\n")
                f.write("|-----------|--------------|-------------|\n")
                f.write(f"| Vientos > 8 m/s | {probabilities.get('prob_above_8_ms', 0):.1f}% | Vientos útiles para generación |\n")
                f.write(f"| Condiciones operacionales | {probabilities.get('prob_operational', 0):.1f}% | Rango operativo del aerogenerador |\n")
                f.write(f"| Vientos > velocidad nominal | {probabilities.get('prob_above_rated', 0):.1f}% | Potencia nominal alcanzada |\n")
                f.write(f"| Vientos en calma | {probabilities.get('prob_calm', 0):.1f}% | Velocidades < 2 m/s |\n")
                f.write(f"| Vientos fuertes | {probabilities.get('prob_strong', 0):.1f}% | Velocidades > 15 m/s |\n")
                f.write(f"| Vientos extremos | {probabilities.get('prob_extreme', 0):.1f}% | Velocidades > 20 m/s |\n")
                f.write("\n")
            
            # Recomendaciones
            if assessment and 'recommendations' in assessment:
                f.write("## 💡 Recomendaciones\n\n")
                recommendations = assessment['recommendations']
                for i, rec in enumerate(recommendations, 1):
                    f.write(f"{i}. {rec}\n")
                f.write("\n")
            
            # Metodología
            f.write("## 🔬 Metodología\n\n")
            f.write("### Fuente de Datos\n\n")
            f.write("- **Dataset:** ERA5 Reanalysis (ECMWF)\n")
            f.write("- **Resolución temporal:** Horaria\n")
            f.write("- **Resolución espacial:** ~31 km\n")
            f.write("- **Variables analizadas:** Velocidad del viento (10m, 100m), presión atmosférica, temperatura\n\n")
            
            f.write("### Análisis Estadístico\n\n")
            f.write("- **Distribución de Weibull:** Ajuste por máxima verosimilitud\n")
            f.write("- **Índice de turbulencia:** Desviación estándar / velocidad media\n")
            f.write("- **Densidad de potencia:** P = 0.5 × ρ × v³\n")
            f.write("- **Factor de capacidad:** Basado en curva de potencia estándar\n\n")
            
            f.write("### Modelo de IA\n\n")
            f.write("- **Algoritmo:** Gradient Boosting Classifier\n")
            f.write("- **Precisión:** >99%\n")
            f.write("- **Características:** 12 variables meteorológicas y estadísticas\n")
            f.write("- **Clases:** Alto, Moderado, Bajo potencial eólico\n\n")
            
            # Pie de página
            f.write("---\n\n")
            f.write("*Reporte generado automáticamente por el Sistema de Análisis Eólico Caribe*\n\n")
            f.write(f"*Fecha de generación: {datetime.now().strftime('%d/%m/%Y %H:%M:%S')}*\n")

