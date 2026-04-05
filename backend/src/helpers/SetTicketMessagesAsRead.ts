import { getIO } from "../libs/socket";
import Message from "../models/Message";
import Ticket from "../models/Ticket";
import { logger } from "../utils/logger";
import GetTicketWbot from "./GetTicketWbot";
import { randomDelay } from "./antiBan";

const SetTicketMessagesAsRead = async (ticket: Ticket): Promise<void> => {
  await Message.update(
    { read: true },
    {
      where: {
        ticketId: ticket.id,
        read: false
      }
    }
  );

  await ticket.update({ unreadMessages: 0 });

  try {
    const wbot: any = await GetTicketWbot(ticket);
    const isGroupChat = ticket.isGroup || ticket.contact?.isGroup;
    const contactNumber = ticket.contact.number;
    const jid = contactNumber.includes("@")
      ? contactNumber
      : `${contactNumber}@${isGroupChat ? "g.us" : "s.whatsapp.net"}`;
    const pending = await Message.findAll({ where: { ticketId: ticket.id, read: false, fromMe: false }, order: [["createdAt", "DESC"]], limit: 10 });
    const ids = pending.map(m => m.id);
    if (ids.length) {
      await randomDelay(
        Number(process.env.ANTI_BAN_READ_RECEIPT_MIN_MS ?? 2000),
        Number(process.env.ANTI_BAN_READ_RECEIPT_MAX_MS ?? 8000)
      );
      await wbot.sendReadReceipt(jid, undefined, ids);
    }
  } catch (err) {
    logger.warn(
      `Could not mark messages as read. Maybe whatsapp session disconnected? Err: ${err}`
    );
  }

  const io = getIO();
  io.to(ticket.status).to("notification").emit("ticket", {
    action: "updateUnread",
    ticketId: ticket.id
  });
};

export default SetTicketMessagesAsRead;
