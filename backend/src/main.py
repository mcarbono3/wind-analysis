from flask import Flask, send_from_directory, request, make_response
from flask_cors import CORS
from src.models.user import db
from src.routes.user import user_bp
from src.routes.era5 import era5_bp
from src.routes.analysis import analysis_bp
from src.routes.ai import ai_bp
from src.routes.export import export_bp
import os
import sys

# DON\"T CHANGE THIS !!!
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__ )))

app = Flask(__name__, static_folder=os.path.join(os.path.dirname(__file__), 'static'))
app.config['SECRET_KEY'] = 'asdf#FGSgvasgf$5$WGT'

# Habilitar CORS para todas las rutas y orígenes (temporalmente para depuración)
# CORS(app, resources={r"/*": {"origins":"https://mcarbono3.github.io/wind-analysis"}} )

@app.before_request
def handle_preflight():
    if request.method == "OPTIONS":
        res = make_response()
        res.headers["Access-Control-Allow-Origin"] = "https://mcarbono3.github.io"
        res.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS"
        res.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization"
        res.headers["Access-Control-Max-Age"] = "86400"
        return res

@app.after_request
def add_cors_headers(response ):
    response.headers["Access-Control-Allow-Origin"] = "https://mcarbono3.github.io"
    response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization"
    return response

app.register_blueprint(user_bp, url_prefix='/api' )
app.register_blueprint(era5_bp, url_prefix='/api')
app.register_blueprint(analysis_bp, url_prefix='/api')
app.register_blueprint(ai_bp, url_prefix='/api')
app.register_blueprint(export_bp, url_prefix='/api')

# uncomment if you need to use database
app.config['SQLALCHEMY_DATABASE_URI'] = f"sqlite:///{os.path.join(os.path.dirname(__file__), 'database', 'app.db')}"
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
db.init_app(app)

with app.app_context():
    db.create_all()

@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def serve(path):
    static_folder_path = app.static_folder
    if static_folder_path is None:
        return "Static folder not configured", 404

    if path != "" and os.path.exists(os.path.join(static_folder_path, path)):
        return send_from_directory(static_folder_path, path)
    else:
        index_path = os.path.join(static_folder_path, 'index.html')
        if os.path.exists(index_path):
            return send_from_directory(static_folder_path, 'index.html')
        else:
            return "index.html not found", 404

# Configurar cliente de cdsapi usando variables de entorno (sin usar .cdsapirc)
import cdsapi
cdsapi_url = os.getenv('CDSAPI_URL')
cdsapi_key = os.getenv('CDSAPI_KEY')
cds_client = cdsapi.Client(url=cdsapi_url, key=cdsapi_key)

# Cambiar app.run() por una configuración para Gunicorn
# if __name__ == '__main__':
#     app.run(host='0.0.0.0', port=5000, debug=True)

