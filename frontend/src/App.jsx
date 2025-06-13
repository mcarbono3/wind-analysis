import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Rectangle, useMapEvents, useMap } from 'react-leaflet';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Wind, MapPin, Calendar, Download, BarChart3, TrendingUp, XCircle } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell } from 'recharts';
import axios from 'axios';
import 'leaflet/dist/leaflet.css';
import './App.css';

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

// Función para extraer estadísticas de la estructura REAL del backend - PROBADO Y FUNCIONA
const extractStatistics = (analysis) => {
  if (!analysis) return {};
  
  const basicStats = safeGet(analysis, 'basic_statistics', {});
  const capacityFactor = safeGet(analysis, 'capacity_factor', {});
  const powerDensity = safeGet(analysis, 'power_density', {});
  const weibullAnalysis = safeGet(analysis, 'weibull_analysis', {});
  const turbulenceAnalysis = safeGet(analysis, 'turbulence_analysis', {}); // Added this line

  console.log('Extracting statistics from:', { basicStats, capacityFactor, powerDensity, weibullAnalysis, turbulenceAnalysis }); // Updated log

  return {
    // Estadísticas básicas
    mean_wind_speed_10m: safeNumber(basicStats.mean_wind_speed_10m || basicStats.mean),
    mean_wind_speed_100m: safeNumber(basicStats.mean_wind_speed_100m || basicStats.mean),
    max_wind_speed_10m: safeNumber(basicStats.max_wind_speed_10m || basicStats.max),
    max_wind_speed_100m: safeNumber(basicStats.max_wind_speed_100m || basicStats.max),
    std_wind_speed_10m: safeNumber(basicStats.std_wind_speed_10m || basicStats.std),
    std_wind_speed_100m: safeNumber(basicStats.std_wind_speed_100m || basicStats.std),
    
    // Factor de capacidad
    capacity_factor_10m: safeNumber(capacityFactor.capacity_factor),
    capacity_factor_100m: safeNumber(capacityFactor.capacity_factor),
    
    // Densidad de potencia
    power_density_10m: safeNumber(powerDensity.mean_power_density),
    power_density_100m: safeNumber(powerDensity.mean_power_density),
    
    // Parámetros de Weibull
    weibull_k_10m: safeNumber(weibullAnalysis.k_10m || weibullAnalysis.k),
    weibull_c_10m: safeNumber(weibullAnalysis.c_10m || weibullAnalysis.c),
    weibull_k_100m: safeNumber(weibullAnalysis.k_100m || weibullAnalysis.k),
    weibull_c_100m: safeNumber(weibullAnalysis.c_100m || weibullAnalysis.c),

    // Intensidad de Turbulencia
    turbulence_intensity_10m: safeNumber(turbulenceAnalysis.overall?.turbulence_intensity),
    turbulence_intensity_100m: safeNumber(turbulenceAnalysis.overall?.turbulence_intensity)
  };
};


// Función para extraer datos de viabilidad - PENDIENTE DE PRUEBA EN VERSION V8d
const extractViability = (analysis) => {
  if (!analysis) return {};
  
  const assessment = safeGet(analysis, 'overall_assessment', {});
  
  console.log('Extracting viability from:', assessment);
  
  return {
    // Usar las propiedades EXACTAS que retorna el backend
    level: assessment.viability_level || 'No disponible',
    recommendation: assessment.viability_message || assessment.recommendation || 'Sin recomendación disponible',
    score: safeNumber(assessment.viability_score),
    summary: assessment.summary || 'Sin resumen disponible',
    recommendations: safeArray(assessment.recommendations)
  };
};

// Función para preparar datos de gráficos - PENDIENTE DE PRUEBA EN VERSION V8d
const prepareChartData = (analysis, era5Data) => {
  if (!analysis || !era5Data) return { timeSeries: [], weibullHistogram: [], windRose: [], hourlyPatterns: [] };
  
  const timeSeries = safeArray(analysis.time_series);
  const windSpeeds100m = safeArray(era5Data.wind_speed_100m);
  const timestamps = safeArray(era5Data.timestamps);
  
  // Preparar datos de serie temporal
  const timeSeriesData = [];
  const minLength = Math.min(windSpeeds100m.length, timestamps.length);
  
  for (let i = 0; i < minLength; i++) {
    if (timestamps[i] && windSpeeds100m[i] !== undefined) {
      timeSeriesData.push({
        time: timestamps[i],
        speed: safeNumber(windSpeeds100m[i])
      });
    }
  }

  // Preparar datos de histograma de Weibull con múltiples fuentes posibles - PENDIENTE DE PRUEBA EN VERSION V8d
  const weibullData = safeArray(analysis.weibull_analysis?.plot_data?.x_values.map((x, i) => ({
    speed_bin: x,
    frequency: analysis.weibull_analysis.plot_data.y_values[i]
  })));
  
  // Preparar datos de rosa de vientos - PENDIENTE DE PRUEBA EN VERSION V8d
  const windRoseData = safeArray(analysis.wind_rose?.data);
  
  // Preparar datos de patrones horarios
  const hourlyData = [];
  const hourlyPatterns = safeGet(analysis, 'hourly_patterns', {});
  if (hourlyPatterns.mean_by_hour) {
    Object.entries(hourlyPatterns.mean_by_hour).forEach(([hour, speed]) => {
      hourlyData.push({
        hour: parseInt(hour),
        speed: safeNumber(speed)
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
  
// Componente para manejar la selección en el mapa
function MapSelector({ onAreaSelect, selectedArea, isSelecting, setIsSelecting }) {
  const [startPoint, setStartPoint] = useState(null);
  const [currentBounds, setCurrentBounds] = useState(null);
  const map = useMap();

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

// Componente principal
function App() {
  const [selectedArea, setSelectedArea] = useState(null);
  const [dateRange, setDateRange] = useState({
    startDate: '2024-01-01',
    endDate: '2024-01-07'
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
    console.log('🔄 App useEffect - analysisData changed');
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
    console.log('🎯 App - handleAreaSelect called with bounds:', bounds);
    setSelectedArea(bounds);
    setError(null);
    setIsMapSelecting(false);
  };

  const handleClearSelection = () => {
    console.log('🧹 App - handleClearSelection called');
    setSelectedArea(null);
    setIsMapSelecting(false);
    setError(null);
  };

  const handleAnalysis = async () => {
    console.log('🚀 App - handleAnalysis called. selectedArea:', selectedArea);
    if (!selectedArea) {
      setError('Por favor selecciona un área en el mapa');
      console.log('❌ Error: No area selected.');
      return;
    }

    // Validar que el área seleccionada tenga dimensiones mínimas (reducido a 0.005)
    const latDiff = Math.abs(selectedArea[1][0] - selectedArea[0][0]);
    const lonDiff = Math.abs(selectedArea[1][1] - selectedArea[0][1]);
    
    if (latDiff < 0.005 || lonDiff < 0.005) {
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
    
     // ✅ Agrega esta llamada al análisis
     const analysisResponse = await axios.post(`${API_BASE_URL}/wind-analysis`, {
      wind_speeds: era5Data.wind_speed_10m.flat(),
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
          bounds: selectedArea,
          center: [
            (selectedArea[0][0] + selectedArea[1][0]) / 2,
            (selectedArea[0][1] + selectedArea[1][1]) / 2
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

  const generateMockWindData = () => {
    // Generar datos de viento simulados para demostración
    const hours = 24 * 7; // Una semana
    const wind_speeds = [];
    const wind_directions = [];
    const timestamps = [];

    for (let i = 0; i < hours; i++) {
      // Simular variación diurna y aleatoria
      const baseSpeed = 6 + 2 * Math.sin(i * 2 * Math.PI / 24) + Math.random() * 3;
      wind_speeds.push(Math.max(0, baseSpeed));
      wind_directions.push(Math.random() * 360);
      
      const date = new Date(dateRange.startDate);
      date.setHours(date.getHours() + i);
      timestamps.push(date.toISOString());
    }

    return { wind_speeds, wind_directions, timestamps };
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

  // ✅ AÑADE ESTA LÍNEA AQUÍ (ANTES DEL return)
  const viability = extractViability(analysisData.analysis);
  const chartData = analysisData.analysis && analysisData.era5Data
  ? prepareChartData(analysisData.analysis, analysisData.era5Data)
  : { timeSeries: [], weibullHistogram: [], windRose: [], hourlyPatterns: [] };
	
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-cyan-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-3">
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
          <TabsContent value="map" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <MapPin className="h-5 w-5" />
                  <span>Seleccionar Área de Análisis</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-96 rounded-lg overflow-hidden border">
                  <MapContainer
                    center={[caribbeanBounds.center.lat, caribbeanBounds.center.lon]}
                    zoom={7}
                    style={{ height: '100%', width: '100%' }}
                    dragging={!isMapSelecting} // Controlar el arrastre del mapa con el estado isMapSelecting
                    className={isMapSelecting ? 'cursor-crosshair' : 'cursor-grab'}
                  >
                    <TileLayer
                      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    />
                    <MapSelector
                      onAreaSelect={handleAreaSelect}
                      selectedArea={selectedArea}
                      isSelecting={isMapSelecting} // Sección modificada
                      setIsSelecting={setIsMapSelecting} // Pasar la función para actualizar el estado
                    />
                  </MapContainer>
                </div>
                <div className="mt-4 flex justify-between items-center">
                  <p className="text-sm text-gray-600">
                    {isMapSelecting ? 'Haz clic y arrastra para seleccionar un área' : 'Haz clic en "Iniciar Selección" para dibujar un área'}
                  </p>
                  <div className="flex space-x-2">
                    <Button 
                      onClick={() => {
                        console.log('App - Iniciar Selección button clicked. Current isMapSelecting:', isMapSelecting);
                        setIsMapSelecting(true);
                      }} 
                      disabled={isMapSelecting}
                    >
                      {isMapSelecting ? 'Seleccionando...' : 'Iniciar Selección'}
                    </Button>
                    {selectedArea && (
                      <Button 
                        onClick={handleClearSelection} 
                        variant="outline"
                        size="icon"
                      >
                        <XCircle className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                  {selectedArea && (
                    <Badge variant="secondary">
                      Área seleccionada: {selectedArea[0][0].toFixed(2)}°, {selectedArea[0][1].toFixed(2)}° a {selectedArea[1][0].toFixed(2)}°, {selectedArea[1][1].toFixed(2)}°
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

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
                  disabled={loading || !selectedArea}
                >
                  {loading ? 'Analizando...' : 'Iniciar Análisis Eólico'}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab: Resultados */}
          <TabsContent value="results" className="space-y-6">
            {analysisData ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Resumen del Análisis */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center space-x-2">
                      <TrendingUp className="h-5 w-5" />
                      <span>Resumen del Análisis</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p><strong>Área Analizada:</strong> {analysisData?.location?.bounds?.[0]?.[0]?.toFixed(2) || 'N/A'}°, {analysisData?.location?.bounds?.[0]?.[1]?.toFixed(2) || 'N/A'}° a {analysisData?.location?.bounds?.[1]?.[0]?.toFixed(2) || 'N/A'}°, {analysisData?.location?.bounds?.[1]?.[1]?.toFixed(2) || 'N/A'}°</p>
                    <p><strong>Fecha de Inicio:</strong> {dateRange?.startDate || 'N/A'}</p>
                    <p><strong>Fecha de Fin:</strong> {dateRange?.endDate || 'N/A'}</p>
		{viability?.level && viability?.recommendation ? (
  			<div className={`p-3 rounded-md ${getViabilityColor(viability.level)} text-white flex items-center space-x-2`}>
 			 <span className="text-2xl">{getViabilityIcon(viability.recommendation)}</span>
 			   <p className="font-bold">{viability.recommendation}</p>
 			 </div>
			) : (
		  <div className="p-3 rounded-md bg-gray-500 text-white flex items-center space-x-2">
  		  <span className="text-2xl">❓</span>
  		  <p className="font-bold">Datos de viabilidad no disponibles</p>
 		 </div>
		)}
                    <p className="text-sm text-gray-700"><strong>Velocidad Promedio del Viento (100m):</strong> {formatNumber(extractStatistics(analysisData.analysis).mean_wind_speed_100m)} m/s</p>
                    <p className="text-sm text-gray-700"><strong>Nivel de Viabilidad:</strong> {viability.level || 'No disponible'}</p>
                  </CardContent>
                </Card>

                {/* Estadísticas Principales */}
                <Card>
                  <CardHeader>
                    <CardTitle>Estadísticas Principales</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                      <p><strong>Velocidad Media del Viento (10m):</strong> {formatNumber(extractStatistics(analysisData.analysis).mean_wind_speed_10m)} m/s</p>
                      <p><strong>Velocidad Media del Viento (100m):</strong> {formatNumber(extractStatistics(analysisData.analysis).mean_wind_speed_100m)} m/s</p>
                      <p><strong>Velocidad Máxima del Viento (10m):</strong> {formatNumber(extractStatistics(analysisData.analysis).max_wind_speed_10m)} m/s</p>
                      <p><strong>Velocidad Máxima del Viento (100m):</strong> {formatNumber(extractStatistics(analysisData.analysis).max_wind_speed_100m)} m/s</p>
                      <p><strong>Desviación Estándar (10m):</strong> {formatNumber(extractStatistics(analysisData.analysis).std_wind_speed_10m)} m/s</p>
                      <p><strong>Desviación Estándar (100m):</strong> {formatNumber(extractStatistics(analysisData.analysis).std_wind_speed_100m)} m/s</p>
                      <p><strong>Densidad de Potencia (10m):</strong> {formatNumber(extractStatistics(analysisData.analysis).power_density_10m)} W/m²</p>
                      <p><strong>Densidad de Potencia (100m):</strong> {formatNumber(extractStatistics(analysisData.analysis).power_density_100m)} W/m²</p>
                      <p><strong>Factor de Capacidad (10m):</strong> {formatPercentage(extractStatistics(analysisData.analysis).capacity_factor_10m)}</p>
                      <p><strong>Factor de Capacidad (100m):</strong> {formatPercentage(extractStatistics(analysisData.analysis).capacity_factor_100m)}</p>
                      <p><strong>Intensidad de Turbulencia (10m):</strong> {formatPercentage(extractStatistics(analysisData.analysis).turbulence_intensity_10m)}</p>
                      <p><strong>Intensidad de Turbulencia (100m):</strong> {formatPercentage(extractStatistics(analysisData.analysis).turbulence_intensity_100m)}</p>
                  </CardContent>
                </Card>

                {/* Histograma de Velocidad del Viento con Ajuste Weibull */}
                <Card className="lg:col-span-2">
                  <CardHeader>
                    <CardTitle>Histograma de Velocidad del Viento (100m) con Ajuste Weibull</CardTitle>
                  </CardHeader>
                  <CardContent>
		{chartData.weibullHistogram && chartData.weibullHistogram.length > 0 ? (
 			 <ResponsiveContainer width="100%" height={300}>
   				 <BarChart data={chartData.weibullHistogram}>
     				 <CartesianGrid strokeDasharray="3 3" />
     				 <XAxis dataKey="speed_bin" />
     				 <YAxis />
    			  <Tooltip />
    			  <Bar dataKey="frequency" fill="#8884d8" name="Frecuencia" />
    			</BarChart>
  			</ResponsiveContainer>
                    ) : (
                      <p>No hay datos de histograma disponibles.</p>
                    )}
                  </CardContent>
                </Card>

                {/* Evolución Temporal del Viento (100m) */}
                <Card className="lg:col-span-2">
                  <CardHeader>
                    <CardTitle>Evolución Temporal del Viento (100m)</CardTitle>
                  </CardHeader>
                  <CardContent>
			{analysisData.era5Data?.wind_speed_100m?.length > 0 && analysisData.era5Data?.timestamps?.length > 0 ? (
  		       <ResponsiveContainer width="100%" height={300}>
  		       <LineChart data={analysisData.era5Data.wind_speed_100m.map((speed, index) => ({
     		        time: analysisData.era5Data.timestamps[index],
     		        speed
    		       }))}>
    		   	 <CartesianGrid strokeDasharray="3 3" />
    		  	<XAxis dataKey="time" tickFormatter={(tick) => new Date(tick).toLocaleString()} />
     			 <YAxis />
     		 	<Tooltip labelFormatter={(label) => new Date(label).toLocaleString()} />
     			 <Line type="monotone" dataKey="speed" stroke="#8884d8" dot={false} name="Velocidad (m/s)" />
                      </LineChart>
                      </ResponsiveContainer>
                    ) : (
                      <p>No hay datos de evolución temporal disponibles.</p>
                    )}
                  </CardContent>
                </Card>

                {/* Boxplot Horario de Velocidad del Viento (100m) */}
                <Card>
                  <CardHeader>
                    <CardTitle>Boxplot Horario de Velocidad del Viento (100m)</CardTitle>
                  </CardHeader>
                  <CardContent>
		  {chartData.hourlyPatterns && chartData.hourlyPatterns.length > 0 ? (
  			<ResponsiveContainer width="100%" height={300}>
   			       <BarChart data={chartData.hourlyPatterns}>
   				   <CartesianGrid strokeDasharray="3 3" />
     				 <XAxis dataKey="hour" />
     				 <YAxis />
     			     <Tooltip />
                          <Bar dataKey="speed" fill="#82ca9d" name="Velocidad Media" />
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                      <p>No hay datos de boxplot horario disponibles.</p>
                    )}
                  </CardContent>
                </Card>

                  {/* mostrar la rosa de vientos */}
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
                                    <YAxis />
                                  <Tooltip />
                             <Bar dataKey="frequency" fill="#8884d8" name="Frecuencia (%)" />
                          </BarChart>
                       </ResponsiveContainer>
                   ) : (
                     <p>No hay datos de rosa de vientos disponibles.</p>
                   )}
                 </CardContent>
              </Card>

                {/* Turbulencia y Otros Gráficos (Placeholder) */}
                <Card>
                  <CardHeader>
                    <CardTitle>Turbulencia y Otros Gráficos</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p>Gráficos de turbulencia, variación anual de Weibull, etc., se mostrarán aquí.</p>
                    {analysisData.turbulence_intensity_100m && (
                      <p><strong>Intensidad de Turbulencia (100m):</strong> {analysisData.turbulence_intensity_100m.toFixed(2)}</p>
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
                    <Button onClick={() => alert('Funcionalidad de exportar CSV pendiente.')}>
                      Exportar CSV
                    </Button>
                    <Button onClick={() => alert('Funcionalidad de exportar PDF pendiente.')}>
                      Exportar PDF
                    </Button>
                  </CardContent>
                </Card>
              </div>
            ) : (
              <Card>
                <CardContent className="p-6 text-center text-gray-500">
                  {loading ? (
                    <p>Cargando resultados del análisis...</p>
                  ) : (
                    <p>Selecciona un área en el mapa y haz clic en "Iniciar Análisis Eólico" para ver los resultados.</p>
                  )}
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </main>

      {/* Footer */}
      <footer className="bg-gray-800 text-white py-4 mt-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-sm">
          © {new Date().getFullYear()} Análisis Eólico Caribe. Todos los derechos reservados.
        </div>
      </footer>
    </div>
  );
}

export default App;





