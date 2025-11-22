import { join } from "path";
import { promisify } from "util";
import { writeFile } from "fs";
import * as Sentry from "@sentry/node";
import type { WASocket, proto } from "@whiskeysockets/baileys";
import { Op } from "sequelize";

import Ticket from "../../models/Ticket";
import Message from "../../models/Message";
import Whatsapp from "../../models/Whatsapp";

import CreateOrUpdateContactService from "../ContactServices/CreateOrUpdateContactService";
import FindOrCreateTicketService from "../TicketServices/FindOrCreateTicketService";
import CreateMessageService from "../MessageServices/CreateMessageService";
import { logger } from "../../utils/logger";
import ShowWhatsAppService from "../WhatsappService/ShowWhatsAppService";
import Setting from "../../models/Setting";
import UpdateTicketService from "../TicketServices/UpdateTicketService";
import formatBody from "../../helpers/Mustache";
import { getIO } from "../../libs/socket";
import { getBaileysModule } from "../../libs/baileysLoader";
import { getJidUser } from "../../helpers/Jid";

const writeFileAsync = promisify(writeFile);

const GROUP_METADATA_TTL_MS = 5 * 60 * 1000;
const groupMetadataCache = new Map<string, { subject?: string; expiresAt: number }>();

const getGroupSubject = async (sock: WASocket, jid: string): Promise<string | undefined> => {
  const now = Date.now();
  const cached = groupMetadataCache.get(jid);
  if (cached && cached.expiresAt > now) {
    return cached.subject;
  }

  try {
    const metadata = await sock.groupMetadata(jid);
    const subject = metadata?.subject || undefined;
    groupMetadataCache.set(jid, { subject, expiresAt: now + GROUP_METADATA_TTL_MS });
    return subject;
  } catch (err) {
    groupMetadataCache.delete(jid);
    throw err;
  }
};

const getMsgText = (m: proto.IWebMessageInfo): string | undefined => {
  const msg = m.message as proto.IMessage | undefined;
  if (!msg) return undefined;
  if (msg.conversation) return msg.conversation as string;
  if (msg.extendedTextMessage?.text) return msg.extendedTextMessage.text as string;
  if (msg.imageMessage?.caption) return msg.imageMessage.caption as string;
  if (msg.videoMessage?.caption) return msg.videoMessage.caption as string;
  if (msg.documentMessage?.caption) return msg.documentMessage.caption as string;
  if ((msg.ephemeralMessage?.message as any)?.conversation) return (msg.ephemeralMessage!.message as any).conversation as string;
  if ((msg.viewOnceMessage?.message as any)?.conversation) return (msg.viewOnceMessage!.message as any).conversation as string;
  return undefined;
};

const isFromGroup = (jid: string): boolean => jid.endsWith("@g.us");

const jidToNumber = (jid: string): string => getJidUser(jid);

const getJidDomain = (jid?: string): string => {
  if (!jid) return "";
  const atIndex = jid.indexOf("@");
  return atIndex > -1 ? jid.slice(atIndex + 1) : "";
};

const isPhoneNumberJid = (jid?: string): boolean => {
  if (!jid) return false;
  const domain = getJidDomain(jid);
  return domain === "s.whatsapp.net" || domain === "c.us" || domain === "hosted";
};

const preferPhoneNumberJid = (jid?: string, alt?: string): string | undefined => {
  if (isPhoneNumberJid(jid)) {
    return jid;
  }
  if (isPhoneNumberJid(alt)) {
    return alt;
  }
  return jid || alt;
};

const GENERIC_PUSHNAME_PREFIXES = [
  "server",
  "layanan",
  "aduan",
  "customer service",
  "support",
  "whatsapp",
  "notifikasi",
  "pesan",
  "pengaduan"
];

const sanitizePushName = (value?: string): string | undefined => {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const normalized = trimmed.toLowerCase();
  if (/^(\+?\d[\d\s-]{4,})$/.test(trimmed)) {
    return undefined;
  }
  if (GENERIC_PUSHNAME_PREFIXES.some(prefix => normalized.startsWith(prefix))) {
    return undefined;
  }
  return trimmed;
};

const saveMediaToDisk = async (
  sock: WASocket,
  m: proto.IWebMessageInfo
): Promise<{ filename: string; mimetype: string; mediaType: string; displayName?: string } | null> => {
  const { downloadMediaMessage } = await getBaileysModule();
  const msg = m.message as proto.IMessage | undefined;
  if (!msg) return null;

  let mediaType: string | null = null;
  let mimetype: string | undefined;
  let displayName: string | undefined;
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
    displayName = msg.documentMessage.fileName as string | undefined;
  }

  if (!mediaType) return null;

  try {
    const buffer = await downloadMediaMessage(
      m as any,
      "buffer",
      undefined as any,
      { logger: undefined as any, reuploadRequest: (sock as any).updateMediaMessage }
    );
    const ext = (mimetype || "application/octet-stream").split("/")[1] || "bin";
    const random = Math.random().toString(36).slice(2, 7);
    const filename = `${random}-${Date.now()}.${ext}`;
    const fullPath = join(__dirname, "..", "..", "..", "public", filename);
    await writeFileAsync(fullPath, buffer as Buffer);
    return { filename, mimetype: mimetype || "", mediaType, displayName };
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
        const remoteJidAlt = (m.key as any).remoteJidAlt as string | undefined;
        const chatContactJid = preferPhoneNumberJid(remoteJid, remoteJidAlt) || remoteJid;
        const remoteNumber = jidToNumber(chatContactJid);
        const rawPushName = typeof m.pushName === "string" ? m.pushName : undefined;
        const sanitizedPushName = sanitizePushName(rawPushName);
        const pushNameExtraInfo =
          rawPushName && rawPushName.trim()
            ? [{ name: "waPushName", value: rawPushName.trim() }]
            : [];

        const selfJid =
          (sock.user?.id as string | undefined) ||
          ((sock as any).authState?.creds?.me?.id as string | undefined);
        const selfLidJid = ((sock as any).authState?.creds?.me?.lid as string | undefined) || undefined;
        const normalizedSelfJid = preferPhoneNumberJid(selfJid, selfLidJid) || selfJid || selfLidJid;
        const selfNumber = normalizedSelfJid ? jidToNumber(normalizedSelfJid) : undefined;
        if (!fromMe && !isGroup && selfNumber && remoteNumber === selfNumber) {
          logger.info(`Skipping mirrored self-message for ${remoteJid}`);
          continue;
        }

        // Derive chat display name (prefer group subject or push name)
        let chatDisplayName = sanitizedPushName || remoteNumber;
        if (isGroup) {
          try {
            const subject = await getGroupSubject(sock, remoteJid);
            if (subject) {
              chatDisplayName = subject;
            }
          } catch (err) {
            logger.warn({ err }, `Failed to load group metadata for ${remoteJid}`);
          }
        }

        let chatContact = await CreateOrUpdateContactService({
          name: chatDisplayName,
          number: remoteNumber,
          profilePicUrl: undefined,
          isGroup,
          extraInfo: pushNameExtraInfo
        } as any);

        if (!chatContact.profilePicUrl) {
          try {
            const fetchedChatProfilePicUrl = await (sock as any).profilePictureUrl(remoteJid, "image");
            if (fetchedChatProfilePicUrl) {
              chatContact = await CreateOrUpdateContactService({
                name: chatDisplayName,
                number: remoteNumber,
                profilePicUrl: fetchedChatProfilePicUrl,
                isGroup,
                extraInfo: pushNameExtraInfo
              } as any);
            }
          } catch (err) {
            logger.warn({ err }, `Failed to load profile picture for ${remoteJid}`);
          }
        }

        let participantContact = chatContact;
        if (isGroup && participant) {
          const participantAlt = (m.key as any).participantAlt as string | undefined;
          const participantContactJid = preferPhoneNumberJid(participant, participantAlt) || participant;
          const participantNumber = jidToNumber(participantContactJid);
          const participantName = sanitizedPushName || participantNumber;
          const participantExtraInfo =
            rawPushName && rawPushName.trim()
              ? [{ name: "waPushName", value: rawPushName.trim() }]
              : [];

          participantContact = await CreateOrUpdateContactService({
            name: participantName,
            number: participantNumber,
            profilePicUrl: undefined,
            isGroup: false,
            extraInfo: participantExtraInfo
          } as any);

          if (!participantContact.profilePicUrl) {
            try {
              const fetchedParticipantProfilePicUrl = await (sock as any).profilePictureUrl(participant, "image");
              if (fetchedParticipantProfilePicUrl) {
                participantContact = await CreateOrUpdateContactService({
                  name: participantName,
                  number: participantNumber,
                  profilePicUrl: fetchedParticipantProfilePicUrl,
                  isGroup: false,
                  extraInfo: participantExtraInfo
                } as any);
              }
            } catch (err) {
              logger.warn({ err }, `Failed to load participant profile picture for ${participant}`);
            }
          }
        }

        // Find or create ticket with fromMe guard
        let ticket: Ticket | null = null;
        if (fromMe) {
          ticket = await Ticket.findOne({
            where: {
              status: { [Op.or]: ["open", "pending"] },
              contactId: chatContact.id,
              whatsappId: whatsapp.id
            },
            order: [["updatedAt", "DESC"]]
          });
          if (!ticket) {
            continue; // do not create a ticket from our own message
          }
        } else {
          const unread = 1;
          ticket = await FindOrCreateTicketService(
            participantContact,
            whatsapp.id,
            unread,
            isGroup ? chatContact : undefined
          );
        }

        // Ensure ticket is non-null for TypeScript safety
        if (!ticket) {
          continue;
        }

        if (isGroup) {
          const updates: Record<string, unknown> = {};
          if (!ticket.isGroup) {
            updates.isGroup = true;
          }
          if (ticket.contactId !== chatContact.id) {
            updates.contactId = chatContact.id;
          }
          if (Object.keys(updates).length > 0) {
            await ticket.update(updates);
            await ticket.reload();
          }
        }

        const ticketId = ticket.id;

        // Determine message content
        const text = getMsgText(m) || "";
        const hasText = text.trim().length > 0;
        const mediaInfo = await saveMediaToDisk(sock, m);
        if (!mediaInfo && !hasText) {
          // ignore empty stubs
          continue;
        }

        let body = hasText ? text : "";
        if (!hasText && mediaInfo) {
          body = mediaInfo.displayName || mediaInfo.filename;
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
          contactId: fromMe ? undefined : participantContact.id,
          body,
          fromMe,
          read: fromMe,
          mediaUrl: mediaInfo ? mediaInfo.filename : undefined,
          mediaType: mediaInfo ? mediaInfo.mediaType : (hasText ? "chat" : undefined),
          quotedMsgId
        };

        await ticket.update({ lastMessage: messageData.body });
        await CreateMessageService({ messageData });
        const normalizedText = text.trim().toLowerCase();
        if (!fromMe && normalizedText === "#cek_antrian") {
          try {
            const pendingCount = await Ticket.count({
              where: {
                status: "pending",
                whatsappId: whatsapp.id
              }
            });
            const queueReply = `Saat ini terdapat ${pendingCount} antrian yang belum diproses.`;
            await (sock as any).sendMessage(remoteJid, { text: queueReply });
          } catch (countErr) {
            logger.error(`Baileys queue check error: ${countErr}`);
          }
        }

        // Auto-greeting/OOH only on first inbound message of a ticket (new), delayed by 10s
        try {
          const totalMsgs = await Message.count({ where: { ticketId } });
          const isFirstInbound = !fromMe && !isGroup && totalMsgs === 1;
          if (!isFirstInbound) {
            logger.info(`OOH: skip precheck (fromMe=${fromMe} isGroup=${isGroup} totalMsgs=${totalMsgs}) for ticket ${ticketId}`);
          }
          if (isFirstInbound) {
            const delay = Number(process.env.GREETING_DELAY_MS) || 10000;
            setTimeout(async () => {
              try {
                const detailedWhats = await ShowWhatsAppService(whatsapp.id);
                // Out-of-hours auto reply check
                const keys = [
                  "outOfHours",
                  "outOfHoursMessage",
                  "businessHoursStart",
                  "businessHoursEnd",
                  "businessDays",
                  "businessTzOffsetMin"
                ];
                const all = await Setting.findAll({ where: { key: { [Op.in]: keys } } });
                const get = (k: string) => (all.find(s => s.key === k)?.value || "");
                const enabled = get("outOfHours") === "enabled";
                const message = get("outOfHoursMessage");
                const start = get("businessHoursStart") || "08:00";
                const end = get("businessHoursEnd") || "17:00";
                const days = (get("businessDays") || "1,2,3,4,5").split(",").map(x => parseInt(x.trim(), 10));
                const tzOffsetMin = parseInt(get("businessTzOffsetMin") || "0", 10);
                const normalizedTzOffset = isNaN(tzOffsetMin) ? 0 : tzOffsetMin;
                const serverOffsetMin = new Date().getTimezoneOffset();
                const totalOffsetMin = normalizedTzOffset + serverOffsetMin;
                const now = new Date(Date.now() + totalOffsetMin * 60000);
                const day = now.getDay();
                const [sh, sm] = start.split(":").map(Number);
                const [eh, em] = end.split(":").map(Number);
                const mins = now.getHours() * 60 + now.getMinutes();
                const sMin = sh * 60 + sm;
                const eMin = eh * 60 + em;
                const inBusiness = days.includes(day) && mins >= sMin && mins <= eMin;

                logger.info(`OOH check: enabled=${enabled} tzOffsetMin=${tzOffsetMin} start=${start} end=${end} days=${days.join(',')} nowLocal=${now.toISOString()} inBusiness=${inBusiness}`);

                const hasQueues = detailedWhats.queues && detailedWhats.queues.length >= 1;

                let assignedQueue = undefined;

                if (hasQueues && detailedWhats.queues.length === 1) {
                  const singleQueue = detailedWhats.queues[0];
                  await UpdateTicketService({ ticketData: { queueId: singleQueue.id }, ticketId });
                  assignedQueue = singleQueue;
                }

                if (enabled && message && !inBusiness) {
                  logger.info(`OOH triggered on ticket ${ticketId} for ${remoteJid}`);
                  await (sock as any).sendMessage(remoteJid, { text: message });
                  return; // do not send queue greeting if OOH triggered
                }
                if (enabled && !message && !inBusiness) {
                  logger.warn(`OOH enabled but message empty; skipping auto-reply for ${remoteJid}`);
                }

                if (hasQueues) {
                  if (detailedWhats.queues.length === 1) {
                    const greetingSource = assignedQueue || detailedWhats.queues[0];
                    if (greetingSource.greetingMessage) {
                      const bodyText = formatBody(`\u200e${greetingSource.greetingMessage}`, chatContact as any);
                      await (sock as any).sendMessage(remoteJid, { text: bodyText });
                    }
                  } else {
                    let options = "";
                    detailedWhats.queues.forEach((q, idx) => {
                      options += `*${idx + 1}* - ${q.name}\n`;
                    });
                    const gm = detailedWhats.greetingMessage || "";
                    const bodyText = formatBody(`\u200e${gm}\n${options}`, chatContact as any);
                    await (sock as any).sendMessage(remoteJid, { text: bodyText });
                  }
                } else if (detailedWhats.greetingMessage) {
                  // Fallback: send WhatsApp-level greeting when no queues configured
                  const bodyText = formatBody(`\u200e${detailedWhats.greetingMessage}`, chatContact as any);
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
  sock.ev.on("groups.update", async (updates: any[]) => {
    const now = Date.now();
    for (const update of updates) {
      const id = update?.id as string | undefined;
      if (!id) continue;
      if (typeof update.subject !== "undefined") {
        groupMetadataCache.set(id, { subject: update.subject, expiresAt: now + GROUP_METADATA_TTL_MS });
        try {
          await CreateOrUpdateContactService({
            name: update.subject,
            number: jidToNumber(id),
            profilePicUrl: undefined,
            isGroup: true
          } as any);
        } catch (err) {
          logger.warn({ err }, `Failed to sync group contact name for ${id}`);
        }
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
        if (!messageToUpdate.fromMe) continue;
        
        let ack = messageToUpdate.ack;
        const t: string | undefined = u.update?.type || u.type;
        
        if (t === "delivery") ack = Math.max(ack, 2);
        if (t === "read") ack = Math.max(ack, 3);
        if (t === "played") ack = Math.max(ack, 4);
        
        // Also update the read field for consistency
        const read = ack >= 3;
        
        await messageToUpdate.update({ ack, read });
        io.to(messageToUpdate.ticketId.toString()).emit("appMessage", { 
          action: "update", 
          message: messageToUpdate 
        });
        
      } catch (err) {
        logger.error(`Baileys ack update error: ${err}`);
      }
    }
  });

  // Update ack via generic message status updates
  sock.ev.on("messages.update", async (updates: any[]) => {
    const io = getIO();
    for (const u of updates) {
      try {
        const id: string | undefined = u.key?.id;
        const status: number | undefined = (u.update as any)?.status;
        if (!id || status === undefined) continue;
        const messageToUpdate = await Message.findByPk(id, {
          include: [
            "contact",
            { model: Message, as: "quotedMsg", include: ["contact"] }
          ]
        });
        if (!messageToUpdate) continue;
        if (!messageToUpdate.fromMe) continue;

        const capped = Math.min(status, 2);
        const nextAck = Math.max(messageToUpdate.ack, capped);
        if (nextAck !== messageToUpdate.ack) {
          await messageToUpdate.update({ ack: nextAck });
          io.to(messageToUpdate.ticketId.toString()).emit("appMessage", {
            action: "update",
            message: messageToUpdate
          });
        }
      } catch (err) {
        logger.error(`Baileys messages.update ack error: ${err}`);
      }
    }
  });
};

export default wireBaileysMessageListeners;
