import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Camera, Map, type StyleSpecification } from '@maplibre/maplibre-react-native';
import { SrcNote, color } from '@basalt/ui';
import { buildWalkMapStyle, cameraForRoute, DEV_TILES, type RoutePt, type TileConfig } from '@basalt/training';

// Licensed tile provider via env (see route-map.ts for documented options);
// without both vars set, the dev CARTO tiles apply.
const TILES: TileConfig =
  process.env.EXPO_PUBLIC_TILE_URL && process.env.EXPO_PUBLIC_TILE_ATTRIBUTION
    ? { url: process.env.EXPO_PUBLIC_TILE_URL, attribution: process.env.EXPO_PUBLIC_TILE_ATTRIBUTION }
    : DEV_TILES;

// The walk map tile — a thin native shell around the pure builders in
// @basalt/training (style JSON, camera fit). Static by design: a summary,
// not an explorer, so every gesture is off and the camera is computed
// deterministically from the route bbox. Dark OSM-data raster (CARTO
// rendering), single accent route, hollow start / filled end, scale bar.

export function WalkMap({ route, height = 210 }: { route: RoutePt[]; height?: number }) {
  const [width, setWidth] = useState(0);
  const mapStyle = useMemo(
    () => buildWalkMapStyle(route, { bg: color.bg, accent: color.carbs }, TILES) as StyleSpecification,
    [route],
  );
  const cam = useMemo(
    () => (width > 0 ? cameraForRoute(route, { widthPx: width, heightPx: height }) : null),
    [route, width, height],
  );
  if (route.length < 2) return null;

  return (
    <>
      <View
        style={[styles.wrap, { height }]}
        onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      >
        {cam ? (
          <Map
            style={styles.map}
            mapStyle={mapStyle}
            scaleBar
            attribution
            attributionPosition={{ bottom: 6, right: 6 }}
            logo={false}
            compass={false}
            dragPan={false}
            touchZoom={false}
            doubleTapZoom={false}
            touchRotate={false}
            touchPitch={false}
          >
            <Camera initialViewState={{ center: cam.center, zoom: cam.zoom }} />
          </Map>
        ) : null}
      </View>
      <SrcNote>{`Map ${TILES.attribution} · route from your GPS only`}</SrcNote>
    </>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.border,
    backgroundColor: '#101216',
    marginTop: 12,
    marginBottom: 4,
  },
  map: { flex: 1 },
});
