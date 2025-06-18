// Test de Validación para las Funciones Corregidas
// Archivo: validation-test.js

// Funciones corregidas para testing
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
  if (normalizedMessage.includes('viable') || normalizedMessage.includes('recomendado')) return '✅';
  if (normalizedMessage.includes('moderado') || normalizedMessage.includes('precaución')) return '⚠️';
  if (normalizedMessage.includes('no viable') || normalizedMessage.includes('no recomendado')) return '❌';
  return '📊';
};

// Función de test para validar acceso seguro a datos
const safeDataAccess = (analysisData) => {
  return {
    viabilityLevel: analysisData?.viability_level || 'No disponible',
    avgWindSpeed: analysisData?.avg_wind_speed?.toFixed(2) || 'N/A',
    recommendation: analysisData?.recommendation || 'Sin recomendación',
    bounds: {
      lat1: analysisData?.location?.bounds?.[0]?.[0]?.toFixed(2) || 'N/A',
      lng1: analysisData?.location?.bounds?.[0]?.[1]?.toFixed(2) || 'N/A',
      lat2: analysisData?.location?.bounds?.[1]?.[0]?.toFixed(2) || 'N/A',
      lng2: analysisData?.location?.bounds?.[1]?.[1]?.toFixed(2) || 'N/A'
    }
  };
};

// Casos de prueba
console.log('=== TESTS DE VALIDACIÓN ===\n');

// Test 1: Datos válidos completos
console.log('Test 1: Datos válidos completos');
const validData = {
  viability_level: 'Alta',
  avg_wind_speed: 7.5,
  recommendation: 'Instalación viable y recomendada',
  location: {
    bounds: [[10.5, -74.2], [11.0, -73.8]]
  }
};

const result1 = safeDataAccess(validData);
console.log('Resultado:', result1);
console.log('Color:', getViabilityColor(validData.viability_level));
console.log('Icono:', getViabilityIcon(validData.recommendation));
console.log('');

// Test 2: Datos undefined/null
console.log('Test 2: Datos undefined/null');
const result2 = safeDataAccess(undefined);
console.log('Resultado:', result2);
console.log('Color:', getViabilityColor(undefined));
console.log('Icono:', getViabilityIcon(null));
console.log('');

// Test 3: Datos parcialmente disponibles
console.log('Test 3: Datos parcialmente disponibles');
const partialData = {
  viability_level: 'Moderada',
  // avg_wind_speed faltante
  recommendation: 'Requiere análisis adicional'
  // location faltante
};

const result3 = safeDataAccess(partialData);
console.log('Resultado:', result3);
console.log('Color:', getViabilityColor(partialData.viability_level));
console.log('Icono:', getViabilityIcon(partialData.recommendation));
console.log('');

// Test 4: Datos con estructura incorrecta
console.log('Test 4: Datos con estructura incorrecta');
const incorrectData = {
  viability_level: 'Baja',
  location: {
    // bounds faltante o con estructura incorrecta
    coordinates: [10.5, -74.2]
  }
};

const result4 = safeDataAccess(incorrectData);
console.log('Resultado:', result4);
console.log('Color:', getViabilityColor(incorrectData.viability_level));
console.log('Icono:', getViabilityIcon(incorrectData.recommendation));
console.log('');

// Test 5: Valores edge case
console.log('Test 5: Valores edge case');
console.log('Color para string vacío:', getViabilityColor(''));
console.log('Color para valor desconocido:', getViabilityColor('DESCONOCIDO'));
console.log('Icono para string vacío:', getViabilityIcon(''));
console.log('Icono para mensaje sin keywords:', getViabilityIcon('Análisis completado'));
console.log('');

// Test 6: Diferentes variaciones de nivel
console.log('Test 6: Diferentes variaciones de nivel');
const levels = ['Alta', 'ALTA', 'alta', 'Alto', 'High', 'Moderada', 'BAJA', 'Low', 'Unknown'];
levels.forEach(level => {
  console.log(`Nivel "${level}" -> Color: ${getViabilityColor(level)}`);
});

console.log('\n=== TESTS COMPLETADOS ===');

// Exportar funciones para uso en otros archivos
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    getViabilityColor,
    getViabilityIcon,
    safeDataAccess
  };
}

