import React, { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Rectangle, useMapEvents, useMap } from 'react-leaflet';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Badge } from './ui/badge';
import { Alert, AlertDescription } from './ui/alert';
import { Wind, MapPin, Calendar, Download, BarChart3, TrendingUp, XCircle, ArrowLeft, CloudSnow, Zap } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell, PolarGrid, PolarAngleAxis, PolarRadiusAxis, RadialBarChart, RadialBar } from 'recharts';
import axios from 'axios';
import 'leaflet/dist/leaflet.css';
import { utils as XLSXUtils, writeFile as XLSXWriteFile } from "xlsx";
import jsPDF from 'jspdf';
import 'jspdf-autotable';

// Importar Leaflet y el plugin de heatmap
import L from 'leaflet';
import 'leaflet.heat';

import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

// Solución para el problema del icono predeterminado de Leaflet en Webpack
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

// Configuración de la API
const API_BASE_URL = 'https://wind-analysis.onrender.com/api';

// Funciones helper para acceso seguro a datos
const safeGet = (obj, path, defaultValue = null) => {
    try {
        return path.split('.').reduce((current, key) => current?.[key], obj) ?? defaultValue;
    } catch {
        return defaultValue;
    }
};

const safeNumber = (value, defaultValue = 0) => {
    const num = Number(value);
    return isNaN(num) || !isFinite(num) ? defaultValue : num;
};

const safeArray = (arr, defaultValue = []) => {
    return Array.isArray(arr) && arr.length > 0 ? arr : defaultValue;
};

const formatNumber = (value, decimals = 2, defaultText = 'N/A') => {
    const num = safeNumber(value);
    return num !== 0 || value === 0 ? num.toFixed(decimals) : defaultText;
};

const formatPercentage = (value, decimals = 2, defaultText = 'N/A') => {
    const num = safeNumber(value);
    if (num === 0 && value !== 0) return defaultText;
    return `${(num * 100).toFixed(decimals)}%`;
};

const isValidDate = (date) => {
    return date instanceof Date && !isNaN(date.getTime());
};

const formatDate = (dateString, defaultText = 'Fecha inválida') => {
    try {
        const date = new Date(dateString);
        return isValidDate(date) ? date.toLocaleDateString() : defaultText;
    } catch {
        return defaultText;
    }
};

const formatDateTime = (dateString, defaultText = 'Fecha inválida') => {
    try {
        const date = new Date(dateString);
        return isValidDate(date) ? date.toLocaleString() : defaultText;
    } catch {
        return defaultText;
    }
};

const convertWindSpeed = (value, unit) => {
    const v = safeNumber(value);
    return unit === 'kmh' ? v * 3.6 : v;
};

// Componente para la capa de heatmap del viento promedio
function WindHeatmapLayer({ data }) {
  const map = useMap();
  const heatLayerRef = useRef(null);

  useEffect(() => {
    if (!map || !data?.length) return;

    // Remover capa anterior si existe
    if (heatLayerRef.current) {
      map.removeLayer(heatLayerRef.current);
    }

    // Crear nueva capa
    const newLayer = L.heatLayer(data, {
      radius: 25,
      blur: 15,
      maxZoom: 17,
      max: 12,
      minOpacity: 0.4,
      gradient: {
        0.0: "#0000ff",
        0.25: "#00ffff",
        0.5: "#00ff00",
        0.75: "#ffff00",
        1.0: "#ff0000"
      }
    }).addTo(map);

    heatLayerRef.current = newLayer;

    return () => {
      if (heatLayerRef.current) {
        map.removeLayer(heatLayerRef.current);
        heatLayerRef.current = null;
      }
    };
  }, [map, data]);

  return null;
}

// Función para normalizar la estructura de datos del análisis
const normalizeAnalysisData = (rawAnalysis) => {
  console.log('🔄 Normalizing analysis data:', rawAnalysis);
  
  if (!rawAnalysis) {
    return null;
  }
  
  return {
    basic_statistics: rawAnalysis.basic_statistics || {},
    capacity_factor: rawAnalysis.capacity_factor || {},
    overall_assessment: rawAnalysis.overall_assessment || {},
    power_density: rawAnalysis.power_density || {},
    turbulence_analysis: rawAnalysis.turbulence_analysis || {},
    weibull_analysis: rawAnalysis.weibull_analysis || {},
    wind_rose: rawAnalysis.wind_rose || {},
    time_series: safeArray(rawAnalysis.time_series),
    hourly_patterns: rawAnalysis.hourly_patterns || {},
    monthly_patterns: rawAnalysis.monthly_patterns || {},
    // Nuevos campos para la viabilidad mejorada
    statistical_diagnosis: rawAnalysis.statistical_diagnosis || {},
    climate_diagnosis: rawAnalysis.climate_diagnosis || {},
    consolidated_viability: rawAnalysis.consolidated_viability || '',
    combined_recommendations: rawAnalysis.combined_recommendations || '',
    detailed_explanations: rawAnalysis.detailed_explanations || {}
  };
};

// Función para extraer estadísticas de la estructura REAL del backend
const extractStatistics = (analysis, unit = 'kmh') => {
  if (!analysis) return {};

  const basicStats = safeGet(analysis, 'basic_statistics', {});
  const capacityFactor = safeGet(analysis, 'capacity_factor', {});
  const powerDensity = safeGet(analysis, 'power_density', {});
  const weibullAnalysis = safeGet(analysis, 'weibull_analysis', {});
  const turbulenceAnalysis = safeGet(analysis, 'turbulence_analysis', {});

  return {
    mean_wind_speed_10m: convertWindSpeed(basicStats.mean_wind_speed_10m || basicStats.mean, unit),
    mean_wind_speed_100m: convertWindSpeed(basicStats.mean_wind_speed_100m || basicStats.mean, unit),
    max_wind_speed_10m: convertWindSpeed(basicStats.max_wind_speed_10m || basicStats.max, unit),
    max_wind_speed_100m: convertWindSpeed(basicStats.max_wind_speed_100m || basicStats.max, unit),
    std_wind_speed_10m: convertWindSpeed(basicStats.std_wind_speed_10m || basicStats.std, unit),
    std_wind_speed_100m: convertWindSpeed(basicStats.std_wind_speed_100m || basicStats.std, unit),
    capacity_factor_10m: safeNumber(capacityFactor.capacity_factor),
    capacity_factor_100m: safeNumber(capacityFactor.capacity_factor),
    power_density_10m: safeNumber(powerDensity.mean_power_density),
    power_density_100m: safeNumber(powerDensity.mean_power_density),
    weibull_k_10m: safeNumber(weibullAnalysis.k_10m || weibullAnalysis.k),
    weibull_c_10m: convertWindSpeed(weibullAnalysis.c_10m || weibullAnalysis.c, unit),
    weibull_k_100m: safeNumber(weibullAnalysis.k_100m || weibullAnalysis.k),
    weibull_c_100m: convertWindSpeed(weibullAnalysis.c_100m || weibullAnalysis.c, unit),
    turbulence_intensity_10m: safeNumber(turbulenceAnalysis.overall?.turbulence_intensity),
    turbulence_intensity_100m: safeNumber(turbulenceAnalysis.overall?.turbulence_intensity)
  };
};

// Función para extraer datos de viabilidad mejorada
const extractEnhancedViability = (analysis) => {
  // Viabilidad consolidada del nuevo sistema
  const consolidatedViability = safeGet(analysis, 'consolidated_viability', '');
  const combinedRecommendations = safeGet(analysis, 'combined_recommendations', '');
  
  // Diagnósticos individuales
  const statisticalDiagnosis = safeGet(analysis, 'statistical_diagnosis', {});
  const climateDiagnosis = safeGet(analysis, 'climate_diagnosis', {});
  
  // Explicaciones detalladas
  const detailedExplanations = safeGet(analysis, 'detailed_explanations', {});
  
  // Fallback a la viabilidad original si no hay datos del nuevo sistema
  const fallbackViability = extractViability(analysis);
  
  return {
    consolidated_viability: consolidatedViability || fallbackViability.level,
    combined_recommendations: combinedRecommendations || fallbackViability.recommendations.join('. '),
    statistical_diagnosis: {
      wind_speed_avg: safeNumber(statisticalDiagnosis.wind_speed_avg),
      turbulence_intensity: safeNumber(statisticalDiagnosis.turbulence_intensity),
      power_density: safeNumber(statisticalDiagnosis.power_density),
      viability_classification: statisticalDiagnosis.viability_classification || 'No disponible',
      details: statisticalDiagnosis.details || 'Sin detalles disponibles'
    },
    climate_diagnosis: {
      metrics: climateDiagnosis.metrics || {},
      predicted_impact: climateDiagnosis.predicted_impact || 'No disponible',
      recommendation: climateDiagnosis.recommendation || 'Sin recomendación disponible'
    },
    detailed_explanations: {
      climate_analysis_module: detailedExplanations.climate_analysis_module || {},
      statistical_diagnosis: detailedExplanations.statistical_diagnosis || {}
    }
  };
};

// Función para extraer datos de viabilidad (original)
const extractViability = (analysis) => {
  const viabilityData = safeGet(analysis, 'viability', {});
  const level = viabilityData.viability_level || 'No disponible';
  const message = viabilityData.viability_message || 'Sin mensaje';
  const score = safeNumber(viabilityData.viability_score);
  const recommendations = Array.isArray(viabilityData.recommendations)
    ? viabilityData.recommendations
    : String(viabilityData.recommendations || '')
        .split(',')
        .map(r => r.trim())
        .filter(Boolean);

  return { level, message, score, recommendations };
};

// Función para preparar datos de gráficos
const prepareChartData = (analysis, era5Data, unit = 'kmh') => {
  if (!analysis || !era5Data) return { timeSeries: [], weibullHistogram: [], windRose: [], hourlyPatterns: [] };
  
  const timeSeries = safeArray(analysis.time_series);
  const windSpeeds100m = safeArray(era5Data.wind_speed_100m);
  const timestamps = safeArray(era5Data.timestamps);
  
  // Preparar datos de serie temporal
  const timeSeriesData = safeArray(analysis.time_series?.map((entry) => ({
    time: entry.time,
    speed: convertWindSpeed(entry.speed, unit)
  })));

  if (timeSeriesData.length === 0 && windSpeeds100m.length > 0 && timestamps.length > 0) {
    const minLength = Math.min(windSpeeds100m.length, timestamps.length);
    for (let i = 0; i < minLength; i++) {
      timeSeriesData.push({
        time: timestamps[i],
        speed: convertWindSpeed(windSpeeds100m[i], unit)
      });
    }
  }

  // Preparar datos de histograma de Weibull
  const weibullData = safeArray(
    (analysis.wind_speed_distribution || []).map((entry) => ({
      speed_bin: convertWindSpeed(entry.speed, unit),
      frequency: safeNumber(entry.frequency)
    }))
  );

  // Preparar datos de rosa de vientos para gráfico polar/radial
const windRoseData = [];
  const windRoseRaw = analysis.wind_rose_data || [];
  
  if (windRoseRaw.length > 0) {
    // Convertir datos de rosa de vientos a formato polar
    windRoseRaw.forEach((entry, index) => {
      const direction = entry.direction || index * 22.5; // Asumiendo 16 direcciones
      const totalFrequency = entry.frequencies ? entry.frequencies.reduce((sum, freq) => sum + freq, 0) : 0;
      
      windRoseData.push({
        direction: direction,
        angle: direction,
        frequency: totalFrequency,
        name: getDirectionName(direction),
        fill: getWindRoseColor(totalFrequency)
      });
    });
  } else {
    // Datos de ejemplo si no hay datos reales
    const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
    directions.forEach((dir, index) => {
      windRoseData.push({
        direction: index * 22.5,
        angle: index * 22.5,
        frequency: Math.random() * 15 + 5,
        name: dir,
        fill: getWindRoseColor(Math.random() * 15 + 5)
      });
    });
  }
  
  // Preparar datos de patrones horarios
  const hourlyData = [];
  const hourlyPatterns = safeGet(analysis, 'hourly_patterns', {});
  if (hourlyPatterns.mean_by_hour) {
    Object.entries(hourlyPatterns.mean_by_hour).forEach(([hour, speed]) => {
      hourlyData.push({
        hour: parseInt(hour),
        speed: convertWindSpeed(speed, unit)
      });
    });
  }
  
  console.log('Prepared chart data:', { timeSeriesData, weibullData, windRoseData, hourlyData });
  
  return {
    timeSeries: timeSeriesData,
    weibullHistogram: weibullData,
    windRose: windRoseData,
    hourlyPatterns: hourlyData
  };
};

// Función auxiliar para obtener nombre de dirección
const getDirectionName = (angle) => {
  const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  const index = Math.round(angle / 22.5) % 16;
  return directions[index];
};

// Función auxiliar para obtener color de rosa de vientos
const getWindRoseColor = (frequency) => {
  if (frequency < 5) return '#e0f2fe';
  if (frequency < 10) return '#7dd3fc';
  if (frequency < 15) return '#0ea5e9';
  if (frequency < 20) return '#0284c7';
  return '#0c4a6e';
};

// Componente para manejar la selección en el mapa
function MapSelector({ onAreaSelect, selectedArea, isSelecting, setIsSelecting }) {
  const [startPoint, setStartPoint] = useState(null);
  const [currentBounds, setCurrentBounds] = useState(null);
  const map = useMap();
  const [touchStartPoint, setTouchStartPoint] = useState(null);

  useEffect(() => {
    console.log('🗺️ MapSelector useEffect - isSelecting:', isSelecting);
    if (isSelecting) {
      console.log('🗺️ MapSelector: Disabling map interactions');
      map.dragging.disable();
      map.doubleClickZoom.disable();
      map.scrollWheelZoom.disable();
    } else {
      console.log('🗺️ MapSelector: Enabling map interactions');
      map.dragging.enable();
      map.doubleClickZoom.enable();
      map.scrollWheelZoom.enable();
    }
  }, [isSelecting, map]);

  useMapEvents({
    mousedown: (e) => {
      console.log('🗺️ MapSelector mousedown event:', e.latlng, 'isSelecting:', isSelecting);
      if (isSelecting) {
        setStartPoint([e.latlng.lat, e.latlng.lng]);
        setCurrentBounds([[e.latlng.lat, e.latlng.lng], [e.latlng.lat, e.latlng.lng]]);
        console.log('🗺️ MapSelector: Selection started at', e.latlng);
      }
    },
    mousemove: (e) => {
      if (isSelecting && startPoint) {
        const newBounds = [
          [Math.min(startPoint[0], e.latlng.lat), Math.min(startPoint[1], e.latlng.lng)],
          [Math.max(startPoint[0], e.latlng.lat), Math.max(startPoint[1], e.latlng.lng)]
        ];
        setCurrentBounds(newBounds);
      }
    },
    mouseup: (e) => {
      console.log('🗺️ MapSelector mouseup event:', e.latlng, 'isSelecting:', isSelecting, 'startPoint:', startPoint);
      if (isSelecting && startPoint) {
        const endPoint = [e.latlng.lat, e.latlng.lng];
        const bounds = [
          [Math.min(startPoint[0], endPoint[0]), Math.min(startPoint[1], endPoint[1])],
          [Math.max(startPoint[0], endPoint[0]), Math.max(startPoint[1], endPoint[1])]
        ];
        console.log('🗺️ MapSelector - Selected bounds:', bounds);
        onAreaSelect(bounds);
        setIsSelecting(false);
        setStartPoint(null);
        setCurrentBounds(null);
        console.log('🗺️ MapSelector: Selection finished');
      }
    },
    touchstart: (e) => {
      if (isSelecting) {
        const touch = e.latlng;
        setTouchStartPoint([touch.lat, touch.lng]);
        setCurrentBounds([[touch.lat, touch.lng], [touch.lat, touch.lng]]);
      }
    },
    touchmove: (e) => {
      if (isSelecting && touchStartPoint) {
        const touch = e.latlng;
        const newBounds = [
          [Math.min(touchStartPoint[0], touch.lat), Math.min(touchStartPoint[1], touch.lng)],
          [Math.max(touchStartPoint[0], touch.lat), Math.max(touchStartPoint[1], touch.lng)]
        ];
        setCurrentBounds(newBounds);
      }
    },
    touchend: () => {
      if (isSelecting && currentBounds) {
        onAreaSelect(currentBounds);
        setIsSelecting(false);
        setTouchStartPoint(null);
        setCurrentBounds(null);
      }
    },
    click: (e) => {
      console.log('🗺️ MapSelector click event:', e.latlng, 'isSelecting:', isSelecting, 'startPoint:', startPoint);
      if (isSelecting && !startPoint) {
        const point = [e.latlng.lat, e.latlng.lng];
        // Crear un área mínima de 0.02 grados para evitar el error de área muy pequeña
        const bounds = [[point[0] - 0.02, point[1] - 0.02], [point[0] + 0.02, point[1] + 0.02]];
        console.log('🗺️ MapSelector - Selected point bounds (expanded):', bounds);
        onAreaSelect(bounds);
        setIsSelecting(false);
        console.log('🗺️ MapSelector: Point selection finished');
      }
    }
  });

  return (
    <>
      {selectedArea && (
        <Rectangle
          bounds={selectedArea}
          pathOptions={{ color: 'blue', fillOpacity: 0.2 }}
        />
      )}
      {currentBounds && isSelecting && (
        <Rectangle
          bounds={currentBounds}
          pathOptions={{ color: 'red', fillOpacity: 0.5, weight: 2 }}
        />
      )}
    </>
  );
}

// Componente principal AnalysisPage
const AnalysisPage = ({ onBackToHome }) => {
  const [selectedArea, setSelectedArea] = useState(null);
  const [showHeatmap, setShowHeatmap] = useState(false);
  const [windUnit, setWindUnit] = useState('kmh');

  // Estados para el heatmap de viento promedio
  const [windHeatmapData, setWindHeatmapData] = useState([]);
  const [heatmapLoading, setHeatmapLoading] = useState(true);
  const [heatmapError, setHeatmapError] = useState(null);

  // Cargar datos del heatmap de viento promedio al inicializar
  useEffect(() => {
    const fetchWindHeatmapData = async () => {
      try {
        setHeatmapLoading(true);
        setHeatmapError(null);
        
        console.log('🌬️ Cargando datos de viento promedio para heatmap...');
        
        const response = await axios.get(`${API_BASE_URL}/wind-average-10m`);
        
        if (response.data && response.data.data) {
          setWindHeatmapData(response.data.data);
          console.log(`✅ Datos de heatmap cargados: ${response.data.data.length} puntos`);
        } else {
          throw new Error('Formato de respuesta inválido');
        }
        
      } catch (err) {
        console.error('❌ Error cargando datos de heatmap:', err);
        setHeatmapError(err.message);
        // Datos de fallback para desarrollo
        setWindHeatmapData([
          [10.0, -74.0, 6.5],
          [11.0, -74.5, 7.2],
          [9.5, -75.0, 5.8],
          [12.0, -73.0, 8.1],
          [8.0, -76.0, 4.9]
        ]);
      } finally {
        setHeatmapLoading(false);
      }
    };

    fetchWindHeatmapData();
  }, []);

  // Configuración de fechas por defecto
  const today = new Date();
  const defaultEndDate = new Date(today);
  defaultEndDate.setDate(today.getDate() - 3);

  const defaultStartDate = new Date(defaultEndDate);
  defaultStartDate.setDate(defaultEndDate.getDate() - 15);

  const formatISO = (date) => date.toISOString().slice(0, 10); // YYYY-MM-DD

  const [dateRange, setDateRange] = useState({
    startDate: formatISO(defaultStartDate),
    endDate: formatISO(defaultEndDate)
  });

  const [analysisData, setAnalysisData] = useState({
    analysis: {},
    location: {},
    era5Data: {
      wind_speed_10m: [],
      wind_speed_100m: [],
      wind_direction_10m: [],
      wind_direction_100m: [],
      surface_pressure: [],
      temperature_2m: [],
      timestamps: []
    }
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('unified');
  const [isMapSelecting, setIsMapSelecting] = useState(false);

  useEffect(() => {
    console.log('🔄 AnalysisPage useEffect - analysisData changed');
    if (analysisData && Object.keys(analysisData.analysis).length > 0) {
      console.log('📊 Detailed analysisData.analysis keys:', Object.keys(analysisData.analysis));
      console.log('📊 Detailed analysisData.era5Data keys:', Object.keys(analysisData.era5Data));
      
      // Log específico para cada sección del análisis
      Object.entries(analysisData.analysis).forEach(([key, value]) => {
        console.log(`📊 Analysis section [${key}]:`, value);
      });
    }
  }, [analysisData]);

  // Coordenadas del Caribe colombiano
  const caribbeanBounds = {
    lat_min: 8.0,
    lat_max: 16.0,
    lon_min: -82.0,
    lon_max: -70.0,
    center: { lat: 12.0, lon: -76.0 }
  };

  const handleAreaSelect = (bounds) => {
    console.log('🎯 AnalysisPage - handleAreaSelect called with bounds:', bounds);
    setSelectedArea(bounds);
    setError(null);
    setIsMapSelecting(false);
  };

  const handleClearSelection = () => {
    console.log('🧹 AnalysisPage - handleClearSelection called');
    setSelectedArea(null);
    setIsMapSelecting(false);
    setError(null);
  };

  const handleAnalysis = async () => {
    console.log('🚀 AnalysisPage - handleAnalysis called. selectedArea:', selectedArea);
    if (!selectedArea) {
      setError('Por favor selecciona un área en el mapa');
      console.log('❌ Error: No area selected.');
      return;
    }

    // Validar fechas antes de procesar
    const start = new Date(dateRange.startDate);
    const end = new Date(dateRange.endDate);
    const diffInDays = (end - start) / (1000 * 60 * 60 * 24);

    // Validaciones secuenciales
    if (isNaN(start) || isNaN(end)) {
      setError('Las fechas seleccionadas no son válidas.');
      console.log('❌ Error: Fecha inválida');
      return;
    }

    if (end <= start) {
      setError('La fecha de fin debe ser posterior a la fecha de inicio.');
      console.log('❌ Error: Fecha de fin anterior o igual a la de inicio');
      return;
    }

    if (diffInDays > 30) {
      setError('El rango de fechas no puede superar los 30 días. Selecciona un período más corto.');
      console.log(`❌ Error: Rango de fechas de ${diffInDays.toFixed(1)} días excede el límite de 30.`);
      return;
    }

    // Hacemos una copia profunda del área seleccionada
    let areaToAnalyze = selectedArea.map(coord => [...coord]);

    // Calculamos diferencias sobre la copia
    let latDiff = Math.abs(areaToAnalyze[1][0] - areaToAnalyze[0][0]);
    let lonDiff = Math.abs(areaToAnalyze[1][1] - areaToAnalyze[0][1]);

    const minThreshold = 0.005;

    if (latDiff === 0 && lonDiff === 0) {
      // Expansión automática para clic puntual
      areaToAnalyze[0][0] -= minThreshold / 2;
      areaToAnalyze[0][1] -= minThreshold / 2;
      areaToAnalyze[1][0] += minThreshold / 2;
      areaToAnalyze[1][1] += minThreshold / 2;
      console.log('⚠️ Área puntual detectada. Se expandió automáticamente a:', areaToAnalyze);

      // recalcula después de expandir
      latDiff = Math.abs(areaToAnalyze[1][0] - areaToAnalyze[0][0]);
      lonDiff = Math.abs(areaToAnalyze[1][1] - areaToAnalyze[0][1]);
    }

    if (latDiff + 1e-10 < minThreshold || lonDiff + 1e-10 < minThreshold) {
      setError('El área seleccionada es demasiado pequeña. Por favor selecciona un área más grande.');
      console.log('❌ Error: Selected area is too small. LatDiff:', latDiff, 'LonDiff:', lonDiff);
      return;
    }

    setLoading(true);
    setError(null);
    console.log('🚀 Starting analysis...');

    try {
      // Calcular el centro del área para el análisis de IA
      const centerLat = (areaToAnalyze[0][0] + areaToAnalyze[1][0]) / 2;
      const centerLon = (areaToAnalyze[0][1] + areaToAnalyze[1][1]) / 2;

      // 1. Llamar al endpoint de diagnóstico de IA mejorado
      console.log('🤖 Requesting enhanced AI diagnosis with parameters:', {
        latitude: centerLat,
        longitude: centerLon,
        radius_km: 200
      });

      // 2. Obtener datos de ERA5 del backend (para gráficos y análisis detallado)
      console.log('📡 Requesting ERA5 data from backend with parameters:', {
        lat_min: selectedArea[0][0],
        lat_max: selectedArea[1][0],
        lon_min: selectedArea[0][1],
        lon_max: selectedArea[1][1],
        start_date: dateRange.startDate,
        end_date: dateRange.endDate,
        variables: [
          '10m_u_component_of_wind',
          '10m_v_component_of_wind',
          '100m_u_component_of_wind',
          '100m_v_component_of_wind',
          'surface_pressure',
          '2m_temperature'
        ]
      });
      
      const era5Response = await axios.post(`${API_BASE_URL}/wind-data`, {
        lat_min: areaToAnalyze[0][0],
        lat_max: areaToAnalyze[1][0],
        lon_min: areaToAnalyze[0][1],
        lon_max: areaToAnalyze[1][1],
        start_date: dateRange.startDate,
        end_date: dateRange.endDate,
        variables: [
          '10m_u_component_of_wind',
          '10m_v_component_of_wind',
          '100m_u_component_of_wind',
          '100m_v_component_of_wind',
          'surface_pressure',
          '2m_temperature'
        ]
      });

      console.log('📡 ERA5 Data received:', era5Response.data);

      if (era5Response.data.status !== 'success' || !era5Response.data.data) {
        throw new Error(era5Response.data.message || 'Error al obtener datos de ERA5');
      }

      const era5Data = era5Response.data.data;
      console.log('📡 ERA5 Data structure:', Object.keys(era5Data));

      // Validar que los datos de ERA5 tengan la estructura esperada
      if (!era5Data.wind_speed_10m || !Array.isArray(era5Data.wind_speed_10m) || era5Data.wind_speed_10m.length === 0) {
        throw new Error('Los datos de viento recibidos no tienen el formato esperado');
      }
    
      // 3. Análisis estadístico tradicional (para gráficos)
      const analysisResponse = await axios.post(`${API_BASE_URL}/wind-analysis`, {
        wind_speeds: era5Data.wind_speed_10m.flat(),
        wind_directions: era5Data.wind_direction_10m.flat(),
        timestamps: era5Data.timestamps,
        air_density: 1.225
      });

      const analysisResult = analysisResponse.data.analysis || {};
if (!analysisResult || Object.keys(analysisResult).length === 0) {
  throw new Error('Se requieren datos de análisis para el diagnóstico IA');
}

const aiDiagnosisResponse = await axios.post(`${API_BASE_URL}/ai-diagnosis`, {
  latitude: centerLat,
  longitude: centerLon,
  radius_km: 200
});

      console.log('🤖 Enhanced AI Diagnosis received:', aiDiagnosisResponse.data);

      // 4. Combinar resultados del diagnóstico de IA con el análisis tradicional
      const combinedAnalysis = {
        ...analysisResult,
        // Datos del diagnóstico de IA mejorado
	ai_diagnosis: aiDiagnosisResponse.data.ai_diagnosis, // NUEVO
        statistical_diagnosis: aiDiagnosisResponse.data.statistical_diagnosis || {},
        climate_diagnosis: aiDiagnosisResponse.data.climate_diagnosis || {},
        consolidated_viability: aiDiagnosisResponse.data.consolidated_viability || '',
        combined_recommendations: aiDiagnosisResponse.data.combined_recommendations || '',
        detailed_explanations: aiDiagnosisResponse.data.detailed_explanations || {},
        // Datos del análisis tradicional
        wind_speed_distribution: analysisResult.wind_speed_distribution || [],
        wind_rose_data: analysisResult.wind_rose_data || [],
        time_series: analysisResult.time_series || [],
        statistics: analysisResult.statistics || {},
        viability: analysisResult.viability || {},
      };

      setAnalysisData(prevData => ({
        ...prevData,
        analysis: combinedAnalysis,
        location: {
          bounds: areaToAnalyze,
          center: [centerLat, centerLon]
        },
        era5Data: {
          ...era5Data,
          wind_speed_10m: era5Data.wind_speed_10m || [],
          wind_speed_100m: era5Data.wind_speed_100m || [],
          wind_direction_10m: era5Data.wind_direction_10m || [],
          wind_direction_100m: era5Data.wind_direction_100m || [],
          surface_pressure: era5Data.surface_pressure || [],
          temperature_2m: era5Data.temperature_2m || [],
          timestamps: era5Data.timestamps || []
        }
      }));

      setActiveTab('results');
      console.log('Enhanced analysis completed successfully. Navigating to results tab.');
    } catch (err) {
      console.error('Error during enhanced analysis request:', err);
      setError('Error al realizar el análisis: ' + (err.response?.data?.error || err.message));
      console.log('Enhanced analysis failed. Error:', err.message);
    } finally {
      setLoading(false);
      console.log('Enhanced analysis process finished. Loading set to false.');
    }
  };

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

  const getViabilityIcon = (message) => {
    if (!message) return '❓';
    
    const normalizedMessage = message.toLowerCase();
    if (normalizedMessage.includes('✅') || normalizedMessage.includes('viable') || normalizedMessage.includes('recomendado')) return '✅';
    if (normalizedMessage.includes('⚠️') || normalizedMessage.includes('moderado') || normalizedMessage.includes('precaución')) return '⚠️';
    if (normalizedMessage.includes('❌') || normalizedMessage.includes('no viable') || normalizedMessage.includes('no recomendado')) return '❌';
    return '📊';
  };

  // Extraer viabilidad mejorada
  const enhancedViability = extractEnhancedViability(analysisData.analysis);
  const aiDiagnosis = safeGet(analysisData.analysis, 'ai_diagnosis', {});

  // Fallback a viabilidad original
  const viability = extractViability(analysisData.analysis);

  const chartData = analysisData.analysis && analysisData.era5Data
    ? prepareChartData(analysisData.analysis, analysisData.era5Data, windUnit)
    : { timeSeries: [], weibullHistogram: [], windRose: [], hourlyPatterns: [] };

  const getDateValidationError = () => {
    const start = new Date(dateRange.startDate);
    const end = new Date(dateRange.endDate);

    if (isNaN(start) || isNaN(end)) return 'Las fechas no son válidas.';
    if (end <= start) return 'La fecha de fin debe ser posterior a la de inicio.';
    
    const diffInDays = (end - start) / (1000 * 60 * 60 * 24);
    if (diffInDays > 30) return 'El rango de fechas no puede superar los 30 días.';

    return null;
  };

  const dateValidationError = getDateValidationError();

  console.log('🧪 Estado del botón - loading:', loading, '| selectedArea:', selectedArea, '| dateValidationError:', dateValidationError);

  // Exportar a CSV (completo y profesional)
  const exportToCSV = () => {
    if (!analysisData?.analysis) return;

    const rows = [];

    const sections = [
      "basic_statistics",
      "capacity_factor",
      "power_density",
      "turbulence_analysis",
      "weibull_analysis",
      "viability",
      "wind_probabilities",
      "statistical_diagnosis",
      "climate_diagnosis"
    ];

    sections.forEach(section => {
      const data = analysisData.analysis[section];
      if (data && typeof data === "object") {
        rows.push({ Métrica: `--- ${section.replace(/_/g, " ").toUpperCase()} ---`, Valor: "" });
        Object.entries(data).forEach(([key, value]) => {
          rows.push({
            Métrica: key,
            Valor: typeof value === "number" ? value.toFixed(2) : String(value)
          });
        });
      }
    });

    // Agregar viabilidad consolidada
    if (enhancedViability.consolidated_viability) {
      rows.push({ Métrica: "--- VIABILIDAD CONSOLIDADA ---", Valor: "" });
      rows.push({ Métrica: "Nivel de Viabilidad", Valor: enhancedViability.consolidated_viability });
      rows.push({ Métrica: "Recomendaciones Combinadas", Valor: enhancedViability.combined_recommendations });
    }

    const worksheet = XLSXUtils.json_to_sheet(rows);
    const workbook = XLSXUtils.book_new();
    XLSXUtils.book_append_sheet(workbook, worksheet, "Resultados");

    XLSXWriteFile(workbook, "analisis_eolico_mejorado.csv");
  };

    // Exportar a PDF (con secciones múltiples)
  const exportToPDF = () => {
    if (!analysisData?.analysis) return;

    const doc = new jsPDF();
    const title = "Informe de Análisis Eólico Mejorado - Caribe";
    const date = new Date().toLocaleDateString();

    // Título del documento
    doc.setFontSize(18);
    doc.text(title, 14, 20);
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Fecha de generación: ${date}`, 14, 28);

    let startY = 36;

    // Información del área analizada
    const bounds = analysisData?.location?.bounds || [];
    const areaText = bounds.length === 2
      ? `Área: ${bounds[0][0].toFixed(2)}°, ${bounds[0][1].toFixed(2)}° a ${bounds[1][0].toFixed(2)}°, ${bounds[1][1].toFixed(2)}°`
      : 'Área no disponible';

    doc.text(areaText, 14, startY);
    startY += 6;

    // Viabilidad consolidada
    const consolidatedViabilityText = enhancedViability.consolidated_viability || viability.level || "No disponible";
    doc.text(`Viabilidad Consolidada: ${consolidatedViabilityText}`, 14, startY);
    startY += 10;

// Diagnóstico IA detallado
doc.setFont(undefined, 'bold');
doc.text("Diagnóstico con IA", 14, startY);
startY += 6;
doc.setFont(undefined, 'normal');

doc.text(`Clasificación: ${aiDiagnosis?.prediction || 'N/A'}`, 14, startY);
startY += 5;
doc.text(`Confianza: ${aiDiagnosis?.confidence ? aiDiagnosis.confidence.toFixed(2) + '%' : 'N/A'}`, 14, startY);
startY += 6;

// Factores clave explicativos
if (Array.isArray(aiDiagnosis?.explanation?.key_factors)) {
  doc.text("Factores Clave:", 14, startY);
  startY += 5;
  aiDiagnosis.explanation.key_factors.forEach(f => {
    doc.text(`- ${f}`, 16, startY);
    startY += 4;
  });
}

    // Secciones que se exportarán
    const sections = [
      { key: "statistical_diagnosis", title: "Diagnóstico Estadístico" },
      { key: "climate_diagnosis", title: "Diagnóstico Climatológico" },
      { key: "basic_statistics", title: "Estadísticas Básicas" },
      { key: "capacity_factor", title: "Factor de Capacidad" },
      { key: "power_density", title: "Densidad de Potencia" },
      { key: "turbulence_analysis", title: "Análisis de Turbulencia" },
      { key: "weibull_analysis", title: "Parámetros Weibull" },
      { key: "wind_probabilities", title: "Probabilidades de Viento" },
      { key: "viability", title: "Resumen de Viabilidad" }
    ];

    sections.forEach(section => {
      const data = analysisData.analysis[section.key];
      if (data && typeof data === "object") {
        // Título de la sección
        doc.setFont(undefined, 'bold');
        doc.text(section.title, 14, startY);
        doc.setFont(undefined, 'normal');
        startY += 4;

        const rows = Object.entries(data).map(([key, value]) => [
          key.replace(/_/g, ' '),
          typeof value === "number" ? value.toFixed(2) : String(value)
        ]);

        doc.autoTable({
          startY,
          head: [["Métrica", "Valor"]],
          body: rows,
          theme: "grid",
          styles: { fontSize: 9 },
          headStyles: { fillColor: [22, 160, 133] }, // verde azulado
          margin: { left: 14, right: 14 },
          didDrawPage: (data) => {
            startY = data.cursor.y + 8;
          }
        });
      }
    });

    // Guardar PDF
    doc.save("informe_analisis_eolico_mejorado.pdf");
  };

  const getColor = (index) => {
    const colors = ['#8884d8', '#82ca9d', '#ffc658', '#ff7f50', '#aqua', '#c71585'];
    return colors[index % colors.length];
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-3">
              <Button 
                variant="ghost" 
                size="sm"
                onClick={onBackToHome}
                className="flex items-center space-x-2 text-slate-600 hover:text-slate-900"
              >
                <ArrowLeft className="h-4 w-4" />
                <span>Inicio</span>
              </Button>
              <Wind className="h-8 w-8 text-sky-600" />
              <div>
                <h1 className="text-2xl font-bold text-slate-900">
                  Análisis Eólico Caribe
                </h1>
                <p className="text-sm text-slate-600">
                  Evaluación del potencial eólico con IA mejorada
                </p>
              </div>
            </div>
            <Badge variant="outline" className="text-sky-600 border-sky-200">
              Powered by ERA5 + AI
            </Badge>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-2 bg-white shadow-sm">
            <TabsTrigger value="unified" className="flex items-center space-x-2 data-[state=active]:bg-sky-500 data-[state=active]:text-white">
              <MapPin className="h-4 w-4" />
              <span>Configuración y Mapa</span>
            </TabsTrigger>
            <TabsTrigger value="results" className="flex items-center space-x-2 data-[state=active]:bg-sky-500 data-[state=active]:text-white">
              <TrendingUp className="h-4 w-4" />
              <span>Dashboard de Resultados</span>
            </TabsTrigger>
          </TabsList>

          {/* Vista Unificada: Mapa + Configuración */}
          <TabsContent value="unified" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Mapa - 2/3 del ancho */}
              <div className="lg:col-span-2">
                <Card className="shadow-lg border-0 h-full">
                  <CardHeader className="bg-gradient-to-r from-sky-500 to-blue-600 text-white rounded-t-xl">
                    <div className="flex items-center justify-between">
                      <CardTitle className="flex items-center space-x-2">
                        <MapPin className="h-5 w-5" />
                        <span>Seleccionar Área de Análisis</span>
                      </CardTitle>
                      <div className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          id="toggle-heatmap"
                          checked={showHeatmap}
                          onChange={() => setShowHeatmap(!showHeatmap)}
                          className="rounded"
                        />
                        <label htmlFor="toggle-heatmap" className="text-sm">
                          Capa de calor
                        </label>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="p-0 flex-1">
                    {/* Mapa principal - Ajustado para coincidir con altura de contenedores */}
                    <div className="h-[700px] rounded-b-xl overflow-hidden">
                      <MapContainer
                        center={[caribbeanBounds.center.lat, caribbeanBounds.center.lon]}
                        zoom={7}
                        style={{ height: '100%', width: '100%' }}
                        dragging={!isMapSelecting}
                        className={isMapSelecting ? 'cursor-crosshair' : 'cursor-grab'}
                        attributionControl={false}
                      >
                        <TileLayer
                          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                        />
                        
                        {/* Capa de calor */}
                        {showHeatmap && windHeatmapData.length > 0 && (
                          <WindHeatmapLayer data={windHeatmapData} />
                        )}

                        {/* Selector de área */}
                        <MapSelector
                          onAreaSelect={handleAreaSelect}
                          selectedArea={selectedArea}
                          isSelecting={isMapSelecting}
                          setIsSelecting={setIsMapSelecting}
                        />

                        {/* Rectángulo del área seleccionada */}
                        {selectedArea && (
                          <Rectangle
                            bounds={[
                              [selectedArea[0][0], selectedArea[0][1]],
                              [selectedArea[1][0], selectedArea[1][1]],
                            ]}
                            color="#ef4444"
                            weight={3}
                            fillOpacity={0.1}
                          />
                        )}
                      </MapContainer>
                    </div>

                    {/* Controles del mapa */}
                    <div className="p-4 bg-slate-50 border-t">
                      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center space-y-3 sm:space-y-0">
                        <p className="text-sm text-slate-600">
                          {isMapSelecting
                            ? 'Haz clic y arrastra para seleccionar un área'
                            : 'Haz clic en "Iniciar Selección" para dibujar un área'}
                        </p>
                        <div className="flex space-x-2">
                          <Button
                            onClick={() => setIsMapSelecting(true)}
                            disabled={isMapSelecting}
                            variant={isMapSelecting ? "secondary" : "default"}
                            className="bg-sky-500 hover:bg-sky-600 text-white"
                          >
                            {isMapSelecting ? 'Seleccionando...' : 'Iniciar Selección'}
                          </Button>

                          {selectedArea && (
                            <Button
                              onClick={handleClearSelection}
                              variant="outline"
                              size="icon"
                              className="border-red-200 text-red-600 hover:bg-red-50"
                            >
                              <XCircle className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </div>

                      {/* Badge de coordenadas */}
                      {selectedArea && (
                        <div className="mt-3">
                          <Badge variant="secondary" className="bg-emerald-100 text-emerald-800">
                            Área: {selectedArea[0][0].toFixed(2)}°, {selectedArea[0][1].toFixed(2)}° a {selectedArea[1][0].toFixed(2)}°, {selectedArea[1][1].toFixed(2)}°
                          </Badge>
                        </div>
                      )}

                      {/* Leyenda del heatmap */}
                      {showHeatmap && (
                        <div className="mt-4 p-3 bg-white rounded-lg border border-slate-200">
                          <p className="text-sm font-medium mb-2 text-slate-700">Leyenda - Velocidad del Viento (m/s):</p>
                          <div className="flex items-center space-x-4 text-xs">
                            <div className="flex items-center space-x-1">
                              <div className="w-3 h-3 bg-blue-500 rounded"></div>
                              <span>0–3</span>
                            </div>
                            <div className="flex items-center space-x-1">
                              <div className="w-3 h-3 bg-cyan-400 rounded"></div>
                              <span>3–6</span>
                            </div>
                            <div className="flex items-center space-x-1">
                              <div className="w-3 h-3 bg-green-400 rounded"></div>
                              <span>6–9</span>
                            </div>
                            <div className="flex items-center space-x-1">
                              <div className="w-3 h-3 bg-yellow-400 rounded"></div>
                              <span>9–12</span>
                            </div>
                            <div className="flex items-center space-x-1">
                              <div className="w-3 h-3 bg-red-500 rounded"></div>
                              <span>&gt;12</span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Panel de Configuración - 1/3 del ancho - Ajustado para coincidir con altura del mapa */}
              <div className="space-y-6 flex flex-col h-full">
                {/* Rango de Fechas */}
                <Card className="shadow-lg border-0 flex-1">
                  <CardHeader className="bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-t-xl">
                    <CardTitle className="flex items-center space-x-2">
                      <Calendar className="h-5 w-5" />
                      <span>Rango de Fechas</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-6 space-y-4 flex-1">
                    <div>
                      <Label htmlFor="startDate" className="text-sm font-medium text-slate-700">Fecha de Inicio</Label>
                      <Input
                        id="startDate"
                        type="date"
                        value={dateRange.startDate}
                        onChange={(e) => setDateRange(prev => ({ ...prev, startDate: e.target.value }))}
                        className="mt-1 border-slate-300 focus:border-sky-500 focus:ring-sky-500"
                      />
                    </div>
                    <div>
                      <Label htmlFor="endDate" className="text-sm font-medium text-slate-700">Fecha de Fin</Label>
                      <Input
                        id="endDate"
                        type="date"
                        value={dateRange.endDate}
                        onChange={(e) => setDateRange(prev => ({ ...prev, endDate: e.target.value }))}
                        className="mt-1 border-slate-300 focus:border-sky-500 focus:ring-sky-500"
                      />
                    </div>
                    
                    {dateValidationError && (
                      <Alert variant="destructive" className="border-red-200 bg-red-50">
                        <AlertDescription className="text-red-800">{dateValidationError}</AlertDescription>
                      </Alert>
                    )}

                    <Alert className="border-blue-200 bg-blue-50">
                      <AlertDescription className="text-blue-800 text-sm">
                        Rango recomendado para garantizar disponibilidad de datos ERA5 y respuesta rápida.
                      </AlertDescription>
                    </Alert>
                  </CardContent>
                </Card>

                {/* Variables de Análisis */}
                <Card className="shadow-lg border-0 flex-1">
                  <CardHeader className="bg-gradient-to-r from-purple-500 to-indigo-600 text-white rounded-t-xl">
                    <CardTitle className="flex items-center space-x-2">
                      <BarChart3 className="h-5 w-5" />
                      <span>Variables de Análisis</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-6 flex-1">
                    <div className="space-y-4">
                      <div className="flex items-center space-x-3">
                        <input type="checkbox" id="wind_speed" defaultChecked className="rounded text-sky-600 focus:ring-sky-500" />
                        <Label htmlFor="wind_speed" className="text-sm text-slate-700">Velocidad del viento (10m, 100m)</Label>
                      </div>
                      <div className="flex items-center space-x-3">
                        <input type="checkbox" id="pressure" defaultChecked className="rounded text-sky-600 focus:ring-sky-500" />
                        <Label htmlFor="pressure" className="text-sm text-slate-700">Presión Atmosférica</Label>
                      </div>
                      <div className="flex items-center space-x-3">
                        <input type="checkbox" id="temperature" defaultChecked className="rounded text-sky-600 focus:ring-sky-500" />
                        <Label htmlFor="temperature" className="text-sm text-slate-700">Temperatura</Label>
                      </div>
                      <div className="flex items-center space-x-3">
                        <input type="checkbox" id="climate_analysis" defaultChecked className="rounded text-sky-600 focus:ring-sky-500" />
                        <Label htmlFor="climate_analysis" className="text-sm text-slate-700">Análisis Climatológico</Label>
                      </div>
                      <div className="flex items-center space-x-3">
                        <input type="checkbox" id="ai_diagnosis" defaultChecked className="rounded text-sky-600 focus:ring-sky-500" />
                        <Label htmlFor="ai_diagnosis" className="text-sm text-slate-700">Diagnóstico con IA</Label>
                      </div>

                      {/* Selector de unidades */}
                      <div className="pt-4 border-t border-slate-200">
                        <Label htmlFor="windUnit" className="block mb-2 text-sm font-medium text-slate-700">
                          Unidades de Velocidad
                        </Label>
                        <select
                          id="windUnit"
                          value={windUnit}
                          onChange={(e) => setWindUnit(e.target.value)}
                          className="block w-full border border-slate-300 rounded-lg shadow-sm p-2 focus:border-sky-500 focus:ring-sky-500"
                        >
                          <option value="kmh">km/h</option>
                          <option value="ms">m/s</option>
                        </select>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Botón de Análisis */}
                <Card className="shadow-lg border-0">
                  <CardContent className="p-6">
                    {error && (
                      <Alert variant="destructive" className="mb-4 border-red-200 bg-red-50">
                        <AlertDescription className="text-red-800">{error}</AlertDescription>
                      </Alert>
                    )}
                    <Button 
                      onClick={handleAnalysis} 
                      className="w-full h-12 text-lg font-semibold bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-600 hover:to-blue-700 text-white shadow-lg" 
                      disabled={loading || !selectedArea || dateValidationError}
                    >
                      {loading ? (
                        <div className="flex items-center space-x-2">
                          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                          <span>Analizando...</span>
                        </div>
                      ) : (
                        'Iniciar Análisis Eólico'
                      )}
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          {/* Dashboard de Resultados */}
          <TabsContent value="results" className="space-y-6">
            {analysisData && Object.keys(analysisData.analysis).length > 0 ? (
              <div className="space-y-6">
                
                {/* Mapa del área seleccionada en resultados */}
                {selectedArea && (
                  <Card className="shadow-lg border-0">
                    <CardHeader className="bg-gradient-to-r from-slate-100 to-slate-200 rounded-t-xl">
                      <CardTitle className="text-slate-800 flex items-center space-x-2">
                        <MapPin className="h-5 w-5" />
                        <span>Área de Análisis</span>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-6">
                      <div className="h-64 rounded-lg overflow-hidden border border-slate-200">
                        <MapContainer
                          center={[
                            (selectedArea[0][0] + selectedArea[1][0]) / 2,
                            (selectedArea[0][1] + selectedArea[1][1]) / 2
                          ]}
                          zoom={9}
                          style={{ height: '100%', width: '100%' }}
                          attributionControl={false}
                          zoomControl={false}
                          dragging={false}
                          scrollWheelZoom={false}
                          doubleClickZoom={false}
                        >
                          <TileLayer
                            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                          />
                          <Rectangle
                            bounds={[
                              [selectedArea[0][0], selectedArea[0][1]],
                              [selectedArea[1][0], selectedArea[1][1]],
                            ]}
                            color="#ef4444"
                            weight={3}
                            fillOpacity={0.2}
                          />
                        </MapContainer>
                      </div>
                      <div className="mt-3 text-center">
                        <Badge variant="secondary" className="bg-emerald-100 text-emerald-800">
                          Coordenadas: {selectedArea[0][0].toFixed(2)}°, {selectedArea[0][1].toFixed(2)}° a {selectedArea[1][0].toFixed(2)}°, {selectedArea[1][1].toFixed(2)}°
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* KPIs principales */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                  <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-lg border-0">
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-blue-100 text-sm font-medium">Velocidad Promedio</p>
                          <p className="text-2xl font-bold">
                            {formatNumber(extractStatistics(analysisData.analysis, windUnit).mean_wind_speed_100m)} {windUnit === 'kmh' ? 'km/h' : 'm/s'}
                          </p>
                        </div>
                        <Wind className="h-8 w-8 text-blue-200" />
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="bg-gradient-to-br from-emerald-500 to-emerald-600 text-white shadow-lg border-0">
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-emerald-100 text-sm font-medium">Factor de Capacidad</p>
                          <p className="text-2xl font-bold">
                            {formatPercentage(extractStatistics(analysisData.analysis).capacity_factor_100m)}
                          </p>
                        </div>
                        <BarChart3 className="h-8 w-8 text-emerald-200" />
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="bg-gradient-to-br from-purple-500 to-purple-600 text-white shadow-lg border-0">
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-purple-100 text-sm font-medium">Densidad de Potencia</p>
                          <p className="text-2xl font-bold">
                            {formatNumber(extractStatistics(analysisData.analysis).power_density_100m)} W/m²
                          </p>
                        </div>
                        <Zap className="h-8 w-8 text-purple-200" />
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="bg-gradient-to-br from-orange-500 to-orange-600 text-white shadow-lg border-0">
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-orange-100 text-sm font-medium">Turbulencia</p>
                          <p className="text-2xl font-bold">
                            {formatPercentage(extractStatistics(analysisData.analysis).turbulence_intensity_100m)}
                          </p>
                        </div>
                        <CloudSnow className="h-8 w-8 text-orange-200" />
                      </div>
                    </CardContent>
                  </Card>

                  <Card className={`${getViabilityColor(enhancedViability.consolidated_viability || viability.level)} text-white shadow-lg border-0`}>
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-white/80 text-sm font-medium">Viabilidad</p>
                          <p className="text-xl font-bold">
                            {enhancedViability.consolidated_viability || viability.level}
                          </p>
                        </div>
                        <TrendingUp className="h-8 w-8 text-white/80" />
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Gráficos principales */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  
		{/* Rosa de Vientos Polar/Radial */}
                  <Card className="shadow-lg border-0">
                    <CardHeader className="bg-gradient-to-r from-slate-100 to-slate-200 rounded-t-xl">
                      <CardTitle className="text-slate-800">Rosa de Vientos</CardTitle>
                    </CardHeader>
                    <CardContent className="p-6">
                      <div className="h-80 flex items-center justify-center">
                        {chartData.windRose && chartData.windRose.length > 0 ? (
                          <ResponsiveContainer width="100%" height="100%">
                            <RadialBarChart cx="50%" cy="50%" innerRadius="20%" outerRadius="80%" data={chartData.windRose}>
                              <PolarGrid />
                              <PolarAngleAxis dataKey="name" tick={{ fontSize: 12 }} />
                              <PolarRadiusAxis 
                                angle={90} 
                                domain={[0, 'dataMax']} 
                                tick={{ fontSize: 10 }}
                                tickCount={4}
                              />
                              <RadialBar dataKey="frequency" cornerRadius={2} fill="#0ea5e9" />
                              <Tooltip 
                                formatter={(value, name) => [`${value.toFixed(1)}%`, 'Frecuencia']}
                                labelFormatter={(label) => `Dirección: ${label}`}
                              />
                            </RadialBarChart>
                          </ResponsiveContainer>
                        ) : (
                          <p className="text-slate-500">No hay datos de rosa de vientos disponibles</p>
                        )}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Distribución Weibull */}
                  <Card className="shadow-lg border-0">
                    <CardHeader className="bg-gradient-to-r from-slate-100 to-slate-200 rounded-t-xl">
                      <CardTitle className="text-slate-800">Distribución Weibull</CardTitle>
                    </CardHeader>
                    <CardContent className="p-6">
                      <div className="h-80 flex items-center justify-center">
                        {chartData.weibullHistogram && chartData.weibullHistogram.length > 0 ? (
                          <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={chartData.weibullHistogram}>
                              <CartesianGrid strokeDasharray="3 3" />
                              <XAxis 
                                dataKey="speed_bin" 
                                label={{ value: `Velocidad (${windUnit === 'kmh' ? 'km/h' : 'm/s'})`, position: 'insideBottom', offset: -5 }}
                              />
                              <YAxis 
                                label={{ value: 'Frecuencia', angle: -90, position: 'insideLeft' }}
                              />
                              <Tooltip 
                                formatter={(value, name) => [`${value.toFixed(3)}`, 'Frecuencia']}
                                labelFormatter={(label) => `Velocidad: ${label} ${windUnit === 'kmh' ? 'km/h' : 'm/s'}`}
                              />
                              <Line type="monotone" dataKey="frequency" stroke="#0ea5e9" strokeWidth={3} />
                            </LineChart>
                          </ResponsiveContainer>
                        ) : (
                          <p className="text-slate-500">No hay datos de distribución Weibull disponibles</p>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Evolución Temporal */}
                <Card className="shadow-lg border-0">
                  <CardHeader className="bg-gradient-to-r from-slate-100 to-slate-200 rounded-t-xl">
                    <CardTitle className="text-slate-800">Evolución Temporal de Velocidad del Viento a 10m</CardTitle>
                  </CardHeader>
                  <CardContent className="p-6">
                    <div className="h-80">
                      {chartData.timeSeries && chartData.timeSeries.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={chartData.timeSeries}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis 
                              dataKey="time" 
			    label={{ value: 'Tiempo', position: 'insideBottom', offset: -5 }}
                              tickFormatter={(t) => isNaN(new Date(t)) ? '' : new Date(t).toLocaleDateString('es-CO')} 
                            />
                            <YAxis 
                              label={{ value: `Velocidad (${windUnit === 'kmh' ? 'km/h' : 'm/s'})`, angle: -90, position: 'insideLeft' }}
                            />
                            <Tooltip 
                              formatter={(value, name) => [`${value.toFixed(2)} ${windUnit === 'kmh' ? 'km/h' : 'm/s'}`, 'Velocidad']}
                              labelFormatter={(label) => `Tiempo: ${label}`}
                            />
                            <Line type="monotone" dataKey="speed" stroke="#8884d8" dot={false} />
                          </LineChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="flex items-center justify-center h-full">
                          <p className="text-slate-500">No hay datos de serie temporal disponibles</p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* Patrones Horarios y Diagnóstico */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  
                  {/* Patrones Horarios */}
                  <Card className="shadow-lg border-0">
                    <CardHeader className="bg-gradient-to-r from-slate-100 to-slate-200 rounded-t-xl">
                      <CardTitle className="text-slate-800">Patrones Horarios</CardTitle>
                    </CardHeader>
                    <CardContent className="p-6">
                      <div className="h-64">
                        {chartData.hourlyPatterns && chartData.hourlyPatterns.length > 0 ? (
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={chartData.hourlyPatterns}>
                              <CartesianGrid strokeDasharray="3 3" />
                              <XAxis 
                                dataKey="hour" 
                                label={{ value: 'Hora del día', position: 'insideBottom', offset: -5 }}
                              />
                              <YAxis 
                                label={{ value: `Velocidad (${windUnit === 'kmh' ? 'km/h' : 'm/s'})`, angle: -90, position: 'insideLeft' }}
                              />
                              <Tooltip 
                                formatter={(value, name) => [`${value.toFixed(2)} ${windUnit === 'kmh' ? 'km/h' : 'm/s'}`, 'Velocidad Promedio']}
                                labelFormatter={(label) => `Hora: ${label}:00`}
                              />
                              <Bar dataKey="speed" fill="#f59e0b" />
                            </BarChart>
                          </ResponsiveContainer>
                        ) : (
                          <div className="flex items-center justify-center h-full">
                            <p className="text-slate-500">No hay datos de patrones horarios disponibles</p>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Evaluación de Viabilidad */}
                  <Card className="shadow-lg border-0">
                    <CardHeader className="bg-gradient-to-r from-slate-100 to-slate-200 rounded-t-xl">
                      <CardTitle className="text-slate-800">Evaluación de Viabilidad</CardTitle>
                    </CardHeader>
                    <CardContent className="p-6">
                      <div className="space-y-4">
                        {/* Viabilidad Consolidada */}
                        <div className={`p-4 rounded-lg ${getViabilityColor(enhancedViability.consolidated_viability || viability.level)} text-white`}>
                          <div className="flex items-center space-x-2 mb-2">
                            <TrendingUp className="h-5 w-5" />
                            <span className="font-semibold">Viabilidad: {enhancedViability.consolidated_viability || viability.level}</span>
                          </div>
                          <p className="text-sm opacity-90">
                            {enhancedViability.combined_recommendations || viability.recommendations.join('. ')}
                          </p>
                        </div>

                        {/* Diagnósticos */}
                        <div className="grid grid-cols-1 gap-3">
                          <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                            <div className="flex items-center space-x-2 mb-1">
                              <BarChart3 className="h-4 w-4 text-blue-600" />
                              <span className="font-medium text-blue-800 text-sm">Diagnóstico Estadístico</span>
                            </div>
                            <p className="text-xs text-blue-700">
                              {enhancedViability.statistical_diagnosis.viability_classification}
                            </p>
                          </div>

                          <div className="p-3 bg-green-50 rounded-lg border border-green-200">
                            <div className="flex items-center space-x-2 mb-1">
                              <CloudSnow className="h-4 w-4 text-green-600" />
                              <span className="font-medium text-green-800 text-sm">Diagnóstico Climatológico</span>
                            </div>
                            <p className="text-xs text-green-700">
                              {enhancedViability.climate_diagnosis.predicted_impact}
                            </p>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Botones de exportación */}
                <Card className="shadow-lg border-0">
                  <CardContent className="p-6">
                    <div className="flex flex-col sm:flex-row gap-4">
                      <Button 
                        onClick={exportToCSV}
                        className="flex items-center space-x-2 bg-emerald-600 hover:bg-emerald-700 text-white"
                      >
                        <Download className="h-4 w-4" />
                        <span>Exportar CSV</span>
                      </Button>
                      <Button 
                        onClick={exportToPDF}
                        className="flex items-center space-x-2 bg-red-600 hover:bg-red-700 text-white"
                      >
                        <Download className="h-4 w-4" />
                        <span>Exportar PDF</span>
                      </Button>
                    </div>
                  </CardContent>
                </Card>

              </div>
            ) : (
              <Card className="shadow-lg border-0">
                <CardContent className="p-12 text-center">
                  <div className="space-y-4">
                    <Wind className="h-16 w-16 text-slate-400 mx-auto" />
                    <h3 className="text-xl font-semibold text-slate-700">No hay resultados disponibles</h3>
                    <p className="text-slate-500">
                      Selecciona un área en el mapa y configura los parámetros de análisis para ver los resultados.
                    </p>
                    <Button 
                      onClick={() => setActiveTab('unified')}
                      className="bg-sky-500 hover:bg-sky-600 text-white"
                    >
                      Ir a Configuración
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default AnalysisPage;
