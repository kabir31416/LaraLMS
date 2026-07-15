import { BrowserRouter } from "react-router-dom";
import { AppProviders } from "@/components/AppProviders";
import { AppRoutes } from "./routes";

const App = () => (
  <AppProviders>
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  </AppProviders>
);

export default App;
