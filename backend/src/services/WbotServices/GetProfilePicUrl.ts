import GetDefaultWhatsApp from "../../helpers/GetDefaultWhatsApp";
import { getWbot } from "../../libs/wbot";
import { logger } from "../../utils/logger";

const isNotFoundError = (err: any): boolean => {
  const statusCode = err?.output?.statusCode ?? err?.data;
  return Number(statusCode) === 404;
};

const GetProfilePicUrl = async (number: string): Promise<string> => {
  try {
    const defaultWhatsapp = await GetDefaultWhatsApp();
    const wbot = getWbot(defaultWhatsapp.id);
    const jid = `${number}@s.whatsapp.net`;

    const profilePicUrl = await (wbot as any).profilePictureUrl(jid, "image");
    return profilePicUrl || "";
  } catch (err) {
    if (isNotFoundError(err)) {
      logger.debug({ number }, "No WhatsApp profile picture found");
      return "";
    }

    if (err instanceof Error) {
      logger.warn({ err, number }, "Failed to fetch WhatsApp profile picture");
    } else {
      logger.warn({ err, number }, "Failed to fetch WhatsApp profile picture (unknown error)");
    }

    return "";
  }
};

export default GetProfilePicUrl;
