const fs = require("fs");
const crypto = require("crypto");
const rl = require("readline-sync");

const ARCHIVO = "datos.json";
const AUTH = "auth.json";

const datos = JSON.parse(fs.readFileSync(ARCHIVO, "utf8"));
datos.admins ||= [];
datos.avisos ||= [];
datos.historial ||= [];

function guardar() {
  fs.writeFileSync(ARCHIVO, JSON.stringify(datos, null, 2));
}

function guardarAuth(cuentas) {
  fs.writeFileSync(AUTH, JSON.stringify(cuentas, null, 2), { mode: 0o600 });
}

function crearHash(pin) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(pin, salt, 64).toString("hex");
  return { salt, hash };
}

function comprobar(pin, cuenta) {
  const resultado = crypto.scryptSync(pin, cuenta.salt, 64);
  const original = Buffer.from(cuenta.hash, "hex");
  return crypto.timingSafeEqual(resultado, original);
}

function nuevoPin(nombre) {
  while (true) {
    const pin = rl.question(
      `Crea el PIN privado de ${nombre}: `,
      { hideEchoBack: true }
    );
    const repetir = rl.question(
      "Repite el PIN: ",
      { hideEchoBack: true }
    );

    if (pin.length >= 8 && pin === repetir) return crearHash(pin);
    console.log("Deben coincidir y tener mínimo 8 caracteres.");
  }
}

let cuentas = {};

if (fs.existsSync(AUTH)) {
  cuentas = JSON.parse(fs.readFileSync(AUTH, "utf8"));
} else {
  console.log("CONFIGURACIÓN PRIVADA DE MILANESAS");
  const nombres = [datos.propietario, ...datos.admins];

  for (const nombre of nombres) {
    cuentas[nombre] = nuevoPin(nombre);
  }

  guardarAuth(cuentas);
  console.log("Credenciales guardadas.");
}

let usuario = "";
let intentos = 0;

while (intentos < 3 && !usuario) {
  const nombre = rl.question("Nombre: ");
  const pin = rl.question("PIN privado: ", { hideEchoBack: true });

  if (cuentas[nombre] && comprobar(pin, cuentas[nombre])) {
    usuario = nombre;
  } else {
    intentos++;
    console.log("Credenciales incorrectas.");
  }
}

if (!usuario) {
  console.log("Acceso bloqueado. Reinicia el programa.");
  process.exit(1);
}

const propietario = () => usuario === datos.propietario;
const admin = () => propietario() || datos.admins.includes(usuario);

function registrar(accion) {
  datos.historial.push({
    usuario,
    accion,
    fecha: new Date().toISOString()
  });
  guardar();
}

function menu() {
  console.log(`
======= MILANESAS 4.0 =======
/menu
/admin
/admins
/agregar nombre
/retirar nombre
/aviso texto
/historial
/info
/salir
`);
}

console.log(`Acceso autorizado. Bienvenido, ${usuario}.`);
menu();

while (true) {
  const entrada = rl.question("MILANESAS > ").trim();
  const espacio = entrada.indexOf(" ");
  const comando = (espacio < 0 ? entrada : entrada.slice(0, espacio)).toLowerCase();
  const texto = espacio < 0 ? "" : entrada.slice(espacio + 1).trim();

  if (comando === "/salir") {
    console.log("MILANESAS desconectado.");
    break;
  }

  switch (comando) {
    case "/menu":
      menu();
      break;

    case "/admin":
      console.log(admin() ? "Panel autorizado." : "Acceso denegado.");
      break;

    case "/admins":
      console.log("Propietario:", datos.propietario);
      console.log("Administradores:", datos.admins);
      console.log("Puestos disponibles:", 5 - datos.admins.length);
      break;

    case "/agregar":
      if (!propietario()) {
        console.log("Solo el propietario puede agregar administradores.");
        break;
      }
      if (!texto || datos.admins.length >= 5 ||
          texto === datos.propietario || datos.admins.includes(texto)) {
        console.log("Nombre inválido o no quedan puestos disponibles.");
        break;
      }
      cuentas[texto] = nuevoPin(texto);
      datos.admins.push(texto);
      guardarAuth(cuentas);
      registrar("Agregó al administrador " + texto);
      console.log("Administrador agregado.");
      break;

    case "/retirar":
      if (!propietario()) {
        console.log("Solo el propietario puede retirar administradores.");
        break;
      }
      if (!datos.admins.includes(texto)) {
        console.log("Administrador no encontrado.");
        break;
      }
      datos.admins = datos.admins.filter(a => a !== texto);
      delete cuentas[texto];
      guardarAuth(cuentas);
      registrar("Retiró al administrador " + texto);
      console.log("Administrador retirado.");
      break;

    case "/aviso":
      if (!admin()) console.log("Acceso denegado.");
      else if (!texto) console.log("Uso: /aviso mensaje");
      else {
        datos.avisos.push(texto);
        registrar("Creó aviso: " + texto);
        console.log("Aviso guardado.");
      }
      break;

    case "/historial":
      if (!admin()) console.log("Acceso denegado.");
      else console.log(datos.historial.length ? datos.historial : "Sin registros.");
      break;

    case "/info":
      console.log("MILANESAS 4.0 | Seguridad local");
      break;

    default:
      console.log("Comando desconocido. Escribe /menu.");
  }
}
