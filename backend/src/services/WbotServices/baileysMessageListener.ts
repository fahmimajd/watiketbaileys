import { join } from "path";
import { promisify } from "util";
import { writeFile } from "fs";
import * as Sentry from "@sentry/node";
import { WASocket, downloadMediaMessage, proto } from "@whiskeysockets/baileys";
import { Op } from "sequelize";

import Contact from "../../models/Contact";
import Ticket from "../../models/Ticket";
import Message from "../../models/Message";
import Whatsapp from "../../models/Whatsapp";

import CreateOrUpdateContactService from "../ContactServices/CreateOrUpdateContactService";
import FindOrCreateTicketService from "../TicketServices/FindOrCreateTicketService";
import CreateMessageService from "../MessageServices/CreateMessageService";
import { logger } from "../../utils/logger";
import ShowWhatsAppService from "../WhatsappService/ShowWhatsAppService";
import UpdateTicketService from "../TicketServices/UpdateTicketService";
import formatBody from "../../helpers/Mustache";
import { getIO } from "../../libs/socket";

const writeFileAsync = promisify(writeFile);

const getMsgText = (m: proto.IWebMessageInfo): string | undefined => {
  const msg = m.message as proto.IMessage | undefined;
  if (!msg) return undefined;
  if (msg.conversation) return msg.conversation as string;
  if (msg.extendedTextMessage?.text) return msg.extendedTextMessage.text as string;
  if (msg.imageMessage?.caption) return msg.imageMessage.caption as string;
  if (msg.videoMessage?.caption) return msg.videoMessage.caption as string;
  if ((msg.ephemeralMessage?.message as any)?.conversation) return (msg.ephemeralMessage!.message as any).conversation as string;
  if ((msg.viewOnceMessage?.message as any)?.conversation) return (msg.viewOnceMessage!.message as any).conversation as string;
  return undefined;
};

const isFromGroup = (jid: string): boolean => jid.endsWith("@g.us");

const jidToNumber = (jid: string): string => jid.split("@")[0];

const saveMediaToDisk = async (
  sock: WASocket,
  m: proto.IWebMessageInfo
): Promise<{ filename: string; mimetype: string; mediaType: string } | null> => {
  const msg = m.message as proto.IMessage | undefined;
  if (!msg) return null;

  let mediaType: string | null = null;
  let mimetype: string | undefined;
  if (msg.imageMessage) {
    mediaType = "image";
    mimetype = msg.imageMessage.mimetype as string | undefined;
  } else if (msg.videoMessage) {
    mediaType = "video";
    mimetype = msg.videoMessage.mimetype as string | undefined;
  } else if (msg.audioMessage) {
    mediaType = "audio";
    mimetype = msg.audioMessage.mimetype as string | undefined;
  } else if (msg.documentMessage) {
    mediaType = "document";
    mimetype = msg.documentMessage.mimetype as string | undefined;
  }

  if (!mediaType) return null;

  try {
    const buffer = await downloadMediaMessage(
      m,
      "buffer",
      undefined as any,
      { logger: undefined as any, reuploadRequest: (sock as any).updateMediaMessage }
    );
    const ext = (mimetype || "application/octet-stream").split("/")[1] || "bin";
    const random = Math.random().toString(36).slice(2, 7);
    const filename = `${random}-${Date.now()}.${ext}`;
    const fullPath = join(__dirname, "..", "..", "..", "public", filename);
    await writeFileAsync(fullPath, buffer as Buffer);
    return { filename, mimetype: mimetype || "", mediaType };
  } catch (err) {
    Sentry.captureException(err);
    logger.error(err);
    return null;
  }
};

export const wireBaileysMessageListeners = (sock: WASocket, whatsapp: Whatsapp): void => {
  sock.ev.on("messages.upsert", async ({ messages, type }) => {
    for (const m of messages) {
      try {
        const remoteJid = m.key.remoteJid as string;
        if (!remoteJid) continue;
        if (remoteJid === "status@broadcast") continue;
        const fromMe = !!m.key.fromMe;
        const participant = (m.key.participant as string) || undefined;
        const isGroup = isFromGroup(remoteJid);
        const senderJid = isGroup ? participant || remoteJid : remoteJid;
        if (!senderJid) continue;

        const number = jidToNumber(senderJid);

        // Create or update contact
        const contactData = {
          name: number,
          number,
          profilePicUrl: undefined,
          isGroup
        } as any;
        const contact = await CreateOrUpdateContactService(contactData);

        // Find or create ticket with fromMe guard
        let ticket: Ticket | null = null;
        if (fromMe) {
          ticket = await Ticket.findOne({
            where: {
              status: { [Op.or]: ["open", "pending"] },
              contactId: contact.id,
              whatsappId: whatsapp.id
            },
            order: [["updatedAt", "DESC"]]
          });
          if (!ticket) {
            continue; // do not create a ticket from our own message
          }
        } else {
          const unread = 1;
          ticket = await FindOrCreateTicketService(contact, whatsapp.id, unread, undefined);
        }

        // Determine message content
        const text = getMsgText(m) || "";
        const mediaInfo = await saveMediaToDisk(sock, m);
        if (!mediaInfo && !text.trim()) {
          // ignore empty stubs
          continue;
        }

        // Determine quoted message
        const stanzaId = (m.message?.extendedTextMessage?.contextInfo?.stanzaId ||
          (m.message?.imageMessage as any)?.contextInfo?.stanzaId ||
          (m.message?.videoMessage as any)?.contextInfo?.stanzaId ||
          (m.message?.documentMessage as any)?.contextInfo?.stanzaId) as string | undefined;

        let quotedMsgId: string | undefined;
        if (stanzaId) {
          const found = await Message.findOne({ where: { id: stanzaId } });
          if (found) quotedMsgId = stanzaId;
        }

        const messageData: any = {
          id: m.key.id,
          ticketId: ticket.id,
          contactId: fromMe ? undefined : contact.id,
          body: mediaInfo ? mediaInfo.filename : text,
          fromMe,
          read: fromMe,
          mediaUrl: mediaInfo ? mediaInfo.filename : undefined,
          mediaType: mediaInfo ? mediaInfo.mediaType : (text ? "chat" : undefined),
          quotedMsgId
        };

        await ticket.update({ lastMessage: messageData.body });
        await CreateMessageService({ messageData });

        // Auto-greeting only on first inbound message of a ticket (new or reopened), delayed by 10s
        try {
          const totalMsgs = await Message.count({ where: { ticketId: ticket.id } });
          if (!fromMe && !isGroup && totalMsgs === 1) {
            const delay = Number(process.env.GREETING_DELAY_MS) || 10000;
            setTimeout(async () => {
              try {
                const detailedWhats = await ShowWhatsAppService(whatsapp.id);
                const hasQueues = detailedWhats.queues && detailedWhats.queues.length >= 1;

                if (hasQueues) {
                  if (detailedWhats.queues.length === 1) {
                    const q = detailedWhats.queues[0];
                    await UpdateTicketService({ ticketData: { queueId: q.id }, ticketId: ticket.id });
                    if (q.greetingMessage) {
                      const bodyText = formatBody(`\u200e${q.greetingMessage}`, contact as any);
                      await (sock as any).sendMessage(remoteJid, { text: bodyText });
                    }
                  } else {
                    let options = "";
                    detailedWhats.queues.forEach((q, idx) => {
                      options += `*${idx + 1}* - ${q.name}\n`;
                    });
                    const gm = detailedWhats.greetingMessage || "";
                    const bodyText = formatBody(`\u200e${gm}\n${options}`, contact as any);
                    await (sock as any).sendMessage(remoteJid, { text: bodyText });
                  }
                } else if (detailedWhats.greetingMessage) {
                  // Fallback: send WhatsApp-level greeting when no queues configured
                  const bodyText = formatBody(`\u200e${detailedWhats.greetingMessage}`, contact as any);
                  await (sock as any).sendMessage(remoteJid, { text: bodyText });
                }
              } catch (e) {
                logger.error(`Baileys greeting error: ${e}`);
              }
            }, 10000);
          }
        } catch (e) {
          logger.error(`Baileys greeting schedule error: ${e}`);
        }
      } catch (err) {
        Sentry.captureException(err);
        logger.error(`Baileys message handler error: ${err}`);
      }
    }
  });
  sock.ev.on("message-receipt.update", async (updates: any[]) => {
    const io = getIO();
    for (const u of updates) {
      try {
        const id: string | undefined = u.key?.id;
        if (!id) continue;
        const messageToUpdate = await Message.findByPk(id, {
          include: ["contact", { model: Message, as: "quotedMsg", include: ["contact"] }]
        });
        if (!messageToUpdate) continue;
        let ack = messageToUpdate.ack;
        const t: string | undefined = u.update?.type || u.type;
        if (t === "delivery") ack = Math.max(ack, 2);
        if (t === "read") ack = Math.max(ack, 3);
        if (t === "played") ack = Math.max(ack, 4);
        await messageToUpdate.update({ ack });
        io.to(messageToUpdate.ticketId.toString()).emit("appMessage", { action: "update", message: messageToUpdate });
      } catch (err) {
        logger.error(`Baileys ack update error: ${err}`);
      }
    }
  });
};

export default wireBaileysMessageListeners;
