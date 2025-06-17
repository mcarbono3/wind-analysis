from flask import Blueprint, request, jsonify
from flask_cors import cross_origin
import os
import sys

# Importar el módulo de análisis climatológico
sys.path.append(os.path.join(os.path.dirname(__file__), '..', 'services'))
from climate_analysis_module import ClimateAnalysisModule

ai_bp = Blueprint('ai', __name__)

# Rutas a los archivos de datos y modelo
HURDAT_DATA_PATH = os.path.join(os.path.dirname(__file__), '..', '..', '..', 'database', 'parsed_hurdat_data.csv')
MODEL_PATH = os.path.join(os.path.dirname(__file__), '..', '..', '..', 'database', 'random_forest_model.joblib')

# Inicializar el módulo de análisis climatológico
climate_module = ClimateAnalysisModule(
    hurdat_data_path=HURDAT_DATA_PATH,
    model_path=MODEL_PATH
)

@ai_bp.route('/ai-diagnosis', methods=['POST'])
@cross_origin()
def ai_diagnosis():
    """
    Endpoint para realizar un diagnóstico completo de viabilidad eólica,
    integrando análisis estadístico y climatológico.
    """
    try:
        data = request.get_json()
        if not data:
            return jsonify({"success": False, "error": "No se proporcionaron datos en el request"}), 400

        latitude = data.get('latitude')
        longitude = data.get('longitude')
        radius_km = data.get('radius_km', 200) # Default 200 km

        if latitude is None or longitude is None:
            return jsonify({"success": False, "error": "Se requieren los parámetros 'latitude' y 'longitude'"}), 400

        try:
            latitude = float(latitude)
            longitude = float(longitude)
            radius_km = float(radius_km)
        except (ValueError, TypeError):
            return jsonify({"success": False, "error": "Los parámetros deben ser números válidos"}), 400

        # 1. Ejecutar ClimateAnalysisModule
        climate_analysis_result = climate_module.analyze_point(latitude, longitude, radius_km)

        if not climate_analysis_result.get("success"):
            return jsonify({"success": False, "error": f"Error en el análisis climatológico: {climate_analysis_result.get('error')}"}), 500

        # 2. Placeholder para el diagnóstico estadístico (WindPotentialAI)
        # Aquí iría la lógica para llamar al modelo estadístico existente (ai_diagnosis.py original)
        # Por ahora, se simula una respuesta.
        statistical_diagnosis = {
            "wind_speed_avg": 8.5, # m/s
            "turbulence_intensity": 0.12, # %
            "power_density": 450, # W/m2
            "viability_classification": "Moderado",
            "details": "Análisis estadístico preliminar basado en datos históricos de viento."
        }

        # 3. Unificar los resultados
        # Aquí se debería implementar una lógica más sofisticada para la evaluación consolidada
        # Por simplicidad, se combinarán los diagnósticos y se generará una recomendación combinada.

        # Evaluación de viabilidad consolidada (ejemplo simple)
        consolidated_viability = ""
        if climate_analysis_result["predicted_impact"] == "positivo" and statistical_diagnosis["viability_classification"] == "Alto":
            consolidated_viability = "Alta"
        elif climate_analysis_result["predicted_impact"] == "negativo" or statistical_diagnosis["viability_classification"] == "Bajo":
            consolidated_viability = "Baja"
        else:
            consolidated_viability = "Moderada"

        # Recomendaciones técnicas combinadas
        combined_recommendations = (
            f"Diagnóstico Climatológico: {climate_analysis_result['recommendation']}\n\n" +
            f"Diagnóstico Estadístico: {statistical_diagnosis['details']} " +
            f"Clasificación: {statistical_diagnosis['viability_classification']}.\n\n" +
            "Recomendación Consolidada: Se sugiere un análisis más profundo de la interacción entre los patrones de viento y los eventos extremos para optimizar el diseño del proyecto."
        )

        # Explicaciones detalladas de cada modelo
        detailed_explanations = {
            "climate_analysis_module": {
                "description": "Módulo que analiza la viabilidad eólica desde una perspectiva climatológica, utilizando registros históricos de huracanes y tormentas tropicales para calcular indicadores de riesgo y oportunidad energética.",
                "metrics_calculated": climate_analysis_result["metrics"],
                "predicted_impact": climate_analysis_result["predicted_impact"]
            },
            "statistical_diagnosis": {
                "description": "Módulo que evalúa la viabilidad del sitio basándose en métricas estadísticas derivadas de mediciones eólicas, como velocidad media del viento, turbulencia, y densidad de potencia.",
                "metrics_calculated": statistical_diagnosis # Puedes expandir esto con más métricas si el modelo estadístico las proporciona
            }
        }

        unified_result = {
            "success": True,
            "latitude": latitude,
            "longitude": longitude,
            "statistical_diagnosis": statistical_diagnosis,
            "climate_diagnosis": {
                "metrics": climate_analysis_result["metrics"],
                "predicted_impact": climate_analysis_result["predicted_impact"],
                "recommendation": climate_analysis_result["recommendation"]
            },
            "consolidated_viability": consolidated_viability,
            "combined_recommendations": combined_recommendations,
            "detailed_explanations": detailed_explanations
        }

        return jsonify(unified_result), 200

    except Exception as e:
        return jsonify({"success": False, "error": f"Error interno del servidor: {str(e)}"}), 500

@ai_bp.route('/ai-model-info', methods=['GET'])
@cross_origin()
def ai_model_info():
    return jsonify({"message": "AI Model Info endpoint - Placeholder"})

@ai_bp.route('/retrain-model', methods=['POST'])
@cross_origin()
def retrain_model():
    return jsonify({"message": "Retrain Model endpoint - Placeholder"})


