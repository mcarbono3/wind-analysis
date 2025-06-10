from flask import Blueprint, request, jsonify
import cdsapi
import numpy as np
import pandas as pd
from datetime import datetime, timedelta
import tempfile
import os
import xarray as xr

era5_bp = Blueprint('era5', __name__)

class ERA5Service:
    def __init__(self, cdsapi_url, cdsapi_key):
        self.client = cdsapi.Client(url=cdsapi_url, key=cdsapi_key)
        
    def get_wind_data(self, lat_min, lat_max, lon_min, lon_max, start_date, end_date, variables=None):
        """
        Obtiene datos de viento de ERA5 para una región específica
        """
        if variables is None:
            variables = [
                '10m_u_component_of_wind',
                '10m_v_component_of_wind', 
                '100m_u_component_of_wind',
                '100m_v_component_of_wind',
                'surface_pressure',
                '2m_temperature'
            ]
        
        # Configurar la solicitud
        request_params = {
            'product_type': 'reanalysis',
            'variable': variables,
            'year': [str(year) for year in range(start_date.year, end_date.year + 1)],
            'month': [f'{month:02d}' for month in range(1, 13)],
            'day': [f'{day:02d}' for day in range(1, 32)],
            'time': [f'{hour:02d}:00' for hour in range(0, 24)],
            'area': [lat_max, lon_min, lat_min, lon_max],  # Norte, Oeste, Sur, Este
            'format': 'netcdf',
        }
        
        # Crear archivo temporal
        with tempfile.NamedTemporaryFile(delete=False, suffix='.nc') as tmp_file:
            tmp_filename = tmp_file.name
            
        try:
            # Descargar datos
            self.client.retrieve('reanalysis-era5-single-levels', request_params, tmp_filename)
            
            # Leer datos con xarray
            ds = xr.open_dataset(tmp_filename)
            
            # Procesar datos
            processed_data = self._process_wind_data(ds)
            
            return processed_data
            
        finally:
            # Limpiar archivo temporal
            if os.path.exists(tmp_filename):
                os.unlink(tmp_filename)
    
    def _process_wind_data(self, dataset):
        """
        Procesa los datos de viento descargados
        """
        # Calcular velocidad del viento a 10m
        if 'u10' in dataset.variables and 'v10' in dataset.variables:
            wind_speed_10m = np.sqrt(dataset['u10']**2 + dataset['v10']**2)
            wind_direction_10m = np.arctan2(dataset['v10'], dataset['u10']) * 180 / np.pi
        
        # Calcular velocidad del viento a 100m si está disponible
        wind_speed_100m = None
        wind_direction_100m = None
        if 'u100' in dataset.variables and 'v100' in dataset.variables:
            wind_speed_100m = np.sqrt(dataset['u100']**2 + dataset['v100']**2)
            wind_direction_100m = np.arctan2(dataset['v100'], dataset['u100']) * 180 / np.pi
        
        # Extraer otras variables
        pressure = dataset.get('sp', None)
        temperature = dataset.get('t2m', None)
        
        # Convertir a DataFrame para facilitar el análisis
        data = {
            'time': dataset.time.values,
            'latitude': dataset.latitude.values,
            'longitude': dataset.longitude.values,
            'wind_speed_10m': wind_speed_10m.values if wind_speed_10m is not None else None,
            'wind_direction_10m': wind_direction_10m.values if wind_direction_10m is not None else None,
            'wind_speed_100m': wind_speed_100m.values if wind_speed_100m is not None else None,
            'wind_direction_100m': wind_direction_100m.values if wind_direction_100m is not None else None,
            'pressure': pressure.values if pressure is not None else None,
            'temperature': temperature.values if temperature is not None else None,
        }
        
        return data

@era5_bp.route('/wind-data', methods=['POST'])
def get_wind_data():
    """
    Endpoint para obtener datos de viento de ERA5
    """
    try:
        data = request.get_json()
        
        # Validar parámetros requeridos
        required_params = ['lat_min', 'lat_max', 'lon_min', 'lon_max', 'start_date', 'end_date']
        for param in required_params:
            if param not in data:
                return jsonify({'error': f'Parámetro requerido: {param}'}), 400
        
        # Convertir fechas
        start_date = datetime.strptime(data['start_date'], '%Y-%m-%d')
        end_date = datetime.strptime(data['end_date'], '%Y-%m-%d')
        
        # Validar rango de fechas
        if end_date <= start_date:
            return jsonify({'error': 'La fecha de fin debe ser posterior a la fecha de inicio'}), 400
        
        # Limitar el rango de fechas para evitar descargas muy grandes
        max_days = 30
        if (end_date - start_date).days > max_days:
            return jsonify({'error': f'El rango de fechas no puede exceder {max_days} días'}), 400
        
        # Obtener credenciales de las variables de entorno
        cdsapi_url = os.getenv('CDSAPI_URL')
        cdsapi_key = os.getenv('CDSAPI_KEY')

        if not cdsapi_url or not cdsapi_key:
            return jsonify({'error': 'CDSAPI_URL o CDSAPI_KEY no configurados en las variables de entorno'}), 500

        # Crear servicio ERA5
        era5_service = ERA5Service(cdsapi_url, cdsapi_key)
        
        # Obtener datos
        wind_data = era5_service.get_wind_data(
            lat_min=float(data['lat_min']),
            lat_max=float(data['lat_max']),
            lon_min=float(data['lon_min']),
            lon_max=float(data['lon_max']),
            start_date=start_date,
            end_date=end_date,
            variables=data.get('variables', None)
        )
        
        return jsonify({
            'status': 'success',
            'data': wind_data,
            'message': 'Datos obtenidos exitosamente'
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@era5_bp.route('/available-variables', methods=['GET'])
def get_available_variables():
    """
    Retorna las variables disponibles en ERA5
    """
    variables = {
        'wind': {
            '10m_u_component_of_wind': 'Componente U del viento a 10m',
            '10m_v_component_of_wind': 'Componente V del viento a 10m',
            '100m_u_component_of_wind': 'Componente U del viento a 100m',
            '100m_v_component_of_wind': 'Componente V del viento a 100m',
        },
        'atmospheric': {
            'surface_pressure': 'Presión superficial',
            '2m_temperature': 'Temperatura a 2m',
            'total_precipitation': 'Precipitación total',
            'relative_humidity': 'Humedad relativa'
        }
    }
    
    return jsonify(variables)

@era5_bp.route('/caribbean-bounds', methods=['GET'])
def get_caribbean_bounds():
    """
    Retorna los límites geográficos del Caribe colombiano
    """
    bounds = {
        'lat_min': 8.0,   # Latitud mínima
        'lat_max': 16.0,  # Latitud máxima
        'lon_min': -82.0, # Longitud mínima
        'lon_max': -70.0, # Longitud máxima
        'center': {
            'lat': 12.0,
            'lon': -76.0
        }
    }
    
    return jsonify(bounds)

