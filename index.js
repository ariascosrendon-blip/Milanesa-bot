const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const pino = require('pino');
const qrcode = require('qrcode-terminal');

async function conectarMilanesas() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');

    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: false,
        logger: pino({ level: 'silent' }),
        browser: ["Milanesas Bot", "Chrome", "4.0.0"]
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
            console.log('\nEscanea este nuevo código QR con tu WhatsApp:\n');
            qrcode.generate(qr, { small: true });
        }

        if (connection === 'close') {
            const statusCode = (lastDisconnect?.error instanceof Boom)?.output?.statusCode;
            const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

            console.log('Conexión cerrada. Código:', statusCode, '| Reconectando...', shouldReconnect);

            if (shouldReconnect) {
                setTimeout(() => {
                    conectarMilanesas();
                }, 3000);
            } else {
                console.log('Sesión cerrada desde el teléfono. Borra auth_info_baileys para vincular de nuevo.');
            }
        } else if (connection === 'open') {
            console.log('\n╔════════════════════╗');
            console.log('║  MILANESAS 4.0     ║');
            console.log('║  CONECTADO A WHATSAPP ║');
            console.log('╚════════════════════╝\n');
        }
    });

    sock.ev.on('messages.upsert', async ({ messages, type }) => {
        if (type !== 'notify') return;

        const m = messages[0];
        if (!m.message)  return;

        const messageContent = m.message.conversation || m.message.extendedTextMessage?.text || '';
        const sender = m.key.remoteJid;

        if (messageContent.startsWith('/')) {
            console.log(`[COMANDO RECIBIDO] ${messageContent} de ${sender}`);

            if (messageContent === '/menu') {
                const menuTexto = 
                    "╔════════════════════╗\n" +
                    "      MILANESAS 4.0   \n" +
                    "   SISTEMA DE ADMINISTRACIÓN\n" +
                    "╚════════════════════╝\n\n" +
                    "/menu - Muestra este menú\n" +
                    "/info - Información del sistema\n" +
                    "/admins - Lista de administradores";

                await sock.sendMessage(sender, { text: menuTexto });
            } 
            else if (messageContent === '/info') {
                await sock.sendMessage(sender, { text: "MILANESAS 4.0 | Conectado a WhatsApp mediante Baileys y Termux." });
            }
            else if (messageContent === '/admins') {
                await sock.sendMessage(sender, { text: "Propietario: David\nAdministradores: Chimi, Lucí, Vale" });
            }
        }
    });
}

conectarMilanesas();


