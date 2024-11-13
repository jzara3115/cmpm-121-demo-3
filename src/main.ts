// @deno-types="npm:@types/leaflet@^1.9.14"
import leaflet from "leaflet";
import "leaflet/dist/leaflet.css";
import "./style.css";
import "./leafletWorkaround.ts";
import luck from "./luck.ts";

const OAKES_CLASSROOM = leaflet.latLng(36.98949379578401, -122.06277128548504);
const GAMEPLAY_ZOOM_LEVEL = 19;
const TILE_DEGREES = 0.0001;
const NEIGHBORHOOD_SIZE = 8;
const CACHE_SPAWN_PROBABILITY = 0.1;

interface Player {
  location: leaflet.LatLng;
  coins: number;
}

interface Cache {
  location: leaflet.LatLng;
  coins: number;
  marker: leaflet.Marker;
}

interface Coin {
  value: number;
}

const map = leaflet.map(document.getElementById("map")!, {
  center: OAKES_CLASSROOM,
  zoom: GAMEPLAY_ZOOM_LEVEL,
  minZoom: GAMEPLAY_ZOOM_LEVEL,
  maxZoom: GAMEPLAY_ZOOM_LEVEL,
  zoomControl: false,
  scrollWheelZoom: false,
});

leaflet.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19,
  attribution:
    'Map data © <a href="https://openstreetmap.org">OpenStreetMap</a> contributors',
}).addTo(map);

const player: Player = {
  location: OAKES_CLASSROOM,
  coins: 0,
};

const caches: Cache[] = [];

function generateCaches() {
  for (let i = -NEIGHBORHOOD_SIZE; i <= NEIGHBORHOOD_SIZE; i++) {
    for (let j = -NEIGHBORHOOD_SIZE; j <= NEIGHBORHOOD_SIZE; j++) {
      if (luck(`cache-spawn-${i}-${j}`) < CACHE_SPAWN_PROBABILITY) {
        const cacheLocation = leaflet.latLng(
          OAKES_CLASSROOM.lat + i * TILE_DEGREES,
          OAKES_CLASSROOM.lng + j * TILE_DEGREES,
        );
        const cache: Cache = {
          location: cacheLocation,
          coins: Math.floor(luck(`cache-coins-${i}-${j}`) * 10) + 1,
          marker: createCacheMarker(cacheLocation),
        };
        caches.push(cache);
        updateCachePopup(cache);
      }
    }
  }
}

function createCacheMarker(location: leaflet.LatLng): leaflet.Marker {
  return leaflet.marker(location).addTo(map);
}

function updateCachePopup(cache: Cache) {
  cache.marker.bindPopup(`
    <div>
      <p>Coins: ${cache.coins}</p>
      <button class="collect" data-lat="${cache.location.lat}" data-lng="${cache.location.lng}">Collect</button>
      <button class="deposit" data-lat="${cache.location.lat}" data-lng="${cache.location.lng}">Deposit</button>
    </div>
  `);
}

function collectCoins(lat: number, lng: number) {
  const cache = caches.find((c) =>
    c.location.lat === lat && c.location.lng === lng
  );
  if (cache && cache.coins > 0) {
    player.coins += cache.coins;
    cache.coins = 0;
    updateCachePopup(cache);
  }
}

function depositCoins(lat: number, lng: number) {
  const cache = caches.find((c) =>
    c.location.lat === lat && c.location.lng === lng
  );
  if (cache) {
    cache.coins += player.coins;
    player.coins = 0;
    updateCachePopup(cache);
  }
}

document.addEventListener("click", function (event) {
  const target = event.target as HTMLElement;
  if (target.classList.contains("collect")) {
    const lat = parseFloat(target.getAttribute("data-lat")!);
    const lng = parseFloat(target.getAttribute("data-lng")!);
    collectCoins(lat, lng);
  } else if (target.classList.contains("deposit")) {
    const lat = parseFloat(target.getAttribute("data-lat")!);
    const lng = parseFloat(target.getAttribute("data-lng")!);
    depositCoins(lat, lng);
  }
});

generateCaches();
