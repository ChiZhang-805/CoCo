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
  },
  {
    name: "ZJU · Xixi Campus", image: "maps/zju-xixi.webp",
    lat: 30.27683, lon: 120.13664, span: 0.008,
    labels: [["Library",42.84,45.32],["Main Teaching Building",56.95,54.14],["Sports and Arts Center",19.69,10.48]]
  },
  {
    name: "ZJU · Huajiachi Campus", image: "maps/zju-huajiachi.webp",
    lat: 30.27079, lon: 120.19109, span: 0.011,
    labels: [["Library",57.31,26.22],["Athletics Track",45.73,53.36],["Botanical Garden",18.36,25.46]]
  },
  {
    name: "ZJU · Zhijiang Campus", image: "maps/zju-zhijiang.webp",
    lat: 30.19331, lon: 120.11931, span: 0.008,
    labels: [["Foreign Language Library",64.45,29.51]]
  },
  {
    name: "ZJU · Zhoushan Campus", image: "maps/zju-zhoushan.webp",
    lat: 30.00115, lon: 122.16038, span: 0.011,
    labels: [["Library",38.4,50.94],["Gymnasium",54.66,55.51],["Administration Building",34.74,71.41]]
  },
  {
    name: "Westlake University · Yunqi Campus", image: "maps/westlake-yunqi.webp",
    lat: 30.13689, lon: 120.0755, span: 0.0055,
    labels: [["School of Science",47.29,44.78],["Life Sciences, Building 1",60.13,64.13],["Residence Hall 6",69.92,38.64]]
  },
  {
    name: "Tsinghua University", image: "maps/tsinghua.webp",
    lat: 40.003, lon: 116.3214, span: 0.011,
    labels: [["Library of Tsinghua University",29.01,48.87],["Tsinghua University History Museum",62.06,70.4],["Building 8",60.43,44.2]]
  },
  {
    name: "Peking University", image: "maps/peking.webp",
    lat: 39.9925, lon: 116.3103, span: 0.012,
    labels: [["Boya Tower",21.18,48.81],["Peking University Press",66.13,59.9],["Bank of Beijing",51.18,71.68]]
  },
  {
    name: "Fudan · Handan Campus", image: "maps/fudan-handan.webp",
    lat: 31.2986, lon: 121.4985, span: 0.009,
    labels: [["Library of Liberal Arts",72.75,53.99],["Center for American Studies",54.13,62.57],["Chemistry Building",43.96,32.49]]
  },
  {
    name: "SJTU · Minhang Campus", image: "maps/sjtu-minhang.webp",
    lat: 31.02755, lon: 121.43231, span: 0.012,
    labels: [["Information Tower",49.45,49.18],["Library of Liberal Arts",73.57,82.75],["Botanical Garden",49.96,28.95]]
  },
  {
    name: "SJTU · Xuhui Campus", image: "maps/sjtu-xuhui.webp",
    lat: 31.202, lon: 121.4332, span: 0.007,
    labels: [["Qianxuesen Library",19.95,35.32]]
  },
  {
    name: "UC Berkeley · Clark Kerr Campus", image: "maps/clark-kerr.webp",
    lat: 37.8641, lon: -122.2495, span: 0.007,
    labels: [["Dining Center & Suites",53.98,54.89],["Recreation Maintenance",68.9,40.42],["Child Care",49.49,25.9]]
  },
  {
    name: "Stanford · Main Quad", image: "maps/stanford.webp",
    lat: 37.42755, lon: -122.17, span: 0.009,
    labels: [["Mendenhall Library",56.01,41.06],["Cecil H. Green Library",74.15,57.85],["Branner Earth Sciences Library",26.68,62.39]]
  },
  {
    name: "UC Davis", image: "maps/uc-davis.webp",
    lat: 38.5391, lon: -121.7492, span: 0.01,
    labels: [["West Quad",46.89,31.37],["Maria Manetti Shrem Art Hall",55.07,51.68],["Chemistry Annex",40.13,63.81]]
  },
  {
    name: "UC Irvine", image: "maps/uc-irvine.webp",
    lat: 33.6456, lon: -117.8426, span: 0.012,
    labels: [["Engineering Tower",60.22,57.11],["Langson Library",60.6,36.78],["Physical Sciences Quad Modulars",24.39,79.61]]
  },
  {
    name: "UC Santa Barbara", image: "maps/uc-santa-barbara.webp",
    lat: 34.4132, lon: -119.847, span: 0.013,
    labels: [["Arts Library",46.75,56.35],["North Hall",53.11,34.93],["Webb Hall",70.7,48.2]]
  },
  {
    name: "UC Santa Cruz", image: "maps/uc-santa-cruz.webp",
    lat: 36.9971, lon: -122.0559, span: 0.011,
    labels: [["Page Smith Library",66.76,51.52],["Crown Lower Quad",60.19,28.54],["Cooling Tower 4 EMS",27.25,39.87]]
  },
  {
    name: "UC Riverside", image: "maps/uc-riverside.webp",
    lat: 33.9735, lon: -117.3281, span: 0.01,
    labels: [["Tomas Rivera Library",55.05,56.14],["Orbach Science Library",80.74,39.64],["Costo Hall",40.67,42.82]]
  },
  {
    name: "UC Merced", image: "maps/uc-merced.webp",
    lat: 37.3657, lon: -120.4255, span: 0.01,
    labels: [["Kolligian Library",56.8,42.89],["Mariposa Hall",33.13,53.82],["The Pavilion",56.94,66.47]]
  },
  {
    name: "Caltech · Pasadena Campus", image: "maps/caltech.webp",
    lat: 34.1376, lon: -118.1253, span: 0.009,
    labels: [["Sherman Fairchild Library",54.4,52.56],["Watchtower",22.14,29.83],["Kerckhoff",35.19,54.69]]
  },
  {
    name: "UW · Seattle Campus", image: "maps/uw-seattle.webp",
    lat: 47.6553, lon: -122.3078, span: 0.01,
    labels: [["Allen Library",54.53,46.04],["Odegaard Undergraduate Library",32.44,38.99],["Chemistry Library Building",35.59,66.07]]
  },
  {
    name: "UW · Bothell Campus", image: "maps/uw-bothell.webp",
    lat: 47.7606, lon: -122.1917, span: 0.008,
    labels: [["Library 2",55.95,55.05],["North Parking Garage",51.83,35.7],["West Parking Garage",32.58,57.14]]
  },
  {
    name: "UW · Tacoma Campus", image: "maps/uw-tacoma.webp",
    lat: 47.2446, lon: -122.4388, span: 0.0065,
    labels: [["Tioga Library Building - S",52.26,51.88],["Washington State History Museum",77.57,43.09],["Laborers Hall",35.98,40.11]]
  },
  {
    name: "Michigan · Central Campus", image: "maps/michigan-central.webp",
    lat: 42.2766, lon: -83.7382, span: 0.009,
    labels: [["Hatcher Graduate Library",50.57,55.01],["Weiser Tower",73.67,47.47],["Kelsey Museum of Archaeology",23.1,48.32]]
  },
  {
    name: "Michigan · North Campus", image: "maps/michigan-north.webp",
    lat: 42.2922, lon: -83.7143, span: 0.009,
    labels: [["Ann and Robert H. Lurie Tower",34.64,52.26],["Bentley Historical Library",65.55,79.46],["Gorguze Family Laboratory",79.77,37.77]]
  },
  {
    name: "MIT · Cambridge Campus", image: "maps/mit.webp",
    lat: 42.3591, lon: -71.0928, span: 0.009,
    labels: [["Rotch Library",45.79,48.37],["N16 Cooling Tower",39.94,26.12],["Hayden Memorial Library",77.21,50.67]]
  },
  {
    name: "Harvard Yard", image: "maps/harvard.webp",
    lat: 42.3744, lon: -71.1163, span: 0.0065,
    labels: [["Memorial Church",52.74,42.17],["Pusey Library",54.75,61.88],["Busch-Reisinger Museum",72.31,50.75]]
  },
  {
    name: "Yale · Old Campus", image: "maps/yale.webp",
    lat: 41.3081, lon: -72.9288, span: 0.0065,
    labels: [["Dwight Hall & Memorial Chapel",44.28,37.1],["Battell Chapel",63.95,29.43],["Bass Library (North)",66.97,8.52]]
  },
  {
    name: "Brown · College Hill", image: "maps/brown.webp",
    lat: 41.8262, lon: -71.4023, span: 0.007,
    labels: [["John Carter Brown Library",48.56,58.38],["Haffenreffer Museum of Anthropology",33.89,46.04],["Soldiers Memorial Gate",68.55,47.62]]
  },
  {
    name: "Cornell · Ithaca Campus", image: "maps/cornell.webp",
    lat: 42.4493, lon: -76.4835, span: 0.009,
    labels: [["Olin Library",43.63,65.02],["Fine Arts Library",53.81,29.02],["Alpha Phi Alpha memorial garden",39.95,84.14]]
  },
  {
    name: "Columbia · Morningside Heights", image: "maps/columbia.webp",
    lat: 40.8075, lon: -73.9626, span: 0.0065,
    labels: [["Low Memorial Library",58.38,39.82],["Butler Library",43.81,66.18],["Newsstand",31.55,43.16]]
  },
  {
    name: "Princeton University", image: "maps/princeton.webp",
    lat: 40.3485, lon: -74.6591, span: 0.009,
    labels: [["Princeton University Chapel",68.38,45.36],["Princeton Public Library",39.99,14.99],["Nassau Hall",48.13,47.72]]
  },
  {
    name: "Penn · Philadelphia Campus", image: "maps/upenn.webp",
    lat: 39.9514, lon: -75.1944, span: 0.009,
    labels: [["Provost Tower",40.11,59.91],["Fisher Fine Arts Library",64.35,47.8],["CHOP West Tower",50.52,79.86]]
  },
  {
    name: "Dartmouth · Hanover Campus", image: "maps/dartmouth.webp",
    lat: 43.7033, lon: -72.2887, span: 0.009,
    labels: [["Rauner Special Collections Library",54.23,36.55],["Hood Museum of Art",60.65,66.97],["Bartlett Tower",80.64,19.79]]
  },
  {
    name: "Northwestern · Evanston Campus", image: "maps/northwestern.webp",
    lat: 42.054, lon: -87.6744, span: 0.009,
    labels: [["Northwestern University Library",51.55,60.02],["Math Library",33.23,40.0],["Levere Memorial Temple",34.46,89.89]]
  },
  {
    name: "UChicago · Hyde Park Campus", image: "maps/uchicago.webp",
    lat: 41.7897, lon: -87.5997, span: 0.009,
    labels: [["Eckhart Library",58.53,43.96],["Bond Chapel",44.34,61.23],["Rockefeller Memorial Chapel",72.62,62.99]]
  },
  {
    name: "Carnegie Mellon · Pittsburgh Campus", image: "maps/carnegie-mellon.webp",
    lat: 40.4431, lon: -79.9428, span: 0.009,
    labels: [["Gesling Stadium",70.56,48.17],["Morewood E-Tower",44.2,28.84],["Hunt Library",41.97,71.73]]
  }
];
