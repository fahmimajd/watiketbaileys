import { Router } from "express";
import isAuth from "../middleware/isAuth";
import * as DashboardController from "../controllers/DashboardController";

const dashboardRoutes = Router();

dashboardRoutes.get("/dashboard/metrics", isAuth, DashboardController.metrics);

export default dashboardRoutes;
