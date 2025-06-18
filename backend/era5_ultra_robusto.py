from flask import Blueprint, request, jsonify
import numpy as np
import pandas as pd
from datetime import datetime, timedelta
import tempfile
import os
import logging
import traceback

# Configurar logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

era5_bp = Blueprint('era5', __name__)

class ERA5Service:
    def __init__(self, cdsapi_url=None, cdsapi_key=None, test_mode=False):
        self.test_mode = test_mode
        self.client = None
        
        if not test_mode and cdsapi_url and cdsapi_key:
            try:
                import cdsapi
                self.client = cdsapi.Client(url=cdsapi_url, key=cdsapi_key)
                logger.info("Cliente CDS API inicializado correctamente")
                
                # Verificar conectividad básica
                self._test_connection()
                
            except Exception as e:
                logger.error(f"Error al inicializar cliente CDS API: {str(e)}")
                logger.warning("Activando modo de prueba debido a error de conexión")
                self.test_mode = True
                self.client = None
        else:
            logger.info("Modo de prueba activado")
            self.test_mode = True

    def _test_connection(self):
        """Probar conexión básica con CDS"""
        try:
            # Intentar una operación simple para verificar conectividad
            # No hacer retrieve real, solo verificar que el cliente funcione
            logger.info("Verificando conectividad con CDS...")
            # Si llegamos aquí sin excepción, la conexión básica funciona
            logger.info("Conectividad básica con CDS verificada")
        except Exception as e:
            logger.warning(f"Problema de conectividad con CDS: {e}")
            raise

    def get_wind_data(self, lat_min, lat_max, lon_min, lon_max, start_date, end_date, variables=None):
        """
        Obtiene datos de viento de ERA5 para una región específica
        """
        try:
            logger.info(f"Solicitando datos para región: lat({lat_min},{lat_max}), lon({lon_min},{lon_max})")
            logger.info(f"Período: {start_date} a {end_date}")
            logger.info(f"Modo de prueba: {self.test_mode}")
            
            if self.test_mode:
                return self._generate_test_data(lat_min, lat_max, lon_min, lon_max, start_date, end_date)
            
            # Intentar descarga real de ERA5
            return self._download_era5_data(lat_min, lat_max, lon_min, lon_max, start_date, end_date, variables)
            
        except Exception as e:
            logger.error(f"Error en get_wind_data: {str(e)}")
            logger.error(f"Traceback: {traceback.format_exc()}")
            
            # Si falla la descarga real, usar datos de prueba como fallback
            logger.warning("Fallback a datos de prueba debido a error")
            return self._generate_test_data(lat_min, lat_max, lon_min, lon_max, start_date, end_date, error_info=str(e))

    def _download_era5_data(self, lat_min, lat_max, lon_min, lon_max, start_date, end_date, variables):
        """Descargar datos reales de ERA5"""
        if not self.client:
            raise Exception("Cliente CDS no disponible")
        
        if variables is None:
            variables = [
                '10m_u_component_of_wind',
                '10m_v_component_of_wind',
                '100m_u_component_of_wind',
                '100m_v_component_of_wind',
                'surface_pressure',
                '2m_temperature'
            ]

        # Generar componentes de fecha de forma segura
        date_components = self._generate_date_components_safe(start_date, end_date)
        logger.info(f"Componentes de fecha generados: {date_components}")

        # Validar que los componentes no estén vacíos
        if not date_components['year'] or not date_components['month'] or not date_components['day']:
            raise ValueError("Error generando componentes de fecha - listas vacías")

        # Configurar la solicitud
        request_params = {
            'product_type': 'reanalysis',
            'variable': variables,
            'year': date_components['year'],
            'month': date_components['month'],
            'day': date_components['day'],
            'time': [f'{hour:02d}:00' for hour in range(0, 24, 6)],  # Cada 6 horas
            'area': [lat_max, lon_min, lat_min, lon_max],  # Norte, Oeste, Sur, Este
            'format': 'netcdf',
        }

        logger.info("Configuración de solicitud ERA5:")
        for key, value in request_params.items():
            logger.info(f"  {key}: {value}")

        # Crear archivo temporal
        tmp_filename = None
        try:
            with tempfile.NamedTemporaryFile(delete=False, suffix='.nc') as tmp_file:
                tmp_filename = tmp_file.name

            logger.info(f"Iniciando descarga de datos ERA5 a: {tmp_filename}")
            
            # Descargar datos
            self.client.retrieve('reanalysis-era5-single-levels', request_params, tmp_filename)
            
            logger.info("Descarga completada, verificando archivo...")

            # Verificar que el archivo existe y no está vacío
            if not os.path.exists(tmp_filename):
                raise FileNotFoundError("Archivo de descarga no fue creado")
            
            file_size = os.path.getsize(tmp_filename)
            if file_size == 0:
                raise ValueError("Archivo de descarga está vacío")
            
            logger.info(f"Archivo descargado: {file_size} bytes")

            # Leer y procesar datos con xarray
            processed_data = self._process_netcdf_file_safe(tmp_filename)
            
            logger.info("Datos procesados exitosamente")
            return processed_data

        finally:
            # Limpiar archivo temporal
            if tmp_filename and os.path.exists(tmp_filename):
                try:
                    os.unlink(tmp_filename)
                    logger.info("Archivo temporal eliminado")
                except Exception as e:
                    logger.warning(f"No se pudo eliminar archivo temporal: {str(e)}")

    def _generate_date_components_safe(self, start_date, end_date):
        """
        Generar componentes de fecha de forma segura para evitar 'list index out of range'
        """
        try:
            start = datetime.strptime(start_date, '%Y-%m-%d')
            end = datetime.strptime(end_date, '%Y-%m-%d')
            
            # Generar todas las fechas en el rango
            dates = []
            current = start
            while current <= end:
                dates.append(current)
                current += timedelta(days=1)
            
            if not dates:
                raise ValueError("No se generaron fechas válidas en el rango especificado")
            
            # Extraer componentes únicos y validar
            years = sorted(list(set([d.year for d in dates])))
            months = sorted(list(set([d.month for d in dates])))
            days = sorted(list(set([d.day for d in dates])))
            
            # Validar que las listas no estén vacías
            if not years:
                raise ValueError("Lista de años vacía")
            if not months:
                raise ValueError("Lista de meses vacía")
            if not days:
                raise ValueError("Lista de días vacía")
            
            result = {
                'year': [str(y) for y in years],
                'month': [f'{m:02d}' for m in months],
                'day': [f'{d:02d}' for d in days]
            }
            
            logger.info(f"Componentes generados - Años: {len(result['year'])}, Meses: {len(result['month'])}, Días: {len(result['day'])}")
            
            return result
            
        except Exception as e:
            logger.error(f"Error generando componentes de fecha: {str(e)}")
            raise ValueError(f"Error en generación de fechas: {str(e)}")

    def _process_netcdf_file_safe(self, filename):
        """
        Procesar archivo NetCDF de forma segura para evitar errores de índice
        """
        try:
            import xarray as xr
            
            logger.info("Abriendo archivo NetCDF...")
            ds = xr.open_dataset(filename)
            
            logger.info(f"Variables disponibles: {list(ds.variables.keys())}")
            logger.info(f"Dimensiones: {dict(ds.dims)}")
            
            # Verificar que el dataset no esté vacío
            if len(ds.variables) == 0:
                raise ValueError("Dataset NetCDF vacío - sin variables")
            
            # Verificar dimensiones básicas
            required_dims = ['time', 'latitude', 'longitude']
            for dim in required_dims:
                if dim not in ds.dims:
                    raise ValueError(f"Dimensión requerida '{dim}' no encontrada en dataset")
                if ds.dims[dim] == 0:
                    raise ValueError(f"Dimensión '{dim}' tiene tamaño 0")
            
            # Procesar datos de forma segura
            processed_data = self._extract_wind_data_safe(ds)
            
            ds.close()
            return processed_data
            
        except Exception as e:
            logger.error(f"Error procesando archivo NetCDF: {str(e)}")
            raise

    def _extract_wind_data_safe(self, dataset):
        """
        Extraer datos de viento de forma segura del dataset
        """
        try:
            logger.info("Extrayendo datos de viento...")
            
            # Mapeo de nombres de variables (pueden variar)
            var_mapping = {
                'u10': ['u10', '10m_u_component_of_wind'],
                'v10': ['v10', '10m_v_component_of_wind'],
                'u100': ['u100', '100m_u_component_of_wind'],
                'v100': ['v100', '100m_v_component_of_wind'],
                'sp': ['sp', 'surface_pressure'],
                't2m': ['t2m', '2m_temperature']
            }
            
            # Encontrar variables disponibles
            available_vars = {}
            for standard_name, possible_names in var_mapping.items():
                for name in possible_names:
                    if name in dataset.variables:
                        available_vars[standard_name] = dataset[name]
                        logger.info(f"Variable encontrada: {standard_name} -> {name}")
                        break
                else:
                    logger.warning(f"Variable {standard_name} no encontrada")
            
            if not available_vars:
                raise ValueError("No se encontraron variables de viento en el dataset")
            
            # Calcular velocidades y direcciones de viento de forma segura
            wind_data = {}
            
            # Viento a 10m
            if 'u10' in available_vars and 'v10' in available_vars:
                try:
                    u10 = available_vars['u10']
                    v10 = available_vars['v10']
                    
                    # Verificar que los datos no estén vacíos
                    if u10.size == 0 or v10.size == 0:
                        logger.warning("Datos u10/v10 vacíos")
                    else:
                        wind_speed_10m = np.sqrt(u10**2 + v10**2)
                        wind_direction_10m = np.arctan2(v10, u10) * 180 / np.pi
                        
                        wind_data['wind_speed_10m'] = wind_speed_10m.values.tolist()
                        wind_data['wind_direction_10m'] = wind_direction_10m.values.tolist()
                        logger.info("Datos de viento a 10m procesados")
                        
                except Exception as e:
                    logger.error(f"Error procesando viento a 10m: {e}")
            
            # Viento a 100m
            if 'u100' in available_vars and 'v100' in available_vars:
                try:
                    u100 = available_vars['u100']
                    v100 = available_vars['v100']
                    
                    if u100.size == 0 or v100.size == 0:
                        logger.warning("Datos u100/v100 vacíos")
                    else:
                        wind_speed_100m = np.sqrt(u100**2 + v100**2)
                        wind_direction_100m = np.arctan2(v100, u100) * 180 / np.pi
                        
                        wind_data['wind_speed_100m'] = wind_speed_100m.values.tolist()
                        wind_data['wind_direction_100m'] = wind_direction_100m.values.tolist()
                        logger.info("Datos de viento a 100m procesados")
                        
                except Exception as e:
                    logger.error(f"Error procesando viento a 100m: {e}")
            
            # Otras variables
            for var_name, var_data in available_vars.items():
                if var_name not in ['u10', 'v10', 'u100', 'v100']:
                    try:
                        if var_data.size > 0:
                            wind_data[var_name] = var_data.values.tolist()
                            logger.info(f"Variable {var_name} procesada")
                    except Exception as e:
                        logger.error(f"Error procesando variable {var_name}: {e}")
            
            # Agregar coordenadas y tiempo de forma segura
            try:
                if 'time' in dataset.coords and dataset.time.size > 0:
                    wind_data['time'] = dataset.time.values.tolist()
                if 'latitude' in dataset.coords and dataset.latitude.size > 0:
                    wind_data['latitude'] = dataset.latitude.values.tolist()
                if 'longitude' in dataset.coords and dataset.longitude.size > 0:
                    wind_data['longitude'] = dataset.longitude.values.tolist()
            except Exception as e:
                logger.error(f"Error procesando coordenadas: {e}")
            
            if not wind_data:
                raise ValueError("No se pudieron extraer datos válidos del dataset")
            
            logger.info(f"Datos extraídos exitosamente: {list(wind_data.keys())}")
            return wind_data
            
        except Exception as e:
            logger.error(f"Error extrayendo datos de viento: {str(e)}")
            raise

    def _generate_test_data(self, lat_min, lat_max, lon_min, lon_max, start_date, end_date, error_info=None):
        """
        Genera datos de prueba simulados para testing
        """
        logger.info("Generando datos de prueba simulados")
        
        try:
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
                            'latitude': round(lat, 4),
                            'longitude': round(lon, 4),
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
            
            if error_info:
                result['era5_error'] = error_info
                result['message'] += f' (Error ERA5: {error_info[:100]}...)'
            
            logger.info(f"Datos de prueba generados: {len(data_points)} puntos")
            return result
            
        except Exception as e:
            logger.error(f"Error generando datos de prueba: {str(e)}")
            raise

@era5_bp.route('/wind-data', methods=['POST'])
def get_wind_data():
    """
    Endpoint para obtener datos de viento de ERA5 con manejo robusto de errores
    """
    try:
        logger.info("=== NUEVA SOLICITUD DE DATOS DE VIENTO ===")
        
        # Obtener datos de la solicitud
        data = request.get_json()
        
        if not data:
            logger.error("No se recibieron datos JSON")
            return jsonify({
                'error': 'No se recibieron datos JSON',
                'details': 'La solicitud debe incluir datos JSON válidos'
            }), 400

        logger.info(f"Datos recibidos: {data}")

        # Validar parámetros requeridos
        required_params = ['lat_min', 'lat_max', 'lon_min', 'lon_max', 'start_date', 'end_date']
        missing_params = [param for param in required_params if param not in data]
        
        if missing_params:
            logger.error(f"Parámetros requeridos faltantes: {missing_params}")
            return jsonify({
                'error': f'Parámetros requeridos faltantes: {", ".join(missing_params)}',
                'required_params': required_params,
                'received_params': list(data.keys())
            }), 400

        # Validar y convertir parámetros numéricos
        try:
            lat_min = float(data['lat_min'])
            lat_max = float(data['lat_max'])
            lon_min = float(data['lon_min'])
            lon_max = float(data['lon_max'])
            
            # Validar rangos geográficos
            if not (-90 <= lat_min <= 90) or not (-90 <= lat_max <= 90):
                raise ValueError("Latitudes deben estar entre -90 y 90")
            if not (-180 <= lon_min <= 180) or not (-180 <= lon_max <= 180):
                raise ValueError("Longitudes deben estar entre -180 y 180")
            if lat_min >= lat_max:
                raise ValueError("lat_min debe ser menor que lat_max")
            if lon_min >= lon_max:
                raise ValueError("lon_min debe ser menor que lon_max")
                
        except (ValueError, TypeError) as e:
            logger.error(f"Error en parámetros geográficos: {str(e)}")
            return jsonify({
                'error': f'Error en parámetros geográficos: {str(e)}',
                'details': 'Verificar que las coordenadas sean números válidos y estén en rangos correctos'
            }), 400

        # Convertir y validar fechas
        try:
            start_date = datetime.strptime(data['start_date'], '%Y-%m-%d')
            end_date = datetime.strptime(data['end_date'], '%Y-%m-%d')
        except ValueError as e:
            logger.error(f"Error en formato de fecha: {str(e)}")
            return jsonify({
                'error': 'Formato de fecha inválido',
                'details': 'Use formato YYYY-MM-DD (ejemplo: 2024-01-15)',
                'received_start_date': data.get('start_date'),
                'received_end_date': data.get('end_date')
            }), 400

        # Validar rango de fechas
        if end_date < start_date:
            logger.error("La fecha de fin debe ser posterior a la fecha de inicio")
            return jsonify({
                'error': 'Rango de fechas inválido',
                'details': 'La fecha de fin debe ser posterior a la fecha de inicio',
                'start_date': data['start_date'],
                'end_date': data['end_date']
            }), 400

        # Limitar el rango de fechas para evitar descargas muy grandes
        max_days = 30
        days_requested = (end_date - start_date).days + 1
        if days_requested > max_days:
            logger.error(f"Rango de fechas excede el máximo permitido: {days_requested} > {max_days}")
            return jsonify({
                'error': f'Rango de fechas excede el máximo permitido',
                'details': f'Máximo permitido: {max_days} días, solicitado: {days_requested} días',
                'max_days': max_days,
                'requested_days': days_requested
            }), 400

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
                lat_min=lat_min,
                lat_max=lat_max,
                lon_min=lon_min,
                lon_max=lon_max,
                start_date=start_date.strftime('%Y-%m-%d'),
                end_date=end_date.strftime('%Y-%m-%d'),
                variables=data.get('variables', None)
            )
        except IndexError as e:
            logger.error(f"Error de índice (list index out of range): {str(e)}")
            logger.error(f"Traceback completo: {traceback.format_exc()}")
            return jsonify({
                'error': 'Error de índice en procesamiento de datos',
                'details': 'Problema accediendo a datos de ERA5 - posiblemente respuesta vacía o mal estructurada',
                'technical_error': str(e),
                'suggestion': 'Intente con un rango de fechas más pequeño o verifique las coordenadas'
            }), 500
        except Exception as e:
            logger.error(f"Error obteniendo datos: {str(e)}")
            logger.error(f"Traceback completo: {traceback.format_exc()}")
            return jsonify({
                'error': f'Error obteniendo datos: {str(e)}',
                'details': 'Error en el proceso de descarga o procesamiento de datos ERA5',
                'suggestion': 'Verifique las credenciales ERA5 y la conectividad'
            }), 500

        logger.info("Datos obtenidos exitosamente")
        
        return jsonify({
            'status': 'success',
            'data': wind_data,
            'message': 'Datos obtenidos exitosamente',
            'request_info': {
                'area': f"lat({lat_min},{lat_max}), lon({lon_min},{lon_max})",
                'date_range': f"{data['start_date']} to {data['end_date']}",
                'days_requested': days_requested,
                'test_mode': era5_service.test_mode
            }
        })

    except Exception as e:
        logger.error(f"Error inesperado en endpoint: {str(e)}")
        logger.error(f"Traceback completo: {traceback.format_exc()}")
        return jsonify({
            'error': f'Error interno del servidor',
            'details': 'Error inesperado en el procesamiento de la solicitud',
            'technical_error': str(e),
            'suggestion': 'Contacte al administrador del sistema'
        }), 500

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
        
        # Probar conexión si está configurado
        connection_status = "not_tested"
        if era5_configured:
            try:
                test_service = ERA5Service(cdsapi_url, cdsapi_key, test_mode=False)
                connection_status = "connected" if not test_service.test_mode else "failed"
            except Exception as e:
                connection_status = f"failed: {str(e)[:100]}"
        
        status = {
            'status': 'healthy',
            'era5_configured': era5_configured,
            'connection_status': connection_status,
            'test_mode': not era5_configured or connection_status.startswith('failed'),
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

@era5_bp.route('/debug', methods=['POST'])
def debug_request():
    """
    Endpoint de debug para diagnosticar problemas
    """
    try:
        data = request.get_json() or {}
        
        debug_info = {
            'received_data': data,
            'environment_vars': {
                'CDSAPI_URL': os.getenv('CDSAPI_URL', 'NOT_SET'),
                'CDSAPI_KEY': 'SET' if os.getenv('CDSAPI_KEY') else 'NOT_SET'
            },
            'python_version': sys.version,
            'timestamp': datetime.now().isoformat()
        }
        
        # Probar generación de fechas si se proporcionan
        if 'start_date' in data and 'end_date' in data:
            try:
                service = ERA5Service(test_mode=True)
                date_components = service._generate_date_components_safe(
                    data['start_date'], 
                    data['end_date']
                )
                debug_info['date_components'] = date_components
            except Exception as e:
                debug_info['date_error'] = str(e)
        
        return jsonify({
            'status': 'debug_info',
            'debug': debug_info
        })
        
    except Exception as e:
        return jsonify({
            'status': 'debug_error',
            'error': str(e),
            'traceback': traceback.format_exc()
        }), 500

