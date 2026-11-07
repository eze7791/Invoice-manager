import { BrowserRouter, Navigate, Route, Routes } from "react-router";
import { AppLayout } from "@/components/app-layout";
import { LoginPage } from "@/routes/login";
import { ResetPasswordPage } from "@/routes/reset-password";
import { ClientsPage } from "@/routes/clients";
import { DashboardPage } from "@/routes/dashboard";
import { InvoiceDetailPage } from "@/routes/invoice-detail";
import { InvoiceEditorPage } from "@/routes/invoice-editor";
import { InvoicesPage } from "@/routes/invoices";
import { ProfilePage } from "@/routes/profile";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/restablecer" element={<ResetPasswordPage />} />
        <Route element={<AppLayout />}>
          <Route index element={<DashboardPage />} />
          <Route path="facturas" element={<InvoicesPage />} />
          <Route path="facturas/nueva" element={<InvoiceEditorPage />} />
          <Route path="facturas/:id" element={<InvoiceDetailPage />} />
          <Route path="facturas/:id/editar" element={<InvoiceEditorPage />} />
          <Route path="clientes" element={<ClientsPage />} />
          <Route path="perfil" element={<ProfilePage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
