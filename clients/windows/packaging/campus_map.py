"""Draw an offline SVG from a local OSM extract and a campusMaps extent (requires Shapely 2)."""

import argparse
import math
from pathlib import Path
import xml.etree.ElementTree as ET

from shapely import clip_by_rect
from shapely.geometry import LineString, Polygon, box
from shapely.ops import polygonize, unary_union


def area_style(tags):
    if tags.get("building") not in (None, "no"):
        return 5, "#d7cbc0"
    if tags.get("natural") in ("water", "bay") or tags.get("waterway") == "riverbank" or tags.get("landuse") in ("basin", "reservoir"):
        return 4, "#afd1d9"
    if tags.get("leisure") in ("pitch", "track", "playground"):
        return 3, "#c5d8b7"
    if tags.get("natural") in ("wood", "scrub") or tags.get("landuse") == "forest":
        return 3, "#c3d5b4"
    if tags.get("leisure") in ("park", "garden", "golf_course") or tags.get("landuse") in ("grass", "recreation_ground", "meadow", "village_green") or tags.get("natural") == "grassland":
        return 2, "#d4e1c7"
    if tags.get("amenity") == "parking":
        return 2, "#e4dfd8"
    if tags.get("natural") == "beach":
        return 2, "#f1e7cc"
    if tags.get("amenity") in ("university", "college", "school") or tags.get("landuse") == "education":
        return 1, "#efece4"


def svg_path(shape):
    def ring(coords):
        return "M" + " ".join(f"{x:.2f},{y:.2f}" for x, y in coords)

    if shape.is_empty:
        return ""
    if shape.geom_type == "Polygon":
        return "".join(ring(list(r.coords)[:-1]) + "Z" for r in [shape.exterior, *shape.interiors])
    if shape.geom_type == "LineString":
        return ring(shape.coords)
    return "".join(svg_path(part) for part in getattr(shape, "geoms", ()))


def draw(source, output, lat, lon, span, aspect=1):
    height = 1600
    width = height * aspect
    scale = height / span
    sx = scale * math.cos(math.radians(lat))
    root = ET.parse(source).getroot()
    nodes = {n.get("id"): ((float(n.get("lon")) - lon) * sx + width / 2,
                           (lat - float(n.get("lat"))) * scale + height / 2) for n in root.findall("node")}
    ways = {}
    areas = []
    lines = [[], [], [], []]
    coasts = []

    def clipped(shape):
        return svg_path(clip_by_rect(shape, -12, -12, width + 12, height + 12))

    for way in root.findall("way"):
        pts = [nodes[n.get("ref")] for n in way.findall("nd")]
        if len(pts) < 2:
            continue
        ways[way.get("id")] = pts
        tags = {t.get("k"): t.get("v") for t in way.findall("tag")}
        style = area_style(tags)
        if style and len(pts) >= 4 and pts[0] == pts[-1]:
            areas.append((*style, clipped(Polygon(pts))))
        if tags.get("natural") == "coastline":
            coasts.append(LineString(pts))
        highway = tags.get("highway")
        if highway:
            rank = 1
            if highway in ("unclassified", "residential", "living_street", "service"):
                rank = 2
            elif highway in ("motorway", "trunk", "primary", "secondary", "tertiary"):
                rank = 3
        elif tags.get("waterway") in ("river", "stream", "canal", "ditch"):
            rank = 0
        else:
            continue
        lines[rank].append(clipped(LineString(pts)))

    for rel in root.findall("relation"):
        tags = {t.get("k"): t.get("v") for t in rel.findall("tag")}
        style = area_style(tags)
        if not style or tags.get("type") != "multipolygon":
            continue
        members = [m for m in rel.findall("member") if m.get("type") == "way" and m.get("ref") in ways]
        def rings(role):
            return list(polygonize([LineString(ways[m.get("ref")]) for m in members if (m.get("role") or "outer") == role]))
        holes = rings("inner")
        for outer in rings("outer"):
            inside = [p.exterior for p in holes if outer.covers(p.representative_point())]
            areas.append((*style, clipped(Polygon(outer.exterior, inside))))

    # OSM coastlines run with the sea on the right. The map's y axis points south.
    if coasts:
        frame = box(0, 0, width, height)
        for poly in polygonize(unary_union([frame.boundary, *(line.intersection(frame) for line in coasts)])):
            p = poly.representative_point()
            coast = min(coasts, key=lambda line: line.distance(p))
            at = coast.project(p)
            a = coast.interpolate(max(0, at - 1))
            b = coast.interpolate(min(coast.length, at + 1))
            if (b.x - a.x) * (p.y - a.y) > (b.y - a.y) * (p.x - a.x):
                areas.append((0, "#afd1d9", svg_path(poly)))

    svg = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {width:g} {height}" width="{width:g}" height="{height}">',
           '<desc>Map data © OpenStreetMap contributors, ODbL 1.0 (https://www.openstreetmap.org/copyright).</desc>',
           '<rect width="100%" height="100%" fill="#f4f1eb"/>']
    buildings = []
    for rank, color, path in sorted(areas, key=lambda area: area[0]):
        if path:
            target = buildings if rank == 5 else svg
            target.append(f'<path fill="{color}" fill-rule="evenodd" d="{path}"/>')
    for rank, (color, metres) in enumerate(zip(("#b1d1d8", "#fcfaf4", "#fffdf8", "#f5e8c9"), (3, 1.8, 5, 9))):
        path = "".join(lines[rank])
        if not path:
            continue
        stroke = max(0.65, metres * scale / 111320)
        if rank >= 2:
            svg.append(f'<defs><path id="road{rank}" d="{path}"/></defs>')
            svg.append(f'<use href="#road{rank}" fill="none" stroke="#d6cec1" stroke-width="{stroke + 1:.2f}"/>')
            svg.append(f'<use href="#road{rank}" fill="none" stroke="{color}" stroke-width="{stroke:.2f}"/>')
        else:
            svg.append(f'<path fill="none" stroke="{color}" stroke-width="{stroke:.2f}" d="{path}"/>')
    svg += [*buildings, "</svg>"]
    output.write_text("\n".join(svg) + "\n", encoding="utf-8")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", type=Path)
    parser.add_argument("output", type=Path)
    for key in ("lat", "lon", "span"):
        parser.add_argument(key, type=float)
    parser.add_argument("--aspect", type=float, default=1, help="width / height")
    draw(**vars(parser.parse_args()))
