# geocode.openspaceproject.com
This repository backs the webpage at https://geocode.openspaceproject.com that provides access the geocode locations on different celestial bodies other than the Earth. For the Earth, we refer to ESRI's fantastic geocoding [API](https://developers.arcgis.com/rest/geocode/).

https://planetarynames.wr.usgs.gov/GIS_Downloads

## Data
The data was downloaded from the USGS's [Gazetteer of Planetary Nomenclature](https://planetarynames.wr.usgs.gov) through the following steps:

  1. On the [Nomenclature Search](https://planetarynames.wr.usgs.gov/SearchResults) select the "Target"
  2. Leave all other settings on their default. Specifically leave the Coordinate System on "Planetocentric +East 0-360"
  3. "Search"
  4. Download the resulting CSV file with the link at the bottom
  5. Rename the file to the name of the celestial body with all lowercase characters (for example `callisto.csv`)
  6. Place the file in the `data` folder
