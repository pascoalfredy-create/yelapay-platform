import { Router, type IRouter } from "express";
import healthRouter from "./health";
import usersRouter from "./users";
import walletsRouter from "./wallets";
import transactionsRouter from "./transactions";
import routesTransportRouter from "./routes-transport";
import vehiclesRouter from "./vehicles";
import tripsRouter from "./trips";
import statsRouter from "./stats";

const router: IRouter = Router();

router.use(healthRouter);
router.use(usersRouter);
router.use(walletsRouter);
router.use(transactionsRouter);
router.use(routesTransportRouter);
router.use(vehiclesRouter);
router.use(tripsRouter);
router.use(statsRouter);

export default router;
