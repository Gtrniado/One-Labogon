import { setOptions, importLibrary } from '@googlemaps/js-api-loader';
import { registerSW } from 'virtual:pwa-register';

if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  registerSW({
    immediate: true,
    onOfflineReady() {
      window.dispatchEvent(new CustomEvent('labogon-offline-ready'));
    },
  });
}

const ATTRIBUTION_ID = 'gmp_mcp_codeassist_v1_aistudio';
const DEFAULT_MAP_ID = 'DEMO_MAP_ID';
const MANDAUE_CENTER = { lat: 10.339, lng: 123.941 };

// Tier 1 Quota & Auth Defense (module root before initialization)
(window as unknown as { gm_authFailure?: () => void }).gm_authFailure = () => {
  window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
};

const origConsoleError = console.error;
console.error = (...args: unknown[]) => {
  origConsoleError.apply(console, args);
  const msg = args.map((a) => String(a)).join(' ');
  if (msg.includes('OverQuotaMapError') || msg.includes('QuotaExceededError')) {
    window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
  }
};

function showQuotaBanner(): void {
  const banner = document.getElementById('gmp-quota-banner');
  if (banner) {
    banner.hidden = false;
  }
}

window.addEventListener('gmp-quota-exceeded', showQuotaBanner);

function isQuotaError(err: unknown): boolean {
  if (!err || typeof err !== 'object') {
    const str = String(err ?? '');
    return (
      str.includes('RESOURCE_EXHAUSTED') ||
      str.includes('OVER_QUERY_LIMIT') ||
      str.includes('OverQuotaMapError') ||
      str.includes('QuotaExceededError') ||
      str.includes('429')
    );
  }
  const e = err as { status?: unknown; code?: unknown; message?: unknown };
  const statusStr = String(e.status ?? '');
  const msgStr = String(e.message ?? '');
  return (
    e.status === 429 ||
    e.code === 429 ||
    statusStr === 'RESOURCE_EXHAUSTED' ||
    statusStr === 'OVER_QUERY_LIMIT' ||
    msgStr.includes('RESOURCE_EXHAUSTED') ||
    msgStr.includes('OVER_QUERY_LIMIT') ||
    msgStr.includes('Quota') ||
    msgStr.includes('429')
  );
}

export interface VerifiedFacilityLookup {
  id: string;
  name: string;
  category: string;
  typeLabel: string;
  address: string | null;
  searchQuery: string;
  matchAll?: string[];
  matchAny?: string[];
  exclude?: string[];
  mapsUrl: string;
}

export interface ResolvedVerifiedPlace {
  id: string;
  name: string;
  category: string;
  typeLabel: string;
  address: string;
  lat: number;
  lng: number;
  googleMapsURI: string;
  attributions: Array<{ provider: string; providerURI: string }>;
}

interface InitOptions {
  containerId: string;
  center: { lat: number; lng: number };
  centerLabel: string;
  theme: string;
  language: string;
  openMapsLabel: string;
  verifiedFacilities?: VerifiedFacilityLookup[];
  onVerifiedPlacesResolved?: (places: ResolvedVerifiedPlace[]) => void;
  onError?: () => void;
}

const CATEGORY_STYLE: Record<string, { glyph: string; bg: string; border: string }> = {
  hospital: { glyph: '🏥', bg: '#c62828', border: '#ffffff' },
  health: { glyph: '🩺', bg: '#0284c7', border: '#ffffff' },
  fire: { glyph: '🚒', bg: '#ea580c', border: '#ffffff' },
  police: { glyph: '🚓', bg: '#1d4ed8', border: '#ffffff' },
  evacuation: { glyph: '🏫', bg: '#15803d', border: '#ffffff' },
  rescue: { glyph: '🚑', bg: '#b91c1c', border: '#ffffff' },
  office: { glyph: '🏛️', bg: '#7c2d12', border: '#ffffff' },
  user: { glyph: '🧍', bg: '#0f766e', border: '#ffffff' },
};

let optionsConfigured = false;
let mapInstance: google.maps.Map | null = null;
let sharedInfoWindow: google.maps.InfoWindow | null = null;
let centerMarker: google.maps.marker.AdvancedMarkerElement | null = null;
let userMarker: google.maps.marker.AdvancedMarkerElement | null = null;
let placeMarkers: Array<{
  id: string;
  category: string;
  marker: google.maps.marker.AdvancedMarkerElement;
}> = [];

const resolvedCache = new Map<string, ResolvedVerifiedPlace | null>();
let currentConfig: InitOptions | null = null;
let lastUserLocation: { pos: { lat: number; lng: number }; label: string } | null = null;
let activeFilterSet: Set<string> = new Set([
  'hospital',
  'health',
  'fire',
  'police',
  'evacuation',
  'rescue',
  'office',
]);

function mapLanguageCode(appLang: string): string {
  if (appLang === 'fil') return 'fil';
  return 'en';
}

function buildInfoContent(
  title: string,
  subtitle: string,
  address: string,
  mapsUri: string,
  openMapsLabel: string,
  attributions: Array<{ provider: string; providerURI: string }>
): HTMLElement {
  const wrap = document.createElement('div');
  wrap.className = 'gmp-infowindow';

  const heading = document.createElement('strong');
  heading.className = 'gmp-iw-title';
  heading.textContent = title;
  wrap.appendChild(heading);

  if (subtitle) {
    const sub = document.createElement('div');
    sub.className = 'gmp-iw-meta';
    sub.textContent = subtitle;
    wrap.appendChild(sub);
  }

  if (address) {
    const addr = document.createElement('div');
    addr.className = 'gmp-iw-addr';
    addr.textContent = address;
    wrap.appendChild(addr);
  }

  if (mapsUri) {
    const link = document.createElement('a');
    link.className = 'gmp-iw-link';
    link.href = mapsUri;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.textContent = openMapsLabel || 'Open in Google Maps';
    wrap.appendChild(link);
  }

  if (attributions.length > 0) {
    const attrWrap = document.createElement('div');
    attrWrap.className = 'gmp-iw-attr';
    attributions.forEach((attr, idx) => {
      if (idx > 0) attrWrap.appendChild(document.createTextNode(' · '));
      if (attr.providerURI) {
        const a = document.createElement('a');
        a.href = attr.providerURI;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        a.textContent = attr.provider;
        attrWrap.appendChild(a);
      } else {
        attrWrap.appendChild(document.createTextNode(attr.provider));
      }
    });
    wrap.appendChild(attrWrap);
  }

  return wrap;
}

function clearPlaceMarkers(): void {
  placeMarkers.forEach(({ marker }) => {
    marker.map = null;
  });
  placeMarkers = [];
}

async function createPinMarker(
  position: google.maps.LatLngLiteral,
  title: string,
  styleKey: string,
  onClick: () => void
): Promise<google.maps.marker.AdvancedMarkerElement> {
  const { AdvancedMarkerElement, PinElement } = (await importLibrary(
    'marker'
  )) as google.maps.MarkerLibrary;

  const style = CATEGORY_STYLE[styleKey] || CATEGORY_STYLE.office;
  const pin = new PinElement({
    glyphText: style.glyph,
    background: style.bg,
    borderColor: style.border,
    glyphColor: '#ffffff',
  });

  const marker = new AdvancedMarkerElement({
    map: mapInstance,
    position,
    title,
  });
  const pinEl = (pin as unknown as { element?: HTMLElement }).element ?? pin;
  marker.append(pinEl);

  marker.addListener('click', onClick);
  return marker;
}

function matchesVerifiedFacility(
  place: google.maps.places.Place,
  spec: VerifiedFacilityLookup
): boolean {
  if (!place.location) return false;
  const displayName = (place.displayName || '').toLowerCase();
  const formattedAddress = (place.formattedAddress || '').toLowerCase();

  if (!formattedAddress.includes('mandaue')) {
    return false;
  }
  if (spec.exclude && spec.exclude.some((term) => displayName.includes(term.toLowerCase()))) {
    return false;
  }
  if (spec.matchAll && !spec.matchAll.every((term) => displayName.includes(term.toLowerCase()))) {
    return false;
  }
  if (
    spec.matchAny &&
    spec.matchAny.length > 0 &&
    !spec.matchAny.some((term) => displayName.includes(term.toLowerCase()))
  ) {
    return false;
  }
  return true;
}

async function renderVerifiedMarkers(places: ResolvedVerifiedPlace[]): Promise<void> {
  if (!mapInstance || !sharedInfoWindow) return;
  clearPlaceMarkers();

  for (const p of places) {
    const isVisible = activeFilterSet.has(p.category);
    const marker = await createPinMarker(
      { lat: p.lat, lng: p.lng },
      p.name,
      p.category,
      () => {
        if (!mapInstance || !sharedInfoWindow) return;
        mapInstance.panTo({ lat: p.lat, lng: p.lng });
        const content = buildInfoContent(
          p.name,
          p.typeLabel,
          p.address,
          p.googleMapsURI,
          currentConfig?.openMapsLabel || 'Open in Google Maps',
          p.attributions
        );
        sharedInfoWindow.setContent(content);
        sharedInfoWindow.open({
          map: mapInstance,
          anchor: marker,
          shouldFocus: false,
        });
      }
    );
    marker.map = isVisible ? mapInstance : null;
    placeMarkers.push({ id: p.id, category: p.category, marker });
  }
}

async function resolveVerifiedFacilities(
  facilities: VerifiedFacilityLookup[]
): Promise<ResolvedVerifiedPlace[]> {
  if (!mapInstance || !facilities.length) return [];

  const resolved: ResolvedVerifiedPlace[] = [];
  const missing: VerifiedFacilityLookup[] = [];

  for (const spec of facilities) {
    const cacheKey = `${spec.id}:${currentConfig?.language || 'en'}`;
    if (resolvedCache.has(cacheKey)) {
      const cached = resolvedCache.get(cacheKey);
      if (cached) {
        resolved.push({
          ...cached,
          name: spec.name,
          typeLabel: spec.typeLabel,
        });
      }
    } else {
      missing.push(spec);
    }
  }

  if (missing.length > 0) {
    try {
      const { Place } = (await importLibrary('places')) as google.maps.PlacesLibrary;

      for (const spec of missing) {
        const cacheKey = `${spec.id}:${currentConfig?.language || 'en'}`;
        try {
          const request: google.maps.places.SearchByTextRequest = {
            textQuery: spec.searchQuery,
            fields: ['id', 'displayName', 'location', 'formattedAddress', 'googleMapsURI'],
            locationBias: {
              center: MANDAUE_CENTER,
              radius: 8000,
            },
            maxResultCount: 3,
            language: mapLanguageCode(currentConfig?.language || 'en'),
            region: 'ph',
            internalUsageAttributionIds: [ATTRIBUTION_ID],
          };

          const { places } = await Place.searchByText(request);
          const match = (places || []).find((pl) => matchesVerifiedFacility(pl, spec));

          if (match && match.location) {
            const lat =
              typeof match.location.lat === 'function'
                ? match.location.lat()
                : Number(match.location.lat);
            const lng =
              typeof match.location.lng === 'function'
                ? match.location.lng()
                : Number(match.location.lng);

            if (!Number.isNaN(lat) && !Number.isNaN(lng)) {
              const attributions = (match.attributions || []).map((a) => ({
                provider: a.provider || '',
                providerURI: a.providerURI || '',
              }));
              const item: ResolvedVerifiedPlace = {
                id: spec.id,
                name: spec.name,
                category: spec.category,
                typeLabel: spec.typeLabel,
                address: spec.address || match.formattedAddress || 'Mandaue City, Cebu',
                lat,
                lng,
                googleMapsURI: match.googleMapsURI || spec.mapsUrl,
                attributions,
              };
              resolvedCache.set(cacheKey, item);
              resolved.push(item);
            } else {
              resolvedCache.set(cacheKey, null);
            }
          } else {
            resolvedCache.set(cacheKey, null);
          }
        } catch (err) {
          if (isQuotaError(err)) {
            window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
            break;
          }
          resolvedCache.set(cacheKey, null);
        }
      }
    } catch (err) {
      if (isQuotaError(err)) {
        window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
      }
    }
  }

  await renderVerifiedMarkers(resolved);
  currentConfig?.onVerifiedPlacesResolved?.(resolved);
  return resolved;
}

async function initGoogleMap(opts: InitOptions): Promise<boolean> {
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined;
  const mapEl = document.getElementById(opts.containerId);
  if (!apiKey || !mapEl) {
    opts.onError?.();
    return false;
  }

  currentConfig = opts;

  try {
    if (!optionsConfigured) {
      setOptions({
        key: apiKey,
        v: 'weekly',
        language: mapLanguageCode(opts.language),
        region: 'PH',
        libraries: ['maps', 'marker', 'places', 'core'],
        mapIds: [DEFAULT_MAP_ID],
      });
      optionsConfigured = true;
    }

    const [{ Map, InfoWindow }, { ColorScheme, event }] = await Promise.all([
      importLibrary('maps') as Promise<google.maps.MapsLibrary>,
      importLibrary('core') as Promise<google.maps.CoreLibrary>,
    ]);

    const colorScheme = opts.theme === 'dark' ? ColorScheme.DARK : ColorScheme.LIGHT;

    mapInstance = new Map(mapEl, {
      center: lastUserLocation ? lastUserLocation.pos : MANDAUE_CENTER,
      zoom: lastUserLocation ? 15 : 13,
      mapId: DEFAULT_MAP_ID,
      colorScheme,
      gestureHandling: 'cooperative',
      mapTypeControl: true,
      streetViewControl: false,
      fullscreenControl: true,
      internalUsageAttributionIds: [ATTRIBUTION_ID],
    });

    sharedInfoWindow = new InfoWindow();

    if (centerMarker) {
      centerMarker.map = null;
      centerMarker = null;
    }
    if (userMarker) {
      userMarker.map = null;
      userMarker = null;
    }

    centerMarker = await createPinMarker(opts.center, opts.centerLabel, 'office', () => {
      if (!mapInstance || !sharedInfoWindow || !centerMarker) return;
      const content = buildInfoContent(
        opts.centerLabel,
        'Barangay Labogon, Mandaue City',
        '',
        `https://www.google.com/maps/search/?api=1&query=${opts.center.lat},${opts.center.lng}`,
        opts.openMapsLabel,
        []
      );
      sharedInfoWindow.setContent(content);
      sharedInfoWindow.open({
        map: mapInstance,
        anchor: centerMarker,
        shouldFocus: false,
      });
    });

    if (lastUserLocation) {
      const saved = lastUserLocation;
      userMarker = await createPinMarker(saved.pos, saved.label, 'user', () => {
        if (!mapInstance || !sharedInfoWindow || !userMarker) return;
        const content = buildInfoContent(
          saved.label,
          `${saved.pos.lat.toFixed(5)}, ${saved.pos.lng.toFixed(5)}`,
          '',
          `https://www.google.com/maps/search/?api=1&query=${saved.pos.lat},${saved.pos.lng}`,
          currentConfig?.openMapsLabel || 'Open in Google Maps',
          []
        );
        sharedInfoWindow.setContent(content);
        sharedInfoWindow.open({
          map: mapInstance,
          anchor: userMarker,
          shouldFocus: false,
        });
      });
    }

    event.addListenerOnce(mapInstance, 'idle', () => {
      void resolveVerifiedFacilities(opts.verifiedFacilities || []);
    });

    return true;
  } catch (err) {
    if (isQuotaError(err)) {
      window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
    }
    opts.onError?.();
    return false;
  }
}

function setActiveTypes(types: string[]): void {
  activeFilterSet = new Set(types);
  if (!mapInstance) return;
  placeMarkers.forEach(({ category, marker }) => {
    marker.map = activeFilterSet.has(category) ? mapInstance : null;
  });
}

async function showUserLocation(
  pos: { lat: number; lng: number },
  label: string
): Promise<void> {
  lastUserLocation = { pos, label };
  if (!mapInstance || !sharedInfoWindow) return;

  if (userMarker) {
    userMarker.map = null;
  }

  userMarker = await createPinMarker(pos, label, 'user', () => {
    if (!mapInstance || !sharedInfoWindow || !userMarker) return;
    const content = buildInfoContent(
      label,
      `${pos.lat.toFixed(5)}, ${pos.lng.toFixed(5)}`,
      '',
      `https://www.google.com/maps/search/?api=1&query=${pos.lat},${pos.lng}`,
      currentConfig?.openMapsLabel || 'Open in Google Maps',
      []
    );
    sharedInfoWindow.setContent(content);
    sharedInfoWindow.open({
      map: mapInstance,
      anchor: userMarker,
      shouldFocus: false,
    });
  });

  mapInstance.panTo(pos);
  mapInstance.setZoom(16);

  const content = buildInfoContent(
    label,
    `${pos.lat.toFixed(5)}, ${pos.lng.toFixed(5)}`,
    '',
    `https://www.google.com/maps/search/?api=1&query=${pos.lat},${pos.lng}`,
    currentConfig?.openMapsLabel || 'Open in Google Maps',
    []
  );
  sharedInfoWindow.setContent(content);
  sharedInfoWindow.open({
    map: mapInstance,
    anchor: userMarker,
    shouldFocus: false,
  });
}

async function setTheme(theme: string): Promise<void> {
  if (!currentConfig || currentConfig.theme === theme) return;
  currentConfig.theme = theme;
  if (mapInstance) {
    await initGoogleMap(currentConfig);
  }
}

function updateLabels(opts: {
  centerLabel: string;
  openMapsLabel: string;
  language: string;
  verifiedFacilities?: VerifiedFacilityLookup[];
}): void {
  if (!currentConfig) return;
  currentConfig.centerLabel = opts.centerLabel;
  currentConfig.openMapsLabel = opts.openMapsLabel;
  currentConfig.language = opts.language;
  if (opts.verifiedFacilities) {
    currentConfig.verifiedFacilities = opts.verifiedFacilities;
  }
  if (centerMarker) {
    centerMarker.title = opts.centerLabel;
  }
}

const api = {
  initGoogleMap,
  setActiveTypes,
  showUserLocation,
  setTheme,
  updateLabels,
};

(window as unknown as { LabogonMaps?: typeof api }).LabogonMaps = api;
window.dispatchEvent(new CustomEvent('labogon-maps-ready'));
