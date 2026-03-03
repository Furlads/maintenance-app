export const runtime = "nodejs";

import { NextResponse } from "next/server";

function clean(v: unknown) {
  return typeof v === "string" ? v.trim() : "";
}

const cache = new Map<string, { words: string; link: string; ts: number }>();
const CACHE_MS = 1000 * 60 * 60 * 6; // 6 hours

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const address = clean(url.searchParams.get("address"));
    const country = (clean(url.searchParams.get("country")) || "gb").toLowerCase();

    if (!address) return NextResponse.json({ error: "Missing address" }, { status: 400 });

    const key = process.env.WHAT3WORDS_API_KEY;
    if (!key) return NextResponse.json({ error: "Missing WHAT3WORDS_API_KEY" }, { status: 500 });

    const cacheKey = `${country}::${address.toLowerCase()}`;
    const hit = cache.get(cacheKey);
    const now = Date.now();
    if (hit && now - hit.ts < CACHE_MS) {
      return NextResponse.json({ words: hit.words, link: hit.link, cached: true });
    }

    // 1) Geocode address -> lat/lng (temporary, not stored)
    const geoUrl = new URL("https://nominatim.openstreetmap.org/search");
    geoUrl.searchParams.set("format", "json");
    geoUrl.searchParams.set("q", address);
    geoUrl.searchParams.set("limit", "1");
    geoUrl.searchParams.set("addressdetails", "0");
    geoUrl.searchParams.set("countrycodes", country);

    const geoRes = await fetch(geoUrl.toString(), {
      cache: "no-store",
      headers: {
        "User-Agent": "Furlads-Maintenance-App/1.0 (what3words-link-from-address)",
      },
    });

    const geo = (await geoRes.json().catch(() => [])) as any[];
    if (!Array.isArray(geo) || geo.length === 0) {
      return NextResponse.json({ error: "Could not find that address" }, { status: 404 });
    }

    const lat = Number(geo[0]?.lat);
    const lng = Number(geo[0]?.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return NextResponse.json({ error: "Geocoding failed" }, { status: 500 });
    }

    // 2) Convert coordinates -> what3words (words + link)
    const w3wUrl = new URL("https://api.what3words.com/v3/convert-to-3wa");
    w3wUrl.searchParams.set("key", key);
    w3wUrl.searchParams.set("coordinates", `${lat},${lng}`);
    w3wUrl.searchParams.set("language", "en");

    const w3wRes = await fetch(w3wUrl.toString(), { cache: "no-store" });
    const w3w = await w3wRes.json().catch(() => ({}));

    if (!w3wRes.ok) {
      return NextResponse.json(
        { error: w3w?.error?.message || "what3words lookup failed" },
        { status: w3wRes.status }
      );
    }

    const words = clean(w3w?.words);
    if (!words) return NextResponse.json({ error: "what3words returned no words" }, { status: 500 });

    // Official-ish share link pattern:
    // https://what3words.com/filled.count.soap
    const link = `https://what3words.com/${encodeURIComponent(words)}`;

    cache.set(cacheKey, { words, link, ts: now });

    return NextResponse.json({ words, link, cached: false });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Lookup failed" }, { status: 500 });
  }
}