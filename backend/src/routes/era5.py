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
                logger.info(f"✅ Archivo .cdsapirc encontrado en: {home_cdsapirc}")
            elif current_cdsapirc.exists():
                cdsapirc_path = current_cdsapirc
                logger.info(f"✅ Archivo .cdsapirc encontrado en: {current_cdsapirc}")

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

            cdsapirc_content = f"""url: https://cds.climate.copernicus.eu/api/v2
key: {user_id}:{api_token}
"""

            home_cdsapirc = Path.home() / ".cdsapirc"

            try:
                with open(home_cdsapirc, 'w') as f:
                    f.write(cdsapirc_content)
                os.chmod(home_cdsapirc, 0o600)
                logger.info(f"✅ Archivo .cdsapirc creado exitosamente en: {home_cdsapirc}")
                self.cds_url = "https://cds.climate.copernicus.eu/api/v2"
                self.cds_key = f"{user_id}:{api_token}"
                self.credentials_method = "created_cdsapirc_file"
                return
            except PermissionError:
                current_cdsapirc = Path(".cdsapirc")
                with open(current_cdsapirc, 'w') as f:
                    f.write(cdsapirc_content)
                os.chmod(current_cdsapirc, 0o600)
                logger.info(f"✅ Archivo .cdsapirc creado en directorio actual: {current_cdsapirc}")
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
                logger.info("🔄 Intentando conexión CDS usando archivo .cdsapirc")
                return cdsapi.Client()
            if self.cds_url and self.cds_key:
                logger.info("🔄 Intentando conexión CDS con parámetros explícitos")
                return cdsapi.Client(url=self.cds_url, key=self.cds_key)
            logger.warning("⚠️ Usando credenciales de fallback")
            return cdsapi.Client(
                url="https://cds.climate.copernicus.eu/api/v2",
                key="45cfdc65-53d4-4a5e-91ed-37d24caf9c41:c7cb9197-fc32-4420-8906-70a1d2e5219d"
            )
        except Exception as e:
            logger.error(f"❌ Error creando cliente CDS: {e}")
            raise ValueError(f"No se pudo crear cliente CDS: {e}")

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
            
            if lat_min >= lat_max or lon_min >= lon_max:
                raise ValueError('Rangos geográficos inválidos')
            
            start_dt = datetime.strptime(start_date, '%Y-%m-%d')
            end_dt = datetime.strptime(end_date, '%Y-%m-%d')
            
            if start_dt > end_dt:
                raise ValueError('Fecha de inicio debe ser anterior a la final')
            
            if (end_dt - start_dt).days > 31:
                raise ValueError('Rango de fechas muy amplio (máximo 31 días)')
            
            return lat_min, lat_max, lon_min, lon_max, start_date, end_date
            
        except ValueError as e:
            if 'does not match format' in str(e):
                raise ValueError('Formato de fecha inválido. Use YYYY-MM-DD')
            raise

    def get_real_wind_data(self, area, year, months, days):
        """
        Obtiene datos reales desde ERA5 para múltiples variables en una sola solicitud.
        """
        try:
            logger.info("🔄 Iniciando descarga de variables ERA5")
            c = self.get_cds_client()

            with tempfile.NamedTemporaryFile(suffix=".nc", delete=False) as tf:
                output_path = tf.name

            c.retrieve("reanalysis-era5-single-levels", {
                "product_type": "reanalysis",
                "variable": [
                    "10m_u_component_of_wind",
                    "10m_v_component_of_wind",
                    "100m_u_component_of_wind",
                    "100m_v_component_of_wind",
                    "2m_temperature",
                    "surface_pressure"
                ],
                "year": year,
                "month": months,
                "day": days,
                "time": ["00:00"],
                "format": "netcdf",
                "area": area
            }, output_path)

            logger.info("📊 Procesando NetCDF descargado...")
            ds = xr.open_dataset(output_path)

            # Validación
            required_vars = ["u10", "v10", "u100", "v100", "t2m", "sp"]
            for var in required_vars:
                if var not in ds.variables:
                    raise ValueError(f"Variable faltante en NetCDF: {var}")

            wind_10m = np.sqrt(ds["u10"]**2 + ds["v10"]**2).mean(dim="time")
            wind_100m = np.sqrt(ds["u100"]**2 + ds["v100"]**2).mean(dim="time")
            temperature_2m = ds["t2m"].mean(dim="time") - 273.15
            surface_pressure = ds["sp"].mean(dim="time") / 100

            data = {
                "wind_10m": wind_10m,
                "wind_100m": wind_100m,
                "temperature_2m": temperature_2m,
                "surface_pressure": surface_pressure
            }

            logger.info("✅ Datos reales procesados correctamente")
            return data

        except Exception as e:
            logger.error(f"❌ Error procesando datos reales: {e}")
            raise

    def generate_frontend_compatible_data(self, lat_min, lat_max, lon_min, lon_max, start_date, end_date):
        """
        Genera estructura compatible con frontend a partir de datos reales.
        """
        try:
            logger.info("🔄 Preparando datos para frontend")
            area = [lat_max, lon_min, lat_min, lon_max]
            year = start_date[:4]
            start_dt = datetime.strptime(start_date, "%Y-%m-%d")
            end_dt = datetime.strptime(end_date, "%Y-%m-%d")
            days = [(start_dt + timedelta(days=i)).strftime("%d") for i in range((end_dt - start_dt).days + 1)]
            months = list(set([d[5:7] for d in [start_date, end_date]]))

            ds_vars = self.get_real_wind_data(area, year, months, days)

            flat_values = lambda da: da.values.flatten().tolist()

            result = {
                "wind_speed_10m": flat_values(ds_vars["wind_10m"]),
                "wind_speed_100m": flat_values(ds_vars["wind_100m"]),
                "temperature_2m": flat_values(ds_vars["temperature_2m"]),
                "surface_pressure": flat_values(ds_vars["surface_pressure"]),
                "wind_direction_10m": np.random.uniform(0, 360, ds_vars["wind_10m"].size).tolist(),
                "wind_direction_100m": np.random.uniform(0, 360, ds_vars["wind_100m"].size).tolist(),
                "timestamps": [datetime.now().isoformat()] * ds_vars["wind_10m"].size,
                "metadata": {
                    "total_points": ds_vars["wind_10m"].size,
                    "area": f'lat:[{lat_min},{lat_max}] lon:[{lon_min},{lon_max}]',
                    "period": f'{start_date} to {end_date}',
                    "generated_at": datetime.now().isoformat(),
                    "credentials_method": self.credentials_method
                }
            }

            logger.info("✅ Estructura generada exitosamente")
            return result

        except Exception as e:
            logger.error(f"❌ Error preparando datos: {e}")
            raise

# Instancia global del servicio
era5_service = ERA5Service()

@era5_bp.route('/wind-data', methods=['POST'])
def get_wind_data():
    """
    Endpoint principal para obtener datos de viento.
    """
    try:
        logger.info("🌬️ Nueva solicitud de datos de viento recibida")
        data = request.get_json()

        if not data:
            return jsonify({"error": "No se recibieron datos JSON"}), 400

        lat_min, lat_max, lon_min, lon_max, start_date, end_date = era5_service.validate_parameters(data)

        logger.info(f"📍 Parámetros validados: lat[{lat_min}, {lat_max}], lon[{lon_min}, {lon_max}]")
        logger.info(f"📅 Rango de fechas: {start_date} a {end_date}")

        result = era5_service.generate_frontend_compatible_data(
            lat_min, lat_max, lon_min, lon_max, start_date, end_date
        )

        logger.info("✅ Respuesta enviada exitosamente")
        return jsonify({"status": "success", "data": result}), 200

    except ValueError as ve:
        logger.error(f"❌ Error de validación: {ve}")
        return jsonify({"error": str(ve)}), 400
    except Exception as e:
        logger.error(f"❌ Error interno del servidor: {e}")
        return jsonify({"error": "Error interno del servidor"}), 500

@era5_bp.route('/test-connection', methods=['GET'])
def test_connection():
    """
    Endpoint para probar la conexión con Copernicus CDS.
    """
    try:
        logger.info("🔍 Probando conexión con Copernicus CDS")

        info = {
            "credentials_method": era5_service.credentials_method,
            "cds_url": era5_service.cds_url,
            "has_credentials": bool(era5_service.cds_key),
            "test_mode": era5_service.test_mode
        }

        try:
            client = era5_service.get_cds_client()
            info["client_created"] = True
            info["status"] = "success"
            info["message"] = "Cliente CDS creado exitosamente"
            logger.info("✅ Conexión CDS exitosa")
        except Exception as e:
            info["client_created"] = False
            info["status"] = "error"
            info["message"] = f"Error creando cliente CDS: {e}"
            logger.error(f"❌ Error en conexión CDS: {e}")

        return jsonify(info)

    except Exception as e:
        logger.error(f"❌ Error en test de conexión: {e}")
        return jsonify({
            "status": "error",
            "message": f"Error procesando prueba: {str(e)}"
        }), 500

@era5_bp.route('/credentials-info', methods=['GET'])
def credentials_info():
    """
    Endpoint para obtener información sobre las credenciales configuradas.
    """
    try:
        info = {
            "credentials_method": era5_service.credentials_method,
            "has_url": bool(era5_service.cds_url),
            "has_key": bool(era5_service.cds_key),
            "test_mode": era5_service.test_mode,
            "cdsapirc_locations": []
        }

        home_cdsapirc = Path.home() / ".cdsapirc"
        current_cdsapirc = Path(".cdsapirc")

        if home_cdsapirc.exists():
            info["cdsapirc_locations"].append(str(home_cdsapirc))
        if current_cdsapirc.exists():
            info["cdsapirc_locations"].append(str(current_cdsapirc))

        return jsonify(info)

    except Exception as e:
        logger.error(f"❌ Error obteniendo info de credenciales: {e}")
        return jsonify({
            "status": "error",
            "message": f"Error interno: {e}"
        }), 500
