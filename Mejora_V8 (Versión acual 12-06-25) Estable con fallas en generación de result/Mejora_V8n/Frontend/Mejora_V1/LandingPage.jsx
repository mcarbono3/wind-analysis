import React, { useState, useEffect } from 'react';
import { Wind, MapPin, BarChart3, TrendingUp, ArrowRight, Zap, Globe, Database } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import heroImage from '../assets/wind-energy-hero.png';

const LandingPage = ({ onStartAnalysis }) => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    setIsVisible(true);
  }, []);

  const features = [
    {
      icon: <Wind className="w-8 h-8 text-blue-600" />,
      title: "Análisis de Velocidad del Viento",
      description: "Evaluación detallada de patrones de viento utilizando datos meteorológicos de alta precisión"
    },
    {
      icon: <Database className="w-8 h-8 text-green-600" />,
      title: "Datos ERA5 Copernicus",
      description: "Acceso a la base de datos meteorológica más avanzada del mundo con resolución temporal y espacial superior"
    },
    {
      icon: <MapPin className="w-8 h-8 text-purple-600" />,
      title: "Análisis Geoespacial",
      description: "Selección interactiva de áreas de estudio con visualización cartográfica avanzada"
    },
    {
      icon: <BarChart3 className="w-8 h-8 text-orange-600" />,
      title: "Reportes Técnicos",
      description: "Generación automática de informes profesionales con análisis estadístico completo"
    }
  ];

  const stats = [
    { value: "ERA5", label: "Base de Datos", icon: <Database className="w-6 h-6" /> },
    { value: "0.25°", label: "Resolución Espacial", icon: <Globe className="w-6 h-6" /> },
    { value: "1979-2024", label: "Período Temporal", icon: <TrendingUp className="w-6 h-6" /> },
    { value: "Caribe", label: "Región de Estudio", icon: <MapPin className="w-6 h-6" /> }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
      {/* Header */}
      <header className="relative z-10 bg-white/80 backdrop-blur-md border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-blue-600 rounded-lg">
                <Wind className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">Análisis Eólico Caribe</h1>
                <p className="text-sm text-gray-600">Evaluación del potencial eólico en Colombia</p>
              </div>
            </div>
            <div className="text-sm text-gray-500">
              Powered by ERA5
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-blue-600/10 to-indigo-600/10"></div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className={`space-y-8 transition-all duration-1000 ${isVisible ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-10'}`}>
              <div className="space-y-4">
                <div className="inline-flex items-center px-4 py-2 bg-blue-100 text-blue-800 rounded-full text-sm font-medium">
                  <Zap className="w-4 h-4 mr-2" />
                  Tecnología ERA5 Copernicus
                </div>
                <h1 className="text-5xl font-bold text-gray-900 leading-tight">
                  Evaluación Avanzada del
                  <span className="text-blue-600 block">Recurso Eólico</span>
                </h1>
                <p className="text-xl text-gray-600 leading-relaxed">
                  Plataforma especializada para el análisis del potencial eólico en el norte de Colombia, 
                  utilizando datos meteorológicos de alta precisión y herramientas de visualización avanzadas.
                </p>
              </div>

              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-900">Capacidades del Sistema:</h3>
                <ul className="space-y-2">
                  <li className="flex items-center text-gray-700">
                    <div className="w-2 h-2 bg-blue-600 rounded-full mr-3"></div>
                    Análisis de velocidad del viento, presión atmosférica y temperatura
                  </li>
                  <li className="flex items-center text-gray-700">
                    <div className="w-2 h-2 bg-blue-600 rounded-full mr-3"></div>
                    Selección interactiva de áreas de estudio georreferenciadas
                  </li>
                  <li className="flex items-center text-gray-700">
                    <div className="w-2 h-2 bg-blue-600 rounded-full mr-3"></div>
                    Generación de reportes técnicos y visualizaciones estadísticas
                  </li>
                </ul>
              </div>

              <Button 
                onClick={onStartAnalysis}
                size="lg" 
                className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-4 text-lg font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 group"
              >
                Iniciar Análisis
                <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
              </Button>
            </div>

            <div className={`transition-all duration-1000 delay-300 ${isVisible ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-10'}`}>
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-r from-blue-400 to-indigo-500 rounded-2xl blur-3xl opacity-20 transform rotate-6"></div>
                <img 
                  src={heroImage} 
                  alt="Análisis Eólico" 
                  className="relative w-full h-auto rounded-2xl shadow-2xl"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-16 bg-white/50 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
            {stats.map((stat, index) => (
              <div 
                key={index}
                className={`text-center transition-all duration-700 delay-${index * 100} ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}
              >
                <div className="flex justify-center mb-3">
                  <div className="p-3 bg-blue-100 rounded-full text-blue-600">
                    {stat.icon}
                  </div>
                </div>
                <div className="text-2xl font-bold text-gray-900">{stat.value}</div>
                <div className="text-sm text-gray-600">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">
              Funcionalidades Técnicas
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Herramientas especializadas para la evaluación integral del recurso eólico 
              con estándares de precisión científica y técnica.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            {features.map((feature, index) => (
              <Card 
                key={index}
                className={`group hover:shadow-xl transition-all duration-500 border-0 bg-white/70 backdrop-blur-sm hover:bg-white delay-${index * 100} ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}
              >
                <CardContent className="p-8">
                  <div className="flex items-start space-x-4">
                    <div className="p-3 bg-gray-50 rounded-xl group-hover:bg-blue-50 transition-colors">
                      {feature.icon}
                    </div>
                    <div className="flex-1">
                      <h3 className="text-xl font-semibold text-gray-900 mb-3">
                        {feature.title}
                      </h3>
                      <p className="text-gray-600 leading-relaxed">
                        {feature.description}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-gradient-to-r from-blue-600 to-indigo-700">
        <div className="max-w-4xl mx-auto text-center px-4 sm:px-6 lg:px-8">
          <h2 className="text-4xl font-bold text-white mb-6">
            Comience su Evaluación Eólica
          </h2>
          <p className="text-xl text-blue-100 mb-8 leading-relaxed">
            Acceda a datos meteorológicos de precisión científica y genere análisis 
            técnicos profesionales para sus proyectos de energía renovable.
          </p>
          <Button 
            onClick={onStartAnalysis}
            size="lg" 
            variant="secondary"
            className="bg-white text-blue-600 hover:bg-gray-50 px-8 py-4 text-lg font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 group"
          >
            Acceder al Sistema de Análisis
            <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-300 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <div className="flex justify-center items-center space-x-3 mb-4">
              <div className="p-2 bg-blue-600 rounded-lg">
                <Wind className="w-6 h-6 text-white" />
              </div>
              <span className="text-xl font-bold text-white">Análisis Eólico Caribe</span>
            </div>
            <p className="text-gray-400 mb-4">
              Evaluación del potencial eólico en Colombia utilizando datos ERA5 Copernicus
            </p>
            <p className="text-sm text-gray-500">
              © 2025 Análisis Eólico Caribe. Todos los derechos reservados.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;

