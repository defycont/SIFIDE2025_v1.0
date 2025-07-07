

export interface MonthlyEntry {
  [key: string]: number; // Allows for dynamic fields like Ingresos16, Gastos0, etc.
}

export interface IngresosMensual extends MonthlyEntry {
  Ingresos16: number;
  Ingresos0: number;
  IngresosExentos: number;
}

export interface EgresosMensual extends MonthlyEntry {
  Gastos16: number;
  Gastos0: number;
  GastosExentos: number;
  Nmina: number; // Nomina
  Estrategia16: number; // New column for strategic 16% expenses
}

export interface ResicoPfMensual {
  ingresos: number;
  retencion: number;
}

export interface CedulaIVAMes {
  IngrGrav16: number;
  IVACobrado: number;
  EgrGrav16: number;
  IVAAcreditable: number;
  IVACausado: number;
  SaldoFavorAnt: number;
  IVACargo: number;
  SaldoFavorSig: number;
}

export interface CedulaISRMes {
  IngresosNominalesAcum: number;
  DeduccionesAutorizadasAcum: number;
  UtilidadFiscalAcum: number;
  PerdidasFiscalesAplicables?: number; // Nueva columna para pérdidas aplicables
  BaseGravableAcum: number;
  ISRCausadoAcumEst: number;
  PagosProvAntCalc: number;
  PagoProvisionalCalcEst: number;
}

export interface ResicoPfCalculadoMes {
  ingresosMes: number;
  tasaIsr: string; // e.g., "1.00%"
  isrCalculado: number;
  retencionMes: number;
  isrMensualPagar: number;
}

export interface AppConfig { // This configuration is per RFC
  nombreEmpresa: string;
  rfc: string; // The RFC this config belongs to
  tasaIVA: number;
  ejercicioFiscal: number;
  regimenFiscal?: 'General' | 'RESICO_PF'; // Nuevo campo para el régimen fiscal
}

export type ActiveTab =
  | 'resumen' | 'ingresos' | 'egresos' | 'iva' | 'isr'
  | 'resico-pf' | 'fiscal-calculations' | 'reportes' | 'xml-tools' | 'config' | 'educacion'
  | 'sat-xml' | 'historial-descarga'; // Added new tab for Download History

export interface ChartData {
  labels: string[];
  datasets: ChartDataset[];
}

export interface ChartDataset {
  label: string;
  data: number[];
  backgroundColor?: string | string[];
  borderColor?: string | string[];
  type?: string; // For mixed charts like bar/line
  fill?: boolean;
  tension?: number;
  order?: number;
  yAxisID?: string;
  borderWidth?: number;
}

// For XML processing (simplified)
export interface XmlSummaryItem {
  tipo: 'Emitido' | 'Recibido';
  uuid: string;
  total: number;
  formaPago: string;
  nombreArchivo: string;
}

export interface KpiFormaPago {
  [key: string]: { total: number; count: number };
}

// For Benford analysis
export interface BenfordDistribution {
  [digit: string]: number; // "1" through "9"
}

// Data specific to a taxpayer (RFC)
export interface TaxpayerData {
  appConfig: AppConfig; // Configuration specific to this RFC
  ingresosData: IngresosMensual[];
  egresosData: EgresosMensual[];
  resicoPfData: ResicoPfMensual[];
  lastSavedTimestamp?: string;
}

// User profile data, stored under the authenticated user's UID
export interface UserProfile {
  email: string;
  lastActiveRfc?: string;
  // Potentially: clientList?: Array<{ rfc: string, nombreEmpresa: string }>;
}

export interface StoredRfcInfo {
  rfc: string;
  nombreEmpresa: string;
}

// Props for DashboardController
export interface DashboardControllerProps {
  authUserId: string; // Authenticated Firebase User ID
  activeRfc: string; // The RFC currently being worked on
  initialTaxpayerData: TaxpayerData; // Data for the activeRfc
  onAppConfigChange: (newConfig: AppConfig, rfc: string) => Promise<void>; // To update AppConfig for the activeRfc
  onSwitchRfc: (newRfc: string) => Promise<void>; // Callback to App.tsx to switch the active RFC
  storedRfcsList: StoredRfcInfo[]; // List of all configured RFCs
  requestedTab?: ActiveTab | null;
  clearRequestedTab?: () => void;
  totalPerdidasFiscalesAcumuladas: number; // Nueva prop para las pérdidas fiscales acumuladas
  onCedulaIsrDataChange: (data: CedulaISRMes[]) => void; // Para que DashboardController envíe sus datos de ISR a App.tsx
}

// Props for AdminPanel
export type AdminActiveTab = 'admin-overview' | 'roles' | 'usuarios' | 'empresas' | 'perdidas-fiscales';

export interface AdminPanelProps {
  setCurrentAppView: (view: 'dashboard' | 'admin') => void;
  storedRfcsList: StoredRfcInfo[];
  userEmail?: string; // Optional: for display in admin panel or future use
  onNavigateToConfig: (rfc?:string) => void; // For adding new company from AdminEmpresasTab
  onTotalPerdidasFiscalesChange: (total: number) => void; // Nueva prop para comunicar pérdidas fiscales a App.tsx
  isrCedulaData: CedulaISRMes[]; // Datos de la cédula ISR desde DashboardController, pasados via App.tsx
}

// Nueva interfaz para AdminPerdidasFiscalesTab
export interface AdminPerdidasFiscalesTabProps {
  isrCedulaData: CedulaISRMes[];
  onTotalPerdidasFiscalesChange: (total: number) => void;
}

// Mock User type for AdminUsuariosTab
export interface AdminUser {
  id: string;
  nombre: string;
  correo: string;
  contrasena?: string; // Should be hashed or '********'
  empresaBase: string;
  tipoUsuario: string; // e.g., 'admin-despacho', 'contador', 'solo-lectura'
  numeroSesiones: number;
  estatus: 'Activo' | 'Inactivo';
  ultimaSesion: string; // ISO date string or formatted date
  activoSistema: boolean; // 'Sí' / 'No' in UI
}

export interface AdminRole {
    id: string;
    nombre: string;
    // permissions?: string[]; // Future enhancement
}

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

export interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  itemsPerPage?: number;
  totalItems?: number;
}

// SAT XML Download specific types
export interface EFirmaConfig {
  cerFile: File | null;
  keyFile: File | null;
  password: string;
}

export type SatDownloadStatus = 'idle' | 'pending' | 'success' | 'error';

export interface SatDownloadState {
  status: SatDownloadStatus;
  lastAttempt: string; // ISO date string
  message: string; // For errors or success messages
}

export interface MockSatXmlItem {
  id: string;
  fechaDescarga: string; // ISO date string
  tipo: 'Emitido' | 'Recibido';
  uuid: string;
  origen: string;
  estadoProcesamiento: 'Pendiente' | 'Procesado';
}

// Historial Descarga Tab Types
export type DownloadDayStatusValue = 'not_attempted' | 'error' | 'in_progress' | 'success' | 'pending';

export interface DailyStatus {
  day: number; // 1-31
  status: DownloadDayStatusValue;
}

export interface MonthlyStatus {
  monthName: string; 
  monthIndex: number; // 0-11
  days: DailyStatus[];
}

// For Functional Fiscal Alerts
export interface FiscalAlertItem {
  id: string; // Unique identifier for the alert, e.g., 'PERDIDA_FISCAL'
  code: string; // A machine-readable code for the alert type
  type: 'warning' | 'info' | 'success' | 'error'; // Severity of the alert
  title: string; // A short, human-readable title for the alert
  message: string; // Detailed message explaining the alert
  aiPromptContent?: string; // Specific content to build the prompt for Gemini
  aiAdvice?: string | null; // Stores the advice received from Gemini
  isAiAdviceLoading?: boolean; // True if AI advice is being fetched
  isExpanded?: boolean; // For UI to toggle visibility of AI advice
}

// For Planeación Fiscal Avanzada
export interface ProjectionSettings {
  incomeAdjustmentPercent: number; // e.g., 10 for +10%, -5 for -5%
  expenseAdjustmentPercent: number; // e.g., 5 for +5%, -10 for -10%
}

export interface ProjectedFiscalData {
  baseYear: number;
  projectionYear: number;
  projectedIncome: number;
  projectedExpenses: number;
  projectedProfit: number;
  projectedISR_ActEmp: number; // Estimated ISR for Actividad Empresarial
  projectedISR_RESICOPF: number; // Estimated ISR for RESICO PF (if applicable)
  projectedIVA_Cargo: number; // Estimated IVA a Cargo
}