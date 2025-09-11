import GetDefaultWhatsApp from "../../helpers/GetDefaultWhatsApp";
import { getWbot } from "../../libs/wbot";

const CheckContactNumber = async (number: string): Promise<string> => {
  const defaultWhatsapp = await GetDefaultWhatsApp();

  const wbot = getWbot(defaultWhatsapp.id);

    const jid = `${number}@s.whatsapp.net`;
    const result = await (wbot as any).onWhatsApp(jid);
    if (Array.isArray(result) && result[0]?.jid) {
      return (result[0].jid as string).split("@")[0];
    }
    return number;
};

export default CheckContactNumber;
