import express from "express";
import fs from "fs";
import csv_parser from "csv-parser";
import fuzzy from "fuzzy";

// The keys of this interface have to match the headers in the labels file
interface Location {
  Feature_Name: string;
  Diameter: number;
  Center_Latitude: number;
  Center_Longitude: number;
  Coordinate_System: string;
  Origin: string;
}

let Locations = new Map<string, Location[]>();



//
// main
//

const app = express();

// Read all of the labels files at startup
let files = fs.readdirSync("data");
files = files.filter((file) => file.endsWith(".labels"));
for (let file of files) {
  function loadLocations(dataPath: string): Promise<Location[]> {
    return new Promise((resolve, reject) => {
      const results: Location[] = [];

      const csv = csv_parser({
        skipLines: 5, // = the number of empty lines in the label files
        mapHeaders: (args) => {
          switch (args.header) {
            // Remove the headers that we don't want to load
            case "Target":
            case "Approval_Status":
            case "Approval_Date":
              return null;
            default:
              return args.header;
          }
        }
      });
      fs.createReadStream(dataPath)
        .pipe(csv)
        .on("data", (data) => {
          // Don't add any empty lines
          if (Object.keys(data).length > 0) {
            data.Diameter = Number(data.Diameter);
            data.Center_Latitude = Number(data.Center_Latitude);
            data.Center_Longitude = Number(data.Center_Longitude);
            results.push(data);
          }
        })
        .on("end", () => resolve(results))
        .on("error", (err) => reject(err));
    });
  }

  const planet = file.substring(0, file.indexOf(".labels"));
  let locations = await loadLocations(`data/${file}`);
  Locations.set(planet, locations);
}


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

  const matches = fuzzy.filter(query, locations, { extract: (p) => p.Feature_Name });

  const results = matches.map((match) => {
    const sanitized = match.original.Coordinate_System.trim().replace(/\s+/g, "");
    switch (sanitized) {
      case "Planetographic+West0-360":
        // First flip from west-positive to east-positive
        match.original.Center_Longitude = (360 - match.original.Center_Longitude) % 360;
        // return normalizeTo180Range(lat, lon, "planetographic-west");
      case "Planetographic+East0-360":
      case "Planetocentric+East0-360":
        // Shift from [0, 360] to [-180, 180]
        if (match.original.Center_Longitude > 180) {
          match.original.Center_Longitude -= 360;
        }
    }

    return {
      name: String(match.original.Feature_Name),
      centerLatitude: (match.original.Center_Latitude),
      centerLongitude: (match.original.Center_Longitude),
      diameter: Number(match.original.Diameter),
      origin: String(match.original.Origin),
    };
  });

  res.status(200).json({
    name: planet,
    result: results,
  });
});

const Port = 3000;
app.listen(Port, () => {
  console.log(`Server running at http://localhost:${Port}`);
});
