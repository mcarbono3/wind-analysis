from flask import Blueprint, request, jsonify
from src.services.ai_diagnosis import WindPotentialAI, create_wind_ai_model
import numpy as np

ai_bp = Blueprint('ai', __name__)

# Instancia global del modelo de IA
wind_ai_model = None

def get_ai_model():
    """
    Obtiene o crea el modelo de IA
    """
    global wind_ai_model
    if wind_ai_model is None:
        wind_ai_model = create_wind_ai_model()
    return wind_ai_model

@ai_bp.route('/ai-diagnosis', methods=['POST'])
def ai_diagnosis():
    """
    Realiza diagnóstico automático con IA del potencial eólico
    """
    try:
        data = request.get_json()
        
        if 'analysis_data' not in data:
            return jsonify({'error': 'Se requieren datos de análisis'}), 400
        
        analysis_data = data['analysis_data']
        
        # Obtener modelo de IA
        ai_model = get_ai_model()
        
        # Realizar predicción
        prediction_result = ai_model.predict_viability(analysis_data)
        
        return jsonify({
            'status': 'success',
            'ai_diagnosis': prediction_result,
            'model_info': {
                'model_type': 'Gradient Boosting Classifier',
                'features_count': len(ai_model.feature_names),
                'target_classes': ai_model.target_classes
            }
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@ai_bp.route('/ai-model-info', methods=['GET'])
def ai_model_info():
    """
    Retorna información sobre el modelo de IA
    """
    try:
        ai_model = get_ai_model()
        
        feature_importance = ai_model.get_feature_importance()
        
        return jsonify({
            'status': 'success',
            'model_info': {
                'is_trained': ai_model.is_trained,
                'feature_names': ai_model.feature_names,
                'target_classes': ai_model.target_classes,
                'feature_importance': feature_importance[:10] if feature_importance else None
            }
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@ai_bp.route('/retrain-model', methods=['POST'])
def retrain_model():
    """
    Reentrena el modelo de IA (para uso administrativo)
    """
    try:
        global wind_ai_model
        
        # Crear nuevo modelo
        wind_ai_model = create_wind_ai_model()
        
        return jsonify({
            'status': 'success',
            'message': 'Modelo reentrenado exitosamente',
            'model_info': {
                'is_trained': wind_ai_model.is_trained,
                'features_count': len(wind_ai_model.feature_names)
            }
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@ai_bp.route('/predict-batch', methods=['POST'])
def predict_batch():
    """
    Realiza predicciones en lote para múltiples ubicaciones
    """
    try:
        data = request.get_json()
        
        if 'analysis_batch' not in data:
            return jsonify({'error': 'Se requiere un lote de datos de análisis'}), 400
        
        analysis_batch = data['analysis_batch']
        
        if not isinstance(analysis_batch, list):
            return jsonify({'error': 'analysis_batch debe ser una lista'}), 400
        
        # Obtener modelo de IA
        ai_model = get_ai_model()
        
        # Realizar predicciones para cada elemento
        results = []
        for i, analysis_data in enumerate(analysis_batch):
            try:
                prediction_result = ai_model.predict_viability(analysis_data)
                results.append({
                    'index': i,
                    'prediction': prediction_result,
                    'status': 'success'
                })
            except Exception as e:
                results.append({
                    'index': i,
                    'error': str(e),
                    'status': 'error'
                })
        
        return jsonify({
            'status': 'success',
            'batch_results': results,
            'total_processed': len(results),
            'successful_predictions': len([r for r in results if r['status'] == 'success'])
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@ai_bp.route('/ai-explanation', methods=['POST'])
def ai_explanation():
    """
    Proporciona explicación detallada de una predicción específica
    """
    try:
        data = request.get_json()
        
        if 'features' not in data:
            return jsonify({'error': 'Se requieren las características (features)'}), 400
        
        features = data['features']
        
        # Obtener modelo de IA
        ai_model = get_ai_model()
        
        # Crear datos de análisis simulados a partir de las características
        analysis_data = {
            'basic_statistics': {
                'mean': features.get('mean_wind_speed', 5.0),
                'std': features.get('wind_speed_std', 1.5),
                'max': features.get('wind_speed_max', 15.0),
                'percentile_90': features.get('wind_speed_percentile_90', 8.0)
            },
            'weibull_analysis': {
                'k': features.get('weibull_k', 2.0),
                'c': features.get('weibull_c', 5.5)
            },
            'turbulence_analysis': {
                'overall': {
                    'turbulence_intensity': features.get('turbulence_intensity', 0.2)
                }
            },
            'power_density': {
                'mean_power_density': features.get('power_density', 150)
            },
            'capacity_factor': {
                'capacity_factor': features.get('capacity_factor', 25)
            },
            'wind_probabilities': {
                'prob_operational': features.get('prob_operational', 70),
                'prob_above_8_ms': features.get('prob_above_8ms', 30)
            }
        }
        
        # Realizar predicción con explicación
        prediction_result = ai_model.predict_viability(analysis_data)
        
        return jsonify({
            'status': 'success',
            'explanation': prediction_result['explanation'],
            'prediction': prediction_result['prediction'],
            'confidence': prediction_result['confidence'],
            'features_analyzed': prediction_result['features_used']
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

