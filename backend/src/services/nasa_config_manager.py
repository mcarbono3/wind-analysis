"""
Gestor de configuración para credenciales de NASA Earthdata (MERRA-2)
Proporciona múltiples métodos de autenticación robustos para GES DISC
"""

import os
import logging
from pathlib import Path
from typing import Optional, Tuple, Dict
import requests
from requests.auth import HTTPBasicAuth

logger = logging.getLogger(__name__)

class NASAConfigManager:
    """
    Gestor de configuración para credenciales de NASA Earthdata.
    Implementa múltiples métodos de autenticación con fallbacks automáticos.
    """
    
    def __init__(self, username: str = None, token: str = None):
        """
        Inicializa el gestor de configuración NASA.
        
        Args:
            username: Usuario de NASA Earthdata (opcional)
            token: Token de NASA Earthdata (opcional)
        """
        # Credenciales por defecto proporcionadas por el usuario
        self.username = username or "windatacaribe"
        self.token = token or "eyJ0eXAiOiJKV1QiLCJvcmlnaW4iOiJFYXJ0aGRhdGEgTG9naW4iLCJzaWciOiJlZGxqd3RwdWJrZXlfb3BzIiwiYWxnIjoiUlMyNTYifQ.eyJ0eXBlIjoiVXNlciIsInVpZCI6IndpbmRhdGFjYXJpYmUiLCJleHAiOjE3NTU1MzA1MDksImlhdCI6MTc1MDM0NjUwOSwiaXNzIjoiaHR0cHM6Ly91cnMuZWFydGhkYXRhLm5hc2EuZ292IiwiaWRlbnRpdHlfcHJvdmlkZXIiOiJlZGxfb3BzIiwiYWNyIjoiZWRsIiwiYXNzdXJhbmNlX2xldmVsIjozfQ.uTmuHUtNmckEwcI7XFrdHzNXfzbskVkR-niWbmucoEtqDBRFOCITaP-uD4ciQQC3-4vYC0qWS1YG1ixngrieZdKrJsK1cQprnPlI-w4rxIMd-Nfc-r9NqPTack9dtzidMMbdG5IWcL8elDaWAfMUoBtpcuRkAd6hDb7-92d44psN4Bpe4pN3Lerc9ok7j8pQ4ae2a4P7tTWHY7zfReqJnblAYzEgk07J-ss5DIMTly9l49iFGlNmPEPgNT6N1ChFWh5QrsqWxpu0SzSIoXg-9mXgBBkqA4E8UyLii_2yS2LKJNCloSHxxwN8FJjFCyvVPxn8QTYdeyuSEo_mInZUrg"
        
        # URLs base para MERRA-2
        self.ges_disc_base_url = "https://goldsmr4.gesdisc.eosdis.nasa.gov"
        self.merra2_base_path = "/data/MERRA2"
        
        self.config_method = None
        self.config_path = None
        
        # Configurar credenciales automáticamente
        self._setup_credentials()
    
    def _setup_credentials(self) -> None:
        """
        Configura las credenciales usando el mejor método disponible.
        Orden de prioridad:
        1. Variables de entorno existentes
        2. Archivo .netrc existente
        3. Crear nuevo archivo .netrc
        4. Configuración en memoria
        """
        try:
            # Método 1: Variables de entorno
            if self._check_environment_variables():
                self.config_method = "environment_variables"
                logger.info("✅ Usando credenciales de variables de entorno")
                return
            
            # Método 2: Archivo .netrc existente
            if self._check_existing_netrc():
                self.config_method = "existing_netrc"
                logger.info(f"✅ Usando archivo .netrc existente: {self.config_path}")
                return
            
            # Método 3: Crear archivo .netrc
            if self._create_netrc_file():
                self.config_method = "created_netrc"
                logger.info(f"✅ Archivo .netrc creado: {self.config_path}")
                return
            
            # Método 4: Configuración en memoria (fallback)
            self.config_method = "memory_fallback"
            logger.warning("⚠️ Usando configuración en memoria como fallback")
            
        except Exception as e:
            logger.error(f"❌ Error configurando credenciales NASA: {e}")
            self.config_method = "error"
    
    def _check_environment_variables(self) -> bool:
        """
        Verifica si las credenciales están disponibles en variables de entorno.
        
        Returns:
            bool: True si las credenciales están completas
        """
        nasa_username = os.environ.get("NASA_USERNAME")
        nasa_token = os.environ.get("NASA_TOKEN")
        
        if nasa_username and nasa_token:
            # Validar que el token tenga formato JWT básico
            if len(nasa_token) > 100 and nasa_token.count('.') >= 2:
                return True
            else:
                logger.warning("⚠️ Variable NASA_TOKEN tiene formato inválido")
        
        return False
    
    def _check_existing_netrc(self) -> bool:
        """
        Busca archivos .netrc existentes con credenciales NASA.
        
        Returns:
            bool: True si se encuentra un archivo válido
        """
        # Ubicaciones a verificar
        locations = [
            Path.home() / ".netrc",
            Path(".netrc")
        ]
        
        for location in locations:
            if location.exists() and location.is_file():
                try:
                    # Verificar que el archivo tenga credenciales NASA
                    with open(location, 'r') as f:
                        content = f.read().strip()
                    
                    # Buscar entradas para NASA Earthdata
                    nasa_hosts = ["urs.earthdata.nasa.gov", "goldsmr4.gesdisc.eosdis.nasa.gov"]
                    for host in nasa_hosts:
                        if host in content and "login" in content and "password" in content:
                            self.config_path = str(location)
                            return True
                            
                except Exception as e:
                    logger.warning(f"⚠️ Error leyendo {location}: {e}")
        
        return False
    
    def _create_netrc_file(self) -> bool:
        """
        Crea un nuevo archivo .netrc con las credenciales NASA.
        
        Returns:
            bool: True si el archivo se creó exitosamente
        """
        # Contenido del archivo .netrc para NASA Earthdata
        content = f"""machine urs.earthdata.nasa.gov
login {self.username}
password {self.token}

machine goldsmr4.gesdisc.eosdis.nasa.gov
login {self.username}
password {self.token}
"""
        
        # Ubicaciones a intentar (en orden de preferencia)
        locations = [
            Path.home() / ".netrc",  # Directorio home del usuario
            Path(".netrc")           # Directorio actual
        ]
        
        for location in locations:
            try:
                # Crear directorio padre si no existe
                location.parent.mkdir(parents=True, exist_ok=True)
                
                # Escribir archivo
                with open(location, 'w') as f:
                    f.write(content)
                
                # Establecer permisos restrictivos (solo lectura/escritura para el usuario)
                try:
                    os.chmod(location, 0o600)
                except OSError:
                    # En algunos sistemas (Windows) chmod puede fallar
                    pass
                
                self.config_path = str(location)
                logger.info(f"📝 Archivo .netrc creado en: {location}")
                return True
                
            except PermissionError:
                logger.warning(f"⚠️ Sin permisos para escribir en: {location}")
                continue
            except Exception as e:
                logger.warning(f"⚠️ Error creando archivo en {location}: {e}")
                continue
        
        return False
    
    def get_credentials(self) -> Tuple[Optional[str], Optional[str]]:
        """
        Obtiene las credenciales configuradas.
        
        Returns:
            Tuple[str, str]: (username, token) o (None, None) si no están disponibles
        """
        try:
            if self.config_method == "environment_variables":
                return os.environ.get("NASA_USERNAME"), os.environ.get("NASA_TOKEN")
            
            elif self.config_method in ["existing_netrc", "created_netrc", "memory_fallback"]:
                return self.username, self.token
            
            else:
                return None, None
                
        except Exception as e:
            logger.error(f"❌ Error obteniendo credenciales: {e}")
            return None, None
    
    def get_auth_session(self) -> requests.Session:
        """
        Crea una sesión de requests con autenticación configurada.
        
        Returns:
            requests.Session: Sesión configurada con autenticación
        """
        session = requests.Session()
        username, token = self.get_credentials()
        
        if username and token:
            # Configurar autenticación HTTP Basic
            session.auth = HTTPBasicAuth(username, token)
            
            # Headers adicionales para NASA Earthdata
            session.headers.update({
                'User-Agent': 'wind-analysis-merra2/1.0',
                'Accept': 'application/octet-stream, application/json'
            })
        
        return session
    
    def get_merra2_urls(self, year: str, month: str, day: str) -> Dict[str, str]:
        """
        Genera URLs para descargar datos MERRA-2 específicos.
        
        Args:
            year: Año en formato YYYY
            month: Mes en formato MM
            day: Día en formato DD
            
        Returns:
            Dict: URLs para diferentes tipos de datos MERRA-2
        """
        # Formato de fecha para MERRA-2
        date_str = f"{year}{month}{day}"
        
        # Estructura de directorios MERRA-2
        year_month = f"{year}/{month}"
        
        # URLs base para diferentes productos MERRA-2
        urls = {
            # M2T1NXSLV: Single-Level Diagnostics (incluye U10M, V10M, T2M, PS)
            "slv": f"{self.ges_disc_base_url}{self.merra2_base_path}/M2T1NXSLV.5.12.4/{year_month}/MERRA2_400.tavg1_2d_slv_Nx.{date_str}.nc4",
            
            # M2T1NXFLX: Surface Flux Diagnostics (datos adicionales si se necesitan)
            "flx": f"{self.ges_disc_base_url}{self.merra2_base_path}/M2T1NXFLX.5.12.4/{year_month}/MERRA2_400.tavg1_2d_flx_Nx.{date_str}.nc4"
        }
        
        return urls
    
    def validate_credentials(self) -> Dict:
        """
        Valida las credenciales configuradas haciendo una petición de prueba.
        
        Returns:
            Dict: Información sobre el estado de las credenciales
        """
        username, token = self.get_credentials()
        
        result = {
            "method": self.config_method,
            "config_path": self.config_path,
            "has_username": bool(username),
            "has_token": bool(token),
            "token_format_valid": False,
            "connection_test": "not_tested",
            "status": "unknown"
        }
        
        if token:
            # Validar formato JWT básico
            if len(token) > 100 and token.count('.') >= 2:
                result["token_format_valid"] = True
        
        # Determinar estado básico
        if result["has_username"] and result["has_token"] and result["token_format_valid"]:
            result["status"] = "credentials_valid"
            
            # Probar conexión real
            try:
                session = self.get_auth_session()
                # Hacer una petición simple a NASA Earthdata
                test_url = "https://urs.earthdata.nasa.gov/api/users/user"
                response = session.get(test_url, timeout=10)
                
                if response.status_code == 200:
                    result["connection_test"] = "success"
                    result["status"] = "fully_functional"
                elif response.status_code == 401:
                    result["connection_test"] = "auth_failed"
                    result["status"] = "auth_error"
                else:
                    result["connection_test"] = f"http_{response.status_code}"
                    result["status"] = "connection_error"
                    
            except Exception as e:
                result["connection_test"] = f"error: {str(e)}"
                result["status"] = "connection_error"
        
        elif result["has_username"] and result["has_token"]:
            result["status"] = "token_format_invalid"
        else:
            result["status"] = "credentials_missing"
        
        return result
    
    def get_status_report(self) -> str:
        """
        Genera un reporte de estado legible.
        
        Returns:
            str: Reporte de estado
        """
        validation = self.validate_credentials()
        
        report = f"""
=== Reporte de Estado NASA MERRA-2 ===
Método de configuración: {validation['method']}
Archivo de configuración: {validation['config_path'] or 'N/A'}
Usuario disponible: {'✅' if validation['has_username'] else '❌'}
Token disponible: {'✅' if validation['has_token'] else '❌'}
Formato de token válido: {'✅' if validation['token_format_valid'] else '❌'}
Prueba de conexión: {validation['connection_test']}
Estado general: {validation['status'].upper()}

Recomendaciones:
"""
        
        if validation['status'] == 'fully_functional':
            report += "- ✅ Configuración correcta. Las credenciales funcionan perfectamente."
        elif validation['status'] == 'credentials_valid':
            report += "- ⚠️ Credenciales válidas pero no se pudo probar la conexión."
        elif validation['status'] == 'auth_error':
            report += "- ❌ Error de autenticación. Verificar credenciales NASA Earthdata."
        elif validation['status'] == 'token_format_invalid':
            report += "- ❌ Formato de token inválido. Debe ser un JWT válido."
        else:
            report += "- ❌ Configuración inválida. Verificar credenciales NASA Earthdata."
            report += "\n- 💡 Asegúrese de tener credenciales válidas de NASA Earthdata."
        
        return report.strip()

# Función de conveniencia para uso directo
def setup_nasa_credentials(username: str = None, token: str = None) -> NASAConfigManager:
    """
    Configura las credenciales NASA de manera automática.
    
    Args:
        username: Usuario de NASA Earthdata (opcional)
        token: Token de NASA Earthdata (opcional)
    
    Returns:
        NASAConfigManager: Instancia configurada del gestor
    """
    return NASAConfigManager(username, token)

# Ejemplo de uso
if __name__ == "__main__":
    # Configurar logging para pruebas
    logging.basicConfig(level=logging.INFO)
    
    # Crear gestor de configuración
    config_manager = setup_nasa_credentials()
    
    # Mostrar reporte de estado
    print(config_manager.get_status_report())
    
    # Obtener credenciales
    username, token = config_manager.get_credentials()
    print(f"\nUsername: {username}")
    print(f"Token: {token[:20]}..." if token else "Token: None")
    
    # Obtener URLs de ejemplo
    urls = config_manager.get_merra2_urls("2023", "01", "01")
    print(f"\nURLs MERRA-2:")
    for key, url in urls.items():
        print(f"  {key}: {url}")

