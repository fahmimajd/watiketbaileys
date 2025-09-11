import GetDefaultWhatsApp from "../../helpers/GetDefaultWhatsApp";
import { getWbot } from "../../libs/wbot";
import Contact from "../../models/Contact";
import { logger } from "../../utils/logger";

const ImportContactsService = async (userId:number): Promise<void> => {
  const defaultWhatsapp = await GetDefaultWhatsApp(userId);

  const wbot = getWbot(defaultWhatsapp.id);

  // Baileys doesn't expose a direct "getContacts" without an external store.
  // For now, no-op with warning.
  logger.warn("ImportContactsService is not supported with Baileys without a contacts store.");
};

export default ImportContactsService;
