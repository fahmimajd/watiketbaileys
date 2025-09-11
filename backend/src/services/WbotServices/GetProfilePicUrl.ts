import GetDefaultWhatsApp from "../../helpers/GetDefaultWhatsApp";
import { getWbot } from "../../libs/wbot";

const GetProfilePicUrl = async (number: string): Promise<string> => {
  const defaultWhatsapp = await GetDefaultWhatsApp();

  const wbot = getWbot(defaultWhatsapp.id);

  const jid = `${number}@s.whatsapp.net`;
  let profilePicUrl = "" as any;
  try {
    profilePicUrl = await (wbot as any).profilePictureUrl(jid, "image");
  } catch (e) {
    profilePicUrl = "";
  }

  return profilePicUrl;
};

export default GetProfilePicUrl;
