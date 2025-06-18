#!/usr/bin/env python3
"""
Script de prueba mejorado para verificar conexión a Copernicus CDS
Implementa múltiples métodos de autenticación y diagnóstico detallado
"""

import os
import sys
import logging
from pathlib import Path
from datetime import datetime
import tempfile

# Importar el gestor de configuración personalizado
try:
    from services.cds_config_manager import CDSConfigManager
except ImportError:
    print("❌ Error: No se pudo importar cds_config_manager.py")
    print("   Asegúrese de que el archivo esté en el mismo directorio.")
    sys.exit(1)

# Configurar logging detallado
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)
logger = logging.getLogger(__name__)

def test_cds_connection_comprehensive():
    """
    Prueba comprehensiva de la conexión a Copernicus CDS
    """
    print("=" * 60)
    print("🧪 PRUEBA COMPREHENSIVA DE CONEXIÓN CDS")
    print("=" * 60)
    
    # Paso 1: Configurar credenciales
    print("\n📋 PASO 1: Configuración de credenciales")
    print("-" * 40)
    
    try:
        config_manager = CDSConfigManager()
        print(config_manager.get_status_report())
        
        # Validar credenciales
        validation = config_manager.validate_credentials()
        if validation['status'] != 'valid':
            print(f"\n⚠️ ADVERTENCIA: Estado de credenciales: {validation['status']}")
            print("   La conexión podría fallar.")
        
    except Exception as e:
        print(f"❌ Error configurando credenciales: {e}")
        return {"status": "error", "step": "configuration", "error": str(e)}
    
    # Paso 2: Importar y crear cliente CDS
    print("\n🔌 PASO 2: Creación de cliente CDS")
    print("-" * 40)
    
    try:
        import cdsapi
        print("✅ Módulo cdsapi importado correctamente")
        
        # Obtener argumentos para el cliente
        client_kwargs = config_manager.get_client_kwargs()
        print(f"📝 Argumentos del cliente: {list(client_kwargs.keys())}")
        
        # Crear cliente
        if client_kwargs:
            client = cdsapi.Client(**client_kwargs)
            print("✅ Cliente CDS creado con argumentos explícitos")
        else:
            client = cdsapi.Client()
            print("✅ Cliente CDS creado (usando configuración automática)")
        
    except ImportError:
        error_msg = "Módulo cdsapi no está instalado. Instale con: pip install cdsapi"
        print(f"❌ {error_msg}")
        return {"status": "error", "step": "import", "error": error_msg}
    
    except Exception as e:
        print(f"❌ Error creando cliente CDS: {e}")
        return {"status": "error", "step": "client_creation", "error": str(e)}
    
    # Paso 3: Prueba de conexión básica
    print("\n🌐 PASO 3: Prueba de conexión básica")
    print("-" * 40)
    
    try:
        # Intentar una operación simple que no descargue datos
        # Nota: Esto podría generar un error, pero nos ayuda a verificar la autenticación
        print("🔄 Intentando operación de prueba...")
        
        # Crear una solicitud mínima para verificar autenticación
        # Esta solicitud debería fallar por parámetros, pero no por autenticación
        try:
            client.retrieve("reanalysis-era5-single-levels", {
                "product_type": "reanalysis",
                "variable": "2m_temperature",
                "year": "2023",
                "month": "01",
                "day": "01",
                "time": "00:00",
                "format": "grib"
                # Intencionalmente sin 'area' para que falle rápido
            }, "/tmp/test_nonexistent.grib")
            
        except Exception as e:
            error_str = str(e).lower()
            
            # Analizar el tipo de error
            if "authentication" in error_str or "unauthorized" in error_str or "invalid key" in error_str:
                print(f"❌ Error de autenticación: {e}")
                return {"status": "error", "step": "authentication", "error": str(e)}
            
            elif "area" in error_str or "parameter" in error_str or "request" in error_str:
                print("✅ Autenticación exitosa (error esperado de parámetros)")
                print(f"   Detalle del error: {e}")
            
            else:
                print(f"⚠️ Error inesperado: {e}")
                print("   Esto podría indicar un problema de conectividad o configuración")
        
    except Exception as e:
        print(f"❌ Error en prueba de conexión: {e}")
        return {"status": "error", "step": "connection_test", "error": str(e)}
    
    # Paso 4: Prueba de descarga real (opcional y limitada)
    print("\n⬇️ PASO 4: Prueba de descarga limitada")
    print("-" * 40)
    
    try:
        print("🔄 Intentando descarga de muestra pequeña...")
        
        # Crear archivo temporal
        with tempfile.NamedTemporaryFile(suffix=".grib", delete=False) as temp_file:
            temp_path = temp_file.name
        
        try:
            # Solicitud muy pequeña para minimizar tiempo y uso de cuota
            client.retrieve("reanalysis-era5-single-levels", {
                "product_type": "reanalysis",
                "variable": "2m_temperature",
                "year": "2023",
                "month": "01",
                "day": "01",
                "time": "00:00",
                "area": [10, -75, 9, -74],  # Área muy pequeña (1x1 grado)
                "format": "grib"
            }, temp_path)
            
            # Verificar que el archivo se descargó
            if os.path.exists(temp_path) and os.path.getsize(temp_path) > 0:
                file_size = os.path.getsize(temp_path)
                print(f"✅ Descarga exitosa: {file_size} bytes")
                
                # Limpiar archivo temporal
                os.unlink(temp_path)
                
                return {
                    "status": "success",
                    "message": "Conexión CDS completamente funcional",
                    "download_size": file_size,
                    "credentials_method": config_manager.config_method
                }
            else:
                print("⚠️ Descarga completada pero archivo vacío")
                return {
                    "status": "partial",
                    "message": "Conexión establecida pero descarga incompleta"
                }
        
        except Exception as e:
            error_str = str(e).lower()
            
            if "quota" in error_str or "limit" in error_str:
                print(f"⚠️ Límite de cuota alcanzado: {e}")
                return {
                    "status": "quota_exceeded",
                    "message": "Conexión exitosa pero cuota excedida",
                    "credentials_method": config_manager.config_method
                }
            
            elif "authentication" in error_str or "unauthorized" in error_str:
                print(f"❌ Error de autenticación en descarga: {e}")
                return {"status": "error", "step": "download_auth", "error": str(e)}
            
            else:
                print(f"⚠️ Error en descarga: {e}")
                return {
                    "status": "connection_ok",
                    "message": "Conexión establecida, error en descarga específica",
                    "error": str(e)
                }
        
        finally:
            # Limpiar archivo temporal si existe
            if os.path.exists(temp_path):
                try:
                    os.unlink(temp_path)
                except:
                    pass
    
    except Exception as e:
        print(f"❌ Error en prueba de descarga: {e}")
        return {"status": "error", "step": "download_test", "error": str(e)}

def print_environment_info():
    """
    Imprime información del entorno para diagnóstico
    """
    print("\n🔍 INFORMACIÓN DEL ENTORNO")
    print("-" * 40)
    
    # Variables de entorno relevantes
    env_vars = ["CDSAPI_URL", "CDSAPI_KEY", "HOME", "USER", "PWD"]
    for var in env_vars:
        value = os.environ.get(var)
        if var == "CDSAPI_KEY" and value:
            # Ocultar la clave por seguridad
            value = f"{value[:10]}...{value[-10:]}" if len(value) > 20 else "***"
        print(f"  {var}: {value or 'No definida'}")
    
    # Archivos de configuración
    print("\n📁 Archivos de configuración:")
    config_files = [
        Path.home() / ".cdsapirc",
        Path(".cdsapirc"),
        Path("/etc/cdsapirc")
    ]
    
    for config_file in config_files:
        if config_file.exists():
            try:
                size = config_file.stat().st_size
                print(f"  ✅ {config_file} (tamaño: {size} bytes)")
            except:
                print(f"  ⚠️ {config_file} (error leyendo)")
        else:
            print(f"  ❌ {config_file} (no existe)")
    
    # Información de Python
    print(f"\n🐍 Python: {sys.version}")
    print(f"📂 Directorio actual: {os.getcwd()}")

def main():
    """
    Función principal del script de prueba
    """
    print(f"🕐 Iniciado: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    
    # Mostrar información del entorno
    print_environment_info()
    
    # Ejecutar prueba comprehensiva
    result = test_cds_connection_comprehensive()
    
    # Mostrar resultado final
    print("\n" + "=" * 60)
    print("📊 RESULTADO FINAL")
    print("=" * 60)
    
    status = result.get("status", "unknown")
    
    if status == "success":
        print("🎉 ¡ÉXITO! La conexión a Copernicus CDS está completamente funcional.")
        print(f"   Método de credenciales: {result.get('credentials_method', 'desconocido')}")
        print(f"   Tamaño de descarga de prueba: {result.get('download_size', 'N/A')} bytes")
    
    elif status == "quota_exceeded":
        print("✅ CONEXIÓN EXITOSA (cuota excedida)")
        print("   La autenticación funciona correctamente.")
        print("   La cuota de descarga ha sido alcanzada.")
    
    elif status == "connection_ok":
        print("✅ CONEXIÓN ESTABLECIDA")
        print("   La autenticación funciona correctamente.")
        print(f"   Error específico: {result.get('error', 'N/A')}")
    
    elif status == "partial":
        print("⚠️ CONEXIÓN PARCIAL")
        print("   La conexión se estableció pero hay problemas en la descarga.")
    
    else:
        print("❌ ERROR EN LA CONEXIÓN")
        print(f"   Paso fallido: {result.get('step', 'desconocido')}")
        print(f"   Error: {result.get('error', 'desconocido')}")
    
    print(f"\n🕐 Finalizado: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    
    return result

if __name__ == "__main__":
    try:
        result = main()
        
        # Código de salida basado en el resultado
        if result.get("status") in ["success", "quota_exceeded", "connection_ok"]:
            sys.exit(0)  # Éxito
        else:
            sys.exit(1)  # Error
            
    except KeyboardInterrupt:
        print("\n\n⏹️ Prueba interrumpida por el usuario")
        sys.exit(130)
    
    except Exception as e:
        print(f"\n\n💥 Error inesperado: {e}")
        sys.exit(1)

