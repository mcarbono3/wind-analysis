# Aplicación de Análisis de Recurso Eólico - Versión Mejorada

## Descripción

Esta es la versión mejorada de la aplicación web para evaluar el recurso eólico en el norte de Colombia. Incluye una nueva página de inicio profesional y un rediseño completo de la interfaz de análisis, manteniendo todas las funcionalidades originales.

## Características Principales

### ✨ Nueva Página de Inicio
- Diseño profesional con efectos visuales dinámicos
- Información detallada sobre la aplicación y sus capacidades
- Animaciones y transiciones suaves
- Tema de colores inspirado en el Caribe colombiano

### 🔧 Página de Análisis Rediseñada
- Interfaz moderna con navegación por tabs
- Todas las funcionalidades originales mantenidas
- Mejor organización del flujo de trabajo
- Diseño responsive para todos los dispositivos

### 📊 Funcionalidades Técnicas
- Análisis de datos ERA5 del Copernicus Climate Data Store
- Visualizaciones interactivas con Recharts
- Mapas interactivos con Leaflet
- Exportación de resultados en CSV y PDF
- Análisis con inteligencia artificial

## Instalación y Uso

### Prerrequisitos
- Node.js 18+ 
- pnpm (recomendado) o npm

### Instalación

1. **Extraer el proyecto:**
   ```bash
   tar -xzf wind-analysis-improved.tar.gz
   cd wind-analysis-improved/wind-analysis-frontend
   ```

2. **Instalar dependencias:**
   ```bash
   pnpm install
   # o
   npm install
   ```

3. **Iniciar el servidor de desarrollo:**
   ```bash
   pnpm run dev
   # o
   npm run dev
   ```

4. **Abrir en el navegador:**
   ```
   http://localhost:5173
   ```

### Construcción para Producción

```bash
pnpm run build
# o
npm run build
```

Los archivos de producción se generarán en la carpeta `dist/`.

## Estructura del Proyecto

```
wind-analysis-frontend/
├── src/
│   ├── components/
│   │   ├── LandingPage.jsx      # Página de inicio
│   │   ├── AnalysisPage.jsx     # Página de análisis
│   │   └── ui/                  # Componentes UI
│   ├── assets/                  # Imágenes y recursos
│   ├── App.jsx                  # Componente principal
│   ├── App.css                  # Estilos personalizados
│   └── main.jsx                 # Punto de entrada
├── public/                      # Archivos públicos
├── package.json                 # Dependencias
└── vite.config.js              # Configuración de Vite
```

## Tecnologías Utilizadas

- **React 19** - Framework de interfaz de usuario
- **Vite** - Herramienta de construcción rápida
- **Tailwind CSS** - Framework de estilos
- **shadcn/ui** - Componentes UI modernos
- **Framer Motion** - Animaciones
- **Recharts** - Gráficos interactivos
- **React Leaflet** - Mapas interactivos
- **Lucide React** - Iconos modernos

## Configuración del Backend

La aplicación está configurada para conectarse al backend existente:
```
API_BASE_URL = 'https://wind-analysis.onrender.com/api'
```

Si necesitas cambiar la URL del backend, modifica la constante `API_BASE_URL` en `src/components/AnalysisPage.jsx`.

## Navegación de la Aplicación

1. **Página de Inicio**: Presentación de la aplicación con información detallada
2. **Botón "Iniciar Análisis"**: Navega a la página de análisis
3. **Página de Análisis**: 
   - Tab "Selección de Área": Mapa interactivo para seleccionar zona
   - Tab "Configuración": Configurar período y variables
   - Tab "Resultados": Visualizar análisis y gráficos
4. **Botón "Inicio"**: Regresa a la página principal

## Funcionalidades Mantenidas

✅ Selección de área en mapa interactivo  
✅ Configuración de período de análisis  
✅ Obtención de datos ERA5  
✅ Análisis con IA  
✅ Gráficos de evolución temporal  
✅ Patrones horarios  
✅ Rosa de vientos  
✅ Análisis de turbulencia  
✅ Estadísticas generales  
✅ Exportación CSV/PDF  

## Soporte

Para soporte técnico o preguntas sobre la implementación, consulta la documentación en `MEJORAS_IMPLEMENTADAS.md`.

## Licencia

Este proyecto mantiene la misma licencia que el proyecto original.

---

**Desarrollado con ❤️ para el análisis de recurso eólico en Colombia**

