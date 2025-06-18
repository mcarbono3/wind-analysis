import React, { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Rectangle, useMapEvents, useMap } from 'react-leaflet';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Wind, MapPin, Calendar, Download, BarChart3, TrendingUp, XCircle, ArrowLeft, Settings, Play, AlertTriangle } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell } from 'recharts';
import axios from 'axios';
import 'leaflet/dist/leaflet.css';

// Importar Leaflet
import L from 'leaflet';

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

const AnalysisPage = ({ onBackToLanding }) => {
  // Estados existentes del App.jsx original
  const [selectedArea, setSelectedArea] = useState(null);
  const [isSelecting, setIsSelecting] = useState(false);
  const [startDate, setStartDate] = useState('2023-01-01');
  const [endDate, setEndDate] = useState('2023-01-31');
  const [analysisData, setAnalysisData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [heatmapLayer, setHeatmapLayer] = useState(null);
  const [selectedVariable, setSelectedVariable] = useState('wind_speed');
  const [selectedUnit, setSelectedUnit] = useState('m/s');
  const [currentStep, setCurrentStep] = useState(1);

  const mapRef = useRef();

  // Componente para manejar la selección del área
  const AreaSelector = () => {
    useMapEvents({
      click(e) {
        if (isSelecting) {
          if (!selectedArea) {
            setSelectedArea({
              start: [e.latlng.lat, e.latlng.lng],
              end: null
            });
          } else if (!selectedArea.end) {
            setSelectedArea({
              ...selectedArea,
              end: [e.latlng.lat, e.latlng.lng]
            });
            setIsSelecting(false);
          }
        }
      }
    });
    return null;
  };

  // Función para obtener datos ERA5
  const fetchERA5Data = async () => {
    if (!selectedArea?.end) {
      setError('Por favor selecciona un área completa');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await axios.post(`${API_BASE_URL}/era5-data`, {
        north: Math.max(selectedArea.start[0], selectedArea.end[0]),
        south: Math.min(selectedArea.start[0], selectedArea.end[0]),
        east: Math.max(selectedArea.start[1], selectedArea.end[1]),
        west: Math.min(selectedArea.start[1], selectedArea.end[1]),
        start_date: startDate,
        end_date: endDate,
        variables: [selectedVariable]
      });

      setAnalysisData(response.data);
      setCurrentStep(3);
    } catch (err) {
      setError('Error al obtener datos ERA5: ' + (err.response?.data?.detail || err.message));
    } finally {
      setLoading(false);
    }
  };

  // Función para realizar análisis
  const performAnalysis = async () => {
    if (!analysisData) return;
    
    setLoading(true);
    try {
      const response = await axios.post(`${API_BASE_URL}/analyze`, {
        data: analysisData,
        variable: selectedVariable
      });
      
      setAnalysisData(prev => ({
        ...prev,
        analysis: response.data
      }));
    } catch (err) {
      setError('Error en el análisis: ' + (err.response?.data?.detail || err.message));
    } finally {
      setLoading(false);
    }
  };

  const resetSelection = () => {
    setSelectedArea(null);
    setIsSelecting(false);
    setCurrentStep(1);
    setAnalysisData(null);
    setError(null);
  };

  const variableOptions = [
    { value: 'wind_speed', label: 'Velocidad del Viento', units: ['m/s', 'km/h', 'mph'] },
    { value: 'temperature', label: 'Temperatura', units: ['°C', '°F', 'K'] },
    { value: 'pressure', label: 'Presión Atmosférica', units: ['hPa', 'Pa', 'mmHg'] }
  ];

  const currentVariable = variableOptions.find(v => v.value === selectedVariable);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={onBackToLanding}
                className="text-gray-600 hover:text-gray-900"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Volver al Inicio
              </Button>
              <div className="h-6 w-px bg-gray-300"></div>
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-blue-600 rounded-lg">
                  <Wind className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h1 className="text-lg font-semibold text-gray-900">Análisis de Recurso Eólico</h1>
                  <p className="text-sm text-gray-600">Norte de Colombia</p>
                </div>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <Select value={selectedUnit} onValueChange={setSelectedUnit}>
                <SelectTrigger className="w-24">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {currentVariable?.units.map(unit => (
                    <SelectItem key={unit} value={unit}>{unit}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Badge variant="outline" className="text-xs">
                Powered by ERA5
              </Badge>
            </div>
          </div>
        </div>
      </header>

      <div className="flex h-[calc(100vh-80px)]">
        {/* Panel Lateral Izquierdo */}
        <div className="w-80 bg-white border-r border-gray-200 flex flex-col">
          {/* Selección de Área */}
          <div className="p-6 border-b border-gray-100">
            <div className="flex items-center space-x-2 mb-4">
              <MapPin className="w-5 h-5 text-blue-600" />
              <h2 className="text-lg font-semibold text-gray-900">Selección de Área</h2>
            </div>
            
            <div className="space-y-4">
              <p className="text-sm text-gray-600">
                Haz clic en el mapa para seleccionar el área de análisis. La capa de calor muestra la velocidad promedio del viento.
              </p>
              
              {selectedArea && (
                <div className="p-3 bg-blue-50 rounded-lg">
                  <p className="text-xs text-blue-800 font-medium mb-1">Área Seleccionada:</p>
                  <p className="text-xs text-blue-700">
                    Inicio: {selectedArea.start[0].toFixed(4)}, {selectedArea.start[1].toFixed(4)}
                  </p>
                  {selectedArea.end && (
                    <p className="text-xs text-blue-700">
                      Fin: {selectedArea.end[0].toFixed(4)}, {selectedArea.end[1].toFixed(4)}
                    </p>
                  )}
                </div>
              )}

              {!selectedArea?.end && (
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription className="text-xs">
                    Usando datos simulados para la capa de calor: Network Error
                  </AlertDescription>
                </Alert>
              )}

              <div className="flex space-x-2">
                <Button
                  onClick={() => setIsSelecting(!isSelecting)}
                  variant={isSelecting ? "destructive" : "default"}
                  size="sm"
                  className="flex-1"
                >
                  {isSelecting ? "Cancelar" : "Iniciar Selección"}
                </Button>
                {selectedArea && (
                  <Button
                    onClick={resetSelection}
                    variant="outline"
                    size="sm"
                  >
                    <XCircle className="w-4 h-4" />
                  </Button>
                )}
              </div>
            </div>
          </div>

          {/* Período de Análisis */}
          <div className="p-6 border-b border-gray-100">
            <div className="flex items-center space-x-2 mb-4">
              <Calendar className="w-5 h-5 text-green-600" />
              <h2 className="text-lg font-semibold text-gray-900">Período de Análisis</h2>
            </div>
            
            <div className="space-y-4">
              <div>
                <Label htmlFor="start-date" className="text-sm font-medium text-gray-700">
                  Fecha de inicio
                </Label>
                <Input
                  id="start-date"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="mt-1"
                />
              </div>
              
              <div>
                <Label htmlFor="end-date" className="text-sm font-medium text-gray-700">
                  Fecha de fin
                </Label>
                <Input
                  id="end-date"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="mt-1"
                />
              </div>
            </div>
          </div>

          {/* Variables y Configuración */}
          <div className="p-6 border-b border-gray-100">
            <div className="flex items-center space-x-2 mb-4">
              <Settings className="w-5 h-5 text-purple-600" />
              <h2 className="text-lg font-semibold text-gray-900">Variables</h2>
            </div>
            
            <div className="space-y-4">
              <div>
                <Label className="text-sm font-medium text-gray-700">
                  Variable de análisis
                </Label>
                <Select value={selectedVariable} onValueChange={setSelectedVariable}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {variableOptions.map(variable => (
                      <SelectItem key={variable.value} value={variable.value}>
                        {variable.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label className="text-sm font-medium text-gray-700">
                  Unidad de medida
                </Label>
                <Select value={selectedUnit} onValueChange={setSelectedUnit}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {currentVariable?.units.map(unit => (
                      <SelectItem key={unit} value={unit}>{unit}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Acciones */}
          <div className="p-6 flex-1 flex flex-col justify-end">
            <div className="space-y-3">
              <Button
                onClick={fetchERA5Data}
                disabled={!selectedArea?.end || loading}
                className="w-full bg-gray-600 hover:bg-gray-700"
              >
                {loading ? "Obteniendo..." : "Obtener Datos ERA5"}
              </Button>
              
              <Button
                onClick={performAnalysis}
                disabled={!analysisData || loading}
                variant="outline"
                className="w-full"
              >
                <Play className="w-4 h-4 mr-2" />
                Realizar Análisis
              </Button>
            </div>
          </div>
        </div>

        {/* Área Principal - Mapa */}
        <div className="flex-1 relative">
          <div className="absolute inset-0">
            <div className="h-full w-full">
              <div className="p-4 bg-white border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900">Mapa Interactivo</h3>
              </div>
              
              <div className="h-[calc(100%-60px)] relative">
                <MapContainer
                  center={[10.5, -74.5]}
                  zoom={7}
                  className="h-full w-full"
                  ref={mapRef}
                >
                  <TileLayer
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                  />
                  
                  <AreaSelector />
                  
                  {selectedArea && selectedArea.end && (
                    <Rectangle
                      bounds={[selectedArea.start, selectedArea.end]}
                      pathOptions={{ color: 'red', weight: 2, fillOpacity: 0.1 }}
                    />
                  )}
                </MapContainer>

                {/* Leyenda del Mapa */}
                <div className="absolute bottom-4 left-4 bg-white p-4 rounded-lg shadow-lg border border-gray-200">
                  <h4 className="text-sm font-semibold text-gray-900 mb-2">
                    Leyenda - Velocidad del Viento (m/s):
                  </h4>
                  <div className="flex items-center space-x-4 text-xs">
                    <div className="flex items-center space-x-1">
                      <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                      <span>0-3</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                      <span>3-6</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                      <span>6-9</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <div className="w-3 h-3 bg-orange-500 rounded-full"></div>
                      <span>9-12</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                      <span>>12</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="fixed bottom-4 right-4 max-w-md">
          <Alert variant="destructive">
            <XCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        </div>
      )}
    </div>
  );
};

export default AnalysisPage;

