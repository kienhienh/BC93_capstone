import { useState } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { Routes, Route } from "react-router-dom";
import { ServicePreviewProvider } from "./features/service-preview/wiring";
import { AuthenticationProvider } from "./features/authentication/wiring";
import { AdminRoute, LoginRoute, RegisterRoute } from "./features/authentication/public";
import { composeApplication, type ApplicationComposition } from "./app/composition";
import Home from "./pages/Home";
import Jobs from "./pages/Jobs";
import JobDetail from "./pages/JobDetail";
import Checkout from "./pages/Checkout";
import Header from "./components/Header";
import Footer from './components/Footer';
import Orders from './pages/Orders';
import PrivateRoute from "./components/PrivateRoute";
import Admin from "./pages/Admin";

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
        <AuthenticationProvider
          capability={composition.authentication}
          sessionStore={composition.sessionStore}
        >
          <a className="skip-link" href="#main-content">Skip to main content</a>
          <Header />

          <Routes>
            <Route path="/" element={<Home />} />
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

            <Route path="/login" element={<LoginRoute />} />
            <Route path="/register" element={<RegisterRoute />} />
            <Route
              path="/admin/*"
              element={
                <AdminRoute>
                  <Admin />
                </AdminRoute>
              }
            />
          </Routes>

          <Footer />
        </AuthenticationProvider>
      </ServicePreviewProvider>
    </QueryClientProvider>
  );
}

export default App;
