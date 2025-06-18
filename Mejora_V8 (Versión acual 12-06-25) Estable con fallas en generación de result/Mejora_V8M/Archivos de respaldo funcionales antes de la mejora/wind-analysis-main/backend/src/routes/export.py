from flask import Blueprint, request, jsonify, send_file
from src.services.export_service import DataExporter, ReportGenerator
import os
import tempfile
import datetime

export_bp = Blueprint('export', __name__)

@export_bp.route('/export-csv', methods=['POST'])
def export_csv():
    """
    Exporta los datos de análisis a formato CSV
    """
    try:
        data = request.get_json()
        
        if 'analysis_data' not in data:
            return jsonify({'error': 'Se requieren datos de análisis'}), 400
        
        analysis_data = data['analysis_data']
        location_info = data.get('location_info', None)
        
        # Crear exportador
        exporter = DataExporter()
        
        # Exportar a CSV
        csv_filepath = exporter.export_to_csv(analysis_data, location_info)
        
        # Retornar archivo
        return send_file(
            csv_filepath,
            as_attachment=True,
            download_name=os.path.basename(csv_filepath),
            mimetype='text/csv'
        )
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@export_bp.route('/export-wind-rose-csv', methods=['POST'])
def export_wind_rose_csv():
    """
    Exporta datos de rosa de vientos a formato CSV
    """
    try:
        data = request.get_json()
        
        if 'wind_speeds' not in data or 'wind_directions' not in data:
            return jsonify({'error': 'Se requieren datos de velocidad y dirección del viento'}), 400
        
        wind_speeds = data['wind_speeds']
        wind_directions = data['wind_directions']
        
        # Crear exportador
        exporter = DataExporter()
        
        # Generar datos de rosa de vientos
        import numpy as np
        wind_rose_df = exporter.generate_wind_rose_data(
            np.array(wind_speeds), 
            np.array(wind_directions)
        )
        
        # Guardar en archivo temporal
        import datetime
        timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"rosa_vientos_{timestamp}.csv"
        filepath = os.path.join(tempfile.gettempdir(), filename)
        
        wind_rose_df.to_csv(filepath, index=False, encoding='utf-8')
        
        # Retornar archivo
        return send_file(
            filepath,
            as_attachment=True,
            download_name=filename,
            mimetype='text/csv'
        )
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@export_bp.route('/generate-pdf-report', methods=['POST'])
def generate_pdf_report():
    """
    Genera un reporte PDF completo del análisis eólico
    """
    try:
        data = request.get_json()
        
        if 'analysis_data' not in data:
            return jsonify({'error': 'Se requieren datos de análisis'}), 400
        
        analysis_data = data['analysis_data']
        location_info = data.get('location_info', None)
        ai_diagnosis = data.get('ai_diagnosis', None)
        
        # Crear generador de reportes
        report_generator = ReportGenerator()
        
        # Generar reporte PDF
        pdf_filepath = report_generator.generate_pdf_report(
            analysis_data, 
            location_info, 
            ai_diagnosis
        )
        
        # Retornar archivo
        return send_file(
            pdf_filepath,
            as_attachment=True,
            download_name=os.path.basename(pdf_filepath),
            mimetype='application/pdf'
        )
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@export_bp.route('/export-summary', methods=['POST'])
def export_summary():
    """
    Genera un resumen ejecutivo en formato JSON para exportación
    """
    try:
        data = request.get_json()
        
        if 'analysis_data' not in data:
            return jsonify({'error': 'Se requieren datos de análisis'}), 400
        
        analysis_data = data['analysis_data']
        location_info = data.get('location_info', None)
        ai_diagnosis = data.get('ai_diagnosis', None)
        
        # Crear resumen ejecutivo
        summary = {
            'metadata': {
                'generated_at': datetime.datetime.now().isoformat(),
                'location': location_info,
                'data_source': 'ERA5 - ECMWF'
            },
            'executive_summary': {
                'viability_level': analysis_data.get('overall_assessment', {}).get('viability_level', 'N/A'),
                'viability_score': analysis_data.get('overall_assessment', {}).get('viability_score', 0),
                'viability_message': analysis_data.get('overall_assessment', {}).get('viability_message', ''),
                'key_metrics': analysis_data.get('overall_assessment', {}).get('key_metrics', {})
            },
            'wind_resource': {
                'mean_wind_speed': analysis_data.get('basic_statistics', {}).get('mean', 0),
                'weibull_parameters': {
                    'k': analysis_data.get('weibull_analysis', {}).get('k', 0),
                    'c': analysis_data.get('weibull_analysis', {}).get('c', 0)
                },
                'turbulence_intensity': analysis_data.get('turbulence_analysis', {}).get('overall', {}).get('turbulence_intensity', 0),
                'power_density': analysis_data.get('power_density', {}).get('mean_power_density', 0)
            },
            'energy_potential': {
                'capacity_factor': analysis_data.get('capacity_factor', {}).get('capacity_factor', 0),
                'annual_energy_production': analysis_data.get('capacity_factor', {}).get('annual_energy_production', 0),
                'operational_probability': analysis_data.get('wind_probabilities', {}).get('prob_operational', 0)
            },
            'ai_diagnosis': ai_diagnosis,
            'recommendations': analysis_data.get('overall_assessment', {}).get('recommendations', [])
        }
        
        return jsonify({
            'status': 'success',
            'summary': summary
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@export_bp.route('/export-formats', methods=['GET'])
def get_export_formats():
    """
    Retorna los formatos de exportación disponibles
    """
    formats = {
        'csv': {
            'name': 'CSV (Comma Separated Values)',
            'description': 'Datos tabulares para análisis en Excel o herramientas estadísticas',
            'endpoint': '/api/export-csv',
            'method': 'POST'
        },
        'pdf': {
            'name': 'PDF Report',
            'description': 'Reporte completo con gráficos y análisis detallado',
            'endpoint': '/api/generate-pdf-report',
            'method': 'POST'
        },
        'wind_rose_csv': {
            'name': 'Rosa de Vientos CSV',
            'description': 'Datos de frecuencia direccional del viento',
            'endpoint': '/api/export-wind-rose-csv',
            'method': 'POST'
        },
        'json_summary': {
            'name': 'Resumen JSON',
            'description': 'Resumen ejecutivo en formato JSON para integración',
            'endpoint': '/api/export-summary',
            'method': 'POST'
        }
    }
    
    return jsonify({
        'status': 'success',
        'available_formats': formats
    })

