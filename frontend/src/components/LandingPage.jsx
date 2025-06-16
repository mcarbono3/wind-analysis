import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Wind, 
  MapPin, 
  BarChart3, 
  Database, 
  Brain, 
  Download,
  ArrowRight,
  Play,
  CheckCircle,
  Globe,
  Zap,
  TrendingUp
} from 'lucide-react';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';

const LandingPage = ({ onStartAnalysis }) => {
  const [visibleSections, setVisibleSections] = useState(new Set());
  const [stats, setStats] = useState({
    dataPoints: 0,
    accuracy: 0,
    coverage: 0
  });

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setVisibleSections(prev => new Set([...prev, entry.target.id]));
          }
        });
      },
      { threshold: 0.1 }
    );

    document.querySelectorAll('[data-section]').forEach((section) => {
      observer.observe(section);
    });

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    // Animación de contadores
    const animateCounter = (target, duration = 2000) => {
      let start = 0;
      const increment = target / (duration / 16);
      const timer = setInterval(() => {
        start += increment;
        if (start >= target) {
          start = target;
          clearInterval(timer);
        }
        return start;
      }, 16);
      return timer;
    };

    if (visibleSections.has('stats')) {
      setStats({
        dataPoints: 0,
        accuracy: 0,
        coverage: 0
      });
      
      setTimeout(() => {
        animateCounter(1000000);
        setStats(prev => ({ ...prev, dataPoints: 1000000 }));
      }, 200);
      
      setTimeout(() => {
        setStats(prev => ({ ...prev, accuracy: 95.8 }));
      }, 400);
      
      setTimeout(() => {
        setStats(prev => ({ ...prev, coverage: 100 }));
      }, 600);
    }
  }, [visibleSections]);

  const WindParticles = () => (
    <div className="wind-particles">
      {[...Array(20)].map((_, i) => (
        <div
          key={i}
          className="wind-particle"
          style={{
            left: `${Math.random() * 100}%`,
            animationDelay: `${Math.random() * 10}s`,
            animationDuration: `${6 + Math.random() * 4}s`
          }}
        />
      ))}
    </div>
  );

  const features = [
    {
      icon: Database,
      title: "Datos ERA5",
      description: "Acceso a la base de datos meteorológica más completa del mundo, proporcionada por Copernicus Climate Data Store."
    },
    {
      icon: Brain,
      title: "Análisis IA",
      description: "Algoritmos avanzados de inteligencia artificial para procesamiento y análisis de patrones meteorológicos complejos."
    },
    {
      icon: BarChart3,
      title: "Visualización Avanzada",
      description: "Gráficos interactivos, mapas de calor y visualizaciones 3D para una comprensión completa de los datos."
    },
    {
      icon: Globe,
      title: "Cobertura Regional",
      description: "Análisis especializado para la región Caribe de Colombia con resolución espacial y temporal optimizada."
    }
  ];

  const steps = [
    {
      number: "01",
      title: "Selección de Área",
      description: "Utiliza el mapa interactivo para seleccionar la zona específica de análisis en el norte de Colombia."
    },
    {
      number: "02", 
      title: "Configuración",
      description: "Define el período de estudio, variables meteorológicas y unidades de medida según tus necesidades."
    },
    {
      number: "03",
      title: "Obtención de Datos",
      description: "El sistema descarga automáticamente los datos ERA5 más recientes para tu área seleccionada."
    },
    {
      number: "04",
      title: "Análisis IA",
      description: "Nuestros algoritmos procesan los datos y generan análisis estadísticos y predictivos avanzados."
    },
    {
      number: "05",
      title: "Resultados",
      description: "Visualiza los resultados en múltiples formatos y exporta reportes profesionales en PDF o CSV."
    }
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center justify-center hero-bg">
        <div className="absolute inset-0 hero-gradient" />
        <WindParticles />
        
        <div className="relative z-10 text-center text-white px-4 max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            <h1 className="text-5xl md:text-7xl font-bold mb-6 leading-tight">
              Análisis de Recurso
              <span className="block gradient-text">Eólico</span>
            </h1>
            <p className="text-xl md:text-2xl mb-8 text-white/90 max-w-3xl mx-auto">
              Evaluación inteligente del potencial eólico en el norte de Colombia 
              utilizando datos ERA5 y análisis avanzado con IA
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-12">
              <Button 
                size="lg" 
                className="pulse-glow text-lg px-8 py-4"
                onClick={onStartAnalysis}
              >
                <Play className="mr-2 h-5 w-5" />
                Iniciar Análisis
              </Button>
              <Button 
                variant="outline" 
                size="lg" 
                className="text-lg px-8 py-4 bg-white/10 border-white/30 text-white hover:bg-white/20"
              >
                Ver Demo
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </div>
          </motion.div>
        </div>

        {/* Scroll indicator */}
        <motion.div 
          className="absolute bottom-8 left-1/2 transform -translate-x-1/2"
          animate={{ y: [0, 10, 0] }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          <div className="w-6 h-10 border-2 border-white/50 rounded-full flex justify-center">
            <div className="w-1 h-3 bg-white/70 rounded-full mt-2"></div>
          </div>
        </motion.div>
      </section>

      {/* Stats Section */}
      <section 
        id="stats" 
        data-section 
        className={`py-20 bg-muted/50 section-fade-in ${visibleSections.has('stats') ? 'visible' : ''}`}
      >
        <div className="max-w-6xl mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="text-4xl md:text-5xl font-bold text-primary mb-2 stats-counter">
                {stats.dataPoints.toLocaleString()}+
              </div>
              <p className="text-muted-foreground">Puntos de Datos Procesados</p>
            </div>
            <div className="text-center">
              <div className="text-4xl md:text-5xl font-bold text-secondary mb-2 stats-counter">
                {stats.accuracy}%
              </div>
              <p className="text-muted-foreground">Precisión del Análisis</p>
            </div>
            <div className="text-center">
              <div className="text-4xl md:text-5xl font-bold text-accent mb-2 stats-counter">
                {stats.coverage}%
              </div>
              <p className="text-muted-foreground">Cobertura Regional</p>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section 
        id="features" 
        data-section 
        className={`py-20 section-fade-in ${visibleSections.has('features') ? 'visible' : ''}`}
      >
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold mb-6">
              Tecnología <span className="gradient-text">Avanzada</span>
            </h2>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
              Combinamos los mejores datos meteorológicos con inteligencia artificial 
              para ofrecerte análisis precisos y confiables del recurso eólico.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {features.map((feature, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 30 }}
                animate={visibleSections.has('features') ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.6, delay: index * 0.1 }}
              >
                <Card className="feature-card h-full">
                  <CardContent className="p-6">
                    <feature.icon className="feature-icon" />
                    <h3 className="text-xl font-semibold mb-3">{feature.title}</h3>
                    <p className="text-muted-foreground">{feature.description}</p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* How it Works Section */}
      <section 
        id="how-it-works" 
        data-section 
        className={`py-20 bg-muted/30 section-fade-in ${visibleSections.has('how-it-works') ? 'visible' : ''}`}
      >
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold mb-6">
              ¿Cómo <span className="gradient-text">Funciona?</span>
            </h2>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
              Proceso simple y automatizado para obtener análisis profesionales 
              del recurso eólico en minutos.
            </p>
          </div>

          <div className="space-y-8">
            {steps.map((step, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, x: index % 2 === 0 ? -50 : 50 }}
                animate={visibleSections.has('how-it-works') ? { opacity: 1, x: 0 } : {}}
                transition={{ duration: 0.6, delay: index * 0.1 }}
                className={`flex flex-col ${index % 2 === 0 ? 'md:flex-row' : 'md:flex-row-reverse'} items-center gap-8`}
              >
                <div className="flex-1">
                  <Card className="feature-card">
                    <CardContent className="p-8">
                      <div className="flex items-center mb-4">
                        <div className="w-12 h-12 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-xl font-bold mr-4">
                          {step.number}
                        </div>
                        <h3 className="text-2xl font-semibold">{step.title}</h3>
                      </div>
                      <p className="text-muted-foreground text-lg">{step.description}</p>
                    </CardContent>
                  </Card>
                </div>
                <div className="flex-1 flex justify-center">
                  <div className="w-64 h-64 bg-gradient-to-br from-primary/20 to-secondary/20 rounded-full flex items-center justify-center">
                    <div className="text-6xl font-bold text-primary/30">{step.number}</div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section 
        id="cta" 
        data-section 
        className={`py-20 bg-primary text-primary-foreground section-fade-in ${visibleSections.has('cta') ? 'visible' : ''}`}
      >
        <div className="max-w-4xl mx-auto text-center px-4">
          <h2 className="text-4xl md:text-5xl font-bold mb-6">
            ¿Listo para Evaluar tu Proyecto Eólico?
          </h2>
          <p className="text-xl mb-8 text-primary-foreground/90">
            Comienza ahora y obtén un análisis completo del recurso eólico 
            en tu área de interés con datos científicos confiables.
          </p>
          <Button 
            size="lg" 
            variant="secondary"
            className="text-lg px-8 py-4 pulse-glow"
            onClick={onStartAnalysis}
          >
            <Wind className="mr-2 h-5 w-5" />
            Iniciar Análisis Ahora
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-background border-t py-12">
        <div className="max-w-6xl mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div>
              <h3 className="text-xl font-semibold mb-4 flex items-center">
                <Wind className="mr-2 h-6 w-6 text-primary" />
                Análisis Eólico
              </h3>
              <p className="text-muted-foreground">
                Evaluación profesional del recurso eólico en Colombia 
                utilizando tecnología de vanguardia.
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Características</h4>
              <ul className="space-y-2 text-muted-foreground">
                <li className="flex items-center">
                  <CheckCircle className="mr-2 h-4 w-4 text-secondary" />
                  Datos ERA5
                </li>
                <li className="flex items-center">
                  <CheckCircle className="mr-2 h-4 w-4 text-secondary" />
                  Análisis IA
                </li>
                <li className="flex items-center">
                  <CheckCircle className="mr-2 h-4 w-4 text-secondary" />
                  Exportación PDF/CSV
                </li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Contacto</h4>
              <p className="text-muted-foreground">
                Para soporte técnico o consultas sobre la aplicación, 
                contacta a nuestro equipo de desarrollo.
              </p>
            </div>
          </div>
          <div className="border-t mt-8 pt-8 text-center text-muted-foreground">
            <p>&copy; 2025 Análisis Eólico Caribe. Todos los derechos reservados.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;

