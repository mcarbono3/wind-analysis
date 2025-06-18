import React, { useState, useEffect } from 'react'
import { MapContainer, TileLayer, Rectangle, useMapEvents, useMap } from 'react-leaflet'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Wind, MapPin, Calendar, Download, BarChart3, TrendingUp, XCircle } from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell } from 'recharts'
import axios from 'axios'
import 'leaflet/dist/leaflet.css'
import './App.css'

// Configuración de la API
const API_BASE_URL = 'https://wind-analysis.onrender.com/api'

// Componente para manejar la selección en el mapa
function MapSelector({ onAreaSelect, selectedArea, isSelecting, setIsSelecting }) {
  const [startPoint, setStartPoint] = useState(null)
  const [currentBounds, setCurrentBounds] = useState(null) // Para mostrar el rectángulo mientras se arrastra
  const map = useMap()

  useEffect(() => {
    console.log('MapSelector useEffect - isSelecting:', isSelecting)
    if (isSelecting) {
      console.log('MapSelector: Disabling map interactions')
      map.dragging.disable()
      map.doubleClickZoom.disable()
      map.scrollWheelZoom.disable()
    } else {
      console.log('MapSelector: Enabling map interactions')
      map.dragging.enable()
      map.doubleClickZoom.enable()
      map.scrollWheelZoom.enable()
    }
  }, [isSelecting, map])

  useMapEvents({
    mousedown: (e) => {
      console.log('MapSelector mousedown event:', e.latlng, 'isSelecting:', isSelecting)
      if (isSelecting) {
        setStartPoint([e.latlng.lat, e.latlng.lng])
        setCurrentBounds([[e.latlng.lat, e.latlng.lng], [e.latlng.lat, e.latlng.lng]])
        console.log('MapSelector: Selection started at', e.latlng)
      }
    },
    mousemove: (e) => {
      if (isSelecting && startPoint) {
        const newBounds = [
          [Math.min(startPoint[0], e.latlng.lat), Math.min(startPoint[1], e.latlng.lng)],
          [Math.max(startPoint[0], e.latlng.lat), Math.max(startPoint[1], e.latlng.lng)]
        ]
        setCurrentBounds(newBounds)
        console.log('MapSelector: Drawing rectangle to', e.latlng)
      }
    },
    mouseup: (e) => {
      console.log('MapSelector mouseup event:', e.latlng, 'isSelecting:', isSelecting, 'startPoint:', startPoint)
      if (isSelecting && startPoint) {
        const endPoint = [e.latlng.lat, e.latlng.lng]
        const bounds = [
          [Math.min(startPoint[0], endPoint[0]), Math.min(startPoint[1], endPoint[1])],
          [Math.max(startPoint[0], endPoint[0]), Math.max(startPoint[1], endPoint[1])]
        ]
        onAreaSelect(bounds)
        setIsSelecting(false)
        setStartPoint(null)
        setCurrentBounds(null)
        console.log('MapSelector: Selection finished, bounds:', bounds)
      }
    },
  })

  return (
    <>
      {currentBounds && (
        <Rectangle bounds={currentBounds} pathOptions={{ color: 'blue', weight: 2, fillOpacity: 0.2 }} />
      )}
      {selectedArea && !isSelecting && (
        <Rectangle bounds={selectedArea} pathOptions={{ color: 'green', weight: 2, fillOpacity: 0.2 }} />
      )}
    </>
  )
}

function App() {
  const [latitude, setLatitude] = useState('')
  const [longitude, setLongitude] = useState('')
  const [analysisResult, setAnalysisResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [selectedArea, setSelectedArea] = useState(null)
  const [isSelecting, setIsSelecting] = useState(false)
  const [activeTab, setActiveTab] = useState('input')

  const handleAnalyze = async () => {
    if (!latitude || !longitude) {
      setError('Por favor, introduce la latitud y la longitud.')
      return
    }

    setLoading(true)
    setError(null)
    setAnalysisResult(null)

    try {
      const response = await axios.post(`${API_BASE_URL}/analyze`, {
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude),
      })
      console.log('API Response:', response.data)
      if (response.data.status === 'success') {
        setAnalysisResult(response.data.analysis)
        setActiveTab('results')
      } else {
        setError(response.data.message || 'Error desconocido al analizar los datos.')
      }
    } catch (err) {
      console.error('Error al realizar la solicitud:', err)
      setError('Error al conectar con el servidor o al procesar la solicitud.')
    } finally {
      setLoading(false)
    }
  }

  const handleAreaSelect = (bounds) => {
    setSelectedArea(bounds)
    setLatitude(bounds[0][0].toFixed(4)) // Latitud del primer punto
    setLongitude(bounds[0][1].toFixed(4)) // Longitud del primer punto
    setActiveTab('input') // Volver a la pestaña de entrada para ver las coordenadas
  }

  const handleClearSelection = () => {
    setSelectedArea(null)
    setLatitude('')
    setLongitude('')
    setIsSelecting(false)
  }

  const handleStartSelection = () => {
    setIsSelecting(true)
    setSelectedArea(null) // Limpiar selección anterior al iniciar una nueva
  }

  // Preparar datos para el gráfico de evolución del viento a 100m
  const windEvolutionData = analysisResult?.wind_evolution_100m?.timestamps?.map((timestamp, index) => {
    const windSpeed = analysisResult?.wind_evolution_100m?.wind_speed_100m?.[index]
    const windDirection = analysisResult?.wind_evolution_100m?.wind_direction_100m?.[index]
    return {
      time: new Date(timestamp * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      'Velocidad del Viento (m/s)': windSpeed,
      'Dirección del Viento (grados)': windDirection,
    }
  }) || []

  // Preparar datos para el gráfico de rosa de los vientos (histograma de direcciones)
  const windRoseData = analysisResult?.wind_rose_data?.map(dataPoint => ({
    direction: dataPoint.direction,
    frequency: dataPoint.frequency,
  })) || []

  // Preparar datos para el gráfico de velocidad del viento por altura
  const windSpeedByHeightData = analysisResult?.wind_speed_by_height?.map(dataPoint => ({
    height: dataPoint.height,
    speed: dataPoint.speed,
  })) || []

  // Preparar datos para el gráfico de distribución de Weibull
  const weibullData = analysisResult?.weibull_distribution?.bins?.map((bin, index) => ({
    speed: bin,
    frequency: analysisResult?.weibull_distribution?.frequencies?.[index],
  })) || []

  // Preparar datos para el gráfico de densidad de potencia
  const powerDensityData = analysisResult?.power_density_distribution?.bins?.map((bin, index) => ({
    speed: bin,
    density: analysisResult?.power_density_distribution?.densities?.[index],
  })) || []

  // Preparar datos para el gráfico de frecuencia de velocidad del viento
  const windSpeedFrequencyData = analysisResult?.wind_speed_frequency?.bins?.map((bin, index) => ({
    speed: bin,
    frequency: analysisResult?.wind_speed_frequency?.frequencies?.[index],
  })) || []

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center p-4">
      <Card className="w-full max-w-4xl shadow-lg">
        <CardHeader>
          <CardTitle className="text-2xl font-bold text-center">Análisis de Potencial Eólico</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="input">Entrada de Datos</TabsTrigger>
              <TabsTrigger value="results">Resultados del Análisis</TabsTrigger>
            </TabsList>
            <TabsContent value="input" className="p-4">
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="latitude">Latitud</Label>
                    <Input
                      id="latitude"
                      type="number"
                      placeholder="Ej: 40.7128"
                      value={latitude}
                      onChange={(e) => setLatitude(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="longitude">Longitud</Label>
                    <Input
                      id="longitude"
                      type="number"
                      placeholder="Ej: -74.0060"
                      value={longitude}
                      onChange={(e) => setLongitude(e.target.value)}
                    />
                  </div>
                </div>
                <Button onClick={handleAnalyze} className="w-full" disabled={loading}>
                  {loading ? 'Analizando...' : 'Analizar Datos'}
                </Button>
                {error && (
                  <Alert variant="destructive">
                    <XCircle className="h-4 w-4" />
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}
                <div className="h-[400px] w-full rounded-md overflow-hidden border">
                  <MapContainer
                    center={[latitude ? parseFloat(latitude) : 40.7128, longitude ? parseFloat(longitude) : -74.0060]}
                    zoom={latitude && longitude ? 10 : 2}
                    scrollWheelZoom={true}
                    className="h-full w-full"
                  >
                    <TileLayer
                      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />
                    <MapSelector onAreaSelect={handleAreaSelect} selectedArea={selectedArea} isSelecting={isSelecting} setIsSelecting={setIsSelecting} />
                  </MapContainer>
                </div>
                <div className="flex justify-between space-x-2">
                  <Button onClick={handleStartSelection} disabled={isSelecting} className="flex-1">
                    <MapPin className="mr-2 h-4 w-4" /> Seleccionar Área en Mapa
                  </Button>
                  <Button onClick={handleClearSelection} variant="outline" className="flex-1">
                    Limpiar Selección
                  </Button>
                </div>
              </div>
            </TabsContent>
            <TabsContent value="results" className="p-4 space-y-6">
              {analysisResult ? (
                <div className="space-y-6">
                  <h3 className="text-xl font-semibold">Resultados del Análisis</h3>

                  {/* Sección de Resumen */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center"><TrendingUp className="mr-2 h-5 w-5" /> Resumen General</CardTitle>
                    </CardHeader>
                    <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <p className="text-sm font-medium">Latitud:</p>
                        <p className="text-lg">{analysisResult.latitude?.toFixed(4) || 'N/A'}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-sm font-medium">Longitud:</p>
                        <p className="text-lg">{analysisResult.longitude?.toFixed(4) || 'N/A'}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-sm font-medium">Altura de Referencia (m):</p>
                        <p className="text-lg">{analysisResult.reference_height_m?.toFixed(2) || 'N/A'}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-sm font-medium">Velocidad Media del Viento (m/s):</p>
                        <p className="text-lg">{analysisResult.mean_wind_speed_mps?.toFixed(2) || 'N/A'}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-sm font-medium">Densidad de Potencia Eólica (W/m²):</p>
                        <p className="text-lg">{analysisResult.wind_power_density_wm2?.toFixed(2) || 'N/A'}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-sm font-medium">Clase de Viento:</p>
                        <p className="text-lg"><Badge>{analysisResult.wind_class || 'N/A'}</Badge></p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-sm font-medium">Factor de Forma Weibull (k):</p>
                        <p className="text-lg">{analysisResult.weibull_k?.toFixed(2) || 'N/A'}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-sm font-medium">Parámetro de Escala Weibull (A m/s):</p>
                        <p className="text-lg">{analysisResult.weibull_A_mps?.toFixed(2) || 'N/A'}</p>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Gráfico de Evolución del Viento a 100m */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center"><LineChart className="mr-2 h-5 w-5" /> Evolución del Viento a 100m</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {windEvolutionData.length > 0 ? (
                        <ResponsiveContainer width="100%" height={300}>
                          <LineChart data={windEvolutionData}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="time" />
                            <YAxis />
                            <Tooltip />
                            <Line type="monotone" dataKey="Velocidad del Viento (m/s)" stroke="#8884d8" activeDot={{ r: 8 }} />
                            <Line type="monotone" dataKey="Dirección del Viento (grados)" stroke="#82ca9d" />
                          </LineChart>
                        </ResponsiveContainer>
                      ) : (
                        <Alert>
                          <AlertDescription>No hay datos de evolución temporal disponibles.</AlertDescription>
                        </Alert>
                      )}
                    </CardContent>
                  </Card>

                  {/* Gráfico de Rosa de los Vientos */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center"><BarChart3 className="mr-2 h-5 w-5" /> Rosa de los Vientos</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {windRoseData.length > 0 ? (
                        <ResponsiveContainer width="100%" height={300}>
                          <BarChart data={windRoseData}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="direction" />
                            <YAxis />
                            <Tooltip />
                            <Bar dataKey="frequency" fill="#8884d8" />
                          </BarChart>
                        </ResponsiveContainer>
                      ) : (
                        <Alert>
                          <AlertDescription>No hay datos de rosa de los vientos disponibles.</AlertDescription>
                        </Alert>
                      )}
                    </CardContent>
                  </Card>

                  {/* Gráfico de Velocidad del Viento por Altura */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center"><TrendingUp className="mr-2 h-5 w-5" /> Velocidad del Viento por Altura</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {windSpeedByHeightData.length > 0 ? (
                        <ResponsiveContainer width="100%" height={300}>
                          <LineChart data={windSpeedByHeightData}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="height" label={{ value: 'Altura (m)', position: 'insideBottom', offset: 0 }} />
                            <YAxis label={{ value: 'Velocidad (m/s)', angle: -90, position: 'insideLeft' }} />
                            <Tooltip />
                            <Line type="monotone" dataKey="speed" stroke="#8884d8" activeDot={{ r: 8 }} />
                          </LineChart>
                        </ResponsiveContainer>
                      ) : (
                        <Alert>
                          <AlertDescription>No hay datos de velocidad del viento por altura disponibles.</AlertDescription>
                        </Alert>
                      )}
                    </CardContent>
                  </Card>

                  {/* Gráfico de Distribución de Weibull */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center"><BarChart3 className="mr-2 h-5 w-5" /> Distribución de Weibull</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {weibullData.length > 0 ? (
                        <ResponsiveContainer width="100%" height={300}>
                          <BarChart data={weibullData}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="speed" label={{ value: 'Velocidad del Viento (m/s)', position: 'insideBottom', offset: 0 }} />
                            <YAxis label={{ value: 'Frecuencia', angle: -90, position: 'insideLeft' }} />
                            <Tooltip />
                            <Bar dataKey="frequency" fill="#8884d8" />
                          </BarChart>
                        </ResponsiveContainer>
                      ) : (
                        <Alert>
                          <AlertDescription>No hay datos de distribución de Weibull disponibles.</AlertDescription>
                        </Alert>
                      )}
                    </CardContent>
                  </Card>

                  {/* Gráfico de Densidad de Potencia */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center"><BarChart3 className="mr-2 h-5 w-5" /> Densidad de Potencia</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {powerDensityData.length > 0 ? (
                        <ResponsiveContainer width="100%" height={300}>
                          <BarChart data={powerDensityData}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="speed" label={{ value: 'Velocidad del Viento (m/s)', position: 'insideBottom', offset: 0 }} />
                            <YAxis label={{ value: 'Densidad de Potencia (W/m²)', angle: -90, position: 'insideLeft' }} />
                            <Tooltip />
                            <Bar dataKey="density" fill="#8884d8" />
                          </BarChart>
                        </ResponsiveContainer>
                      ) : (
                        <Alert>
                          <AlertDescription>No hay datos de densidad de potencia disponibles.</AlertDescription>
                        </Alert>
                      )}
                    </CardContent>
                  </Card>

                  {/* Gráfico de Frecuencia de Velocidad del Viento */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center"><BarChart3 className="mr-2 h-5 w-5" /> Frecuencia de Velocidad del Viento</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {windSpeedFrequencyData.length > 0 ? (
                        <ResponsiveContainer width="100%" height={300}>
                          <BarChart data={windSpeedFrequencyData}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="speed" label={{ value: 'Velocidad del Viento (m/s)', position: 'insideBottom', offset: 0 }} />
                            <YAxis label={{ value: 'Frecuencia', angle: -90, position: 'insideLeft' }} />
                            <Tooltip />
                            <Bar dataKey="frequency" fill="#8884d8" />
                          </BarChart>
                        </ResponsiveContainer>
                      ) : (
                        <Alert>
                          <AlertDescription>No hay datos de frecuencia de velocidad del viento disponibles.</AlertDescription>
                        </Alert>
                      )}
                    </CardContent>
                  </Card>

                </div>
              ) : (
                <div className="text-center text-gray-500">
                  {loading ? (
                    <p>Cargando resultados...</p>
                  ) : (
                    <p>Introduce las coordenadas y haz clic en 'Analizar Datos' para ver los resultados.</p>
                  )}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}

export default App


