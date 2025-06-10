import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier
from sklearn.model_selection import train_test_split, cross_val_score, GridSearchCV
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import classification_report, confusion_matrix, accuracy_score
from sklearn.pipeline import Pipeline
import joblib
import warnings
warnings.filterwarnings('ignore')

class WindPotentialAI:
    """
    Sistema de IA para diagnóstico automático del potencial eólico
    Utiliza machine learning para evaluar la viabilidad de proyectos eólicos
    """
    
    def __init__(self):
        self.model = None
        self.scaler = StandardScaler()
        self.feature_names = [
            'mean_wind_speed',
            'wind_speed_std',
            'weibull_k',
            'weibull_c',
            'turbulence_intensity',
            'power_density',
            'capacity_factor',
            'prob_operational',
            'prob_above_8ms',
            'wind_speed_max',
            'wind_speed_percentile_90',
            'seasonal_variation'
        ]
        self.target_classes = ['Bajo', 'Moderado', 'Alto']
        self.is_trained = False
        
    def generate_training_data(self, n_samples=1000):
        """
        Genera datos de entrenamiento sintéticos basados en conocimiento experto
        """
        np.random.seed(42)
        
        # Generar características con distribuciones realistas
        data = []
        labels = []
        
        for i in range(n_samples):
            # Generar datos para clase "Alto potencial"
            if i < n_samples // 3:
                mean_wind_speed = np.random.normal(8.5, 1.5)  # Alta velocidad media
                wind_speed_std = np.random.normal(2.0, 0.5)
                weibull_k = np.random.normal(2.2, 0.3)
                weibull_c = np.random.normal(9.5, 1.0)
                turbulence_intensity = np.random.normal(0.12, 0.03)  # Baja turbulencia
                power_density = np.random.normal(450, 100)  # Alta densidad
                capacity_factor = np.random.normal(45, 8)  # Alto CF
                prob_operational = np.random.normal(85, 5)
                prob_above_8ms = np.random.normal(65, 10)
                wind_speed_max = np.random.normal(22, 3)
                wind_speed_percentile_90 = np.random.normal(12, 2)
                seasonal_variation = np.random.normal(0.15, 0.05)  # Baja variación
                label = 'Alto'
                
            # Generar datos para clase "Moderado potencial"
            elif i < 2 * n_samples // 3:
                mean_wind_speed = np.random.normal(6.5, 1.0)
                wind_speed_std = np.random.normal(1.8, 0.4)
                weibull_k = np.random.normal(2.0, 0.4)
                weibull_c = np.random.normal(7.2, 1.2)
                turbulence_intensity = np.random.normal(0.18, 0.04)
                power_density = np.random.normal(250, 80)
                capacity_factor = np.random.normal(30, 8)
                prob_operational = np.random.normal(75, 8)
                prob_above_8ms = np.random.normal(35, 15)
                wind_speed_max = np.random.normal(18, 4)
                wind_speed_percentile_90 = np.random.normal(9, 2)
                seasonal_variation = np.random.normal(0.25, 0.08)
                label = 'Moderado'
                
            # Generar datos para clase "Bajo potencial"
            else:
                mean_wind_speed = np.random.normal(4.5, 1.0)
                wind_speed_std = np.random.normal(1.2, 0.3)
                weibull_k = np.random.normal(1.8, 0.5)
                weibull_c = np.random.normal(5.0, 1.0)
                turbulence_intensity = np.random.normal(0.25, 0.06)  # Alta turbulencia
                power_density = np.random.normal(120, 50)  # Baja densidad
                capacity_factor = np.random.normal(18, 6)  # Bajo CF
                prob_operational = np.random.normal(60, 10)
                prob_above_8ms = np.random.normal(15, 8)
                wind_speed_max = np.random.normal(14, 3)
                wind_speed_percentile_90 = np.random.normal(6, 1.5)
                seasonal_variation = np.random.normal(0.35, 0.10)  # Alta variación
                label = 'Bajo'
            
            # Aplicar límites realistas
            mean_wind_speed = max(0, mean_wind_speed)
            wind_speed_std = max(0, wind_speed_std)
            weibull_k = max(0.5, weibull_k)
            weibull_c = max(0, weibull_c)
            turbulence_intensity = max(0.05, min(0.5, turbulence_intensity))
            power_density = max(0, power_density)
            capacity_factor = max(0, min(100, capacity_factor))
            prob_operational = max(0, min(100, prob_operational))
            prob_above_8ms = max(0, min(100, prob_above_8ms))
            wind_speed_max = max(mean_wind_speed, wind_speed_max)
            wind_speed_percentile_90 = max(mean_wind_speed, wind_speed_percentile_90)
            seasonal_variation = max(0, min(1, seasonal_variation))
            
            features = [
                mean_wind_speed,
                wind_speed_std,
                weibull_k,
                weibull_c,
                turbulence_intensity,
                power_density,
                capacity_factor,
                prob_operational,
                prob_above_8ms,
                wind_speed_max,
                wind_speed_percentile_90,
                seasonal_variation
            ]
            
            data.append(features)
            labels.append(label)
        
        return np.array(data), np.array(labels)
    
    def train_model(self, X=None, y=None):
        """
        Entrena el modelo de IA con datos de entrenamiento
        """
        if X is None or y is None:
            print("Generando datos de entrenamiento sintéticos...")
            X, y = self.generate_training_data(n_samples=2000)
        
        # Dividir datos en entrenamiento y prueba
        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=0.2, random_state=42, stratify=y
        )
        
        # Crear pipeline con escalado y modelo
        self.model = Pipeline([
            ('scaler', StandardScaler()),
            ('classifier', GradientBoostingClassifier(
                n_estimators=200,
                learning_rate=0.1,
                max_depth=6,
                random_state=42
            ))
        ])
        
        # Entrenar modelo
        print("Entrenando modelo de IA...")
        self.model.fit(X_train, y_train)
        
        # Evaluar modelo
        y_pred = self.model.predict(X_test)
        accuracy = accuracy_score(y_test, y_pred)
        
        print(f"Precisión del modelo: {accuracy:.3f}")
        
        # Validación cruzada
        cv_scores = cross_val_score(self.model, X_train, y_train, cv=5)
        print(f"Precisión promedio (CV): {cv_scores.mean():.3f} (+/- {cv_scores.std() * 2:.3f})")
        
        # Reporte detallado
        print("\nReporte de clasificación:")
        print(classification_report(y_test, y_pred))
        
        self.is_trained = True
        return accuracy
    
    def extract_features(self, analysis_data):
        """
        Extrae características relevantes de los datos de análisis
        """
        try:
            # Extraer métricas básicas
            basic_stats = analysis_data.get('basic_statistics', {})
            weibull = analysis_data.get('weibull_analysis', {})
            turbulence = analysis_data.get('turbulence_analysis', {})
            power_density = analysis_data.get('power_density', {})
            capacity_factor = analysis_data.get('capacity_factor', {})
            probabilities = analysis_data.get('wind_probabilities', {})
            
            # Calcular variación estacional (simulada)
            seasonal_variation = 0.2  # Valor por defecto
            
            features = [
                basic_stats.get('mean', 0),
                basic_stats.get('std', 0),
                weibull.get('k', 2.0),
                weibull.get('c', 5.0),
                turbulence.get('overall', {}).get('turbulence_intensity', 0.2),
                power_density.get('mean_power_density', 0),
                capacity_factor.get('capacity_factor', 0),
                probabilities.get('prob_operational', 0),
                probabilities.get('prob_above_8_ms', 0),
                basic_stats.get('max', 0),
                basic_stats.get('percentile_90', 0),
                seasonal_variation
            ]
            
            return np.array(features).reshape(1, -1)
            
        except Exception as e:
            print(f"Error extrayendo características: {e}")
            # Retornar características por defecto
            return np.array([[5.0, 1.5, 2.0, 5.5, 0.2, 150, 25, 70, 30, 15, 8, 0.25]])
    
    def predict_viability(self, analysis_data):
        """
        Predice la viabilidad eólica usando el modelo entrenado
        """
        if not self.is_trained:
            print("Entrenando modelo por primera vez...")
            self.train_model()
        
        # Extraer características
        features = self.extract_features(analysis_data)
        
        # Realizar predicción
        prediction = self.model.predict(features)[0]
        probabilities = self.model.predict_proba(features)[0]
        
        # Obtener probabilidades por clase
        class_probabilities = dict(zip(self.target_classes, probabilities))
        
        # Calcular confianza
        confidence = max(probabilities) * 100
        
        # Generar explicación detallada
        explanation = self._generate_explanation(features[0], prediction, class_probabilities)
        
        return {
            'prediction': prediction,
            'confidence': confidence,
            'class_probabilities': class_probabilities,
            'explanation': explanation,
            'features_used': dict(zip(self.feature_names, features[0]))
        }
    
    def _generate_explanation(self, features, prediction, probabilities):
        """
        Genera una explicación detallada de la predicción
        """
        feature_dict = dict(zip(self.feature_names, features))
        
        explanation = {
            'summary': f'El modelo predice un potencial eólico {prediction.lower()}',
            'key_factors': [],
            'recommendations': []
        }
        
        # Analizar factores clave
        if feature_dict['mean_wind_speed'] > 7:
            explanation['key_factors'].append('✅ Velocidad media del viento favorable')
        elif feature_dict['mean_wind_speed'] > 5:
            explanation['key_factors'].append('⚠️ Velocidad media del viento moderada')
        else:
            explanation['key_factors'].append('❌ Velocidad media del viento baja')
        
        if feature_dict['turbulence_intensity'] < 0.15:
            explanation['key_factors'].append('✅ Baja turbulencia detectada')
        elif feature_dict['turbulence_intensity'] < 0.25:
            explanation['key_factors'].append('⚠️ Turbulencia moderada')
        else:
            explanation['key_factors'].append('❌ Alta turbulencia detectada')
        
        if feature_dict['power_density'] > 300:
            explanation['key_factors'].append('✅ Alta densidad de potencia')
        elif feature_dict['power_density'] > 150:
            explanation['key_factors'].append('⚠️ Densidad de potencia moderada')
        else:
            explanation['key_factors'].append('❌ Baja densidad de potencia')
        
        if feature_dict['capacity_factor'] > 35:
            explanation['key_factors'].append('✅ Factor de capacidad alto')
        elif feature_dict['capacity_factor'] > 25:
            explanation['key_factors'].append('⚠️ Factor de capacidad moderado')
        else:
            explanation['key_factors'].append('❌ Factor de capacidad bajo')
        
        # Generar recomendaciones específicas
        if prediction == 'Bajo':
            explanation['recommendations'] = [
                'Considerar ubicaciones alternativas con mayor recurso eólico',
                'Evaluar torres de mayor altura para acceder a vientos más fuertes',
                'Analizar aerogeneradores de baja velocidad de arranque'
            ]
        elif prediction == 'Moderado':
            explanation['recommendations'] = [
                'Realizar estudios de micrositing detallados',
                'Considerar optimización del layout del parque eólico',
                'Evaluar diferentes tecnologías de aerogeneradores'
            ]
        else:  # Alto
            explanation['recommendations'] = [
                'Proceder con estudios de factibilidad detallados',
                'Considerar expansión del proyecto',
                'Optimizar el diseño para maximizar la producción'
            ]
        
        return explanation
    
    def get_feature_importance(self):
        """
        Retorna la importancia de las características del modelo
        """
        if not self.is_trained:
            return None
        
        # Obtener importancia del clasificador
        classifier = self.model.named_steps['classifier']
        importance = classifier.feature_importances_
        
        feature_importance = dict(zip(self.feature_names, importance))
        
        # Ordenar por importancia
        sorted_importance = sorted(feature_importance.items(), 
                                 key=lambda x: x[1], reverse=True)
        
        return sorted_importance
    
    def save_model(self, filepath):
        """
        Guarda el modelo entrenado
        """
        if self.is_trained:
            joblib.dump(self.model, filepath)
            print(f"Modelo guardado en: {filepath}")
        else:
            print("El modelo no ha sido entrenado aún")
    
    def load_model(self, filepath):
        """
        Carga un modelo previamente entrenado
        """
        try:
            self.model = joblib.load(filepath)
            self.is_trained = True
            print(f"Modelo cargado desde: {filepath}")
        except Exception as e:
            print(f"Error cargando modelo: {e}")

# Función para crear y entrenar el modelo
def create_wind_ai_model():
    """
    Crea y entrena un nuevo modelo de IA para análisis eólico
    """
    ai_model = WindPotentialAI()
    accuracy = ai_model.train_model()
    
    print(f"\n🤖 Modelo de IA entrenado exitosamente!")
    print(f"📊 Precisión alcanzada: {accuracy:.1%}")
    print(f"🎯 Objetivo de precisión: >95% ✅" if accuracy > 0.95 else f"🎯 Objetivo de precisión: >95% ⚠️")
    
    # Mostrar importancia de características
    importance = ai_model.get_feature_importance()
    print(f"\n📈 Características más importantes:")
    for feature, imp in importance[:5]:
        print(f"   {feature}: {imp:.3f}")
    
    return ai_model

