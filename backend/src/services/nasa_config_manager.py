import logging
from typing import Optional, Tuple, Dict
import requests
from requests.auth import HTTPBasicAuth

logger = logging.getLogger(__name__)

class NASAConfigManager:
    def __init__(self, username: str, password: str):
        self.username = username
        self.password = password
        self.config_method = "direct"
        self.ges_disc_base_url = "https://goldsmr4.gesdisc.eosdis.nasa.gov"
        self.merra2_base_path = "/data/MERRA2"
        logger.info("✅ Credenciales cargadas directamente")

    def get_credentials(self) -> Tuple[Optional[str], Optional[str]]:
        return self.username, self.password

    def get_auth_session(self) -> requests.Session:
        session = requests.Session()
        session.auth = HTTPBasicAuth(self.username, self.password)
        session.trust_env = False  # Ignorar .netrc y env
        session.headers.update({
            'User-Agent': 'wind-analysis-merra2/1.0',
            'Accept': 'application/octet-stream, application/json'
        })
        return session

    def get_merra2_urls(self, year: str, month: str, day: str) -> Dict[str, str]:
        date_str = f"{year}{month}{day}"
        year_month = f"{year}/{month}"
        return {
            "slv": f"{self.ges_disc_base_url}{self.merra2_base_path}/M2T1NXSLV.5.12.4/{year_month}/MERRA2_400.tavg1_2d_slv_Nx.{date_str}.nc4",
            "flx": f"{self.ges_disc_base_url}{self.merra2_base_path}/M2T1NXFLX.5.12.4/{year_month}/MERRA2_400.tavg1_2d_flx_Nx.{date_str}.nc4"
        }

    def validate_credentials(self) -> Dict:
        username, password = self.get_credentials()
        result = {
            "method": self.config_method,
            "has_username": bool(username),
            "has_password": bool(password),
            "connection_test": "not_tested",
            "status": "unknown"
        }
        if not username or not password:
            result["status"] = "credentials_missing"
            return result

        try:
            session = self.get_auth_session()
            response = session.get("https://urs.earthdata.nasa.gov/api/users/user", timeout=10)
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

        return result

    def get_status_report(self) -> str:
        validation = self.validate_credentials()
        report = f"""
=== Reporte de Estado NASA MERRA-2 ===
Método: {validation['method']}
Usuario: {'✅' if validation['has_username'] else '❌'}
Contraseña: {'✅' if validation['has_password'] else '❌'}
Prueba conexión: {validation['connection_test']}
Estado: {validation['status'].upper()}
"""
        return report.strip()

# Para pruebas directas
if __name__ == "__main__":
    import getpass
    logging.basicConfig(level=logging.INFO)
    user = input("Usuario Earthdata: ")
    pwd = getpass.getpass("Contraseña: ")
    manager = NASAConfigManager(user, pwd)
    print(manager.get_status_report())
