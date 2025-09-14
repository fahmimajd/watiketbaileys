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
      let fullQuoted = quotedMsg;
      if (!(fullQuoted as any).contact) {
        const found = await Message.findByPk(quotedMsg.id, { include: ["contact"] });
        if (found) fullQuoted = found as Message;
      }

      const participant = ticket.isGroup && !fullQuoted.fromMe && (fullQuoted as any).contact
        ? `${(fullQuoted as any).contact.number}@s.whatsapp.net`
        : undefined;

      const quotedContent = fullQuoted.mediaType && fullQuoted.mediaType !== "chat"
        ? { extendedTextMessage: { text: fullQuoted.body || "" } }
        : { conversation: fullQuoted.body || "" };

      quoted = {
        key: { remoteJid: jid, id: fullQuoted.id, fromMe: fullQuoted.fromMe, participant },
        message: quotedContent
      };
    }
    const sentMessage: any = await (wbot as any).sendMessage(jid, { text }, { linkPreview: false, quoted });

    await ticket.update({ lastMessage: body });
    return sentMessage as any;
  } catch (err) {
    throw new AppError("ERR_SENDING_WAPP_MSG");
  }
};

export default SendWhatsAppMessage;
