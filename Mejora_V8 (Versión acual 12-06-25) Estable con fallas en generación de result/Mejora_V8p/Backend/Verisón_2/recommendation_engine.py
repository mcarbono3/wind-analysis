
import joblib
import pandas as pd

# Load the trained model
model = joblib.load("random_forest_model.joblib")

def generate_recommendation(metrics):
    # Convert metrics to a DataFrame, ensuring column order matches training data
    # The order of columns in X from ml_module.py was:
    # event_density, avg_wind_speed_hu, avg_wind_speed_ts, energy_opportunity_score, extreme_risk_index, avg_duration_hours, min_pressure
    input_df = pd.DataFrame([metrics])

    # Predict the net impact
    predicted_impact = model.predict(input_df)[0]

    recommendation = ""
    if predicted_impact == 'positivo':
        recommendation = (
            "**Recomendación: Viabilidad Alta**\n\n" +
            "Este punto geográfico presenta condiciones históricas favorables para proyectos eólicos, " +
            "con una alta puntuación de oportunidad energética y un bajo índice de riesgo extremo. " +
            "Se recomienda proceder con estudios de viabilidad detallados y considerar este sitio como " +
            "prioritario para el desarrollo de energía eólica. " +
            "Monitorear continuamente las condiciones climáticas y realizar análisis de sitio exhaustivos " +
            "para optimizar el diseño del proyecto y la selección de turbinas."
        )
    elif predicted_impact == 'neutral':
        recommendation = (
            "**Recomendación: Viabilidad Moderada**\n\n" +
            "La viabilidad para proyectos eólicos en esta ubicación es moderada. " +
            "Aunque existen oportunidades energéticas, también se han registrado eventos extremos que " +
            "podrían impactar la operación. Se sugiere realizar un análisis de riesgo más profundo, " +
            "considerar tecnologías de turbinas más robustas y diseñar estrategias de mitigación " +
            "para eventos climáticos. La diversificación de la cartera de proyectos podría ser beneficiosa."
        )
    elif predicted_impact == 'negativo':
        recommendation = (
            "**Recomendación: Viabilidad Baja / Riesgo Alto**\n\n" +
            "Este sitio presenta un alto riesgo debido a la frecuencia e intensidad de eventos climáticos extremos, " +
            "lo que reduce significativamente la oportunidad energética. " +
            "No se recomienda la inversión en proyectos eólicos a gran escala en esta ubicación " +
            "sin una reevaluación exhaustiva de los riesgos y la implementación de medidas de protección " +
            "excepcionalmente robustas. Se aconseja explorar ubicaciones alternativas con un perfil de riesgo más favorable."
        )
    else:
        recommendation = "No se pudo generar una recomendación debido a un impacto no reconocido."

    return recommendation, predicted_impact

# Example usage:
# These metrics should come from the statistical_geospatial_analysis.py output for a specific point
example_metrics = {
    'event_density': 15,
    'avg_wind_speed_hu': 72.8,
    'avg_wind_speed_ts': 45.5,
    'energy_opportunity_score': 0.73,
    'extreme_risk_index': 0.2,
    'avg_duration_hours': 4.8,
    'min_pressure': 980
}

rec, impact = generate_recommendation(example_metrics)
print(f"\nImpacto Predicho: {impact}")
print(f"\nRecomendación:\n{rec}")

# Another example for a potentially negative impact
example_metrics_negative = {
    'event_density': 25,
    'avg_wind_speed_hu': 90.0,
    'avg_wind_speed_ts': 55.0,
    'energy_opportunity_score': 0.5,
    'extreme_risk_index': 0.4,
    'avg_duration_hours': 7.0,
    'min_pressure': 960
}

rec_neg, impact_neg = generate_recommendation(example_metrics_negative)
print(f"\nImpacto Predicho (Negativo): {impact_neg}")
print(f"\nRecomendación (Negativa):\n{rec_neg}")

# Another example for a potentially neutral impact
example_metrics_neutral = {
    'event_density': 12,
    'avg_wind_speed_hu': 65.0,
    'avg_wind_speed_ts': 42.0,
    'energy_opportunity_score': 0.65,
    'extreme_risk_index': 0.25,
    'avg_duration_hours': 3.5,
    'min_pressure': 985
}

rec_neut, impact_neut = generate_recommendation(example_metrics_neutral)
print(f"\nImpacto Predicho (Neutral): {impact_neut}")
print(f"\nRecomendación (Neutral):\n{rec_neut}")


