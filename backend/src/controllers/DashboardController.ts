import { Request, Response } from "express";
import GetDashboardMetricsService from "../services/DashboardServices/GetDashboardMetricsService";

export const metrics = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { operators } = await GetDashboardMetricsService();
    return res.status(200).json({ operators });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to fetch dashboard metrics" });
  }
};
