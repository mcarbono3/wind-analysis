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

// Función para normalizar la estructura de datos del análisis basada en la estructura REAL del backend
const normalizeAnalysisData = (rawAnalysis) => {
  console.log('Normalizing analysis data:', rawAnalysis);
  
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

// Función para extraer datos de viabilidad de la estructura REAL del backend
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

// Función para preparar datos de gráficos
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
  
  // Preparar datos de histograma de Weibull
  const weibullData = safeArray(analysis.weibull_analysis?.plot_data?.x_values.map((x, i) => ({
    speed_bin: x,
    frequency: analysis.weibull_analysis.plot_data.y_values[i]
  })));
  
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
    analysis: null,
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
        era5Data: era5Data
      });
      console.log('Final analysisData state after setting:', {
        analysis: normalizedAnalysis,
        location: {
          bounds: selectedArea,
          center: [
            (selectedArea[0][0] + selectedArea[1][0]) / 2,
            (selectedArea[0][1] + selectedArea[1][1]) / 2
          ]
        },
        era5Data: era5Data
      }); // Added log

      setActiveTab('results');
      console.log('Analysis completed successfully. Navigating to results tab.');

    } catch (err) {
      console.error('Error during analysis:', err);
      setError(err.message || 'Error al realizar el análisis. Inténtalo de nuevo.');
    } finally {
      setLoading(false);
      console.log('Analysis process finished. Loading set to false.');
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center p-4">
      <Card className="w-full max-w-6xl shadow-lg">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-2xl font-bold">Análisis de Recurso Eólico</CardTitle>
          <Wind className="h-8 w-8 text-blue-600" />
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="map">Selección de Área</TabsTrigger>
              <TabsTrigger value="config">Configuración</TabsTrigger>
              <TabsTrigger value="results">Resultados</TabsTrigger>
            </TabsList>
            <TabsContent value="map" className="mt-4">
              <div className="h-[500px] w-full rounded-md overflow-hidden relative">
                <MapContainer
                  center={caribbeanBounds.center ? [caribbeanBounds.center.lat, caribbeanBounds.center.lon] : [10.46, -73.26]}
                  zoom={caribbeanBounds.center ? 6 : 7}
                  scrollWheelZoom={true}
                  className="h-full w-full"
                >
                  <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />
                  <MapSelector
                    onAreaSelect={handleAreaSelect}
                    selectedArea={selectedArea}
                    isSelecting={isMapSelecting}
                    setIsSelecting={setIsMapSelecting}
                  />
                </MapContainer>
                <Button
                  onClick={() => {
                    setIsMapSelecting(true);
                    console.log('Initiating map selection, isMapSelecting set to true');
                  }}
                  className="absolute top-2 left-2 z-[1000]"
                >
                  <MapPin className="mr-2 h-4 w-4" /> Iniciar Selección
                </Button>
                {selectedArea && (
                  <Button
                    onClick={handleClearSelection}
                    className="absolute top-2 left-40 z-[1000] bg-red-500 hover:bg-red-600"
                  >
                    <XCircle className="mr-2 h-4 w-4" /> Limpiar Selección
                  </Button>
                )}
              </div>
              {selectedArea && (
                <Alert className="mt-4">
                  <AlertDescription>
                    Área seleccionada: Latitudes {formatNumber(selectedArea[0][0])} a {formatNumber(selectedArea[1][0])}, Longitudes {formatNumber(selectedArea[0][1])} a {formatNumber(selectedArea[1][1])}.
                  </AlertDescription>
                </Alert>
              )}
              {error && (
                <Alert variant="destructive" className="mt-4">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
            </TabsContent>
            <TabsContent value="config" className="mt-4 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="startDate">Fecha de Inicio</Label>
                  <Input
                    id="startDate"
                    type="date"
                    value={dateRange.startDate}
                    onChange={(e) => setDateRange({ ...dateRange, startDate: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="endDate">Fecha Fin</Label>
                  <Input
                    id="endDate"
                    type="date"
                    value={dateRange.endDate}
                    onChange={(e) => setDateRange({ ...dateRange, endDate: e.target.value })}
                  />
                </div>
              </div>
              <Button onClick={handleAnalysis} disabled={loading || !selectedArea}>
                {loading ? 'Analizando...' : 'Iniciar Análisis Eólico'}
              </Button>
              {error && (
                <Alert variant="destructive" className="mt-4">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
            </TabsContent>
            <TabsContent value="results" className="mt-4 space-y-6">
              {loading && <Alert><AlertDescription>Cargando resultados...</AlertDescription></Alert>}
              {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}

              {analysisData.analysis && !loading && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Sección de Estadísticas Principales */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center"><BarChart3 className="mr-2" /> Estadísticas Principales</CardTitle>
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

                  {/* Sección de Viabilidad */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center"><TrendingUp className="mr-2" /> Análisis de Viabilidad</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <p><strong>Nivel de Viabilidad:</strong> <Badge>{extractViability(analysisData.analysis).level}</Badge></p>
                      <p><strong>Puntuación:</strong> {formatNumber(extractViability(analysisData.analysis).score)}</p>
                      <p><strong>Recomendación:</strong> {extractViability(analysisData.analysis).recommendation}</p>
                      {extractViability(analysisData.analysis).recommendations.length > 0 && (
                        <div>
                          <p><strong>Recomendaciones Adicionales:</strong></p>
                          <ul className="list-disc list-inside">
                            {extractViability(analysisData.analysis).recommendations.map((rec, index) => (
                              <li key={index}>{rec}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Gráficos */}
                  {prepareChartData(analysisData.analysis, analysisData.era5Data).timeSeries.length > 0 && (
                    <Card className="lg:col-span-2">
                      <CardHeader>
                        <CardTitle>Evolución Temporal del Viento (100m)</CardTitle>
                      </CardHeader>
                      <CardContent className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={prepareChartData(analysisData.analysis, analysisData.era5Data).timeSeries}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="time" tickFormatter={(tick) => new Date(tick).toLocaleDateString()} />
                            <YAxis label={{ value: 'Velocidad (m/s)', angle: -90, position: 'insideLeft' }} />
                            <Tooltip labelFormatter={(label) => new Date(label).toLocaleString()} />
                            <Line type="monotone" dataKey="speed" stroke="#8884d8" dot={false} />
                          </LineChart>
                        </ResponsiveContainer>
                      </CardContent>
                    </Card>
                  )}

                  {prepareChartData(analysisData.analysis, analysisData.era5Data).weibullHistogram.length > 0 && (
                    <Card>
                      <CardHeader>
                        <CardTitle>Histograma de Velocidad del Viento con Ajuste Weibull</CardTitle>
                      </CardHeader>
                      <CardContent className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={prepareChartData(analysisData.analysis, analysisData.era5Data).weibullHistogram}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="speed_bin" />
                            <YAxis label={{ value: 'Frecuencia', angle: -90, position: 'insideLeft' }} />
                            <Tooltip />
                            <Bar dataKey="frequency" fill="#82ca9d" />
                            <Line type="monotone" dataKey="weibull_pdf" stroke="#ff7300" dot={false} />
                          </BarChart>
                        </ResponsiveContainer>
                      </CardContent>
                    </Card>
                  )}

                  {prepareChartData(analysisData.analysis, analysisData.era5Data).windRose.length > 0 && (
                    <Card>
                      <CardHeader>
                        <CardTitle>Rosa de los Vientos</CardTitle>
                      </CardHeader>
                      <CardContent className="h-[300px]">
                        {/* La implementación de la rosa de los vientos con Recharts es compleja y puede requerir un componente personalizado o una librería externa. */}
                        <p className="text-center text-gray-500">Gráfico de Rosa de los Vientos no implementado con Recharts directamente. Se requiere un componente personalizado.</p>
                      </CardContent>
                    </Card>
                  )}

                  {prepareChartData(analysisData.analysis, analysisData.era5Data).hourlyPatterns.length > 0 && (
                    <Card>
                      <CardHeader>
                        <CardTitle>Patrones Horarios de Velocidad del Viento</CardTitle>
                      </CardHeader>
                      <CardContent className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={prepareChartData(analysisData.analysis, analysisData.era5Data).hourlyPatterns}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="hour" />
                            <YAxis label={{ value: 'Velocidad Media (m/s)', angle: -90, position: 'insideLeft' }} />
                            <Tooltip />
                            <Line type="monotone" dataKey="speed" stroke="#8884d8" />
                          </LineChart>
                        </ResponsiveContainer>
                      </CardContent>
                    </Card>
                  )}

                  {/* Botones de Exportación */}
                  <div className="lg:col-span-2 flex justify-end space-x-4">
                    <Button disabled><Download className="mr-2 h-4 w-4" /> Exportar CSV</Button>
                    <Button disabled><Download className="mr-2 h-4 w-4" /> Exportar PDF</Button>
                  </div>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}

export default App;





