from flask import Blueprint, request, jsonify
import logging
import os
from datetime import datetime, timedelta
import numpy as np
import pandas as pd
import random
import cdsapi
import xarray as xr
import tempfile

# Configuración del logger
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

era5_bp = Blueprint("era5", __name__)

class ERA5Service:
    def __init__(self):
        self.test_mode = os.environ.get("TEST_MODE", "False").lower() == "true"
        logger.info(f"ERA5Service inicializado (test_mode={self.test_mode})")

    def safe_get(self, lst, index, default=None):
        try:
            if lst and isinstance(lst, list) and 0 <= index < len(lst):
                return lst[index]
            return default
        except (TypeError, IndexError):
            return default

    def validate_parameters(self, data):
        required_params = ['lat_min', 'lat_max', 'lon_min', 'lon_max', 'start_date', 'end_date']
        missing_params = [param for param in required_params if param not in data]
        if missing_params:
            raise ValueError(f'Parámetros faltantes: {missing_params}')
        try:
            lat_min = float(data['lat_min'])
            lat_max = float(data['lat_max'])
            lon_min = float(data['lon_min'])
            lon_max = float(data['lon_max'])
            start_date = data['start_date']
            end_date = data['end_date']

            if lat_min >= lat_max or lon_min >= lon_max:
                raise ValueError('Rangos geográficos inválidos')

            start_dt = datetime.strptime(start_date, '%Y-%m-%d')
            end_dt = datetime.strptime(end_date, '%Y-%m-%d')
            if start_dt > end_dt:
                raise ValueError('Fecha de inicio debe ser anterior a fecha final')

            if (end_dt - start_dt).days > 31:
                raise ValueError('Rango de fechas muy amplio (máximo 31 días)')
            return lat_min, lat_max, lon_min, lon_max, start_date, end_date
        except ValueError as e:
            if 'does not match format' in str(e):
                raise ValueError('Formato de fecha inválido. Use YYYY-MM-DD')
            raise

    def get_real_wind_data(self, lat_min, lat_max, lon_min, lon_max, start_date, end_date):
        try:
            cds_url = os.environ.get("CDSAPI_URL")
            cds_key = os.environ.get("CDSAPI_KEY")
            if not cds_url or not cds_key:
                raise ValueError("Credenciales de CDS no configuradas")

            c = cdsapi.Client(url=cds_url, key=cds_key)
            area = [lat_max, lon_min, lat_min, lon_max]
            
            start_dt = datetime.strptime(start_date, '%Y-%m-%d')
            end_dt = datetime.strptime(end_date, '%Y-%m-%d')
            dates = [start_dt + timedelta(days=x) for x in range((end_dt - start_dt).days + 1)]
            years = sorted(list(set([d.strftime('%Y') for d in dates])))
            months = sorted(list(set([d.strftime('%m') for d in dates])))
            days = sorted(list(set([d.strftime('%d') for d in dates])))
            variables = [
                "10m_u_component_of_wind", "10m_v_component_of_wind",
                "100m_u_component_of_wind", "100m_v_component_of_wind",
                "2m_temperature", "surface_pressure"
            ]

            with tempfile.NamedTemporaryFile(suffix=".nc", delete=False) as tmp_file:
                dataset_path = tmp_file.name

            logger.info(f"Descargando datos para el área: {area}, Años: {years}, Meses: {months}, Días: {days}")
            
            c.retrieve(
                "reanalysis-era5-single-levels",
                {
                    "product_type": "reanalysis",
                    "variable": variables,
                    "year": years,
                    "month": months,
                    "day": days,
                    "time": ["00:00", "06:00", "12:00", "18:00"],
                    "format": "netcdf",
                    "area": area
                },
                dataset_path
            )

            ds = xr.open_dataset(dataset_path)
            logger.info(f"Datos descargados y abiertos: {ds.variables.keys()}")
            data_for_frontend = {}
            timestamps = [pd.Timestamp(t).isoformat() for t in ds.time.values]
            data_for_frontend['timestamps'] = timestamps

            if "u10" in ds and "v10" in ds:
                wind_speed_10m = np.sqrt(ds["u10"]**2 + ds["v10"]**2)
                wind_direction_10m = (180 / np.pi) * np.arctan2(ds["u10"], ds["v10"])
                wind_direction_10m = (wind_direction_10m + 360) % 360
                data_for_frontend['wind_speed_10m'] = wind_speed_10m.values.flatten().tolist()
                data_for_frontend['wind_direction_10m'] = wind_direction_10m.values.flatten().tolist()
            else:
                logger.warning("Variables u10 o v10 no encontradas.")
                data_for_frontend['wind_speed_10m'] = []
                data_for_frontend['wind_direction_10m'] = []

            if "u100" in ds and "v100" in ds:
                wind_speed_100m = np.sqrt(ds["u100"]**2 + ds["v100"]**2)
                wind_direction_100m = (180 / np.pi) * np.arctan2(ds["u100"], ds["v100"])
                wind_direction_100m = (wind_direction_100m + 360) % 360
                data_for_frontend['wind_speed_100m'] = wind_speed_100m.values.flatten().tolist()
                data_for_frontend['wind_direction_100m'] = wind_direction_100m.values.flatten().tolist()
            else:
                logger.warning("Variables u100 o v100 no encontradas.")
                data_for_frontend['wind_speed_100m'] = []
                data_for_frontend['wind_direction_100m'] = []

            if "t2m" in ds:
                temperature_2m_celsius = ds["t2m"] - 273.15 
                data_for_frontend['temperature_2m'] = temperature_2m_celsius.values.flatten().tolist()
            else:
                logger.warning("Variable t2m no encontrada.")
                data_for_frontend['temperature_2m'] = []

            if "sp" in ds:
                surface_pressure_hpa = ds["sp"] / 100.0
                data_for_frontend['surface_pressure'] = surface_pressure_hpa.values.flatten().tolist()
            else:
                logger.warning("Variable sp no encontrada.")
                data_for_frontend['surface_pressure'] = []
            
            wind_df = pd.DataFrame({
                "timestamp": pd.to_datetime(timestamps),
                "speed": data_for_frontend["wind_speed_10m"],
                "direction": data_for_frontend["wind_direction_10m"]
                })
            bins = np.arange(0, 361, 30)
            labels = [f"{i}-{i+30}" for i in bins[:-1]]
            wind_df["dir_bin"] = pd.cut(wind_df["direction"], bins=bins, labels=labels, right=False)
            data_for_frontend["wind_rose_data"] = wind_df.groupby("dir_bin")["speed"].count().reindex(labels, fill_value=0).to_dict()

            wind_df["hour"] = wind_df["timestamp"].dt.hour
            data_for_frontend["hourly_patterns"] = wind_df.groupby("hour")["speed"].mean().round(2).to_dict()

            wind_df["date"] = wind_df["timestamp"].dt.date
            daily_avg = wind_df.groupby("date")["speed"].mean().round(2)
            data_for_frontend["time_series"] = {date.isoformat(): val for date, val in daily_avg.items()}

            data_for_frontend['metadata'] = {
                'total_points': len(timestamps) * ds.latitude.size * ds.longitude.size,
                'spatial_resolution': f'{ds.latitude.size} lat x {ds.longitude.size} lon puntos',
                'temporal_resolution': f'{len(timestamps)} timesteps',
                'area': f'lat:[{lat_min},{lat_max}] lon:[{lon_min},{lon_max}]',
                'period': f'{start_date} to {end_date}',
                'test_mode': False,
                'region': 'Caribe Colombiano (ERA5)',
                'generated_at': datetime.now().isoformat(),
                'version': 'era5-v1.0'
            }

            try:
                os.remove(dataset_path)
            except OSError as e:
                logger.warning(f"No se pudo eliminar el archivo temporal: {e}")
            return data_for_frontend

        except Exception as e:
            logger.error(f"Fallo descarga/procesamiento datos reales: {e}")
            logger.info("Retornando datos simulados por error con los datos reales.")
            return self.generate_simulated_data_for_frontend(lat_min, lat_max, lon_min, lon_max, start_date, end_date)

    def generate_simulated_data_for_frontend(self, lat_min, lat_max, lon_min, lon_max, start_date, end_date):
        logger.info("🔄 Generando datos simulados compatibles con frontend")
        start = datetime.strptime(start_date, '%Y-%m-%d')
        end = datetime.strptime(end_date, '%Y-%m-%d')
        days_count = (end - start).days + 1

        num_lat_points = 5
        num_lon_points = 5
        spatial_points = num_lat_points * num_lon_points
        temporal_points = days_count * 4
        total_points = spatial_points * temporal_points

        timestamps = []
        current_dt = start
        for _ in range(days_count):
            for hour in [0, 6, 12, 18]:
                timestamps.append((current_dt + timedelta(hours=hour)).isoformat())
            current_dt += timedelta(days=1)

        flat_total_points = len(timestamps) * spatial_points

        wind_speed_10m = []
        wind_speed_100m = []
        wind_direction_10m = []
        wind_direction_100m = []
        surface_pressure = []
        temperature_2m = []

        base_wind_10 = 6.5
        base_wind_100 = 8.2
        base_pressure = 1013
        base_temp = 28

        for i in range(flat_total_points):
            time_factor = 0.8 + 0.4 * np.sin(2 * np.pi * ((i // spatial_points) % 4) / 4)
            random_factor = 0.7 + 0.6 * random.random()
            seasonal_factor = 0.9 + 0.2 * np.sin(2 * np.pi * ((i // spatial_points) % (365*4)) / (365*4))

            wind_10 = base_wind_10 * time_factor * random_factor * seasonal_factor
            wind_speed_10m.append(round(max(1.0, min(12.0, wind_10)), 2))
            wind_100 = wind_10 * 1.27
            wind_speed_100m.append(round(max(1.5, min(15.0, wind_100)), 2))

            wind_direction_10m.append(round(random.uniform(0, 360), 1))
            wind_direction_100m.append(round(random.uniform(0, 360), 1))

            pressure_var = 5 * np.sin(2 * np.pi * ((i // spatial_points) % 4) / 4) + 3 * (random.random() - 0.5)
            pressure = base_pressure + pressure_var
            surface_pressure.append(round(max(1000, min(1025, pressure)), 1))

            temp_var = 4 * np.sin(2 * np.pi * ((i // spatial_points) % 4) / 4 - np.pi/4) + 2 * (random.random() - 0.5)
            temp = base_temp + temp_var * seasonal_factor
            temperature_2m.append(round(max(20, min(35, temp)), 1))

        replicated_timestamps = []
        for ts in timestamps:
            replicated_timestamps.extend([ts] * spatial_points)
        # 🧠 Análisis adicionales esperados por el frontend
        sim_df = pd.DataFrame({
            "timestamp": pd.to_datetime(replicated_timestamps),
            "speed": wind_speed_10m,
            "direction": wind_direction_10m
            })
        bins = np.arange(0, 361, 30)
        labels = [f"{i}-{i+30}" for i in bins[:-1]]
        sim_df["dir_bin"] = pd.cut(sim_df["direction"], bins=bins, labels=labels, right=False)
        wind_rose_data = sim_df.groupby("dir_bin")["speed"].count().reindex(labels, fill_value=0).to_dict()

        sim_df["hour"] = sim_df["timestamp"].dt.hour
        hourly_patterns = sim_df.groupby("hour")["speed"].mean().round(2).to_dict()

        sim_df["date"] = sim_df["timestamp"].dt.date
        time_series = sim_df.groupby("date")["speed"].mean().round(2).to_dict()

        simulated_data = {
            'wind_speed_10m': wind_speed_10m,
            'wind_speed_100m': wind_speed_100m,
            'wind_direction_10m': wind_direction_10m,
            'wind_direction_100m': wind_direction_100m,
            'surface_pressure': surface_pressure,
            'temperature_2m': temperature_2m,
            'timestamps': replicated_timestamps,
            'wind_rose_data': wind_rose_data,
            'hourly_patterns': hourly_patterns,
            'time_series': time_series,
            'metadata': {
                'total_points': flat_total_points,
                'spatial_resolution': f'{spatial_points} puntos simulados',
                'temporal_resolution': f'{len(timestamps)} timesteps simulados',
                'area': f'lat:[{lat_min},{lat_max}] lon:[{lon_min},{lon_max}]',
                'period': f'{start_date} to {end_date}',
                'test_mode': True,
                'region': 'Caribe Colombiano (Simulado)',
                'generated_at': datetime.now().isoformat(),
                'version': 'simulated-v1.0'
            }
        }
        logger.info("Datos simulados generados.")
        return simulated_data

    def generate_frontend_compatible_data(self, lat_min, lat_max, lon_min, lon_max, start_date, end_date):
        if self.test_mode:
            logger.info("🔧 Modo de prueba activo: Generando datos simulados")
            return self.generate_simulated_data_for_frontend(lat_min, lat_max, lon_min, lon_max, start_date, end_date)
        else:
            logger.info("🌍 Modo real: Intentando obtener datos reales ERA5")
            return self.get_real_wind_data(lat_min, lat_max, lon_min, lon_max, start_date, end_date)

@era5_bp.route('/wind-data', methods=['POST'])
def get_wind_data():
    try:
        logger.info("🚀 === INICIO SOLICITUD /wind-data v3.1 ===")
        data = request.get_json()
        if not data:
            logger.warning("❌ No se recibieron datos JSON")
            return jsonify({
                'status': 'error',
                'error': 'No se recibieron datos JSON',
                'details': 'La solicitud debe incluir parámetros en formato JSON',
                'expected_format': {
                    'lat_min': 'float',
                    'lat_max': 'float',
                    'lon_min': 'float',
                    'lon_max': 'float',
                    'start_date': 'YYYY-MM-DD',
                    'end_date': 'YYYY-MM-DD'
                }
            }), 400

        try:
            service = ERA5Service()
            lat_min, lat_max, lon_min, lon_max, start_date, end_date = service.validate_parameters(data)
            logger.info(f"📍 Parámetros validados: lat=[{lat_min:.2f},{lat_max:.2f}], lon=[{lon_min:.2f},{lon_max:.2f}], fechas=[{start_date} a {end_date}]")
        except ValueError as ve:
            logger.warning(f"❌ Error en validación de parámetros: {ve}")
            return jsonify({
                'status': 'error',
                'error': 'Parámetros inválidos',
                'details': str(ve),
                'received_data': data
            }), 400

        try:
            era5_data = service.generate_frontend_compatible_data(
                lat_min, lat_max, lon_min, lon_max, start_date, end_date
            )
        except Exception as e:
            logger.error(f"❌ Error generando datos compatibles: {e}")
            return jsonify({
                'status': 'error',
                'error': 'Error generando datos',
                'details': str(e),
                'suggestion': 'Verifique el área o rango de fechas (máximo 31 días)'
            }), 500

        response = {
            'status': 'success',
            'message': 'Datos generados exitosamente',
            'data': era5_data
        }

        logger.info("✅ Datos listos para el frontend:")
        logger.info(f"   - wind_speed_10m: {len(era5_data.get('wind_speed_10m', []))} valores")
        logger.info(f"   - wind_speed_100m: {len(era5_data.get('wind_speed_100m', []))} valores")
        logger.info(f"   - surface_pressure: {len(era5_data.get('surface_pressure', []))} valores")
        logger.info(f"   - temperature_2m: {len(era5_data.get('temperature_2m', []))} valores")
        logger.info("🎯 Estructura compatible con el frontend (evita .flat() error)")

        return jsonify(response)

    except Exception as e:
        logger.exception("💥 Error inesperado en /wind-data")
        return jsonify({
            'status': 'error',
            'error': 'Error interno del servidor',
            'details': str(e),
            'technical_error': type(e).__name__,
            'timestamp': datetime.now().isoformat()
        }), 500

@era5_bp.route("/simulated_data", methods=["POST"])
def get_simulated_data_endpoint():
    service = ERA5Service()
    try:
        data = request.get_json()
        if not data:
            return jsonify({"error": "No se proporcionaron datos en la solicitud"}), 400
        
        logger.info(f"Solicitud de datos simulados recibida: {data}")
        lat_min, lat_max, lon_min, lon_max, start_date, end_date = service.validate_parameters(data)
        
        simulated_data = service.generate_simulated_data_for_frontend(
            lat_min, lat_max, lon_min, lon_max, start_date, end_date
        )
        return jsonify(simulated_data)

    except ValueError as ve:
        logger.error(f"Error de validación en datos simulados: {ve}")
        return jsonify({"error": str(ve)}), 400
    except Exception as e:
        logger.exception(f"Error inesperado en el endpoint de datos simulados: {e}")
        return jsonify({"error": "Error interno del servidor al generar datos simulados"}), 500
