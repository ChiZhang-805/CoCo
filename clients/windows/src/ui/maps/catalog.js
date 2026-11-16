'use strict';

// North-up equirectangular maps. Span is the image's height in degrees of latitude.
const campusMaps = [
  {
    name: 'Haining International Campus', image: 'haining-campus.webp',
    lat: 30.52079, lon: 120.72156, span: 0.032, aspect: 2352 / 5376,
    labels: [['Library',55.092,45.726], ['Auditorium',43.562,52.131], ['Residences',76.099,49.294],
      ['Juanhu Park',46.196,95.919], ['Bell Tower',57.112,46.761,true],
      ['Student Center',58.631,49.037,true], ['East Theatre',48.242,54.579,true]]
  },
  {
    name: "ZJU · Zijingang Campus", image: "maps/zijingang.webp",
    lat: 30.3057, lon: 120.0835, span: 0.016,
    labels: [["Library",51.09,47.38],["West Track",15.36,39.61],["Theater A",37.73,46.51,true]]
  },
  {
    name: "ZJU · Yuquan Campus", image: "maps/yuquan.webp",
    lat: 30.2637, lon: 120.1211, span: 0.012,
    labels: [["Library",9.66,36.61],["Shaw Gymnasium",31.85,24.36,true],["Student Center",33.94,17.95]]
  },
  {
    name: "UIUC · Main Quad", image: "maps/main-quad.webp",
    lat: 40.1073, lon: -88.2272, span: 0.0057,
    labels: [["Illini Union",49.26,13.15],["Foellinger Auditorium",49.77,73.66],["Main Quad",49.75,45.65]]
  },
  {
    name: "UIUC · Bardeen Quad", image: "maps/bardeen-quad.webp",
    lat: 40.1115, lon: -88.2268, span: 0.0057,
    labels: [["Grainger Library",49.19,33.46],["Engineering Hall",47.58,60.41],["Bardeen Quad",46.07,42.63]]
  },
  {
    name: "UIUC · South Quad", image: "maps/south-quad.webp",
    lat: 40.1022, lon: -88.2272, span: 0.0057,
    labels: [["McFarland Bell Tower",50.12,38.94,true],["Funk Library",77.74,38.85],["South Quad",51.48,40.22]]
  },
  {
    name: "UCSD · La Jolla Campus", image: "maps/la-jolla.webp",
    lat: 32.8805, lon: -117.2374, span: 0.016,
    labels: [["Geisel Library",49.05,46.01],["Price Center",54.7,55.2],["WongAvery Library",52.26,82.61]]
  },
  {
    name: "UCSD · Scripps Oceanography", image: "maps/scripps.webp",
    lat: 32.865, lon: -117.2527, span: 0.0088,
    labels: [["Old Scripps Building",36.95,49.45],["Seaside Forum",36.44,56.31],["Sumner Auditorium",47.69,52.54,true]]
  },
  {
    name: "UCSD · Hillcrest Medical Campus", image: "maps/hillcrest.webp",
    lat: 32.7544, lon: -117.1662, span: 0.0096,
    labels: [["Hillcrest Medical Center",55.72,38.91],["Arbor Parking",38.23,53.08],["First Avenue Parking",73.3,50.05]]
  },
  {
    name: "UCLA · Westwood Campus", image: "maps/westwood.webp",
    lat: 34.0719, lon: -118.4436, span: 0.014,
    labels: [["Pauley Pavilion",31.25,60.86],["Powell Library",58.41,52.38],["Royce Hall",58.35,42.83]]
  },
  {
    name: "UC Berkeley · Campus Park", image: "maps/campus-park.webp",
    lat: 37.8718, lon: -122.2593, span: 0.012,
    labels: [["Sather Gate",48.63,63],["Sather Tower",59.66,47.83],["Doe Library",48.6,46.77]]
  },
  {
    name: "Westlake University · Yungu Campus", image: "maps/yungu.webp",
    lat: 30.336, lon: 120.032, span: 0.014,
    labels: [["Academic Auditorium",52.44,47.56],["Library",42.11,36.33],["Student Center",68.94,29.89]]
  }
];
