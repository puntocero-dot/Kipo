// app.config.js en vez de app.json puro — necesario para que el build web
// pueda montarse bajo /app/* en producción (kipoapp.com/app/...) sin romper
// `expo start --web` en local (que debe seguir sirviendo en la raíz).
// Expo Router usa `experiments.baseUrl` para anteponer ese prefijo a cada
// ruta y a cada asset (_expo/static/...) durante `expo export -p web` — sin
// esto, el build exportado referencia rutas absolutas ("/_expo/...") que
// solo funcionan si la app vive en la raíz del dominio (ver vercel.json,
// que ahora sirve la landing en "/" y esta app en "/app").
//
// EXPO_WEB_BASE_PATH lo define únicamente el buildCommand de vercel.json
// para el build de producción — en local, sin la variable, baseUrl queda
// vacío y todo se comporta exactamente igual que antes.
const appJson = require('./app.json');

module.exports = {
  ...appJson,
  expo: {
    ...appJson.expo,
    experiments: {
      ...appJson.expo.experiments,
      baseUrl: process.env.EXPO_WEB_BASE_PATH || '',
    },
  },
};
