// Google encoded polyline dekoderis (precision 5) → [lat, lng][].
export function decodePolyline(encoded: string, precision = 5): [number, number][] {
  const factor = 10 ** precision;
  const out: [number, number][] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;
  const next = (): number => {
    let result = 0;
    let shift = 0;
    let b: number;
    do {
      if (index >= encoded.length) throw new Error("Sugadinta polilinija");
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    return result & 1 ? ~(result >> 1) : result >> 1;
  };
  while (index < encoded.length) {
    lat += next();
    lng += next();
    out.push([lat / factor, lng / factor]);
  }
  return out;
}
