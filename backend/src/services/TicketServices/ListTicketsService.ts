import { Op, fn, where, col, Filterable, Includeable } from "sequelize";
import { startOfDay, endOfDay, parseISO } from "date-fns";

import Ticket from "../../models/Ticket";
import Contact from "../../models/Contact";
import Message from "../../models/Message";
import Queue from "../../models/Queue";
import ShowUserService from "../UserServices/ShowUserService";
import Whatsapp from "../../models/Whatsapp";

interface Request {
  searchParam?: string;
  pageNumber?: string;
  status?: string;
  date?: string;
  showAll?: string;
  userId: string;
  withUnreadMessages?: string;
  queueIds: number[];
}

interface Response {
  tickets: Ticket[];
  count: number;
  hasMore: boolean;
}

const ListTicketsService = async ({
  searchParam = "",
  pageNumber = "1",
  queueIds,
  status,
  date,
  showAll,
  userId,
  withUnreadMessages
}: Request): Promise<Response> => {
  const hasQueueFilter = Array.isArray(queueIds) && queueIds.length > 0;
  const queueCondition = hasQueueFilter
    ? { [Op.or]: [queueIds, null] }
    : undefined;

  let whereCondition: Filterable["where"] =
    showAll === "true"
      ? {}
      : {
          [Op.or]: [{ userId }, { status: "pending" }]
        };

  if (queueCondition) {
    whereCondition = {
      ...whereCondition,
      queueId: queueCondition
    };
  }
  let includeCondition: Includeable[];

  includeCondition = [
    {
      model: Contact,
      as: "contact",
      attributes: ["id", "name", "number", "profilePicUrl", "isGroup"]
    },
    {
      model: Queue,
      as: "queue",
      attributes: ["id", "name", "color"]
    },
    {
      model: Whatsapp,
      as: "whatsapp",
      attributes: ["name"]
    }
  ];

  if (status) {
    whereCondition = {
      ...whereCondition,
      status
    };
  }

  if (searchParam) {
    const trimmedSearch = searchParam.trim();
    const sanitizedLower = trimmedSearch.toLocaleLowerCase();
    const numericSearch = trimmedSearch.replace(/[^0-9]/g, "");

    const messageFilter = sanitizedLower
      ? where(fn("LOWER", col("messages.body")), "LIKE", `%${sanitizedLower}%`)
      : undefined;

    includeCondition = [
      ...includeCondition,
      {
        model: Message,
        as: "messages",
        attributes: ["id", "body"],
        ...(messageFilter ? { where: { body: messageFilter } } : {}),
        required: false,
        duplicating: false
      }
    ];

    const searchConditions: any[] = [];

    if (sanitizedLower) {
      searchConditions.push({
        "$contact.name$": where(
          fn("LOWER", col("contact.name")),
          "LIKE",
          `%${sanitizedLower}%`
        )
      });

      searchConditions.push({
        "$messages.body$": where(
          fn("LOWER", col("messages.body")),
          "LIKE",
          `%${sanitizedLower}%`
        )
      });
    }

    if (numericSearch) {
      searchConditions.push({
        "$contact.number$": { [Op.like]: `%${numericSearch}%` }
      });
    }

    if (searchConditions.length) {
      const baseWhere = whereCondition;
      const hasBaseWhere =
        baseWhere &&
        (Object.keys(baseWhere).length > 0 ||
          Object.getOwnPropertySymbols(baseWhere).length > 0);

      const combinedSearch = { [Op.or]: searchConditions };

      whereCondition = hasBaseWhere
        ? { [Op.and]: [baseWhere, combinedSearch] }
        : combinedSearch;
    }
  }

  if (date) {
    whereCondition = {
      createdAt: {
        [Op.between]: [+startOfDay(parseISO(date)), +endOfDay(parseISO(date))]
      }
    };
  }

  if (withUnreadMessages === "true") {
    const user = await ShowUserService(userId);
    const userQueueIds = user.queues.map(queue => queue.id);
    const userQueueCondition = userQueueIds.length
      ? { [Op.or]: [userQueueIds, null] }
      : undefined;

    whereCondition = {
      [Op.or]: [{ userId }, { status: "pending" }],
      unreadMessages: { [Op.gt]: 0 }
    };

    if (userQueueCondition) {
      whereCondition.queueId = userQueueCondition;
    }
  }

  const limit = 40;
  const offset = limit * (+pageNumber - 1);

  const { count, rows: tickets } = await Ticket.findAndCountAll({
    where: whereCondition,
    include: includeCondition,
    distinct: true,
    limit,
    offset,
    order: [["updatedAt", "DESC"]]
  });

  const hasMore = count > offset + tickets.length;

  return {
    tickets,
    count,
    hasMore
  };
};

export default ListTicketsService;
