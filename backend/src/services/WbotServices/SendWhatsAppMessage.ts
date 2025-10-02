import AppError from "../../errors/AppError";
import GetTicketWbot from "../../helpers/GetTicketWbot";
import Message from "../../models/Message";
import Ticket from "../../models/Ticket";

import formatBody from "../../helpers/Mustache";
import { buildJidFromNumber } from "../../helpers/Jid";

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
    const isGroupChat = ticket.isGroup || ticket.contact?.isGroup;
    const contactNumber = ticket.contact.number;
    const jid = buildJidFromNumber(contactNumber, !!isGroupChat);

    const text = formatBody(body, ticket.contact);
    let quoted: any = undefined;
    if (quotedMsg) {
      let fullQuoted = quotedMsg;
      if (!(fullQuoted as any).contact) {
        const found = await Message.findByPk(quotedMsg.id, { include: ["contact"] });
        if (found) fullQuoted = found as Message;
      }

      const participantContact = (fullQuoted as any).contact;
      const participant = isGroupChat && !fullQuoted.fromMe && participantContact && !participantContact.isGroup
        ? buildJidFromNumber(participantContact.number, false)
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
