import React, { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Rectangle, useMapEvents, useMap } from 'react-leaflet';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Badge } from './ui/badge';
import { Alert, AlertDescription } from './ui/alert';
import { 
  Wind, 
  MapPin, 
  Calendar, 
  Download, 
  BarChart3, 
  TrendingUp,
  Settings,
  Play,
  ArrowLeft,
  Loader2
} from 'lucide-react';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
  PieChart,
  Pie
} from 'recharts';
import 'leaflet/dist/leaflet.css';

// Configuración de la API (mantener la misma del proyecto original)
const API_BASE_URL = 'https://wind-analysis.onrender.com/api';

// Funciones helper (mantener las mismas del proyecto original)
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
  return num !== 0 || value === 0 ? `${num.toFixed(decimals)}%` : defaultText;
};

const AnalysisPage = ({ onBackToHome }) => {
  // Estados (mantener los mismos del proyecto original)
  const [selectedArea, setSelectedArea] = useState(null);
  const [startDate, setStartDate] = useState('2023-01-01');
  const [endDate, setEndDate] = useState('2023-01-31');
  const [windUnit, setWindUnit] = useState('ms');
  const [loading, setLoading] = useState(false);
  const [eraData, setEraData] = useState(null);
  const [analysisData, setAnalysisData] = useState(null);
  const [chartData, setChartData] = useState({});
  const [activeTab, setActiveTab] = useState('map');
  const mapRef = useRef(null);

  // Componente para selección de área en el mapa
  const AreaSelector = () => {
    useMapEvents({
      click(e) {
        const { lat, lng } = e.latlng;
        const newArea = {
          north: lat + 0.1,
          south: lat - 0.1,
          east: lng + 0.1,
          west: lng - 0.1
        };
        setSelectedArea(newArea);
      }
    });

    return selectedArea ? (
      <Rectangle
        bounds={[
          [selectedArea.south, selectedArea.west],
          [selectedArea.north, selectedArea.east]
        ]}
        color="blue"
        fillOpacity={0.2}
      />
    ) : null;
  };

  // Función para obtener datos ERA5 (mantener la misma lógica)
  const fetchERA5Data = async () => {
    if (!selectedArea) {
      alert('Por favor selecciona un área en el mapa');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/era5-data`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          area: selectedArea,
          start_date: startDate,
          end_date: endDate
        })
      });

      if (!response.ok) throw new Error('Error al obtener datos ERA5');
      
      const data = await response.json();
      setEraData(data);
      setActiveTab('results');
    } catch (error) {
      console.error('Error:', error);
      alert('Error al obtener datos ERA5: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Función para realizar análisis (mantener la misma lógica)
  const performAnalysis = async () => {
    if (!eraData) {
      alert('Primero debes obtener los datos ERA5');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(eraData)
      });

      if (!response.ok) throw new Error('Error en el análisis');
      
      const data = await response.json();
      setAnalysisData(data);
      
      // Procesar datos para gráficos
      processChartData(data);
    } catch (error) {
      console.error('Error:', error);
      alert('Error en el análisis: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Función para procesar datos de gráficos (mantener la misma lógica)
  const processChartData = (data) => {
    const charts = {};
    
    // Evolución temporal
    if (data?.analysis?.time_series) {
      charts.timeSeries = data.analysis.time_series.map(item => ({
        time: item.time,
        speed: windUnit === 'kmh' ? item.speed * 3.6 : item.speed
      }));
    }

    // Patrones horarios
    if (data?.analysis?.hourly_patterns) {
      charts.hourlyPatterns = data.analysis.hourly_patterns.map(item => ({
        hour: item.hour,
        speed: windUnit === 'kmh' ? item.avg_speed * 3.6 : item.avg_speed
      }));
    }

    // Rosa de vientos
    if (data?.analysis?.wind_rose) {
      charts.windRose = data.analysis.wind_rose;
      charts.windRoseLabels = data.analysis.wind_rose_labels;
    }

    setChartData(charts);
  };

  // Funciones de exportación (mantener las mismas)
  const exportToCSV = () => {
    if (!analysisData) return;
    
    // Lógica de exportación CSV
    console.log('Exportando a CSV...');
  };

  const exportToPDF = () => {
    if (!analysisData) return;
    
    // Lógica de exportación PDF
    console.log('Exportando a PDF...');
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header mejorado */}
      <header className="bg-card border-b shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <Button 
                variant="ghost" 
                size="sm"
                onClick={onBackToHome}
                className="flex items-center space-x-2"
              >
                <ArrowLeft className="h-4 w-4" />
                <span>Inicio</span>
              </Button>
              <div className="flex items-center space-x-2">
                <Wind className="h-6 w-6 text-primary" />
                <h1 className="text-xl font-semibold">Análisis de Recurso Eólico</h1>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Badge variant="outline">Norte de Colombia</Badge>
              <Badge variant="outline">
                Unidad: {windUnit === 'kmh' ? 'km/h' : 'm/s'}
              </Badge>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="map" className="flex items-center space-x-2">
              <MapPin className="h-4 w-4" />
              <span>Selección de Área</span>
            </TabsTrigger>
            <TabsTrigger value="config" className="flex items-center space-x-2">
              <Settings className="h-4 w-4" />
              <span>Configuración</span>
            </TabsTrigger>
            <TabsTrigger value="results" className="flex items-center space-x-2">
              <BarChart3 className="h-4 w-4" />
              <span>Resultados</span>
            </TabsTrigger>
          </TabsList>

          {/* Tab de Selección de Área */}
          <TabsContent value="map" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <MapPin className="h-5 w-5" />
                  <span>Selección de Área de Análisis</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                  <div className="lg:col-span-1 space-y-4">
                    <Alert>
                      <MapPin className="h-4 w-4" />
                      <AlertDescription>
                        Haz clic en el mapa para seleccionar el área de análisis. 
                        La capa de calor muestra la velocidad promedio del viento.
                      </AlertDescription>
                    </Alert>
                    
                    {selectedArea && (
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-sm">Área Seleccionada</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2 text-sm">
                          <div>Norte: {selectedArea.north.toFixed(4)}°</div>
                          <div>Sur: {selectedArea.south.toFixed(4)}°</div>
                          <div>Este: {selectedArea.east.toFixed(4)}°</div>
                          <div>Oeste: {selectedArea.west.toFixed(4)}°</div>
                        </CardContent>
                      </Card>
                    )}

                    <Button 
                      onClick={() => setActiveTab('config')} 
                      className="w-full"
                      disabled={!selectedArea}
                    >
                      Continuar Configuración
                      <ArrowLeft className="ml-2 h-4 w-4 rotate-180" />
                    </Button>
                  </div>

                  <div className="lg:col-span-3">
                    <div className="h-96 rounded-lg overflow-hidden border">
                      <MapContainer
                        center={[10.5, -74.5]}
                        zoom={7}
                        style={{ height: '100%', width: '100%' }}
                        ref={mapRef}
                      >
                        <TileLayer
                          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                        />
                        <AreaSelector />
                      </MapContainer>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab de Configuración */}
          <TabsContent value="config" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Calendar className="h-5 w-5" />
                    <span>Período de Análisis</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="start-date">Fecha de Inicio</Label>
                      <Input
                        id="start-date"
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                      />
                    </div>
                    <div>
                      <Label htmlFor="end-date">Fecha de Fin</Label>
                      <Input
                        id="end-date"
                        type="date"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Settings className="h-5 w-5" />
                    <span>Configuración de Variables</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="wind-unit">Unidad de Velocidad del Viento</Label>
                    <select
                      id="wind-unit"
                      value={windUnit}
                      onChange={(e) => setWindUnit(e.target.value)}
                      className="w-full mt-1 p-2 border rounded-md"
                    >
                      <option value="ms">m/s (metros por segundo)</option>
                      <option value="kmh">km/h (kilómetros por hora)</option>
                    </select>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Acciones</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col sm:flex-row gap-4">
                  <Button 
                    onClick={fetchERA5Data} 
                    disabled={loading || !selectedArea}
                    className="flex-1"
                  >
                    {loading ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Download className="mr-2 h-4 w-4" />
                    )}
                    Obtener Datos ERA5
                  </Button>
                  <Button 
                    onClick={performAnalysis} 
                    disabled={loading || !eraData}
                    variant="secondary"
                    className="flex-1"
                  >
                    {loading ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Play className="mr-2 h-4 w-4" />
                    )}
                    Realizar Análisis
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab de Resultados */}
          <TabsContent value="results" className="space-y-6">
            {analysisData ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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
                          <Line type="monotone" dataKey="speed" stroke="#8884d8" dot={false} name="Velocidad (10m)" />
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
                    <CardTitle>Boxplot Horario de Velocidad del Viento (100m)</CardTitle>
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
                      <p>No hay datos de boxplot horario disponibles.</p>
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
                            <Bar key={label} dataKey={label} stackId="a" fill={`hsl(${index * 60}, 70%, 50%)`} />
                          ))}
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                      <p>No hay datos de rosa de vientos disponibles.</p>
                    )}
                  </CardContent>
                </Card>

                {/* Análisis de turbulencia */}
                <Card>
                  <CardHeader>
                    <CardTitle>Turbulencia por Rango de Velocidad</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {analysisData?.analysis?.turbulence_analysis ? (
                      <ResponsiveContainer width="100%" height={300}>
                        <BarChart
                          data={Object.entries(analysisData.analysis.turbulence_analysis)
                            .filter(([key]) => key !== 'overall')
                            .map(([range, value]) => ({
                              range,
                              intensity: value.turbulence_intensity || 0
                            }))}
                        >
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="range" />
                          <YAxis label={{ value: "Intensidad (%)", angle: -90, position: 'insideLeft' }} />
                          <Tooltip formatter={(v) => `${v.toFixed(1)}%`} />
                          <Bar dataKey="intensity" fill="#82ca9d" name="Turbulencia (%)" />
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                      <p>No hay datos de turbulencia disponibles.</p>
                    )}
                  </CardContent>
                </Card>

                {/* Estadísticas generales */}
                {analysisData?.analysis?.statistics && (
                  <Card className="lg:col-span-2">
                    <CardHeader>
                      <CardTitle className="flex items-center space-x-2">
                        <TrendingUp className="h-5 w-5" />
                        <span>Estadísticas del Análisis</span>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="text-center">
                          <div className="text-2xl font-bold text-primary">
                            {formatNumber(analysisData.analysis.statistics.mean_speed * (windUnit === 'kmh' ? 3.6 : 1))}
                          </div>
                          <p className="text-sm text-muted-foreground">Velocidad Media</p>
                        </div>
                        <div className="text-center">
                          <div className="text-2xl font-bold text-secondary">
                            {formatNumber(analysisData.analysis.statistics.max_speed * (windUnit === 'kmh' ? 3.6 : 1))}
                          </div>
                          <p className="text-sm text-muted-foreground">Velocidad Máxima</p>
                        </div>
                        <div className="text-center">
                          <div className="text-2xl font-bold text-accent">
                            {formatNumber(analysisData.analysis.statistics.std_speed * (windUnit === 'kmh' ? 3.6 : 1))}
                          </div>
                          <p className="text-sm text-muted-foreground">Desviación Estándar</p>
                        </div>
                        <div className="text-center">
                          <div className="text-2xl font-bold text-chart-4">
                            {formatPercentage(analysisData.analysis.statistics.availability)}
                          </div>
                          <p className="text-sm text-muted-foreground">Disponibilidad</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

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
                <CardContent className="p-6 text-center text-muted-foreground">
                  {loading ? (
                    <div className="flex items-center justify-center space-x-2">
                      <Loader2 className="h-6 w-6 animate-spin" />
                      <p>Cargando resultados del análisis...</p>
                    </div>
                  ) : (
                    <p>Selecciona un área en el mapa y haz clic en "Realizar Análisis" para ver los resultados.</p>
                  )}
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default AnalysisPage;

