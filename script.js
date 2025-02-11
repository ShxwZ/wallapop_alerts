import puppeteer from "puppeteer";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import notifier from "node-notifier";
import open from "open";
import ora from "ora";
import config from "./config.json" with { type: "json" };
import { terminalLink, scrollToLoadAll, checkElementValidity } from "./utils.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const { searchKeyword, blackListKeywords, maxPrice, minPrice, shipping, categoryIds, objectTypeIds, timeIntervalMinutes, useIA } = config;

const shippingQuery = shipping ? "&shipping=true" : "";
const categoryQuery = categoryIds.length > 0 ? `&category_ids=${categoryIds.join(",")}` : "";
const objectTypeQuery = objectTypeIds.length > 0 ? `&object_type_ids=${objectTypeIds.join(",")}` : "";

const URL = `https://es.wallapop.com/app/search?min_sale_price=${minPrice}&max_sale_price=${maxPrice}${shippingQuery}${categoryQuery}${objectTypeQuery}&filters_source=default_filters&keywords=${encodeURIComponent(searchKeyword)}&latitude=43.3602825&longitude=-5.8447919&order_by=newest`;
const RESULTS_FILE = path.join(__dirname, "results.json");
const CACHE_FILE = path.join(__dirname, "cache.json");

let cachedProducts = {}; // se actualizará al cargar la caché
let topThreeLowestPrices = [];
let lastHref = "";

// Función para actualizar el fichero de caché
const updateCacheFile = () => {
    const cacheData = {
        url: URL,
        cachedProducts: cachedProducts
    };
    fs.writeFileSync(CACHE_FILE, JSON.stringify(cacheData, null, 2));
};

// Función para cargar la caché almacenada
const loadCache = () => {
    if (fs.existsSync(CACHE_FILE)) {
        try {
            const cacheContent = JSON.parse(fs.readFileSync(CACHE_FILE, "utf-8"));
            if (cacheContent.url === URL && cacheContent.cachedProducts) {
                cachedProducts = cacheContent.cachedProducts;
                console.log("Caché cargada correctamente.");
            } else {
                // Si la URL no coincide, se sobrescribe con la nueva
                cachedProducts = {};
                updateCacheFile();
                console.log("URL de búsqueda modificada. Caché reiniciada.");
            }
        } catch (error) {
            // En caso de error al parsear, se reinicia la caché
            cachedProducts = {};
            updateCacheFile();
            console.log("Error al leer la caché. Se ha reiniciado.");
        }
    } else {
        updateCacheFile();
        console.log("No se encontró fichero de caché. Se ha creado uno nuevo.");
    }
};

loadCache();

console.log(`Iniciando... ${terminalLink('URL', URL)}`);

/**
 * Extrae y procesa los productos de la página.
 */
const extractProducts = async (page, keyword) => {
  return await page.evaluate((kw) => {
    const section = document.querySelector(".SearchUnified__section");
    if (!section) {
      return { items: [], href: null, price: "Sección no encontrada", totalItems: 0 };
    }
    const items = Array.from(section.querySelectorAll("a.ItemCardList__item"));
    const filteredItems = items
      .filter(item => !item.querySelector(".ItemCard__badge"))
      .map(i => ({
        name: i.querySelector(".ItemCard__title")?.innerText.trim() || "",
        price: i.querySelector(".ItemCard__price")?.innerText.trim() || "",
        url: i.href
      }));
    
    const sortedByLowestPrice = [...filteredItems].sort((a, b) =>
      parseFloat(a.price.split(" ")[0]) - parseFloat(b.price.split(" ")[0])
    );

    const primaryItem = filteredItems[0] || null;
    return {
      name: primaryItem ? primaryItem.name : "Nombre no encontrado",
      items: filteredItems,
      url: primaryItem ? primaryItem.url : null,
      price: primaryItem ? primaryItem.price : "Precio no encontrado",
      totalItems: filteredItems.length,
      sortedByLowestPrice: sortedByLowestPrice
    };
  }, keyword);
};

const checkWebsite = async () => {
  const browser = await puppeteer.launch({
    headless: "new",
    ignoreHTTPSErrors: true,
    args: ["--ignore-certificate-errors"]
  });
  const page = await browser.newPage();
  console.log(`[${new Date().toISOString()}] Comprobando...`);
  try {
    await page.goto(URL, { waitUntil: "networkidle2" });
    await page.waitForSelector("a.ItemCardList__item");
    await scrollToLoadAll(page);
    
    const result = await extractProducts(page, searchKeyword);
    
    

    if (!result.url) {
      console.log("No se encontró el enlace.");
      return;
    }
    
    if (result.url !== lastHref) {
      const spinnerCheckingNewElement = ora("Comprobando nuevo elemento...").start();
      lastHref = result.url;
      const elementIsValid = await checkElementValidity(result, page, searchKeyword, blackListKeywords, useIA, spinnerCheckingNewElement);
      spinnerCheckingNewElement.stop();

      if (elementIsValid) {
        const logEntry = `Nuevo producto: ${terminalLink(result.name, result.url)} | Precio: ${result.price} | Total Items: ${result.totalItems}\n`;
        console.log(logEntry);
        notifier.notify({
          title: "Nuevo artículo encontrado",
          message: `Precio: ${result.price}`,
          wait: true,
          icon: path.join(__dirname, "icon.webp"),
          contentImage: path.join(__dirname, "icon.webp")        
        });
      }

      notifier.on("click", () => {
        open(result.url);
      });

      await processTopLowestPrices(result, page, searchKeyword, blackListKeywords, topThreeLowestPrices, useIA);
      
    } else {
      console.log("Sin cambios desde la última comprobación.");
    }
    fs.writeFileSync(RESULTS_FILE, JSON.stringify({ totalItems: result.items.length,topLowestPrices: topThreeLowestPrices, items: result.items }, null, 2));
  } catch (error) {
    console.error("Error al consultar la web:", error);
  } finally {
    await browser.close();
    const nextCheck = new Date(Date.now() + timeIntervalMinutes * 60 * 1000).toLocaleTimeString();
    console.log(`Siguiente comprobación en ${timeIntervalMinutes} minutos. A las ${nextCheck}`);
  }
};

/**
 * Procesa y muestra los 3 productos con los precios más bajos válidos.
 */
async function processTopLowestPrices(result, page, searchKeyword, blackListKeywords, topLowestPrice, useIA) {
  console.log(`Obteniendo top 3 precios más bajos válidos...`);
  const spinnerTopPrice = ora("Cargando top precios...").start();
  let countTopLowestPrice = 0;
  topLowestPrice.length = 0;
  for (let i = 0; i < result.sortedByLowestPrice.length && countTopLowestPrice < 3; i++) {
    spinnerTopPrice.text = `Procesando elemento ${i + 1} de ${result.sortedByLowestPrice.length}`;
    const product = result.sortedByLowestPrice[i];
    let elementIsValid;
    
    if (cachedProducts[product.url] && cachedProducts[product.url].price === product.price) {
      elementIsValid = cachedProducts[product.url].valid;
    } else {
      elementIsValid = await checkElementValidity(product, page, searchKeyword, blackListKeywords,useIA);
      cachedProducts[product.url] = { price: product.price, valid: elementIsValid };
      updateCacheFile(); // Se actualiza el fichero cada vez que se modifica la caché
    }
    
    if (elementIsValid) {
      spinnerTopPrice.succeed(`[${countTopLowestPrice + 1}] ${product.name} - ${product.price} - ${terminalLink('Enlace', product.url)}`);
      topLowestPrice.push(product);
      countTopLowestPrice++;
      if (countTopLowestPrice < 3) {
        spinnerTopPrice.start("Cargando top precios...");
      }
    }
  }
  spinnerTopPrice.stop();
}


// Ejecutar cada intervalo de tiempo configurado
setInterval(checkWebsite, timeIntervalMinutes * 60 * 1000);
checkWebsite();