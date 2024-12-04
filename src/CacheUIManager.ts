import _leaflet from "leaflet";
import { Cache, Coin } from "./main.ts";

export class CacheUIManager {
  static setPopup(cache: Cache) {
    const popupContent = document.createElement("div");
    const coinCount = document.createElement("p");
    coinCount.textContent = `Coins: ${cache.coins.length}`;
    popupContent.appendChild(coinCount);

    const coinIds = document.createElement("p");
    cache.coins.forEach((coin: Coin) => {
      const coinCanvas = CacheUIManager.generateCoinCanvas(coin);
      coinCanvas.classList.add("coin-id");
      coinCanvas.dataset.id = CacheUIManager.formatCoinId(coin);
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

  static generateCoinCanvas(coin: Coin): HTMLCanvasElement {
    const canvas = document.createElement("canvas");
    canvas.width = 50;
    canvas.height = 50;
    const ctx = canvas.getContext("2d")!;
    const hue = (coin.id.serial * 137.5) % 360; // Use serial number to determine color
    ctx.fillStyle = `hsl(${hue}, 100%, 50%)`;
    ctx.beginPath();
    ctx.arc(25, 25, 20, 0, 2 * Math.PI);
    ctx.fill();
    ctx.fillStyle = "white";
    ctx.font = "10px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(CacheUIManager.formatCoinId(coin), 25, 25);
    return canvas;
  }

  static formatCoinId(coin: Coin): string {
    return `${coin.id.i}:${coin.id.j}#${coin.id.serial}`;
  }
}
