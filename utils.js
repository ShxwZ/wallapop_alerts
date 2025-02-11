import { pipeline } from '@huggingface/transformers';
import path from 'path';

// Función auxiliar para esperar
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const clasificator = await pipeline('zero-shot-classification', 'Xenova/bart-large-mnli', {
  device: 'cpu',
  dtype: 'fp32'
});


export async function analizeDescription(texto, producto, blackList) {

    // Clasificar el texto
    const optionSearched = `Venta o compra EXCLUSIVA del producto "${producto}" con intención comercial`;


    const optionNotSearched = [
        `Mención general del producto "${producto}" en una descripcion`,
        `Mención de otro modelo de ${producto}`,
        `No tiene relación con "${producto}"`,
        `Es un tag para mejorar la visibilidad de otro producto`,	
        `La descripción puede ser una estafa o engaño`,	
        `La errores tipograficos que pueden dar lugar a pensar que es una estafa o engaño`,	
    ];

    const optionsBlackList = blackList.map(blackWord => `Mención EXCLUSIVA de la palabra: "${blackWord}"`);

    
    const resultado = await clasificator(texto, [optionSearched, ...optionNotSearched, ...optionsBlackList]);
    

    // Mostrar resultados
    console.log("Resultado:", resultado);

    // Devolver true si el modelo lo clasifica como positivo (venta), false en otro caso
    const resultSearchedIndex = resultado.labels.indexOf(optionSearched);
    return resultado.scores[resultSearchedIndex] > 0.5;
}

export const terminalLink = (text, url) =>
  `(${text} - ${url})`;

export const scrollToLoadAll = async (page) => {
  try {
    while (true) {
      const sectionsCount = await page.evaluate(() =>
        document.querySelectorAll(".SearchUnified__section").length
      );
      if (sectionsCount > 1) break;
      
      const previousHeight = await page.evaluate(() => document.body.scrollHeight);
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await sleep(1500);
      const newHeight = await page.evaluate(() => document.body.scrollHeight);
      if (newHeight === previousHeight) break;
    }
  } catch (error) {
    console.error("Error al hacer scroll:", error);
  }
};

export async function checkElementValidity(result, page, searchKeyword, blackListKeywords, useIA, spinner = null) {
  // Esperar un poco para evitar ser bloqueado
  await sleep(250);
  
  const lowerName = result.name.toLowerCase();
  const lowerSearch = searchKeyword.toLowerCase();


  

    


  if (useIA) {
    const validName = await analizeDescription(lowerName, lowerSearch, blackListKeywords);

      spinner && !validName && spinner.fail("El nombre no contiene la palabra clave. Comprobando la descripción...");
   
    await page.goto(result.url, { waitUntil: "networkidle2" });
    const descriptionText = await page.evaluate(() => {
      const descriptionElement = document.querySelector('[class^="item-detail_ItemDetail__description__"]');
      const firstDiv = descriptionElement?.querySelector("div");
      return firstDiv ? firstDiv.innerText.toLowerCase() : "";
    });

    const validDescription = await analizeDescription(descriptionText, lowerSearch, blackListKeywords);
    spinner && !validDescription && spinner.fail(`${terminalLink(result.name, result.url)} - Descripción sin la palabra clave`);

    if(!validName && validDescription) {
      return lowerName.includes(lowerSearch) && 
      !blackListKeywords.some(blackWord => lowerName.includes(blackWord.toLowerCase()));
    }

    return validName && validDescription;
  }


  const nameValido = lowerName.includes(lowerSearch) && 
    !blackListKeywords.some(blackWord => lowerName.includes(blackWord.toLowerCase()));

    if (nameValido) {
      return true;
    }
  
  spinner && spinner.fail("El nombre no contiene la palabra clave. Comprobando la descripción...");
  await page.goto(result.url, { waitUntil: "networkidle2" });
  
  // Extraer la descripción en el contexto del navegador
  const descriptionText = await page.evaluate(() => {
    const descriptionElement = document.querySelector('[class^="item-detail_ItemDetail__description__"]');
    const firstDiv = descriptionElement?.querySelector("div");
    return firstDiv ? firstDiv.innerText.toLowerCase() : "";
  });
  
   
    const descriptionMatches = descriptionText.slice(0, 77).includes(searchKeyword.toLowerCase());
    const contienePalabrasProhibidas = blackListKeywords.some(
      blackWord => descriptionText.includes(blackWord.toLowerCase())
    );
    const valid = descriptionMatches && !contienePalabrasProhibidas;
    spinner && !valid && spinner.fail(`${terminalLink(result.name, result.url)} - Descripción sin la palabra clave`);
    return valid;
  
}