import v1Router from "./v1/v1Routes.js";

const apiRouter = async (app) => {
  app.register(v1Router, { prefix: "/v1" });
};

export default apiRouter;
