import { useEffect, useRef } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { env } from '@/lib/env';
import type { LatLng } from '@/lib/geo';
import { FRACTURE_STYLE, type Fracture } from './types';

interface MapboxMapProps {
  centre: LatLng;
  fractures: Fracture[];
  player: LatLng;
  secondPlayer: LatLng | null;
  selectedId: string | null;
  draggable: boolean;
  onSelect: (id: string) => void;
  onPlayerMove: (pos: LatLng) => void;
  /** Fires with the map's centre after a pan (explore mode). */
  onCentreChange?: (pos: LatLng) => void;
  /** Bump to recentre the map back on the player. */
  recentreSignal?: number;
}

function fractureEl(type: Fracture['type'], selected: boolean): HTMLElement {
  const color = FRACTURE_STYLE[type].color;
  const el = document.createElement('button');
  el.className = 'aura-fracture-marker';
  el.style.cssText = [
    'width:26px;height:26px;border:none;cursor:pointer;border-radius:9999px',
    'background:transparent;padding:0;display:grid;place-items:center',
  ].join(';');
  el.innerHTML = `
    <span style="position:absolute;width:26px;height:26px;border-radius:9999px;
      background:${color};opacity:0.20;filter:blur(6px)"></span>
    <span style="width:12px;height:12px;border-radius:9999px;background:${color};
      box-shadow:0 0 8px ${color}${selected ? ';outline:2px solid ' + color + ';outline-offset:3px' : ''}"></span>`;
  return el;
}

function dotEl(color: string, ring = false): HTMLElement {
  const el = document.createElement('div');
  el.style.cssText = `width:18px;height:18px;border-radius:9999px;background:${color};box-shadow:0 0 10px ${color}${ring ? ';border:2px solid #eaffff' : ''}`;
  return el;
}

/**
 * Mapbox GL basemap styled to the concept art (deep navy night). Fractures are
 * DOM markers with the same glow language as the schematic map; the player pin
 * is draggable in sim mode so the desk loop is unchanged. Rendered only when a
 * Mapbox token is present — MapScreen falls back to the schematic map otherwise.
 */
export function MapboxMap(props: MapboxMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markers = useRef<Map<string, mapboxgl.Marker>>(new Map());
  const playerMarker = useRef<mapboxgl.Marker | null>(null);
  const partnerMarker = useRef<mapboxgl.Marker | null>(null);
  const dragging = useRef(false);
  // Latest callbacks, so marker listeners never go stale.
  const cbs = useRef(props);
  cbs.current = props;

  // Mount the map once.
  useEffect(() => {
    if (!containerRef.current) return;
    mapboxgl.accessToken = env.mapboxToken;
    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: 'mapbox://styles/mapbox/dark-v11',
      center: [props.centre.lng, props.centre.lat],
      zoom: 15,
      attributionControl: false,
    });
    mapRef.current = map;

    // Guard against the map initialising before its container has its final
    // size (React dev double-mount, late fl/grid layout): repaint on load and on
    // any container resize, or markers land off the rendered canvas until a pan.
    map.on('load', () => map.resize());
    const ro = new ResizeObserver(() => map.resize());
    ro.observe(containerRef.current);

    const pEl = dotEl('#4fd6ff', true);
    const pm = new mapboxgl.Marker({ element: pEl, draggable: props.draggable })
      .setLngLat([props.player.lng, props.player.lat])
      .addTo(map);
    pm.on('dragstart', () => (dragging.current = true));
    pm.on('drag', () => cbs.current.onPlayerMove({ lat: pm.getLngLat().lat, lng: pm.getLngLat().lng }));
    pm.on('dragend', () => {
      dragging.current = false;
      cbs.current.onPlayerMove({ lat: pm.getLngLat().lat, lng: pm.getLngLat().lng });
    });
    playerMarker.current = pm;

    // Explore mode: report the map centre after any pan/zoom the user drives, so
    // MapScreen can fetch Fractures around where they're looking rather than only
    // around the player pin. Guarded by the drag flag so dragging the player pin
    // (which also moves the centre via easeTo) doesn't double-report.
    map.on('moveend', () => {
      if (dragging.current) return;
      cbs.current.onCentreChange?.({ lat: map.getCenter().lat, lng: map.getCenter().lng });
    });

    return () => {
      // map.remove() detaches every marker it owns; the component (and its refs)
      // is torn down with it, so there is nothing else to clean up.
      ro.disconnect();
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reconcile Fracture markers whenever the visible set or selection changes.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const seen = new Set<string>();
    for (const f of props.fractures) {
      seen.add(f.id);
      // Recreate each marker so the selected-outline state stays correct; the
      // visible set is small (nearby Fractures only), so this is cheap.
      markers.current.get(f.id)?.remove();
      const el = fractureEl(f.type, f.id === props.selectedId);
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        cbs.current.onSelect(f.id);
      });
      const m = new mapboxgl.Marker({ element: el })
        .setLngLat([f.geo.lng, f.geo.lat])
        .addTo(map);
      markers.current.set(f.id, m);
    }
    for (const [id, m] of markers.current) {
      if (!seen.has(id)) {
        m.remove();
        markers.current.delete(id);
      }
    }
  }, [props.fractures, props.selectedId]);

  // Follow the player pin (teleport / sim), but never fight an active drag.
  useEffect(() => {
    const pm = playerMarker.current;
    const map = mapRef.current;
    if (!pm || !map || dragging.current) return;
    pm.setLngLat([props.player.lng, props.player.lat]);
    map.easeTo({ center: [props.player.lng, props.player.lat], duration: 400 });
  }, [props.player]);

  // Explore mode: ease the view back to the player when MapScreen bumps the
  // recentre signal. Skipped on the initial render (signal 0 / undefined).
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !props.recentreSignal) return;
    map.easeTo({ center: [props.player.lng, props.player.lat], duration: 500 });
    // Only react to the signal; player is read fresh at fire time.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.recentreSignal]);

  // Optional fake co-op partner.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (props.secondPlayer) {
      if (!partnerMarker.current) {
        partnerMarker.current = new mapboxgl.Marker({ element: dotEl('#ffca61') }).addTo(map);
      }
      partnerMarker.current.setLngLat([props.secondPlayer.lng, props.secondPlayer.lat]);
    } else if (partnerMarker.current) {
      partnerMarker.current.remove();
      partnerMarker.current = null;
    }
  }, [props.secondPlayer]);

  return <div ref={containerRef} className="h-full w-full" />;
}
