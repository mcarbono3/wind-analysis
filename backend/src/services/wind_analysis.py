import numpy as np
import pandas as pd
from scipy import stats
from scipy.optimize import minimize
import matplotlib.pyplot as plt
import seaborn as sns
from typing import Dict, List, Tuple, Optional
import warnings
warnings.filterwarnings('ignore')

class WindAnalysis:
    """
    Clase para análisis estadístico de datos de viento y evaluación del potencial eólico
    """
    
    def __init__(self):
        self.air_density = 1.225  # kg/m³ densidad del aire a nivel del mar
        self.cut_in_speed = 3.0   # m/s velocidad de arranque típica
        self.cut_out_speed = 25.0 # m/s velocidad de corte típica
        self.rated_speed = 12.0   # m/s velocidad nominal típica
        
    def calculate_wind_statistics(self, wind_speeds: np.ndarray) -> Dict:
        """
        Calcula estadísticas básicas del viento
        """
        # Filtrar valores válidos
        valid_speeds = wind_speeds[~np.isnan(wind_speeds)]
        valid_speeds = valid_speeds[valid_speeds >= 0]
        
        if len(valid_speeds) == 0:
            return {'error': 'No hay datos válidos de velocidad del viento'}
        
        stats_dict = {
            'mean': np.mean(valid_speeds),
            'median': np.median(valid_speeds),
            'std': np.std(valid_speeds),
            'min': np.min(valid_speeds),
            'max': np.max(valid_speeds),
            'percentile_25': np.percentile(valid_speeds, 25),
            'percentile_75': np.percentile(valid_speeds, 75),
            'percentile_90': np.percentile(valid_speeds, 90),
            'percentile_95': np.percentile(valid_speeds, 95),
            'count': len(valid_speeds),
            'data_availability': len(valid_speeds) / len(wind_speeds) * 100
        }
        
        return stats_dict
    
    def fit_weibull_distribution(self, wind_speeds: np.ndarray) -> Dict:
        """
        Ajusta una distribución de Weibull a los datos de viento
        """
        # Filtrar valores válidos
        valid_speeds = wind_speeds[~np.isnan(wind_speeds)]
        valid_speeds = valid_speeds[valid_speeds > 0]  # Weibull requiere valores > 0
        
        if len(valid_speeds) < 10:
            return {'error': 'Datos insuficientes para ajuste de Weibull'}
        
        try:
            # Método de máxima verosimilitud
            shape, loc, scale = stats.weibull_min.fit(valid_speeds, floc=0)
            
            # Parámetros de Weibull tradicionales
            k = shape  # Parámetro de forma
            c = scale  # Parámetro de escala
            
            # Estadísticas adicionales
            from scipy.special import gamma
            mean_weibull = c * gamma(1 + 1/k)
            mode_weibull = c * ((k-1)/k)**(1/k) if k > 1 else 0
            
            # Bondad de ajuste (Kolmogorov-Smirnov)
            ks_stat, p_value = stats.kstest(valid_speeds, 
                                          lambda x: stats.weibull_min.cdf(x, shape, loc, scale))
            
            # R-cuadrado
            sorted_speeds = np.sort(valid_speeds)
            n = len(sorted_speeds)
            empirical_probs = np.arange(1, n+1) / (n+1)
            theoretical_quantiles = stats.weibull_min.ppf(empirical_probs, shape, loc, scale)
            r_squared = stats.pearsonr(theoretical_quantiles, sorted_speeds)[0]**2
            
            weibull_params = {
                'k': k,
                'c': c,
                'shape': shape,
                'scale': scale,
                'location': loc,
                'mean': mean_weibull,
                'mode': mode_weibull,
                'ks_statistic': ks_stat,
                'p_value': p_value,
                'r_squared': r_squared,
                'goodness_of_fit': 'Excelente' if r_squared > 0.95 else 'Bueno' if r_squared > 0.90 else 'Regular'
            }
            
            return weibull_params
            
        except Exception as e:
            return {'error': f'Error en ajuste de Weibull: {str(e)}'}
    
    def calculate_turbulence_intensity(self, wind_speeds: np.ndarray, 
                                     time_resolution_hours: float = 1.0) -> Dict:
        """
        Calcula el índice de turbulencia (TI)
        """
        # Filtrar valores válidos
        valid_speeds = wind_speeds[~np.isnan(wind_speeds)]
        valid_speeds = valid_speeds[valid_speeds > 0]
        
        if len(valid_speeds) < 10:
            return {'error': 'Datos insuficientes para cálculo de turbulencia'}
        
        # Calcular TI para diferentes rangos de velocidad
        ti_results = {}
        
        # TI general
        mean_speed = np.mean(valid_speeds)
        std_speed = np.std(valid_speeds)
        ti_overall = std_speed / mean_speed if mean_speed > 0 else 0
        
        ti_results['overall'] = {
            'turbulence_intensity': ti_overall,
            'mean_speed': mean_speed,
            'std_speed': std_speed,
            'classification': self._classify_turbulence(ti_overall)
        }
        
        # TI por rangos de velocidad
        speed_bins = [(3, 6), (6, 9), (9, 12), (12, 15), (15, 25)]
        
        for min_speed, max_speed in speed_bins:
            mask = (valid_speeds >= min_speed) & (valid_speeds < max_speed)
            bin_speeds = valid_speeds[mask]
            
            if len(bin_speeds) > 5:
                bin_mean = np.mean(bin_speeds)
                bin_std = np.std(bin_speeds)
                bin_ti = bin_std / bin_mean if bin_mean > 0 else 0
                
                ti_results[f'{min_speed}-{max_speed}m/s'] = {
                    'turbulence_intensity': bin_ti,
                    'mean_speed': bin_mean,
                    'std_speed': bin_std,
                    'count': len(bin_speeds),
                    'classification': self._classify_turbulence(bin_ti)
                }
        
        return ti_results
    
    def _classify_turbulence(self, ti: float) -> str:
        """
        Clasifica el nivel de turbulencia según estándares IEC
        """
        if ti < 0.10:
            return 'Muy baja'
        elif ti < 0.15:
            return 'Baja'
        elif ti < 0.20:
            return 'Media'
        elif ti < 0.25:
            return 'Alta'
        else:
            return 'Muy alta'
    
    def calculate_power_density(self, wind_speeds: np.ndarray, 
                              air_density: Optional[float] = None) -> Dict:
        """
        Calcula la densidad de potencia eólica
        """
        if air_density is None:
            air_density = self.air_density
            
        # Filtrar valores válidos
        valid_speeds = wind_speeds[~np.isnan(wind_speeds)]
        valid_speeds = valid_speeds[valid_speeds >= 0]
        
        if len(valid_speeds) == 0:
            return {'error': 'No hay datos válidos de velocidad del viento'}
        
        # Densidad de potencia: P = 0.5 * ρ * v³
        power_density = 0.5 * air_density * (valid_speeds ** 3)
        
        results = {
            'mean_power_density': np.mean(power_density),  # W/m²
            'median_power_density': np.median(power_density),
            'max_power_density': np.max(power_density),
            'total_energy_density': np.sum(power_density) / len(power_density),  # Promedio
            'air_density_used': air_density,
            'classification': self._classify_power_density(np.mean(power_density))
        }
        
        return results
    
    def _classify_power_density(self, power_density: float) -> str:
        """
        Clasifica el recurso eólico según la densidad de potencia
        """
        if power_density < 100:
            return 'Pobre'
        elif power_density < 200:
            return 'Marginal'
        elif power_density < 300:
            return 'Moderado'
        elif power_density < 400:
            return 'Bueno'
        elif power_density < 500:
            return 'Excelente'
        else:
            return 'Excepcional'
    
    def calculate_wind_probabilities(self, wind_speeds: np.ndarray) -> Dict:
        """
        Calcula probabilidades de diferentes rangos de velocidad del viento
        """
        # Filtrar valores válidos
        valid_speeds = wind_speeds[~np.isnan(wind_speeds)]
        valid_speeds = valid_speeds[valid_speeds >= 0]
        
        if len(valid_speeds) == 0:
            return {'error': 'No hay datos válidos de velocidad del viento'}
        
        total_count = len(valid_speeds)
        
        probabilities = {
            'prob_above_8_ms': np.sum(valid_speeds > 8.0) / total_count * 100,  # 28.8 km/h
            'prob_above_cut_in': np.sum(valid_speeds > self.cut_in_speed) / total_count * 100,
            'prob_operational': np.sum((valid_speeds >= self.cut_in_speed) & 
                                     (valid_speeds <= self.cut_out_speed)) / total_count * 100,
            'prob_above_rated': np.sum(valid_speeds > self.rated_speed) / total_count * 100,
            'prob_calm': np.sum(valid_speeds < 2.0) / total_count * 100,
            'prob_strong': np.sum(valid_speeds > 15.0) / total_count * 100,
            'prob_extreme': np.sum(valid_speeds > 20.0) / total_count * 100
        }
        
        return probabilities
    
    def calculate_capacity_factor(self, wind_speeds: np.ndarray, 
                                turbine_power_curve: Optional[Dict] = None) -> Dict:
        """
        Estima el factor de capacidad de un aerogenerador
        """
        # Filtrar valores válidos
        valid_speeds = wind_speeds[~np.isnan(wind_speeds)]
        valid_speeds = valid_speeds[valid_speeds >= 0]
        
        if len(valid_speeds) == 0:
            return {'error': 'No hay datos válidos de velocidad del viento'}
        
        # Curva de potencia simplificada si no se proporciona una específica
        if turbine_power_curve is None:
            turbine_power_curve = self._default_power_curve()
        
        # Calcular potencia para cada velocidad
        power_output = []
        for speed in valid_speeds:
            power_output.append(self._interpolate_power(speed, turbine_power_curve))
        
        power_output = np.array(power_output)
        
        # Factor de capacidad
        rated_power = max(turbine_power_curve.values())
        capacity_factor = np.mean(power_output) / rated_power * 100
        
        results = {
            'capacity_factor': capacity_factor,
            'mean_power_output': np.mean(power_output),
            'rated_power': rated_power,
            'annual_energy_production': np.mean(power_output) * 8760,  # kWh/año
            'classification': self._classify_capacity_factor(capacity_factor)
        }
        
        return results
    
    def _default_power_curve(self) -> Dict:
        """
        Curva de potencia simplificada para un aerogenerador típico de 2 MW
        """
        return {
            0: 0, 1: 0, 2: 0, 3: 0,
            4: 50, 5: 150, 6: 300, 7: 500,
            8: 750, 9: 1000, 10: 1300, 11: 1600,
            12: 1850, 13: 1950, 14: 2000, 15: 2000,
            16: 2000, 17: 2000, 18: 2000, 19: 2000,
            20: 2000, 21: 2000, 22: 2000, 23: 2000,
            24: 2000, 25: 0  # Corte por alta velocidad
        }
    
    def _interpolate_power(self, speed: float, power_curve: Dict) -> float:
        """
        Interpola la potencia para una velocidad dada
        """
        speeds = sorted(power_curve.keys())
        
        if speed <= speeds[0]:
            return power_curve[speeds[0]]
        if speed >= speeds[-1]:
            return power_curve[speeds[-1]]
        
        # Interpolación lineal
        for i in range(len(speeds) - 1):
            if speeds[i] <= speed <= speeds[i + 1]:
                x1, x2 = speeds[i], speeds[i + 1]
                y1, y2 = power_curve[x1], power_curve[x2]
                return y1 + (y2 - y1) * (speed - x1) / (x2 - x1)
        
        return 0
    
    def _classify_capacity_factor(self, cf: float) -> str:
        """
        Clasifica el factor de capacidad
        """
        if cf < 20:
            return 'Pobre'
        elif cf < 30:
            return 'Marginal'
        elif cf < 40:
            return 'Bueno'
        elif cf < 50:
            return 'Muy bueno'
        else:
            return 'Excelente'
    
    def comprehensive_wind_analysis(self, wind_speeds: np.ndarray, 
                                  air_density: Optional[float] = None) -> Dict:
        """
        Realiza un análisis completo del recurso eólico
        """
        results = {}
        
        # Estadísticas básicas
        results['basic_statistics'] = self.calculate_wind_statistics(wind_speeds)
        
        # Distribución de Weibull
        results['weibull_analysis'] = self.fit_weibull_distribution(wind_speeds)
        
        # Índice de turbulencia
        results['turbulence_analysis'] = self.calculate_turbulence_intensity(wind_speeds)
        
        # Densidad de potencia
        results['power_density'] = self.calculate_power_density(wind_speeds, air_density)
        
        # Probabilidades
        results['wind_probabilities'] = self.calculate_wind_probabilities(wind_speeds)
        
        # Factor de capacidad
        results['capacity_factor'] = self.calculate_capacity_factor(wind_speeds)
        
        # Evaluación general
        results['overall_assessment'] = self._overall_wind_assessment(results)
        
        return results
    
    def _overall_wind_assessment(self, analysis_results: Dict) -> Dict:
        """
        Evaluación general del potencial eólico
        """
        assessment = {
            'viability_score': 0,
            'viability_level': 'Bajo',
            'recommendations': [],
            'key_metrics': {}
        }
        
        try:
            # Extraer métricas clave
            mean_speed = analysis_results['basic_statistics']['mean']
            power_density = analysis_results['power_density']['mean_power_density']
            capacity_factor = analysis_results['capacity_factor']['capacity_factor']
            ti_overall = analysis_results['turbulence_analysis']['overall']['turbulence_intensity']
            prob_operational = analysis_results['wind_probabilities']['prob_operational']
            
            assessment['key_metrics'] = {
                'mean_wind_speed': mean_speed,
                'power_density': power_density,
                'capacity_factor': capacity_factor,
                'turbulence_intensity': ti_overall,
                'operational_probability': prob_operational
            }
            
            # Sistema de puntuación (0-100)
            score = 0
            
            # Velocidad media del viento (30 puntos)
            if mean_speed >= 8:
                score += 30
            elif mean_speed >= 6:
                score += 20
            elif mean_speed >= 4:
                score += 10
            
            # Densidad de potencia (25 puntos)
            if power_density >= 400:
                score += 25
            elif power_density >= 300:
                score += 20
            elif power_density >= 200:
                score += 15
            elif power_density >= 100:
                score += 10
            
            # Factor de capacidad (25 puntos)
            if capacity_factor >= 40:
                score += 25
            elif capacity_factor >= 30:
                score += 20
            elif capacity_factor >= 20:
                score += 15
            elif capacity_factor >= 15:
                score += 10
            
            # Turbulencia (10 puntos - penalización)
            if ti_overall <= 0.15:
                score += 10
            elif ti_overall <= 0.20:
                score += 5
            elif ti_overall > 0.25:
                score -= 5
            
            # Probabilidad operacional (10 puntos)
            if prob_operational >= 80:
                score += 10
            elif prob_operational >= 70:
                score += 8
            elif prob_operational >= 60:
                score += 5
            
            assessment['viability_score'] = max(0, min(100, score))
            
            # Clasificación de viabilidad
            if score >= 75:
                assessment['viability_level'] = 'Alto'
                assessment['viability_message'] = '✅ Alta viabilidad para generación eólica'
            elif score >= 50:
                assessment['viability_level'] = 'Moderado'
                assessment['viability_message'] = '⚠️ Viabilidad moderada'
            else:
                assessment['viability_level'] = 'Bajo'
                assessment['viability_message'] = '❌ No viable (bajo recurso o alta turbulencia)'
            
            # Recomendaciones
            recommendations = []
            
            if mean_speed < 6:
                recommendations.append('Velocidad media del viento baja. Considerar torres más altas.')
            
            if ti_overall > 0.20:
                recommendations.append('Alta turbulencia detectada. Evaluar micrositing detallado.')
            
            if capacity_factor < 25:
                recommendations.append('Factor de capacidad bajo. Evaluar aerogeneradores de baja velocidad.')
            
            if power_density < 200:
                recommendations.append('Densidad de potencia marginal. Considerar otras ubicaciones.')
            
            if prob_operational < 70:
                recommendations.append('Baja probabilidad operacional. Revisar condiciones del sitio.')
            
            assessment['recommendations'] = recommendations
            
        except Exception as e:
            assessment['error'] = f'Error en evaluación general: {str(e)}'
        
        return assessment

