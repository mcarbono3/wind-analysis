
import pandas as pd
from geopy.distance import geodesic

def calculate_metrics(df, caribbean_bbox, analysis_point_lat, analysis_point_lon, radius_km=200):
    # Filter events within the Caribbean bounding box using the already parsed float columns
    caribbean_events = df[
        (df["latitude_float"] >= caribbean_bbox["min_lat"])
        & (df["latitude_float"] <= caribbean_bbox["max_lat"])
        & (df["longitude_float"] >= caribbean_bbox["min_lon"])
        & (df["longitude_float"] <= caribbean_bbox["max_lon"])
    ].copy()
    print("\nCaribbean Events Head:")
    print(caribbean_events.head())
    print("\nCaribbean Events Info:")
    print(caribbean_events.info())


    if caribbean_events.empty:
        return {
            "event_density": 0,
            "event_frequency": {},
            "event_intensity_profile": {},
            "energy_opportunity_score": 0,
            "extreme_risk_index": 0,
            "event_duration_stats": {},
            "historical_pressure_min": -999
        }

    # Calculate distance from analysis point for each event record
    caribbean_events["distance_to_analysis_point"] = caribbean_events.apply(
        lambda row: geodesic((row["latitude_float"], row["longitude_float"]), (analysis_point_lat, analysis_point_lon)).km,
        axis=1
    )

    # Filter events within the specified radius
    nearby_events = caribbean_events[caribbean_events["distance_to_analysis_point"] <= radius_km].copy()

    if nearby_events.empty:
        return {
            "event_density": 0,
            "event_frequency": {},
            "event_intensity_profile": {},
            "energy_opportunity_score": 0,
            "extreme_risk_index": 0,
            "event_duration_stats": {},
            "historical_pressure_min": -999
        }

    # 1. event_density: density histórica de eventos dentro de un radio (ej. 200 km).
    # This can be the count of unique storm_id within the radius
    event_density = nearby_events["storm_id"].nunique()

    # 2. event_frequency: frecuencia anual promedio de cada tipo de evento.
    nearby_events["year"] = pd.to_datetime(nearby_events["date"] + nearby_events["time"], format="%Y%m%d%H%M").dt.year
    total_years = nearby_events["year"].nunique()
    event_frequency = nearby_events.groupby("storm_type")["storm_id"].nunique() / total_years if total_years > 0 else 0
    event_frequency = event_frequency.to_dict()

    # 3. event_intensity_profile: perfil histórico de velocidad del viento.
    event_intensity_profile = nearby_events.groupby("storm_type")["max_sustained_wind_knots"].mean().to_dict()

    # 4. energy_opportunity_score: proporción de eventos con vientos útiles (12–25 m/s).
    # Convert knots to m/s (1 knot = 0.514444 m/s)
    nearby_events["max_sustained_wind_ms"] = nearby_events["max_sustained_wind_knots"] * 0.514444
    useful_wind_events = nearby_events[
        (nearby_events["max_sustained_wind_ms"] >= 12)
        & (nearby_events["max_sustained_wind_ms"] <= 25)
    ]
    energy_opportunity_score = useful_wind_events["storm_id"].nunique() / event_density if event_density > 0 else 0

    # 5. extreme_risk_index: frecuencia de eventos severos (>30 m/s).
    severe_wind_events = nearby_events[nearby_events["max_sustained_wind_ms"] > 30]
    extreme_risk_index = severe_wind_events["storm_id"].nunique() / event_density if event_density > 0 else 0

    # 6. event_duration_stats: duración promedio y variabilidad.
    # This requires grouping by storm_id and calculating duration from min to max date/time for each storm
    storm_durations = nearby_events.groupby("storm_id").apply(lambda x:
        (pd.to_datetime(x["date"] + x["time"], format="%Y%m%d%H%M").max() -
         pd.to_datetime(x["date"] + x["time"], format="%Y%m%d%H%M").min()).total_seconds() / 3600
    )
    event_duration_stats = {
        "average_duration_hours": storm_durations.mean() if not storm_durations.empty else 0,
        "std_dev_duration_hours": storm_durations.std() if not storm_durations.empty else 0
    }

    # 7. historical_pressure_min: indicador de afectación ciclónica severa.
    # Filter out -999 (missing values) and find the minimum pressure
    valid_pressures = nearby_events[nearby_events["min_central_pressure_mb"] != -999]["min_central_pressure_mb"]
    historical_pressure_min = valid_pressures.min() if not valid_pressures.empty else -999

    return {
        "event_density": event_density,
        "event_frequency": event_frequency,
        "event_intensity_profile": event_intensity_profile,
        "energy_opportunity_score": energy_opportunity_score,
        "extreme_risk_index": extreme_risk_index,
        "event_duration_stats": event_duration_stats,
        "historical_pressure_min": historical_pressure_min
    }

# Load the parsed data, ensuring date and time are read as strings
df = pd.read_csv("parsed_hurdat_data.csv", dtype={
    "date": str,
    "time": str
})

# Define Colombian Caribbean bounding box (approximate)
caribbean_bbox = {
    "min_lat": 10.0,
    "max_lat": 13.0,
    "min_lon": -82.0,
    "max_lon": -74.0
}

# Example analysis point (e.g., near Barranquilla, Colombia)
analysis_point_lat = 10.9685
analysis_point_lon = -74.7813

# Calculate metrics
metrics = calculate_metrics(df, caribbean_bbox, analysis_point_lat, analysis_point_lon)

# Print results
for key, value in metrics.items():
    print(f"{key}: {value}")





