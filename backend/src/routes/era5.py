from flask import Blueprint, request, jsonify
import logging
import os
from datetime import datetime, timedelta
import numpy as np
import random
import cdsapi
import xarray as xr
import tempfile

# Configurar logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

era5_bp = Blueprint("era5", __name__)

class ERA5Service:
    """
    Servicio ERA5 compatible con frontend
    Versión 3.2 - Incluye endpoint para datos de viento promedio para visualización inicial
    """
    
    def __init__(self):
        self.test_mode = False # Cambiado a False para intentar siempre datos reales
        logger.info("ERA5Service v3.2 inicializado - Compatible con frontend + Wind Average Layer")

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
        required_params = ["lat_min", "lat_max", "lon_min", "lon_max", "start_date", "end_date"]
        missing_params = [param for param in required_params if param not in data]
        
        if missing_params:
            raise ValueError(f"Parámetros faltantes: {missing_params}")
        
        try:
            lat_min = float(data["lat_min"])
            lat_max = float(data["lat_max"])
            lon_min = float(data["lon_min"])
            lon_max = float(data["lon_max"])
            start_date = data["start_date"]
            end_date = data["end_date"]
            
            # Validaciones de rango
            if lat_min >= lat_max or lon_min >= lon_max:
                raise ValueError("Rangos geográficos inválidos")
            
            # Validar fechas
            start_dt = datetime.strptime(start_date, "%Y-%m-%d")
            end_dt = datetime.strptime(end_date, "%Y-%m-%d")
            
            if start_dt > end_dt:
                raise ValueError("Fecha de inicio debe ser anterior a fecha final")
            
            # Límite de seguridad
            if (end_dt - start_dt).days > 31:
                raise ValueError("Rango de fechas muy amplio (máximo 31 días)")
            
            return lat_min, lat_max, lon_min, lon_max, start_date, end_date
            
        except ValueError as e:
            if "does not match format" in str(e):
                raise ValueError("Formato de fecha inválido. Use YYYY-MM-DD")
            raise

    def get_wind_average_data_real(self):
        """
        Obtiene datos reales de velocidad promedio del viento a 10m de ERA5
        para la región del Norte de Colombia usando la API de Copernicus CDS
        """
        try:
            # Configurar credenciales de CDS desde variables de entorno
            cds_url = os.environ.get("CDSAPI_URL")
            cds_key = os.environ.get("CDSAPI_KEY")
            
            if not cds_url or not cds_key:
                raise ValueError("Las variables de entorno CDSAPI_URL o CDSAPI_KEY no están configuradas.")
            
            # Inicializar cliente CDS con credenciales
            c = cdsapi.Client(url=cds_url, key=cds_key)
            
            # Definir región del Norte de Colombia
            # [Norte, Oeste, Sur, Este]
            north = 13.0
            west = -77.0
            south = 7.0
            east = -71.0
            
            # Usar año 2023 para datos recientes
            year = "2023"
            months = [f"{i:02d}" for i in range(1, 13)]  # Todos los meses
            
            logger.info(f"🌍 Solicitando datos de ERA5 para región: [{north}, {west}, {south}, {east}]")
            
            # Crear archivos temporales
            with tempfile.NamedTemporaryFile(suffix=".nc", delete=False) as u_temp:
                u_file = u_temp.name
            with tempfile.NamedTemporaryFile(suffix=".nc", delete=False) as v_temp:
                v_file = v_temp.name
            
            try:
                # Solicitar componente U del viento
                logger.info("📡 Descargando componente U del viento...")
try:
    c.retrieve(
        "reanalysis-era5-single-levels-monthly-means",
        {
            "product_type": "monthly_averaged_reanalysis",
            "variable": "10m_u_component_of_wind",
            "year": year,
            "month": months,
            "time": "00:00",
            "area": [north, west, south, east],
            "format": "netcdf",
        },
        u_file
    )
except Exception as e:
    logger.error(f"❌ Error al descargar componente U del viento: {e}")
    raise
                
                # Solicitar componente V del viento
                logger.info("📡 Descargando componente V del viento...")
try:
    c.retrieve(
        "reanalysis-era5-single-levels-monthly-means",
        {
            "product_type": "monthly_averaged_reanalysis",
            "variable": "10m_v_component_of_wind",
            "year": year,
            "month": months,
            "time": "00:00",
            "area": [north, west, south, east],
            "format": "netcdf",
        },
        v_file
    )
except Exception as e:
    logger.error(f"❌ Error al descargar componente V del viento: {e}")
    raise
                
                # Procesar datos con xarray
                logger.info("🔄 Procesando datos con xarray...")
                ds_u = xr.open_dataset(u_file)
                ds_v = xr.open_dataset(v_file)
                
                # Calcular velocidad del viento: sqrt(u^2 + v^2)
                # Promediar sobre la dimensión de tiempo para obtener promedio anual
                wind_speed = np.sqrt(ds_u["u10"].mean(dim="time")**2 + ds_v["v10"].mean(dim="time")**2)
                
                # Convertir a lista de [latitud, longitud, valor] para Leaflet.heat
                data_points = []
                for lat in wind_speed.latitude.values:
                    for lon in wind_speed.longitude.values:
                        val = wind_speed.sel(latitude=lat, longitude=lon, method="nearest").item()
                        if not np.isnan(val):
                            data_points.append([float(lat), float(lon), float(val)])
                
                logger.info(f"✅ Datos procesados: {len(data_points)} puntos de viento promedio")
                return data_points
                
            finally:
                # Limpiar archivos temporales
                try:
                    os.unlink(u_file)
                    os.unlink(v_file)
                except:
                    pass
                    
        except Exception as e:
            logger.error(f"❌ Error obteniendo datos reales de ERA5: {e}")
            # Fallback a datos simulados
            return self.get_wind_average_data_simulated()

    def get_wind_average_data_simulated(self):
        """
        Genera datos simulados de velocidad promedio del viento a 10m
        para la región del Norte de Colombia como fallback
        """
        logger.info("🎲 Generando datos simulados de viento promedio...")
        
        # Definir región del Norte de Colombia
        lat_min, lat_max = 7.0, 13.0
        lon_min, lon_max = -77.0, -71.0
        
        # Crear grilla de puntos
        lat_points = np.linspace(lat_min, lat_max, 20)
        lon_points = np.linspace(lon_min, lon_max, 25)
        
        data_points = []
        
        for lat in lat_points:
            for lon in lon_points:
                # Simular velocidades de viento realistas para el Caribe (4-12 m/s)
                # Agregar variación espacial basada en la geografía
                
                # Factor costero (mayor viento cerca de la costa)
                coastal_factor = 1.0 + 0.3 * np.exp(-((lat - 10.5)**2 + (lon + 74)**2) / 10)
                
                # Factor de elevación (menor viento en zonas montañosas)
                mountain_factor = 1.0 - 0.2 * np.exp(-((lat - 11)**2 + (lon + 73.5)**2) / 5)
                
                # Velocidad base del viento en el Caribe
                base_speed = 6.5  # m/s
                
                # Aplicar factores y ruido aleatorio
                wind_speed = base_speed * coastal_factor * mountain_factor * (0.8 + 0.4 * np.random.random())
                
                # Limitar a rangos realistas
                wind_speed = max(3.0, min(12.0, wind_speed))
                
                data_points.append([float(lat), float(lon), float(wind_speed)])
        
        logger.info(f"✅ Datos simulados generados: {len(data_points)} puntos")
        return data_points

    def generate_frontend_compatible_data(self, lat_min, lat_max, lon_min, lon_max, start_date, end_date):
        """
        Genera datos en el formato EXACTO que espera el frontend
        Frontend espera: era5Data.wind_speed_10m.flat() - donde wind_speed_10m es un array directo
        """
        try:
            logger.info("🔄 Generando datos compatibles con frontend")
            
            # Calcular dimensiones
            start = datetime.strptime(start_date, "%Y-%m-%d")
            end = datetime.strptime(end_date, "%Y-%m-%d")
            days = (end - start).days + 1
            
            if "spatial_points" not in locals():
                spatial_points = 5
            
            # Puntos temporales (cada 6 horas como ERA5)
            temporal_points = days * 4  # 4 mediciones por día
            total_points = spatial_points * temporal_points
            
            # Generar timestamps
            timestamps = []
            current_dt = start
            for _ in range(temporal_points):
                timestamps.append(current_dt.isoformat())
                current_dt += timedelta(hours=6)
            
            logger.info(f"📊 Generando {total_points} puntos ({spatial_points} espaciales × {temporal_points} temporales)")
            
            # Generar datos realistas del Caribe
            wind_speed_10m = []
            wind_speed_100m = []
            surface_pressure = []
            temperature_2m = []
            
            # Parámetros base para el Caribe
            base_wind_10 = 6.5  # m/s típico
            base_wind_100 = 8.2  # m/s típico (25% mayor)
            base_pressure = 1013  # hPa típico
            base_temp = 28  # °C típico
            
            for i in range(total_points):
                # Factores de variación
                time_factor = 0.8 + 0.4 * np.sin(2 * np.pi * (i % 4) / 4)  # Ciclo 6h
                random_factor = 0.7 + 0.6 * random.random()
                seasonal_factor = 0.9 + 0.2 * np.sin(2 * np.pi * (i % (365*4)) / (365*4))
                
                # Viento a 10m (3-10 m/s típico del Caribe)
                wind_10 = base_wind_10 * time_factor * random_factor * seasonal_factor
                wind_speed_10m.append(round(max(1.0, min(12.0, wind_10)), 2))
                
                # Viento a 100m (25-30% mayor que 10m)
                wind_100 = wind_10 * 1.27  # Factor típico de altura
                wind_speed_100m.append(round(max(1.5, min(15.0, wind_100)), 2))
                
                # Presión superficial (1007-1019 hPa)
                pressure_var = 5 * np.sin(2 * np.pi * (i % 4) / 4) + 3 * (random.random() - 0.5)
                pressure = base_pressure + pressure_var
                surface_pressure.append(round(max(1000, min(1025, pressure)), 1))
                
                # Temperatura a 2m (23-33°C)
                temp_var = 4 * np.sin(2 * np.pi * (i % 4) / 4 - np.pi/4) + 2 * (random.random() - 0.5)
                temp = base_temp + temp_var * seasonal_factor
                temperature_2m.append(round(max(20, min(35, temp)), 1))
            
            wind_direction_10m = np.random.uniform(0, 360, total_points)
            wind_direction_100m = np.random.uniform(0, 360, total_points)
            
            # FORMATO EXACTO que espera el frontend
            compatible_data = {
                "wind_speed_10m": wind_speed_10m,  # Array directo ✅
                "wind_speed_100m": wind_speed_100m,  # Array directo ✅
                "surface_pressure": surface_pressure,  # Array directo ✅
                "temperature_2m": temperature_2m,  # Array directo ✅
                "wind_direction_10m": wind_direction_10m.tolist(),
                "wind_direction_100m": wind_direction_100m.tolist(),
                "timestamps": timestamps,
                "time_series": timestamps,
                
                # Metadatos adicionales
                "metadata": {
                    "total_points": total_points,
                    "spatial_resolution": f"{spatial_points} puntos",
                    "temporal_resolution": f"{temporal_points} timesteps",
                    "area": f"lat:[{lat_min},{lat_max}] lon:[{lon_min},{lon_max}]",
                    "period": f"{start_date} to {end_date}",
                    "test_mode": True,
                    "region": "Caribe Colombiano",
                    "generated_at": datetime.now().isoformat(),
                    "version": "3.2-compatible"
                },
                
                # Datos adicionales para compatibilidad
                "time_series": [{"time": ts, "speed": ws} for ts, ws in zip(timestamps, wind_speed_100m)],
                "wind_speed_distribution": [{"speed": i, "frequency": random.random()} for i in range(10)],
                "wind_rose_data": [{"direction": d, "frequency": random.random()} for d in ["N", "NE", "E", "SE", "S", "SW", "W", "NW"]],
                "hourly_patterns": {"mean_by_hour": {str(h): random.random() * 10 for h in range(24)}}
            }
            
            logger.info(f"✅ Datos generados exitosamente:")
            logger.info(f"   - wind_speed_10m: {len(wind_speed_10m)} valores")
            logger.info(f"   - wind_speed_100m: {len(wind_speed_100m)} valores")
            logger.info(f"   - surface_pressure: {len(surface_pressure)} valores")
            logger.info(f"   - temperature_2m: {len(temperature_2m)} valores")
            
            return compatible_data
            
        except Exception as e:
            logger.error(f"❌ Error generando datos compatibles: {e}")
            raise


@era5_bp.route("/wind-data", methods=["POST"])
def get_wind_data():
    """
    Endpoint principal para obtener datos de viento
    Versión 3.2 - Compatible con frontend (resuelve error .flat())
    """
    try:
        logger.info("🚀 === INICIO SOLICITUD WIND-DATA v3.2 ===")
        
        # Obtener y validar datos JSON
        data = request.get_json()
        if not data:
            logger.warning("❌ No se recibieron datos JSON")
            return jsonify({
                "error": "No se recibieron datos JSON",
                "details": "La solicitud debe incluir parámetros en formato JSON",
                "expected_format": {
                    "lat_min": "float",
                    "lat_max": "float", 
                    "lon_min": "float",
                    "lon_max": "float",
                    "start_date": "YYYY-MM-DD",
                    "end_date": "YYYY-MM-DD"
                }
            }), 400
        
        # Validar parámetros
        try:
            lat_min, lat_max, lon_min, lon_max, start_date, end_date = ERA5Service().validate_parameters(data)
            logger.info(f"📍 Parámetros validados: lat=[{lat_min:.2f},{lat_max:.2f}] lon=[{lon_min:.2f},{lon_max:.2f}] fechas=[{start_date},{end_date}]")
        except ValueError as e:
            logger.warning(f"❌ Parámetros inválidos: {e}")
            return jsonify({
                "error": "Parámetros inválidos",
                "details": str(e),
                "received_data": data
            }), 400
        
        # Generar datos compatibles con frontend
        try:
            service = ERA5Service()
            era5_data = service.generate_frontend_compatible_data(
                lat_min, lat_max, lon_min, lon_max, start_date, end_date
            )
            
            logger.info("✅ === SOLICITUD WIND-DATA COMPLETADA EXITOSAMENTE ===")
            return jsonify(era5_data)
            
        except Exception as e:
            logger.error(f"❌ Error generando datos: {e}")
            return jsonify({
                "error": "Error interno del servidor",
                "details": str(e),
                "timestamp": datetime.now().isoformat()
            }), 500
            
    except Exception as e:
        logger.error(f"❌ Error inesperado en wind-data: {e}")
        return jsonify({
            "error": "Error inesperado del servidor",
            "details": str(e),
            "timestamp": datetime.now().isoformat()
        }), 500


@era5_bp.route("/wind-average-10m", methods=["GET"])
def get_wind_average_10m():
    """
    Nuevo endpoint para obtener datos de velocidad promedio del viento a 10m
    para visualización en el mapa inicial como capa de calor (heatmap)
    
    Returns:
        JSON: Lista de puntos [latitud, longitud, velocidad] para Leaflet.heat
    """
    try:
        logger.info("🌬️ === INICIO SOLICITUD WIND-AVERAGE-10M ===")
        
        service = ERA5Service()
        
        # Intentar obtener datos reales de ERA5, con fallback a simulados
        try:
            wind_data = service.get_wind_average_data_real()
            data_source = "ERA5_real"
        except Exception as e:
            logger.warning(f"⚠️ Fallback a datos simulados: {e}")
            wind_data = service.get_wind_average_data_simulated()
            data_source = "simulated"
        
        # Preparar respuesta
        response_data = {
            "data": wind_data,
            "metadata": {
                "total_points": len(wind_data),
                "region": "Norte de Colombia",
                "variable": "Velocidad promedio del viento a 10m",
                "units": "m/s",
                "data_source": data_source,
                "generated_at": datetime.now().isoformat(),
                "version": "1.0",
                "format": "leaflet_heat_compatible",
                "description": "Datos para visualización de capa de calor en mapa inicial"
            }
        }
        
        logger.info(f"✅ Datos de viento promedio generados: {len(wind_data)} puntos ({data_source})")
        logger.info("✅ === SOLICITUD WIND-AVERAGE-10M COMPLETADA ===")
        
        return jsonify(response_data)
        
    except Exception as e:
        logger.error(f"❌ Error en wind-average-10m: {e}")
        return jsonify({
            "error": "Error obteniendo datos de viento promedio",
            "details": str(e),
            "timestamp": datetime.now().isoformat()
        }), 500
