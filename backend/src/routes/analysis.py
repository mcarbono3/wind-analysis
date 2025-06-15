from flask import Blueprint, request, jsonify
import numpy as np
import pandas as pd
from datetime import datetime
from src.services.wind_analysis import WindAnalysis
import json

analysis_bp = Blueprint('analysis', __name__)

@analysis_bp.route('/wind-analysis', methods=['POST'])
def perform_wind_analysis():
    """
    Realiza análisis completo de datos de viento
    """
    try:
        data = request.get_json()
        
        # Validar datos requeridos
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

# Agregar weibull_plot
weibull_result = analyzer.fit_weibull_distribution(wind_speeds)
if "shape" in weibull_result:
    from scipy import stats
    x_vals = np.linspace(0, np.max(wind_speeds), 100)
    y_vals = stats.weibull_min.pdf(x_vals, weibull_result["shape"], 
                                   weibull_result["location"], weibull_result["scale"])
    weibull_result["plot_data"] = {
        "x_values": x_vals.tolist(),
        "y_values": y_vals.tolist()
    }
results["weibull_analysis"] = weibull_result

# Agregar distribución simple de velocidades
bins = np.arange(0, np.ceil(np.max(wind_speeds)) + 1)
hist, bin_edges = np.histogram(wind_speeds, bins=bins, density=True)
results["wind_speed_distribution"] = [
    {"speed": float(bin_edges[i]), "frequency": float(hist[i])}
    for i in range(len(hist))
]

# Agregar wind_rose_data (si hay direcciones)
if wind_directions:
    wind_directions = np.array(wind_directions)
    valid_mask = (~np.isnan(wind_speeds)) & (~np.isnan(wind_directions))
    speeds = wind_speeds[valid_mask]
    dirs = wind_directions[valid_mask]
    rose = analyzer.generate_wind_rose(speeds, dirs)
    results["wind_rose_data"] = rose["wind_rose_data"]

# Agregar patrones horarios (simulados si no hay timestamps con hora)
results["hourly_patterns"] = {
    "mean_by_hour": {
        str(i): round(float(np.mean(wind_speeds[i::24])), 2)
        for i in range(min(24, len(wind_speeds)))
    }
}

# Agregar viabilidad (simulada)
results["viability"] = {
    "viability_level": "Moderado" if np.mean(wind_speeds) > 5 else "Bajo",
    "viability_score": int(np.clip(np.mean(wind_speeds)*10, 0, 100)),
    "viability_message": "✅ Viable" if np.mean(wind_speeds) > 5 else "❌ No viable",
    "key_metrics": {
        "mean_speed": round(float(np.mean(wind_speeds)), 2),
        "std_dev": round(float(np.std(wind_speeds)), 2)
    },
    "recommendations": [
        "Considerar ubicación en terreno abierto",
        "Verificar accesibilidad logística"
    ]
}

# Convertir numpy arrays
results = convert_numpy_to_json(results)

return jsonify({
    'status': 'success',
    'analysis': results,
    'message': 'Análisis completado exitosamente'
})
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@analysis_bp.route('/weibull-analysis', methods=['POST'])
def weibull_analysis():
    """
    Análisis específico de distribución de Weibull
    """
    try:
        data = request.get_json()
        
        if 'wind_speeds' not in data:
            return jsonify({'error': 'Se requieren datos de velocidad del viento'}), 400
        
        wind_speeds = np.array(data['wind_speeds'])
        
        analyzer = WindAnalysis()
        results = analyzer.fit_weibull_distribution(wind_speeds)
        
        # Generar datos para gráfico de Weibull
        if 'error' not in results:
            x_values = np.linspace(0, np.max(wind_speeds), 100)
            from scipy import stats
            y_values = stats.weibull_min.pdf(x_values, results['shape'], 
                                           results['location'], results['scale'])
            
            results['plot_data'] = {
                'x_values': x_values.tolist(),
                'y_values': y_values.tolist()
            }
        
        results = convert_numpy_to_json(results)
        
        return jsonify({
            'status': 'success',
            'weibull_analysis': results
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@analysis_bp.route('/turbulence-analysis', methods=['POST'])
def turbulence_analysis():
    """
    Análisis específico de turbulencia
    """
    try:
        data = request.get_json()
        
        if 'wind_speeds' not in data:
            return jsonify({'error': 'Se requieren datos de velocidad del viento'}), 400
        
        wind_speeds = np.array(data['wind_speeds'])
        time_resolution = data.get('time_resolution_hours', 1.0)
        
        analyzer = WindAnalysis()
        results = analyzer.calculate_turbulence_intensity(wind_speeds, time_resolution)
        
        results = convert_numpy_to_json(results)
        
        return jsonify({
            'status': 'success',
            'turbulence_analysis': results
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@analysis_bp.route('/power-analysis', methods=['POST'])
def power_analysis():
    """
    Análisis de densidad de potencia y factor de capacidad
    """
    try:
        data = request.get_json()
        
        if 'wind_speeds' not in data:
            return jsonify({'error': 'Se requieren datos de velocidad del viento'}), 400
        
        wind_speeds = np.array(data['wind_speeds'])
        air_density = data.get('air_density', None)
        
        analyzer = WindAnalysis()
        
        # Análisis de densidad de potencia
        power_density = analyzer.calculate_power_density(wind_speeds, air_density)
        
        # Análisis de factor de capacidad
        capacity_factor = analyzer.calculate_capacity_factor(wind_speeds)
        
        # Probabilidades de viento
        probabilities = analyzer.calculate_wind_probabilities(wind_speeds)
        
        results = {
            'power_density': power_density,
            'capacity_factor': capacity_factor,
            'wind_probabilities': probabilities
        }
        
        results = convert_numpy_to_json(results)
        
        return jsonify({
            'status': 'success',
            'power_analysis': results
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@analysis_bp.route('/wind-rose-data', methods=['POST'])
def wind_rose_data():
    """
    Genera datos para rosa de vientos
    """
    try:
        data = request.get_json()
        
        if 'wind_speeds' not in data or 'wind_directions' not in data:
            return jsonify({'error': 'Se requieren datos de velocidad y dirección del viento'}), 400
        
        wind_speeds = np.array(data['wind_speeds'])
        wind_directions = np.array(data['wind_directions'])
        
        # Filtrar datos válidos
        valid_mask = (~np.isnan(wind_speeds)) & (~np.isnan(wind_directions))
        wind_speeds = wind_speeds[valid_mask]
        wind_directions = wind_directions[valid_mask]
        
        # Definir bins de dirección (16 sectores de 22.5°)
        dir_bins = np.arange(0, 361, 22.5)
        dir_labels = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE',
                     'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW']
        
        # Definir bins de velocidad
        speed_bins = [0, 3, 6, 9, 12, 15, 20, 100]
        speed_labels = ['0-3', '3-6', '6-9', '9-12', '12-15', '15-20', '>20']
        
        # Calcular frecuencias
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
        
        return jsonify({
            'status': 'success',
            'wind_rose_data': wind_rose_data,
            'speed_labels': speed_labels,
            'direction_labels': dir_labels
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@analysis_bp.route('/monthly-analysis', methods=['POST'])
def monthly_analysis():
    """
    Análisis mensual de datos de viento
    """
    try:
        data = request.get_json()
        
        if 'wind_speeds' not in data or 'timestamps' not in data:
            return jsonify({'error': 'Se requieren datos de velocidad del viento y timestamps'}), 400
        
        wind_speeds = np.array(data['wind_speeds'])
        timestamps = pd.to_datetime(data['timestamps'])
        
        # Crear DataFrame
        df = pd.DataFrame({
            'wind_speed': wind_speeds,
            'timestamp': timestamps
        })
        
        # Filtrar datos válidos
        df = df.dropna()
        
        # Agregar columnas de tiempo
        df['month'] = df['timestamp'].dt.month
        df['hour'] = df['timestamp'].dt.hour
        
        # Análisis mensual
        monthly_stats = []
        for month in range(1, 13):
            month_data = df[df['month'] == month]['wind_speed']
            
            if len(month_data) > 0:
                analyzer = WindAnalysis()
                month_analysis = analyzer.comprehensive_wind_analysis(month_data.values)
                month_analysis = convert_numpy_to_json(month_analysis)
                
                monthly_stats.append({
                    'month': month,
                    'month_name': pd.Timestamp(2024, month, 1).strftime('%B'),
                    'analysis': month_analysis,
                    'data_count': len(month_data)
                })
        
        # Análisis horario
        hourly_stats = []
        for hour in range(24):
            hour_data = df[df['hour'] == hour]['wind_speed']
            
            if len(hour_data) > 0:
                hourly_stats.append({
                    'hour': hour,
                    'mean_speed': float(np.mean(hour_data)),
                    'std_speed': float(np.std(hour_data)),
                    'data_count': len(hour_data)
                })
        
        return jsonify({
            'status': 'success',
            'monthly_analysis': monthly_stats,
            'hourly_analysis': hourly_stats
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

