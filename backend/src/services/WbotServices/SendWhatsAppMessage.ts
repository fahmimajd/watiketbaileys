import AppError from "../../errors/AppError";
import GetTicketWbot from "../../helpers/GetTicketWbot";
import Message from "../../models/Message";
import Ticket from "../../models/Ticket";

import formatBody from "../../helpers/Mustache";

interface Request {
  body: string;
  ticket: Ticket;
  quotedMsg?: Message;
}

const SendWhatsAppMessage = async ({
  body,
  ticket,
  quotedMsg
}: Request): Promise<any> => {

  const wbot = await GetTicketWbot(ticket);

  try {
    const jid = `${ticket.contact.number}@${ticket.isGroup ? "g.us" : "s.whatsapp.net"}`;

    const text = formatBody(body, ticket.contact);
    let quoted: any = undefined;
    if (quotedMsg) {
      quoted = { key: { remoteJid: jid, id: quotedMsg.id, fromMe: quotedMsg.fromMe } };
    }
    const sentMessage: any = await (wbot as any).sendMessage(jid, { text }, { linkPreview: false, quoted });

    await ticket.update({ lastMessage: body });
    return sentMessage as any;
  } catch (err) {
    throw new AppError("ERR_SENDING_WAPP_MSG");
  }
};

export default SendWhatsAppMessage;
