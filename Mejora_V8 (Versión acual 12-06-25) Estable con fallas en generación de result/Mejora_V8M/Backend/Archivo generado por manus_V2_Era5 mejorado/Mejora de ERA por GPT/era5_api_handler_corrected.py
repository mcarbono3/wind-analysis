
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
    def __init__(self):
        self.test_mode = False
        logger.info("ERA5Service v3.2 inicializado - Compatible con frontend + Wind Average Layer")

    def safe_get(self, lst, index, default=None):
        try:
            if lst and isinstance(lst, list) and 0 <= index < len(lst):
                return lst[index]
            return default
        except (TypeError, IndexError):
            return default

    def validate_parameters(self, data):
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
            if lat_min >= lat_max or lon_min >= lon_max:
                raise ValueError("Rangos geográficos inválidos")
            start_dt = datetime.strptime(start_date, "%Y-%m-%d")
            end_dt = datetime.strptime(end_date, "%Y-%m-%d")
            if start_dt > end_dt:
                raise ValueError("Fecha de inicio debe ser anterior a fecha final")
            if (end_dt - start_dt).days > 31:
                raise ValueError("Rango de fechas muy amplio (máximo 31 días)")
            return lat_min, lat_max, lon_min, lon_max, start_date, end_date
        except ValueError as e:
            if "does not match format" in str(e):
                raise ValueError("Formato de fecha inválido. Use YYYY-MM-DD")
            raise

    def get_wind_average_data_real(self):
        try:
            cds_url = os.environ.get("CDSAPI_URL")
            cds_key = os.environ.get("CDSAPI_KEY")
            if not cds_url or not cds_key:
                raise ValueError("Las variables de entorno CDSAPI_URL o CDSAPI_KEY no están configuradas.")
            c = cdsapi.Client(url=cds_url, key=cds_key)
            north, west, south, east = 13.0, -77.0, 7.0, -71.0
            year = "2023"
            months = [f"{i:02d}" for i in range(1, 13)]
            logger.info(f"🌍 Solicitando datos de ERA5 para región: [{north}, {west}, {south}, {east}]")
            with tempfile.NamedTemporaryFile(suffix=".nc", delete=False) as u_temp:
                u_file = u_temp.name
            with tempfile.NamedTemporaryFile(suffix=".nc", delete=False) as v_temp:
                v_file = v_temp.name
            try:
                logger.info("📡 Descargando componente U del viento...")
                try:
                    c.retrieve(
                        "reanalysis-era5-single-levels",
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
                logger.info("📡 Descargando componente V del viento...")
                try:
                    c.retrieve(
                        "reanalysis-era5-single-levels",
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
                logger.info("🔄 Procesando datos con xarray...")
                ds_u = xr.open_dataset(u_file)
                ds_v = xr.open_dataset(v_file)
                wind_speed = np.sqrt(ds_u["u10"].mean(dim="time")**2 + ds_v["v10"].mean(dim="time")**2)
                data_points = []
                for lat in wind_speed.latitude.values:
                    for lon in wind_speed.longitude.values:
                        val = wind_speed.sel(latitude=lat, longitude=lon, method="nearest").item()
                        if not np.isnan(val):
                            data_points.append([float(lat), float(lon), float(val)])
                logger.info(f"✅ Datos procesados: {len(data_points)} puntos de viento promedio")
                return data_points
            finally:
                try:
                    os.unlink(u_file)
                    os.unlink(v_file)
                except:
                    pass
        except Exception as e:
            logger.error(f"❌ Error obteniendo datos reales de ERA5: {e}")
            return self.get_wind_average_data_simulated()

    def get_wind_average_data_simulated(self):
        logger.info("🎲 Generando datos simulados de viento promedio...")
        lat_min, lat_max = 7.0, 13.0
        lon_min, lon_max = -77.0, -71.0
        lat_points = np.linspace(lat_min, lat_max, 20)
        lon_points = np.linspace(lon_min, lon_max, 25)
        data_points = []
        for lat in lat_points:
            for lon in lon_points:
                coastal_factor = 1.0 + 0.3 * np.exp(-((lat - 10.5)**2 + (lon + 74)**2) / 10)
                mountain_factor = 1.0 - 0.2 * np.exp(-((lat - 11)**2 + (lon + 73.5)**2) / 5)
                base_speed = 6.5
                wind_speed = base_speed * coastal_factor * mountain_factor * (0.8 + 0.4 * np.random.random())
                wind_speed = max(3.0, min(12.0, wind_speed))
                data_points.append([float(lat), float(lon), float(wind_speed)])
        logger.info(f"✅ Datos simulados generados: {len(data_points)} puntos")
        return data_points
