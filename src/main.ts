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
  history: leaflet.LatLng[];
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
  history: [OAKES_CLASSROOM],
};

const caches: Cache[] = [];
const cacheMementos: { [key: string]: CacheMemento } = {};
const polyline = leaflet.polyline(player.history, { color: "blue" }).addTo(map);
let geolocationWatchId: number | null = null;

function latLngToCell(latLng: leaflet.LatLng): { i: number; j: number } {
  return {
    i: Math.floor(latLng.lat / TILE_DEGREES),
    j: Math.floor(latLng.lng / TILE_DEGREES),
  };
}

function formatCoinId(coin: Coin): string {
  return `${coin.id.i}:${coin.id.j}#${coin.id.serial}`;
}

function generateCoinCanvas(_coin: Coin): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = 50;
  canvas.height = 50;
  const ctx = canvas.getContext("2d")!;
  ctx.font = "20px Arial";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("🟡", canvas.width / 2, canvas.height / 2);
  return canvas;
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
        const numCoins =
          Math.floor(luck(`cache-coins-${cell.i}-${cell.j}`) * 10) + 1;
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
  const popupContent = document.createElement("div");
  const coinCount = document.createElement("p");
  coinCount.textContent = `Coins: ${cache.coins.length}`;
  popupContent.appendChild(coinCount);

  const coinIds = document.createElement("p");
  cache.coins.forEach((coin) => {
    const coinCanvas = generateCoinCanvas(coin);
    coinCanvas.classList.add("coin-id");
    coinCanvas.dataset.id = formatCoinId(coin);
    coinIds.appendChild(coinCanvas);
  });
  popupContent.appendChild(coinIds);

  const collectButton = document.createElement("button");
  collectButton.classList.add("collect");
  collectButton.dataset.lat = cache.location.lat.toString();
  collectButton.dataset.lng = cache.location.lng.toString();
  collectButton.textContent = "Collect";
  popupContent.appendChild(collectButton);

  const depositButton = document.createElement("button");
  depositButton.classList.add("deposit");
  depositButton.dataset.lat = cache.location.lat.toString();
  depositButton.dataset.lng = cache.location.lng.toString();
  depositButton.textContent = "Deposit";
  popupContent.appendChild(depositButton);

  cache.marker.bindPopup(popupContent);
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

function movePlayer(latOffset: number, lngOffset: number) {
  player.location = leaflet.latLng(
    player.location.lat + latOffset,
    player.location.lng + lngOffset,
  );
  player.history.push(player.location);
  map.setView(player.location);
  polyline.setLatLngs(player.history);
  generateCaches();
  saveGameState();
}

function saveGameState() {
  localStorage.setItem("player", JSON.stringify(player));
  localStorage.setItem("cacheMementos", JSON.stringify(cacheMementos));
}

function loadGameState() {
  const savedPlayer = localStorage.getItem("player");
  const savedCacheMementos = localStorage.getItem("cacheMementos");
  if (savedPlayer) {
    Object.assign(player, JSON.parse(savedPlayer));
    polyline.setLatLngs(player.history);
    map.setView(player.location);
  }
  if (savedCacheMementos) {
    Object.assign(cacheMementos, JSON.parse(savedCacheMementos));
  }
  generateCaches();
}

function resetGameState() {
  const confirmation = prompt(
    "Are you sure you want to erase your game state? Type 'yes' to confirm.",
  );
  if (confirmation === "yes") {
    player.location = OAKES_CLASSROOM;
    player.coins = [];
    player.history = [OAKES_CLASSROOM];
    Object.keys(cacheMementos).forEach((key) => {
      const memento = cacheMementos[key];
      memento.coins = memento.coins.map((coin) => ({ ...coin, value: 1 }));
    });
    polyline.setLatLngs(player.history);
    map.setView(player.location);
    generateCaches();
    saveGameState();
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
  } else if (target.classList.contains("coin-id")) {
    const id = target.getAttribute("data-id")!;
    const [i, j] = id.split("#")[0].split(":").map(Number);
    const cacheKey = `${i}:${j}`;
    if (cacheMementos[cacheKey]) {
      const cache = cacheMementos[cacheKey];
      map.setView(cache.location, GAMEPLAY_ZOOM_LEVEL);
    }
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
document.getElementById("reset")!.addEventListener("click", resetGameState);

document.getElementById("sensor")!.addEventListener("click", () => {
  if (geolocationWatchId === null) {
    geolocationWatchId = navigator.geolocation.watchPosition((position) => {
      const { latitude, longitude } = position.coords;
      movePlayer(
        latitude - player.location.lat,
        longitude - player.location.lng,
      );
    });
  } else {
    navigator.geolocation.clearWatch(geolocationWatchId);
    geolocationWatchId = null;
  }
});

loadGameState();
generateCaches();
