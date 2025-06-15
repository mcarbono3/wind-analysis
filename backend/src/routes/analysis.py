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
        wind_directions = data.get('wind_directions', None)
        air_density = data.get('air_density', None)

        analyzer = WindAnalysis()

        results = analyzer.comprehensive_wind_analysis(wind_speeds, air_density)

        # Agregar time_series
        results["time_series"] = [
            {"time": ts, "speed": float(s)} for ts, s in zip(timestamps, wind_speeds)
        ]

        # Weibull
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

        # Histograma
        bins = np.arange(0, np.ceil(np.max(wind_speeds)) + 1)
        hist, bin_edges = np.histogram(wind_speeds, bins=bins, density=True)
        results["wind_speed_distribution"] = [
            {"speed": float(bin_edges[i]), "frequency": float(hist[i])}
            for i in range(len(hist))
        ]

        # Rosa de los vientos
        if wind_directions:
            wind_directions = np.array(wind_directions)
            valid_mask = (~np.isnan(wind_speeds)) & (~np.isnan(wind_directions))
            speeds = wind_speeds[valid_mask]
            dirs = wind_directions[valid_mask]
            rose = generate_wind_rose(speeds, dirs)  # ✅ CORREGIDO
            results["wind_rose_data"] = rose["wind_rose_data"]

        # Media horaria
        results["hourly_patterns"] = {
            "mean_by_hour": {
                str(i): round(float(np.mean(wind_speeds[i::24])), 2)
                for i in range(min(24, len(wind_speeds)))
            }
        }

        # Viabilidad
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


def generate_wind_rose(wind_speeds, wind_directions):
    """
    Genera datos de rosa de los vientos para gráficos.
    """
    dir_bins = np.arange(0, 361, 22.5)
    dir_labels = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE',
                  'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW']

    speed_bins = [0, 3, 6, 9, 12, 15, 20, 100]
    speed_labels = ['0-3', '3-6', '6-9', '9-12', '12-15', '15-20', '>20']

    wind_rose_data = []

    for i, dir_label in enumerate(dir_labels):
        dir_min = dir_bins[i]
        dir_max = dir_bins[i + 1] if i < len(dir_bins) - 1 else 360

        if dir_label == 'N':
            dir_mask = (wind_directions >= 348.75) | (wind_directions < 11.25)
        else:
            dir_mask = (wind_directions >= dir_min) & (wind_directions < dir_max)

        dir_speeds = wind_speeds[dir_mask]
        speed_frequencies = []

        for j in range(len(speed_bins) - 1):
            speed_mask = (dir_speeds >= speed_bins[j]) & (dir_speeds < speed_bins[j + 1])
            frequency = np.sum(speed_mask) / len(wind_speeds) * 100
            speed_frequencies.append(frequency)

        wind_rose_data.append({
            'direction': dir_label,
            'angle': (dir_min + dir_max) / 2 if dir_label != 'N' else 0,
            'frequencies': speed_frequencies,
            'total_frequency': np.sum(speed_frequencies)
        })

    return {
        'wind_rose_data': wind_rose_data,
        'speed_labels': speed_labels,
        'direction_labels': dir_labels
    }


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

