// Utilidades comunes de las páginas de la S2 (IN1042). No hace falta modificarlas.
ort.env.wasm.numThreads = 1;      // GitHub Pages no permite varios hilos de WebAssembly: un solo hilo, igual en todos los teléfonos
ort.env.wasm.proxy = false;

async function leerConfig() {
  const r = await fetch("config.json", { cache: "no-store" });
  return r.json();
}

// Descarga un .onnx mostrando su tamaño y crea la sesión de ONNX Runtime Web (corre en el procesador del celular).
async function cargarSesion(archivo, alAvanzar) {
  const t0 = performance.now();
  const r = await fetch(archivo);
  if (!r.ok) throw new Error(`No se encontró ${archivo} (${r.status})`);
  const bytes = new Uint8Array(await r.arrayBuffer());
  const tDescarga = performance.now() - t0;
  if (alAvanzar) alAvanzar(`Descargado: ${(bytes.length / 1e6).toFixed(1)} MB en ${(tDescarga / 1000).toFixed(1)} s. Preparando…`);
  const t1 = performance.now();
  const sesion = await ort.InferenceSession.create(bytes, { executionProviders: ["wasm"], graphOptimizationLevel: "all" });
  return { sesion, mb: bytes.length / 1e6, msDescarga: tDescarga, msCrear: performance.now() - t1 };
}

function mediana(v) {
  const s = [...v].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

// Corre la misma entrada n veces y regresa la mediana de los milisegundos (la primera corrida se descarta: «calentamiento»).
async function medirLatencia(sesion, feeds, n) {
  await sesion.run(feeds);
  const tiempos = [];
  for (let i = 0; i < n; i++) {
    const t0 = performance.now();
    await sesion.run(feeds);
    tiempos.push(performance.now() - t0);
  }
  return { mediana: mediana(tiempos), min: Math.min(...tiempos), max: Math.max(...tiempos) };
}

function describirDispositivo() {
  const ua = navigator.userAgent;
  const m = ua.match(/\(([^)]+)\)/);
  return `Dispositivo: ${m ? m[1] : ua} · núcleos lógicos: ${navigator.hardwareConcurrency || "?"}`;
}

const sigmoide = (x) => 1 / (1 + Math.exp(-x));
