import * as Sentry from "@sentry/node";
// Polyfill globalThis.crypto for Node < 18
// eslint-disable-next-line @typescript-eslint/no-var-requires
const __nodeCrypto = require("crypto");
if (!(global as any).crypto && __nodeCrypto?.webcrypto) {
  (global as any).crypto = __nodeCrypto.webcrypto;
}
import makeWASocket, {
  WASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion
} from "@whiskeysockets/baileys";

import Whatsapp from "../models/Whatsapp";
import { getIO } from "./socket";
import { logger } from "../utils/logger";
import wireBaileysMessageListeners from "../services/WbotServices/baileysMessageListener";

// Maintain sessions keyed by whatsapp.id, similar to the wweb adapter
const sessions = new Map<number, WASocket>();

export type Session = WASocket & { id?: number };

export const initWbot = async (whatsapp: Whatsapp): Promise<Session> => {
  const io = getIO();

  await whatsapp.update({ status: "OPENING" });
  io.emit("whatsappSession", { action: "update", session: whatsapp });

  try {
    const authDir = process.env.BAILEYS_AUTH_DIR || `.baileys-${whatsapp.id}`;
    const { state, saveCreds } = await useMultiFileAuthState(authDir);
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
      version,
      auth: state,
      printQRInTerminal: false,
      browser: ["Whaticket", "Chrome", "1.0.0"],
      connectTimeoutMs: 30000,
      syncFullHistory: false
    });

    // Tag the socket with our id for quick reference
    (sock as Session).id = whatsapp.id;

    sessions.set(whatsapp.id, sock);

    sock.ev.on("creds.update", saveCreds);

    sock.ev.on("connection.update", async ({ connection, lastDisconnect, qr }) => {
      try {
        if (qr) {
          await whatsapp.update({ qrcode: qr, status: "qrcode", retries: 0 });
          io.emit("whatsappSession", { action: "update", session: whatsapp });
        }

        if (connection === "connecting") {
          await whatsapp.update({ status: "OPENING" });
          io.emit("whatsappSession", { action: "update", session: whatsapp });
        }

        if (connection === "open") {
          await whatsapp.update({ status: "CONNECTED", qrcode: "", retries: 0 });
          io.emit("whatsappSession", { action: "update", session: whatsapp });
        }

        if (connection === "close") {
          const statusCode = (lastDisconnect?.error as any)?.output?.statusCode;
          const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

          await whatsapp.update({ status: shouldReconnect ? "OPENING" : "DISCONNECTED" });
          io.emit("whatsappSession", { action: "update", session: whatsapp });

          if (shouldReconnect) {
            setTimeout(() => initWbot(whatsapp).catch(err => logger.error(err)), 2000);
          } else {
            sessions.delete(whatsapp.id);
          }
        }
      } catch (err) {
        Sentry.captureException(err);
        logger.error(err);
      }
    });

    // Wire message events
    wireBaileysMessageListeners(sock, whatsapp);
    return sock as Session;
  } catch (err) {
    Sentry.captureException(err);
    logger.error(err);
    throw err;
  }
};

export const getWbot = (whatsappId: number): Session => {
  const sock = sessions.get(whatsappId);
  if (!sock) {
    throw new Error("ERR_WAPP_NOT_INITIALIZED");
  }
  return sock as Session;
};

export const removeWbot = (whatsappId: number): void => {
  try {
    const sock = sessions.get(whatsappId);
    if (sock) {
      try {
        // @ts-ignore
        sock.end?.();
      } catch (e) {
        // ignore
      }
      sessions.delete(whatsappId);
    }
  } catch (err) {
    Sentry.captureException(err);
    logger.error(err);
  }
};
