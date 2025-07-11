import express from "express";
import fs from "fs";
import path from "path";
import csv from "csv-parser";
import fuzzy from "fuzzy";

interface Location {
  Feature_Name: string;
  Target: string;
  Diameter: number;
  Center_Latitude: number;
  Center_Longitude: number;
  Coordinate_System: string;
  Approval_Status: string;
  Approval_Date: string;
  Origin: string;
}

interface SearchResult {
  name: string;
  centerLatitude: number;
  centerLongitude: number;
  diameter: number;
  origin: string;
}

const app = express();
const PORT = 3000;
const csvFilePath = path.join(__dirname, "..", "data");

function loadLocations(dataPath: string): Promise<Location[]> {
  return new Promise((resolve, reject) => {
    const results: Location[] = [];

    fs.createReadStream(dataPath)
      .pipe(csv({ skipLines: 5 }))
      .on("data", (data) => {
        results.push(data);
      })
      .on("end", () => resolve(results))
      .on("error", (err) => reject(err));
  });
}

function normalizeTo180Range(
  lat: number,
  lon: number,
  system: "planetographic-east" | "planetographic-west" | "planetocentric-east"
): { latitude: number; longitude: number } {
  let normalizedLat = lat;
  let normalizedLon = lon;

  if (system === "planetographic-west") {
    // First flip from west-positive to east-positive
    normalizedLon = (360 - lon) % 360;
  }

  // Then shift from [0, 360] to [-180, 180]
  if (normalizedLon > 180) normalizedLon -= 360;

  return { latitude: normalizedLat, longitude: normalizedLon };
}

function convertCoordinateSystem(
  coordinateSystem: string,
  lat: number,
  lon: number
): { latitude: number; longitude: number } | undefined {
  const sanitized = coordinateSystem.trim().replace(/\s+/g, "");
  if (sanitized === "Planetographic+West0-360") {
    return normalizeTo180Range(lat, lon, "planetographic-west");
  }
  if (sanitized === "Planetographic+East0-360") {
    return normalizeTo180Range(lat, lon, "planetographic-east");
  }
  if (sanitized === "Planetocentric+East0-360") {
    return normalizeTo180Range(lat, lon, "planetocentric-east");
  }

  return undefined; // Default case
}

app.get("/1/search/:planet", async (req, res) => {
  if (!req.params.planet) {
    res.status(400).json({ error: "Planet name is required" });
    return;
  }

  const planet = req.params.planet.toLowerCase();
  const query = req.query?.query || undefined;

  if (typeof planet !== "string" || !planet) {
    res.status(400).json({ error: "Invalid planet name" });
    return;
  }
  const finalPath = path.join(csvFilePath, `${planet}.labels`);

  if (!query) {
    try {
      const hasData = fs.existsSync(finalPath);
      res.set("Access-Control-Allow-Origin", "*");
      res.json({ hasData: hasData });
    } catch (err) {
      res.status(500).json({ error: "Error checking file existence" });
    }
    return;
  }
  try {
    const locations = await loadLocations(finalPath);
    const filteredLocations = locations.filter((p) => p.Feature_Name);

    const matches = fuzzy.filter(query as string, filteredLocations, {
      extract: (p) => p.Feature_Name,
    });

    const results: SearchResult[] = matches
      .map((match) => {
        const normalizedCoords = convertCoordinateSystem(
          match.original.Coordinate_System,
          match.original.Center_Latitude,
          match.original.Center_Longitude
        );
        if (!normalizedCoords) {
          return null;
        }
        const { latitude, longitude } = normalizedCoords;
        return {
          name: String(match.original.Feature_Name),
          centerLatitude: Number(latitude),
          centerLongitude: Number(longitude),
          diameter: Number(match.original.Diameter),
          origin: String(match.original.Origin),
        };
      })
      .filter((result) => result !== null);
    res.set("Access-Control-Allow-Origin", "*");
    res.json({
      name: planet,
      result: results,
    });
  } catch (err) {
    res.status(500).json({ error: err });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
