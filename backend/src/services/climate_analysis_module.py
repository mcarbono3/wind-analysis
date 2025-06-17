import pandas as pd
from geopy.distance import geodesic
import joblib

class ClimateAnalysisModule:
    """
    Módulo de análisis climatológico para evaluar la viabilidad de proyectos eólicos
    considerando eventos climáticos extremos en el Caribe colombiano.
    """
    
    def __init__(self, hurdat_data_path="parsed_hurdat_data.csv", model_path="random_forest_model.joblib"):
        """
        Inicializa el módulo de análisis climatológico.
        
        Args:
            hurdat_data_path (str): Ruta al archivo CSV con datos de huracanes parseados
            model_path (str): Ruta al modelo de machine learning entrenado
        """
        self.hurdat_data_path = hurdat_data_path
        self.model_path = model_path
        self.df = None
        self.model = None
        self.caribbean_bbox = {
            "min_lat": 10.0,
            "max_lat": 13.0,
            "min_lon": -82.0,
            "max_lon": -74.0
        }
        
    def load_data(self):
        """Carga los datos de huracanes y el modelo entrenado."""
        try:
            print("📥 Intentando cargar:", self.hurdat_data_path)
            print("📦 Intentando cargar modelo:", self.model_path)
            self.df = pd.read_csv(self.hurdat_data_path, dtype={
                "date": str,
                "time": str
            })
            self.model = joblib.load(self.model_path)
            print("✅ Carga exitosa")
            return True
        except Exception as e:
            print(f"Error cargando datos o modelo: {e}")
            return False
    
    def calculate_metrics(self, analysis_point_lat, analysis_point_lon, radius_km=200):
        """
        Calcula métricas estadísticas y geoespaciales para un punto de análisis.
        
        Args:
            analysis_point_lat (float): Latitud del punto de análisis
            analysis_point_lon (float): Longitud del punto de análisis
            radius_km (float): Radio de análisis en kilómetros
            
        Returns:
            dict: Diccionario con las métricas calculadas
        """
        if self.df is None:
            raise ValueError("Los datos no han sido cargados. Llama a load_data() primero.")
        
        # Filtrar eventos dentro del cuadro delimitador del Caribe
        caribbean_events = self.df[
            (self.df["latitude_float"] >= self.caribbean_bbox["min_lat"])
            & (self.df["latitude_float"] <= self.caribbean_bbox["max_lat"])
            & (self.df["longitude_float"] >= self.caribbean_bbox["min_lon"])
            & (self.df["longitude_float"] <= self.caribbean_bbox["max_lon"])
        ].copy()

        if caribbean_events.empty:
            return self._empty_metrics()

        # Calcular distancia desde el punto de análisis
        caribbean_events["distance_to_analysis_point"] = caribbean_events.apply(
            lambda row: geodesic((row["latitude_float"], row["longitude_float"]), 
                               (analysis_point_lat, analysis_point_lon)).km,
            axis=1
        )

        # Filtrar eventos dentro del radio especificado
        nearby_events = caribbean_events[caribbean_events["distance_to_analysis_point"] <= radius_km].copy()

        if nearby_events.empty:
            return self._empty_metrics()

        # Calcular métricas
        event_density = nearby_events["storm_id"].nunique()

        # Frecuencia de eventos por tipo
        nearby_events["year"] = pd.to_datetime(nearby_events["date"] + nearby_events["time"], 
                                             format="%Y%m%d%H%M").dt.year
        total_years = nearby_events["year"].nunique()
        event_frequency = nearby_events.groupby("storm_type")["storm_id"].nunique() / total_years if total_years > 0 else 0
        event_frequency = event_frequency.to_dict()

        # Perfil de intensidad por tipo de evento
        event_intensity_profile = nearby_events.groupby("storm_type")["max_sustained_wind_knots"].mean().to_dict()

        # Convertir nudos a m/s
        nearby_events["max_sustained_wind_ms"] = nearby_events["max_sustained_wind_knots"] * 0.514444
        
        # Puntuación de oportunidad energética (vientos útiles 12-25 m/s)
        useful_wind_events = nearby_events[
            (nearby_events["max_sustained_wind_ms"] >= 12)
            & (nearby_events["max_sustained_wind_ms"] <= 25)
        ]
        energy_opportunity_score = useful_wind_events["storm_id"].nunique() / event_density if event_density > 0 else 0

        # Índice de riesgo extremo (vientos >30 m/s)
        severe_wind_events = nearby_events[nearby_events["max_sustained_wind_ms"] > 30]
        extreme_risk_index = severe_wind_events["storm_id"].nunique() / event_density if event_density > 0 else 0

        # Estadísticas de duración
        storm_durations = nearby_events.groupby("storm_id").apply(lambda x:
            (pd.to_datetime(x["date"] + x["time"], format="%Y%m%d%H%M").max() -
             pd.to_datetime(x["date"] + x["time"], format="%Y%m%d%H%M").min()).total_seconds() / 3600,
            include_groups=False
        )
        
        event_duration_stats = {
            "average_duration_hours": storm_durations.mean() if not storm_durations.empty else 0,
            "std_dev_duration_hours": storm_durations.std() if not storm_durations.empty else 0
        }

        # Presión mínima histórica
        valid_pressures = nearby_events[nearby_events["min_central_pressure_mb"] != -999]["min_central_pressure_mb"]
        historical_pressure_min = valid_pressures.min() if not valid_pressures.empty else -999

        return {
            "event_density": event_density,
            "event_frequency": event_frequency,
            "event_intensity_profile": event_intensity_profile,
            "energy_opportunity_score": energy_opportunity_score,
            "extreme_risk_index": extreme_risk_index,
            "event_duration_stats": event_duration_stats,
            "historical_pressure_min": historical_pressure_min
        }
    
    def _empty_metrics(self):
        """Retorna métricas vacías cuando no hay datos disponibles."""
        return {
            "event_density": 0,
            "event_frequency": {},
            "event_intensity_profile": {},
            "energy_opportunity_score": 0,
            "extreme_risk_index": 0,
            "event_duration_stats": {"average_duration_hours": 0, "std_dev_duration_hours": 0},
            "historical_pressure_min": -999
        }
    
    def predict_impact(self, metrics):
        """
        Predice el impacto neto usando el modelo de machine learning.
        
        Args:
            metrics (dict): Métricas calculadas por calculate_metrics()
            
        Returns:
            str: Impacto predicho ('positivo', 'neutral', 'negativo')
        """
        if self.model is None:
            raise ValueError("El modelo no ha sido cargado. Llama a load_data() primero.")
        
        # Preparar datos para el modelo
        # Extraer valores promedio de intensidad para HU y TS
        avg_wind_speed_hu = metrics["event_intensity_profile"].get("HU", 0)
        avg_wind_speed_ts = metrics["event_intensity_profile"].get("TS", 0)
        avg_duration_hours = metrics["event_duration_stats"]["average_duration_hours"]
        
        input_data = {
            'event_density': metrics["event_density"],
            'avg_wind_speed_hu': avg_wind_speed_hu,
            'avg_wind_speed_ts': avg_wind_speed_ts,
            'energy_opportunity_score': metrics["energy_opportunity_score"],
            'extreme_risk_index': metrics["extreme_risk_index"],
            'avg_duration_hours': avg_duration_hours,
            'min_pressure': metrics["historical_pressure_min"]
        }
        
        input_df = pd.DataFrame([input_data])
        predicted_impact = self.model.predict(input_df)[0]
        
        return predicted_impact
    
    def generate_recommendation(self, predicted_impact):
        """
        Genera recomendaciones basadas en el impacto predicho.
        
        Args:
            predicted_impact (str): Impacto predicho por el modelo
            
        Returns:
            str: Recomendación textual
        """
        recommendations = {
            'positivo': (
                "**Recomendación: Viabilidad Alta**\n\n"
                "Este punto geográfico presenta condiciones históricas favorables para proyectos eólicos, "
                "con una alta puntuación de oportunidad energética y un bajo índice de riesgo extremo. "
                "Se recomienda proceder con estudios de viabilidad detallados y considerar este sitio como "
                "prioritario para el desarrollo de energía eólica. "
                "Monitorear continuamente las condiciones climáticas y realizar análisis de sitio exhaustivos "
                "para optimizar el diseño del proyecto y la selección de turbinas."
            ),
            'neutral': (
                "**Recomendación: Viabilidad Moderada**\n\n"
                "La viabilidad para proyectos eólicos en esta ubicación es moderada. "
                "Aunque existen oportunidades energéticas, también se han registrado eventos extremos que "
                "podrían impactar la operación. Se sugiere realizar un análisis de riesgo más profundo, "
                "considerar tecnologías de turbinas más robustas y diseñar estrategias de mitigación "
                "para eventos climáticos. La diversificación de la cartera de proyectos podría ser beneficiosa."
            ),
            'negativo': (
                "**Recomendación: Viabilidad Baja / Riesgo Alto**\n\n"
                "Este sitio presenta un alto riesgo debido a la frecuencia e intensidad de eventos climáticos extremos, "
                "lo que reduce significativamente la oportunidad energética. "
                "No se recomienda la inversión en proyectos eólicos a gran escala en esta ubicación "
                "sin una reevaluación exhaustiva de los riesgos y la implementación de medidas de protección "
                "excepcionalmente robustas. Se aconseja explorar ubicaciones alternativas con un perfil de riesgo más favorable."
            )
        }
        
        return recommendations.get(predicted_impact, "No se pudo generar una recomendación debido a un impacto no reconocido.")
    
    def analyze_point(self, latitude, longitude, radius_km=200):
        """
        Realiza un análisis completo para un punto geográfico específico.
        
        Args:
            latitude (float): Latitud del punto de análisis
            longitude (float): Longitud del punto de análisis
            radius_km (float): Radio de análisis en kilómetros
            
        Returns:
            dict: Resultado completo del análisis incluyendo métricas, impacto y recomendación
        """
        if not self.load_data():
            return {"error": "No se pudieron cargar los datos o el modelo"}
        
        try:
            # Calcular métricas
            metrics = self.calculate_metrics(latitude, longitude, radius_km)
            
            # Predecir impacto
            predicted_impact = self.predict_impact(metrics)
            
            # Generar recomendación
            recommendation = self.generate_recommendation(predicted_impact)
            
            return {
                "latitude": latitude,
                "longitude": longitude,
                "radius_km": radius_km,
                "metrics": metrics,
                "predicted_impact": predicted_impact,
                "recommendation": recommendation,
                "success": True
            }
            
        except Exception as e:
            return {
                "error": f"Error durante el análisis: {str(e)}",
                "success": False
            }

# Ejemplo de uso
if __name__ == "__main__":
    # Crear instancia del módulo
    climate_module = ClimateAnalysisModule()
    
    # Analizar un punto cerca de Barranquilla, Colombia
    result = climate_module.analyze_point(10.9685, -74.7813)
    
    if result.get("success"):
        print(f"Análisis para punto ({result['latitude']}, {result['longitude']}):")
        print(f"Impacto predicho: {result['predicted_impact']}")
        print(f"Recomendación:\n{result['recommendation']}")
        print(f"Métricas: {result['metrics']}")
    else:
        print(f"Error: {result.get('error')}")

