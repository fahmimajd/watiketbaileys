import { Op } from "sequelize";
import Contact from "../../models/Contact";
import Ticket from "../../models/Ticket";
import ShowTicketService from "./ShowTicketService";

const TICKET_REOPEN_WINDOW_MS = Number(process.env.TICKET_REOPEN_WINDOW_MS || 60 * 60 * 1000);

const FindOrCreateTicketService = async (
  contact: Contact,
  whatsappId: number,
  unreadMessages: number,
  groupContact?: Contact
): Promise<Ticket> => {
  const targetContactId = groupContact ? groupContact.id : contact.id;

  let ticket = await Ticket.findOne({
    where: {
      status: {
        [Op.or]: ["open", "pending"]
      },
      contactId: targetContactId,
      whatsappId: whatsappId
    }
  });

  if (ticket) {
    await ticket.update({ unreadMessages });
  }

  if (!ticket) {
    const lastTicket = await Ticket.findOne({
      where: {
        contactId: targetContactId,
        whatsappId
      },
      order: [["updatedAt", "DESC"]]
    });

    if (lastTicket) {
      const withinReopenWindow =
        lastTicket.status !== "closed" ||
        Date.now() - lastTicket.updatedAt.getTime() <= TICKET_REOPEN_WINDOW_MS;

      if (withinReopenWindow) {
        await lastTicket.update({
          status: "pending",
          unreadMessages,
          isGroup: !!groupContact,
          userId: null
        });
        ticket = lastTicket;
      }
    }

    if (!ticket) {
      ticket = await Ticket.create({
        contactId: targetContactId,
        status: "pending",
        isGroup: !!groupContact,
        unreadMessages,
        whatsappId
      });
    }
  }

  ticket = await ShowTicketService(ticket.id);

  return ticket;
};

export default FindOrCreateTicketService;
