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
        """Acceso seguro a listas para evitar IndexError"""
        try:
            if lst and isinstance(lst, list) and 0 <= index < len(lst):
                return lst[index]
            return default
        except (TypeError, IndexError):
            return default

    def validate_parameters(self, data):
        """Validar parámetros de entrada"""
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

            # Validaciones de rango
            if lat_min >= lat_max or lon_min >= lon_max:
                raise ValueError('Rangos geográficos inválidos')

            # Validar fechas
            start_dt = datetime.strptime(start_date, '%Y-%m-%d')
            end_dt = datetime.strptime(end_date, '%Y-%m-%d')
            if start_dt > end_dt:
                raise ValueError('Fecha de inicio debe ser anterior a fecha final')

            # Límite de seguridad
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
            area = [lat_max, lon_min, lat_min, lon_max]  # North, West, South, East
            
            # Convertir fechas a formato requerido por CDSAPI (YYYY-MM-DD)
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

            # Crear un archivo temporal para los datos descargados
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
                    "time": ["00:00", "06:00", "12:00", "18:00"], # Obtener datos cada 6 horas
                    "format": "netcdf",
                    "area": area
                },
                dataset_path
            )

            ds = xr.open_dataset(dataset_path)
            logger.info(f"Datos descargados y abiertos: {ds.variables.keys()}")

            # Extraer y procesar los datos
            data_for_frontend = {}
            timestamps = [pd.Timestamp(t).isoformat() for t in ds.time.values]
            data_for_frontend['timestamps'] = timestamps

            # Componentes U y V a 10m
            if "u10" in ds and "v10" in ds:
                wind_speed_10m = np.sqrt(ds["u10"]**2 + ds["v10"]**2)
                data_for_frontend['wind_speed_10m'] = wind_speed_10m.values.flatten().tolist()
                # La dirección del viento se puede calcular si es necesario, pero no está en la solicitud original
                # wind_direction_10m = (np.arctan2(ds["u10"], ds["v10"]) * 180 / np.pi + 180) % 360
                # data_for_frontend['wind_direction_10m'] = wind_direction_10m.values.flatten().tolist()
            else:
                logger.warning("Variables u10 o v10 no encontradas en los datos descargados.")
                data_for_frontend['wind_speed_10m'] = []

            # Componentes U y V a 100m
            if "u100" in ds and "v100" in ds:
                wind_speed_100m = np.sqrt(ds["u100"]**2 + ds["v100"]**2)
                data_for_frontend['wind_speed_100m'] = wind_speed_100m.values.flatten().tolist()
                # wind_direction_100m = (np.arctan2(ds["u100"], ds["v100"]) * 180 / np.pi + 180) % 360
                # data_for_frontend['wind_direction_100m'] = wind_direction_100m.values.flatten().tolist()
            else:
                logger.warning("Variables u100 o v100 no encontradas en los datos descargados.")
                data_for_frontend['wind_speed_100m'] = []

            # Temperatura a 2m
            if "t2m" in ds:
                # Convertir de Kelvin a Celsius si es necesario (ERA5 suele estar en Kelvin)
                temperature_2m_celsius = ds["t2m"] - 273.15 
                data_for_frontend['temperature_2m'] = temperature_2m_celsius.values.flatten().tolist()
            else:
                logger.warning("Variable t2m no encontrada en los datos descargados.")
                data_for_frontend['temperature_2m'] = []

            # Presión superficial
            if "sp" in ds:
                 # Convertir de Pascal a hPa si es necesario (ERA5 suele estar en Pa)
                surface_pressure_hpa = ds["sp"] / 100.0
                data_for_frontend['surface_pressure'] = surface_pressure_hpa.values.flatten().tolist()
            else:
                logger.warning("Variable sp no encontrada en los datos descargados.")
                data_for_frontend['surface_pressure'] = []
            
            # Añadir metadatos como en la función de simulación para consistencia
            data_for_frontend['metadata'] = {
                'total_points': len(timestamps) * ds.latitude.size * ds.longitude.size,
                'spatial_resolution': f'{ds.latitude.size} lat x {ds.longitude.size} lon puntos',
                'temporal_resolution': f'{len(timestamps)} timesteps',
                'area': f'lat:[{lat_min},{lat_max}] lon:[{lon_min},{lon_max}]',
                'period': f'{start_date} to {end_date}',
                'test_mode': False, # Indicar que son datos reales
                'region': 'Caribe Colombiano (ERA5)',
                'generated_at': datetime.now().isoformat(),
                'version': 'era5-v1.0'
            }
            # Limpiar el archivo temporal
            os.remove(dataset_path)                         
        
        except Exception as e:
            logger.error(f"Fallo la descarga o procesamiento de datos reales: {e}")
            # Si falla la obtención de datos reales, se retornan datos simulados
            # Esto cumple con el requisito 3.
            logger.info("Retornando datos simulados debido a un error con los datos reales.")
            return self.generate_simulated_data_for_frontend(lat_min, lat_max, lon_min, lon_max, start_date, end_date)

    def generate_simulated_data_for_frontend(self, lat_min, lat_max, lon_min, lon_max, start_date, end_date):
        """
        Genera datos simulados en el formato que espera el frontend.
        Esta función se basa en la estructura de `generate_frontend_compatible_data` original,
        pero adaptada para ser llamada cuando los datos reales no están disponibles.
        """
        logger.info("🔄 Generando datos simulados compatibles con frontend")
        start = datetime.strptime(start_date, '%Y-%m-%d')
        end = datetime.strptime(end_date, '%Y-%m-%d')
        days_count = (end - start).days + 1
        
        # Puntos espaciales simulados (menos denso que los reales para simulación rápida)
        num_lat_points = 5 
        num_lon_points = 5
        spatial_points = num_lat_points * num_lon_points

        # Puntos temporales (cada 6 horas como ERA5)
        temporal_points = days_count * 4  # 4 mediciones por día
        total_points = spatial_points * temporal_points

        timestamps = []
        current_dt = start
        for _ in range(days_count):
            for hour in [0, 6, 12, 18]:
                timestamps.append((current_dt + timedelta(hours=hour)).isoformat())
            current_dt += timedelta(days=1)
        
        # Replicar timestamps para cada punto espacial si el frontend espera un array plano por variable
        # Si el frontend procesa lat/lon/time, la estructura de datos debe ser diferente.
        # Asumiendo que el frontend espera un array plano por variable, como en el código original.
        flat_total_points = len(timestamps) * spatial_points
        
        logger.info(f"📊 Generando {flat_total_points} puntos simulados ({spatial_points} espaciales × {len(timestamps)} temporales)")

        # Generar datos simulados realistas del Caribe
        wind_speed_10m = []
        wind_speed_100m = []
        surface_pressure = []
        temperature_2m = []
        # Las componentes u/v no se solicitan explícitamente para simulación, pero se podrían añadir
        # u_component_10m = []
        # v_component_10m = []
        # u_component_100m = []
        # v_component_100m = []

        base_wind_10 = 6.5
        base_wind_100 = 8.2
        base_pressure = 1013
        base_temp = 28

        for i in range(flat_total_points):
            time_factor = 0.8 + 0.4 * np.sin(2 * np.pi * ((i // spatial_points) % 4) / 4) # Ciclo diario simulado
            random_factor = 0.7 + 0.6 * random.random()
            seasonal_factor = 0.9 + 0.2 * np.sin(2 * np.pi * ((i // spatial_points) % (365*4)) / (365*4)) # Ciclo anual simulado

            wind_10 = base_wind_10 * time_factor * random_factor * seasonal_factor
            wind_speed_10m.append(round(max(1.0, min(12.0, wind_10)), 2))

            wind_100 = wind_10 * 1.27
            wind_speed_100m.append(round(max(1.5, min(15.0, wind_100)), 2))

            pressure_var = 5 * np.sin(2 * np.pi * ((i // spatial_points) % 4) / 4) + 3 * (random.random() - 0.5)
            pressure = base_pressure + pressure_var
            surface_pressure.append(round(max(1000, min(1025, pressure)), 1))

            temp_var = 4 * np.sin(2 * np.pi * ((i // spatial_points) % 4) / 4 - np.pi/4) + 2 * (random.random() - 0.5)
            temp = base_temp + temp_var * seasonal_factor
            temperature_2m.append(round(max(20, min(35, temp)), 1))
        
        # Replicar timestamps para que coincida con la longitud de los datos aplanados
        replicated_timestamps = []
        for ts in timestamps:
            replicated_timestamps.extend([ts] * spatial_points)

        simulated_data = {
            'wind_speed_10m': wind_speed_10m,
            'wind_speed_100m': wind_speed_100m,
            'surface_pressure': surface_pressure,
            'temperature_2m': temperature_2m,
            # 'u10': u_component_10m, # Añadir si es necesario
            # 'v10': v_component_10m,
            # 'u100': u_component_100m,
            # 'v100': v_component_100m,
            'timestamps': replicated_timestamps, 
            'metadata': {
                'total_points': flat_total_points,
                'spatial_resolution': f'{spatial_points} puntos simulados',
                'temporal_resolution': f'{len(timestamps)} timesteps simulados',
                'area': f'lat:[{lat_min},{lat_max}] lon:[{lon_min},{lon_max}]',
                'period': f'{start_date} to {end_date}',
                'test_mode': True, # Indicar que son datos simulados
                'region': 'Caribe Colombiano (Simulado)',
                'generated_at': datetime.now().isoformat(),
                'version': 'simulated-v1.0'
            }
        }
        logger.info("Datos simulados generados.")
        return simulated_data

@era5_bp.route('/wind-data', methods=['POST'])
def get_wind_data():
    """
    Endpoint mejorado para obtener datos de viento simulados o reales
    Versión 3.1 - Compatible con frontend (evita errores .flat())
    """
    try:
        logger.info("🚀 === INICIO SOLICITUD /wind-data v3.1 ===")
        
        # Obtener y validar datos JSON
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

        # Validación de parámetros
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

        # Obtener datos compatibles con el frontend
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

        # Formato estándar de respuesta
        response = {
            'status': 'success',
            'message': 'Datos generados exitosamente',
            'data': era5_data
        }

        # Log final
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


# Este endpoint es el que existía originalmente para datos simulados.
# Se puede mantener si se desea tener un endpoint específico para simulación,
# o eliminar si la lógica de fallback en /data es suficiente.
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
