//Variables globales para el objeto mapa, el servicio de Places (aunque no se usa el antiguo service),
//y una matriz para almacenar los marcadores.
let map;
let service; 
let markers = [];
let infoWindow; 
let promedioMarker = null; // marcador del promedio



//Define las coordenadas centrales iniciales (Nuevo Casas Grandes, Chihuahua, México).
const center = { lat: 30.378746, lng: -107.880062 };
const restaurantListElement = document.getElementById("restaurants-list");
let getPhotoUrlFunction;
//consulta de búsqueda predeterminada.
let currentSearch ="Tacos, comida, restaurantes"

//Iniciar mapa
async function initMap() {
  const defaultLocation = center;
  //importa la clase Place y la función getPhotoUrl de la librería places. 
  //Esto reemplaza la necesidad de crear un objeto PlacesService como en la versión anterior.
    const { Place, getPhotoUrl } = await google.maps.importLibrary("places");
    const { AdvancedMarkerElement } = await google.maps.importLibrary("marker"); // <-- ¡Añadido!

    getPhotoUrlFunction = getPhotoUrl; 
    //crear mapa
    map = new google.maps.Map(document.getElementById("map"), {
        center: defaultLocation,
        zoom: 14,
        mapId: "ITSNCG-MAP", 
    });
    
    infoWindow = new google.maps.InfoWindow();
    //Inicia la primera búsqueda automáticamente. Y guarda el promedio
     await findPlaces(currentSearch);


    
}






//Limpia el mapa de busquedas anteriores
function clearMarkers() {
  markers.forEach((marker) => marker.setMap(null));
  markers = [];
  if (infoWindow) infoWindow.close();
  if (restaurantListElement) {
      restaurantListElement.innerHTML = "";
  }
}

//Agregar marcador
async function addMarkerAndDisplay(place, bounds) {
    const { AdvancedMarkerElement } = await google.maps.importLibrary("marker");
    const marker = new AdvancedMarkerElement({
      map,
      position: place.location,
      title: place.displayName,
    });
    bounds.extend(place.location);
    markers.push(marker);
    displayRestaurant(place);
    marker.addListener("click", () => {
        infoWindow.close(); 
        const content = `
            <div class="info-window-content">
                <h6 class="fw-bold">${place.displayName}</h6>
                <p class="mb-1">${place.formattedAddress || 'Dirección no disponible'}</p>
                <div class="rating text-warning">⭐ ${place.rating || 'N/A'}</div>
            </div>
        `;
        infoWindow.setContent(content);
        infoWindow.open({
            anchor: marker,
            map: map,
            shouldFocus: false, 
        });
        map.panTo(place.location);
    });
}


//Encontrar lugares
async function findPlaces(searchText) {
  clearMarkers(); 
  const { Place } = await google.maps.importLibrary("places");
  
  const request = {
    textQuery: searchText,
    //NOTA ENTRE MÁS DATOS SE PIDA DEL LOCAL, MÁS CARO SALE LA PETICIÓN
    //OBTENER Más datos: https://developers.google.com/maps/documentation/places/web-service/data-fields?hl=en
    fields: [
        "displayName", "location", "businessStatus", "rating", "photos", "formattedAddress","userRatingCount"
    ],
    //includedType: "restaurant",
    locationBias: center,
    isOpenNow: true,
    language: "es-MX",
    maxResultCount: 20,
    region: "mx",
    useStrictTypeFiltering: false,
  };

  const { places } = await Place.searchByText(request);
  const { LatLngBounds } = await google.maps.importLibrary("core");
  const bounds = new LatLngBounds();


  if (places.length) {
    console.log("Resultados de Places (New):", places);

//PROMEDIO (SUMA TODO)
    let sumLat = 0;
    let sumLng = 0;

        for (const place of places) { 
            await addMarkerAndDisplay(place, bounds);
const lat = place.location?.lat();
      const lng = place.location?.lng();

      if (typeof lat === "number" && typeof lng === "number") {
        sumLat += lat;
        sumLng += lng;
        await addMarkerAndDisplay(place, bounds);
      } else {
        console.warn("Coordenadas inválidas para:", place.displayName, place.location);
      }
        }
        
//END SUMA PROMEDIO

        map.fitBounds(bounds);
         // Calcula promedio solo si hay lugares válidos
    const avgLat = sumLat / places.length;
    const avgLng = sumLng / places.length;

    if (!isNaN(avgLat) && !isNaN(avgLng)) {
      const promedioLocation = new google.maps.LatLng(avgLat, avgLng);

      // Crear marcador personalizado
      const { AdvancedMarkerElement } = await google.maps.importLibrary("marker");
      const img = document.createElement("img");
      img.src = "./icons/icon.png";
      img.style.width = "45px";
      img.style.height = "45px";

      // Elimina marcador anterior si existe
      if (promedioMarker) {
        promedioMarker.map = null;
      }

      promedioMarker = new AdvancedMarkerElement({
        map,
        position: promedioLocation,
        content: img,
        title: "Promedio de lugares",
      });

      promedioMarker.addListener("click", () => {
        infoWindow.close();
        infoWindow.setContent(`<div class="fw-bold">📍 Promedio de los lugares encontrados</div>
          <div>Latitud: ${avgLat.toFixed(6)}</div>
          <div>Longitud: ${avgLng.toFixed(6)}</div>
        `);
        infoWindow.open({ anchor: promedioMarker, map });
      });
    } else {
      console.warn("No se pudo calcular el promedio, coordenadas inválidas.");
    }
  } else {
    console.log("No se encontraron resultados para la búsqueda.");
    if (restaurantListElement) {
        restaurantListElement.innerHTML = `<p class='text-center mt-4'>No se encontraron resultados para "${searchText}".</p>`;
    }
  }
}

//Mostrar datos de los restaurantes
async function displayRestaurant(place) {
    const ratingCount = place.userRatingCount ? `(${place.userRatingCount} Comentarios)` : '(Sin comentarios)';

    if (!restaurantListElement) return;

    let photoUrl = "";
    
    if (place.photos && place.photos.length > 0) {
        //console.log("URL",place.photos[0])
        photoUrl = place.photos[0].getURI({ 
            //photo: place.photos[0], 
            maxWidth: 500, 
            maxHeight: 200 
        });
    }
    let statusText = place.businessStatus === 'OPERATIONAL' ? 
        '<span class="text-success fw-bold">Abierto</span>' : 
        '<span class="text-danger fw-bold">Estado Desconocido</span>';

    const card = `
        <div class="restaurant-card p-3" onclick="map.panTo({lat: ${place.location.lat}, lng: ${place.location.lng}}); map.setZoom(17);">
            <img src="${photoUrl}" class="w-100 restaurant-img" alt="${place.displayName}" loading="lazy">
            <h6 class="mt-3 mb-1 fw-bold">${place.displayName}</h6>
            <p class="mb-1 text-muted">
                ${place.formattedAddress || 'Dirección no disponible'}
            </p>
            <p class="mb-2 text-muted">
                ${statusText} 
            </p>
            <div class="rating text-warning">⭐ ${place.rating || 'N/A'} ${ratingCount}</div>
        </div>
    `;

    restaurantListElement.innerHTML += card;
}


async function searchCityAndPlaces(cityName) {
   
    const { Geocoder } = await google.maps.importLibrary("geocoding");
    const geocoder = new Geocoder();

  
    geocoder.geocode({ address: cityName }, (results, status) => {
        if (status === "OK" && results[0]) {
           
            const newLocation = results[0].geometry.location;
            
          
            center.lat = newLocation.lat();
            center.lng = newLocation.lng();

           
            map.setCenter(newLocation);
        
            findPlaces(currentSearch); 

        } else {
            console.error("Geocoding falló con el estado:", status);
            alert(`No se pudo encontrar la ubicación para "${cityName}": ${status}`);
        }
    });
}


document.addEventListener("DOMContentLoaded", () => {
    const searchButton = document.getElementById("search-btn");
    const locationInput = document.getElementById("location-input");
    
    if (searchButton && locationInput) {
        searchButton.addEventListener("click", () => {
            const searchText = locationInput.value.trim();
            if (searchText) {
                searchCityAndPlaces(searchText);
            }
        });
        
        locationInput.addEventListener("keydown", (event) => {
            if (event.key === "Enter") {
                searchButton.click();
            }
        });
    }
});