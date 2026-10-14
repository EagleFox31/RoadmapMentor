import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { queryClient } from "./lib/queryClient";
import { AppUpdateBanner, startAppBuildWatcher } from "./lib/appBuild";

startAppBuildWatcher(() => queryClient.isMutating());

createRoot(document.getElementById("root")!).render(
  <>
    <App />
    <AppUpdateBanner />
  </>,
);
