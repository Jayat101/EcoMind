import axios from "axios";

/**
 * Climatiq API Client & Helper
 * Official API Endpoint: https://api.climatiq.io/data/v1/estimate
 */

const CLIMATIQ_API_URL = "https://api.climatiq.io/data/v1/estimate";

// Mapping local EcoMind vehicle types to Climatiq Emission Factor Activity IDs / Categories
const VEHICLE_MAPPINGS = {
  bus: {
    emission_factor: {
      activity_id: "passenger_vehicle-vehicle_type_bus-fuel_source_na-engine_size_na",
      data_version: "^5"
    }
  },
  ev: {
    emission_factor: {
      activity_id: "passenger_vehicle-vehicle_type_car-fuel_source_bev-engine_size_na",
      data_version: "^5"
    }
  },
  gasoline_car: {
    emission_factor: {
      activity_id: "passenger_vehicle-vehicle_type_car-fuel_source_petrol-engine_size_na",
      data_version: "^5"
    }
  },
  motorbike: {
    emission_factor: {
      activity_id: "passenger_vehicle-vehicle_type_motorbike-fuel_source_petrol-engine_size_na",
      data_version: "^5"
    }
  }
};

/**
 * Calculate transportation emissions via Climatiq API
 * @param {string} vehicleType 
 * @param {number} distanceKm 
 * @returns {Promise<number | null>} Emission in kg CO2e, or null if unmapped / failed
 */
export async function fetchClimatiqTransportEmissions(vehicleType, distanceKm) {
  const apiKey = process.env.CLIMATIQ_API_KEY;
  if (!apiKey || !distanceKm || distanceKm <= 0) return null;

  const mapping = VEHICLE_MAPPINGS[vehicleType];
  if (!mapping) return null;

  try {
    const response = await axios.post(
      CLIMATIQ_API_URL,
      {
        emission_factor: mapping.emission_factor,
        parameters: {
          distance: distanceKm,
          distance_unit: "km"
        }
      },
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        },
        timeout: 4000
      }
    );

    if (response.data && typeof response.data.co2e === "number") {
      return response.data.co2e;
    }
  } catch (error) {
    console.warn(`[CLIMATIQ API NOTICE] Direct API call skipped (${error.message}). Using local factor fallback.`);
  }

  return null;
}

/**
 * Calculate electricity energy emissions via Climatiq API
 * @param {number} kwh 
 * @returns {Promise<number | null>} Emission in kg CO2e, or null if failed
 */
export async function fetchClimatiqEnergyEmissions(kwh) {
  const apiKey = process.env.CLIMATIQ_API_KEY;
  if (!apiKey || !kwh || kwh <= 0) return null;

  try {
    const response = await axios.post(
      CLIMATIQ_API_URL,
      {
        emission_factor: {
          activity_id: "electricity-supply_grid-source_supplier_mix",
          data_version: "^5"
        },
        parameters: {
          energy: kwh,
          energy_unit: "kWh"
        }
      },
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        },
        timeout: 4000
      }
    );

    if (response.data && typeof response.data.co2e === "number") {
      return response.data.co2e;
    }
  } catch (error) {
    console.warn(`[CLIMATIQ API NOTICE] Energy estimation skipped (${error.message}). Using local factor fallback.`);
  }

  return null;
}
