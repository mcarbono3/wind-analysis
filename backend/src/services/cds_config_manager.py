"""
Gestor de configuración para credenciales de Copernicus CDS
Proporciona múltiples métodos de autenticación robustos
"""

import os
import logging
from pathlib import Path
from typing import Optional, Tuple, Dict

logger = logging.getLogger(__name__)

class CDSConfigManager:
    """
    Gestor de configuración para credenciales de Copernicus CDS.
    Implementa múltiples métodos de autenticación con fallbacks automáticos.
    """
    
    def __init__(self, user_id: str = None, api_token: str = None):
        """
        Inicializa el gestor de configuración CDS.
        
        Args:
            user_id: ID de usuario de Copernicus (opcional)
            api_token: Token API de Copernicus (opcional)
        """
        self.user_id = user_id or "45cfdc65-53d4-4a5e-91ed-37d24caf9c41"
        self.api_token = api_token or "c7cb9197-fc32-4420-8906-70a1d2e5219d"
        self.cds_url = "https://cds.climate.copernicus.eu/api/v2"
        
        self.config_method = None
        self.config_path = None
        
        # Configurar credenciales automáticamente
        self._setup_credentials()
    
    def _setup_credentials(self) -> None:
        """
        Configura las credenciales usando el mejor método disponible.
        Orden de prioridad:
        1. Variables de entorno existentes
        2. Archivo .cdsapirc existente
        3. Crear nuevo archivo .cdsapirc
        4. Configuración en memoria
        """
        try:
            # Método 1: Variables de entorno
            if self._check_environment_variables():
                self.config_method = "environment_variables"
                logger.info("✅ Usando credenciales de variables de entorno")
                return
            
            # Método 2: Archivo .cdsapirc existente
            if self._check_existing_cdsapirc():
                self.config_method = "existing_cdsapirc"
                logger.info(f"✅ Usando archivo .cdsapirc existente: {self.config_path}")
                return
            
            # Método 3: Crear archivo .cdsapirc
            if self._create_cdsapirc_file():
                self.config_method = "created_cdsapirc"
                logger.info(f"✅ Archivo .cdsapirc creado: {self.config_path}")
                return
            
            # Método 4: Configuración en memoria (fallback)
            self.config_method = "memory_fallback"
            logger.warning("⚠️ Usando configuración en memoria como fallback")
            
        except Exception as e:
            logger.error(f"❌ Error configurando credenciales CDS: {e}")
            self.config_method = "error"
    
    def _check_environment_variables(self) -> bool:
        """
        Verifica si las credenciales están disponibles en variables de entorno.
        
        Returns:
            bool: True si las credenciales están completas
        """
        cds_url = os.environ.get("CDSAPI_URL")
        cds_key = os.environ.get("CDSAPI_KEY")
        
        if cds_url and cds_key:
            # Validar formato de la clave
            if ":" in cds_key and len(cds_key.split(":")) == 2:
                return True
            else:
                logger.warning("⚠️ Variable CDSAPI_KEY tiene formato inválido")
        
        return False
    
    def _check_existing_cdsapirc(self) -> bool:
        """
        Busca archivos .cdsapirc existentes en ubicaciones estándar.
        
        Returns:
            bool: True si se encuentra un archivo válido
        """
        # Ubicaciones a verificar
        locations = [
            Path.home() / ".cdsapirc",
            Path(".cdsapirc"),
            Path("/etc/cdsapirc")  # Ubicación del sistema (menos común)
        ]
        
        for location in locations:
            if location.exists() and location.is_file():
                try:
                    # Verificar que el archivo tenga contenido válido
                    with open(location, 'r') as f:
                        content = f.read().strip()
                    
                    if "url:" in content and "key:" in content:
                        self.config_path = str(location)
                        return True
                    else:
                        logger.warning(f"⚠️ Archivo .cdsapirc inválido en: {location}")
                        
                except Exception as e:
                    logger.warning(f"⚠️ Error leyendo {location}: {e}")
        
        return False
    
    def _create_cdsapirc_file(self) -> bool:
        """
        Crea un nuevo archivo .cdsapirc con las credenciales proporcionadas.
        
        Returns:
            bool: True si el archivo se creó exitosamente
        """
        # Contenido del archivo .cdsapirc
        content = f"""url: {self.cds_url}
key: {self.user_id}:{self.api_token}
"""
        
        # Ubicaciones a intentar (en orden de preferencia)
        locations = [
            Path.home() / ".cdsapirc",  # Directorio home del usuario
            Path(".cdsapirc")           # Directorio actual
        ]
        
        for location in locations:
            try:
                # Crear directorio padre si no existe
                location.parent.mkdir(parents=True, exist_ok=True)
                
                # Escribir archivo
                with open(location, 'w') as f:
                    f.write(content)
                
                # Establecer permisos restrictivos (solo lectura para el usuario)
                try:
                    os.chmod(location, 0o600)
                except OSError:
                    # En algunos sistemas (Windows) chmod puede fallar
                    pass
                
                self.config_path = str(location)
                logger.info(f"📝 Archivo .cdsapirc creado en: {location}")
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
            Tuple[str, str]: (url, key) o (None, None) si no están disponibles
        """
        try:
            if self.config_method == "environment_variables":
                return os.environ.get("CDSAPI_URL"), os.environ.get("CDSAPI_KEY")
            
            elif self.config_method in ["existing_cdsapirc", "created_cdsapirc"]:
                # Las credenciales se leen automáticamente por cdsapi
                return self.cds_url, f"{self.user_id}:{self.api_token}"
            
            elif self.config_method == "memory_fallback":
                return self.cds_url, f"{self.user_id}:{self.api_token}"
            
            else:
                return None, None
                
        except Exception as e:
            logger.error(f"❌ Error obteniendo credenciales: {e}")
            return None, None
    
    def get_client_kwargs(self) -> Dict:
        """
        Obtiene los argumentos para crear un cliente cdsapi.Client().
        
        Returns:
            Dict: Argumentos para cdsapi.Client()
        """
        if self.config_method in ["existing_cdsapirc", "created_cdsapirc"]:
            # Dejar que cdsapi lea el archivo automáticamente
            return {}
        else:
            # Proporcionar credenciales explícitamente
            url, key = self.get_credentials()
            if url and key:
                return {"url": url, "key": key}
            else:
                return {}
    
    def validate_credentials(self) -> Dict:
        """
        Valida las credenciales configuradas.
        
        Returns:
            Dict: Información sobre el estado de las credenciales
        """
        url, key = self.get_credentials()
        
        result = {
            "method": self.config_method,
            "config_path": self.config_path,
            "has_url": bool(url),
            "has_key": bool(key),
            "key_format_valid": False,
            "status": "unknown"
        }
        
        if key:
            # Validar formato de la clave (debe ser UID:TOKEN)
            if ":" in key and len(key.split(":")) == 2:
                uid, token = key.split(":", 1)
                if len(uid) > 10 and len(token) > 10:  # Longitudes mínimas razonables
                    result["key_format_valid"] = True
        
        # Determinar estado general
        if result["has_url"] and result["has_key"] and result["key_format_valid"]:
            result["status"] = "valid"
        elif result["has_url"] and result["has_key"]:
            result["status"] = "partial"
        else:
            result["status"] = "invalid"
        
        return result
    
    def get_status_report(self) -> str:
        """
        Genera un reporte de estado legible.
        
        Returns:
            str: Reporte de estado
        """
        validation = self.validate_credentials()
        
        report = f"""
=== Reporte de Estado CDS ===
Método de configuración: {validation['method']}
Archivo de configuración: {validation['config_path'] or 'N/A'}
URL disponible: {'✅' if validation['has_url'] else '❌'}
Clave disponible: {'✅' if validation['has_key'] else '❌'}
Formato de clave válido: {'✅' if validation['key_format_valid'] else '❌'}
Estado general: {validation['status'].upper()}

Recomendaciones:
"""
        
        if validation['status'] == 'valid':
            report += "- ✅ Configuración correcta. Las credenciales deberían funcionar."
        elif validation['status'] == 'partial':
            report += "- ⚠️ Credenciales parcialmente válidas. Verificar formato de la clave."
        else:
            report += "- ❌ Configuración inválida. Verificar credenciales."
            report += "\n- 💡 Asegúrese de tener un archivo .cdsapirc válido o variables de entorno configuradas."
        
        return report.strip()

# Función de conveniencia para uso directo
def setup_cds_credentials(user_id: str = None, api_token: str = None) -> CDSConfigManager:
    """
    Configura las credenciales CDS de manera automática.
    
    Args:
        user_id: ID de usuario de Copernicus (opcional)
        api_token: Token API de Copernicus (opcional)
    
    Returns:
        CDSConfigManager: Instancia configurada del gestor
    """
    return CDSConfigManager(user_id, api_token)

# Ejemplo de uso
if __name__ == "__main__":
    # Configurar logging para pruebas
    logging.basicConfig(level=logging.INFO)
    
    # Crear gestor de configuración
    config_manager = setup_cds_credentials()
    
    # Mostrar reporte de estado
    print(config_manager.get_status_report())
    
    # Obtener credenciales
    url, key = config_manager.get_credentials()
    print(f"\nURL: {url}")
    print(f"Key: {key[:20]}..." if key else "Key: None")
    
    # Obtener argumentos para cliente
    client_kwargs = config_manager.get_client_kwargs()
    print(f"Client kwargs: {list(client_kwargs.keys())}")

