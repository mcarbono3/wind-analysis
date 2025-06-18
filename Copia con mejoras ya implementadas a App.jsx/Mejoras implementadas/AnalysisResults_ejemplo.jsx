// Ejemplo de Componente React con Validaciones Robustas
// Archivo: AnalysisResults.jsx

import React from 'react';

const AnalysisResults = ({ analysisData, dateRange }) => {
  // Función de utilidad mejorada para colores de viabilidad
  const getViabilityColor = (level) => {
    if (!level) return 'bg-gray-500';
    
    const normalizedLevel = level.toLowerCase();
    switch (normalizedLevel) {
      case 'alto':
      case 'alta':
      case 'high': 
        return 'bg-green-500';
      case 'moderado':
      case 'moderada':
      case 'medium':
      case 'moderate': 
        return 'bg-yellow-500';
      case 'bajo':
      case 'baja':
      case 'low': 
        return 'bg-red-500';
      default: 
        return 'bg-gray-500';
    }
  };

  // Función de utilidad mejorada para iconos de viabilidad
  const getViabilityIcon = (message) => {
    if (!message) return '❓';
    
    const normalizedMessage = message.toLowerCase();
    if (normalizedMessage.includes('viable') || normalizedMessage.includes('recomendado')) return '✅';
    if (normalizedMessage.includes('moderado') || normalizedMessage.includes('precaución')) return '⚠️';
    if (normalizedMessage.includes('no viable') || normalizedMessage.includes('no recomendado')) return '❌';
    return '📊';
  };

  // Renderizado condicional robusto
  if (!analysisData) {
    return (
      <div className="p-4 bg-yellow-100 border border-yellow-400 rounded-md">
        <p className="text-yellow-800">No hay datos de análisis disponibles.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Resumen del Análisis */}
      <div className="bg-white p-6 rounded-lg shadow-md">
        <h3 className="text-lg font-semibold mb-4">Resumen del Análisis</h3>
        
        {/* Área Analizada con validación robusta */}
        <p className="mb-2">
          <strong>Área Analizada:</strong>{' '}
          {analysisData?.location?.bounds?.[0]?.[0]?.toFixed(2) || 'N/A'}°,{' '}
          {analysisData?.location?.bounds?.[0]?.[1]?.toFixed(2) || 'N/A'}° a{' '}
          {analysisData?.location?.bounds?.[1]?.[0]?.toFixed(2) || 'N/A'}°,{' '}
          {analysisData?.location?.bounds?.[1]?.[1]?.toFixed(2) || 'N/A'}°
        </p>

        {/* Fechas con validación */}
        <p className="mb-2">
          <strong>Fecha de Inicio:</strong> {dateRange?.startDate || 'N/A'}
        </p>
        <p className="mb-4">
          <strong>Fecha de Fin:</strong> {dateRange?.endDate || 'N/A'}
        </p>

        {/* Viabilidad con renderizado condicional completo */}
        {analysisData?.viability_level ? (
          <div className={`p-3 rounded-md ${getViabilityColor(analysisData.viability_level)} text-white flex items-center space-x-2`}>
            <span className="text-2xl">{getViabilityIcon(analysisData.recommendation)}</span>
            <p className="font-bold">{analysisData.recommendation || 'Sin recomendación disponible'}</p>
          </div>
        ) : (
          <div className="p-3 rounded-md bg-gray-500 text-white flex items-center space-x-2">
            <span className="text-2xl">❓</span>
            <p className="font-bold">Datos de viabilidad no disponibles</p>
          </div>
        )}

        {/* Estadísticas adicionales con optional chaining */}
        <div className="mt-4 space-y-2">
          <p className="text-sm text-gray-700">
            <strong>Velocidad Promedio del Viento:</strong>{' '}
            {analysisData?.avg_wind_speed?.toFixed(2) || 'N/A'} m/s
          </p>
          <p className="text-sm text-gray-700">
            <strong>Nivel de Viabilidad:</strong>{' '}
            {analysisData?.viability_level || 'No disponible'}
          </p>
        </div>
      </div>

      {/* Estadísticas Principales */}
      <div className="bg-white p-6 rounded-lg shadow-md">
        <h3 className="text-lg font-semibold mb-4">Estadísticas Principales</h3>
        <div className="space-y-2">
          <p>
            <strong>Velocidad Media del Viento (10m):</strong>{' '}
            {analysisData?.mean_wind_speed_10m?.toFixed(2) || 'N/A'} m/s
          </p>
          <p>
            <strong>Velocidad Media del Viento (100m):</strong>{' '}
            {analysisData?.mean_wind_speed_100m?.toFixed(2) || 'N/A'} m/s
          </p>
          <p>
            <strong>Densidad de Potencia (100m):</strong>{' '}
            {analysisData?.power_density_100m?.toFixed(2) || 'N/A'} W/m²
          </p>
          <p>
            <strong>Factor de Capacidad (100m):</strong>{' '}
            {(analysisData?.capacity_factor_100m * 100)?.toFixed(2) || 'N/A'}%
          </p>
        </div>
      </div>
    </div>
  );
};

export default AnalysisResults;

