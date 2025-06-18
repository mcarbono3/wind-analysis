
import pandas as pd
import os
from geopy.distance import geodesic
import joblib

class ClimateAnalysisModule:
    """
    Módulo de análisis climatológico para evaluar la viabilidad de proyectos eólicos
    considerando eventos climáticos extremos en el Caribe colombiano.
    """

    def __init__(self, hurdat_data_path=None, model_path=None):
        base_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'database'))
        self.hurdat_data_path = hurdat_data_path or os.path.join(base_dir, 'parsed_hurdat_data.csv')
        self.model_path = model_path or os.path.join(base_dir, 'random_forest_model.joblib')
        self.df = None
        self.model = None
        self.caribbean_bbox = {
            "min_lat": 10.0,
            "max_lat": 13.0,
            "min_lon": -82.0,
            "max_lon": -74.0
        }

    def load_data(self):
        try:
            print(f"📂 Verificando existencia de archivos...")
            print(f"🧪 CSV path: {self.hurdat_data_path} | Existe: {os.path.exists(self.hurdat_data_path)}")
            print(f"🧪 Model path: {self.model_path} | Existe: {os.path.exists(self.model_path)}")
            self.df = pd.read_csv(self.hurdat_data_path, dtype={"date": str, "time": str})
            self.model = joblib.load(self.model_path)
            return True
        except Exception as e:
            print(f"Error cargando datos o modelo: {e}")
            return False

    def calculate_metrics(self, lat, lon, radius_km=200):
        if self.df is None:
            raise ValueError("Los datos no han sido cargados. Llama a load_data() primero.")

        caribbean_events = self.df[
            (self.df["latitude_float"] >= self.caribbean_bbox["min_lat"]) &
            (self.df["latitude_float"] <= self.caribbean_bbox["max_lat"]) &
            (self.df["longitude_float"] >= self.caribbean_bbox["min_lon"]) &
            (self.df["longitude_float"] <= self.caribbean_bbox["max_lon"])
        ].copy()

        if caribbean_events.empty:
            return self._empty_metrics()

        caribbean_events["distance_to_analysis_point"] = caribbean_events.apply(
            lambda row: geodesic((row["latitude_float"], row["longitude_float"]), (lat, lon)).km, axis=1)

        nearby_events = caribbean_events[caribbean_events["distance_to_analysis_point"] <= radius_km].copy()

        if nearby_events.empty:
            return self._empty_metrics()

        event_density = nearby_events["storm_id"].nunique()
        nearby_events["year"] = pd.to_datetime(nearby_events["date"] + nearby_events["time"], format="%Y%m%d%H%M").dt.year
        total_years = nearby_events["year"].nunique()
        event_frequency = nearby_events.groupby("storm_type")["storm_id"].nunique() / total_years if total_years > 0 else 0
        event_frequency = event_frequency.to_dict()
        event_intensity_profile = nearby_events.groupby("storm_type")["max_sustained_wind_knots"].mean().to_dict()
        nearby_events["max_sustained_wind_ms"] = nearby_events["max_sustained_wind_knots"] * 0.514444
        useful_wind_events = nearby_events[(nearby_events["max_sustained_wind_ms"] >= 12) & (nearby_events["max_sustained_wind_ms"] <= 25)]
        energy_opportunity_score = useful_wind_events["storm_id"].nunique() / event_density if event_density > 0 else 0
        severe_wind_events = nearby_events[nearby_events["max_sustained_wind_ms"] > 30]
        extreme_risk_index = severe_wind_events["storm_id"].nunique() / event_density if event_density > 0 else 0

        storm_durations = nearby_events.groupby("storm_id").apply(lambda x:
            (pd.to_datetime(x["date"] + x["time"], format="%Y%m%d%H%M").max() -
             pd.to_datetime(x["date"] + x["time"], format="%Y%m%d%H%M").min()).total_seconds() / 3600,
            include_groups=False)

        event_duration_stats = {
            "average_duration_hours": storm_durations.mean() if not storm_durations.empty else 0,
            "std_dev_duration_hours": storm_durations.std() if not storm_durations.empty else 0
        }

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
        return {
            "event_density": 0,
            "event_frequency": {},
            "event_intensity_profile": {},
            "energy_opportunity_score": 0,
            "extreme_risk_index": 0,
            "event_duration_stats": {"average_duration_hours": 0, "std_dev_duration_hours": 0},
            "historical_pressure_min": -999
        }

    def predict_impact_details(self, metrics):
        if self.model is None:
            raise ValueError("El modelo no ha sido cargado.")

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
        predicted_class = self.model.predict(input_df)[0]
        proba = self.model.predict_proba(input_df)[0]
        class_labels = self.model.classes_
        class_probabilities = {label: float(prob) for label, prob in zip(class_labels, proba)}
        confidence = max(proba) * 100
        top_features = sorted(
            zip(input_data.keys(), self.model.feature_importances_),
            key=lambda x: x[1], reverse=True
        )[:5]

        recommendation = self.generate_recommendation(predicted_class)

        return {
            "classification": predicted_class,
            "confidence": round(confidence, 2),
            "class_probabilities": class_probabilities,
            "key_factors": [{"feature": f, "importance": round(i, 3)} for f, i in top_features],
            "recommendation": recommendation
        }

    def generate_recommendation(self, predicted_impact):
        recommendations = {
            'positivo': (
                "**Recomendación: Viabilidad Alta**

"
                "Este punto geográfico presenta condiciones históricas favorables para proyectos eólicos, "
                "con una alta puntuación de oportunidad energética y un bajo índice de riesgo extremo. "
                "Se recomienda proceder con estudios de viabilidad detallados y considerar este sitio como "
                "prioritario para el desarrollo de energía eólica. "
                "Monitorear continuamente las condiciones climáticas y realizar análisis de sitio exhaustivos "
                "para optimizar el diseño del proyecto y la selección de turbinas."
            ),
            'neutral': (
                "**Recomendación: Viabilidad Moderada**

"
                "La viabilidad para proyectos eólicos en esta ubicación es moderada. "
                "Aunque existen oportunidades energéticas, también se han registrado eventos extremos que "
                "podrían impactar la operación. Se sugiere realizar un análisis de riesgo más profundo, "
                "considerar tecnologías de turbinas más robustas y diseñar estrategias de mitigación "
                "para eventos climáticos. La diversificación de la cartera de proyectos podría ser beneficiosa."
            ),
            'negativo': (
                "**Recomendación: Viabilidad Baja / Riesgo Alto**

"
                "Este sitio presenta un alto riesgo debido a la frecuencia e intensidad de eventos climáticos extremos, "
                "lo que reduce significativamente la oportunidad energética. "
                "No se recomienda la inversión en proyectos eólicos a gran escala en esta ubicación "
                "sin una reevaluación exhaustiva de los riesgos y la implementación de medidas de protección "
                "excepcionalmente robustas. Se aconseja explorar ubicaciones alternativas con un perfil de riesgo más favorable."
            )
        }
        return recommendations.get(predicted_impact, "No se pudo generar una recomendación debido a un impacto no reconocido.")

    def analyze_point(self, latitude, longitude, radius_km=200):
        if not self.load_data():
            return {"error": "No se pudieron cargar los datos o el modelo", "success": False}
        try:
            metrics = self.calculate_metrics(latitude, longitude, radius_km)
            impact_info = self.predict_impact_details(metrics)
            return {
                "latitude": latitude,
                "longitude": longitude,
                "radius_km": radius_km,
                "metrics": metrics,
                "predicted_impact": impact_info["classification"],
                "recommendation": impact_info["recommendation"],
                "ai_diagnosis": {
                    "classification": impact_info["classification"],
                    "confidence": impact_info["confidence"],
                    "class_probabilities": impact_info["class_probabilities"],
                    "key_factors": impact_info["key_factors"],
                    "recommendations": impact_info["recommendation"]
                },
                "success": True
            }
        except Exception as e:
            return {"error": f"Error durante el análisis: {str(e)}", "success": False}

