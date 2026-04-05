import { Op, fn, col } from "sequelize";
import Ticket from "../../models/Ticket";
import User from "../../models/User";
import Message from "../../models/Message";

interface OperatorMetric {
  id: number;
  name: string;
  email: string;
  profile: string;
  openTickets: number;
  pendingTickets: number;
  closedTickets: number;
  totalTickets: number;
  lastActive: Date | null;
  lastMessageAt: Date | null;
}

const GetDashboardMetricsService = async (): Promise<{
  operators: OperatorMetric[];
}> => {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const endOfToday = new Date();
  endOfToday.setHours(23, 59, 59, 999);

  const users = await User.findAll({
    attributes: ["id", "name", "email", "profile"],
    order: [["name", "ASC"]]
  });

  const operators: OperatorMetric[] = [];

  for (const user of users) {
    const [openCount, pendingCount, closedCount] = await Promise.all([
      Ticket.count({ where: { userId: user.id, status: "open", updatedAt: { [Op.between]: [startOfToday, endOfToday] } } }),
      Ticket.count({ where: { userId: user.id, status: "pending", updatedAt: { [Op.between]: [startOfToday, endOfToday] } } }),
      Ticket.count({ where: { userId: user.id, status: "closed", updatedAt: { [Op.between]: [startOfToday, endOfToday] } } })
    ]);

    const lastActiveTicket = await Ticket.findOne({
      where: { userId: user.id, updatedAt: { [Op.between]: [startOfToday, endOfToday] } },
      attributes: [[fn("MAX", col("updatedAt")), "lastActive"]],
      raw: true
    }) as unknown as Record<string, unknown> | null;

    const ticketsForUser = await Ticket.findAll({
      where: { userId: user.id, updatedAt: { [Op.between]: [startOfToday, endOfToday] } },
      attributes: ["id"]
    });

    const ticketIds = ticketsForUser.map(t => t.id);

    let lastMessageAt: Date | null = null;
    if (ticketIds.length > 0) {
      const lastMsg = await Message.findOne({
        where: {
          ticketId: { [Op.in]: ticketIds },
          fromMe: true
        },
        attributes: [[fn("MAX", col("createdAt")), "lastMessageAt"]],
        raw: true
      }) as unknown as Record<string, unknown> | null;

      if (lastMsg?.lastMessageAt) {
        lastMessageAt = new Date(lastMsg.lastMessageAt as string);
      }
    }

    operators.push({
      id: user.id,
      name: user.name,
      email: user.email,
      profile: user.profile,
      openTickets: openCount,
      pendingTickets: pendingCount,
      closedTickets: closedCount,
      totalTickets: openCount + pendingCount + closedCount,
      lastActive: lastActiveTicket?.lastActive
        ? new Date(lastActiveTicket.lastActive as string)
        : null,
      lastMessageAt
    });
  }

  return { operators };
};

export default GetDashboardMetricsService;
