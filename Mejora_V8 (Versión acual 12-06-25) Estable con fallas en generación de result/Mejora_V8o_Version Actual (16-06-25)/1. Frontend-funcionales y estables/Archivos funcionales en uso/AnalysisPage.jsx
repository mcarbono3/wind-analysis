import React, { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Rectangle, useMapEvents, useMap } from 'react-leaflet';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Badge } from './ui/badge';
import { Alert, AlertDescription } from './ui/alert';
import { Wind, MapPin, Calendar, Download, BarChart3, TrendingUp, XCircle, ArrowLeft } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell } from 'recharts';
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
    monthly_patterns: rawAnalysis.monthly_patterns || {}
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

// Función para extraer datos de viabilidad
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

  // Preparar datos de rosa de vientos
  const windRoseData = safeArray(
    (analysis.wind_rose_data || []).map((entry) => {
      const data = { direction: entry.direction };
      entry.frequencies.forEach((f, idx) => {
        const label = analysis.wind_rose_labels?.speed_labels?.[idx] || `Rango ${idx + 1}`;
        data[label] = safeNumber(f);
      });
      return data;
    })
  );
  const windRoseLabels = {
    speed_labels: analysis.wind_rose_labels?.speed_labels || [],
    direction_labels: analysis.wind_rose_labels?.direction_labels || []
  };
  
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
    windRoseLabels: windRoseLabels,
    hourlyPatterns: hourlyData
  };
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
  const [activeTab, setActiveTab] = useState('map');
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
      // 1. Obtener datos de ERA5 del backend
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
    
      // Agrega esta llamada al análisis con direcciones y timestamps
      const analysisResponse = await axios.post(`${API_BASE_URL}/wind-analysis`, {
        wind_speeds: era5Data.wind_speed_10m.flat(),
        wind_directions: era5Data.wind_direction_10m.flat(),
        timestamps: era5Data.timestamps,
        air_density: 1.225
      });

      const analysisResult = analysisResponse.data.analysis || {};
      setAnalysisData(prevData => ({
        ...prevData,
        analysis: {
          ...analysisResult,
          wind_speed_distribution: analysisResult.wind_speed_distribution || [],
          wind_rose_data: analysisResult.wind_rose_data || [],
          time_series: analysisResult.time_series || [],
          statistics: analysisResult.statistics || {},
          viability: analysisResult.viability || {},
        },
        location: {
          bounds: areaToAnalyze,
          center: [
            (areaToAnalyze[0][0] + areaToAnalyze[1][0]) / 2,
            (areaToAnalyze[0][1] + areaToAnalyze[1][1]) / 2
          ]
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
      console.log('Analysis completed successfully. Navigating to results tab.');
    } catch (err) {
      console.error('Error during analysis request:', err);
      setError('Error al realizar el análisis: ' + (err.response?.data?.error || err.message));
      console.log('Analysis failed. Error:', err.message);
    } finally {
      setLoading(false);
      console.log('Analysis process finished. Loading set to false.');
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
      "wind_probabilities"
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

    const worksheet = XLSXUtils.json_to_sheet(rows);
    const workbook = XLSXUtils.book_new();
    XLSXUtils.book_append_sheet(workbook, worksheet, "Resultados");

    XLSXWriteFile(workbook, "analisis_eolico.csv");
  };

  // Exportar a PDF (con secciones múltiples)
  const exportToPDF = () => {
    if (!analysisData?.analysis) return;

    const doc = new jsPDF();
    const title = "Informe de Análisis Eólico - Caribe";
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

    const viabilityText = viability?.recommendation || "No disponible";
    doc.text(`Viabilidad: ${viabilityText}`, 14, startY);
    startY += 10;

    // Secciones que se exportarán
    const sections = [
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
    doc.save("informe_analisis_eolico.pdf");
  };

  const getColor = (index) => {
    const colors = ['#8884d8', '#82ca9d', '#ffc658', '#ff7f50', '#aqua', '#c71585'];
    return colors[index % colors.length];
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-cyan-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-3">
              <Button 
                variant="ghost" 
                size="sm"
                onClick={onBackToHome}
                className="flex items-center space-x-2"
              >
                <ArrowLeft className="h-4 w-4" />
                <span>Inicio</span>
              </Button>
              <Wind className="h-8 w-8 text-blue-600" />
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  Análisis Eólico Caribe
                </h1>
                <p className="text-sm text-gray-600">
                  Evaluación del potencial eólico en Colombia
                </p>
              </div>
            </div>
            <Badge variant="outline" className="text-blue-600">
              Powered by ERA5
            </Badge>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="map" className="flex items-center space-x-2">
              <MapPin className="h-4 w-4" />
              <span>Selección de Área</span>
            </TabsTrigger>
            <TabsTrigger value="analysis" className="flex items-center space-x-2">
              <BarChart3 className="h-4 w-4" />
              <span>Configuración</span>
            </TabsTrigger>
            <TabsTrigger value="results" className="flex items-center space-x-2">
              <TrendingUp className="h-4 w-4" />
              <span>Resultados</span>
            </TabsTrigger>
          </TabsList>

          {/* Tab: Mapa */}
<Tabs defaultValue="map" className="w-full">
  <TabsList>
    <TabsTrigger value="map">Mapa</TabsTrigger>
  </TabsList>
          <TabsContent value="map" className="space-y-6">
            <Card>
              <CardHeader className="flex items-center justify-between">
                <CardTitle className="flex items-center space-x-2">
                  <MapPin className="h-5 w-5" />
                  <span>Seleccionar Área de Análisis</span>
                </CardTitle>
              
		  {/* Checkbox alineado a la derecha */}
 		 <div className="flex items-center space-x-2">
  		  <input
   		   type="checkbox"
   		   id="toggle-heatmap"
   		   checked={showHeatmap}
   		   onChange={() => setShowHeatmap(!showHeatmap)}
   		 />
   		 <label htmlFor="toggle-heatmap" className="text-sm">
   		   Capa de calor (vel. Viento)
    		</label>
 		 </div>
		</CardHeader>
		              
		<CardContent>
                {/* Mapa principal con heatmap y selección */}
                <div className="h-96 rounded-lg overflow-hidden border">
                  <MapContainer
                    center={[caribbeanBounds.center.lat, caribbeanBounds.center.lon]}
                    zoom={7}
                    style={{ height: '100%', width: '100%' }}
                    dragging={!isMapSelecting}
                    className={isMapSelecting ? 'cursor-default' : 'cursor-grab'}
                  >
                    <TileLayer
                      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    />
		    {/* Capa de calor, se activa solo si showHeatmap es true */}
 		   
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
                        color="red"
                        weight={2}
                        fillOpacity={0.1}
                      />
                    )}
                  </MapContainer>
                </div>

                {/* Leyenda del heatmap */}
		{showHeatmap && (
                <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                  <p className="text-sm font-medium mb-2">Leyenda - Velocidad del Viento (m/s):</p>
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

                {/* Controles */}
                <div className="mt-4 flex flex-col lg:flex-row lg:justify-between lg:items-center space-y-3 lg:space-y-0">
                  <p className="text-sm text-gray-600">
                    {isMapSelecting
                      ? 'Haz clic y arrastra para seleccionar un área'
                      : 'Haz clic en "Iniciar Selección" para dibujar un área'}
                  </p>
                  <div className="flex space-x-2 items-center">
                    <Button
                      onClick={() => setIsMapSelecting(true)}
                      disabled={isMapSelecting}
                    >
                      {isMapSelecting ? 'Seleccionando...' : 'Iniciar Selección'}
                    </Button>

                    {selectedArea && (
                      <>
                        <Button
                          onClick={handleClearSelection}
                          variant="outline"
                          size="icon"
                        >
                          <XCircle className="h-4 w-4" />
                        </Button>
                        <Button
                          onClick={() => setActiveTab('analysis')}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white"
                        >
                          Continuar
                        </Button>
                      </>
                    )}
                  </div>
                </div>

                {/* Badge de coordenadas */}
                {selectedArea && (
                  <div className="mt-2">
                    <Badge variant="secondary">
                      Área seleccionada: {selectedArea[0][0].toFixed(2)}°, {selectedArea[0][1].toFixed(2)}° a {selectedArea[1][0].toFixed(2)}°, {selectedArea[1][1].toFixed(2)}°
                    </Badge>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
	</Tabs>

          {/* Tab: Configuración */}
          <TabsContent value="analysis" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Calendar className="h-5 w-5" />
                    <span>Rango de Fechas</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="startDate">Fecha de Inicio</Label>
                    <Input
                      id="startDate"
                      type="date"
                      value={dateRange.startDate}
                      onChange={(e) => setDateRange(prev => ({ ...prev, startDate: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label htmlFor="endDate">Fecha de Fin</Label>
                    <Input
                      id="endDate"
                      type="date"
                      value={dateRange.endDate}
                      onChange={(e) => setDateRange(prev => ({ ...prev, endDate: e.target.value }))}
                    />
                  </div>
                  
                  {dateValidationError && (
                    <Alert variant="destructive" className="mt-2">
                      <AlertDescription>{dateValidationError}</AlertDescription>
                    </Alert>
                  )}

                  <Alert variant="info" className="mt-2">
                    <AlertDescription>
                      Este rango de fechas (últimos 15 días hasta 3 días antes de hoy) está recomendado para garantizar disponibilidad de datos ERA5 y una respuesta rápida del sistema.
                    </AlertDescription>
                  </Alert>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Variables de Análisis</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-center space-x-2">
                      <input type="checkbox" id="wind_speed" defaultChecked />
                      <Label htmlFor="wind_speed">Velocidad del viento (10m, 100m)</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <input type="checkbox" id="pressure" defaultChecked />
                      <Label htmlFor="pressure">Presión Atmosférica</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <input type="checkbox" id="temperature" defaultChecked />
                      <Label htmlFor="temperature">Temperatura</Label>
                    </div>
                    
                    {/* Selector de unidades con espaciado separado y orden visual claro */}
                    <div className="pt-4">
                      <Label htmlFor="windUnit" className="block mb-1 text-sm font-medium text-gray-700">
                        Unidades de Velocidad del Viento
                      </Label>
                      <select
                        id="windUnit"
                        value={windUnit}
                        onChange={(e) => setWindUnit(e.target.value)}
                        className="block w-full border border-gray-300 rounded-md shadow-sm p-2"
                      >
                        <option value="kmh">km/h</option>
                        <option value="ms">m/s</option>
                      </select>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <BarChart3 className="h-5 w-5" />
                  <span>Iniciar Análisis</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {error && (
                  <Alert variant="destructive" className="mb-4">
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}
                <Button 
                  onClick={handleAnalysis} 
                  className="w-full" 
                  disabled={loading || !selectedArea || dateValidationError}
                >
                  {loading ? 'Analizando...' : 'Iniciar Análisis Eólico'}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab: Resultados */}
          <TabsContent value="results" className="space-y-6">
            {analysisData && Object.keys(analysisData.analysis).length > 0 ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                
                {/* Resumen del Análisis */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center space-x-2 text-xl font-semibold">
                      <TrendingUp className="h-5 w-5" />
                      <span>Resumen del Análisis</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4 text-base">
                    <p>
                      <strong>Área Analizada:</strong>{" "}
                      {analysisData?.location?.bounds
                        ? `${analysisData.location.bounds[0][0].toFixed(2)}°, ${analysisData.location.bounds[0][1].toFixed(2)}° a ${analysisData.location.bounds[1][0].toFixed(2)}°, ${analysisData.location.bounds[1][1].toFixed(2)}°`
                        : "No disponible"}
                    </p>
                    <p><strong>Fecha de Inicio:</strong> {dateRange?.startDate || "N/A"}</p>
                    <p><strong>Fecha de Fin:</strong> {dateRange?.endDate || "N/A"}</p>

                    <div className={`p-4 rounded-md ${getViabilityColor(viability.level)} text-white shadow-sm`}>
                      <div className="flex items-center space-x-3 mb-1">
                        <span className="text-3xl">{getViabilityIcon(viability.message)}</span>
                        <span className="text-xl font-bold">{viability.message}</span>
                      </div>
                      <div className="text-base">
                        <strong>Nivel:</strong> {viability.level} &nbsp;|&nbsp;
                        <strong>Puntuación:</strong> {viability.score}
                      </div>
                      {viability.recommendations.length > 0 && (
                        <ul className="list-disc pl-6 mt-2 text-sm leading-relaxed">
                          {viability.recommendations.map((rec, i) => (
                            <li key={i}>{rec}</li>
                          ))}
                        </ul>
                      )}
                    </div>

                    <p className="text-base text-gray-700">
                      <strong>Velocidad Promedio del Viento (100m):</strong>{" "}
                      {formatNumber(extractStatistics(analysisData.analysis, windUnit).mean_wind_speed_100m)}{" "}
                      {windUnit === "kmh" ? "km/h" : "m/s"}
                    </p>
                  </CardContent>
                </Card>

                {/* Estadísticas Principales */}
                <Card>
                  <CardHeader>
                    <CardTitle>Estadísticas Principales</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <p><strong>Velocidad Media del Viento (10m):</strong> {formatNumber(extractStatistics(analysisData.analysis, windUnit).mean_wind_speed_10m)} {windUnit === 'kmh' ? 'km/h' : 'm/s'}</p>
                    <p><strong>Velocidad Media del Viento (100m):</strong> {formatNumber(extractStatistics(analysisData.analysis, windUnit).mean_wind_speed_100m)} {windUnit === 'kmh' ? 'km/h' : 'm/s'}</p>
                    <p><strong>Velocidad Máxima del Viento (10m):</strong> {formatNumber(extractStatistics(analysisData.analysis, windUnit).max_wind_speed_10m)} {windUnit === 'kmh' ? 'km/h' : 'm/s'}</p>
                    <p><strong>Velocidad Máxima del Viento (100m):</strong> {formatNumber(extractStatistics(analysisData.analysis, windUnit).max_wind_speed_100m)} {windUnit === 'kmh' ? 'km/h' : 'm/s'}</p>
                    <p><strong>Desviación Estándar (10m):</strong> {formatNumber(extractStatistics(analysisData.analysis, windUnit).std_wind_speed_10m)} {windUnit === 'kmh' ? 'km/h' : 'm/s'}</p>
                    <p><strong>Desviación Estándar (100m):</strong> {formatNumber(extractStatistics(analysisData.analysis, windUnit).std_wind_speed_100m)} {windUnit === 'kmh' ? 'km/h' : 'm/s'}</p>
                    <p><strong>Densidad de Potencia (10m):</strong> {formatNumber(extractStatistics(analysisData.analysis, windUnit).power_density_10m)} W/m²</p>
                    <p><strong>Densidad de Potencia (100m):</strong> {formatNumber(extractStatistics(analysisData.analysis, windUnit).power_density_100m)} W/m²</p>
                    <p><strong>Factor de Capacidad (10m):</strong> {formatPercentage(extractStatistics(analysisData.analysis, windUnit).capacity_factor_10m)}</p>
                    <p><strong>Factor de Capacidad (100m):</strong> {formatPercentage(extractStatistics(analysisData.analysis, windUnit).capacity_factor_100m)}</p>
                    <p><strong>Intensidad de Turbulencia (10m):</strong> {formatPercentage(extractStatistics(analysisData.analysis, windUnit).turbulence_intensity_10m)}</p>
                    <p><strong>Intensidad de Turbulencia (100m):</strong> {formatPercentage(extractStatistics(analysisData.analysis, windUnit).turbulence_intensity_100m)}</p>
                  </CardContent>
                </Card>

                {/* Gráfico de evolución temporal */}
                <Card>
                  <CardHeader>
                    <CardTitle>Evolución Temporal de Velocidad del Viento</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {chartData.timeSeries && chartData.timeSeries.length > 0 ? (
                      <ResponsiveContainer width="100%" height={300}>
                        <LineChart data={chartData.timeSeries}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis 
                            dataKey="time" 
                            tickFormatter={(t) => isNaN(new Date(t)) ? '' : new Date(t).toLocaleDateString('es-CO')} 
                          />
                          <YAxis label={{ value: `Velocidad (${windUnit === 'kmh' ? 'km/h' : 'm/s'})`, angle: -90, position: 'insideLeft' }} />
                          <Tooltip
                            labelFormatter={(l) => {
                              const d = new Date(l);
                              return isNaN(d) ? "Inválido" : d.toLocaleString('es-CO');
                            }}
                            formatter={(v) => `${v.toFixed(2)} ${windUnit === 'kmh' ? 'km/h' : 'm/s'}`}
                          />
                          <Line type="monotone" dataKey="speed" stroke="#8884d8" dot={false} name="Velocidad" />
                        </LineChart>
                      </ResponsiveContainer>
                    ) : (
                      <p>No hay datos de evolución temporal disponibles.</p>
                    )}
                  </CardContent>
                </Card>

                {/* Gráfico de patrones horarios */}
                <Card>
                  <CardHeader>
                    <CardTitle>Patrones Horarios de Velocidad del Viento</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {chartData.hourlyPatterns && chartData.hourlyPatterns.length > 0 ? (
                      <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={chartData.hourlyPatterns}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="hour" />
                          <YAxis label={{ value: `Velocidad (${windUnit === 'kmh' ? 'km/h' : 'm/s'})`, angle: -90, position: 'insideLeft' }} />
                          <Tooltip formatter={(value) => `${value.toFixed(2)} ${windUnit === 'kmh' ? 'km/h' : 'm/s'}`} />
                          <Bar dataKey="speed" fill="#82ca9d" name="Velocidad Media" />
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                      <p>No hay datos de patrones horarios disponibles.</p>
                    )}
                  </CardContent>
                </Card>

                {/* Rosa de vientos */}
                <Card>
                  <CardHeader>
                    <CardTitle>Rosa de Vientos</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {chartData.windRose && chartData.windRose.length > 0 ? (
                      <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={chartData.windRose}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="direction" />
                          <YAxis label={{ value: "Frecuencia (%)", angle: -90, position: "insideLeft" }} />
                          <Tooltip />
                          {chartData.windRoseLabels?.speed_labels?.map((label, index) => (
                            <Bar key={label} dataKey={label} stackId="a" fill={getColor(index)} />
                          ))}
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                      <p>No hay datos de rosa de vientos disponibles.</p>
                    )}
                  </CardContent>
                </Card>

                {/* Distribución de Weibull */}
                <Card>
                  <CardHeader>
                    <CardTitle>Distribución de Velocidad del Viento (Weibull)</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {chartData.weibullHistogram && chartData.weibullHistogram.length > 0 ? (
                      <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={chartData.weibullHistogram}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="speed_bin" label={{ value: `Velocidad (${windUnit === 'kmh' ? 'km/h' : 'm/s'})`, position: 'insideBottom', offset: -5 }} />
                          <YAxis label={{ value: "Frecuencia", angle: -90, position: 'insideLeft' }} />
                          <Tooltip formatter={(value) => `${value.toFixed(4)}`} />
                          <Bar dataKey="frequency" fill="#ffc658" name="Frecuencia" />
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                      <p>No hay datos de distribución Weibull disponibles.</p>
                    )}
                  </CardContent>
                </Card>

                {/* Opciones de Exportación */}
                <Card className="lg:col-span-2">
                  <CardHeader>
                    <CardTitle className="flex items-center space-x-2">
                      <Download className="h-5 w-5" />
                      <span>Exportar Resultados</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="flex space-x-4">
                    <Button onClick={exportToCSV}>
                      Exportar CSV
                    </Button>
                    <Button onClick={exportToPDF}>
                      Exportar PDF
                    </Button>
                  </CardContent>
                </Card>
              </div>
            ) : (
              <Card>
                <CardContent className="p-6 text-center text-gray-600">
                  {loading ? (
                    <div className="flex items-center justify-center space-x-2">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                      <p>Cargando resultados del análisis...</p>
                    </div>
                  ) : (
                    <p>Selecciona un área en el mapa y haz clic en "Iniciar Análisis Eólico" para ver los resultados.</p>
                  )}
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

