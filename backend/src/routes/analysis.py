from flask import Blueprint, request, jsonify
import numpy as np
import pandas as pd
from datetime import datetime
from src.services.wind_analysis import WindAnalysis
import json
from scipy import stats

analysis_bp = Blueprint('analysis', __name__)

@analysis_bp.route('/wind-analysis', methods=['POST'])
def perform_wind_analysis():
    """
    Realiza análisis completo de datos de viento
    """
    try:
        data = request.get_json()

        if 'wind_speeds' not in data:
            return jsonify({'error': 'Se requieren datos de velocidad del viento'}), 400

        wind_speeds = np.array(data['wind_speeds'])
        timestamps = data.get('timestamps', [f"T{i:02d}:00" for i in range(len(wind_speeds))])
        wind_directions = data.get('wind_directions', [None] * len(wind_speeds))
        air_density = data.get('air_density', None)

        analyzer = WindAnalysis()

        results = analyzer.comprehensive_wind_analysis(wind_speeds, air_density)

        # Agregar time_series para gráfico temporal
        results["time_series"] = [
            {"time": ts, "speed": float(s)} for ts, s in zip(timestamps, wind_speeds)
        ]

        # Agregar wind_rose_data (si hay direcciones válidas)
        if wind_directions and any(d is not None for d in wind_directions):
            wind_directions = np.array(wind_directions)
            valid_mask = (~np.isnan(wind_speeds)) & (~np.isnan(wind_directions))
            speeds = wind_speeds[valid_mask]
            dirs = wind_directions[valid_mask]
            rose = analyzer.generate_wind_rose(speeds, dirs)
            results["wind_rose_data"] = rose["wind_rose_data"]

        # Agregar gráfico de Weibull
        weibull_result = analyzer.fit_weibull_distribution(wind_speeds)
        if "shape" in weibull_result:
            x_vals = np.linspace(0, np.max(wind_speeds), 100)
            y_vals = stats.weibull_min.pdf(
                x_vals,
                weibull_result["shape"],
                weibull_result["location"],
                weibull_result["scale"]
            )
            weibull_result["plot_data"] = {
                "x_values": x_vals.tolist(),
                "y_values": y_vals.tolist()
            }
        results["weibull_analysis"] = weibull_result

        # Histograma simple de velocidades (frecuencia)
        bins = np.arange(0, np.ceil(np.max(wind_speeds)) + 1)
        hist, bin_edges = np.histogram(wind_speeds, bins=bins, density=True)
        results["wind_speed_distribution"] = [
            {"speed": float(bin_edges[i]), "frequency": float(hist[i])}
            for i in range(len(hist))
        ]

        # Rosa de los vientos (si se reciben direcciones)
        if wind_directions:
            wind_directions = np.array(wind_directions)
            valid_mask = (~np.isnan(wind_speeds)) & (~np.isnan(wind_directions))
            speeds = wind_speeds[valid_mask]
            dirs = wind_directions[valid_mask]
            rose = analyzer.generate_wind_rose(speeds, dirs)
            results["wind_rose_data"] = rose["wind_rose_data"]

        # Media horaria simulada (usada para gráfico de barras por hora)
        results["hourly_patterns"] = {
            "mean_by_hour": {
                str(i): round(float(np.mean(wind_speeds[i::24])), 2)
                for i in range(min(24, len(wind_speeds)))
            }
        }

        # Indicador de viabilidad básica (simulada)
        avg = np.mean(wind_speeds)
        std = np.std(wind_speeds)

        results["viability"] = {
            "viability_level": "Moderado" if avg > 5 else "Bajo",
            "viability_score": int(np.clip(avg * 10, 0, 100)),
            "viability_message": "✅ Viable" if avg > 5 else "❌ No viable",
            "key_metrics": {
                "mean_speed": round(float(avg), 2),
                "std_dev": round(float(std), 2)
            },
            "recommendations": [
                "Considerar ubicación en terreno abierto",
                "Verificar accesibilidad logística"
            ]
        }

        results = convert_numpy_to_json(results)

        return jsonify({
            'status': 'success',
            'analysis': results,
            'message': 'Análisis completado exitosamente'
        })

    except Exception as e:
        return jsonify({'error': str(e)}), 500


def convert_numpy_to_json(obj):
    """
    Convierte objetos numpy a tipos JSON serializables
    """
    if isinstance(obj, dict):
        return {key: convert_numpy_to_json(value) for key, value in obj.items()}
    elif isinstance(obj, list):
        return [convert_numpy_to_json(item) for item in obj]
    elif isinstance(obj, np.ndarray):
        return obj.tolist()
    elif isinstance(obj, (np.int64, np.int32)):
        return int(obj)
    elif isinstance(obj, (np.float64, np.float32)):
        return float(obj)
    elif isinstance(obj, np.bool_):
        return bool(obj)
    else:
        return obj
