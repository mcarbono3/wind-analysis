# Script de prueba para verificar conexión a Copernicus CDS
import os
import cdsapi
import logging

# Configurar logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def test_cds_connection():
    """
    Prueba la conexión a Copernicus CDS con las credenciales configuradas
    """
    try:
        # Obtener credenciales de variables de entorno
        cds_url = os.environ.get("CDSAPI_URL")
        cds_key = os.environ.get("CDSAPI_KEY")
        
        logger.info(f"🔑 CDSAPI_URL: {cds_url}")
        logger.info(f"🔑 CDSAPI_KEY: {cds_key[:10]}...{cds_key[-10:] if cds_key else 'None'}")
        
        if not cds_url or not cds_key:
            raise ValueError("Las variables de entorno CDSAPI_URL o CDSAPI_KEY no están configuradas.")
        
        # Inicializar cliente CDS
        c = cdsapi.Client(url=cds_url, key=cds_key)
        
        logger.info("✅ Cliente CDS inicializado correctamente")
        
        # Hacer una solicitud de prueba pequeña
        logger.info("🧪 Realizando solicitud de prueba...")
        
        # Solicitud mínima para verificar conectividad
        result = c.retrieve(
            'reanalysis-era5-single-levels',
            {
                'product_type': 'reanalysis',
                'variable': '10m_u_component_of_wind',
                'year': '2023',
                'month': '01',
                'day': '01',
                'time': '00:00',
                'area': [11, -75, 10, -74],  # Área muy pequeña
                'format': 'netcdf',
            }
        )
        
        logger.info(f"✅ Solicitud exitosa: {result}")
        return True
        
    except Exception as e:
        logger.error(f"❌ Error en conexión CDS: {e}")
        return False

if __name__ == "__main__":
    test_cds_connection()

