import { useState } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { Routes, Route } from "react-router-dom";
import { HomeRoute } from "./features/service-preview/public";
import { ServicePreviewProvider } from "./features/service-preview/wiring";
import { composeApplication, type ApplicationComposition } from "./app/composition";
import Jobs from "./pages/Jobs";
import JobDetail from "./pages/JobDetail";
import Checkout from "./pages/Checkout";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Header from "./components/Header";
import Footer from './components/Footer';
import Orders from './pages/Orders';
import PrivateRoute from "./components/PrivateRoute";

function ConfigurationError({ message }: { message: string }) {
  return (
    <main className="configuration-error">
      <h1>Application unavailable</h1>
      <p role="alert">{message}</p>
    </main>
  );
}

function App({ composition: suppliedComposition }: { composition?: ApplicationComposition }) {
  const [composition] = useState(
    () =>
      suppliedComposition ??
      composeApplication({
        mode: import.meta.env.MODE === "test" ? "test" : "production",
        environment: import.meta.env,
      }),
  );

  if (!composition.ok) {
    return <ConfigurationError message={composition.message} />;
  }

  return (
    <QueryClientProvider client={composition.queryClient}>
      <ServicePreviewProvider capability={composition.servicePreview}>
        <Header />

        <Routes>
          <Route path="/" element={<HomeRoute />} />
          <Route path="/jobs" element={<Jobs />} />
          <Route path="/jobdetail/:id" element={<JobDetail />} />
          <Route path="/services/:id" element={<JobDetail />} />

          <Route
            path="/checkout/:id"
            element={
              <PrivateRoute>
                <Checkout />
              </PrivateRoute>
            }
          />
          <Route
            path="/orders"
            element={
              <PrivateRoute>
                <Orders />
              </PrivateRoute>
            }
          />

          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
        </Routes>

        <Footer />
      </ServicePreviewProvider>
    </QueryClientProvider>
  );
}

export default App;
