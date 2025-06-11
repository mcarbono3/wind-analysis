from flask import Blueprint, request, jsonify
import numpy as np
import pandas as pd
from datetime import datetime, timedelta
import tempfile
import os
import logging

# Configurar logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

era5_bp = Blueprint('era5', __name__)

class ERA5Service:
    def __init__(self, cdsapi_url=None, cdsapi_key=None, test_mode=False):
        self.test_mode = test_mode
        
        if not test_mode:
            try:
                import cdsapi
                self.client = cdsapi.Client(url=cdsapi_url, key=cdsapi_key)
                logger.info("Cliente CDS API inicializado correctamente")
            except Exception as e:
                logger.error(f"Error al inicializar cliente CDS API: {str(e)}")
                raise
        else:
            logger.info("Modo de prueba activado - usando datos simulados")

    def get_wind_data(self, lat_min, lat_max, lon_min, lon_max, start_date, end_date, variables=None):
        """
        Obtiene datos de viento de ERA5 para una región específica
        """
        try:
            logger.info(f"Solicitando datos para región: lat({lat_min},{lat_max}), lon({lon_min},{lon_max})")
            logger.info(f"Período: {start_date} a {end_date}")
            
            if self.test_mode:
                return self._generate_test_data(lat_min, lat_max, lon_min, lon_max, start_date, end_date)
            
            # Código real para ERA5 (cuando esté funcionando)
            if variables is None:
                variables = [
                    '10m_u_component_of_wind',
                    '10m_v_component_of_wind',
                    '100m_u_component_of_wind',
                    '100m_v_component_of_wind',
                    'surface_pressure',
                    '2m_temperature'
                ]

            # Generar lista de fechas dinámicamente
            date_list = self._generate_date_list(start_date, end_date)
            logger.info(f"Fechas generadas: {len(date_list)} días")

            # Configurar la solicitud
            request_params = {
                'product_type': 'reanalysis',
                'variable': variables,
                'year': list(set([date.split('-')[0] for date in date_list])),
                'month': list(set([date.split('-')[1] for date in date_list])),
                'day': list(set([date.split('-')[2] for date in date_list])),
                'time': [f'{hour:02d}:00' for hour in range(0, 24)],
                'area': [lat_max, lon_min, lat_min, lon_max],  # Norte, Oeste, Sur, Este
                'format': 'netcdf',
            }

            # Crear archivo temporal
            with tempfile.NamedTemporaryFile(delete=False, suffix='.nc') as tmp_file:
                tmp_filename = tmp_file.name

            logger.info("Iniciando descarga de datos ERA5...")
            
            # Descargar datos
            self.client.retrieve('reanalysis-era5-single-levels', request_params, tmp_filename)
            
            logger.info("Descarga completada, procesando datos...")

            # Leer datos con xarray
            import xarray as xr
            ds = xr.open_dataset(tmp_filename)

            # Procesar datos
            processed_data = self._process_wind_data(ds)

            logger.info("Datos procesados exitosamente")
            return processed_data

        except Exception as e:
            logger.error(f"Error en get_wind_data: {str(e)}")
            raise
        finally:
            # Limpiar archivo temporal
            if not self.test_mode and 'tmp_filename' in locals() and os.path.exists(tmp_filename):
                try:
                    os.unlink(tmp_filename)
                    logger.info("Archivo temporal eliminado")
                except Exception as e:
                    logger.warning(f"No se pudo eliminar archivo temporal: {str(e)}")

    def _generate_test_data(self, lat_min, lat_max, lon_min, lon_max, start_date, end_date):
        """
        Genera datos de prueba simulados para testing
        """
        logger.info("Generando datos de prueba simulados")
        
        # Generar fechas
        start = datetime.strptime(start_date, '%Y-%m-%d')
        end = datetime.strptime(end_date, '%Y-%m-%d')
        
        dates = []
        current_date = start
        while current_date <= end:
            for hour in range(0, 24, 6):  # Cada 6 horas
                dates.append(current_date.replace(hour=hour))
            current_date += timedelta(days=1)
        
        # Generar coordenadas
        lats = np.linspace(lat_min, lat_max, 5)
        lons = np.linspace(lon_min, lon_max, 5)
        
        # Generar datos simulados realistas para el Caribe
        np.random.seed(42)  # Para resultados reproducibles
        
        data_points = []
        for date in dates:
            for lat in lats:
                for lon in lons:
                    # Simular patrones de viento típicos del Caribe
                    base_wind_speed = 6 + 3 * np.sin(date.hour * np.pi / 12)  # Variación diurna
                    wind_speed_10m = max(0, base_wind_speed + np.random.normal(0, 1))
                    wind_speed_100m = wind_speed_10m * 1.3  # Viento más fuerte en altura
                    
                    # Dirección predominante del este (vientos alisios)
                    wind_direction = 90 + np.random.normal(0, 30)  # Este con variación
                    
                    data_points.append({
                        'time': date.isoformat(),
                        'latitude': lat,
                        'longitude': lon,
                        'wind_speed_10m': round(wind_speed_10m, 2),
                        'wind_speed_100m': round(wind_speed_100m, 2),
                        'wind_direction_10m': round(wind_direction % 360, 1),
                        'wind_direction_100m': round((wind_direction + 5) % 360, 1),
                        'pressure': round(101325 + np.random.normal(0, 500), 0),
                        'temperature': round(25 + 3 * np.sin(date.hour * np.pi / 12) + np.random.normal(0, 1), 1)
                    })
        
        # Calcular estadísticas
        wind_speeds = [p['wind_speed_10m'] for p in data_points]
        
        result = {
            'data_points': data_points,
            'statistics': {
                'total_points': len(data_points),
                'date_range': f"{start_date} to {end_date}",
                'area': f"lat({lat_min},{lat_max}), lon({lon_min},{lon_max})",
                'wind_speed_10m': {
                    'mean': round(np.mean(wind_speeds), 2),
                    'min': round(np.min(wind_speeds), 2),
                    'max': round(np.max(wind_speeds), 2),
                    'std': round(np.std(wind_speeds), 2)
                }
            },
            'test_mode': True,
            'message': 'Datos simulados para pruebas - Configure ERA5 para datos reales'
        }
        
        logger.info(f"Datos de prueba generados: {len(data_points)} puntos")
        return result

    def _generate_date_list(self, start_date, end_date):
        """
        Genera lista de fechas entre start_date y end_date
        """
        try:
            start = datetime.strptime(start_date, '%Y-%m-%d')
            end = datetime.strptime(end_date, '%Y-%m-%d')
            
            date_list = []
            current_date = start
            
            while current_date <= end:
                date_list.append(current_date.strftime('%Y-%m-%d').split('-')[2])
                current_date += timedelta(days=1)
            
            # Remover duplicados y ordenar
            return sorted(list(set(date_list)))
            
        except Exception as e:
            logger.error(f"Error generando lista de fechas: {str(e)}")
            raise

    def _process_wind_data(self, dataset):
        """
        Procesa los datos de viento descargados (para datos reales de ERA5)
        """
        try:
            logger.info("Iniciando procesamiento de datos")
            
            # Inicializar variables
            wind_speed_10m = None
            wind_direction_10m = None
            wind_speed_100m = None
            wind_direction_100m = None

            # Calcular velocidad del viento a 10m
            if 'u10' in dataset.variables and 'v10' in dataset.variables:
                wind_speed_10m = np.sqrt(dataset['u10']**2 + dataset['v10']**2)
                wind_direction_10m = np.arctan2(dataset['v10'], dataset['u10']) * 180 / np.pi

            # Calcular velocidad del viento a 100m
            if 'u100' in dataset.variables and 'v100' in dataset.variables:
                wind_speed_100m = np.sqrt(dataset['u100']**2 + dataset['v100']**2)
                wind_direction_100m = np.arctan2(dataset['v100'], dataset['u100']) * 180 / np.pi

            # Extraer otras variables
            pressure = dataset.get('sp', None)
            temperature = dataset.get('t2m', None)

            # Convertir a formato estructurado
            data = {
                'time': dataset.time.values.tolist(),
                'latitude': dataset.latitude.values.tolist(),
                'longitude': dataset.longitude.values.tolist(),
                'wind_speed_10m': wind_speed_10m.values.tolist() if wind_speed_10m is not None else None,
                'wind_direction_10m': wind_direction_10m.values.tolist() if wind_direction_10m is not None else None,
                'wind_speed_100m': wind_speed_100m.values.tolist() if wind_speed_100m is not None else None,
                'wind_direction_100m': wind_direction_100m.values.tolist() if wind_direction_100m is not None else None,
                'pressure': pressure.values.tolist() if pressure is not None else None,
                'temperature': temperature.values.tolist() if temperature is not None else None,
            }

            logger.info("Procesamiento de datos completado")
            return data

        except Exception as e:
            logger.error(f"Error procesando datos: {str(e)}")
            raise

@era5_bp.route('/wind-data', methods=['POST'])
def get_wind_data():
    """
    Endpoint para obtener datos de viento de ERA5
    """
    try:
        logger.info("Recibida solicitud para datos de viento")
        
        # Obtener datos de la solicitud
        data = request.get_json()
        
        if not data:
            logger.error("No se recibieron datos JSON")
            return jsonify({'error': 'No se recibieron datos JSON'}), 400

        # Validar parámetros requeridos
        required_params = ['lat_min', 'lat_max', 'lon_min', 'lon_max', 'start_date', 'end_date']
        for param in required_params:
            if param not in data:
                logger.error(f"Parámetro requerido faltante: {param}")
                return jsonify({'error': f'Parámetro requerido: {param}'}), 400

        # Convertir fechas
        try:
            start_date = datetime.strptime(data['start_date'], '%Y-%m-%d')
            end_date = datetime.strptime(data['end_date'], '%Y-%m-%d')
        except ValueError as e:
            logger.error(f"Error en formato de fecha: {str(e)}")
            return jsonify({'error': 'Formato de fecha inválido. Use YYYY-MM-DD'}), 400

        # Validar rango de fechas
        if end_date < start_date:
            logger.error("La fecha de fin debe ser posterior a la fecha de inicio")
            return jsonify({'error': 'La fecha de fin debe ser posterior a la fecha de inicio'}), 400

        # Limitar el rango de fechas para evitar descargas muy grandes
        max_days = 30
        if (end_date - start_date).days > max_days:
            logger.error(f"Rango de fechas excede el máximo permitido: {max_days} días")
            return jsonify({'error': f'El rango de fechas no puede exceder {max_days} días'}), 400

        # Obtener credenciales de las variables de entorno
        cdsapi_url = os.getenv('CDSAPI_URL')
        cdsapi_key = os.getenv('CDSAPI_KEY')
        
        # Determinar si usar modo de prueba
        test_mode = not (cdsapi_url and cdsapi_key)
        
        if test_mode:
            logger.warning("Credenciales ERA5 no configuradas - usando modo de prueba")
        else:
            logger.info(f"Usando credenciales ERA5: URL={cdsapi_url}")

        # Crear servicio ERA5
        try:
            era5_service = ERA5Service(cdsapi_url, cdsapi_key, test_mode=test_mode)
        except Exception as e:
            logger.error(f"Error creando servicio ERA5: {str(e)}")
            # Fallback a modo de prueba si falla la configuración
            logger.warning("Fallback a modo de prueba debido a error de configuración")
            era5_service = ERA5Service(test_mode=True)

        # Obtener datos
        try:
            wind_data = era5_service.get_wind_data(
                lat_min=float(data['lat_min']),
                lat_max=float(data['lat_max']),
                lon_min=float(data['lon_min']),
                lon_max=float(data['lon_max']),
                start_date=start_date.strftime('%Y-%m-%d'),
                end_date=end_date.strftime('%Y-%m-%d'),
                variables=data.get('variables', None)
            )
        except Exception as e:
            logger.error(f"Error obteniendo datos: {str(e)}")
            return jsonify({'error': f'Error obteniendo datos: {str(e)}'}), 500

        logger.info("Datos obtenidos exitosamente")
        
        return jsonify({
            'status': 'success',
            'data': wind_data,
            'message': 'Datos obtenidos exitosamente'
        })

    except Exception as e:
        logger.error(f"Error inesperado: {str(e)}")
        return jsonify({'error': f'Error interno del servidor: {str(e)}'}), 500

@era5_bp.route('/available-variables', methods=['GET'])
def get_available_variables():
    """
    Endpoint para obtener las variables disponibles
    """
    variables = [
        '10m_u_component_of_wind',
        '10m_v_component_of_wind', 
        '100m_u_component_of_wind',
        '100m_v_component_of_wind',
        'surface_pressure',
        '2m_temperature'
    ]
    
    return jsonify({
        'status': 'success',
        'variables': variables,
        'message': 'Variables disponibles obtenidas exitosamente'
    })

@era5_bp.route('/health', methods=['GET'])
def health_check():
    """
    Endpoint para verificar el estado del servicio
    """
    try:
        # Verificar credenciales
        cdsapi_url = os.getenv('CDSAPI_URL')
        cdsapi_key = os.getenv('CDSAPI_KEY')
        
        era5_configured = bool(cdsapi_url and cdsapi_key)
        
        status = {
            'status': 'healthy',
            'era5_configured': era5_configured,
            'test_mode': not era5_configured,
            'timestamp': datetime.now().isoformat(),
            'message': 'Servicio funcionando correctamente' if era5_configured else 'Funcionando en modo de prueba'
        }
        
        if era5_configured:
            status['cdsapi_url'] = cdsapi_url
            status['cdsapi_key_configured'] = bool(cdsapi_key)
        
        return jsonify(status)
        
    except Exception as e:
        return jsonify({
            'status': 'unhealthy',
            'error': str(e),
            'timestamp': datetime.now().isoformat()
        }), 500

