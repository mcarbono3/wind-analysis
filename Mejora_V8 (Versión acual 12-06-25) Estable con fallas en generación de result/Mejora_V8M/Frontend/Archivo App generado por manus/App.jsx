import React, { useState, useEffect, useRef } from 'react';
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

// Función para extraer estadísticas de la estructura REAL del backend - PROBADO Y FUNCIONA
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
    if (!analysis || !era5Data) return {
        timeSeries: [],
        weibullHistogram: [],
        windRose: [],
        hourlyPatterns: []
    };

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

    console.log('Prepared chart data:', {
        timeSeries: timeSeriesData.length,
        weibull: weibullData.length,
        windRose: windRoseData.length,
        hourly: hourlyData.length
    });

    return {
        timeSeries: timeSeriesData,
        weibullHistogram: weibullData,
        windRose: windRoseData,
        windRoseLabels: windRoseLabels,
        hourlyPatterns: hourlyData
    };
};

// Componente principal de la aplicación
function App() {
    // Estados principales
    const [selectedArea, setSelectedArea] = useState(null);
    const [era5Data, setEra5Data] = useState(null);
    const [analysis, setAnalysis] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [unit, setUnit] = useState('kmh');
    
    // Estados para el heatmap de viento promedio
    const [windHeatmapData, setWindHeatmapData] = useState([]);
    const [heatmapLoading, setHeatmapLoading] = useState(true);
    const [heatmapError, setHeatmapError] = useState(null);

    // Estados para formularios
    const [startDate, setStartDate] = useState('2023-01-01');
    const [endDate, setEndDate] = useState('2023-01-31');

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

    // Componente para selección de área en el mapa
    function AreaSelector() {
        const [isSelecting, setIsSelecting] = useState(false);
        const [startPoint, setStartPoint] = useState(null);

        useMapEvents({
            click(e) {
                if (!isSelecting) {
                    setIsSelecting(true);
                    setStartPoint(e.latlng);
                } else {
                    const bounds = L.latLngBounds(startPoint, e.latlng);
                    setSelectedArea({
                        lat_min: bounds.getSouth(),
                        lat_max: bounds.getNorth(),
                        lon_min: bounds.getWest(),
                        lon_max: bounds.getEast()
                    });
                    setIsSelecting(false);
                    setStartPoint(null);
                }
            }
        });

        return null;
    }

    // Función para obtener datos de ERA5
    const fetchERA5Data = async () => {
        if (!selectedArea) {
            setError('Por favor selecciona un área en el mapa');
            return;
        }

        setLoading(true);
        setError(null);

        try {
            console.log('🚀 Solicitando datos ERA5...', selectedArea);

            const requestData = {
                ...selectedArea,
                start_date: startDate,
                end_date: endDate
            };

            const response = await axios.post(`${API_BASE_URL}/wind-data`, requestData);
            
            console.log('✅ Datos ERA5 recibidos:', response.data);
            setEra5Data(response.data);

        } catch (err) {
            console.error('❌ Error obteniendo datos ERA5:', err);
            setError(err.response?.data?.details || err.message || 'Error desconocido');
        } finally {
            setLoading(false);
        }
    };

    // Función para realizar análisis
    const performAnalysis = async () => {
        if (!era5Data) {
            setError('Primero debes obtener datos ERA5');
            return;
        }

        setLoading(true);
        setError(null);

        try {
            console.log('🔬 Iniciando análisis...');

            const response = await axios.post(`${API_BASE_URL}/analyze`, {
                era5_data: era5Data,
                analysis_type: 'complete'
            });

            console.log('✅ Análisis completado:', response.data);
            setAnalysis(normalizeAnalysisData(response.data));

        } catch (err) {
            console.error('❌ Error en análisis:', err);
            setError(err.response?.data?.details || err.message || 'Error en análisis');
        } finally {
            setLoading(false);
        }
    };

    // Función para exportar a Excel
    const exportToExcel = () => {
        if (!era5Data || !analysis) return;

        const statistics = extractStatistics(analysis, unit);
        const viability = extractViability(analysis);

        const workbook = XLSXUtils.book_new();

        // Hoja de estadísticas
        const statsData = Object.entries(statistics).map(([key, value]) => ({
            Parámetro: key.replace(/_/g, ' ').toUpperCase(),
            Valor: value,
            Unidad: key.includes('speed') ? (unit === 'kmh' ? 'km/h' : 'm/s') : 
                    key.includes('factor') ? '%' : 
                    key.includes('density') ? 'W/m²' : '-'
        }));

        const statsSheet = XLSXUtils.json_to_sheet(statsData);
        XLSXUtils.book_append_sheet(workbook, statsSheet, 'Estadísticas');

        // Hoja de viabilidad
        const viabilityData = [
            { Aspecto: 'Nivel de Viabilidad', Valor: viability.level },
            { Aspecto: 'Puntuación', Valor: viability.score },
            { Aspecto: 'Mensaje', Valor: viability.message },
            ...viability.recommendations.map((rec, idx) => ({
                Aspecto: `Recomendación ${idx + 1}`,
                Valor: rec
            }))
        ];

        const viabilitySheet = XLSXUtils.json_to_sheet(viabilityData);
        XLSXUtils.book_append_sheet(workbook, viabilitySheet, 'Viabilidad');

        XLSXWriteFile(workbook, `analisis_eolico_${new Date().toISOString().split('T')[0]}.xlsx`);
    };

    // Función para exportar a PDF
    const exportToPDF = () => {
        if (!era5Data || !analysis) return;

        const doc = new jsPDF();
        const statistics = extractStatistics(analysis, unit);
        const viability = extractViability(analysis);

        // Título
        doc.setFontSize(20);
        doc.text('Análisis de Recurso Eólico', 20, 30);

        // Información del área
        doc.setFontSize(12);
        doc.text(`Área analizada: ${selectedArea?.lat_min?.toFixed(3)}, ${selectedArea?.lon_min?.toFixed(3)} - ${selectedArea?.lat_max?.toFixed(3)}, ${selectedArea?.lon_max?.toFixed(3)}`, 20, 50);
        doc.text(`Período: ${startDate} - ${endDate}`, 20, 60);

        // Estadísticas principales
        doc.setFontSize(14);
        doc.text('Estadísticas Principales', 20, 80);

        const statsTable = Object.entries(statistics).map(([key, value]) => [
            key.replace(/_/g, ' ').toUpperCase(),
            typeof value === 'number' ? value.toFixed(2) : value,
            key.includes('speed') ? (unit === 'kmh' ? 'km/h' : 'm/s') : 
            key.includes('factor') ? '%' : 
            key.includes('density') ? 'W/m²' : '-'
        ]);

        doc.autoTable({
            head: [['Parámetro', 'Valor', 'Unidad']],
            body: statsTable,
            startY: 90,
            styles: { fontSize: 8 }
        });

        // Viabilidad
        const finalY = doc.lastAutoTable.finalY + 20;
        doc.setFontSize(14);
        doc.text('Evaluación de Viabilidad', 20, finalY);

        doc.setFontSize(10);
        doc.text(`Nivel: ${viability.level}`, 20, finalY + 15);
        doc.text(`Puntuación: ${viability.score}`, 20, finalY + 25);
        doc.text(`Mensaje: ${viability.message}`, 20, finalY + 35);

        doc.save(`analisis_eolico_${new Date().toISOString().split('T')[0]}.pdf`);
    };

    // Preparar datos para gráficos
    const chartData = analysis && era5Data ? prepareChartData(analysis, era5Data, unit) : {
        timeSeries: [],
        weibullHistogram: [],
        windRose: [],
        hourlyPatterns: []
    };

    const statistics = analysis ? extractStatistics(analysis, unit) : {};
    const viability = analysis ? extractViability(analysis) : {};

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <header className="bg-white shadow-sm border-b">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between items-center py-4">
                        <div className="flex items-center space-x-3">
                            <Wind className="h-8 w-8 text-blue-600" />
                            <h1 className="text-2xl font-bold text-gray-900">
                                Análisis de Recurso Eólico
                            </h1>
                        </div>
                        <div className="flex items-center space-x-4">
                            <Badge variant="outline" className="text-sm">
                                Norte de Colombia
                            </Badge>
                            <div className="flex items-center space-x-2">
                                <Label htmlFor="unit-toggle" className="text-sm">Unidad:</Label>
                                <select
                                    id="unit-toggle"
                                    value={unit}
                                    onChange={(e) => setUnit(e.target.value)}
                                    className="text-sm border rounded px-2 py-1"
                                >
                                    <option value="ms">m/s</option>
                                    <option value="kmh">km/h</option>
                                </select>
                            </div>
                        </div>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    
                    {/* Panel de Control */}
                    <div className="lg:col-span-1 space-y-6">
                        
                        {/* Selección de Área */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center space-x-2">
                                    <MapPin className="h-5 w-5" />
                                    <span>Selección de Área</span>
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <p className="text-sm text-gray-600">
                                    Haz clic en el mapa para seleccionar el área de análisis.
                                    La capa de calor muestra la velocidad promedio del viento.
                                </p>
                                
                                {selectedArea && (
                                    <div className="bg-blue-50 p-3 rounded-lg">
                                        <p className="text-sm font-medium">Área seleccionada:</p>
                                        <p className="text-xs text-gray-600">
                                            Lat: {selectedArea.lat_min.toFixed(3)} - {selectedArea.lat_max.toFixed(3)}
                                        </p>
                                        <p className="text-xs text-gray-600">
                                            Lon: {selectedArea.lon_min.toFixed(3)} - {selectedArea.lon_max.toFixed(3)}
                                        </p>
                                    </div>
                                )}

                                {heatmapError && (
                                    <Alert>
                                        <AlertDescription>
                                            ⚠️ Usando datos simulados para la capa de calor: {heatmapError}
                                        </AlertDescription>
                                    </Alert>
                                )}
                            </CardContent>
                        </Card>

                        {/* Configuración de Fechas */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center space-x-2">
                                    <Calendar className="h-5 w-5" />
                                    <span>Período de Análisis</span>
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div>
                                    <Label htmlFor="start-date">Fecha de inicio</Label>
                                    <Input
                                        id="start-date"
                                        type="date"
                                        value={startDate}
                                        onChange={(e) => setStartDate(e.target.value)}
                                    />
                                </div>
                                <div>
                                    <Label htmlFor="end-date">Fecha de fin</Label>
                                    <Input
                                        id="end-date"
                                        type="date"
                                        value={endDate}
                                        onChange={(e) => setEndDate(e.target.value)}
                                    />
                                </div>
                            </CardContent>
                        </Card>

                        {/* Acciones */}
                        <Card>
                            <CardHeader>
                                <CardTitle>Acciones</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                <Button 
                                    onClick={fetchERA5Data}
                                    disabled={!selectedArea || loading}
                                    className="w-full"
                                >
                                    {loading ? 'Obteniendo datos...' : 'Obtener Datos ERA5'}
                                </Button>
                                
                                <Button 
                                    onClick={performAnalysis}
                                    disabled={!era5Data || loading}
                                    variant="outline"
                                    className="w-full"
                                >
                                    {loading ? 'Analizando...' : 'Realizar Análisis'}
                                </Button>

                                {analysis && (
                                    <div className="flex space-x-2">
                                        <Button 
                                            onClick={exportToExcel}
                                            size="sm"
                                            variant="outline"
                                            className="flex-1"
                                        >
                                            <Download className="h-4 w-4 mr-1" />
                                            Excel
                                        </Button>
                                        <Button 
                                            onClick={exportToPDF}
                                            size="sm"
                                            variant="outline"
                                            className="flex-1"
                                        >
                                            <Download className="h-4 w-4 mr-1" />
                                            PDF
                                        </Button>
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        {/* Errores */}
                        {error && (
                            <Alert variant="destructive">
                                <XCircle className="h-4 w-4" />
                                <AlertDescription>{error}</AlertDescription>
                            </Alert>
                        )}
                    </div>

                    {/* Mapa y Resultados */}
                    <div className="lg:col-span-2 space-y-6">
                        
                        {/* Mapa */}
                        <Card>
                            <CardHeader>
                                <CardTitle>Mapa Interactivo</CardTitle>
                                {heatmapLoading && (
                                    <p className="text-sm text-gray-500">Cargando capa de viento promedio...</p>
                                )}
                            </CardHeader>
                            <CardContent>
                                <div className="h-96 rounded-lg overflow-hidden">
                                    <MapContainer
                                        center={[10.0, -74.0]}
                                        zoom={7}
                                        style={{ height: '100%', width: '100%' }}
                                    >
                                        <TileLayer
                                            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                                            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                                        />
                                        
                                        {/* Capa de heatmap de viento promedio */}
                                        {windHeatmapData.length > 0 && (
                                            <WindHeatmapLayer data={windHeatmapData} />
                                        )}
                                        
                                        <AreaSelector />
                                        
                                        {selectedArea && (
                                            <Rectangle
                                                bounds={[
                                                    [selectedArea.lat_min, selectedArea.lon_min],
                                                    [selectedArea.lat_max, selectedArea.lon_max]
                                                ]}
                                                color="red"
                                                weight={2}
                                                fillOpacity={0.1}
                                            />
                                        )}
                                    </MapContainer>
                                </div>
                                
                                {/* Leyenda del heatmap */}
                                <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                                    <p className="text-sm font-medium mb-2">Leyenda - Velocidad del Viento (m/s):</p>
                                    <div className="flex items-center space-x-4 text-xs">
                                        <div className="flex items-center space-x-1">
                                            <div className="w-3 h-3 bg-blue-500 rounded"></div>
                                            <span>0-3</span>
                                        </div>
                                        <div className="flex items-center space-x-1">
                                            <div className="w-3 h-3 bg-cyan-400 rounded"></div>
                                            <span>3-6</span>
                                        </div>
                                        <div className="flex items-center space-x-1">
                                            <div className="w-3 h-3 bg-green-400 rounded"></div>
                                            <span>6-9</span>
                                        </div>
                                        <div className="flex items-center space-x-1">
                                            <div className="w-3 h-3 bg-yellow-400 rounded"></div>
                                            <span>9-12</span>
                                        </div>
                                        <div className="flex items-center space-x-1">
                                            <div className="w-3 h-3 bg-red-500 rounded"></div>
                                            <span>>12</span>
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Resultados del Análisis */}
                        {analysis && (
                            <Tabs defaultValue="statistics" className="w-full">
                                <TabsList className="grid w-full grid-cols-4">
                                    <TabsTrigger value="statistics">Estadísticas</TabsTrigger>
                                    <TabsTrigger value="charts">Gráficos</TabsTrigger>
                                    <TabsTrigger value="viability">Viabilidad</TabsTrigger>
                                    <TabsTrigger value="data">Datos</TabsTrigger>
                                </TabsList>

                                {/* Tab de Estadísticas */}
                                <TabsContent value="statistics">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <Card>
                                            <CardHeader>
                                                <CardTitle className="text-lg">Viento a 10m</CardTitle>
                                            </CardHeader>
                                            <CardContent className="space-y-3">
                                                <div className="flex justify-between">
                                                    <span className="text-sm text-gray-600">Velocidad media:</span>
                                                    <span className="font-medium">
                                                        {formatNumber(statistics.mean_wind_speed_10m)} {unit === 'kmh' ? 'km/h' : 'm/s'}
                                                    </span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-sm text-gray-600">Velocidad máxima:</span>
                                                    <span className="font-medium">
                                                        {formatNumber(statistics.max_wind_speed_10m)} {unit === 'kmh' ? 'km/h' : 'm/s'}
                                                    </span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-sm text-gray-600">Desviación estándar:</span>
                                                    <span className="font-medium">
                                                        {formatNumber(statistics.std_wind_speed_10m)} {unit === 'kmh' ? 'km/h' : 'm/s'}
                                                    </span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-sm text-gray-600">Factor de capacidad:</span>
                                                    <span className="font-medium">
                                                        {formatPercentage(statistics.capacity_factor_10m)}
                                                    </span>
                                                </div>
                                            </CardContent>
                                        </Card>

                                        <Card>
                                            <CardHeader>
                                                <CardTitle className="text-lg">Viento a 100m</CardTitle>
                                            </CardHeader>
                                            <CardContent className="space-y-3">
                                                <div className="flex justify-between">
                                                    <span className="text-sm text-gray-600">Velocidad media:</span>
                                                    <span className="font-medium">
                                                        {formatNumber(statistics.mean_wind_speed_100m)} {unit === 'kmh' ? 'km/h' : 'm/s'}
                                                    </span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-sm text-gray-600">Velocidad máxima:</span>
                                                    <span className="font-medium">
                                                        {formatNumber(statistics.max_wind_speed_100m)} {unit === 'kmh' ? 'km/h' : 'm/s'}
                                                    </span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-sm text-gray-600">Desviación estándar:</span>
                                                    <span className="font-medium">
                                                        {formatNumber(statistics.std_wind_speed_100m)} {unit === 'kmh' ? 'km/h' : 'm/s'}
                                                    </span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-sm text-gray-600">Factor de capacidad:</span>
                                                    <span className="font-medium">
                                                        {formatPercentage(statistics.capacity_factor_100m)}
                                                    </span>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    </div>
                                </TabsContent>

                                {/* Tab de Gráficos */}
                                <TabsContent value="charts">
                                    <div className="space-y-6">
                                        {/* Serie Temporal */}
                                        <Card>
                                            <CardHeader>
                                                <CardTitle>Serie Temporal de Velocidad del Viento</CardTitle>
                                            </CardHeader>
                                            <CardContent>
                                                <div className="h-64">
                                                    <ResponsiveContainer width="100%" height="100%">
                                                        <LineChart data={chartData.timeSeries.slice(0, 100)}>
                                                            <CartesianGrid strokeDasharray="3 3" />
                                                            <XAxis 
                                                                dataKey="time" 
                                                                tickFormatter={(value) => new Date(value).toLocaleDateString()}
                                                            />
                                                            <YAxis label={{ value: `Velocidad (${unit === 'kmh' ? 'km/h' : 'm/s'})`, angle: -90, position: 'insideLeft' }} />
                                                            <Tooltip 
                                                                labelFormatter={(value) => new Date(value).toLocaleString()}
                                                                formatter={(value) => [`${value.toFixed(2)} ${unit === 'kmh' ? 'km/h' : 'm/s'}`, 'Velocidad']}
                                                            />
                                                            <Line 
                                                                type="monotone" 
                                                                dataKey="speed" 
                                                                stroke="#2563eb" 
                                                                strokeWidth={2}
                                                                dot={false}
                                                            />
                                                        </LineChart>
                                                    </ResponsiveContainer>
                                                </div>
                                            </CardContent>
                                        </Card>

                                        {/* Patrones Horarios */}
                                        <Card>
                                            <CardHeader>
                                                <CardTitle>Patrones Horarios</CardTitle>
                                            </CardHeader>
                                            <CardContent>
                                                <div className="h-64">
                                                    <ResponsiveContainer width="100%" height="100%">
                                                        <BarChart data={chartData.hourlyPatterns}>
                                                            <CartesianGrid strokeDasharray="3 3" />
                                                            <XAxis dataKey="hour" />
                                                            <YAxis label={{ value: `Velocidad (${unit === 'kmh' ? 'km/h' : 'm/s'})`, angle: -90, position: 'insideLeft' }} />
                                                            <Tooltip formatter={(value) => [`${value.toFixed(2)} ${unit === 'kmh' ? 'km/h' : 'm/s'}`, 'Velocidad Media']} />
                                                            <Bar dataKey="speed" fill="#3b82f6" />
                                                        </BarChart>
                                                    </ResponsiveContainer>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    </div>
                                </TabsContent>

                                {/* Tab de Viabilidad */}
                                <TabsContent value="viability">
                                    <Card>
                                        <CardHeader>
                                            <CardTitle className="flex items-center space-x-2">
                                                <TrendingUp className="h-5 w-5" />
                                                <span>Evaluación de Viabilidad</span>
                                            </CardTitle>
                                        </CardHeader>
                                        <CardContent className="space-y-4">
                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                                <div className="text-center p-4 bg-blue-50 rounded-lg">
                                                    <p className="text-sm text-gray-600">Nivel de Viabilidad</p>
                                                    <p className="text-lg font-bold text-blue-600">{viability.level}</p>
                                                </div>
                                                <div className="text-center p-4 bg-green-50 rounded-lg">
                                                    <p className="text-sm text-gray-600">Puntuación</p>
                                                    <p className="text-lg font-bold text-green-600">{viability.score}/100</p>
                                                </div>
                                                <div className="text-center p-4 bg-purple-50 rounded-lg">
                                                    <p className="text-sm text-gray-600">Estado</p>
                                                    <p className="text-lg font-bold text-purple-600">
                                                        {viability.score > 70 ? 'Excelente' : 
                                                         viability.score > 50 ? 'Bueno' : 
                                                         viability.score > 30 ? 'Regular' : 'Bajo'}
                                                    </p>
                                                </div>
                                            </div>

                                            <div className="bg-gray-50 p-4 rounded-lg">
                                                <h4 className="font-medium mb-2">Mensaje de Evaluación:</h4>
                                                <p className="text-sm text-gray-700">{viability.message}</p>
                                            </div>

                                            {viability.recommendations.length > 0 && (
                                                <div>
                                                    <h4 className="font-medium mb-2">Recomendaciones:</h4>
                                                    <ul className="space-y-2">
                                                        {viability.recommendations.map((rec, idx) => (
                                                            <li key={idx} className="flex items-start space-x-2">
                                                                <span className="text-blue-500 mt-1">•</span>
                                                                <span className="text-sm text-gray-700">{rec}</span>
                                                            </li>
                                                        ))}
                                                    </ul>
                                                </div>
                                            )}
                                        </CardContent>
                                    </Card>
                                </TabsContent>

                                {/* Tab de Datos */}
                                <TabsContent value="data">
                                    <Card>
                                        <CardHeader>
                                            <CardTitle className="flex items-center space-x-2">
                                                <BarChart3 className="h-5 w-5" />
                                                <span>Datos Técnicos</span>
                                            </CardTitle>
                                        </CardHeader>
                                        <CardContent>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                <div>
                                                    <h4 className="font-medium mb-3">Parámetros de Weibull</h4>
                                                    <div className="space-y-2 text-sm">
                                                        <div className="flex justify-between">
                                                            <span>Factor de forma (k) - 10m:</span>
                                                            <span>{formatNumber(statistics.weibull_k_10m)}</span>
                                                        </div>
                                                        <div className="flex justify-between">
                                                            <span>Factor de escala (c) - 10m:</span>
                                                            <span>{formatNumber(statistics.weibull_c_10m)} {unit === 'kmh' ? 'km/h' : 'm/s'}</span>
                                                        </div>
                                                        <div className="flex justify-between">
                                                            <span>Factor de forma (k) - 100m:</span>
                                                            <span>{formatNumber(statistics.weibull_k_100m)}</span>
                                                        </div>
                                                        <div className="flex justify-between">
                                                            <span>Factor de escala (c) - 100m:</span>
                                                            <span>{formatNumber(statistics.weibull_c_100m)} {unit === 'kmh' ? 'km/h' : 'm/s'}</span>
                                                        </div>
                                                    </div>
                                                </div>

                                                <div>
                                                    <h4 className="font-medium mb-3">Densidad de Potencia</h4>
                                                    <div className="space-y-2 text-sm">
                                                        <div className="flex justify-between">
                                                            <span>Densidad media - 10m:</span>
                                                            <span>{formatNumber(statistics.power_density_10m)} W/m²</span>
                                                        </div>
                                                        <div className="flex justify-between">
                                                            <span>Densidad media - 100m:</span>
                                                            <span>{formatNumber(statistics.power_density_100m)} W/m²</span>
                                                        </div>
                                                        <div className="flex justify-between">
                                                            <span>Intensidad de turbulencia - 10m:</span>
                                                            <span>{formatPercentage(statistics.turbulence_intensity_10m)}</span>
                                                        </div>
                                                        <div className="flex justify-between">
                                                            <span>Intensidad de turbulencia - 100m:</span>
                                                            <span>{formatPercentage(statistics.turbulence_intensity_100m)}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>
                                </TabsContent>
                            </Tabs>
                        )}
                    </div>
                </div>
            </main>
        </div>
    );
}

export default App;

