import { Router, type IRouter } from "express";
import healthRouter from "./health.js";
import authRouter from "./auth.js";
import registrationRouter from "./registration.js";
import accountsRouter from "./accounts.js";
import logsRouter from "./logs.js";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(registrationRouter);
router.use(accountsRouter);
router.use(logsRouter);

export default router;
