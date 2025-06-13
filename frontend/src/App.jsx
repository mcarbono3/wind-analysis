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

// Función para normalizar la estructura de datos del análisis basada en la estructura real
const normalizeAnalysisData = (rawAnalysis) => {
  console.log('Normalizing analysis data:', rawAnalysis);
  
  if (!rawAnalysis) {
    return {
      basic_statistics: {},
      capacity_factor: {},
      overall_assessment: {},
      power_density: {},
      turbulence_analysis: {},
      weibull_analysis: {},
      wind_rose: {},
      time_series: []
    };
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

// Función para extraer estadísticas de la estructura real
const extractStatistics = (analysis) => {
  const basicStats = safeGet(analysis, 'basic_statistics', {});
  const capacityFactor = safeGet(analysis, 'capacity_factor', {});
  const powerDensity = safeGet(analysis, 'power_density', {});
  const weibullAnalysis = safeGet(analysis, 'weibull_analysis', {});
  
  return {
    mean_wind_speed_10m: safeNumber(basicStats.mean_wind_speed_10m),
    mean_wind_speed_100m: safeNumber(basicStats.mean_wind_speed_100m),
    max_wind_speed_10m: safeNumber(basicStats.max_wind_speed_10m),
    max_wind_speed_100m: safeNumber(basicStats.max_wind_speed_100m),
    std_wind_speed_10m: safeNumber(basicStats.std_wind_speed_10m),
    std_wind_speed_100m: safeNumber(basicStats.std_wind_speed_100m),
    capacity_factor_10m: safeNumber(capacityFactor.capacity_factor_10m),
    capacity_factor_100m: safeNumber(capacityFactor.capacity_factor_100m),
    power_density_10m: safeNumber(powerDensity.power_density_10m),
    power_density_100m: safeNumber(powerDensity.power_density_100m),
    weibull_k_10m: safeNumber(weibullAnalysis.k_10m),
    weibull_c_10m: safeNumber(weibullAnalysis.c_10m),
    weibull_k_100m: safeNumber(weibullAnalysis.k_100m),
    weibull_c_100m: safeNumber(weibullAnalysis.c_100m)
  };
};

// Función para extraer datos de viabilidad de la estructura real
const extractViability = (analysis) => {
  const assessment = safeGet(analysis, 'overall_assessment', {});
  
  return {
    level: assessment.viability_level || assessment.level || 'No disponible',
    recommendation: assessment.recommendation || assessment.message || 'Sin recomendación disponible',
    score: safeNumber(assessment.viability_score || assessment.score),
    summary: assessment.summary || 'Sin resumen disponible'
  };
};

// Función para preparar datos de gráficos
const prepareChartData = (analysis, era5Data) => {
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
  
  // Preparar datos de histograma de Weibull
  const weibullData = safeArray(analysis.weibull_analysis?.histogram_data);
  
  // Preparar datos de rosa de vientos
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
    console.log('MapSelector useEffect - isSelecting:', isSelecting);
    if (isSelecting) {
      console.log('MapSelector: Disabling map interactions');
      map.dragging.disable();
      map.doubleClickZoom.disable();
      map.scrollWheelZoom.disable();
    } else {
      console.log('MapSelector: Enabling map interactions');
      map.dragging.enable();
      map.doubleClickZoom.enable();
      map.scrollWheelZoom.enable();
    }
  }, [isSelecting, map]);

  useMapEvents({
    mousedown: (e) => {
      console.log('MapSelector mousedown event:', e.latlng, 'isSelecting:', isSelecting);
      if (isSelecting) {
        setStartPoint([e.latlng.lat, e.latlng.lng]);
        setCurrentBounds([[e.latlng.lat, e.latlng.lng], [e.latlng.lat, e.latlng.lng]]);
        console.log('MapSelector: Selection started at', e.latlng);
      }
    },
    mousemove: (e) => {
      if (isSelecting && startPoint) {
        const newBounds = [
          [Math.min(startPoint[0], e.latlng.lat), Math.min(startPoint[1], e.latlng.lng)],
          [Math.max(startPoint[0], e.latlng.lat), Math.max(startPoint[1], e.latlng.lng)]
        ];
        setCurrentBounds(newBounds);
        console.log('MapSelector: Drawing rectangle to', e.latlng);
      }
    },
    mouseup: (e) => {
      console.log('MapSelector mouseup event:', e.latlng, 'isSelecting:', isSelecting, 'startPoint:', startPoint);
      if (isSelecting && startPoint) {
        const endPoint = [e.latlng.lat, e.latlng.lng];
        const bounds = [
          [Math.min(startPoint[0], endPoint[0]), Math.min(startPoint[1], endPoint[1])],
          [Math.max(startPoint[0], endPoint[0]), Math.max(startPoint[1], endPoint[1])]
        ];
        console.log('MapSelector - Selected bounds:', bounds);
        onAreaSelect(bounds);
        setIsSelecting(false);
        setStartPoint(null);
        setCurrentBounds(null);
        console.log('MapSelector: Selection finished, isSelecting set to false');
      }
    },
    click: (e) => {
      console.log('MapSelector click event:', e.latlng, 'isSelecting:', isSelecting, 'startPoint:', startPoint);
      if (isSelecting && !startPoint) {
        const point = [e.latlng.lat, e.latlng.lng];
        const bounds = [[point[0] - 0.01, point[1] - 0.01], [point[0] + 0.01, point[1] + 0.01]];
        console.log('MapSelector - Selected point bounds:', bounds);
        onAreaSelect(bounds);
        setIsSelecting(false);
        console.log('MapSelector: Point selection finished, isSelecting set to false');
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
    console.log('App useEffect - isMapSelecting changed to:', isMapSelecting);
  }, [isMapSelecting]);

  useEffect(() => {
    console.log('App useEffect - selectedArea changed to:', selectedArea);
  }, [selectedArea]);

  useEffect(() => {
    console.log('App useEffect - analysisData changed to:', analysisData);
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
    console.log('App - handleAreaSelect called with bounds:', bounds);
    setSelectedArea(bounds);
    setError(null);
    setIsMapSelecting(false);
    console.log('App - handleAreaSelect: isMapSelecting set to false');
  };

  const handleClearSelection = () => {
    console.log('App - handleClearSelection called');
    setSelectedArea(null);
    setIsMapSelecting(false);
    setError(null);
  };

  const handleAnalysis = async () => {
    console.log('App - handleAnalysis called. selectedArea:', selectedArea);
    if (!selectedArea) {
      setError('Por favor selecciona un área en el mapa');
      console.log('Error: No area selected.');
      return;
    }

    // Validar que el área seleccionada tenga dimensiones mínimas
    const latDiff = Math.abs(selectedArea[1][0] - selectedArea[0][0]);
    const lonDiff = Math.abs(selectedArea[1][1] - selectedArea[0][1]);
    
    if (latDiff < 0.01 || lonDiff < 0.01) {
      setError('El área seleccionada es demasiado pequeña. Por favor selecciona un área más grande.');
      console.log('Error: Selected area is too small.');
      return;
    }

    setLoading(true);
    setError(null);
    console.log('Starting analysis...');

    try {
      // 1. Obtener datos de ERA5 del backend
      console.log('Requesting ERA5 data from backend with parameters:', {
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

      console.log('ERA5 Data received:', era5Response.data);

      if (era5Response.data.status !== 'success' || !era5Response.data.data) {
        throw new Error(era5Response.data.message || 'Error al obtener datos de ERA5');
      }

      const era5Data = era5Response.data.data;

      // Validar que los datos de ERA5 tengan la estructura esperada
      if (!era5Data.wind_speed_10m || !Array.isArray(era5Data.wind_speed_10m) || era5Data.wind_speed_10m.length === 0) {
        throw new Error('Los datos de viento recibidos no tienen el formato esperado');
      }

      // 2. Realizar el análisis de viento con los datos de ERA5
      console.log('Sending ERA5 data to wind analysis endpoint with parameters:', {
        wind_speeds: era5Data.wind_speed_10m.flat(),
        air_density: 1.225
      });
      const analysisResponse = await axios.post(`${API_BASE_URL}/wind-analysis`, {
        wind_speeds: era5Data.wind_speed_10m.flat(),
        air_density: 1.225
      });

      console.log('Analysis Response received:', analysisResponse.data);

      // Validar la respuesta del análisis
      if (!analysisResponse.data || !analysisResponse.data.analysis) {
        throw new Error('La respuesta del análisis no tiene el formato esperado');
      }

      // Normalizar los datos del análisis
      const rawAnalysis = analysisResponse.data.analysis;
      const normalizedAnalysis = normalizeAnalysisData(rawAnalysis);
      
      console.log('Normalized analysis data:', normalizedAnalysis);

      setAnalysisData({
        analysis: normalizedAnalysis,
        location: {
          bounds: selectedArea,
          center: [
            (selectedArea[0][0] + selectedArea[1][0]) / 2,
            (selectedArea[0][1] + selectedArea[1][1]) / 2
          ]
        },
        era5Data: {
          ...era5Data,
          wind_speed_10m: safeArray(era5Data.wind_speed_10m),
          wind_speed_100m: safeArray(era5Data.wind_speed_100m),
          wind_direction_10m: safeArray(era5Data.wind_direction_10m),
          wind_direction_100m: safeArray(era5Data.wind_direction_100m),
          surface_pressure: safeArray(era5Data.surface_pressure),
          temperature_2m: safeArray(era5Data.temperature_2m),
          timestamps: safeArray(era5Data.timestamps)
        }
      });

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

  // Funciones para exportación
  const handleExportCSV = () => {
    try {
      const csvData = [];
      const headers = ['Timestamp', 'Wind Speed 10m (m/s)', 'Wind Speed 100m (m/s)', 'Temperature (°C)', 'Pressure (Pa)'];
      csvData.push(headers.join(','));

      const timestamps = safeArray(analysisData.era5Data.timestamps);
      const windSpeed10m = safeArray(analysisData.era5Data.wind_speed_10m);
      const windSpeed100m = safeArray(analysisData.era5Data.wind_speed_100m);
      const temperature = safeArray(analysisData.era5Data.temperature_2m);
      const pressure = safeArray(analysisData.era5Data.surface_pressure);

      const maxLength = Math.max(timestamps.length, windSpeed10m.length, windSpeed100m.length, temperature.length, pressure.length);

      for (let i = 0; i < maxLength; i++) {
        const row = [
          timestamps[i] || 'N/A',
          windSpeed10m[i] || 'N/A',
          windSpeed100m[i] || 'N/A',
          temperature[i] || 'N/A',
          pressure[i] || 'N/A'
        ];
        csvData.push(row.join(','));
      }

      const csvContent = csvData.join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `analisis_eolico_${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error('Error al exportar CSV:', error);
      alert('Error al exportar CSV. Por favor intenta nuevamente.');
    }
  };

  const handleExportPDF = () => {
    alert('Funcionalidad de exportar PDF en desarrollo. Próximamente disponible.');
  };

  // Extraer datos normalizados para el renderizado
  const statistics = extractStatistics(analysisData.analysis);
  const viability = extractViability(analysisData.analysis);
  const chartData = prepareChartData(analysisData.analysis, analysisData.era5Data);

  // Verificar si hay datos de análisis
  const hasAnalysisData = analysisData && Object.keys(analysisData.analysis).length > 0;

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
                    dragging={!isMapSelecting}
                    className={isMapSelecting ? 'cursor-crosshair' : 'cursor-grab'}
                  >
                    <TileLayer
                      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    />
                    <MapSelector
                      onAreaSelect={handleAreaSelect}
                      selectedArea={selectedArea}
                      isSelecting={isMapSelecting}
                      setIsSelecting={setIsMapSelecting}
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
            {hasAnalysisData ? (
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
                    <p><strong>Área Analizada:</strong> {safeGet(analysisData, 'location.bounds.0.0', 0).toFixed(2)}°, {safeGet(analysisData, 'location.bounds.0.1', 0).toFixed(2)}° a {safeGet(analysisData, 'location.bounds.1.0', 0).toFixed(2)}°, {safeGet(analysisData, 'location.bounds.1.1', 0).toFixed(2)}°</p>
                    <p><strong>Fecha de Inicio:</strong> {dateRange?.startDate || 'N/A'}</p>
                    <p><strong>Fecha de Fin:</strong> {dateRange?.endDate || 'N/A'}</p>
                    
                    {viability.level && viability.level !== 'No disponible' ? (
                      <div className={`p-3 rounded-md ${getViabilityColor(viability.level)} text-white flex items-center space-x-2`}>
                        <span className="text-2xl">{getViabilityIcon(viability.recommendation)}</span>
                        <div>
                          <p className="font-bold">{viability.recommendation}</p>
                          {viability.summary && <p className="text-sm mt-1">{viability.summary}</p>}
                        </div>
                      </div>
                    ) : (
                      <div className="p-3 rounded-md bg-gray-500 text-white flex items-center space-x-2">
                        <span className="text-2xl">❓</span>
                        <p className="font-bold">Datos de viabilidad no disponibles</p>
                      </div>
                    )}
                    
                    <p className="text-sm text-gray-700"><strong>Velocidad Promedio del Viento (10m):</strong> {formatNumber(statistics.mean_wind_speed_10m)} m/s</p>
                    <p className="text-sm text-gray-700"><strong>Velocidad Promedio del Viento (100m):</strong> {formatNumber(statistics.mean_wind_speed_100m)} m/s</p>
                    <p className="text-sm text-gray-700"><strong>Nivel de Viabilidad:</strong> {viability.level}</p>
                  </CardContent>
                </Card>

                {/* Estadísticas Principales */}
                <Card>
                  <CardHeader>
                    <CardTitle>Estadísticas Principales</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <p><strong>Velocidad Media del Viento (10m):</strong> {formatNumber(statistics.mean_wind_speed_10m)} m/s</p>
                    <p><strong>Velocidad Media del Viento (100m):</strong> {formatNumber(statistics.mean_wind_speed_100m)} m/s</p>
                    <p><strong>Velocidad Máxima del Viento (10m):</strong> {formatNumber(statistics.max_wind_speed_10m)} m/s</p>
                    <p><strong>Velocidad Máxima del Viento (100m):</strong> {formatNumber(statistics.max_wind_speed_100m)} m/s</p>
                    <p><strong>Densidad de Potencia (10m):</strong> {formatNumber(statistics.power_density_10m)} W/m²</p>
                    <p><strong>Densidad de Potencia (100m):</strong> {formatNumber(statistics.power_density_100m)} W/m²</p>
                    <p><strong>Factor de Capacidad (10m):</strong> {formatPercentage(statistics.capacity_factor_10m)}</p>
                    <p><strong>Factor de Capacidad (100m):</strong> {formatPercentage(statistics.capacity_factor_100m)}</p>
                    <p><strong>Parámetro k de Weibull (100m):</strong> {formatNumber(statistics.weibull_k_100m)}</p>
                    <p><strong>Parámetro c de Weibull (100m):</strong> {formatNumber(statistics.weibull_c_100m)} m/s</p>
                  </CardContent>
                </Card>

                {/* Evolución Temporal del Viento (100m) */}
                <Card className="lg:col-span-2">
                  <CardHeader>
                    <CardTitle>Evolución Temporal del Viento (100m)</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {chartData.timeSeries.length > 0 ? (
                      <ResponsiveContainer width="100%" height={300}>
                        <LineChart data={chartData.timeSeries}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis 
                            dataKey="time" 
                            tickFormatter={(tick) => formatDate(tick, 'Fecha inválida')} 
                          />
                          <YAxis />
                          <Tooltip 
                            labelFormatter={(label) => formatDateTime(label, 'Fecha inválida')} 
                          />
                          <Line type="monotone" dataKey="speed" stroke="#8884d8" name="Velocidad del Viento (m/s)" dot={false} />
                        </LineChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="text-center py-8 text-gray-500">
                        <p>No hay datos de evolución temporal disponibles.</p>
                        <p className="text-sm mt-2">Los datos pueden estar procesándose o no estar disponibles para el área seleccionada.</p>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Histograma de Velocidad del Viento con Ajuste Weibull */}
                <Card className="lg:col-span-2">
                  <CardHeader>
                    <CardTitle>Histograma de Velocidad del Viento con Ajuste Weibull</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {chartData.weibullHistogram.length > 0 ? (
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
                      <div className="text-center py-8 text-gray-500">
                        <p>No hay datos de histograma disponibles.</p>
                        <p className="text-sm mt-2">Los datos pueden estar procesándose o no estar disponibles para el área seleccionada.</p>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Patrones Horarios */}
                <Card>
                  <CardHeader>
                    <CardTitle>Patrones Horarios de Velocidad del Viento</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {chartData.hourlyPatterns.length > 0 ? (
                      <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={chartData.hourlyPatterns}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="hour" />
                          <YAxis />
                          <Tooltip />
                          <Bar dataKey="speed" fill="#82ca9d" name="Velocidad Promedio (m/s)" />
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="text-center py-8 text-gray-500">
                        <p>No hay datos de patrones horarios disponibles.</p>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Análisis de Turbulencia */}
                <Card>
                  <CardHeader>
                    <CardTitle>Análisis de Turbulencia</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {safeGet(analysisData, 'analysis.turbulence_analysis') ? (
                      <div className="space-y-2">
                        <p><strong>Intensidad de Turbulencia (10m):</strong> {formatNumber(safeGet(analysisData, 'analysis.turbulence_analysis.turbulence_intensity_10m'))}</p>
                        <p><strong>Intensidad de Turbulencia (100m):</strong> {formatNumber(safeGet(analysisData, 'analysis.turbulence_analysis.turbulence_intensity_100m'))}</p>
                        <p className="text-sm text-gray-600">La intensidad de turbulencia indica la variabilidad del viento en el área analizada.</p>
                      </div>
                    ) : (
                      <div className="text-center py-8 text-gray-500">
                        <p>Datos de análisis de turbulencia no disponibles.</p>
                      </div>
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
                    <Button onClick={handleExportCSV}>
                      Exportar CSV
                    </Button>
                    <Button onClick={handleExportPDF}>
                      Exportar PDF
                    </Button>
                  </CardContent>
                </Card>
              </div>
            ) : (
              <Card>
                <CardContent className="p-6 text-center text-gray-500">
                  {loading ? (
                    <div className="space-y-2">
                      <p>Cargando resultados del análisis...</p>
                      <p className="text-sm">Esto puede tomar unos momentos mientras procesamos los datos de ERA5.</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <p>Selecciona un área en el mapa y haz clic en "Iniciar Análisis Eólico" para ver los resultados.</p>
                      <p className="text-sm">Los resultados incluirán estadísticas detalladas, gráficos y análisis de viabilidad eólica.</p>
                    </div>
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



