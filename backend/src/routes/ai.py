from flask import Blueprint, request, jsonify
from flask_cors import cross_origin
import os
import sys

# Importar el módulo de análisis climatológico
sys.path.append(os.path.join(os.path.dirname(__file__), '..', 'services'))
from climate_analysis_module import ClimateAnalysisModule

ai_bp = Blueprint('ai', __name__)

# Rutas a los archivos de datos y modelo
PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))  # Apunta a backend/src
DATABASE_PATH = os.path.join(PROJECT_ROOT, 'database')

HURDAT_DATA_PATH = os.path.join(DATABASE_PATH, 'parsed_hurdat_data.csv')
MODEL_PATH = os.path.join(DATABASE_PATH, 'random_forest_model.joblib')

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
        radius_km = data.get('radius_km', 200)  # Default 200 km

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

        # 2. Diagnóstico estadístico generado por el modelo
        statistical_diagnosis = {
            "viability_classification": climate_analysis_result["predicted_impact"],
            "details": "Clasificación generada automáticamente por el modelo Random Forest con métricas climatológicas.",
            "metrics": climate_analysis_result["metrics"]
        }

        # 3. Evaluación consolidada de viabilidad
        consolidated_viability = ""
        if climate_analysis_result["predicted_impact"] == "positivo":
            consolidated_viability = "Alta"
        elif climate_analysis_result["predicted_impact"] == "negativo":
            consolidated_viability = "Baja"
        else:
            consolidated_viability = "Moderada"

        # 4. Recomendaciones combinadas
        combined_recommendations = (
            f"Diagnóstico Climatológico: {climate_analysis_result['recommendation']}\n\n" +
            f"Diagnóstico Estadístico: {statistical_diagnosis['details']} " +
            f"Clasificación: {statistical_diagnosis['viability_classification']}.\n\n" +
            "Recomendación Consolidada: Se sugiere un análisis más profundo de la interacción entre los patrones de viento y los eventos extremos para optimizar el diseño del proyecto."
        )

        # 5. Explicaciones detalladas
        detailed_explanations = {
            "climate_analysis_module": {
                "description": "Módulo que analiza la viabilidad eólica desde una perspectiva climatológica, utilizando registros históricos de huracanes y tormentas tropicales para calcular indicadores de riesgo y oportunidad energética.",
                "metrics_calculated": climate_analysis_result["metrics"],
                "predicted_impact": climate_analysis_result["predicted_impact"]
            },
            "statistical_diagnosis": {
                "description": "Modelo de Random Forest entrenado para predecir impacto neto con base en métricas climatológicas.",
                "metrics_calculated": statistical_diagnosis["metrics"],
                "predicted_impact": statistical_diagnosis["viability_classification"]
            }
        }

        # 6. Resultado unificado
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

