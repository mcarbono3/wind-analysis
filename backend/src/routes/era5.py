from flask import Blueprint, request, jsonify
import logging
import os
from datetime import datetime, timedelta
from src.services.cds_config_manager import CDSConfigManager
import numpy as np
import random
import cdsapi
import xarray as xr
import tempfile
from pathlib import Path

# Configuración del logger
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

era5_bp = Blueprint("era5", __name__)

class ERA5Service:
    def __init__(self):
        self.test_mode = os.environ.get("TEST_MODE", "False").lower() == "true"
        self.config = CDSConfigManager()
        self.credentials_method = self.config.config_method
        self.cds_url, self.cds_key = self.config.get_credentials()
        logger.info(f"ERA5Service inicializado con método de credenciales: {self.credentials_method}")
        self._setup_cds_credentials()

    def _setup_cds_credentials(self):
        try:
            cds_url = os.environ.get("CDSAPI_URL")
            cds_key = os.environ.get("CDSAPI_KEY")

            if cds_url and cds_key:
                logger.info("✅ Credenciales encontradas en variables de entorno")
                self.cds_url = cds_url
                self.cds_key = cds_key
                self.credentials_method = "environment_variables"
                return

            home_cdsapirc = Path.home() / ".cdsapirc"
            current_cdsapirc = Path(".cdsapirc")
            cdsapirc_path = None
            if home_cdsapirc.exists():
                cdsapirc_path = home_cdsapirc
            elif current_cdsapirc.exists():
                cdsapirc_path = current_cdsapirc

            if cdsapirc_path:
                with open(cdsapirc_path, 'r') as f:
                    content = f.read()
                lines = content.strip().split('\n')
                config = {}
                for line in lines:
                    if ':' in line and not line.strip().startswith('#'):
                        key, value = line.split(':', 1)
                        config[key.strip()] = value.strip()
                self.cds_url = config.get('url', 'https://cds.climate.copernicus.eu/api/v2')
                self.cds_key = config.get('key')
                if self.cds_key:
                    logger.info("✅ Credenciales leídas desde archivo .cdsapirc")
                    self.credentials_method = "cdsapirc_file"
                    return

            self._create_cdsapirc_file()

        except Exception as e:
            logger.error(f"❌ Error configurando credenciales CDS: {e}")
            self.cds_url = None
            self.cds_key = None
            self.credentials_method = "none"

    def _create_cdsapirc_file(self):
        try:
            user_id = "45cfdc65-53d4-4a5e-91ed-37d24caf9c41"
            api_token = "c7cb9197-fc32-4420-8906-70a1d2e5219d"
            cdsapirc_content = f"url: https://cds.climate.copernicus.eu/api/v2\nkey: {user_id}:{api_token}\n"
            home_cdsapirc = Path.home() / ".cdsapirc"
            try:
                with open(home_cdsapirc, 'w') as f:
                    f.write(cdsapirc_content)
                os.chmod(home_cdsapirc, 0o600)
                self.cds_url = "https://cds.climate.copernicus.eu/api/v2"
                self.cds_key = f"{user_id}:{api_token}"
                self.credentials_method = "created_cdsapirc_file"
                return
            except PermissionError:
                current_cdsapirc = Path(".cdsapirc")
                with open(current_cdsapirc, 'w') as f:
                    f.write(cdsapirc_content)
                os.chmod(current_cdsapirc, 0o600)
                self.cds_url = "https://cds.climate.copernicus.eu/api/v2"
                self.cds_key = f"{user_id}:{api_token}"
                self.credentials_method = "created_cdsapirc_file_local"
        except Exception as e:
            logger.error(f"❌ Error creando archivo .cdsapirc: {e}")
            self.cds_url = "https://cds.climate.copernicus.eu/api/v2"
            self.cds_key = "45cfdc65-53d4-4a5e-91ed-37d24caf9c41:c7cb9197-fc32-4420-8906-70a1d2e5219d"
            self.credentials_method = "hardcoded_fallback"

    def get_cds_client(self):
        try:
            if self.credentials_method in ["cdsapirc_file", "created_cdsapirc_file", "created_cdsapirc_file_local"]:
                return cdsapi.Client()
            if self.cds_url and self.cds_key:
                return cdsapi.Client(url=self.cds_url, key=self.cds_key)
            return cdsapi.Client(
                url="https://cds.climate.copernicus.eu/api/v2",
                key="45cfdc65-53d4-4a5e-91ed-37d24caf9c41:c7cb9197-fc32-4420-8906-70a1d2e5219d"
            )
        except Exception as e:
            raise ValueError(f"No se pudo crear cliente CDS: {e}")

    def validate_parameters(self, data):
        required_params = ['lat_min', 'lat_max', 'lon_min', 'lon_max', 'start_date', 'end_date']
        missing_params = [param for param in required_params if param not in data]
        if missing_params:
            raise ValueError(f'Parámetros faltantes: {missing_params}')
        lat_min = float(data['lat_min'])
        lat_max = float(data['lat_max'])
        lon_min = float(data['lon_min'])
        lon_max = float(data['lon_max'])
        start_date = data['start_date']
        end_date = data['end_date']
        start_dt = datetime.strptime(start_date, '%Y-%m-%d')
        end_dt = datetime.strptime(end_date, '%Y-%m-%d')
        if start_dt > end_dt:
            raise ValueError('Fecha de inicio debe ser anterior a fecha final')
        if (end_dt - start_dt).days > 31:
            raise ValueError('Rango de fechas muy amplio (máximo 31 días)')
        return lat_min, lat_max, lon_min, lon_max, start_date, end_date

    def get_real_data(self):
        try:
            logger.info("📥 Descargando datos desde ERA5")
            client = self.get_cds_client()
            area = [13.0, -77.0, 7.0, -71.0]
            year = "2023"
            months = [f"{i:02d}" for i in range(1, 13)]
            days = [f"{i:02d}" for i in range(1, 29)]
            with tempfile.NamedTemporaryFile(suffix=".nc", delete=False) as f:
                output_path = f.name
            client.retrieve("reanalysis-era5-single-levels", {
                "product_type": "reanalysis",
                "variable": [
                    "10m_u_component_of_wind", "10m_v_component_of_wind",
                    "100m_u_component_of_wind", "100m_v_component_of_wind",
                    "2m_temperature", "surface_pressure"
                ],
                "year": year,
                "month": months,
                "day": days,
                "time": ["00:00"],
                "format": "netcdf",
                "area": area
            }, output_path)
            return output_path
        except Exception as e:
            logger.error(f"❌ Error descargando datos: {e}")
            raise

    def generate_frontend_compatible_data(self, lat_min, lat_max, lon_min, lon_max, start_date, end_date):
        try:
            output_path = self.get_real_data()
            ds = xr.open_dataset(output_path)
            wind_10m = np.sqrt(ds["u10"]**2 + ds["v10"]**2).mean(dim="time")
            wind_100m = np.sqrt(ds["u100"]**2 + ds["v100"]**2).mean(dim="time")
            temperature_2m = ds["t2m"].mean(dim="time") - 273.15
            surface_pressure = ds["sp"].mean(dim="time") / 100
            data = {
                "wind_speed_10m": wind_10m.values.flatten().tolist(),
                "wind_speed_100m": wind_100m.values.flatten().tolist(),
                "temperature_2m": temperature_2m.values.flatten().tolist(),
                "surface_pressure": surface_pressure.values.flatten().tolist(),
                "metadata": {
                    "region": "Caribe Colombiano",
                    "test_mode": self.test_mode,
                    "version": "3.2-real-full"
                }
            }
            return data
        except Exception as e:
            logger.error(f"❌ Error procesando datos reales: {e}")
            raise

era5_service = ERA5Service()

@era5_bp.route('/wind-data', methods=['POST'])
def get_wind_data():
    try:
        data = request.get_json()
        lat_min, lat_max, lon_min, lon_max, start_date, end_date = era5_service.validate_parameters(data)
        result = era5_service.generate_frontend_compatible_data(
            lat_min, lat_max, lon_min, lon_max, start_date, end_date
        )
        return jsonify({"status": "success", "data": result}), 200
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        return jsonify({"error": "Error interno del servidor"}), 500
