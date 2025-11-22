import { getWbot } from "../../libs/wbot";
import Message from "../../models/Message";
import Ticket from "../../models/Ticket";
import { logger } from "../../utils/logger";

export const SendReadReceiptService = async (ticketId: number): Promise<void> => {
  try {
    const ticket = await Ticket.findByPk(ticketId, {
      include: ["whatsapp", "contact"]
    });
    
    if (!ticket || !ticket.whatsapp || !ticket.contact) {
      return;
    }

    // Get unread messages from this contact
    const unreadMessages = await Message.findAll({
      where: {
        ticketId,
        fromMe: false,
        read: false
      },
      order: [["createdAt", "DESC"]],
      limit: 50
    });

    if (unreadMessages.length === 0) {
      return;
    }

    const wbot = getWbot(ticket.whatsapp.id);
    const jid = `${ticket.contact.number}@${ticket.isGroup ? "g.us" : "s.whatsapp.net"}`;

    // Send read receipts for unread messages
    for (const message of unreadMessages) {
      try {
        await wbot.readMessages([{ 
          remoteJid: jid, 
          id: message.id,
          fromMe: false,
          participant: ticket.isGroup ? `${ticket.contact.number}@s.whatsapp.net` : undefined
        }]);
        
        // Mark as read in database
        await message.update({ read: true });
      } catch (err) {
        logger.error(`Failed to send read receipt for message ${message.id}: ${err}`);
      }
    }

    logger.info(`Sent read receipts for ${unreadMessages.length} messages in ticket ${ticketId}`);
  } catch (err) {
    logger.error(`SendReadReceiptService error: ${err}`);
    throw err;
  }
};
