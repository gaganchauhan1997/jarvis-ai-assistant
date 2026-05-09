import { Router, type IRouter } from "express";
import healthRouter from "./health";
import dictationRouter from "./dictation";

const router: IRouter = Router();

router.use(healthRouter);
router.use(dictationRouter);

export default router;
