"""
Servicio para descarga y procesamiento de datos MERRA-2 desde NASA GES DISC
Compatible con la estructura de respuesta JSON de ERA5
"""

import logging
import os
import tempfile
from datetime import datetime, timedelta
from typing import Dict, List, Tuple, Optional
import numpy as np
import pandas as pd
import xarray as xr
import requests
from src.services.nasa_config_manager import NASAConfigManager

# Configuración del logger
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class MERRA2Service:
    """
    Servicio para descarga y procesamiento de datos MERRA-2.
    Mantiene compatibilidad con la estructura de respuesta de ERA5.
    """
    
    def __init__(self):
        """
        Inicializa el servicio MERRA-2.
        """
        self.test_mode = os.environ.get("TEST_MODE", "False").lower() == "true"
        self.config_manager = NASAConfigManager()
        logger.info(f"MERRA2Service inicializado (test_mode={self.test_mode})")
    
    def validate_parameters(self, data: Dict) -> Tuple[float, float, float, float, str, str]:
        """
        Valida los parámetros de entrada.
        
        Args:
            data: Diccionario con parámetros de entrada
            
        Returns:
            Tuple con parámetros validados
            
        Raises:
            ValueError: Si los parámetros son inválidos
        """
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
    
    def download_merra2_file(self, url: str, local_path: str) -> bool:
        """
        Descarga un archivo MERRA-2 desde NASA GES DISC.
        
        Args:
            url: URL del archivo MERRA-2
            local_path: Ruta local donde guardar el archivo
            
        Returns:
            bool: True si la descarga fue exitosa
        """
        try:
            session = self.config_manager.get_auth_session()
            
            logger.info(f"Descargando: {url}")
            response = session.get(url, stream=True, timeout=300)
            
            if response.status_code == 200:
                with open(local_path, 'wb') as f:
                    for chunk in response.iter_content(chunk_size=8192):
                        if chunk:
                            f.write(chunk)
                
                file_size = os.path.getsize(local_path)
                logger.info(f"Descarga exitosa: {file_size} bytes")
                return True
            
            elif response.status_code == 404:
                logger.warning(f"Archivo no encontrado: {url}")
                return False
            
            elif response.status_code == 401:
                logger.error("Error de autenticación en descarga")
                return False
            
            else:
                logger.error(f"Error en descarga: HTTP {response.status_code}")
                return False
                
        except Exception as e:
            logger.error(f"Error descargando archivo: {e}")
            return False
    
    def process_merra2_data(self, file_path: str, lat_min: float, lat_max: float, 
                           lon_min: float, lon_max: float) -> Optional[xr.Dataset]:
        """
        Procesa un archivo MERRA-2 y extrae la región de interés.
        
        Args:
            file_path: Ruta al archivo NetCDF
            lat_min, lat_max, lon_min, lon_max: Límites geográficos
            
        Returns:
            xr.Dataset: Dataset procesado o None si hay error
        """
        try:
            # Abrir dataset
            ds = xr.open_dataset(file_path)
            logger.info(f"Dataset abierto: {list(ds.variables.keys())}")
            
            # Ajustar longitudes si es necesario (MERRA-2 usa 0-360)
            if 'lon' in ds.coords:
                lon_coord = 'lon'
            elif 'longitude' in ds.coords:
                lon_coord = 'longitude'
            else:
                logger.error("No se encontró coordenada de longitud")
                return None
            
            # Convertir longitudes negativas a 0-360 si es necesario
            if lon_min < 0:
                lon_min = lon_min + 360
            if lon_max < 0:
                lon_max = lon_max + 360
            
            # Seleccionar región geográfica
            if 'lat' in ds.coords:
                lat_coord = 'lat'
            elif 'latitude' in ds.coords:
                lat_coord = 'latitude'
            else:
                logger.error("No se encontró coordenada de latitud")
                return None
            
            # Filtrar por región
            ds_region = ds.sel(
                {lat_coord: slice(lat_min, lat_max),
                 lon_coord: slice(lon_min, lon_max)}
            )
            
            logger.info(f"Región extraída: {ds_region.sizes}")
            return ds_region
            
        except Exception as e:
            logger.error(f"Error procesando archivo MERRA-2: {e}")
            return None
    
    def convert_to_era5_format(self, datasets: List[xr.Dataset], 
                              lat_min: float, lat_max: float, 
                              lon_min: float, lon_max: float, 
                              start_date: str, end_date: str) -> Dict:
        """
        Convierte datos MERRA-2 al formato de respuesta compatible con ERA5.
        
        Args:
            datasets: Lista de datasets MERRA-2 procesados
            lat_min, lat_max, lon_min, lon_max: Límites geográficos
            start_date, end_date: Fechas de inicio y fin
            
        Returns:
            Dict: Datos en formato compatible con ERA5
        """
        try:
            # Combinar todos los datasets
            if not datasets:
                raise ValueError("No hay datasets para procesar")
            
            combined_ds = xr.concat(datasets, dim='time')
            combined_ds = combined_ds.sortby('time')
            
            # Mapeo de variables MERRA-2 a ERA5
            var_mapping = {
                'U10M': 'u10',      # Viento U a 10m
                'V10M': 'v10',      # Viento V a 10m
                'T2M': 't2m',       # Temperatura a 2m
                'PS': 'sp'          # Presión superficial
            }
            
            # Extraer timestamps
            timestamps = [pd.Timestamp(t).isoformat() for t in combined_ds.time.values]
            
            # Inicializar estructura de datos
            data_for_frontend = {
                'timestamps': timestamps,
                'wind_speed_10m': [],
                'wind_direction_10m': [],
                'wind_speed_100m': [],  # MERRA-2 no tiene 100m, usar extrapolación
                'wind_direction_100m': [],
                'temperature_2m': [],
                'surface_pressure': []
            }
            
            # Procesar componentes de viento a 10m
            if 'U10M' in combined_ds and 'V10M' in combined_ds:
                u10 = combined_ds['U10M']
                v10 = combined_ds['V10M']
                
                # Calcular velocidad y dirección del viento
                wind_speed_10m = np.sqrt(u10**2 + v10**2)
                wind_direction_10m = (180 / np.pi) * np.arctan2(u10, v10)
                wind_direction_10m = (wind_direction_10m + 360) % 360
                
                data_for_frontend['wind_speed_10m'] = wind_speed_10m.values.flatten().tolist()
                data_for_frontend['wind_direction_10m'] = wind_direction_10m.values.flatten().tolist()
                
                # Extrapolación a 100m usando ley de potencia (exponente ~0.1 para océano)
                wind_speed_100m = wind_speed_10m * (100/10)**0.1
                data_for_frontend['wind_speed_100m'] = wind_speed_100m.values.flatten().tolist()
                data_for_frontend['wind_direction_100m'] = wind_direction_10m.values.flatten().tolist()
            
            else:
                logger.warning("Variables de viento U10M o V10M no encontradas")
                # Llenar con listas vacías
                data_for_frontend['wind_speed_10m'] = []
                data_for_frontend['wind_direction_10m'] = []
                data_for_frontend['wind_speed_100m'] = []
                data_for_frontend['wind_direction_100m'] = []
            
            # Procesar temperatura
            if 'T2M' in combined_ds:
                # MERRA-2 T2M ya está en Kelvin, convertir a Celsius
                temperature_2m_celsius = combined_ds['T2M'] - 273.15
                data_for_frontend['temperature_2m'] = temperature_2m_celsius.values.flatten().tolist()
            else:
                logger.warning("Variable T2M no encontrada")
                data_for_frontend['temperature_2m'] = []
            
            # Procesar presión superficial
            if 'PS' in combined_ds:
                # MERRA-2 PS está en Pa, convertir a hPa
                surface_pressure_hpa = combined_ds['PS'] / 100.0
                data_for_frontend['surface_pressure'] = surface_pressure_hpa.values.flatten().tolist()
            else:
                logger.warning("Variable PS no encontrada")
                data_for_frontend['surface_pressure'] = []
            
            # Generar análisis adicionales (compatibles con ERA5)
            if data_for_frontend['wind_speed_10m'] and data_for_frontend['wind_direction_10m']:
                wind_df = pd.DataFrame({
                    "timestamp": pd.to_datetime(timestamps),
                    "speed": data_for_frontend["wind_speed_10m"],
                    "direction": data_for_frontend["wind_direction_10m"]
                })
                
                # Rosa de vientos
                bins = np.arange(0, 361, 30)
                labels = [f"{i}-{i+30}" for i in bins[:-1]]
                wind_df["dir_bin"] = pd.cut(wind_df["direction"], bins=bins, labels=labels, right=False)
                data_for_frontend["wind_rose_data"] = wind_df.groupby("dir_bin")["speed"].count().reindex(labels, fill_value=0).to_dict()
                
                # Patrones horarios
                wind_df["hour"] = wind_df["timestamp"].dt.hour
                data_for_frontend["hourly_patterns"] = wind_df.groupby("hour")["speed"].mean().round(2).to_dict()
                
                # Series temporales
                wind_df["date"] = wind_df["timestamp"].dt.date
                daily_avg = wind_df.groupby("date")["speed"].mean().round(2)
                data_for_frontend["time_series"] = {date.isoformat(): val for date, val in daily_avg.items()}
            
            else:
                # Valores por defecto si no hay datos de viento
                data_for_frontend["wind_rose_data"] = {}
                data_for_frontend["hourly_patterns"] = {}
                data_for_frontend["time_series"] = {}
            
            # Metadatos
            data_for_frontend['metadata'] = {
                'total_points': len(timestamps) * combined_ds.sizes.get('lat', 1) * combined_ds.sizes.get('lon', 1),
                'spatial_resolution': f'{combined_ds.sizes.get("lat", 1)} lat x {combined_ds.sizes.get("lon", 1)} lon puntos',
                'temporal_resolution': f'{len(timestamps)} timesteps',
                'area': f'lat:[{lat_min},{lat_max}] lon:[{lon_min},{lon_max}]',
                'period': f'{start_date} to {end_date}',
                'test_mode': False,
                'region': 'Caribe Colombiano (MERRA-2)',
                'generated_at': datetime.now().isoformat(),
                'version': 'merra2-v1.0'
            }
            
            return data_for_frontend
            
        except Exception as e:
            logger.error(f"Error convirtiendo datos MERRA-2: {e}")
            raise
    
    def get_merra2_data(self, lat_min: float, lat_max: float, lon_min: float, lon_max: float, 
                       start_date: str, end_date: str) -> Dict:
        """
        Función principal para obtener datos MERRA-2.
        
        Args:
            lat_min, lat_max: Límites de latitud
            lon_min, lon_max: Límites de longitud
            start_date, end_date: Fechas en formato YYYY-MM-DD
            
        Returns:
            Dict: Datos en formato compatible con ERA5
        """
        try:
            logger.info(f"Iniciando descarga MERRA-2 para área: lat=[{lat_min},{lat_max}], lon=[{lon_min},{lon_max}]")
            logger.info(f"Período: {start_date} a {end_date}")
            
            # Generar lista de fechas
            start_dt = datetime.strptime(start_date, '%Y-%m-%d')
            end_dt = datetime.strptime(end_date, '%Y-%m-%d')
            dates = [start_dt + timedelta(days=x) for x in range((end_dt - start_dt).days + 1)]
            
            datasets = []
            temp_files = []
            
            try:
                # Descargar archivos para cada fecha
                for date in dates:
                    year = date.strftime('%Y')
                    month = date.strftime('%m')
                    day = date.strftime('%d')
                    
                    # Obtener URLs para esta fecha
                    urls = self.config_manager.get_merra2_urls(year, month, day)
                    
                    # Descargar archivo SLV (Single-Level Variables)
                    slv_url = urls['slv']
                    
                    # Crear archivo temporal
                    with tempfile.NamedTemporaryFile(suffix=".nc4", delete=False) as tmp_file:
                        temp_path = tmp_file.name
                        temp_files.append(temp_path)
                    
                    # Descargar archivo
                    if self.download_merra2_file(slv_url, temp_path):
                        # Procesar archivo
                        ds = self.process_merra2_data(temp_path, lat_min, lat_max, lon_min, lon_max)
                        if ds is not None:
                            datasets.append(ds)
                        else:
                            logger.warning(f"No se pudo procesar archivo para {date.strftime('%Y-%m-%d')}")
                    else:
                        logger.warning(f"No se pudo descargar archivo para {date.strftime('%Y-%m-%d')}")
                
                if not datasets:
                    raise ValueError("No se pudieron descargar datos para ninguna fecha")
                
                # Convertir a formato ERA5
                result = self.convert_to_era5_format(datasets, lat_min, lat_max, lon_min, lon_max, start_date, end_date)
                
                logger.info("Datos MERRA-2 procesados exitosamente")
                return result
                
            finally:
                # Limpiar archivos temporales
                for temp_file in temp_files:
                    try:
                        if os.path.exists(temp_file):
                            os.unlink(temp_file)
                    except Exception as e:
                        logger.warning(f"No se pudo eliminar archivo temporal {temp_file}: {e}")
                
                # Cerrar datasets
                for ds in datasets:
                    try:
                        ds.close()
                    except:
                        pass
        
        except Exception as e:
            logger.error(f"Error en get_merra2_data: {e}")
            raise
    
    def generate_simulated_merra2_data(self, lat_min: float, lat_max: float, 
                                      lon_min: float, lon_max: float, 
                                      start_date: str, end_date: str) -> Dict:
        """
        Genera datos simulados en formato MERRA-2 para pruebas.
        
        Args:
            lat_min, lat_max: Límites de latitud
            lon_min, lon_max: Límites de longitud
            start_date, end_date: Fechas en formato YYYY-MM-DD
            
        Returns:
            Dict: Datos simulados en formato compatible con ERA5
        """
        logger.info("🔄 Generando datos simulados MERRA-2")
        
        # Usar la misma lógica de simulación que ERA5 pero con metadatos MERRA-2
        from routes.era5 import ERA5Service
        era5_service = ERA5Service()
        
        simulated_data = era5_service.generate_simulated_data_for_frontend(
            lat_min, lat_max, lon_min, lon_max, start_date, end_date
        )
        
        # Actualizar metadatos para indicar que es MERRA-2 simulado
        simulated_data['metadata'].update({
            'region': 'Caribe Colombiano (MERRA-2 Simulado)',
            'version': 'merra2-simulated-v1.0'
        })
        
        return simulated_data
    
    def generate_frontend_compatible_data(self, lat_min: float, lat_max: float, 
                                        lon_min: float, lon_max: float, 
                                        start_date: str, end_date: str) -> Dict:
        """
        Genera datos compatibles con el frontend, reales o simulados según configuración.
        
        Args:
            lat_min, lat_max: Límites de latitud
            lon_min, lon_max: Límites de longitud
            start_date, end_date: Fechas en formato YYYY-MM-DD
            
        Returns:
            Dict: Datos en formato compatible con ERA5
        """
        if self.test_mode:
            logger.info("🔧 Modo de prueba activo: Generando datos simulados MERRA-2")
            return self.generate_simulated_merra2_data(lat_min, lat_max, lon_min, lon_max, start_date, end_date)
        else:
            logger.info("🌍 Modo real: Intentando obtener datos reales MERRA-2")
            try:
                return self.get_merra2_data(lat_min, lat_max, lon_min, lon_max, start_date, end_date)
            except Exception as e:
                logger.error(f"Fallo descarga/procesamiento datos reales MERRA-2: {e}")
                logger.info("Retornando datos simulados por error con los datos reales.")
                return self.generate_simulated_merra2_data(lat_min, lat_max, lon_min, lon_max, start_date, end_date)

