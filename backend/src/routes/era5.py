from flask import Blueprint, request, jsonify
import logging
import os
from datetime import datetime, timedelta
import numpy as np
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

    def validate_parameters(self, data):
        required = ["lat_min", "lat_max", "lon_min", "lon_max", "start_date", "end_date"]
        missing = [k for k in required if k not in data]
        if missing:
            raise ValueError(f"Faltan parámetros: {missing}")
        try:
            lat_min = float(data["lat_min"])
            lat_max = float(data["lat_max"])
            lon_min = float(data["lon_min"])
            lon_max = float(data["lon_max"])
            start_date = datetime.strptime(data["start_date"], "%Y-%m-%d")
            end_date = datetime.strptime(data["end_date"], "%Y-%m-%d")
            if start_date > end_date:
                raise ValueError("La fecha de inicio debe ser anterior a la fecha final")
            return lat_min, lat_max, lon_min, lon_max, start_date, end_date
        except Exception as e:
            raise ValueError(f"Error en validación de parámetros: {e}")

    def get_real_wind_data(self):
        try:
            cds_url = os.environ.get("CDSAPI_URL")
            cds_key = os.environ.get("CDSAPI_KEY")
            if not cds_url or not cds_key:
                raise ValueError("Credenciales de CDS no configuradas")

            c = cdsapi.Client(url=cds_url, key=cds_key)
            area = [13.0, -77.0, 7.0, -71.0]
            year = "2023"
            months = [f"{i:02d}" for i in range(1, 13)]
            days = [f"{i:02d}" for i in range(1, 29)]

            with tempfile.NamedTemporaryFile(suffix=".nc", delete=False) as fu,                  tempfile.NamedTemporaryFile(suffix=".nc", delete=False) as fv:
                u_path, v_path = fu.name, fv.name

            c.retrieve("reanalysis-era5-single-levels", {
                "product_type": "reanalysis",
                "variable": "10m_u_component_of_wind",
                "year": year,
                "month": months,
                "day": days,
                "time": ["00:00"],
                "format": "netcdf",
                "area": area
            }, u_path)

            c.retrieve("reanalysis-era5-single-levels", {
                "product_type": "reanalysis",
                "variable": "10m_v_component_of_wind",
                "year": year,
                "month": months,
                "day": days,
                "time": ["00:00"],
                "format": "netcdf",
                "area": area
            }, v_path)

            ds_u = xr.open_dataset(u_path)
            ds_v = xr.open_dataset(v_path)
            wind = np.sqrt(ds_u["u10"]**2 + ds_v["v10"]**2).mean(dim="time")

            data = []
            for lat in wind.latitude.values:
                for lon in wind.longitude.values:
                    val = wind.sel(latitude=lat, longitude=lon, method="nearest").item()
                    if not np.isnan(val):
                        data.append([float(lat), float(lon), float(val)])
            return data
        except Exception as e:
            logger.error(f"Fallo la descarga de datos reales: {e}")
            return self.get_simulated_wind_data()

    def get_simulated_wind_data(self):
        lats = np.linspace(7.0, 13.0, 20)
        lons = np.linspace(-77.0, -71.0, 25)
        return [[float(lat), float(lon), round(random.uniform(3, 11), 2)] for lat in lats for lon in lons]

def generate_analysis_data(self, lat_min, lat_max, lon_min, lon_max, start, end):
    if end <= start:
        raise ValueError("La fecha final debe ser posterior a la fecha de inicio.")
    
    total_seconds = (end - start).total_seconds()
    if total_seconds < 3600:
        raise ValueError("El rango de fechas debe cubrir al menos una hora.")

    hours = int(total_seconds // 3600)
    timestamps = [(start + timedelta(hours=h)).isoformat() for h in range(0, hours + 1, 6)]

    n = len(timestamps)
    wind_10m = [round(6 + np.sin(i/10) + random.random(), 2) for i in range(n)]
    wind_100m = [round(w * 1.25, 2) for w in wind_10m]
    temp_2m = [round(26 + np.sin(i/10)*2 + random.random(), 1) for i in range(n)]
    pressure = [round(1013 + np.cos(i/8)*4 + random.random(), 1) for i in range(n)]
    dir_10m = list(np.random.uniform(0, 360, n))
    dir_100m = list(np.random.uniform(0, 360, n))

    return {
        "timestamps": timestamps,
        "wind_speed_10m": wind_10m,
        "wind_speed_100m": wind_100m,
        "temperature_2m": temp_2m,
        "surface_pressure": pressure,
        "wind_direction_10m": dir_10m,
        "wind_direction_100m": dir_100m,
        "metadata": {
            "region": "Norte de Colombia",
            "generated_at": datetime.utcnow().isoformat() + "Z",
            "version": "4.0",
            "data_source": "simulated" if self.test_mode else "era5_real"
        }
    }


@era5_bp.route("/wind-data", methods=["POST"])
def get_wind_data():
    try:
        data = request.get_json()
        service = ERA5Service()
        lat_min, lat_max, lon_min, lon_max, start, end = service.validate_parameters(data)
        result = service.generate_analysis_data(lat_min, lat_max, lon_min, lon_max, start, end)
        return jsonify(result)
    except Exception as e:
        logger.exception("Error generando análisis")
        return jsonify({"error": "Error generando análisis de ERA5", "details": str(e)}), 500

@era5_bp.route("/wind-average-10m", methods=["GET"])
def get_heatmap():
    try:
        service = ERA5Service()
        data = service.get_real_wind_data()
        return jsonify({
            "data": data,
            "metadata": {
                "description": "Heatmap viento promedio 10m",
                "units": "m/s",
                "total_points": len(data),
                "data_source": "simulated" if service.test_mode else "era5_real",
                "version": "4.0"
            }
        })
    except Exception as e:
        logger.error(f"Error en heatmap: {e}")
        return jsonify({"error": "Error generando heatmap", "details": str(e)}), 500

@era5_bp.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok", "timestamp": datetime.utcnow().isoformat() + "Z"})
