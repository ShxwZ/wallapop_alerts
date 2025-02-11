# Wallapop Newest Product Finder

## Índice
- [Descripción](#descripción)
- [Instalación](#instalación)
- [Parámetros de Configuración](#parámetros-de-configuración)
- [Ejecución](#ejecución)
- [Resultados](#resultados)
- [Intervalo de tiempo](#intervalo-de-tiempo)
- [Cache](#cache)
- [Uso de IA](#uso-de-ia)
- [Consideraciones](#consideraciones)

## Descripción
Este script de Node.js busca productos en Wallapop más recientes que coincidan con una palabra clave y otros filtros configurables. Los resultados se guardan en un archivo JSON y se muestran en la consola. Además, se envía una notificación de Windows con el enlace al producto más reciente encontrado.
El script esta pensado para buscar algo en concreto, por favor intente ser lo más especifico posible en la busqueda para evitar problemas con el limite de peticiones de wallapop.

## Instalación
Primer paso instalar los node modules
```bash
npm install
```

## Parámetros de Configuración
Primero necesitamos configurar el fichero de config.json con los parametros que queramos usas en las busquedas.

- **timeIntervalMinutes**: Intervalo en minutos entre cada comprobación.
- **searchKeyword**: Palabra clave utilizada para las búsquedas.
- **blackListKeywords**: Lista de palabras clave que se deben excluir en los resultados.
- **maxPrice**: Precio máximo permitido para los productos.
- **minPrice**: Precio mínimo permitido para los productos.
- **shipping**: Valor booleano que indica si se requiere opción de envío.
- **categoryIds**: Arreglo de identificadores de las categorías.
- **objectTypeIds**: Arreglo de identificadores de los tipos de objeto.
- **useIA**: Valor booleano que indica si se quiere usar la IA para afinar filtrado.

Modifica estos valores en el archivo [config.json](config.json) según tus necesidades.

Para obtener las categorias y object types, se obtienen de aquí: [Wallapop API categorias](https://api.wallapop.com/api/v3/categories)

Cuanto más filtros más optima será la busqueda.

## Ejecución
Para ejecutar el scraper, simplemente ejecuta el siguiente comando:
```bash
node ./script.js
```
## Resultados
Los resultados se guardan en un archivo llamado `results.json` en la raíz del proyecto. Cada vez que se ejecuta el script, se sobrescribe el archivo con los nuevos resultados.

Cada vez que se encuentra se envía una notificación de windows que al hacer click te lleva al producto en wallapop.

En la consola se muestra el resultado de la busqueda y los ultimos 3 productos validos encontrados.
Un producto es valido si el producto tiene en el titulo la palabra clave y no tiene ninguna de las palabras clave de la blacklist ó si el production tiene en la descripcion la palabra clave y no tiene ninguna de las palabras clave de la blacklist.

:warning: Hay que tener en cuenta que los resultados "validos" se validan después de aplicar los filtros de precio, envío, categoría y tipo de objeto que se hace directamente en la busqueda de wallapop.

## Intervalo de tiempo
El intervalo de tiempo entre cada comprobación se puede configurar en el archivo `config.json` con el parámetro `timeIntervalMinutes`.

Hay que tener en cuenta que wallapop tiene un limite de peticiones por minuto, por lo que no se recomienda poner un intervalo de tiempo muy bajo.

Cada ejecución comprueba el ultimo producto encontrado y si ya se ha encontrado no se vuelve a notificar. En caso de ser nuevo se notifica y se saca en consola el top 3 productos más baratos encontrados y se cachean su url, precio y si era valido para evitar hacer peticiones innecesarias.

## Cache
Para evitar hacer peticiones innecesarias se cachean los productos encontrados en la ejecución anterior. Si un producto ya se ha encontrado en la ejecución anterior no se vuelve a notificar. La cache se guarda en el archivo `cache.json` en la raíz del proyecto.
Al iniciar el script se carga la cache y se comprueba si los productos encontrados en la ejecución anterior siguen siendo validos, si no lo son se eliminan de la cache.

## Uso de IA
El uso de IA es opcional y se puede activar o desactivar en el archivo `config.json` con el parámetro `useIA`. Si se activa, se utiliza la librería `transformers.js` para analizar la descripción de los productos y filtrar los resultados que no contengan la palabra clave. Si se desactiva, solo se analiza el título de los productos y la primera linea de la descripcion.

## Consideraciones
- Este script no está afiliado con Wallapop.
- Este script no está diseñado para uso comercial.
- Este script no está diseñado para uso intensivo.
- Este proyecto es solo para fines de aprendizaje.