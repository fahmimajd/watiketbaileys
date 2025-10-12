import AppError from "../../errors/AppError";
import CheckContactOpenTickets from "../../helpers/CheckContactOpenTickets";
import GetDefaultWhatsApp from "../../helpers/GetDefaultWhatsApp";
import Ticket from "../../models/Ticket";
import User from "../../models/User";
import ShowContactService from "../ContactServices/ShowContactService";

const TICKET_REOPEN_WINDOW_MS = Number(process.env.TICKET_REOPEN_WINDOW_MS || 60 * 60 * 1000);

interface Request {
  contactId: number;
  status: string;
  userId: number;
  queueId ?: number;
}

const CreateTicketService = async ({
  contactId,
  status,
  userId,
  queueId
}: Request): Promise<Ticket> => {
  const defaultWhatsapp = await GetDefaultWhatsApp(userId);

  await CheckContactOpenTickets(contactId, defaultWhatsapp.id);

  const { isGroup } = await ShowContactService(contactId);

  if(queueId === undefined) {
    const user = await User.findByPk(userId, { include: ["queues"]});
    queueId = user?.queues.length === 1 ? user.queues[0].id : undefined;
  }

  const lastTicket = await Ticket.findOne({
    where: { contactId, whatsappId: defaultWhatsapp.id },
    order: [["updatedAt", "DESC"]]
  });

  if (lastTicket && lastTicket.status === "closed") {
    const lastUpdateMs = lastTicket.updatedAt.getTime();
    const elapsedSinceClose = Date.now() - lastUpdateMs;

    if (elapsedSinceClose <= TICKET_REOPEN_WINDOW_MS) {
      await lastTicket.update({
        status,
        userId,
        queueId: queueId ?? lastTicket.queueId,
        isGroup,
        unreadMessages: 0
      });

      const reopened = await Ticket.findByPk(lastTicket.id, { include: ["contact"] });
      if (!reopened) {
        throw new AppError("ERR_CREATING_TICKET");
      }
      return reopened;
    }
  }

  const { id }: Ticket = await defaultWhatsapp.$create("ticket", {
    contactId,
    status,
    isGroup,
    userId,
    queueId
  });

  const ticket = await Ticket.findByPk(id, { include: ["contact"] });

  if (!ticket) {
    throw new AppError("ERR_CREATING_TICKET");
  }

  return ticket;
};

export default CreateTicketService;
