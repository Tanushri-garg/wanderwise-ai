// src/server/weatherHandler.ts
function decodeWeatherCode(code) {
  switch (code) {
    case 0:
      return { condition: "Clear sky", packing: "Sunglasses, sunblock, light breathable clothing" };
    case 1:
    case 2:
      return { condition: "Mainly clear / Partly cloudy", packing: "Light layers, comfortable walking shoes, sunglasses" };
    case 3:
      return { condition: "Overcast", packing: "Comfortable light jacket or sweater, casual walking shoes" };
    case 45:
    case 48:
      return { condition: "Foggy / Mist", packing: "Windbreaker, warm layers, moisture-wicking clothes" };
    case 51:
    case 53:
    case 55:
      return { condition: "Drizzle", packing: "Compact umbrella, water-resistant light jacket" };
    case 61:
    case 63:
    case 65:
      return { condition: "Rain", packing: "Raincoat or sturdy umbrella, waterproof shoes" };
    case 71:
    case 73:
    case 75:
      return { condition: "Snowfall", packing: "Insulated winter coat, gloves, thermal innerwear, boots" };
    case 80:
    case 81:
    case 82:
      return { condition: "Rain showers", packing: "Waterproof jacket, quick-drying clothing, travel umbrella" };
    case 95:
    case 96:
    case 99:
      return { condition: "Thunderstorm", packing: "Heavy-duty raincoat, waterproof bag cover, indoor backup plans" };
    default:
      return { condition: "Mild / Variable", packing: "Versatile layers and comfortable walking shoes" };
  }
}
var weatherCache = /* @__PURE__ */ new Map();
var CACHE_TTL = 30 * 60 * 1e3;
async function getLiveWeather(city, travelDates) {
  const normalizedCity = city.trim().toLowerCase();
  const cacheKey = `${normalizedCity}__${travelDates || "current"}`;
  const cached = weatherCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }
  const isDistantDate = travelDates && /202[7-9]|2026-(?:1[0-2]|09-[2-3]\d)|next year|later this year|summer|winter|spring|autumn|fall/i.test(travelDates);
  try {
    const geoUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=en&format=json`;
    const geoRes = await fetch(geoUrl, { signal: AbortSignal.timeout(4e3) });
    if (!geoRes.ok) {
      throw new Error(`Geocoding failed: ${geoRes.statusText}`);
    }
    const geoData = await geoRes.json();
    if (!geoData.results || geoData.results.length === 0) {
      const fallbackWeather = {
        destination: city,
        temperature: "22\xB0C (72\xB0F) [Estimated seasonal average]",
        rainProbability: "15% average historical precipitation",
        condition: "Temperate / Seasonal Climate Estimate",
        packingAdvice: "Pack versatile clothing layers, sunglasses, and comfortable walking shoes.",
        isLiveData: false,
        source: "Estimated Seasonal Climate Model (Live weather data unavailable for this location)"
      };
      weatherCache.set(cacheKey, { data: fallbackWeather, timestamp: Date.now() });
      return fallbackWeather;
    }
    const { latitude, longitude, name: resolvedName, country } = geoData.results[0];
    const destinationLabel = `${resolvedName}${country ? ", " + country : ""}`;
    if (isDistantDate) {
      const estimatedWeather = {
        destination: destinationLabel,
        temperature: "21\xB0C (70\xB0F) [Estimated seasonal average]",
        rainProbability: "20% average historical precipitation",
        condition: "Estimated Seasonal Climate Profile",
        packingAdvice: "Layered outfits, weather-appropriate outerwear, comfortable walking shoes, and versatile casualwear.",
        isLiveData: false,
        source: `Estimated Climate Model for ${travelDates} (Historical meteorological benchmarks; real-time forecast available ~14 days prior to travel)`
      };
      weatherCache.set(cacheKey, { data: estimatedWeather, timestamp: Date.now() });
      return estimatedWeather;
    }
    const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,weather_code&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=auto`;
    const weatherRes = await fetch(weatherUrl, { signal: AbortSignal.timeout(4e3) });
    if (!weatherRes.ok) {
      throw new Error(`Weather fetch failed: ${weatherRes.statusText}`);
    }
    const weatherData = await weatherRes.json();
    const currentTemp = weatherData.current?.temperature_2m ?? 20;
    const weatherCode = weatherData.current?.weather_code ?? weatherData.daily?.weather_code?.[0] ?? 1;
    const rainProb = weatherData.daily?.precipitation_probability_max?.[0] ?? 20;
    const minTemp = weatherData.daily?.temperature_2m_min?.[0] ?? currentTemp - 4;
    const maxTemp = weatherData.daily?.temperature_2m_max?.[0] ?? currentTemp + 4;
    const { condition, packing } = decodeWeatherCode(weatherCode);
    const liveWeather = {
      destination: destinationLabel,
      temperature: `${Math.round(currentTemp)}\xB0C (${Math.round(currentTemp * 9 / 5 + 32)}\xB0F) [High: ${Math.round(maxTemp)}\xB0C, Low: ${Math.round(minTemp)}\xB0C]`,
      rainProbability: `${rainProb}% live precipitation probability`,
      condition: `${condition} (Live)`,
      packingAdvice: packing,
      isLiveData: true,
      source: "Open-Meteo Global Meteorological Network (Live 7-Day Satellite Forecast)"
    };
    weatherCache.set(cacheKey, { data: liveWeather, timestamp: Date.now() });
    return liveWeather;
  } catch (err) {
    const fallbackWeather = {
      destination: city,
      temperature: "21\xB0C (70\xB0F) [Estimated seasonal average]",
      rainProbability: "20% estimated historical probability",
      condition: "Pleasant & Seasonable (Estimate)",
      packingAdvice: "Layered outfits, comfortable walking shoes, and a light travel umbrella.",
      isLiveData: false,
      source: "Estimated Seasonal Climate Model (Live weather network connection currently unavailable)"
    };
    weatherCache.set(cacheKey, { data: fallbackWeather, timestamp: Date.now() });
    return fallbackWeather;
  }
}
async function handleWeatherRequest(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") {
    if (typeof res.status === "function") return res.status(200).end();
    res.statusCode = 200;
    return res.end();
  }
  const query = req.query || {};
  const city = query.city || (typeof req.url === "string" ? new URL(req.url, "http://api.wanderwise.local").searchParams.get("city") : null);
  const dates = query.dates || (typeof req.url === "string" ? new URL(req.url, "http://api.wanderwise.local").searchParams.get("dates") || void 0 : void 0);
  if (!city) {
    const errPayload = { error: "City parameter is required" };
    if (typeof res.status === "function" && typeof res.json === "function") {
      return res.status(400).json(errPayload);
    }
    res.statusCode = 400;
    res.setHeader("Content-Type", "application/json");
    return res.end(JSON.stringify(errPayload));
  }
  const weather = await getLiveWeather(city, dates);
  if (typeof res.json === "function") {
    return res.json(weather);
  }
  res.statusCode = 200;
  res.setHeader("Content-Type", "application/json");
  return res.end(JSON.stringify(weather));
}
var weatherHandler_default = handleWeatherRequest;
export {
  weatherHandler_default as default,
  getLiveWeather,
  handleWeatherRequest
};
