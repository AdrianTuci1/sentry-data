import React, { useEffect, useMemo, useRef } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

const BUCHAREST_CENTER = [26.1025, 44.4268];
const CLUSTER_LON_STEP = 0.028;
const CLUSTER_LAT_STEP = 0.018;
const AVATAR_COLORS = ['#7CFF5B', '#35C9FF', '#8B5CF6', '#FF4D8D', '#FFC533', '#7A7F87'];

const fallbackLocations = [
    { name: 'Pipera Hub', address: 'Bucharest', longitude: 26.1212, latitude: 44.4923, intensity: 3 },
    { name: 'Aviatorilor', address: 'Bucharest', longitude: 26.0873, latitude: 44.4684, intensity: 2 },
    { name: 'Universitate', address: 'Bucharest', longitude: 26.1029, latitude: 44.4352, intensity: 4 },
    { name: 'Tineretului', address: 'Bucharest', longitude: 26.1055, latitude: 44.4128, intensity: 2 },
    { name: 'Politehnica', address: 'Bucharest', longitude: 26.0495, latitude: 44.4439, intensity: 2 },
    { name: 'Pantelimon', address: 'Bucharest', longitude: 26.1881, latitude: 44.4417, intensity: 2 },
    { name: 'Otopeni', address: 'Otopeni', longitude: 26.0731, latitude: 44.5506, intensity: 1 },
];

const hashString = (value = '') => Array.from(String(value)).reduce((acc, char) => acc + char.charCodeAt(0), 0);

const getApproxCoordinates = (location = {}, index = 0) => {
    const raw = String(location.address || location.name || '').toLowerCase();

    if (raw.includes('otopeni')) return [26.0731, 44.5506];
    if (raw.includes('voluntari') || raw.includes('pipera')) return [26.1288, 44.4958];
    if (raw.includes('pantelimon') || raw.includes('cernica')) return [26.1815, 44.4421];
    if (raw.includes('bragadiru')) return [25.9776, 44.3727];
    if (raw.includes('buftea') || raw.includes('mogosoaia')) return [25.9489, 44.5652];
    if (raw.includes('sector 1') || raw.includes('aviator')) return [26.0873, 44.4684];
    if (raw.includes('sector 2') || raw.includes('obor')) return [26.1285, 44.4524];
    if (raw.includes('sector 3') || raw.includes('titan')) return [26.1665, 44.4267];
    if (raw.includes('sector 4') || raw.includes('tineretului')) return [26.1055, 44.4128];
    if (raw.includes('sector 5') || raw.includes('rahova')) return [26.0496, 44.4066];
    if (raw.includes('sector 6') || raw.includes('militari') || raw.includes('politehnica')) return [26.0495, 44.4439];

    const seed = hashString(raw || `bucharest-${index}`);
    const lonOffset = (((seed % 11) - 5) * 0.013) + ((index % 3) * 0.004);
    const latOffset = ((((Math.floor(seed / 11)) % 11) - 5) * 0.009) + ((index % 2) * 0.003);

    return [BUCHAREST_CENTER[0] + lonOffset, BUCHAREST_CENTER[1] + latOffset];
};

const getLocationLabel = (location = {}, fallback = 'Bucharest') => {
    const exactAddress = String(location.address || '').trim();

    if (exactAddress && exactAddress.toLowerCase() !== 'bucharest') {
        return exactAddress;
    }

    return String(location.name || exactAddress || fallback).trim() || fallback;
};

const getAvatarToken = (location = {}, index = 0) => {
    const source = String(location.name || location.address || 'Bucharest').trim();
    const initials = source
        .split(/\s+/)
        .slice(0, 2)
        .map((part) => part[0])
        .join('')
        .toUpperCase() || 'B';

    return {
        id: `${source}-${index}`,
        label: getLocationLabel(location, 'Bucharest'),
        initials,
        color: AVATAR_COLORS[index % AVATAR_COLORS.length],
        image: location.avatar || location.avatarUrl || location.image || location.imageUrl || '',
    };
};

const clusterLocations = (locations) => {
    const grouped = new Map();

    locations.forEach((location, index) => {
        const longitude = Number(location.longitude ?? location.lng);
        const latitude = Number(location.latitude ?? location.lat);
        const [resolvedLon, resolvedLat] = Number.isFinite(longitude) && Number.isFinite(latitude)
            ? [longitude, latitude]
            : getApproxCoordinates(location, index);

        const key = `${Math.round(resolvedLon / CLUSTER_LON_STEP)}-${Math.round(resolvedLat / CLUSTER_LAT_STEP)}`;

        if (!grouped.has(key)) {
            grouped.set(key, {
                longitude: 0,
                latitude: 0,
                count: 0,
                labels: [],
                avatar: null,
            });
        }

        const cluster = grouped.get(key);

        cluster.longitude += resolvedLon;
        cluster.latitude += resolvedLat;
        cluster.count += 1;
        cluster.labels.push(getLocationLabel(location, 'Bucharest'));

        if (!cluster.avatar) {
            cluster.avatar = getAvatarToken(location, index);
        }
    });

    return Array.from(grouped.values()).map((cluster, index) => ({
        id: `cluster-${index}`,
        longitude: cluster.longitude / Math.max(cluster.count, 1),
        latitude: cluster.latitude / Math.max(cluster.count, 1),
        labels: cluster.labels,
        avatar: cluster.avatar,
        primaryLabel: cluster.labels.length === 1 ? cluster.labels[0] : `${cluster.labels[0]} +${cluster.labels.length - 1}`,
    }));
};

const createAvatarClusterElement = (cluster) => {
    const avatar = cluster.avatar || {
        initials: 'B',
        color: AVATAR_COLORS[0],
        image: '',
        label: cluster.primaryLabel || 'Bucharest',
    };

    const bubble = document.createElement('div');
    bubble.title = avatar.label;
    bubble.style.width = '30px';
    bubble.style.height = '30px';
    bubble.style.borderRadius = '999px';
    bubble.style.overflow = 'hidden';
    bubble.style.display = 'flex';
    bubble.style.alignItems = 'center';
    bubble.style.justifyContent = 'center';
    bubble.style.pointerEvents = 'auto';
    bubble.style.background = avatar.image
        ? `center / cover no-repeat url("${avatar.image}")`
        : `linear-gradient(135deg, ${avatar.color} 0%, rgba(7, 12, 18, 0.94) 100%)`;
    bubble.style.border = '2px solid rgba(255,255,255,0.22)';
    bubble.style.boxShadow = '0 10px 26px rgba(0,0,0,0.4), 0 0 0 1px rgba(124,255,91,0.08)';
    bubble.style.color = '#020202';
    bubble.style.fontSize = '10px';
    bubble.style.fontWeight = '700';
    bubble.style.lineHeight = '1';
    bubble.style.backdropFilter = 'blur(8px)';

    if (!avatar.image) {
        bubble.textContent = avatar.initials.slice(0, 2);
    }

    return bubble;
};

const buildPopupHtml = (cluster) => {
    const uniqueLabels = Array.from(new Set(cluster.labels));
    const title = uniqueLabels[0] || 'Bucharest';
    const extra = uniqueLabels.slice(1, 4);
    const moreCount = Math.max(uniqueLabels.length - 4, 0);

    return `
        <div style="padding:2px 0;">
            <div style="font-weight:700; margin-bottom:4px;">${title}</div>
            ${extra.map((label) => `<div style="font-size:11px; opacity:0.76;">${label}</div>`).join('')}
            ${moreCount > 0 ? `<div style="font-size:11px; opacity:0.6;">+${moreCount} more</div>` : ''}
        </div>
    `;
};

const RealMapbox = ({ data }) => {
    const mapContainer = useRef(null);
    const map = useRef(null);
    const markersRef = useRef([]);
    const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN || '';

    const clusteredLocations = useMemo(
        () => clusterLocations(Array.isArray(data?.locations) && data.locations.length ? data.locations : fallbackLocations),
        [data?.locations],
    );

    useEffect(() => {
        if (!MAPBOX_TOKEN || MAPBOX_TOKEN === 'your_mapbox_token_here') return undefined;
        if (map.current || !mapContainer.current) return undefined;

        mapboxgl.accessToken = MAPBOX_TOKEN;

        map.current = new mapboxgl.Map({
            container: mapContainer.current,
            style: 'mapbox://styles/mapbox/dark-v11',
            center: BUCHAREST_CENTER,
            zoom: 9.8,
            pitch: 12,
            bearing: -8,
            antialias: true,
            scrollZoom: false,
            boxZoom: false,
            dragPan: false,
            dragRotate: false,
            keyboard: false,
            doubleClickZoom: false,
            touchZoomRotate: false,
            attributionControl: false,
        });

        map.current.on('load', () => {
            if (!map.current) return;

            map.current.setFog({
                color: 'rgba(6, 11, 18, 0.96)',
                'high-color': 'rgba(5, 9, 14, 0.92)',
                'space-color': 'rgba(2, 4, 8, 1)',
                'horizon-blend': 0.08,
            });
        });

        const resizeObserver = new ResizeObserver(() => {
            if (map.current) {
                map.current.resize();
            }
        });
        resizeObserver.observe(mapContainer.current);

        return () => {
            markersRef.current.forEach((marker) => marker.remove());
            markersRef.current = [];

            if (map.current) {
                map.current.remove();
                map.current = null;
            }

            resizeObserver.disconnect();
        };
    }, [MAPBOX_TOKEN]);

    useEffect(() => {
        if (!map.current) return;

        markersRef.current.forEach((marker) => marker.remove());
        markersRef.current = [];

        const bounds = new mapboxgl.LngLatBounds();

        clusteredLocations.forEach((cluster) => {
            const element = createAvatarClusterElement(cluster);
            const popup = new mapboxgl.Popup({
                closeButton: false,
                offset: 18,
                className: 'local-engagement-popup',
            }).setHTML(buildPopupHtml(cluster));

            const marker = new mapboxgl.Marker({
                element,
                anchor: 'bottom',
            })
                .setLngLat([cluster.longitude, cluster.latitude])
                .setPopup(popup)
                .addTo(map.current);

            markersRef.current.push(marker);
            bounds.extend([cluster.longitude, cluster.latitude]);
        });

        if (!bounds.isEmpty()) {
            map.current.fitBounds(bounds, {
                padding: { top: 88, right: 36, bottom: 30, left: 36 },
                maxZoom: 11.2,
                duration: 0,
            });
        } else {
            map.current.easeTo({ center: BUCHAREST_CENTER, zoom: 9.8, duration: 0 });
        }
    }, [clusteredLocations]);

    if (!MAPBOX_TOKEN || MAPBOX_TOKEN === 'your_mapbox_token_here') {
        return (
            <div style={{
                height: '100%',
                width: '100%',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'center',
                background: 'linear-gradient(180deg, #0a1118 0%, #06090e 100%)',
                color: '#9CA3AF',
                textAlign: 'center',
                padding: '1rem',
            }}>
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: '1rem' }}>
                    <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"></polygon>
                    <line x1="8" y1="2" x2="8" y2="18"></line>
                    <line x1="16" y1="6" x2="16" y2="22"></line>
                </svg>
                <p style={{ margin: 0, fontWeight: 'bold' }}>Mapbox Token Missing</p>
                <p style={{ margin: '0.5rem 0 0', fontSize: '12px' }}>Please add VITE_MAPBOX_TOKEN to your .env file.</p>
            </div>
        );
    }

    return (
        <div
            ref={mapContainer}
            style={{ height: '100%', width: '100%', overflow: 'hidden', background: '#05080c' }}
        />
    );
};

export default RealMapbox;
