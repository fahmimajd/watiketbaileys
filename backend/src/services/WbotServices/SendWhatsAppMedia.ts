import fs from "fs";
import AppError from "../../errors/AppError";
import GetTicketWbot from "../../helpers/GetTicketWbot";
import Ticket from "../../models/Ticket";

import formatBody from "../../helpers/Mustache";

interface Request {
  media: Express.Multer.File;
  ticket: Ticket;
  body?: string;
}

const SendWhatsAppMedia = async ({
  media,
  ticket,
  body
}: Request): Promise<any> => {
  try {
    const wbot = await GetTicketWbot(ticket);
    const hasBody = body ? formatBody(body as string, ticket.contact) : undefined;
    const jid = `${ticket.contact.number}@${ticket.isGroup ? "g.us" : "s.whatsapp.net"}`;

    const data = fs.readFileSync(media.path);
    const mimetype = media.mimetype;
    const filename = media.originalname || media.filename;

    let content: any = {};
    if (mimetype.startsWith("image/")) {
      content = { image: data, caption: hasBody };
    } else if (mimetype.startsWith("video/")) {
      content = { video: data, caption: hasBody };
    } else if (mimetype.startsWith("audio/")) {
      content = { audio: data, mimetype, ptt: true };
    } else {
      content = { document: data, mimetype, fileName: filename, caption: hasBody };
    }

    const sentMessage = await (wbot as any).sendMessage(jid, content);

    await ticket.update({ lastMessage: body || media.filename });

    fs.unlinkSync(media.path);

    return sentMessage as any;
  } catch (err) {
    console.log(err);
    throw new AppError("ERR_SENDING_WAPP_MSG");
  }
};

export default SendWhatsAppMedia;
