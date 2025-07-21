import express from "express";
import fs from "fs";
import csv_parser from "csv-parser";
import fuzzy from "fuzzy";

// The keys of this interface have to match the headers in the csv file
interface Location {
  FeatureName: string;
  Diameter: number;
  CenterLatitude: number;
  CenterLongitude: number;
  FeatureType: string;
  ApprovalDate: number;
  Origin: string;
}

let Locations = new Map<string, Location[]>();



//
// main
//

const app = express();

// Read all of the csv files at startup
let files = fs.readdirSync("data");
files = files.filter((file) => file.endsWith(".csv"));
for (let file of files) {
  function loadLocations(dataPath: string): Promise<Location[]> {
    return new Promise((resolve, reject) => {
      const results: Location[] = [];

      const csv = csv_parser({
        mapHeaders: (args) => {
          const header = args.header.trim().replace(/\s+/g, "");
          switch (header) {
            // Remove the headers that we don't want to load
            case "Target":
                return null;
            default:
              return header;
          }
        }
      });
      fs.createReadStream(dataPath)
        .pipe(csv)
        .on("data", (data) => {
          // Don't add any empty lines
          if (Object.keys(data).length > 0) {
            data.Diameter = Number(data.Diameter);
            data.CenterLatitude = Number(data.CenterLatitude);
            data.CenterLongitude = Number(data.CenterLongitude);
            data.ApprovalDate = Number(data.ApprovalDate);
            results.push(data);
          }
        })
        .on("end", () => resolve(results))
        .on("error", (err) => reject(err));
    });
  }

  const planet = file.substring(0, file.indexOf(".csv"));
  let locations = await loadLocations(`data/${file}`);
  Locations.set(planet, locations);
}

app.get("/", (req, res) => res.sendFile("public/index.html", { root: "." }));

app.get("/1/search", (req, res) => {
  res.set("Access-Control-Allow-Origin", "*");

  res.status(200).json({
    planets: Array.from(Locations.keys())
  });
});

app.get("/1/list/:planet", (req, res) => {
  const planet = req.params.planet.toLowerCase();
  const locations = Locations.get(planet);

  res.set("Access-Control-Allow-Origin", "*");

  if (locations === undefined) {
    // The requested planet does not have any locations
    res.status(404).json({ hasData: false });
    return;
  }

  res.status(200).json({
    name: planet,
    result: locations
  });
});

app.get("/1/search/:planet", (req, res) => {
  const planet = req.params.planet.toLowerCase();
  const locations = Locations.get(planet);

  res.set("Access-Control-Allow-Origin", "*");

  if (locations === undefined) {
    // The requested planet does not have any locations
    res.status(404).json({ hasData: false });
    return;
  }

  const query = req.query?.query as string || undefined;
  if (!query) {
    // An empty query will just check whether we have data for the provided planet
    const hasData = locations !== undefined;
    res.status(200).json({ hasData: hasData });
    return;
  }

  const matches = fuzzy.filter(query, locations, { extract: (p) => p.FeatureName });

  const results = matches.map((match) => {
    // All values are provided in Planetocentric +East 0-360
    if (match.original.CenterLongitude > 180) {
      match.original.CenterLongitude -= 360;
    }

    return {
      name: match.original.FeatureName,
      centerLatitude: match.original.CenterLatitude,
      centerLongitude: match.original.CenterLongitude,
      diameter: match.original.Diameter,
      type: match.original.FeatureType,
      origin: match.original.Origin,
    };
  });

  res.status(200).json({
    name: planet,
    result: results
  });
});

const Port = 3000;
app.listen(Port, () => {
  console.log(`Server running at http://localhost:${Port}`);
});
