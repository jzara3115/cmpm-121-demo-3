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
  coins: Coin[];
}

interface Cache {
  location: leaflet.LatLng;
  coins: Coin[];
  marker: leaflet.Marker;
}

interface Coin {
  id: { i: number; j: number; serial: number };
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
  coins: [],
};

const caches: Cache[] = [];

function latLngToCell(latLng: leaflet.LatLng): { i: number; j: number } {
  return {
    i: Math.floor(latLng.lat / TILE_DEGREES),
    j: Math.floor(latLng.lng / TILE_DEGREES),
  };
}

function formatCoinId(coin: Coin): string {
  return `${coin.id.i}:${coin.id.j}#${coin.id.serial}`;
}

function generateCaches() {
  for (let i = -NEIGHBORHOOD_SIZE; i <= NEIGHBORHOOD_SIZE; i++) {
    for (let j = -NEIGHBORHOOD_SIZE; j <= NEIGHBORHOOD_SIZE; j++) {
      if (luck(`cache-spawn-${i}-${j}`) < CACHE_SPAWN_PROBABILITY) {
        const cacheLocation = leaflet.latLng(
          OAKES_CLASSROOM.lat + i * TILE_DEGREES,
          OAKES_CLASSROOM.lng + j * TILE_DEGREES,
        );
        const cell = latLngToCell(cacheLocation);
        const coins: Coin[] = [];
        const numCoins = Math.floor(luck(`cache-coins-${i}-${j}`) * 10) + 1;
        for (let k = 0; k < numCoins; k++) {
          coins.push({ id: { i: cell.i, j: cell.j, serial: k }, value: 1 });
        }
        const cache: Cache = {
          location: cacheLocation,
          coins: coins,
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
  const coinIds = cache.coins.map(formatCoinId).join(", ");
  cache.marker.bindPopup(`
    <div>
      <p>Coins: ${cache.coins.length}</p>
      <p>Coin IDs: ${coinIds}</p>
      <button class="collect" data-lat="${cache.location.lat}" data-lng="${cache.location.lng}">Collect</button>
      <button class="deposit" data-lat="${cache.location.lat}" data-lng="${cache.location.lng}">Deposit</button>
    </div>
  `);
}

function collectCoins(lat: number, lng: number) {
  const cache = caches.find((c) =>
    c.location.lat === lat && c.location.lng === lng
  );
  if (cache && cache.coins.length > 0) {
    player.coins.push(...cache.coins);
    cache.coins = [];
    updateCachePopup(cache);
  }
}

function depositCoins(lat: number, lng: number) {
  const cache = caches.find((c) =>
    c.location.lat === lat && c.location.lng === lng
  );
  if (cache) {
    cache.coins.push(...player.coins);
    player.coins = [];
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
