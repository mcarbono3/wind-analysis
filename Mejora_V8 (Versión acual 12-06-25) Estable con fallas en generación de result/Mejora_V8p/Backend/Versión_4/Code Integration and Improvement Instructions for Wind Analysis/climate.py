from flask import Blueprint, request, jsonify
from flask_cors import cross_origin
import os
import sys

# Importar el módulo de análisis climatológico
sys.path.append(os.path.dirname(__file__))
from src.services.climate_analysis_module import ClimateAnalysisModule

climate_bp = Blueprint('climate', __name__)

# Inicializar el módulo de análisis climatológico
climate_module = ClimateAnalysisModule(
    hurdat_data_path=os.path.join(os.path.dirname(__file__), 'parsed_hurdat_data.csv'),
    model_path=os.path.join(os.path.dirname(__file__), 'random_forest_model.joblib')
)

@climate_bp.route('/climate-analysis', methods=['POST'])
@cross_origin()
def climate_analysis():
    """
    Endpoint para realizar análisis climatológico de viabilidad eólica.
    
    Esperado en el body (JSON):
    {
        "latitude": float,
        "longitude": float,
        "radius_km": float (opcional, default: 200)
    }
    
    Retorna:
    {
        "success": bool,
        "data": {
            "latitude": float,
            "longitude": float,
            "radius_km": float,
            "metrics": dict,
            "predicted_impact": str,
            "recommendation": str
        },
        "error": str (si hay error)
    }
    """
    try:
        # Obtener datos del request
        data = request.get_json()
        
        if not data:
            return jsonify({
                "success": False,
                "error": "No se proporcionaron datos en el request"
            }), 400
        
        # Validar parámetros requeridos
        latitude = data.get('latitude')
        longitude = data.get('longitude')
        radius_km = data.get('radius_km', 200)  # Default 200 km
        
        if latitude is None or longitude is None:
            return jsonify({
                "success": False,
                "error": "Se requieren los parámetros 'latitude' y 'longitude'"
            }), 400
        
        # Validar tipos de datos
        try:
            latitude = float(latitude)
            longitude = float(longitude)
            radius_km = float(radius_km)
        except (ValueError, TypeError):
            return jsonify({
                "success": False,
                "error": "Los parámetros deben ser números válidos"
            }), 400
        
        # Validar rangos
        if not (-90 <= latitude <= 90):
            return jsonify({
                "success": False,
                "error": "La latitud debe estar entre -90 y 90 grados"
            }), 400
        
        if not (-180 <= longitude <= 180):
            return jsonify({
                "success": False,
                "error": "La longitud debe estar entre -180 y 180 grados"
            }), 400
        
        if radius_km <= 0:
            return jsonify({
                "success": False,
                "error": "El radio debe ser un número positivo"
            }), 400
        
        # Realizar análisis
        result = climate_module.analyze_point(latitude, longitude, radius_km)
        
        if result.get("success"):
            return jsonify({
                "success": True,
                "data": {
                    "latitude": result["latitude"],
                    "longitude": result["longitude"],
                    "radius_km": result["radius_km"],
                    "metrics": result["metrics"],
                    "predicted_impact": result["predicted_impact"],
                    "recommendation": result["recommendation"]
                }
            }), 200
        else:
            return jsonify({
                "success": False,
                "error": result.get("error", "Error desconocido durante el análisis")
            }), 500
            
    except Exception as e:
        return jsonify({
            "success": False,
            "error": f"Error interno del servidor: {str(e)}"
        }), 500

@climate_bp.route('/health', methods=['GET'])
@cross_origin()
def health_check():
    """Endpoint para verificar el estado de la API."""
    return jsonify({
        "status": "healthy",
        "service": "Climate Analysis API",
        "version": "1.0.0"
    }), 200

