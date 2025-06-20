import logging
import os
import netrc
from typing import Optional, Tuple, Dict
import requests
from requests.auth import HTTPBasicAuth

logger = logging.getLogger(__name__)

class NASAConfigManager:
    def __init__(self, username: str = None, password: str = None):
        """
        Inicializa el gestor de configuración NASA.
        Prioriza variables de entorno, luego parámetros directos, finalmente archivo .netrc
        """
        self.username = username
        self.password = password
        self.config_method = "unknown"
        self.ges_disc_base_url = "https://goldsmr4.gesdisc.eosdis.nasa.gov"
        self.merra2_base_path = "/data/MERRA2"
        self.earthdata_login_url = "https://urs.earthdata.nasa.gov"
        
        # Intentar cargar credenciales en orden de prioridad
        self._load_credentials()
        logger.info(f"✅ Credenciales cargadas usando método: {self.config_method}")

    def _load_credentials(self):
        """Carga credenciales desde variables de entorno, parámetros o archivo .netrc"""
        
        # 1. Prioridad: Variables de entorno
        env_username = os.getenv('NASA_USERNAME') or os.getenv('EARTHDATA_USERNAME')
        env_password = os.getenv('NASA_PASSWORD') or os.getenv('EARTHDATA_PASSWORD')
        
        if env_username and env_password:
            self.username = env_username
            self.password = env_password
            self.config_method = "environment_variables"
            return
        
        # 2. Segunda prioridad: Parámetros directos
        if self.username and self.password:
            self.config_method = "direct_parameters"
            return
        
        # 3. Tercera prioridad: Archivo .netrc
        try:
            netrc_file = netrc.netrc()
            auth_info = netrc_file.authenticators('urs.earthdata.nasa.gov')
            if auth_info:
                self.username = auth_info[0]  # login
                self.password = auth_info[2]  # password
                self.config_method = "netrc_file"
                return
        except (FileNotFoundError, netrc.NetrcParseError) as e:
            logger.warning(f"No se pudo leer archivo .netrc: {e}")
        
        # Si no se encontraron credenciales
        self.config_method = "no_credentials"
        logger.error("❌ No se encontraron credenciales NASA válidas")

    def get_credentials(self) -> Tuple[Optional[str], Optional[str]]:
        """Retorna las credenciales cargadas"""
        return self.username, self.password

    def get_auth_session(self) -> requests.Session:
        """
        Crea una sesión autenticada para NASA Earthdata.
        Implementa el flujo de autenticación estándar de NASA.
        """
        session = requests.Session()
        
        if not self.username or not self.password:
            logger.error("❌ No hay credenciales disponibles para autenticación")
            return session
        
        # Configurar autenticación básica
        session.auth = HTTPBasicAuth(self.username, self.password)
        
        # Headers requeridos para NASA Earthdata
        session.headers.update({
            'User-Agent': 'wind-analysis-merra2/2.0',
            'Accept': 'application/octet-stream, application/json, */*',
            'Accept-Encoding': 'gzip, deflate',
            'Connection': 'keep-alive'
        })
        
        # Configurar para manejar redirecciones de NASA
        session.max_redirects = 10
        
        # Realizar autenticación inicial con Earthdata Login
        try:
            # Primer paso: autenticar con Earthdata Login
            auth_response = session.get(
                f"{self.earthdata_login_url}/api/users/user",
                timeout=30,
                allow_redirects=True
            )
            
            if auth_response.status_code == 200:
                logger.info("✅ Autenticación exitosa con NASA Earthdata")
            else:
                logger.warning(f"⚠️ Respuesta de autenticación: {auth_response.status_code}")
                
        except Exception as e:
            logger.error(f"❌ Error en autenticación inicial: {e}")
        
        return session

    def get_merra2_urls(self, year: str, month: str, day: str) -> Dict[str, str]:
        """Genera URLs para archivos MERRA-2"""
        date_str = f"{year}{month}{day}"
        year_month = f"{year}/{month}"
        return {
            "slv": f"{self.ges_disc_base_url}{self.merra2_base_path}/M2T1NXSLV.5.12.4/{year_month}/MERRA2_400.tavg1_2d_slv_Nx.{date_str}.nc4",
            "flx": f"{self.ges_disc_base_url}{self.merra2_base_path}/M2T1NXFLX.5.12.4/{year_month}/MERRA2_400.tavg1_2d_flx_Nx.{date_str}.nc4"
        }

    def validate_credentials(self) -> Dict:
        """
        Valida las credenciales realizando una prueba de conexión real.
        Implementa el flujo completo de autenticación NASA.
        """
        username, password = self.get_credentials()
        result = {
            "method": self.config_method,
            "has_username": bool(username),
            "has_password": bool(password),
            "connection_test": "not_tested",
            "status": "unknown",
            "earthdata_auth": "not_tested",
            "merra2_access": "not_tested"
        }
        
        if not username or not password:
            result["status"] = "credentials_missing"
            return result

        try:
            session = self.get_auth_session()
            
            # Paso 1: Verificar autenticación con Earthdata Login
            logger.info("🔍 Verificando autenticación con NASA Earthdata...")
            auth_response = session.get(
                f"{self.earthdata_login_url}/api/users/user",
                timeout=30
            )
            
            if auth_response.status_code == 200:
                result["earthdata_auth"] = "success"
                logger.info("✅ Autenticación con Earthdata Login exitosa")
            elif auth_response.status_code == 401:
                result["earthdata_auth"] = "auth_failed"
                result["status"] = "invalid_credentials"
                logger.error("❌ Credenciales inválidas para NASA Earthdata")
                return result
            else:
                result["earthdata_auth"] = f"http_{auth_response.status_code}"
                logger.warning(f"⚠️ Respuesta inesperada de Earthdata: {auth_response.status_code}")
            
            # Paso 2: Probar acceso a datos MERRA-2
            logger.info("🔍 Probando acceso a datos MERRA-2...")
            test_url = f"{self.ges_disc_base_url}{self.merra2_base_path}/M2T1NXSLV.5.12.4/2024/01/MERRA2_400.tavg1_2d_slv_Nx.20240101.nc4"
            
            # Realizar solicitud HEAD para verificar acceso sin descargar
            merra_response = session.head(test_url, timeout=30, allow_redirects=True)
            
            if merra_response.status_code == 200:
                result["merra2_access"] = "success"
                result["connection_test"] = "success"
                result["status"] = "fully_functional"
                logger.info("✅ Acceso a datos MERRA-2 verificado")
            elif merra_response.status_code == 401:
                result["merra2_access"] = "auth_failed"
                result["connection_test"] = "auth_failed"
                result["status"] = "merra2_auth_error"
                logger.error("❌ Fallo de autenticación al acceder a MERRA-2")
            elif merra_response.status_code == 403:
                result["merra2_access"] = "forbidden"
                result["connection_test"] = "access_denied"
                result["status"] = "merra2_access_denied"
                logger.error("❌ Acceso denegado a datos MERRA-2. Verificar permisos de cuenta.")
            else:
                result["merra2_access"] = f"http_{merra_response.status_code}"
                result["connection_test"] = f"http_{merra_response.status_code}"
                result["status"] = "connection_error"
                logger.warning(f"⚠️ Respuesta inesperada de MERRA-2: {merra_response.status_code}")

        except requests.exceptions.Timeout:
            result["connection_test"] = "timeout"
            result["status"] = "connection_timeout"
            logger.error("❌ Timeout en conexión con NASA")
        except requests.exceptions.ConnectionError:
            result["connection_test"] = "connection_error"
            result["status"] = "network_error"
            logger.error("❌ Error de conexión de red")
        except Exception as e:
            result["connection_test"] = f"exception_{type(e).__name__}"
            result["status"] = "unexpected_error"
            logger.error(f"❌ Error inesperado validando credenciales: {e}")

        return result

    def create_netrc_file(self, username: str, password: str, netrc_path: str = None) -> bool:
        """
        Crea un archivo .netrc con las credenciales proporcionadas.
        Útil para configuración inicial.
        """
        if not netrc_path:
            netrc_path = os.path.expanduser("~/.netrc")
        
        try:
            netrc_content = f"""machine urs.earthdata.nasa.gov
login {username}
password {password}
"""
            
            with open(netrc_path, 'w') as f:
                f.write(netrc_content)
            
            # Establecer permisos seguros (solo lectura para el propietario)
            os.chmod(netrc_path, 0o600)
            
            logger.info(f"✅ Archivo .netrc creado en: {netrc_path}")
            return True
            
        except Exception as e:
            logger.error(f"❌ Error creando archivo .netrc: {e}")
            return False
