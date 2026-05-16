export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";

type AccuWeatherLocation = {
  Key?: string;
  EnglishName?: string;
  LocalizedName?: string;
};

type AccuWeatherForecast = {
  Headline?: {
    Text?: string;
  };
  DailyForecasts?: Array<{
    Date?: string;
    Day?: {
      IconPhrase?: string;
      HasPrecipitation?: boolean;
      PrecipitationType?: string;
      PrecipitationIntensity?: string;
    };
    Night?: {
      IconPhrase?: string;
      HasPrecipitation?: boolean;
      PrecipitationType?: string;
      PrecipitationIntensity?: string;
    };
    Temperature?: {
      Minimum?: {
        Value?: number;
        Unit?: string;
      };
      Maximum?: {
        Value?: number;
        Unit?: string;
      };
    };
  }>;
};

function cleanPostcode(value: string | null) {
  return String(value || "").trim().toUpperCase();
}

function buildWeatherSummary(forecast: AccuWeatherForecast) {
  const day = forecast.DailyForecasts?.[0];

  if (!day) {
    return "Weather unavailable — check conditions before setting off.";
  }

  const dayPhrase = day.Day?.IconPhrase || "Forecast available";
  const headline = forecast.Headline?.Text || "";
  const min = day.Temperature?.Minimum?.Value;
  const max = day.Temperature?.Maximum?.Value;
  const unit = day.Temperature?.Maximum?.Unit || "C";

  const hasRain =
    day.Day?.HasPrecipitation || day.Night?.HasPrecipitation || false;

  const tempText =
    typeof min === "number" && typeof max === "number"
      ? ` ${Math.round(min)}-${Math.round(max)}°${unit}.`
      : "";

  if (hasRain) {
    const rainType =
      day.Day?.PrecipitationType ||
      day.Night?.PrecipitationType ||
      "precipitation";

    return `🌧️ ${dayPhrase}. ${rainType} expected today.${tempText}`;
  }

  if (headline) {
    return `🌦️ ${dayPhrase}. ${headline}${tempText}`;
  }

  return `🌦️ ${dayPhrase}.${tempText}`;
}

export async function GET(req: Request) {
  try {
    const apiKey = process.env.ACCUWEATHER_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        {
          ok: false,
          summary:
            "Weather unavailable — AccuWeather API key has not been added.",
        },
        { status: 200 }
      );
    }

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

    const locationUrl = `https://dataservice.accuweather.com/locations/v1/postalcodes/GB/search?apikey=${encodeURIComponent(
      apiKey
    )}&q=${encodeURIComponent(postcode)}`;

    const locationRes = await fetch(locationUrl, {
      cache: "no-store",
    });

    const locations: AccuWeatherLocation[] = await locationRes
      .json()
      .catch(() => []);

    const locationKey = locations?.[0]?.Key;

    if (!locationRes.ok || !locationKey) {
      return NextResponse.json(
        {
          ok: false,
          postcode,
          summary:
            "Weather unavailable — postcode could not be matched to a forecast location.",
        },
        { status: 200 }
      );
    }

    const forecastUrl = `https://dataservice.accuweather.com/forecasts/v1/daily/1day/${encodeURIComponent(
      locationKey
    )}?apikey=${encodeURIComponent(apiKey)}&metric=true&details=true`;

    const forecastRes = await fetch(forecastUrl, {
      cache: "no-store",
    });

    const forecast: AccuWeatherForecast | null = await forecastRes
      .json()
      .catch(() => null);

    if (!forecastRes.ok || !forecast) {
      return NextResponse.json(
        {
          ok: false,
          postcode,
          summary: "Weather unavailable — forecast could not be loaded.",
        },
        { status: 200 }
      );
    }

    return NextResponse.json(
      {
        ok: true,
        postcode,
        locationKey,
        locationName:
          locations?.[0]?.EnglishName || locations?.[0]?.LocalizedName || null,
        summary: buildWeatherSummary(forecast),
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