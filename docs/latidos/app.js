// Página de latidos (ejercicio final de la S2, IN1042). Lee config.json (modelos y nombre del archivo de latidos)
// y latidos.json: {"latidos": [[140 números], ...], "etiquetas": [0/1, ...]} con 1 = ANORMAL.
// Tu modelo debe recibir (1, 140, 1) en float32, con los latidos tal como vienen en ECG5000, y devolver P(anormal).
const $ = (id) => document.getElementById(id);
let CFG = null, DATOS = null, sesion = null, infoSesion = null;
const lienzo = $("lienzo"), ctx = lienzo.getContext("2d");

(async () => {
  CFG = await leerConfig();
  DATOS = await (await fetch(CFG.latidos)).json();
  CFG.modelos.forEach((m, i) => $("selModelo").add(new Option(m.nombre, i)));
  $("dispositivo").textContent = describirDispositivo() + ` · ${DATOS.latidos.length} latidos de prueba incluidos`;
})();

$("btnCargar").onclick = async () => {
  const m = CFG.modelos[$("selModelo").value];
  $("estadoModelo").textContent = `Descargando ${m.archivo}…`;
  try {
    infoSesion = await cargarSesion(m.archivo, (t) => ($("estadoModelo").textContent = t));
    sesion = infoSesion.sesion; infoSesion.nombre = m.nombre;
    $("estadoModelo").textContent = `✔ ${m.nombre}: ${(infoSesion.mb * 1000).toFixed(0)} KB · preparación ${infoSesion.msCrear.toFixed(0)} ms`;
    $("btnAzar").disabled = $("btnTodos").disabled = false;
  } catch (e) { $("estadoModelo").textContent = "Error: " + e.message; }
};

const tensor = (latido) => new ort.Tensor("float32", Float32Array.from(latido), [1, latido.length, 1]);

async function probabilidad(latido) {
  const salida = await sesion.run({ [sesion.inputNames[0]]: tensor(latido) });
  return salida[sesion.outputNames[0]].data[0];
}

function graficar(latido, color) {
  const W = lienzo.width, H = lienzo.height, mn = Math.min(...latido), mx = Math.max(...latido);
  ctx.clearRect(0, 0, W, H); ctx.strokeStyle = color; ctx.lineWidth = 2.5; ctx.beginPath();
  latido.forEach((v, i) => { const x = (i / (latido.length - 1)) * (W - 20) + 10, y = H - 10 - ((v - mn) / (mx - mn)) * (H - 20); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
  ctx.stroke();
}

$("btnAzar").onclick = async () => {
  const i = Math.floor(Math.random() * DATOS.latidos.length), latido = DATOS.latidos[i], real = DATOS.etiquetas[i];
  const t0 = performance.now(), p = await probabilidad(latido), ms = performance.now() - t0;
  const anormal = p >= CFG.umbral;
  graficar(latido, anormal ? "#E4572E" : "#17BEBB");
  $("resultado").className = "resultado " + (anormal ? "alerta" : "ok");
  $("resultado").textContent = `Latido #${i}: ${anormal ? "ANORMAL, revisar" : "normal"} · P = ${p.toFixed(3)} · real: ${real ? "anormal" : "normal"} ${anormal === !!real ? "✔" : "✖"} · ${ms.toFixed(1)} ms`;
};

$("btnTodos").onclick = async () => {
  $("btnTodos").disabled = true;
  let vp = 0, vn = 0, fp = 0, fn = 0; const tiempos = [];
  for (let i = 0; i < DATOS.latidos.length; i++) {
    const t0 = performance.now(), p = await probabilidad(DATOS.latidos[i]);
    tiempos.push(performance.now() - t0);
    const pred = p >= CFG.umbral, real = !!DATOS.etiquetas[i];
    if (pred && real) vp++; else if (!pred && !real) vn++; else if (pred) fp++; else fn++;
  }
  const t = $("tablaTodos");
  if (!t.rows.length) t.innerHTML = "<tr><th>Modelo</th><th>Sensibilidad</th><th>Especificidad</th><th>ms por latido</th></tr>";
  t.insertRow().innerHTML = `<td>${infoSesion.nombre}</td><td>${(vp / (vp + fn) * 100).toFixed(1)} %</td><td>${(vn / (vn + fp) * 100).toFixed(1)} %</td><td><b>${mediana(tiempos).toFixed(2)}</b></td>`;
  $("btnTodos").disabled = false;
};
