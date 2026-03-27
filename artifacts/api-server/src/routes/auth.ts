import { Router, type IRouter } from "express";

const router: IRouter = Router();

const ADMIN_PASSWORD = "wbf";

router.post("/auth/verify", (req, res) => {
  const { password } = req.body;
  if (password === ADMIN_PASSWORD) {
    res.json({ success: true, message: "Authentication successful" });
  } else {
    res.json({ success: false, message: "Invalid password" });
  }
});

export default router;
