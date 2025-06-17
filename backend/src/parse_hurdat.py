
import pandas as pd

def parse_hurdat_data(file_path):
    with open(file_path, 'r') as f:
        lines = f.readlines()

    parsed_data = []
    current_storm = None

    for line in lines:
        line = line.strip()
        if not line:
            continue

        if line.startswith('AL'):
            # New storm header
            parts = line.split(',')
            storm_id = parts[0].strip()
            storm_name = parts[1].strip()
            num_records = int(parts[2].strip())
            current_storm = {
                'storm_id': storm_id,
                'storm_name': storm_name,
                'num_records': num_records,
                'tracks': []
            }
            parsed_data.append(current_storm)
        elif current_storm is not None:
            # Track data
            parts = [p.strip() for p in line.split(',')]
            date = parts[0]
            time = parts[1].zfill(4) # Ensure time is 4 digits, zero-padded
            record_identifier = parts[2]
            storm_type = parts[3]
            latitude = parts[4]
            longitude = parts[5]
            max_sustained_wind_knots = int(parts[6])
            min_central_pressure_mb = int(parts[7])

            current_storm['tracks'].append({
                'date': date,
                'time': time,
                'record_identifier': record_identifier,
                'storm_type': storm_type,
                'latitude': latitude,
                'longitude': longitude,
                'max_sustained_wind_knots': max_sustained_wind_knots,
                'min_central_pressure_mb': min_central_pressure_mb
            })
    
    # Flatten the data for easier DataFrame creation
    flat_data = []
    for storm in parsed_data:
        for track in storm['tracks']:
            flat_entry = {
                'storm_id': storm['storm_id'],
                'storm_name': storm['storm_name'],
                **track
            }
            flat_data.append(flat_entry)

    df = pd.DataFrame(flat_data)

    # Convert latitude and longitude to float
    df["latitude_float"] = df.apply(lambda row: float(row["latitude"][:-1]) * (1 if row["latitude"][-1] in ['N', 'n'] else -1), axis=1)
    df["longitude_float"] = df.apply(lambda row: float(row["longitude"][:-1]) * (-1 if row["longitude"][-1] in ['W', 'w'] else 1), axis=1)

    return df

file_path = '/home/ubuntu/upload/Datos_Huracanes_Atlantico.txt'
hurdat_df = parse_hurdat_data(file_path)

# Display first few rows and info
print(hurdat_df.head())
print(hurdat_df.info())

# Add print statements to check types after parsing
print("\nTypes after parsing:")
print(hurdat_df[['date', 'time', 'latitude', 'longitude', 'latitude_float', 'longitude_float']].dtypes)

# Save to CSV for later use
hurdat_df.to_csv('parsed_hurdat_data.csv', index=False)
print("Datos parseados y guardados en parsed_hurdat_data.csv")


