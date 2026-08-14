import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from '../auth/AuthContext'
import { ProtectedRoute } from '../auth/ProtectedRoute'
import { AppLayout } from '../layouts/AppLayout'
import { LoginPage } from '../pages/LoginPage'
import { HomePage } from '../pages/HomePage'
import { NotFoundPage } from '../pages/NotFoundPage'
import { DashboardPage } from '../features/dashboard/DashboardPage'
import { CatalogLayout } from '../features/catalog/CatalogLayout'
import { ProductsPage } from '../features/catalog/ProductsPage'
import { BrandsPage } from '../features/catalog/BrandsPage'
import { CategoriesPage } from '../features/catalog/CategoriesPage'
import { SuppliersPage } from '../features/suppliers/SuppliersPage'
import { InventoryLayout } from '../features/inventory/InventoryLayout'
import { InventoryPage } from '../features/inventory/InventoryPage'
import { MovementsPage } from '../features/inventory/MovementsPage'
import { ProductStockPage } from '../features/inventory/ProductStockPage'
import { CustomersPage } from '../features/customers/CustomersPage'
import { PurchasesPage } from '../features/purchases/PurchasesPage'
import { NewPurchasePage } from '../features/purchases/NewPurchasePage'
import { PurchaseDetailPage } from '../features/purchases/PurchaseDetailPage'
import { SalesPage } from '../features/sales/SalesPage'
import { NewSalePage } from '../features/sales/NewSalePage'
import { SaleDetailPage } from '../features/sales/SaleDetailPage'
import { AdministrationLayout } from '../features/administration/AdministrationLayout'
import { UsersPage } from '../features/administration/UsersPage'
import { RolesPage } from '../features/administration/RolesPage'
import { PermissionsPage } from '../features/administration/PermissionsPage'
import { ReportsLayout } from '../features/reports/ReportsLayout'
import { SalesReportPage } from '../features/reports/SalesReportPage'
import { PurchasesReportPage } from '../features/reports/PurchasesReportPage'

export function AppRouter() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <AppLayout>
                  <DashboardPage />
                </AppLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/_showcase"
            element={
              <ProtectedRoute>
                <AppLayout>
                  <HomePage />
                </AppLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/catalogo"
            element={
              <ProtectedRoute>
                <AppLayout>
                  <CatalogLayout />
                </AppLayout>
              </ProtectedRoute>
            }
          >
            <Route
              index
              element={<Navigate to="/catalogo/productos" replace />}
            />
            <Route path="productos" element={<ProductsPage />} />
            <Route path="marcas" element={<BrandsPage />} />
            <Route path="categorias" element={<CategoriesPage />} />
          </Route>
          <Route
            path="/proveedores"
            element={
              <ProtectedRoute>
                <AppLayout>
                  <SuppliersPage />
                </AppLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/inventario"
            element={
              <ProtectedRoute>
                <AppLayout>
                  <InventoryLayout />
                </AppLayout>
              </ProtectedRoute>
            }
          >
            <Route index element={<InventoryPage />} />
            <Route path="movimientos" element={<MovementsPage />} />
          </Route>
          <Route
            path="/inventario/:productId"
            element={
              <ProtectedRoute>
                <AppLayout>
                  <ProductStockPage />
                </AppLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/clientes"
            element={
              <ProtectedRoute>
                <AppLayout>
                  <CustomersPage />
                </AppLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/compras"
            element={
              <ProtectedRoute>
                <AppLayout>
                  <PurchasesPage />
                </AppLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/compras/nueva"
            element={
              <ProtectedRoute>
                <AppLayout>
                  <NewPurchasePage />
                </AppLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/compras/:purchaseId"
            element={
              <ProtectedRoute>
                <AppLayout>
                  <PurchaseDetailPage />
                </AppLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/ventas"
            element={
              <ProtectedRoute>
                <AppLayout>
                  <SalesPage />
                </AppLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/ventas/nueva"
            element={
              <ProtectedRoute>
                <AppLayout>
                  <NewSalePage />
                </AppLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/ventas/:saleId"
            element={
              <ProtectedRoute>
                <AppLayout>
                  <SaleDetailPage />
                </AppLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/administracion"
            element={
              <ProtectedRoute>
                <AppLayout>
                  <AdministrationLayout />
                </AppLayout>
              </ProtectedRoute>
            }
          >
            <Route
              index
              element={<Navigate to="/administracion/usuarios" replace />}
            />
            <Route path="usuarios" element={<UsersPage />} />
            <Route path="roles" element={<RolesPage />} />
            <Route path="permisos" element={<PermissionsPage />} />
          </Route>
          <Route
            path="/reportes"
            element={
              <ProtectedRoute>
                <AppLayout>
                  <ReportsLayout />
                </AppLayout>
              </ProtectedRoute>
            }
          >
            <Route index element={<Navigate to="/reportes/ventas" replace />} />
            <Route path="ventas" element={<SalesReportPage />} />
            <Route path="compras" element={<PurchasesReportPage />} />
          </Route>
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
