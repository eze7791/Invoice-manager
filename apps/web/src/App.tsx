import { BrowserRouter, Navigate, Route, Routes } from "react-router";
import { AppLayout } from "@/components/app-layout";
import { LoginPage } from "@/routes/login";
import { ClientsPage } from "@/routes/clients";
import { InvoicesPage } from "@/routes/placeholders";
import { ProfilePage } from "@/routes/profile";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<AppLayout />}>
          <Route index element={<InvoicesPage />} />
          <Route path="clientes" element={<ClientsPage />} />
          <Route path="perfil" element={<ProfilePage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
