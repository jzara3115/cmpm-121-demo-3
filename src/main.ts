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

interface CacheMemento {
  location: leaflet.LatLng;
  coins: Coin[];
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
const cacheMementos: { [key: string]: CacheMemento } = {};

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
  caches.forEach((cache) => cache.marker.remove());
  caches.length = 0;

  for (let i = -NEIGHBORHOOD_SIZE; i <= NEIGHBORHOOD_SIZE; i++) {
    for (let j = -NEIGHBORHOOD_SIZE; j <= NEIGHBORHOOD_SIZE; j++) {
      const cacheLocation = leaflet.latLng(
        player.location.lat + i * TILE_DEGREES,
        player.location.lng + j * TILE_DEGREES,
      );
      const cell = latLngToCell(cacheLocation);
      const cacheKey = `${cell.i}:${cell.j}`;

      if (cacheMementos[cacheKey]) {
        const memento = cacheMementos[cacheKey];
        const cache: Cache = {
          location: memento.location,
          coins: memento.coins,
          marker: createCacheMarker(memento.location),
        };
        caches.push(cache);
        updateCachePopup(cache);
      } else if (
        luck(`cache-spawn-${cell.i}-${cell.j}`) < CACHE_SPAWN_PROBABILITY
      ) {
        const coins: Coin[] = [];
        const numCoins = Math.floor(
          luck(`cache-coins-${cell.i}-${cell.j}`) * 10,
        ) + 1;
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
        cacheMementos[cacheKey] = { location: cacheLocation, coins: coins };
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
    saveCacheState(cache);
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
    saveCacheState(cache);
  }
}

function saveCacheState(cache: Cache) {
  const cell = latLngToCell(cache.location);
  const cacheKey = `${cell.i}:${cell.j}`;
  cacheMementos[cacheKey] = {
    location: cache.location,
    coins: [...cache.coins],
  };
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

document.getElementById("north")!.addEventListener(
  "click",
  () => movePlayer(TILE_DEGREES, 0),
);
document.getElementById("south")!.addEventListener(
  "click",
  () => movePlayer(-TILE_DEGREES, 0),
);
document.getElementById("west")!.addEventListener(
  "click",
  () => movePlayer(0, -TILE_DEGREES),
);
document.getElementById("east")!.addEventListener(
  "click",
  () => movePlayer(0, TILE_DEGREES),
);

function movePlayer(latOffset: number, lngOffset: number) {
  player.location = leaflet.latLng(
    player.location.lat + latOffset,
    player.location.lng + lngOffset,
  );
  map.setView(player.location);
  generateCaches();
}

generateCaches();
