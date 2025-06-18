import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split
import os
import sys

# Añadir el directorio padre al sys.path para que pueda encontrar src
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from services.ai_diagnosis import WindPotentialAI

def generate_and_save_datasets(output_dir="/home/ubuntu/wind-analysis-app/data/ai_datasets", n_samples=5000):
    """
    Genera datasets sintéticos para entrenamiento, prueba y validación del modelo de IA.
    """
    ai_model = WindPotentialAI()
    X, y = ai_model.generate_training_data(n_samples=n_samples)
    
    # Convertir a DataFrame para facilitar el guardado
    df = pd.DataFrame(X, columns=ai_model.feature_names)
    df["target"] = y
    
    # Dividir en entrenamiento, prueba y validación
    X_train, X_test_val, y_train, y_test_val = train_test_split(X, y, test_size=0.3, random_state=42, stratify=y)
    X_test, X_val, y_test, y_val = train_test_split(X_test_val, y_test_val, test_size=0.5, random_state=42, stratify=y_test_val)
    
    # Crear DataFrames
    df_train = pd.DataFrame(X_train, columns=ai_model.feature_names)
    df_train["target"] = y_train
    
    df_test = pd.DataFrame(X_test, columns=ai_model.feature_names)
    df_test["target"] = y_test
    
    df_val = pd.DataFrame(X_val, columns=ai_model.feature_names)
    df_val["target"] = y_val
    
    # Crear directorio de salida si no existe
    os.makedirs(output_dir, exist_ok=True)
    
    # Guardar a CSV
    train_path = os.path.join(output_dir, "ai_training_data.csv")
    test_path = os.path.join(output_dir, "ai_test_data.csv")
    val_path = os.path.join(output_dir, "ai_validation_data.csv")
    
    df_train.to_csv(train_path, index=False)
    df_test.to_csv(test_path, index=False)
    df_val.to_csv(val_path, index=False)
    
    print(f"Datasets generados y guardados en: {output_dir}")
    return train_path, test_path, val_path

if __name__ == "__main__":
    generate_and_save_datasets()

