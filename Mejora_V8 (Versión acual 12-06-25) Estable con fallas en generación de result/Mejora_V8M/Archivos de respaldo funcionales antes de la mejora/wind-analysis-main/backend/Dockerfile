# Dockerfile para el backend Flask
FROM python:3.11-slim

WORKDIR /app

# Instalar dependencias del sistema
RUN apt-get update && apt-get install -y \
    gcc \
    g++ \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copiar archivos de dependencias
COPY requirements.txt .

# Instalar dependencias de Python
RUN pip install -r requirements.txt

# Copiar código fuente
COPY src/ ./src/

# Crear directorio para datos temporales
RUN mkdir -p /app/temp

# Exponer puerto
EXPOSE 5000

# Variables de entorno
ENV FLASK_APP=src/main.py
ENV FLASK_ENV=production
ENV PYTHONPATH=/app

# Comando para ejecutar la aplicación
CMD ["python", "-m", "flask", "run", "--host=0.0.0.0", "--port=5000"]

