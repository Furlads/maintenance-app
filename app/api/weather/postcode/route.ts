export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";

type PostcodesIoResponse = {
  status?: number;
  result?: {
    postcode?: string;
    latitude?: number;
    longitude?: number;
    admin_district?: string | null;
    parish?: string | null;
  } | null;
};

type OpenMeteoResponse = {
  daily?: {
    time?: string[];
    weather_code?: number[];
    temperature_2m_max?: number[];
    temperature_2m_min?: number[];
    precipitation_probability_max?: number[];
    precipitation_sum?: number[];
    wind_gusts_10m_max?: number[];
  };
};

function cleanPostcode(value: string | null) {
  return String(value || "").trim().toUpperCase().replace(/\s+/g, " ");
}

function weatherPhrase(code: number | undefined) {
  if (code === 0) return "Clear";
  if (code === 1) return "Mainly clear";
  if (code === 2) return "Partly cloudy";
  if (code === 3) return "Overcast";
  if (code === 45 || code === 48) return "Foggy";
  if ([51, 53, 55, 56, 57].includes(code ?? -1)) return "Drizzle";
  if ([61, 63, 65, 66, 67].includes(code ?? -1)) return "Rain";
  if ([71, 73, 75, 77].includes(code ?? -1)) return "Snow";
  if ([80, 81, 82].includes(code ?? -1)) return "Rain showers";
  if ([85, 86].includes(code ?? -1)) return "Snow showers";
  if ([95, 96, 99].includes(code ?? -1)) return "Thunderstorms";
  return "Forecast available";
}

function weatherEmoji(code: number | undefined) {
  if (code === 0 || code === 1) return "☀️";
  if (code === 2) return "⛅";
  if (code === 3) return "☁️";
  if (code === 45 || code === 48) return "🌫️";
  if ([71, 73, 75, 77, 85, 86].includes(code ?? -1)) return "🌨️";
  if ([95, 96, 99].includes(code ?? -1)) return "⛈️";
  if ([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82].includes(code ?? -1)) return "🌧️";
  return "🌦️";
}

function buildSummary(forecast: OpenMeteoResponse) {
  const daily = forecast.daily;
  const code = daily?.weather_code?.[0];
  const min = daily?.temperature_2m_min?.[0];
  const max = daily?.temperature_2m_max?.[0];
  const rainChance = daily?.precipitation_probability_max?.[0];
  const rainTotal = daily?.precipitation_sum?.[0];
  const gust = daily?.wind_gusts_10m_max?.[0];

  const parts = [`${weatherEmoji(code)} ${weatherPhrase(code)}`];

  if (typeof min === "number" && typeof max === "number") {
    parts.push(`${Math.round(min)}–${Math.round(max)}°C`);
  }

  if (typeof rainChance === "number" && rainChance > 15) {
    parts.push(`${Math.round(rainChance)}% chance of rain`);
  } else if (typeof rainTotal === "number" && rainTotal > 0) {
    parts.push(`${rainTotal.toFixed(1)}mm rain`);
  }

  if (typeof gust === "number" && gust >= 40) {
    parts.push(`gusts up to ${Math.round(gust)} km/h`);
  }

  return `${parts.join(" · ")}.`;
}

async function lookupPostcode(postcode: string) {
  const url = `https://api.postcodes.io/postcodes/${encodeURIComponent(postcode.replace(/\s+/g, ""))}`;
  const response = await fetch(url, { cache: "no-store" });
  const data: PostcodesIoResponse | null = await response.json().catch(() => null);

  if (!response.ok || !data?.result) return null;

  const latitude = Number(data.result.latitude);
  const longitude = Number(data.result.longitude);

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;

  return {
    latitude,
    longitude,
    postcode: data.result.postcode || postcode,
    locationName: data.result.admin_district || data.result.parish || data.result.postcode || postcode,
  };
}

async function loadOpenMeteo(latitude: number, longitude: number) {
  const params = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
    daily: [
      "weather_code",
      "temperature_2m_max",
      "temperature_2m_min",
      "precipitation_probability_max",
      "precipitation_sum",
      "wind_gusts_10m_max",
    ].join(","),
    timezone: "Europe/London",
    forecast_days: "1",
  });

  const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params.toString()}`, {
    cache: "no-store",
  });
  const data: OpenMeteoResponse | null = await response.json().catch(() => null);

  if (!response.ok || !data?.daily) return null;
  return data;
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const postcode = cleanPostcode(searchParams.get("postcode"));

    if (!postcode) {
      return NextResponse.json(
        {
          ok: false,
          summary: "Weather unavailable — no postcode found for next job.",
        },
        { status: 200 }
      );
    }

    const location = await lookupPostcode(postcode);

    if (!location) {
      return NextResponse.json(
        {
          ok: false,
          postcode,
          summary: "Weather unavailable — postcode could not be located.",
        },
        { status: 200 }
      );
    }

    const forecast = await loadOpenMeteo(location.latitude, location.longitude);

    if (!forecast) {
      return NextResponse.json(
        {
          ok: false,
          postcode: location.postcode,
          locationName: location.locationName,
          summary: "Weather unavailable — forecast could not be loaded.",
        },
        { status: 200 }
      );
    }

    return NextResponse.json(
      {
        ok: true,
        postcode: location.postcode,
        locationName: location.locationName,
        summary: buildSummary(forecast),
        forecast,
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (error) {
    console.error("GET /api/weather/postcode failed:", error);

    return NextResponse.json(
      {
        ok: false,
        summary: "Weather unavailable — check conditions before setting off.",
      },
      { status: 200 }
    );
  }
}
