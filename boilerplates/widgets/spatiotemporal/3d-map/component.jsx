import React, { useEffect, useRef } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

const RealMapbox = ({ data = {} }) => {
    const mapContainer = useRef(null);
    const map = useRef(null);
    const MAPBOX_TOKEN = data.mapboxToken || import.meta.env.VITE_MAPBOX_TOKEN || '';

    const locations = (data.locations?.length > 0 ? data.locations : null) || 
                      (data.data?.length > 0 ? data.data : null) || 
                      (data.results?.length > 0 ? data.results : null) || [
        { name: 'Bucharest Center', longitude: 26.1039, latitude: 44.4275, intensity: 15 },
        { name: 'Bucharest North', longitude: 26.0844, latitude: 44.4744, intensity: 12 },
        { name: 'Bucharest East', longitude: 26.1556, latitude: 44.4261, intensity: 10 },
        { name: 'Bucharest South', longitude: 26.1025, latitude: 44.4000, intensity: 8 },
        { name: 'Bucharest West', longitude: 26.0144, latitude: 44.4344, intensity: 9 },
        { name: 'Otopeni Perimeter', longitude: 26.0711, latitude: 44.5511, intensity: 7 },
        { name: 'Voluntari Area', longitude: 26.1867, latitude: 44.4944, intensity: 6 },
        { name: 'Bragadiru Edge', longitude: 25.9725, latitude: 44.3768, intensity: 5 },
        { name: 'Buftea/Mogosoaia', longitude: 25.9522, latitude: 44.5739, intensity: 4 },
        { name: 'Cernica/Pantelimon', longitude: 26.2556, latitude: 44.4344, intensity: 5 }
    ];

    useEffect(() => {
        if (!MAPBOX_TOKEN || MAPBOX_TOKEN === 'your_mapbox_token_here') return;
        if (map.current) return;

        mapboxgl.accessToken = MAPBOX_TOKEN;

        map.current = new mapboxgl.Map({
            container: mapContainer.current,
            style: 'mapbox://styles/mapbox/dark-v11',
            center: [26.1025, 44.4468],
            zoom: 9.2, 
            pitch: 30,
            bearing: 0,
            antialias: true,
            scrollZoom: false,
            boxZoom: false,
            dragPan: false,
            dragRotate: false,
            keyboard: false,
            doubleClickZoom: false,
            touchZoomRotate: false
        });

        map.current.on('load', () => {
            map.current.addSource('leads', {
                type: 'geojson',
                data: {
                    type: 'FeatureCollection',
                    features: locations.map(loc => ({
                        type: 'Feature',
                        properties: { intensity: loc.intensity || 1 },
                        geometry: { type: 'Point', coordinates: [loc.longitude, loc.latitude] }
                    }))
                }
            });

            map.current.addLayer({
                id: 'leads-heat',
                type: 'heatmap',
                source: 'leads',
                maxzoom: 15,
                paint: {
                    'heatmap-weight': ['interpolate', ['linear'], ['get', 'intensity'], 0, 0, 15, 1],
                    'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 8, 1, 15, 3],
                    'heatmap-color': [
                        'interpolate',
                        ['linear'],
                        ['heatmap-density'],
                        0, 'rgba(239, 68, 68, 0)',      // Transparent red
                        0.1, 'rgba(239, 68, 68, 0.4)',  // Red
                        0.3, 'rgba(249, 115, 22, 0.6)',  // Orange
                        0.5, 'rgba(234, 179, 8, 0.7)',   // Yellow
                        0.7, 'rgba(132, 204, 22, 0.8)',  // Lime
                        1, 'rgba(34, 197, 94, 0.9)'      // Green
                    ],
                    'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 9, 80, 15, 250],
                    'heatmap-opacity': 0.7
                }
            });
        });

        const resizeObserver = new ResizeObserver(() => {
            if (map.current) map.current.resize();
        });
        resizeObserver.observe(mapContainer.current);

        return () => {
            if (map.current) {
                map.current.remove();
                map.current = null;
            }
            resizeObserver.disconnect();
        };
    }, [MAPBOX_TOKEN, locations]);

    if (!MAPBOX_TOKEN || MAPBOX_TOKEN === 'your_mapbox_token_here') {
        return (
            <div style={{
                height: '100%', width: '100%', display: 'flex', flexDirection: 'column',
                justifyContent: 'center', alignItems: 'center', backgroundColor: '#111827',
                color: '#9CA3AF', textAlign: 'center', padding: '1rem', borderRadius: '12px'
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
            style={{ height: '100%', width: '100%', borderRadius: '12px', overflow: 'hidden' }}
        />
    );
};

export default RealMapbox;
