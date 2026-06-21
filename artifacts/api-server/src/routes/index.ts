import { Router, type IRouter } from "express";
import healthRouter from "./health";
import votersRouter from "./voters";
import adminRouter from "./admin";
import uploadsRouter from "./uploads";

const router: IRouter = Router();

router.use(healthRouter);
router.use(votersRouter);
router.use(adminRouter);
router.use(uploadsRouter);

export default router;
