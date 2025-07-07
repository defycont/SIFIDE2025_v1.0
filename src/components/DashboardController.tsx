
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
    AppConfig, ActiveTab, IngresosMensual, EgresosMensual, ResicoPfMensual, 
    CedulaIVAMes, CedulaISRMes, ResicoPfCalculadoMes, ChartData, 
    XmlSummaryItem, KpiFormaPago, BenfordDistribution, DashboardControllerProps, 
    TaxpayerData, StoredRfcInfo, EFirmaConfig, SatDownloadState, FiscalAlertItem,
    ProjectionSettings, ProjectedFiscalData
} from '../types';
import { 
    MESES, MESES_TARIFAS_KEYS, TABLA_TASAS_RESICO_PF_SAT, 
    BENFORD_EXPECTED_DISTRIBUTION, BENFORD_LABELS, FORMA_PAGO_DESCRIPCIONES, 
    KPI_FORMA_PAGO_KEYS, TAB_OPTIONS, INITIAL_INGRESOS, INITIAL_EGRESOS, 
    INITIAL_RESICO_PF, DEFAULT_APP_CONFIG, TARIFAS_ISR_ACUMULADAS_POR_MES, MESES_COMPLETOS 
} from '../constants';
import { ChartWrapper } from './ChartWrapper';
import { updateTaxpayerPartialData, resetTaxpayerFirestoreData, getSpecificTaxpayerField } from '../firebaseUtils';
import { FiscalAssistantModal } from './admin_tabs/FiscalAssistantModal';
import { HistorialDescargaTab } from './tabs/HistorialDescargaTab';
import { subirEFirma, descargarCFDI, estadoSolicitud, ApiResponse, EstadoSolicitudResponse as ApiEstadoSolicitudResponse } from '../apiService';
import { GoogleGenAI, GenerateContentResponse } from "@google/genai";


// Ensure jsPDF and XLSX are globally available from CDN
declare var jsPDF: any;
declare var XLSX: any;


// Helper function to format currency
const formatCurrency = (value: number | string | undefined | null, showSymbol = true): string => {
  if (value === null || typeof value === 'undefined' || isNaN(Number(value))) {
    value = 0;
  }
  const numValue = Number(value);
  return `${showSymbol ? '$' : ''}${numValue.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

// Helper function to get numeric value from input or string
const getNumericValue = (value: string | number | undefined): number => {
  if (typeof value === 'number') return isNaN(value) ? 0 : value;
  if (typeof value === 'string') {
    const nS = value.replace(/[^0-9.-]+/g, "");
    const parsed = parseFloat(nS);
    return isNaN(parsed) ? 0 : parsed;
  }
  return 0;
};

// Initialize Gemini AI
let ai: GoogleGenAI | null = null;
if (process.env.API_KEY) {
  try {
    ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  } catch (error) {
    console.error("Error initializing GoogleGenAI:", error);
  }
} else {
  console.warn("API_KEY environment variable not set. Gemini AI features will be disabled.");
}

const GEMINI_SYSTEM_INSTRUCTION_ALERTS = "Eres un asesor fiscal experto en México. Proporciona consejos claros, concisos y accionables basados en la información fiscal resumida que se te provee. Limita tu respuesta a 2-3 frases cortas o viñetas. Enfócate en sugerir áreas de revisión o acciones generales, no en dar asesoramiento legal definitivo.";
const GEMINI_SYSTEM_INSTRUCTION_EDUCACION = "Explica de forma clara, concisa y educativa el siguiente tema fiscal mexicano para un contribuyente general. Enfócate en los puntos clave, obligaciones y beneficios si aplica, según la legislación vigente. Usa lenguaje accesible. Limita la explicación a 3-4 párrafos cortos o 5-7 viñetas.";
const GEMINI_SYSTEM_INSTRUCTION_DISCREPANCIA = "Mis ingresos anuales estimados son [INGRESOS] y mis gastos anuales estimados son [GASTOS]. Existe una posible discrepancia fiscal porque mis gastos son mayores. Como asesor fiscal mexicano, explícame brevemente (2-3 frases) qué es la discrepancia fiscal, cómo la detecta el SAT, y qué tipo de revisión de información o buenas prácticas generales debería considerar. No des asesoramiento legal específico.";
const GEMINI_SYSTEM_INSTRUCTION_PLANEACION = `Considerando una proyección de ingresos de [INGRESOS_PROYECTADOS] y egresos de [EGRESOS_PROYECTADOS] para el próximo ejercicio fiscal [EJERCICIO_PROYECCION], lo que resulta en una utilidad fiscal estimada de [UTILIDAD_PROYECTADA] y un ISR estimado de [ISR_PROYECTADO].
El contribuyente opera bajo el régimen de [REGIMEN_PRINCIPAL].
Actúa como un asesor fiscal experto en México. ¿Qué 2-3 estrategias generales de planeación fiscal (sin entrar en detalles específicos de deducciones particulares, sino más bien enfoques o áreas a considerar) podría explorar este contribuyente para optimizar su carga fiscal el próximo año y mejorar su flujo de efectivo? Presenta los consejos de forma clara y accionable.`;


export const DashboardController: React.FC<DashboardControllerProps> = ({ 
  authUserId, 
  activeRfc, 
  initialTaxpayerData, 
  onAppConfigChange, 
  onSwitchRfc, 
  requestedTab, 
  clearRequestedTab,
  storedRfcsList 
}) => {
  const [activeTab, setActiveTab] = useState<ActiveTab>('resumen');
  const [lastSaved, setLastSaved] = useState<string | null>(null);
  const [savingIndicator, setSavingIndicator] = useState<{ show: boolean; message: string; success: boolean }>({ show: false, message: '', success: true });
  const [isLoadingOverlay, setIsLoadingOverlay] = useState<boolean>(true); 
  const [isFiscalAssistantModalOpen, setIsFiscalAssistantModalOpen] = useState(false);
  
  const [selectedSummaryMonthIndex, setSelectedSummaryMonthIndex] = useState<number>(new Date().getMonth());
  const [aiPrompt, setAiPrompt] = useState<string>('');
  const [aiResponse, setAiResponse] = useState<string | null>(null);
  const [isAiLoading, setIsAiLoading] = useState<boolean>(false);
  const [fiscalAlerts, setFiscalAlerts] = useState<FiscalAlertItem[]>([]);

  // For "Educacion Fiscal" Tab
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null);
  const [educationContent, setEducationContent] = useState<string | null>(null);
  const [isEducationLoading, setIsEducationLoading] = useState<boolean>(false);
  
  // For Discrepancia Fiscal AI
  const [discrepanciaAiAdvice, setDiscrepanciaAiAdvice] = useState<string | null>(null);
  const [isDiscrepanciaAiLoading, setIsDiscrepanciaAiLoading] = useState<boolean>(false);
  
  // RFC Validator State
  const [rfcValidation, setRfcValidation] = useState<{valid: boolean; message: string} | null>(null);

  // Planeación Fiscal Avanzada State
  const [projectionSettings, setProjectionSettings] = useState<ProjectionSettings>({ incomeAdjustmentPercent: 0, expenseAdjustmentPercent: 0 });
  const [projectedFiscalData, setProjectedFiscalData] = useState<ProjectedFiscalData | null>(null);
  const [isProjectionAiLoading, setIsProjectionAiLoading] = useState<boolean>(false);
  const [projectionAiAdvice, setProjectionAiAdvice] = useState<string | null>(null);


  const fiscalTopics = [
    "Declaración Anual Personas Físicas",
    "Facturación CFDI 4.0",
    "Régimen Simplificado de Confianza (RESICO PF)",
    "Deducciones Personales",
    "IVA Acreditable: Requisitos y Cálculo",
    "Tipos de Regímenes Fiscales para Personas Físicas",
    "Pagos Provisionales de ISR",
    "Obligaciones Fiscales Básicas de un Emprendedor",
  ];


  // Fiscal data states
  const [ingresosData, setIngresosData] = useState<IngresosMensual[]>(INITIAL_INGRESOS.map(item => ({...item})));
  const [egresosData, setEgresosData] = useState<EgresosMensual[]>(INITIAL_EGRESOS.map(item => ({...item})));
  const [resicoPfData, setResicoPfData] = useState<ResicoPfMensual[]>(INITIAL_RESICO_PF.map(item => ({...item})));
  
  const [currentConfig, setCurrentConfig] = useState<AppConfig>(initialTaxpayerData.appConfig || DEFAULT_APP_CONFIG);
  
   useEffect(() => {
    setCurrentConfig(initialTaxpayerData.appConfig || {...DEFAULT_APP_CONFIG, rfc: activeRfc });
  }, [initialTaxpayerData.appConfig, activeRfc]);

  useEffect(() => {
    if (requestedTab && clearRequestedTab) {
      if (activeRfc.startsWith("TEMP_NEW_RFC_")) {
        setCurrentConfig({
            ...DEFAULT_APP_CONFIG, 
            rfc: '', 
            nombreEmpresa: '', 
            ejercicioFiscal: new Date().getFullYear() 
        });
      }
      setActiveTab(requestedTab);
      clearRequestedTab(); 
    }
  }, [requestedTab, clearRequestedTab, setActiveTab, activeRfc]);


  const [xmlEmitidosFiles, setXmlEmitidosFiles] = useState<FileList | null>(null);
  const [xmlRecibidosFiles, setXmlRecibidosFiles] = useState<FileList | null>(null);
  const [xmlProcessingStatus, setXmlProcessingStatus] = useState<string>('');
  const [topClientesData, setTopClientesData] = useState<Array<{ rfc: string, total: number }>>([]);
  const [topProveedoresData, setTopProveedoresData] = useState<Array<{ rfc: string, total: number }>>([]);
  const [kpiFormaPagoData, setKpiFormaPagoData] = useState<KpiFormaPago>({});

  const [eFirmaConfig, setEFirmaConfig] = useState<EFirmaConfig>({ cerFile: null, keyFile: null, password: '' });
  const [satDownloadInfo, setSatDownloadInfo] = useState<SatDownloadState>({
    status: 'idle',
    lastAttempt: 'N/A',
    message: 'Servicio no iniciado.'
  });
  const [satDownloadFechaInicio, setSatDownloadFechaInicio] = useState(new Date().toISOString().split('T')[0]);
  const [satDownloadFechaFin, setSatDownloadFechaFin] = useState(new Date().toISOString().split('T')[0]);
  const [satDownloadTipo, setSatDownloadTipo] = useState<'emitidos' | 'recibidos'>('recibidos');
  const [currentSolicitudId, setCurrentSolicitudId] = useState<string | null>(null);
  
  const updateLastSavedTimeDisplay = useCallback(async (rfcToFetch: string) => {
    if (!rfcToFetch || rfcToFetch.startsWith("TEMP_NEW_RFC_")) { 
        setLastSaved("N/A (Nuevo)"); return;
    }
    try {
      const timestampStr = await getSpecificTaxpayerField(rfcToFetch, 'lastSavedTimestamp');
      if (timestampStr) {
        setLastSaved(new Date(timestampStr).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }));
      } else {
        setLastSaved('Nunca');
      }
    } catch (error) {
      console.error("Error fetching last saved time:", error);
      setLastSaved('Error');
    }
  }, []);

  useEffect(() => {
    const loadData = async () => {
      if (!activeRfc || activeRfc.startsWith("TEMP_NEW_RFC_")) { 
        setIngresosData(INITIAL_INGRESOS.map(item => ({...item})));
        setEgresosData(INITIAL_EGRESOS.map(item => ({...item})));
        setResicoPfData(INITIAL_RESICO_PF.map(item => ({...item})));
        
        if(activeRfc.startsWith("TEMP_NEW_RFC_")) {
          setLastSaved('N/A (Nuevo)');
          setCurrentConfig({...DEFAULT_APP_CONFIG, rfc: '', nombreEmpresa: 'Nueva Empresa (Configurar)'});
        } else if (initialTaxpayerData.lastSavedTimestamp) {
          setLastSaved(new Date(initialTaxpayerData.lastSavedTimestamp).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }));
        } else {
          updateLastSavedTimeDisplay(activeRfc); 
        }
        setIsLoadingOverlay(false);
        return;
      }

      setIsLoadingOverlay(true);
      try {
        setIngresosData(initialTaxpayerData.ingresosData && initialTaxpayerData.ingresosData.length > 0 ? initialTaxpayerData.ingresosData.map(item => ({...item})) : INITIAL_INGRESOS.map(item => ({...item})));
        setEgresosData(initialTaxpayerData.egresosData && initialTaxpayerData.egresosData.length > 0 ? initialTaxpayerData.egresosData.map(item => ({...item})) : INITIAL_EGRESOS.map(item => ({...item})));
        setResicoPfData(initialTaxpayerData.resicoPfData && initialTaxpayerData.resicoPfData.length > 0 ? initialTaxpayerData.resicoPfData.map(item => ({...item})) : INITIAL_RESICO_PF.map(item => ({...item})));
        setCurrentConfig(initialTaxpayerData.appConfig || {...DEFAULT_APP_CONFIG, rfc: activeRfc});
        
        if (initialTaxpayerData.lastSavedTimestamp) {
          setLastSaved(new Date(initialTaxpayerData.lastSavedTimestamp).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }));
        } else {
           updateLastSavedTimeDisplay(activeRfc);
        }
        
      } catch (error) {
        console.error("Error setting data from initialTaxpayerData:", error);
        setIngresosData(INITIAL_INGRESOS.map(item => ({...item})));
        setEgresosData(INITIAL_EGRESOS.map(item => ({...item})));
        setResicoPfData(INITIAL_RESICO_PF.map(item => ({...item})));
        setCurrentConfig({...DEFAULT_APP_CONFIG, rfc: activeRfc}); 
        setLastSaved('Error al cargar');
      } finally {
        setIsLoadingOverlay(false);
      }
    };
    loadData();
  }, [activeRfc, initialTaxpayerData, updateLastSavedTimeDisplay]);


  const showSavingFlash = (success: boolean, message: string) => {
    setSavingIndicator({ show: true, message, success });
    setTimeout(() => setSavingIndicator({ show: false, message: '', success: true }), 2500);
  };

  const handleGenericDataSave = async <
    TItem extends IngresosMensual | EgresosMensual | ResicoPfMensual
  >(
    dataKey: Extract<keyof TaxpayerData, 'ingresosData' | 'egresosData' | 'resicoPfData'>,
    currentDataArray: TItem[],
    monthIndex: number,
    field: Extract<keyof TItem, string>,
    value: number
  ) => {
    if (!activeRfc || activeRfc.startsWith("TEMP_NEW_RFC_")) {
      showSavingFlash(false, 'Error: No hay un RFC activo válido para guardar.');
      console.error("handleGenericDataSave: activeRfc no disponible o es temporal.");
      return;
    }
    const updatedArray: TItem[] = currentDataArray.map((item, index) =>
      index === monthIndex ? { ...item, [field]: value } : item
    );
    
     if (dataKey === 'ingresosData') {
      setIngresosData(updatedArray as IngresosMensual[]);
    } else if (dataKey === 'egresosData') {
      setEgresosData(updatedArray as EgresosMensual[]);
    } else if (dataKey === 'resicoPfData') {
      setResicoPfData(updatedArray as ResicoPfMensual[]);
    }

    try {
      await updateTaxpayerPartialData(activeRfc, { [dataKey]: updatedArray as TaxpayerData[typeof dataKey] });
      showSavingFlash(true, 'Cambio manual guardado en nube');
      updateLastSavedTimeDisplay(activeRfc);
    } catch (error) {
      showSavingFlash(false, 'Error al guardar cambio manual');
      console.error(`Error saving ${dataKey} to Firestore for RFC ${activeRfc}:`, error);
    }
  };
    
  const handleIngresosDataChange = (monthIndex: number, field: keyof IngresosMensual, value: number) => {
    handleGenericDataSave('ingresosData', ingresosData, monthIndex, field as Extract<keyof IngresosMensual, string>, value);
  };
  
  const handleEgresosDataChange = (monthIndex: number, field: keyof EgresosMensual, value: number) => {
    handleGenericDataSave('egresosData', egresosData, monthIndex, field as Extract<keyof EgresosMensual, string>, value);
  };
    
  const handleResicoDataChange = (monthIndex: number, field: keyof ResicoPfMensual, value: number) => {
    handleGenericDataSave('resicoPfData', resicoPfData, monthIndex, field as Extract<keyof ResicoPfMensual, string>, value);
  };
  
  // Totales Ingresos
  const totalesIngresos = useMemo(() => {
    const tasaIva = (currentConfig.tasaIVA || 0) / 100;
    let t16 = 0, t0 = 0, tEx = 0, tIva = 0, tGen = 0;
    const mensuales = ingresosData.map(mes => {
      const ing16 = mes.Ingresos16 || 0;
      const ing0 = mes.Ingresos0 || 0;
      const ingEx = mes.IngresosExentos || 0;
      const ivaCobrado = ing16 * tasaIva;
      const totalMes = ing16 + ing0 + ingEx;
      t16 += ing16;
      t0 += ing0;
      tEx += ingEx;
      tIva += ivaCobrado;
      tGen += totalMes;
      return { ...mes, Ingresos16: ing16, Ingresos0: ing0, IngresosExentos: ingEx, ivaCobrado, totalMes };
    });
    return {
      mensuales,
      totalAnualIngresos16: t16,
      totalAnualIngresos0: t0,
      totalAnualIngresosExentos: tEx,
      totalAnualIvaCobrado: tIva,
      totalAnualIngresosGeneral: tGen,
    };
  }, [ingresosData, currentConfig.tasaIVA]);

  // Totales Egresos (Corrected for KPI issue)
  const totalesEgresos = useMemo(() => {
    const tasaIva = (currentConfig.tasaIVA || 0) / 100;
    let t16 = 0, tIva = 0, t0 = 0, tEx = 0, tNom = 0, tEst16 = 0, tGen = 0;
    const mensuales = egresosData.map(mes => {
      const g16 = mes.Gastos16 || 0;
      const g0 = mes.Gastos0 || 0;
      const gEx = mes.GastosExentos || 0;
      const nom = mes.Nmina || 0;
      const est16 = mes.Estrategia16 || 0;
      
      const ivaAcreditable = (g16 + est16) * tasaIva; // Includes Estrategia16 if subject to IVA
      const totalMes = g16 + g0 + gEx + nom + est16; // Includes Estrategia16

      t16 += g16;
      tIva += ivaAcreditable;
      t0 += g0;
      tEx += gEx;
      tNom += nom;
      tEst16 += est16;
      tGen += totalMes;
      return { ...mes, Gastos16:g16, Gastos0:g0, GastosExentos:gEx, Nmina:nom, Estrategia16:est16, ivaAcreditable, totalMes };
    });
    return {
      mensuales,
      totalAnualEgresos16: t16,
      totalAnualIvaAcreditableGastos: tIva,
      totalAnualEgresos0: t0,
      totalAnualEgresosExentos: tEx,
      totalAnualNomina: tNom,
      totalAnualEstrategia16: tEst16, // Added for completeness
      totalAnualEgresosGeneral: tGen,
    };
  }, [egresosData, currentConfig.tasaIVA]);

  const cedulaIvaCalculada = useMemo(() => {
    const tasaIva = (currentConfig.tasaIVA || 0) / 100;
    let saldoFavorAnterior = 0;
    const resultadosMensuales: CedulaIVAMes[] = [];
    let totalIngrGrav = 0, totalIvaCobrado = 0, totalEgrGrav = 0, totalIvaAcreditable = 0, totalIvaCausado = 0, totalIvaCargo = 0;

    for (let i = 0; i < 12; i++) {
      const ingrGrav16 = (ingresosData[i]?.Ingresos16 || 0);
      const egrSujetoIva16 = (egresosData[i]?.Gastos16 || 0) + (egresosData[i]?.Estrategia16 || 0);
      const ivaCobrado = ingrGrav16 * tasaIva;
      const ivaAcreditableCalc = egrSujetoIva16 * tasaIva;
      const ivaCausado = ivaCobrado - ivaAcreditableCalc;
      const baseCalculo = ivaCausado - saldoFavorAnterior;
      const ivaCargo = Math.max(0, baseCalculo);
      const saldoFavorSiguiente = Math.max(0, -baseCalculo);

      resultadosMensuales.push({
        IngrGrav16: ingrGrav16, IVACobrado: ivaCobrado, EgrGrav16: egrSujetoIva16,
        IVAAcreditable: ivaAcreditableCalc, IVACausado: ivaCausado, SaldoFavorAnt: saldoFavorAnterior,
        IVACargo: ivaCargo, SaldoFavorSig: saldoFavorSiguiente
      });
      
      totalIngrGrav += ingrGrav16; totalIvaCobrado += ivaCobrado; totalEgrGrav += egrSujetoIva16;
      totalIvaAcreditable += ivaAcreditableCalc; totalIvaCausado += ivaCausado; totalIvaCargo += ivaCargo;
      saldoFavorAnterior = saldoFavorSiguiente;
    }
    return { 
        mensuales: resultadosMensuales, 
        totales: { totalIngrGrav, totalIvaCobrado, totalEgrGrav, totalIvaAcreditable, totalIvaCausado, totalIvaCargo } 
    };
  }, [ingresosData, egresosData, currentConfig.tasaIVA]);

  const cedulaIsrCalculada = useMemo(() => {
    let ingresosAcumulados = 0;
    let deduccionesAcumuladas = 0;
    let pagosProvisionalesAnteriores = 0;
    const resultadosMensuales: CedulaISRMes[] = [];
    let totalPagoProvisionalAnual = 0;
    
    const ejercicioFiscal = currentConfig.ejercicioFiscal || new Date().getFullYear(); 

    for (let i = 0; i < 12; i++) {
      const mesKey = MESES_TARIFAS_KEYS[i] as keyof typeof TARIFAS_ISR_ACUMULADAS_POR_MES;
      const tarifaDelMes = TARIFAS_ISR_ACUMULADAS_POR_MES[mesKey]; 
      
      const ingresosMes = totalesIngresos.mensuales[i]?.totalMes || 0;
      const deduccionesMes = totalesEgresos.mensuales[i]?.totalMes || 0;

      ingresosAcumulados += ingresosMes;
      deduccionesAcumuladas += deduccionesMes;
      
      if (!tarifaDelMes) {
        console.error(`No se encontró tarifa de ISR para el mes: ${mesKey} (Ejercicio: ${ejercicioFiscal})`);
        resultadosMensuales.push({
            IngresosNominalesAcum: ingresosAcumulados, DeduccionesAutorizadasAcum: deduccionesAcumuladas,
            UtilidadFiscalAcum: Math.max(0, ingresosAcumulados - deduccionesAcumuladas), BaseGravableAcum: Math.max(0, ingresosAcumulados - deduccionesAcumuladas), 
            ISRCausadoAcumEst: 0, PagosProvAntCalc: pagosProvisionalesAnteriores, PagoProvisionalCalcEst: 0
        });
        continue; 
      }

      const utilidadFiscalAcum = Math.max(0, ingresosAcumulados - deduccionesAcumuladas);
      const baseGravableAcum = utilidadFiscalAcum; 

      let isrCausadoAcum = 0;
      for (let j = tarifaDelMes.length - 1; j >= 0; j--) {
        const tramo = tarifaDelMes[j];
        if (baseGravableAcum >= tramo.LIM_INFERIOR) {
          const excedente = baseGravableAcum - tramo.LIM_INFERIOR;
          isrCausadoAcum = (excedente * (tramo.PORC_EXCED / 100)) + tramo.CUOTA_FIJA;
          break;
        }
      }
      isrCausadoAcum = Math.max(0, isrCausadoAcum);
      const pagoProvisionalMes = Math.max(0, isrCausadoAcum - pagosProvisionalesAnteriores);

      resultadosMensuales.push({
        IngresosNominalesAcum: ingresosAcumulados,
        DeduccionesAutorizadasAcum: deduccionesAcumuladas,
        UtilidadFiscalAcum: utilidadFiscalAcum,
        BaseGravableAcum: baseGravableAcum,
        ISRCausadoAcumEst: isrCausadoAcum,
        PagosProvAntCalc: pagosProvisionalesAnteriores,
        PagoProvisionalCalcEst: pagoProvisionalMes,
      });
      pagosProvisionalesAnteriores += pagoProvisionalMes;
      totalPagoProvisionalAnual += pagoProvisionalMes;
    }
    
    const utilidadFiscalAnual = Math.max(0, ingresosAcumulados - deduccionesAcumuladas);
    let isrCausadoAnualEstimado = 0;
    const tarifaAnual = TARIFAS_ISR_ACUMULADAS_POR_MES["DICIEMBRE"]; 
    if (tarifaAnual) {
        for (let j = tarifaAnual.length - 1; j >= 0; j--) {
            const tramo = tarifaAnual[j];
            if (utilidadFiscalAnual >= tramo.LIM_INFERIOR) {
              const excedenteAnual = utilidadFiscalAnual - tramo.LIM_INFERIOR;
              isrCausadoAnualEstimado = (excedenteAnual * (tramo.PORC_EXCED / 100)) + tramo.CUOTA_FIJA;
              break;
            }
        }
    } else {
        console.error(`No se encontró tarifa de ISR para DICIEMBRE (anual) (Ejercicio: ${ejercicioFiscal}).`);
    }
    isrCausadoAnualEstimado = Math.max(0, isrCausadoAnualEstimado);

    return {
      mensuales: resultadosMensuales,
      totales: {
        totalIngresosNominales: ingresosAcumulados,
        totalDeduccionesAutorizadas: deduccionesAcumuladas,
        totalUtilidadFiscal: utilidadFiscalAnual,
        totalBaseGravable: utilidadFiscalAnual, 
        totalIsrCausadoEstimado: isrCausadoAnualEstimado,
        totalPagosProvisionales: totalPagoProvisionalAnual,
      }
    };
  }, [totalesIngresos, totalesEgresos, currentConfig.ejercicioFiscal]);
  
  const resicoPfCalculado = useMemo(() => {
    const tablaTasas = TABLA_TASAS_RESICO_PF_SAT; 
    let totalIngresosAnual = 0;
    let totalIsrCalculadoAnual = 0;
    let totalRetencionAnual = 0;
    let totalIsrPagarAnual = 0;
    const resultadosMensuales: ResicoPfCalculadoMes[] = [];

    resicoPfData.forEach(mes => {
      const ingresosMes = mes.ingresos || 0;
      const retencionMes = mes.retencion || 0;
      let tasaAplicableNum = 0.00;

      if (ingresosMes > 0) {
        for (const tramo of tablaTasas) {
          if (ingresosMes >= tramo.limiteInferior && ingresosMes <= tramo.limiteSuperior) {
            tasaAplicableNum = tramo.tasa;
            break;
          }
        }
        // Check if ingresosMes exceeds the second to last upper limit, if so, apply the last rate.
        // This handles cases where ingresosMes is greater than the last defined `limiteSuperior` before Infinity.
        if (tasaAplicableNum === 0.00 && tablaTasas.length > 1 && ingresosMes > tablaTasas[tablaTasas.length - 2].limiteSuperior) {
            tasaAplicableNum = tablaTasas[tablaTasas.length - 1].tasa;
        }
      }
      
      const isrCalculadoMes = ingresosMes * tasaAplicableNum;
      const isrNetoMesPagar = Math.max(0, isrCalculadoMes - retencionMes);

      resultadosMensuales.push({
        ingresosMes: ingresosMes,
        tasaIsr: (tasaAplicableNum * 100).toFixed(2) + '%',
        isrCalculado: isrCalculadoMes,
        retencionMes: retencionMes,
        isrMensualPagar: isrNetoMesPagar,
      });

      totalIngresosAnual += ingresosMes;
      totalIsrCalculadoAnual += isrCalculadoMes;
      totalRetencionAnual += retencionMes;
      totalIsrPagarAnual += isrNetoMesPagar;
    });

    return {
      mensuales: resultadosMensuales,
      totales: {
        totalIngresosAnual, totalIsrCalculadoAnual, totalRetencionAnual, totalIsrPagarAnual
      }
    };
  }, [resicoPfData]);

  const summaryData = useMemo(() => ({
    ingresos: totalesIngresos.totalAnualIngresosGeneral,
    egresos: totalesEgresos.totalAnualEgresosGeneral,
    utilidad: totalesIngresos.totalAnualIngresosGeneral - totalesEgresos.totalAnualEgresosGeneral,
  }), [totalesIngresos, totalesEgresos]);

  const declaracionAnualData = useMemo(() => {
    const isrAnualEstimado = cedulaIsrCalculada.totales.totalIsrCausadoEstimado;
    const pagosProvisionalesEfectuados = cedulaIsrCalculada.totales.totalPagosProvisionales;
    return {
      ingresosAcumulables: cedulaIsrCalculada.totales.totalIngresosNominales,
      deduccionesAutorizadas: cedulaIsrCalculada.totales.totalDeduccionesAutorizadas,
      utilidadFiscal: cedulaIsrCalculada.totales.totalUtilidadFiscal,
      perdidasFiscales: 0, 
      baseGravable: cedulaIsrCalculada.totales.totalBaseGravable,
      isrAnualCausado: isrAnualEstimado,
      pagosProvisionales: pagosProvisionalesEfectuados,
      isrNeto: isrAnualEstimado - pagosProvisionalesEfectuados,
    };
  }, [cedulaIsrCalculada]);
  
  const reportesAnualesData = useMemo(() => ({
      isrAnualNeto: declaracionAnualData.isrNeto,
      ivaCargoAnual: cedulaIvaCalculada.totales.totalIvaCargo,
      ivaFavorDic: cedulaIvaCalculada.mensuales.length > 0 ? cedulaIvaCalculada.mensuales[11].SaldoFavorSig : 0,
  }), [declaracionAnualData, cedulaIvaCalculada]);

  const utilidadFiscalPorcentaje = useMemo(() => {
      const ingresos = declaracionAnualData.ingresosAcumulables;
      const utilidad = declaracionAnualData.utilidadFiscal;
      if (ingresos === 0 || typeof ingresos !== 'number' || typeof utilidad !== 'number' || isNaN(ingresos) || isNaN(utilidad)) {
          return 0; 
      }
      return (utilidad / ingresos) * 100;
  }, [declaracionAnualData]);


  const comparativoIngresosEgresosChartData: ChartData = useMemo(() => ({
    labels: MESES,
    datasets: [
      { label: 'Ingresos', data: totalesIngresos.mensuales.map(m => m.totalMes), backgroundColor: 'rgba(59, 130, 246, 0.7)' },
      { label: 'Egresos', data: totalesEgresos.mensuales.map(m => m.totalMes), backgroundColor: 'rgba(239, 68, 68, 0.7)' },
    ],
  }), [totalesIngresos, totalesEgresos]);

  const composicionEgresosChartData: ChartData = useMemo(() => ({
    labels: ['Gastos 16%', 'Estrategia 16%', 'Gastos 0%', 'Gastos Exentos', 'Nómina'],
    datasets: [{
      label: 'Composición Egresos',
      data: [
        totalesEgresos.totalAnualEgresos16,
        totalesEgresos.totalAnualEstrategia16,
        totalesEgresos.totalAnualEgresos0,
        totalesEgresos.totalAnualEgresosExentos,
        totalesEgresos.totalAnualNomina,
      ],
      backgroundColor: ['#fbbf24', '#f97316', '#38bdf8', '#64748b', '#22c55e'],
    }],
  }), [totalesEgresos]);

  const ingresosMensualesChartData: ChartData = useMemo(() => ({
      labels: MESES,
      datasets: [{
          label: 'Total Ingresos Mensual',
          data: totalesIngresos.mensuales.map(m => m.totalMes),
          borderColor: 'rgb(59, 130, 246)', tension: 0.1, fill: false,
      }]
  }), [totalesIngresos]);

  const egresosMensualesChartData: ChartData = useMemo(() => ({
      labels: MESES,
      datasets: [{
          label: 'Total Egresos Mensual',
          data: totalesEgresos.mensuales.map(m => m.totalMes),
          borderColor: 'rgb(239, 68, 68)', tension: 0.1, fill: false,
      }]
  }), [totalesEgresos]);
  
  const ivaMensualChartData: ChartData = useMemo(() => ({
      labels: MESES,
      datasets: [
          { label: 'IVA a Cargo', data: cedulaIvaCalculada.mensuales.map(m => m.IVACargo), backgroundColor: 'rgba(239, 68, 68, 0.7)'},
          { label: 'Saldo a Favor (Mes Sig.)', data: cedulaIvaCalculada.mensuales.map(m => -m.SaldoFavorSig), backgroundColor: 'rgba(34, 197, 94, 0.7)'},
      ]
  }), [cedulaIvaCalculada]);

  const isrMensualChartData: ChartData = useMemo(() => ({
      labels: MESES,
      datasets: [{
          label: 'Pago Provisional ISR (Estimado)',
          data: cedulaIsrCalculada.mensuales.map(m => m.PagoProvisionalCalcEst),
          backgroundColor: 'rgba(251, 191, 36, 0.7)',
      }]
  }), [cedulaIsrCalculada]);

  const isrResicoPfMensualChartData: ChartData = useMemo(() => ({
      labels: MESES,
      datasets: [
        {
          label: 'ISR Mensual a Pagar (RESICO PF)',
          data: resicoPfCalculado.mensuales.map(m => m.isrMensualPagar),
          backgroundColor: 'rgba(75, 192, 192, 0.7)', borderColor: 'rgba(75, 192, 192, 1)', borderWidth: 1, yAxisID: 'yIsr', order: 1
        },
        {
          label: 'Ingresos Mensuales (RESICO PF)',
          data: resicoPfCalculado.mensuales.map(m => m.ingresosMes),
          borderColor: 'rgba(255, 159, 64, 1)', backgroundColor: 'rgba(255, 159, 64, 0.2)', type: 'line', fill: true, tension: 0.1, yAxisID: 'yIngresos', order: 0
        }
      ]
  }), [resicoPfCalculado]);
  
  const calculateBenfordDistribution = (numbers: number[]): BenfordDistribution => {
    const firstDigitCounts: { [key: string]: number } = {'1':0,'2':0,'3':0,'4':0,'5':0,'6':0,'7':0,'8':0,'9':0};
    let totalCount = 0;
    numbers.forEach(num => {
        if (num && typeof num === 'number' && num !== 0) {
            const numStr = Math.abs(num).toString();
            let firstDigit = '';
            for (const char of numStr) {
                if (char >= '1' && char <= '9') {
                    firstDigit = char;
                    break;
                }
            }
            if (firstDigit) {
                firstDigitCounts[firstDigit]++;
                totalCount++;
            }
        }
    });
    const distribution: BenfordDistribution = {};
    for (let d = 1; d <= 9; d++) {
        const key = d.toString();
        distribution[key] = totalCount > 0 ? (firstDigitCounts[key] / totalCount) * 100 : 0;
    }
    return distribution;
  };

  const benfordIngresosData = useMemo(() => {
    const monthlyTotals = totalesIngresos.mensuales.map(m => m.totalMes).filter(v => v && typeof v ==='number' && v !== 0);
    const observed = calculateBenfordDistribution(monthlyTotals);
    return {
      labels: BENFORD_LABELS,
      datasets: [
        { label: 'Observado (%)', data: BENFORD_LABELS.map(d => observed[d] || 0), backgroundColor: 'rgba(59, 130, 246, 0.7)', order: 2 },
        { label: 'Esperado Benford (%)', data: BENFORD_EXPECTED_DISTRIBUTION, borderColor: 'rgba(239, 68, 68, 0.9)', backgroundColor: 'rgba(239, 68, 68, 0.1)', type: 'line', fill: false, tension: 0.1, order: 1 },
      ],
    };
  }, [totalesIngresos]);

  const benfordEgresosData = useMemo(() => {
    const monthlyTotals = totalesEgresos.mensuales.map(m => m.totalMes).filter(v => v && typeof v ==='number' && v !== 0);
    const observed = calculateBenfordDistribution(monthlyTotals);
    return {
      labels: BENFORD_LABELS,
      datasets: [
        { label: 'Observado (%)', data: BENFORD_LABELS.map(d => observed[d] || 0), backgroundColor: 'rgba(59, 130, 246, 0.7)', order: 2 },
        { label: 'Esperado Benford (%)', data: BENFORD_EXPECTED_DISTRIBUTION, borderColor: 'rgba(239, 68, 68, 0.9)', backgroundColor: 'rgba(239, 68, 68, 0.1)', type: 'line', fill: false, tension: 0.1, order: 1 },
      ],
    };
  }, [totalesEgresos]);

  const topProductosVendidosChartData: ChartData = useMemo(() => ({
    labels: ['Prod A (Ejemplo)', 'Prod B (Ejemplo)', 'Prod C (Ejemplo)'],
    datasets: [{ label: 'Monto Vendido', data: [12000, 9500, 7000], backgroundColor: 'rgba(34, 197, 94, 0.7)' }],
  }), []);
  
  const topProductosCompradosChartData: ChartData = useMemo(() => ({
    labels: ['Mat X (Ejemplo)', 'Serv Y (Ejemplo)', 'Comp Z (Ejemplo)'],
    datasets: [{ label: 'Monto Comprado', data: [15000, 11000, 6500], backgroundColor: 'rgba(251, 191, 36, 0.7)' }],
  }), []);

  const formaPagoChartData = useMemo(() => {
    const labels = Object.keys(kpiFormaPagoData).map(key => FORMA_PAGO_DESCRIPCIONES[key] || `Otro (${key})`);
    const data = Object.values(kpiFormaPagoData).map(item => item.total);
    const backgroundColors = [
        'rgba(25,135,84,0.7)', 'rgba(13,110,253,0.7)', 'rgba(255,193,7,0.7)',
        'rgba(108,117,125,0.7)', 'rgba(220,53,69,0.7)', 'rgba(0,200,200,0.7)' 
    ]; 

    if (labels.length === 0) {
        return {
            labels: ['01 Efectivo (Ej.)', '03 Transferencia (Ej.)', '04 T. Crédito (Ej.)', 'Otros (Ej.)'],
            datasets: [{
                label: 'Monto Total por Forma de Pago',
                data: [5000, 25000, 8000, 3000],
                backgroundColor: backgroundColors
            }]
        };
    }

    return {
        labels,
        datasets: [{
            label: 'Monto Total por Forma de Pago',
            data,
            backgroundColor: labels.map((_, i) => backgroundColors[i % backgroundColors.length])
        }]
    };
  }, [kpiFormaPagoData]);

  const impuestosDelMesChartData: ChartData = useMemo(() => {
    const dataIVA = cedulaIvaCalculada.mensuales[selectedSummaryMonthIndex]?.IVACargo || 0;
    const dataISR = cedulaIsrCalculada.mensuales[selectedSummaryMonthIndex]?.PagoProvisionalCalcEst || 0;
    const dataResico = resicoPfCalculado.mensuales[selectedSummaryMonthIndex]?.isrMensualPagar || 0;
    const esResicoConIngresos = (resicoPfCalculado.mensuales[selectedSummaryMonthIndex]?.ingresosMes || 0) > 0;

    const labels = ['IVA a Cargo (Est.)', 'ISR Prov. (Act. Emp.)'];
    const dataValues = [dataIVA, dataISR];
    const chartBackgroundColors = ['rgba(239, 68, 68, 0.7)', 'rgba(251, 191, 36, 0.7)'];

    if (esResicoConIngresos && dataResico > 0) {
        labels.push('ISR RESICO PF');
        dataValues.push(dataResico);
        chartBackgroundColors.push('rgba(75, 192, 192, 0.7)');
    }

    return {
        labels,
        datasets: [{
            label: `Impuestos de ${MESES_COMPLETOS[selectedSummaryMonthIndex]}`,
            data: dataValues,
            backgroundColor: chartBackgroundColors,
        }],
    };
  }, [selectedSummaryMonthIndex, cedulaIvaCalculada, cedulaIsrCalculada, resicoPfCalculado]);


  const handleConfigFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const rfcFromForm = currentConfig.rfc.toUpperCase().trim();
    if (!rfcFromForm) {
      alert("El campo RFC no puede estar vacío en la configuración.");
      showSavingFlash(false, 'RFC vacío en config.');
      return;
    }
    if (!rfcValidation?.valid && !rfcFromForm.startsWith("TEMP_NEW_RFC_")){ // Allow saving temp RFCs
      alert("El RFC no parece tener un formato válido o el dígito verificador es incorrecto (según cálculo local). Verifique antes de guardar.");
      showSavingFlash(false, 'RFC inválido o con errores de formato.');
      return;
    }
    
    const newConfigToSave: AppConfig = {...currentConfig, rfc: rfcFromForm };
    setCurrentConfig(newConfigToSave); 

    try {
        await onAppConfigChange(newConfigToSave, rfcFromForm); 
        showSavingFlash(true, `Configuración guardada para RFC ${rfcFromForm}`);
        updateLastSavedTimeDisplay(rfcFromForm); 
    } catch (error) {
        showSavingFlash(false, 'Error al guardar configuración.');
        console.error(`Error saving appConfig via onAppConfigChange for RFC ${rfcFromForm}:`, error);
    }
  };

  const handleResetData = async () => {
    if (!activeRfc || activeRfc.startsWith("TEMP_NEW_RFC_")) {
        showSavingFlash(false, 'Error: No hay un RFC activo válido para restablecer.');
        console.error("handleResetData: activeRfc no disponible o es temporal.");
        return;
    }
    if (window.confirm(`¿Está seguro de que desea borrar TODOS los datos fiscales y la configuración en la nube para el RFC ${activeRfc}? Esta acción no se puede deshacer.`)) {
      setIsLoadingOverlay(true);
      try {
        const resetData = await resetTaxpayerFirestoreData(activeRfc);
        
        setIngresosData(resetData.ingresosData.map(item => ({...item})));
        setEgresosData(resetData.egresosData.map(item => ({...item})));
        setResicoPfData(resetData.resicoPfData.map(item => ({...item})));
        setCurrentConfig({...resetData.appConfig}); 
        
        await onAppConfigChange(resetData.appConfig, activeRfc);
        
        setXmlEmitidosFiles(null);
        setXmlRecibidosFiles(null);
        setXmlProcessingStatus('');
        setTopClientesData([]);
        setTopProveedoresData([]);
        setKpiFormaPagoData({});

        showSavingFlash(true, `Datos para ${activeRfc} restablecidos en la nube.`);
        updateLastSavedTimeDisplay(activeRfc);
      } catch (e) {
        console.error("Error durante el reseteo en Firestore:", e);
        showSavingFlash(false, 'Error al restablecer en nube');
      } finally {
        setIsLoadingOverlay(false);
      }
    }
  };

  const handleExportToPdf = () => {
    setIsLoadingOverlay(true);
    try {
        if (typeof jsPDF === 'undefined' || typeof (jsPDF as any).API.autoTable === 'undefined') {
            throw new Error("jsPDF o jsPDF-AutoTable no cargó.");
        }
        const doc = new (jsPDF as any)();
        const ejercicio = currentConfig.ejercicioFiscal || 'N/A';
        const empresa = currentConfig.nombreEmpresa || 'Empresa';
        const rfc = currentConfig.rfc || 'N/A';

        doc.setFontSize(16);
        doc.text(`Reporte Fiscal ${ejercicio} - ${empresa} (${rfc})`, 14, 20);
        doc.setFontSize(10);
        doc.text(`Generado: ${new Date().toLocaleString('es-MX')}`, 14, 26);
        let currentY = 35;

        const addTableToPdf = (title: string, tableId: string, startY: number): number => {
            const tableElement = document.getElementById(tableId);
            if (!tableElement) return startY;
            doc.setFontSize(12);
            doc.text(title, 14, startY);
            doc.autoTable({
                html: `#${tableId}`,
                startY: startY + 5,
                theme: 'grid',
                headStyles: { fillColor: [41, 128, 185], textColor: 255, fontStyle: 'bold' },
                footStyles: { fillColor: [220, 220, 220], textColor: 0, fontStyle: 'bold' },
                styles: { fontSize: 7, cellPadding: 1.5, overflow: 'linebreak' },
                columnStyles: { 0: { fontStyle: 'bold', cellWidth: 'auto' } },
                didParseCell: function(data: any) { 
                    if ((data.cell.section === 'body' || data.cell.section === 'foot') && data.cell.text) {
                        data.cell.text = data.cell.text.map((text: string) => 
                            String(text).replace(/[$,]/g, '').trim()
                        );
                    }
                }
            });
            const finalY = (doc as any).lastAutoTable ? (doc as any).lastAutoTable.finalY + 10 : startY + 20;
            return finalY > doc.internal.pageSize.height - 20 ? (doc.addPage(), 20) : finalY;
        };
        
        currentY = addTableToPdf('Resumen Anual (Declaración Estimada)', 'table-declaracion-anual', currentY);
        currentY = addTableToPdf('Cédula ISR (Pagos Provisionales Estimados)', 'table-cedula-isr', currentY);
        currentY = addTableToPdf('Cédula ISR RESICO Personas Físicas', 'table-resico-pf', currentY);
        currentY = addTableToPdf('Cédula IVA', 'table-cedula-iva', currentY);
        currentY = addTableToPdf('Detalle Ingresos Mensuales', 'table-ingresos', currentY);
        currentY = addTableToPdf('Detalle Egresos Mensuales', 'table-egresos', currentY);

        doc.save(`Reporte_Fiscal_${empresa.replace(/\s+/g, '_')}_${rfc}_${ejercicio}.pdf`);
    } catch (e: any) {
        console.error("Error al generar PDF:", e);
        alert(`Error al generar PDF: ${e.message}. Asegúrese de que las tablas existan en el DOM.`);
    } finally {
        setIsLoadingOverlay(false);
    }
  };

  const handleExportToExcel = () => {
    setIsLoadingOverlay(true);
    try {
        if (typeof XLSX === 'undefined') throw new Error("SheetJS (XLSX) no cargó.");
        const workbook = XLSX.utils.book_new();
        const ejercicio = currentConfig.ejercicioFiscal || 'N/A';
        const empresa = currentConfig.nombreEmpresa || 'Empresa';
        const rfc = currentConfig.rfc || 'N/A';


        const addSheetFromTable = (sheetName: string, tableId: string) => {
            const tableElement = document.getElementById(tableId) as HTMLTableElement;
            if (tableElement) {
                const worksheet = XLSX.utils.table_to_sheet(tableElement);
                Object.keys(worksheet).forEach(cellAddress => {
                    const cell = worksheet[cellAddress];
                    if (cellAddress.startsWith('!') || !cell || typeof cell.v === 'undefined') return;
                    if (typeof cell.v === 'string' && (cell.v.includes('$') || cell.v.includes(','))) {
                        const numericValue = parseFloat(cell.v.replace(/[^0-9.-]+/g, ''));
                        if (!isNaN(numericValue)) {
                            cell.t = 'n'; cell.z = '$#,##0.00'; cell.v = numericValue;
                        } else { cell.t = 's';}
                    } else if (typeof cell.v === 'number') { cell.t = 'n';
                    } else if (typeof cell.v === 'boolean') { cell.t = 'b';
                    } else { cell.t = 's'; }
                });
                XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
            } else {
                console.warn(`Tabla no encontrada para Excel: ${tableId}`);
            }
        };

        addSheetFromTable('Declaracion Anual Est', 'table-declaracion-anual');
        addSheetFromTable('Cedula ISR Prov', 'table-cedula-isr');
        addSheetFromTable('Cedula ISR RESICO PF', 'table-resico-pf');
        addSheetFromTable('Cedula IVA', 'table-cedula-iva');
        addSheetFromTable('Ingresos', 'table-ingresos');
        addSheetFromTable('Egresos', 'table-egresos');

        const configDataSheet = [
            ["Configuración", "Valor"],
            ["Empresa", empresa],
            ["RFC", rfc],
            ["Tasa IVA (%)", currentConfig.tasaIVA],
            ["Ejercicio Fiscal", ejercicio]
        ];
        const wsConfig = XLSX.utils.aoa_to_sheet(configDataSheet);
        XLSX.utils.book_append_sheet(workbook, wsConfig, "Configuracion");

        XLSX.writeFile(workbook, `Reporte_Fiscal_${empresa.replace(/\s+/g, '_')}_${rfc}_${ejercicio}.xlsx`);
    } catch (e: any) {
        console.error("Error al generar Excel:", e);
        alert(`Error al generar Excel: ${e.message}. Asegúrese de que las tablas existan en el DOM.`);
    } finally {
        setIsLoadingOverlay(false);
    }
  };
  
  const handleProcessXml = async () => {
    if (!xmlEmitidosFiles && !xmlRecibidosFiles) {
        alert('Por favor, seleccione al menos un archivo XML para procesar.');
        setXmlProcessingStatus('No se seleccionaron archivos.');
        return;
    }
    setXmlProcessingStatus('Procesando XMLs...');
    setIsLoadingOverlay(true);

    const localTopClientes: { [rfc: string]: number } = {};
    const localTopProveedores: { [rfc: string]: number } = {};
    const localKpiFormaPago: KpiFormaPago = {};

    const processFile = (file: File, type: 'Emitido' | 'Recibido'): Promise<XmlSummaryItem | null> => {
        return new Promise((resolve) => {
            if (!file.name.toLowerCase().endsWith('.xml')) {
                resolve(null); return;
            }
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const content = e.target?.result as string;
                    const parser = new DOMParser();
                    const xmlDoc = parser.parseFromString(content, 'text/xml');
                    const parserError = xmlDoc.getElementsByTagName("parsererror");
                    if (parserError.length > 0) {
                        console.warn(`Error parseando XML ${file.name}:`, parserError[0].textContent);
                        resolve(null); return;
                    }
                    const comprobanteNode = xmlDoc.getElementsByTagName('cfdi:Comprobante')[0];
                    if (!comprobanteNode) { 
                         console.warn(`Nodo cfdi:Comprobante no encontrado en ${file.name}`);
                         resolve(null); return; 
                    }
                    const total = parseFloat(comprobanteNode.getAttribute('Total') || "0");
                    const formaPago = comprobanteNode.getAttribute('FormaPago') || "99";
                    const timbreNode = xmlDoc.getElementsByTagName('tfd:TimbreFiscalDigital')[0] ||
                                       comprobanteNode.querySelector('Complemento > tfd\\:TimbreFiscalDigital') ||
                                       comprobanteNode.querySelector('complemento > tfd\\:TimbreFiscalDigital'); 
                    const uuid = timbreNode?.getAttribute('UUID') || 'SIN UUID';
                    
                    localKpiFormaPago[formaPago] = localKpiFormaPago[formaPago] || { total: 0, count: 0 };
                    localKpiFormaPago[formaPago].total += total;
                    localKpiFormaPago[formaPago].count += 1;

                    if (type === 'Emitido') {
                        const receptorNode = comprobanteNode.getElementsByTagName('cfdi:Receptor')[0];
                        const rfcCliente = receptorNode?.getAttribute('Rfc') || "XAXX010101000";
                        localTopClientes[rfcCliente] = (localTopClientes[rfcCliente] || 0) + total;
                    } else { 
                        const emisorNode = comprobanteNode.getElementsByTagName('cfdi:Emisor')[0];
                        const rfcProveedor = emisorNode?.getAttribute('Rfc') || "XAXX010101000";
                        localTopProveedores[rfcProveedor] = (localTopProveedores[rfcProveedor] || 0) + total;
                    }
                    resolve({ tipo: type, uuid, total, formaPago, nombreArchivo: file.name });
                } catch (err) { 
                    console.error(`Excepción procesando XML ${file.name}:`, err);
                    resolve(null); 
                }
            };
            reader.onerror = () => { 
                console.error(`Error leyendo archivo ${file.name}`);
                resolve(null); 
            };
            reader.readAsText(file);
        });
    };

    const promises: Promise<XmlSummaryItem | null>[] = [];
    if (xmlEmitidosFiles) { for (let i = 0; i < xmlEmitidosFiles.length; i++) { promises.push(processFile(xmlEmitidosFiles[i], 'Emitido')); } }
    if (xmlRecibidosFiles) { for (let i = 0; i < xmlRecibidosFiles.length; i++) { promises.push(processFile(xmlRecibidosFiles[i], 'Recibido')); } }

    const results = await Promise.allSettled(promises);
    const archivosProcesadosConExito = results.filter(r => r.status === 'fulfilled' && r.value !== null).length;
    const archivosConError = results.length - archivosProcesadosConExito;

    setXmlProcessingStatus(`Proceso completado. ${archivosProcesadosConExito} XMLs procesados.${archivosConError > 0 ? ` ${archivosConError} con errores.` : ''}`);
    setTopClientesData(Object.entries(localTopClientes).sort((a,b) => b[1]-a[1]).slice(0,10).map(([rfc, total]) => ({rfc, total})));
    setTopProveedoresData(Object.entries(localTopProveedores).sort((a,b) => b[1]-a[1]).slice(0,10).map(([rfc, total]) => ({rfc, total})));
    setKpiFormaPagoData(localKpiFormaPago);
    setIsLoadingOverlay(false);
  };

  const handleEFirmaFileChange = (e: React.ChangeEvent<HTMLInputElement>, fileType: 'cer' | 'key') => {
    const file = e.target.files?.[0] || null;
    setEFirmaConfig(prev => ({ ...prev, [`${fileType}File`]: file }));
  };

  const handleEFirmaPasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEFirmaConfig(prev => ({ ...prev, password: e.target.value }));
  };

  const handleSaveEFirmaConfig = async () => {
    if (!eFirmaConfig.cerFile || !eFirmaConfig.keyFile || !eFirmaConfig.password) {
      setSatDownloadInfo({ status: 'error', lastAttempt: new Date().toISOString(), message: "Error: Faltan archivos .cer, .key o contraseña." });
      return;
    }
    if (!activeRfc || activeRfc.startsWith("TEMP_NEW_RFC_")) {
      setSatDownloadInfo({ status: 'error', lastAttempt: new Date().toISOString(), message: "Error: RFC activo no válido." });
      return;
    }

    setSatDownloadInfo({ status: 'pending', lastAttempt: new Date().toISOString(), message: 'Guardando configuración e.firma...' });
    setIsLoadingOverlay(true);
    try {
      const response: ApiResponse = await subirEFirma(activeRfc, eFirmaConfig.cerFile, eFirmaConfig.keyFile, eFirmaConfig.password);
      if (response.success) {
        setSatDownloadInfo({ status: 'success', lastAttempt: new Date().toISOString(), message: response.message || 'Configuración e.firma guardada exitosamente en backend.' });
      } else {
        setSatDownloadInfo({ status: 'error', lastAttempt: new Date().toISOString(), message: `Error al guardar e.firma: ${response.message}` });
      }
    } catch (error: any) {
      setSatDownloadInfo({ status: 'error', lastAttempt: new Date().toISOString(), message: `Error de red o servidor: ${error.message}` });
    } finally {
      setIsLoadingOverlay(false);
    }
  };

  const handleInitiateSatDownload = async () => {
    if (!activeRfc || activeRfc.startsWith("TEMP_NEW_RFC_")) {
      setSatDownloadInfo({ status: 'error', lastAttempt: new Date().toISOString(), message: "Error: RFC activo no válido para iniciar descarga." });
      return;
    }
    if (!satDownloadFechaInicio || !satDownloadFechaFin) {
        setSatDownloadInfo({ status: 'error', lastAttempt: new Date().toISOString(), message: "Error: Seleccione fecha de inicio y fin para la descarga." });
        return;
    }
    if (new Date(satDownloadFechaFin) < new Date(satDownloadFechaInicio)) {
        setSatDownloadInfo({ status: 'error', lastAttempt: new Date().toISOString(), message: "Error: La fecha de fin no puede ser anterior a la fecha de inicio." });
        return;
    }

    setSatDownloadInfo({ status: 'pending', lastAttempt: new Date().toISOString(), message: 'Iniciando solicitud de descarga...' });
    setCurrentSolicitudId(null);
    setIsLoadingOverlay(true);
    try {
      const response: ApiResponse = await descargarCFDI({
        rfc: activeRfc,
        fechaInicio: satDownloadFechaInicio,
        fechaFin: satDownloadFechaFin,
        tipoDescarga: satDownloadTipo
      });
      if (response.success && response.solicitudId) {
        setSatDownloadInfo({ status: 'pending', lastAttempt: new Date().toISOString(), message: `Solicitud de descarga enviada. ID: ${response.solicitudId}. Verificando estado...` });
        setCurrentSolicitudId(response.solicitudId);
        setTimeout(() => handleCheckDownloadStatus(response.solicitudId as string), 3000);
      } else {
        setSatDownloadInfo({ status: 'error', lastAttempt: new Date().toISOString(), message: `Error al iniciar descarga: ${response.message || 'Error desconocido del backend.'}` });
      }
    } catch (error: any) {
      setSatDownloadInfo({ status: 'error', lastAttempt: new Date().toISOString(), message: `Error de red o servidor: ${error.message}` });
    } finally {
      setIsLoadingOverlay(false);
    }
  };
  
  const handleCheckDownloadStatus = async (solicitudIdToCheck?: string) => {
    const idToCheck = solicitudIdToCheck || currentSolicitudId;
    if (!idToCheck) {
        setSatDownloadInfo(prev => ({ ...prev, status: 'error', message: "No hay ID de solicitud para verificar."}));
        return;
    }
    setSatDownloadInfo(prev => ({ ...prev, status: 'pending', message: `Verificando estado de solicitud ${idToCheck}...` }));
    setIsLoadingOverlay(true);
    try {
        const response: ApiEstadoSolicitudResponse = await estadoSolicitud(idToCheck);
        setSatDownloadInfo({
            status: response.status || 'error', 
            lastAttempt: new Date().toISOString(),
            message: `${response.message} (ID: ${idToCheck}) ${response.packageIds ? ` Paquetes listos: ${response.packageIds.join(', ')}` : ''}`
        });
    } catch (error: any) {
        setSatDownloadInfo({ status: 'error', lastAttempt: new Date().toISOString(), message: `Error verificando estado: ${error.message}` });
    } finally {
      setIsLoadingOverlay(false);
    }
  };

   const handleNavigateToXmlToolsFromHistory = () => {
    setActiveTab('xml-tools');
  };
  
  const handleAiConsult = async () => {
    if (!aiPrompt.trim()) {
      setAiResponse("Por favor, ingrese una pregunta para el asistente de IA.");
      return;
    }
    setIsAiLoading(true);
    setAiResponse(null);
    if (!ai) {
        setAiResponse("El servicio de IA no está disponible en este momento (API Key no configurada).");
        setIsAiLoading(false);
        return;
    }
    try {
      const response: GenerateContentResponse = await ai.models.generateContent({
        model: 'gemini-2.5-flash-preview-04-17',
        contents: aiPrompt,
        config: { systemInstruction: "Eres un asistente fiscal experto en México. Proporciona respuestas claras y concisas."}
      });
      setAiResponse(response.text);
    } catch (error: any) {
      console.error("Error con API de Gemini:", error);
      setAiResponse(`Hubo un error al contactar al asistente de IA: ${error.message || 'Error desconocido.'}`);
    } finally {
      setIsAiLoading(false);
    }
  };

  const getAiAlertAdvice = async (alertId: string, userPrompt: string) => {
    if (!ai) {
      setFiscalAlerts(prevAlerts =>
        prevAlerts.map(alert =>
          alert.id === alertId ? { ...alert, aiAdvice: "El servicio de IA no está disponible (sin API Key).", isAiAdviceLoading: false } : alert
        )
      );
      return;
    }

    setFiscalAlerts(prevAlerts =>
      prevAlerts.map(alert =>
        alert.id === alertId ? { ...alert, isAiAdviceLoading: true, aiAdvice: null } : alert
      )
    );

    try {
      const response: GenerateContentResponse = await ai.models.generateContent({
        model: 'gemini-2.5-flash-preview-04-17',
        contents: userPrompt,
        config: { systemInstruction: GEMINI_SYSTEM_INSTRUCTION_ALERTS }
      });
      setFiscalAlerts(prevAlerts =>
        prevAlerts.map(alert =>
          alert.id === alertId ? { ...alert, aiAdvice: response.text, isAiAdviceLoading: false } : alert
        )
      );
    } catch (error: any) {
      console.error("Error con API de Gemini para alerta:", error);
      setFiscalAlerts(prevAlerts =>
        prevAlerts.map(alert =>
          alert.id === alertId ? { ...alert, aiAdvice: `Error al obtener consejo de IA: ${error.message || 'Error desconocido.'}`, isAiAdviceLoading: false } : alert
        )
      );
    }
  };

  const generateFiscalAlerts = useCallback(() => {
    const newAlerts: FiscalAlertItem[] = [];
    const ejercicio = currentConfig.ejercicioFiscal;

    if (summaryData.ingresos > 0 && summaryData.utilidad < 0) {
      newAlerts.push({
        id: 'PERDIDA_FISCAL', code: 'PERDIDA_FISCAL', type: 'warning',
        title: 'Pérdida Fiscal Estimada',
        message: `Se estima una pérdida fiscal de ${formatCurrency(Math.abs(summaryData.utilidad))} para el ejercicio ${ejercicio}. Revise sus deducciones y estrategias.`,
        aiPromptContent: `El contribuyente tiene ingresos de ${formatCurrency(summaryData.ingresos)} y una pérdida fiscal estimada de ${formatCurrency(Math.abs(summaryData.utilidad))} para el ejercicio ${ejercicio}. ¿Qué áreas generales debería revisar para entender y potencialmente mitigar esta pérdida fiscal en el futuro, considerando la legislación fiscal mexicana? Proporciona 2-3 sugerencias concisas.`
      });
    }

    if (totalesIngresos.totalAnualIngresosGeneral === 0 && totalesEgresos.totalAnualEgresosGeneral === 0 && ejercicio === new Date().getFullYear() && !activeRfc.startsWith("TEMP_NEW_RFC_")) {
      newAlerts.push({
        id: 'SIN_DATOS', code: 'SIN_DATOS', type: 'warning',
        title: 'Sin Datos Registrados',
        message: `No hay ingresos ni egresos registrados para el ejercicio fiscal actual (${ejercicio}). Esto podría tener implicaciones fiscales.`,
        aiPromptContent: `El contribuyente (RFC: ${activeRfc}) no tiene ingresos ni egresos registrados para el ejercicio fiscal actual (${ejercicio}). ¿Qué implicaciones fiscales podría tener esto y qué acciones inmediatas debería considerar? Proporciona 2-3 puntos clave.`
      });
    }
    
    if (resicoPfCalculado.totales.totalIngresosAnual > 3500000) {
        newAlerts.push({
            id: 'RESICO_LIMITE_EXCEDIDO', code: 'RESICO_LIMITE_EXCEDIDO', type: 'error',
            title: 'Límite de Ingresos RESICO PF Excedido',
            message: `Sus ingresos anuales en RESICO PF (${formatCurrency(resicoPfCalculado.totales.totalIngresosAnual)}) superan el límite de $3,500,000. Debe cambiar de régimen fiscal.`,
            aiPromptContent: `Un contribuyente en RESICO PF (RFC: ${activeRfc}) ha superado el límite de ingresos anuales de $3,500,000 MXN, alcanzando ${formatCurrency(resicoPfCalculado.totales.totalIngresosAnual)} en ${ejercicio}. ¿Cuáles son las consecuencias fiscales principales y qué régimen fiscal alternativo debería considerar explorar según la normativa mexicana? Menciona 2-3 aspectos importantes.`
        });
    }

    const benfordIngresosObserved = calculateBenfordDistribution(totalesIngresos.mensuales.map(m => m.totalMes));
    let benfordIngresosDeviation = false;
    BENFORD_LABELS.forEach((digit, index) => {
        if (Math.abs((benfordIngresosObserved[digit] || 0) - BENFORD_EXPECTED_DISTRIBUTION[index]) > 15) {
            benfordIngresosDeviation = true;
        }
    });
    if (benfordIngresosDeviation) {
        newAlerts.push({
            id: 'BENFORD_INGRESOS', code: 'BENFORD_INGRESOS', type: 'info',
            title: 'Posible Desviación Ley de Benford (Ingresos)',
            message: `Se observan desviaciones en la distribución de los primeros dígitos de sus ingresos mensuales respecto a la Ley de Benford. Considere una revisión interna.`,
            aiPromptContent: `Se ha detectado una desviación notable en la distribución de los primeros dígitos de los montos de ingresos mensuales del contribuyente (RFC: ${activeRfc}) en comparación con la Ley de Benford para el ejercicio ${ejercicio}. Esto podría ser normal o indicar inconsistencias. ¿Qué tipo de revisión interna de registros y procesos de facturación sería recomendable en este caso? Ofrece 2-3 sugerencias generales.`
        });
    }
    
    if (cedulaIvaCalculada.totales.totalIvaCobrado > 0 && (cedulaIvaCalculada.totales.totalIvaCargo / cedulaIvaCalculada.totales.totalIvaCobrado) > 0.6) { 
      newAlerts.push({
        id: 'IVA_CARGO_ALTO', code: 'IVA_CARGO_ALTO', type: 'info',
        title: 'IVA a Cargo Proporcionalmente Alto',
        message: `Su IVA a Cargo anual (${formatCurrency(cedulaIvaCalculada.totales.totalIvaCargo)}) es significativamente alto en proporción a su IVA Cobrado (${formatCurrency(cedulaIvaCalculada.totales.totalIvaCobrado)}). Podría haber oportunidad de optimizar su IVA acreditable.`,
        aiPromptContent: `El contribuyente (RFC: ${activeRfc}) muestra un IVA a cargo anual de ${formatCurrency(cedulaIvaCalculada.totales.totalIvaCargo)} frente a un IVA cobrado de ${formatCurrency(cedulaIvaCalculada.totales.totalIvaCobrado)} en el ejercicio ${ejercicio}, sugiriendo un IVA acreditable relativamente bajo. ¿Qué estrategias generales podría explorar para optimizar el IVA acreditable, como la revisión de gastos deducibles y la correcta aplicación de la tasa de IVA en sus compras? Brinda 2-3 consejos.`
      });
    }

    if (newAlerts.length === 0 && !activeRfc.startsWith("TEMP_NEW_RFC_")) {
      newAlerts.push({
        id: 'TODO_OK', code: 'TODO_OK', type: 'success',
        title: 'Todo Parece en Orden',
        message: 'Con la información actual, no se detectan alertas críticas. ¡Buen trabajo!',
        aiPromptContent: `Proporciona 3 consejos generales y breves para mantener una buena salud fiscal durante el ejercicio ${ejercicio} para un contribuyente en México (persona física con actividad empresarial o RESICO PF). Enfócate en buenas prácticas y cumplimiento.`
      });
    }
    setFiscalAlerts(newAlerts.map(a => ({...a, aiAdvice: null, isAiAdviceLoading: false, isExpanded: false })));
  }, [currentConfig, summaryData, totalesIngresos, totalesEgresos, resicoPfCalculado, cedulaIvaCalculada, activeRfc]);

  useEffect(() => {
    if (!isLoadingOverlay) { 
        generateFiscalAlerts();
    }
  }, [summaryData, resicoPfCalculado, cedulaIvaCalculada, isLoadingOverlay, generateFiscalAlerts]); 
  
  const toggleAlertExpansion = (alertId: string) => {
    setFiscalAlerts(prevAlerts =>
      prevAlerts.map(alert =>
        alert.id === alertId ? { ...alert, isExpanded: !alert.isExpanded } : alert
      )
    );
  };

  const handleFetchEducationTopic = async (topic: string) => {
    if (!ai) {
      setEducationContent("El servicio de IA no está disponible (API Key no configurada).");
      return;
    }
    setSelectedTopic(topic);
    setIsEducationLoading(true);
    setEducationContent(null);
    try {
      // const prompt = `${GEMINI_SYSTEM_INSTRUCTION_EDUCACION}\n\nTema: ${topic}`; // Original prompt
      const response: GenerateContentResponse = await ai.models.generateContent({ // Using direct call as per new guidelines
        model: 'gemini-2.5-flash-preview-04-17',
        contents: topic, // Simplified prompt, relying on system instruction
        config: { systemInstruction: GEMINI_SYSTEM_INSTRUCTION_EDUCACION }
      });
      setEducationContent(response.text);
    } catch (error: any) {
      console.error("Error con API de Gemini para Educación Fiscal:", error);
      setEducationContent(`Hubo un error al obtener información sobre "${topic}": ${error.message || 'Error desconocido.'}`);
    } finally {
      setIsEducationLoading(false);
    }
  };

  const handleFetchDiscrepanciaAdvice = async () => {
    if (!ai) {
      setDiscrepanciaAiAdvice("El servicio de IA no está disponible (API Key no configurada).");
      return;
    }
    setIsDiscrepanciaAiLoading(true);
    setDiscrepanciaAiAdvice(null);
    try {
      const prompt = GEMINI_SYSTEM_INSTRUCTION_DISCREPANCIA
        .replace("[INGRESOS]", formatCurrency(summaryData.ingresos))
        .replace("[GASTOS]", formatCurrency(summaryData.egresos));
      
      const response: GenerateContentResponse = await ai.models.generateContent({
        model: 'gemini-2.5-flash-preview-04-17',
        contents: prompt 
      });
      setDiscrepanciaAiAdvice(response.text);
    } catch (error: any) {
      console.error("Error con API de Gemini para Discrepancia Fiscal:", error);
      setDiscrepanciaAiAdvice(`Hubo un error al obtener consejo sobre discrepancia: ${error.message || 'Error desconocido.'}`);
    } finally {
      setIsDiscrepanciaAiLoading(false);
    }
  };
  
  // RFC Validation Logic (basic client-side)
  const validateRFC = (rfc: string): { valid: boolean; message: string } => {
    rfc = rfc.toUpperCase().trim();
    const rfcPatternPM = /^[A-Z&Ñ]{3}\d{2}(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])[A-Z\d]{3}$/; // Persona Moral
    const rfcPatternPF = /^[A-Z&Ñ]{4}\d{2}(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])[A-Z\d]{3}$/; // Persona Física

    if (!rfcPatternPM.test(rfc) && !rfcPatternPF.test(rfc)) {
      return { valid: false, message: 'Formato de RFC inválido.' };
    }

    const validChars = "0123456789ABCDEFGHIJKLMN&OPQRSTUVWXYZ Ñ";
    const rfcDigits = rfc.substring(0, rfc.length - 1);
    const expectedCheckDigit = rfc.charAt(rfc.length - 1);
    
    let sum = rfc.length === 12 ? 481 : 0; 
    const factorsInitialIndex = rfc.length === 12 ? 1 : 0; 
    const factors = [13,12,11,10,9,8,7,6,5,4,3,2]; 
    
    let localSum = 0;
    for (let i = 0; i < rfcDigits.length; i++) {
        localSum += validChars.indexOf(rfcDigits[i]) * factors[factorsInitialIndex + i];
    }
    sum += localSum;

    let remainder = sum % 11;
    let calculatedCheckDigit = remainder === 0 ? "0" : (11 - remainder === 10 ? "A" : (11 - remainder).toString());
    
    // SAT uses 'A' for 10 on check digit, not common for others like CURP.
    // If calculated is 10 (represented by A) it's A. If 0 it's 0. Else it's 11-remainder.
    // However, the rule is 11-rem. If 11-rem = 10 -> "A". If 11-rem = 11 (rem=0) -> "0".
    // The previous logic seems slightly off. Standard is:
    let satCalculatedCheckDigit;
    const mod11 = sum % 11;
    if (mod11 === 0) {
        satCalculatedCheckDigit = "0";
    } else {
        const diff = 11 - mod11;
        if (diff === 10) {
            satCalculatedCheckDigit = "A";
        } else {
            satCalculatedCheckDigit = diff.toString();
        }
    }
    calculatedCheckDigit = satCalculatedCheckDigit;


    if (calculatedCheckDigit !== expectedCheckDigit) {
      return { valid: false, message: `Dígito verificador incorrecto (Calculado: ${calculatedCheckDigit}, Esperado: ${expectedCheckDigit}).` };
    }

    return { valid: true, message: 'RFC con formato y dígito verificador válidos (cálculo local).' };
  };

  const handleRfcInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newRfc = e.target.value.toUpperCase();
    setCurrentConfig({...currentConfig, rfc: newRfc});
    if (newRfc.length >= 12 && newRfc.length <= 13) {
      setRfcValidation(validateRFC(newRfc));
    } else {
      setRfcValidation(null);
    }
  };

  const fiscalAssistantSummary = useMemo(() => {
      const data: any = {
        rfc: activeRfc,
        nombreEmpresa: currentConfig.nombreEmpresa,
        ejercicioFiscal: currentConfig.ejercicioFiscal,
        ingresosAnuales: summaryData.ingresos,
        egresosAnuales: summaryData.egresos,
        utilidadBrutaAnual: summaryData.utilidad,
        isrEstimadoAnualActEmp: declaracionAnualData.isrNeto,
        ivaEstimadoCargoAnual: reportesAnualesData.ivaCargoAnual,
      };
      if (resicoPfCalculado.totales.totalIngresosAnual > 0) {
        data.ingresosAnualesRESICOPF = resicoPfCalculado.totales.totalIngresosAnual;
        data.isrEstimadoAnualRESICOPF = resicoPfCalculado.totales.totalIsrPagarAnual;
      }
      return data;
  }, [activeRfc, currentConfig, summaryData, declaracionAnualData, reportesAnualesData, resicoPfCalculado]);


  // Planeación Fiscal Avanzada Logic
  const handleProjectionSettingChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setProjectionSettings(prev => ({ ...prev, [name]: parseFloat(value) || 0 }));
    setProjectedFiscalData(null); // Reset calculated data when settings change
    setProjectionAiAdvice(null); // Reset AI advice
  };

  const calculateProjectedFiscalData = () => {
    const baseYearData = { ...declaracionAnualData }; // ISR Actividad Empresarial
    const baseResicoData = { ...resicoPfCalculado.totales };
    const baseIvaData = { ...cedulaIvaCalculada.totales };
    const baseIngresos = totalesIngresos.totalAnualIngresosGeneral;
    const baseEgresos = totalesEgresos.totalAnualEgresosGeneral;

    const projectedIncome = baseIngresos * (1 + projectionSettings.incomeAdjustmentPercent / 100);
    const projectedExpenses = baseEgresos * (1 + projectionSettings.expenseAdjustmentPercent / 100);
    const projectedProfit = projectedIncome - projectedExpenses;

    // Projected ISR - Actividad Empresarial
    let projectedISR_ActEmp = 0;
    const tarifaAnual = TARIFAS_ISR_ACUMULADAS_POR_MES["DICIEMBRE"];
    if (tarifaAnual) {
        for (let j = tarifaAnual.length - 1; j >= 0; j--) {
            const tramo = tarifaAnual[j];
            if (projectedProfit >= tramo.LIM_INFERIOR) {
                const excedenteAnual = projectedProfit - tramo.LIM_INFERIOR;
                projectedISR_ActEmp = (excedenteAnual * (tramo.PORC_EXCED / 100)) + tramo.CUOTA_FIJA;
                break;
            }
        }
    }
    projectedISR_ActEmp = Math.max(0, projectedISR_ActEmp);
    // Simplified: assuming payments provisionales scale with ISR causado. For a real scenario, this would need monthly projection.
    const projectedPagosProv_ActEmp = (baseYearData.pagosProvisionales / (baseYearData.isrAnualCausado || 1)) * projectedISR_ActEmp;
    projectedISR_ActEmp = projectedISR_ActEmp - projectedPagosProv_ActEmp;


    // Projected ISR - RESICO PF (if applicable)
    let projectedISR_RESICOPF = 0;
    if (baseResicoData.totalIngresosAnual > 0) { // Check if RESICO was used in base year
        let tasaAplicableNum = 0.00;
        for (const tramo of TABLA_TASAS_RESICO_PF_SAT) {
            if (projectedIncome >= tramo.limiteInferior && projectedIncome <= tramo.limiteSuperior) {
                tasaAplicableNum = tramo.tasa;
                break;
            }
        }
        if (tasaAplicableNum === 0.00 && TABLA_TASAS_RESICO_PF_SAT.length > 1 && projectedIncome > TABLA_TASAS_RESICO_PF_SAT[TABLA_TASAS_RESICO_PF_SAT.length - 2].limiteSuperior) {
            tasaAplicableNum = TABLA_TASAS_RESICO_PF_SAT[TABLA_TASAS_RESICO_PF_SAT.length - 1].tasa;
        }
        const isrCalculadoProy = projectedIncome * tasaAplicableNum;
        // Assuming retenciones scale with income, very rough estimate
        const projectedRetencionResico = (baseResicoData.totalRetencionAnual / (baseResicoData.totalIngresosAnual || 1)) * projectedIncome;
        projectedISR_RESICOPF = Math.max(0, isrCalculadoProy - projectedRetencionResico);
    }
    
    // Projected IVA - Simplified, assumes IVA relationships scale directly
    const projectedIvaCobrado = baseIvaData.totalIvaCobrado * (1 + projectionSettings.incomeAdjustmentPercent / 100);
    const projectedIvaAcreditable = baseIvaData.totalIvaAcreditable * (1 + projectionSettings.expenseAdjustmentPercent / 100);
    const projectedIvaCausado = projectedIvaCobrado - projectedIvaAcreditable;
    // Assuming no saldo a favor anterior for simplicity in annual projection
    const projectedIVA_Cargo = Math.max(0, projectedIvaCausado);


    setProjectedFiscalData({
      baseYear: currentConfig.ejercicioFiscal,
      projectionYear: currentConfig.ejercicioFiscal + 1,
      projectedIncome,
      projectedExpenses,
      projectedProfit,
      projectedISR_ActEmp,
      projectedISR_RESICOPF,
      projectedIVA_Cargo
    });
  };
  
  const handleFetchProjectionAiAdvice = async () => {
    if (!projectedFiscalData || !ai) {
        setProjectionAiAdvice("Por favor, calcule primero los datos proyectados. El servicio de IA debe estar disponible.");
        return;
    }
    setIsProjectionAiLoading(true);
    setProjectionAiAdvice(null);

    const regimenPrincipal = resicoPfCalculado.totales.totalIngresosAnual > 0 ? "RESICO Personas Físicas" : "Actividad Empresarial y Profesional";
    const isrEstimadoRelevante = regimenPrincipal === "RESICO Personas Físicas" ? projectedFiscalData.projectedISR_RESICOPF : projectedFiscalData.projectedISR_ActEmp;

    const prompt = GEMINI_SYSTEM_INSTRUCTION_PLANEACION
        .replace("[INGRESOS_PROYECTADOS]", formatCurrency(projectedFiscalData.projectedIncome))
        .replace("[EGRESOS_PROYECTADOS]", formatCurrency(projectedFiscalData.projectedExpenses))
        .replace("[EJERCICIO_PROYECCION]", projectedFiscalData.projectionYear.toString())
        .replace("[UTILIDAD_PROYECTADA]", formatCurrency(projectedFiscalData.projectedProfit))
        .replace("[ISR_PROYECTADO]", formatCurrency(isrEstimadoRelevante))
        .replace("[REGIMEN_PRINCIPAL]", regimenPrincipal);

    try {
        const response: GenerateContentResponse = await ai.models.generateContent({
            model: 'gemini-2.5-flash-preview-04-17',
            contents: prompt,
        });
        setProjectionAiAdvice(response.text);
    } catch (error: any) {
        console.error("Error con API de Gemini para Planeación Fiscal:", error);
        setProjectionAiAdvice(`Hubo un error al obtener consejo de IA: ${error.message || 'Error desconocido.'}`);
    } finally {
        setIsProjectionAiLoading(false);
    }
  };

  const proyeccionComparativoChartData: ChartData = useMemo(() => {
    if (!projectedFiscalData) {
        return { labels: [], datasets: [] };
    }
    const currentYearProfit = declaracionAnualData.utilidadFiscal;
    const currentYearISR = declaracionAnualData.isrNeto; // Net ISR (after prov. payments)

    return {
        labels: ['Utilidad Fiscal Estimada', 'ISR Neto Anual Estimado'],
        datasets: [
            {
                label: `Actual (${projectedFiscalData.baseYear})`,
                data: [currentYearProfit, currentYearISR],
                backgroundColor: 'rgba(54, 162, 235, 0.6)', // Blue
                borderColor: 'rgba(54, 162, 235, 1)',
                borderWidth: 1
            },
            {
                label: `Proyectado (${projectedFiscalData.projectionYear})`,
                data: [
                    projectedFiscalData.projectedProfit, 
                    resicoPfCalculado.totales.totalIngresosAnual > 0 ? projectedFiscalData.projectedISR_RESICOPF : projectedFiscalData.projectedISR_ActEmp
                ],
                backgroundColor: 'rgba(75, 192, 192, 0.6)', // Green
                borderColor: 'rgba(75, 192, 192, 1)',
                borderWidth: 1
            }
        ]
    };
  }, [projectedFiscalData, declaracionAnualData, resicoPfCalculado]);


  const renderActiveTabContent = () => {
    const ingresosEgresosMessage = "Los valores se guardan en la nube al cambiar (edición manual). Los datos pueden ser actualizados desde XML por un proceso de backend.";

    switch (activeTab) {
      case 'resumen':
        const selectedMonthIngresosData = {
            ivaCargo: cedulaIvaCalculada.mensuales[selectedSummaryMonthIndex]?.IVACargo || 0,
            isrProvisional: cedulaIsrCalculada.mensuales[selectedSummaryMonthIndex]?.PagoProvisionalCalcEst || 0,
            isrResico: resicoPfCalculado.mensuales[selectedSummaryMonthIndex]?.isrMensualPagar || 0,
            ingresos16: totalesIngresos.mensuales[selectedSummaryMonthIndex]?.Ingresos16 || 0,
            ingresos0: totalesIngresos.mensuales[selectedSummaryMonthIndex]?.Ingresos0 || 0,
            ingresosExentos: totalesIngresos.mensuales[selectedSummaryMonthIndex]?.IngresosExentos || 0,
            ingresosTotalMes: totalesIngresos.mensuales[selectedSummaryMonthIndex]?.totalMes || 0,
        };
        const esResicoConIngresos = (resicoPfCalculado.mensuales[selectedSummaryMonthIndex]?.ingresosMes || 0) > 0;
        
        const selectedMonthEgresosData = {
            gastos16: totalesEgresos.mensuales[selectedSummaryMonthIndex]?.Gastos16 || 0,
            gastos0: totalesEgresos.mensuales[selectedSummaryMonthIndex]?.Gastos0 || 0,
            gastosExentos: totalesEgresos.mensuales[selectedSummaryMonthIndex]?.GastosExentos || 0,
            nomina: totalesEgresos.mensuales[selectedSummaryMonthIndex]?.Nmina || 0,
            estrategia16: totalesEgresos.mensuales[selectedSummaryMonthIndex]?.Estrategia16 || 0,
            ivaAcreditableMes: totalesEgresos.mensuales[selectedSummaryMonthIndex]?.ivaAcreditable || 0,
            egresosTotalMes: totalesEgresos.mensuales[selectedSummaryMonthIndex]?.totalMes || 0,
        };
        
        const potencialDiscrepancia = summaryData.egresos > summaryData.ingresos && (summaryData.egresos - summaryData.ingresos > 50000 || (summaryData.ingresos > 0 && (summaryData.egresos / summaryData.ingresos) > 1.2));


        return (
          <div className="space-y-6 mt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white p-4 shadow rounded-lg border-l-4 border-blue-500">
                <h5 className="text-slate-500 text-sm font-medium">Total Ingresos Anual ({currentConfig.ejercicioFiscal})</h5>
                <h2 className="text-2xl font-bold text-slate-700">{formatCurrency(summaryData.ingresos)}</h2>
              </div>
              <div className="bg-white p-4 shadow rounded-lg border-l-4 border-red-500">
                <h5 className="text-slate-500 text-sm font-medium">Total Egresos Anual ({currentConfig.ejercicioFiscal})</h5>
                <h2 className="text-2xl font-bold text-slate-700">{formatCurrency(summaryData.egresos)}</h2>
              </div>
              <div className="bg-white p-4 shadow rounded-lg border-l-4 border-green-500">
                <h5 className="text-slate-500 text-sm font-medium">Utilidad Fiscal Estimada ({currentConfig.ejercicioFiscal})</h5>
                <h2 className="text-2xl font-bold text-slate-700">{formatCurrency(summaryData.utilidad)}</h2>
              </div>
               <div className="bg-white p-4 shadow rounded-lg border-l-4 border-purple-500">
                <h5 className="text-slate-500 text-sm font-medium">Utilidad Fiscal (%)</h5>
                <h2 className={`text-2xl font-bold ${utilidadFiscalPorcentaje >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {isNaN(utilidadFiscalPorcentaje) ? 'N/A' : utilidadFiscalPorcentaje.toFixed(2) + '%'}
                </h2>
              </div>
            </div>
            
            <div className={`bg-white p-4 shadow rounded-lg border-l-4 ${fiscalAlerts.some(a => a.type === 'error' || a.type === 'warning') ? 'border-amber-500' : 'border-green-500'}`}>
                <div className="flex items-start mb-3">
                    <i className={`fas ${fiscalAlerts.some(a => a.type === 'error' || a.type === 'warning') ? 'fa-bell text-amber-500' : 'fa-check-circle text-green-500'} text-xl mr-3 mt-1`}></i>
                    <div>
                        <h5 className="text-slate-700 font-semibold">Alertas Fiscales y Consejos IA</h5>
                    </div>
                </div>
                {fiscalAlerts.length === 0 && !isLoadingOverlay && (
                    <p className="text-sm text-slate-500">Analizando datos fiscales... Si no aparecen alertas, todo está en orden o no hay datos suficientes.</p>
                )}
                <div className="space-y-3">
                    {fiscalAlerts.map(alert => (
                        <div key={alert.id} className={`p-3 rounded-md border ${
                            alert.type === 'error' ? 'bg-red-50 border-red-200' :
                            alert.type === 'warning' ? 'bg-amber-50 border-amber-200' :
                            alert.type === 'info' ? 'bg-sky-50 border-sky-200' :
                            'bg-green-50 border-green-200'
                        }`}>
                            <div className="flex items-start justify-between">
                                <div>
                                    <strong className={`font-medium ${
                                        alert.type === 'error' ? 'text-red-700' :
                                        alert.type === 'warning' ? 'text-amber-700' :
                                        alert.type === 'info' ? 'text-sky-700' :
                                        'text-green-700'
                                    }`}>
                                    {alert.type === 'error' && <i className="fas fa-times-circle mr-1.5"></i>}
                                    {alert.type === 'warning' && <i className="fas fa-exclamation-triangle mr-1.5"></i>}
                                    {alert.type === 'info' && <i className="fas fa-info-circle mr-1.5"></i>}
                                    {alert.type === 'success' && <i className="fas fa-check-circle mr-1.5"></i>}
                                    {alert.title}
                                    </strong>
                                    <p className="text-xs text-slate-600 mt-0.5">{alert.message}</p>
                                </div>
                                {alert.aiPromptContent && (
                                    <button 
                                        onClick={() => toggleAlertExpansion(alert.id)}
                                        className="text-xs text-blue-600 hover:text-blue-800 focus:outline-none ml-2 p-1"
                                        aria-expanded={alert.isExpanded}
                                    >
                                        {alert.isExpanded ? 'Ocultar IA' : 'Sugerencia IA'} <i className={`fas ${alert.isExpanded ? 'fa-chevron-up' : 'fa-chevron-down'} ml-1`}></i>
                                    </button>
                                )}
                            </div>
                            {alert.isExpanded && alert.aiPromptContent && (
                                <div className="mt-2 pt-2 border-t border-slate-200/50">
                                    {!alert.aiAdvice && !alert.isAiAdviceLoading && (
                                        <button 
                                            onClick={() => getAiAlertAdvice(alert.id, alert.aiPromptContent!)}
                                            className="bg-blue-500 hover:bg-blue-600 text-white text-xs font-medium py-1 px-2 rounded-md transition-colors"
                                        >
                                            <i className="fas fa-brain mr-1"></i>Obtener Sugerencia
                                        </button>
                                    )}
                                    {alert.isAiAdviceLoading && (
                                        <p className="text-xs text-slate-500 flex items-center">
                                            <svg className="animate-spin -ml-0.5 mr-1.5 h-3 w-3 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                            Consultando IA...
                                        </p>
                                    )}
                                    {alert.aiAdvice && (
                                        <div className="text-xs text-slate-700 bg-slate-50 p-2 rounded whitespace-pre-wrap">
                                            <strong className="text-slate-800">Sugerencia IA:</strong><br/>{alert.aiAdvice}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white p-4 shadow rounded-lg">
                <div className="flex justify-between items-center mb-4">
                  <h5 className="text-slate-700 font-semibold">Impuestos del Mes Seleccionado</h5>
                  <select
                    value={selectedSummaryMonthIndex}
                    onChange={(e) => setSelectedSummaryMonthIndex(parseInt(e.target.value))}
                    className="p-2 border border-slate-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500 bg-white"
                    aria-label="Seleccionar mes para resumen de impuestos"
                  >
                    {MESES_COMPLETOS.map((mes, index) => (
                      <option key={index} value={index}>{mes}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between p-3 bg-slate-50 rounded-md"><span>IVA a Cargo (Estimado):</span> <span className="font-semibold">{formatCurrency(selectedMonthIngresosData.ivaCargo)}</span></div>
                  <div className="flex justify-between p-3 bg-slate-50 rounded-md"><span>ISR Pago Provisional (Act. Emp.):</span> <span className="font-semibold">{formatCurrency(selectedMonthIngresosData.isrProvisional)}</span></div>
                  {esResicoConIngresos && (
                    <div className="flex justify-between p-3 bg-slate-50 rounded-md"><span>ISR RESICO PF:</span> <span className="font-semibold">{formatCurrency(selectedMonthIngresosData.isrResico)}</span></div>
                  )}
                  {!esResicoConIngresos && resicoPfData.some(m => m.ingresos > 0) && (
                     <div className="flex justify-between p-3 bg-slate-100 rounded-md text-slate-500"><span>ISR RESICO PF:</span> <span className="font-medium">(No aplica este mes)</span></div>
                  )}
                </div>
                <div className="mt-4">
                    <ChartWrapper chartId="impuestosMesChart" type="bar" data={impuestosDelMesChartData} options={{ scales: { y: { beginAtZero: true, ticks: { callback: (value:any) => formatCurrency(value, false) } } }, plugins: { legend: { display: false }, tooltip: { callbacks: { label: (context: any) => `${context.dataset.label || ''}: ${formatCurrency(context.parsed.y)}`}} } }} className="chart-container h-60" />
                </div>
              </div>

              <div className="bg-white p-4 shadow rounded-lg">
                <h5 className="text-slate-700 font-semibold mb-4">Ingresos del Mes ({MESES_COMPLETOS[selectedSummaryMonthIndex]})</h5>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between p-3 bg-blue-50 rounded-md"><span>Ingresos Gravados 16%:</span> <span className="font-semibold">{formatCurrency(selectedMonthIngresosData.ingresos16)}</span></div>
                  <div className="flex justify-between p-3 bg-blue-50 rounded-md"><span>Ingresos Gravados 0%:</span> <span className="font-semibold">{formatCurrency(selectedMonthIngresosData.ingresos0)}</span></div>
                  <div className="flex justify-between p-3 bg-blue-50 rounded-md"><span>Ingresos Exentos:</span> <span className="font-semibold">{formatCurrency(selectedMonthIngresosData.ingresosExentos)}</span></div>
                  <div className="flex justify-between p-3 bg-blue-100 rounded-md border-t-2 border-blue-200 mt-3"><strong>Total Ingresos del Mes:</strong> <strong className="font-semibold">{formatCurrency(selectedMonthIngresosData.ingresosTotalMes)}</strong></div>
                </div>
              </div>

                <div className="bg-white p-4 shadow rounded-lg">
                    <h5 className="text-slate-700 font-semibold mb-4">Egresos del Mes ({MESES_COMPLETOS[selectedSummaryMonthIndex]})</h5>
                    <div className="space-y-2 text-sm">
                        <div className="flex justify-between p-3 bg-red-50 rounded-md"><span>Gastos Gravados 16%:</span> <span className="font-semibold">{formatCurrency(selectedMonthEgresosData.gastos16)}</span></div>
                        <div className="flex justify-between p-3 bg-red-50 rounded-md"><span>Estrategia 16%:</span> <span className="font-semibold">{formatCurrency(selectedMonthEgresosData.estrategia16)}</span></div>
                        <div className="flex justify-between p-3 bg-red-50 rounded-md"><span>Gastos Gravados 0%:</span> <span className="font-semibold">{formatCurrency(selectedMonthEgresosData.gastos0)}</span></div>
                        <div className="flex justify-between p-3 bg-red-50 rounded-md"><span>Gastos Exentos:</span> <span className="font-semibold">{formatCurrency(selectedMonthEgresosData.gastosExentos)}</span></div>
                        <div className="flex justify-between p-3 bg-red-50 rounded-md"><span>Nómina:</span> <span className="font-semibold">{formatCurrency(selectedMonthEgresosData.nomina)}</span></div>
                         <div className="flex justify-between p-3 bg-red-50 rounded-md"><span>IVA Acreditable (Gastos 16% + Estrategia 16%):</span> <span className="font-semibold">{formatCurrency(selectedMonthEgresosData.ivaAcreditableMes)}</span></div>
                        <div className="flex justify-between p-3 bg-red-100 rounded-md border-t-2 border-red-200 mt-3"><strong>Total Egresos del Mes:</strong> <strong className="font-semibold">{formatCurrency(selectedMonthEgresosData.egresosTotalMes)}</strong></div>
                    </div>
                </div>

                {/* Análisis de Discrepancia Fiscal */}
                <div className="bg-white p-4 shadow rounded-lg border-l-4 border-orange-500">
                    <h5 className="text-slate-700 font-semibold mb-3">Análisis de Discrepancia Fiscal (Conceptual)</h5>
                    <div className="space-y-2 text-sm mb-3">
                        <div className="flex justify-between p-2 bg-slate-50 rounded"><span>Total Ingresos Anual (Plataforma):</span> <span className="font-semibold">{formatCurrency(summaryData.ingresos)}</span></div>
                        <div className="flex justify-between p-2 bg-slate-50 rounded"><span>Total Egresos Anual (Plataforma):</span> <span className="font-semibold">{formatCurrency(summaryData.egresos)}</span></div>
                    </div>
                    <p className="text-xs text-slate-500 mb-2">
                        <i className="fas fa-info-circle mr-1"></i> Este es un estimado basado en datos de la plataforma. Los egresos visibles por el SAT pueden incluir otros (ej. tarjetas, depósitos).
                    </p>
                    {potencialDiscrepancia && (
                        <div className="p-2 bg-amber-50 border border-amber-200 rounded text-amber-700 text-xs mb-3">
                            <i className="fas fa-exclamation-triangle mr-1"></i> <strong>Posible discrepancia:</strong> Sus egresos registrados son mayores a sus ingresos. Considere una revisión.
                        </div>
                    )}
                    <button
                        onClick={handleFetchDiscrepanciaAdvice}
                        disabled={isDiscrepanciaAiLoading || !ai}
                        className="bg-orange-500 hover:bg-orange-600 text-white text-xs font-medium py-1.5 px-3 rounded-md transition-colors flex items-center disabled:opacity-70"
                    >
                        {isDiscrepanciaAiLoading ? (
                            <><svg className="animate-spin -ml-0.5 mr-1.5 h-3 w-3 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> Cargando...</>
                        ) : (
                            <><i className="fas fa-comment-dots mr-1"></i>Obtener Consejo IA sobre Discrepancia</>
                        )}
                    </button>
                    {discrepanciaAiAdvice && (
                        <div className="mt-2 p-2 bg-slate-100 border border-slate-200 rounded text-xs text-slate-700 whitespace-pre-wrap">
                            <strong>Consejo IA:</strong><br/>{discrepanciaAiAdvice}
                        </div>
                    )}
                </div>
            </div>


            <div className="bg-white p-6 shadow rounded-lg border-t-4 border-cyan-500">
                <h5 className="text-lg font-semibold text-slate-700 mb-1 flex items-center">
                    <i className="fas fa-brain mr-2 text-cyan-500"></i>Asistente Fiscal IA (Consulta General)
                </h5>
                <p className="text-xs text-slate-500 mb-4">
                    Impulsado por Gemini. Para consultas generales.
                    { !ai && <span className="text-red-500"> (Servicio de IA no disponible: API Key no configurada)</span>}
                </p>
                <div className="space-y-3">
                    <textarea
                        value={aiPrompt}
                        onChange={(e) => setAiPrompt(e.target.value)}
                        placeholder="Escriba su consulta fiscal general aquí... (Ej: ¿Cuáles son las fechas límite para la declaración anual?)"
                        className="w-full p-2 border border-slate-300 rounded-md focus:ring-cyan-500 focus:border-cyan-500 text-sm min-h-[60px]"
                        rows={2}
                        aria-label="Prompt para Asistente Fiscal IA (Consulta General)"
                        disabled={!ai}
                    />
                    <button
                        onClick={handleAiConsult}
                        disabled={isAiLoading || !ai}
                        className="bg-cyan-600 hover:bg-cyan-700 text-white font-medium py-2 px-4 rounded-md text-sm transition-colors flex items-center disabled:opacity-70"
                    >
                        {isAiLoading ? (
                            <><svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> Consultando...</>
                        ) : (
                            <><i className="fas fa-paper-plane mr-2"></i>Consultar con IA</>
                        )}
                    </button>
                    {aiResponse && (
                        <div className="mt-4 p-3 bg-slate-50 border border-slate-200 rounded-md text-sm text-slate-700 whitespace-pre-wrap" aria-live="polite">
                            <strong className="text-slate-800">Respuesta IA:</strong><br/>
                            {aiResponse}
                        </div>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="lg:col-span-3 bg-white p-4 shadow rounded-lg">
                <h5 className="text-slate-700 font-semibold mb-2">Comparativo Ingresos y Egresos Mensual</h5>
                <ChartWrapper chartId="comparativoChart" type="bar" data={comparativoIngresosEgresosChartData} options={{ scales: { y: { beginAtZero: true } } }} className="chart-container h-72 md:h-96" />
              </div>
              <div className="bg-white p-4 shadow rounded-lg">
                <h5 className="text-slate-700 font-semibold mb-2">Composición de Egresos Anual</h5>
                <ChartWrapper chartId="composicionEgresosChart" type="doughnut" data={composicionEgresosChartData} className="chart-container h-72"/>
              </div>
              <div className="bg-white p-4 shadow rounded-lg">
                <h5 className="text-slate-700 font-semibold mb-2">Análisis Ley de Benford (Ingresos)</h5>
                <ChartWrapper chartId="benfordIngresosChart" type="bar" data={benfordIngresosData} options={{ scales: {y:{ticks:{callback: (v: number) => v.toFixed(1)+'%',}, title:{display:true, text:'Frecuencia (%)'}}, x:{title:{display:true, text:'Primer Dígito Significativo'}}}, plugins:{tooltip:{callbacks:{label: (ctx: any) => `${ctx.dataset.label}: ${ctx.parsed.y.toFixed(1)}%`}}}}} className="chart-container h-72"/>
              </div>
               <div className="bg-white p-4 shadow rounded-lg">
                <h5 className="text-slate-700 font-semibold mb-2">Análisis Ley de Benford (Egresos)</h5>
                <ChartWrapper chartId="benfordEgresosChart" type="bar" data={benfordEgresosData} options={{ scales: {y:{ticks:{callback: (v: number) => v.toFixed(1)+'%',}, title:{display:true, text:'Frecuencia (%)'}}, x:{title:{display:true, text:'Primer Dígito Significativo'}}}, plugins:{tooltip:{callbacks:{label: (ctx: any) => `${ctx.dataset.label}: ${ctx.parsed.y.toFixed(1)}%`}}}}} className="chart-container h-72"/>
              </div>
               <div className="lg:col-span-1 bg-white p-4 shadow rounded-lg">
                  <h5 className="text-slate-700 font-semibold mb-2">Top Productos/Servicios Vendidos</h5>
                  <div className="text-xs bg-sky-100 text-sky-700 p-2 rounded mb-2"><i className="fas fa-info-circle mr-1"></i> Requiere cargar XML. Mostrando datos de ejemplo.</div>
                  <ChartWrapper chartId="topProductosVendidosChart" type="bar" data={topProductosVendidosChartData} options={{ indexAxis: 'y', scales: { x: { beginAtZero: true } } }} className="chart-container h-72"/>
              </div>
              <div className="lg:col-span-1 bg-white p-4 shadow rounded-lg">
                  <h5 className="text-slate-700 font-semibold mb-2">Top Productos/Servicios Comprados</h5>
                  <div className="text-xs bg-sky-100 text-sky-700 p-2 rounded mb-2"><i className="fas fa-info-circle mr-1"></i> Requiere cargar XML. Mostrando datos de ejemplo.</div>
                  <ChartWrapper chartId="topProductosCompradosChart" type="bar" data={topProductosCompradosChartData} options={{ indexAxis: 'y', scales: { x: { beginAtZero: true } } }} className="chart-container h-72"/>
              </div>
            </div>
          </div>
        );
      case 'ingresos':
        return (
          <div className="mt-4 bg-white p-4 shadow rounded-lg">
            <h4 className="text-xl font-semibold text-slate-700">Registro Mensual de Ingresos ({currentConfig.ejercicioFiscal})</h4>
            <div className={`text-sm p-3 rounded my-4 bg-sky-100 text-sky-700`}>
                <i className={`fas fa-info-circle mr-1`}></i> {ingresosEgresosMessage}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left text-slate-500" id="table-ingresos">
                <thead className="text-xs text-slate-700 uppercase bg-slate-100">
                  <tr>
                    <th className="px-4 py-2 w-[10%]">Mes</th>
                    <th className="px-4 py-2 w-[20%]">Ingresos 16%</th>
                    <th className="px-4 py-2 w-[20%]">Ingresos 0%</th>
                    <th className="px-4 py-2 w-[20%]">Ingresos Exentos</th>
                    <th className="px-4 py-2 w-[15%] text-center">IVA Cobrado (Calc)</th>
                    <th className="px-4 py-2 w-[15%] text-center">Total (Calc)</th>
                  </tr>
                </thead>
                <tbody>
                  {MESES.map((mes, index) => (
                    <tr key={mes} className="bg-white border-b hover:bg-slate-50">
                      <td className="px-4 py-2 font-medium text-slate-900">{mes}</td>
                      <td><input type="number" step="any" value={ingresosData[index]?.Ingresos16 || 0} onChange={(e) => handleIngresosDataChange(index, 'Ingresos16', getNumericValue(e.target.value))} className="w-full p-1 border rounded text-right tabular-nums"/></td>
                      <td><input type="number" step="any" value={ingresosData[index]?.Ingresos0 || 0} onChange={(e) => handleIngresosDataChange(index, 'Ingresos0', getNumericValue(e.target.value))} className="w-full p-1 border rounded text-right tabular-nums"/></td>
                      <td><input type="number" step="any" value={ingresosData[index]?.IngresosExentos || 0} onChange={(e) => handleIngresosDataChange(index, 'IngresosExentos', getNumericValue(e.target.value))} className="w-full p-1 border rounded text-right tabular-nums"/></td>
                      <td className="text-right tabular-nums bg-slate-50 px-4 py-2">{formatCurrency(totalesIngresos.mensuales[index]?.ivaCobrado || 0)}</td>
                      <td className="text-right tabular-nums bg-slate-50 px-4 py-2">{formatCurrency(totalesIngresos.mensuales[index]?.totalMes || 0)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="font-semibold text-slate-700 bg-slate-100 total-highlight">
                  <tr>
                    <td className="px-4 py-2">Totales</td>
                    <td className="text-right tabular-nums px-4 py-2">{formatCurrency(totalesIngresos.totalAnualIngresos16)}</td>
                    <td className="text-right tabular-nums px-4 py-2">{formatCurrency(totalesIngresos.totalAnualIngresos0)}</td>
                    <td className="text-right tabular-nums px-4 py-2">{formatCurrency(totalesIngresos.totalAnualIngresosExentos)}</td>
                    <td className="text-right tabular-nums px-4 py-2">{formatCurrency(totalesIngresos.totalAnualIvaCobrado)}</td>
                    <td className="text-right tabular-nums px-4 py-2">{formatCurrency(totalesIngresos.totalAnualIngresosGeneral)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
             <div className="mt-6">
                <h5 className="text-slate-700 font-semibold mb-2">Análisis de Ingresos Mensuales (Total)</h5>
                <ChartWrapper chartId="ingresosMensualesChart" type="line" data={ingresosMensualesChartData} className="chart-container h-72 md:h-96"/>
            </div>
          </div>
        );
      case 'egresos':
        return (
          <div className="mt-4 bg-white p-4 shadow rounded-lg">
            <h4 className="text-xl font-semibold text-slate-700">Registro Mensual de Egresos ({currentConfig.ejercicioFiscal})</h4>
            <div className={`text-sm p-3 rounded my-4 bg-sky-100 text-sky-700`}>
                <i className={`fas fa-info-circle mr-1`}></i> {ingresosEgresosMessage}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left text-slate-500" id="table-egresos">
                <thead className="text-xs text-slate-700 uppercase bg-slate-100">
                  <tr>
                    <th className="px-4 py-2 w-[8%]">Mes</th>
                    <th className="px-4 py-2 w-[14%]">Gastos 16%</th>
                    <th className="px-4 py-2 w-[14%] text-center">IVA Acred. (Calc)</th>
                    <th className="px-4 py-2 w-[14%]">Gastos 0%</th>
                    <th className="px-4 py-2 w-[14%]">Gastos Exentos</th>
                    <th className="px-4 py-2 w-[14%]">Nómina</th>
                    <th className="px-4 py-2 w-[14%]">Estrategia 16%</th>
                    <th className="px-4 py-2 w-[12%] text-center">Total (Calc)</th>
                  </tr>
                </thead>
                <tbody>
                  {MESES.map((mes, index) => (
                    <tr key={mes} className="bg-white border-b hover:bg-slate-50">
                      <td className="px-4 py-2 font-medium text-slate-900">{mes}</td>
                      <td><input type="number" step="any" value={egresosData[index]?.Gastos16 || 0} onChange={(e) => handleEgresosDataChange(index, 'Gastos16', getNumericValue(e.target.value))} className="w-full p-1 border rounded text-right tabular-nums"/></td>
                      <td className="text-right tabular-nums bg-slate-50 px-4 py-2">{formatCurrency(totalesEgresos.mensuales[index]?.ivaAcreditable || 0)}</td>
                      <td><input type="number" step="any" value={egresosData[index]?.Gastos0 || 0} onChange={(e) => handleEgresosDataChange(index, 'Gastos0', getNumericValue(e.target.value))} className="w-full p-1 border rounded text-right tabular-nums"/></td>
                      <td><input type="number" step="any" value={egresosData[index]?.GastosExentos || 0} onChange={(e) => handleEgresosDataChange(index, 'GastosExentos', getNumericValue(e.target.value))} className="w-full p-1 border rounded text-right tabular-nums"/></td>
                      <td><input type="number" step="any" value={egresosData[index]?.Nmina || 0} onChange={(e) => handleEgresosDataChange(index, 'Nmina', getNumericValue(e.target.value))} className="w-full p-1 border rounded text-right tabular-nums"/></td>
                      <td><input type="number" step="any" value={egresosData[index]?.Estrategia16 || 0} onChange={(e) => handleEgresosDataChange(index, 'Estrategia16', getNumericValue(e.target.value))} className="w-full p-1 border rounded text-right tabular-nums"/></td>
                      <td className="text-right tabular-nums bg-slate-50 px-4 py-2">{formatCurrency(totalesEgresos.mensuales[index]?.totalMes || 0)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="font-semibold text-slate-700 bg-slate-100 total-highlight">
                  <tr>
                    <td className="px-4 py-2">Totales</td>
                    <td className="text-right tabular-nums px-4 py-2">{formatCurrency(totalesEgresos.totalAnualEgresos16)}</td>
                    <td className="text-right tabular-nums px-4 py-2">{formatCurrency(totalesEgresos.totalAnualIvaAcreditableGastos)}</td>
                    <td className="text-right tabular-nums px-4 py-2">{formatCurrency(totalesEgresos.totalAnualEgresos0)}</td>
                    <td className="text-right tabular-nums px-4 py-2">{formatCurrency(totalesEgresos.totalAnualEgresosExentos)}</td>
                    <td className="text-right tabular-nums px-4 py-2">{formatCurrency(totalesEgresos.totalAnualNomina)}</td>
                    <td className="text-right tabular-nums px-4 py-2">{formatCurrency(totalesEgresos.totalAnualEstrategia16)}</td>
                    <td className="text-right tabular-nums px-4 py-2">{formatCurrency(totalesEgresos.totalAnualEgresosGeneral)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
            <div className="mt-6">
                <h5 className="text-slate-700 font-semibold mb-2">Análisis de Egresos Mensuales (Total)</h5>
                <ChartWrapper chartId="egresosMensualesChart" type="line" data={egresosMensualesChartData} className="chart-container h-72 md:h-96"/>
            </div>
          </div>
        );
    case 'iva': 
        return (
            <div className="mt-4 bg-white p-4 shadow rounded-lg">
                <h4 className="text-xl font-semibold text-slate-700 mb-3">Cédula de I.V.A. ({currentConfig.ejercicioFiscal})</h4>
                 <div className="text-sm bg-sky-100 text-sky-700 p-3 rounded my-4"><i className="fas fa-info-circle mr-1"></i> Cálculos automáticos. No considera IVA Pagado ni retenciones.</div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left text-slate-500" id="table-cedula-iva">
                        <thead className="text-xs text-slate-700 uppercase bg-slate-100">
                            <tr>
                                <th className="px-2 py-2 w-[10%]">Mes</th>
                                <th className="px-2 py-2 w-[12%] text-right">Ingr. Grav. (16%)</th>
                                <th className="px-2 py-2 w-[12%] text-right">IVA Cobrado</th>
                                <th className="px-2 py-2 w-[12%] text-right">Egr. Grav. (16%)</th>
                                <th className="px-2 py-2 w-[12%] text-right">IVA Acreditable</th>
                                <th className="px-2 py-2 w-[12%] text-right">IVA Causado</th>
                                <th className="px-2 py-2 w-[10%] text-right">Saldo Favor Ant.</th>
                                <th className="px-2 py-2 w-[10%] text-right">IVA a Cargo</th>
                                <th className="px-2 py-2 w-[10%] text-right">Saldo Favor Sig.</th>
                            </tr>
                        </thead>
                        <tbody>
                            {MESES.map((mes, index) => {
                                const dataMes = cedulaIvaCalculada.mensuales[index];
                                return (
                                    <tr key={mes} className="bg-white border-b hover:bg-slate-50">
                                        <td className="px-2 py-2 font-medium text-slate-900">{mes}</td>
                                        <td className="text-right tabular-nums bg-slate-50 px-2 py-2">{formatCurrency(dataMes?.IngrGrav16 || 0)}</td>
                                        <td className="text-right tabular-nums bg-slate-50 px-2 py-2">{formatCurrency(dataMes?.IVACobrado || 0)}</td>
                                        <td className="text-right tabular-nums bg-slate-50 px-2 py-2">{formatCurrency(dataMes?.EgrGrav16 || 0)}</td>
                                        <td className="text-right tabular-nums bg-slate-50 px-2 py-2">{formatCurrency(dataMes?.IVAAcreditable || 0)}</td>
                                        <td className="text-right tabular-nums bg-slate-50 px-2 py-2">{formatCurrency(dataMes?.IVACausado || 0)}</td>
                                        <td className="text-right tabular-nums bg-slate-50 px-2 py-2">{formatCurrency(dataMes?.SaldoFavorAnt || 0)}</td>
                                        <td className="text-right tabular-nums bg-slate-50 px-2 py-2">{formatCurrency(dataMes?.IVACargo || 0)}</td>
                                        <td className="text-right tabular-nums bg-slate-50 px-2 py-2">{formatCurrency(dataMes?.SaldoFavorSig || 0)}</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                        <tfoot className="font-semibold text-slate-700 bg-slate-100 total-highlight">
                            <tr>
                                <td className="px-2 py-2">Totales</td>
                                <td className="text-right tabular-nums px-2 py-2">{formatCurrency(cedulaIvaCalculada.totales.totalIngrGrav)}</td>
                                <td className="text-right tabular-nums px-2 py-2">{formatCurrency(cedulaIvaCalculada.totales.totalIvaCobrado)}</td>
                                <td className="text-right tabular-nums px-2 py-2">{formatCurrency(cedulaIvaCalculada.totales.totalEgrGrav)}</td>
                                <td className="text-right tabular-nums px-2 py-2">{formatCurrency(cedulaIvaCalculada.totales.totalIvaAcreditable)}</td>
                                <td className="text-right tabular-nums px-2 py-2">{formatCurrency(cedulaIvaCalculada.totales.totalIvaCausado)}</td>
                                <td className="px-2 py-2 text-right">N/A</td>
                                <td className="text-right tabular-nums px-2 py-2">{formatCurrency(cedulaIvaCalculada.totales.totalIvaCargo)}</td>
                                <td className="px-2 py-2 text-right">N/A</td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
                 <div className="mt-6">
                    <h5 className="text-slate-700 font-semibold mb-2">Análisis de IVA Mensual (Cargo / Favor)</h5>
                    <ChartWrapper chartId="ivaMensualChart" type="bar" data={ivaMensualChartData} options={{scales:{x:{stacked:true},y:{stacked:true,ticks:{callback: (v: number) => formatCurrency(Math.abs(v))}}}}} className="chart-container h-72 md:h-96"/>
                </div>
            </div>
        );
    case 'isr':
        return (
            <div className="mt-4 bg-white p-4 shadow rounded-lg">
                <h4 className="text-xl font-semibold text-slate-700 mb-3">Cédula de I.S.R. Pago Provisional (Act. Empresarial {currentConfig.ejercicioFiscal})</h4>
                 <div className="text-sm bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700 p-3 rounded my-4 leading-relaxed">
                    <i className="fas fa-exclamation-triangle mr-1"></i> <strong>Estimación:</strong> No incluye deducciones personales, estímulos, PTU, ni pérdidas. Consulte a un profesional.
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left text-slate-500" id="table-cedula-isr">
                        <thead className="text-xs text-slate-700 uppercase bg-slate-100">
                            <tr>
                                <th className="px-2 py-2">Mes</th>
                                <th className="px-2 py-2 text-right">Ing. Nom. (Acum)</th>
                                <th className="px-2 py-2 text-right">Ded. Aut. (Acum)</th>
                                <th className="px-2 py-2 text-right">Util. Fisc. (Acum)</th>
                                <th className="px-2 py-2 text-right">Base Grav. (Acum)</th>
                                <th className="px-2 py-2 text-right">ISR Caus. (Acum Est)</th>
                                <th className="px-2 py-2 text-right">Pag. Prov. Ant.</th>
                                <th className="px-2 py-2 text-right">Pago Prov. (Calc Est)</th>
                            </tr>
                        </thead>
                        <tbody>
                             {MESES.map((mes, index) => {
                                const dataMes = cedulaIsrCalculada.mensuales[index];
                                return (
                                    <tr key={mes} className="bg-white border-b hover:bg-slate-50">
                                        <td className="px-2 py-2 font-medium text-slate-900">{mes}</td>
                                        <td className="text-right tabular-nums bg-slate-50 px-2 py-2">{formatCurrency(dataMes?.IngresosNominalesAcum || 0)}</td>
                                        <td className="text-right tabular-nums bg-slate-50 px-2 py-2">{formatCurrency(dataMes?.DeduccionesAutorizadasAcum || 0)}</td>
                                        <td className="text-right tabular-nums bg-slate-50 px-2 py-2">{formatCurrency(dataMes?.UtilidadFiscalAcum || 0)}</td>
                                        <td className="text-right tabular-nums bg-slate-50 px-2 py-2">{formatCurrency(dataMes?.BaseGravableAcum || 0)}</td>
                                        <td className="text-right tabular-nums bg-slate-50 px-2 py-2">{formatCurrency(dataMes?.ISRCausadoAcumEst || 0)}</td>
                                        <td className="text-right tabular-nums bg-slate-50 px-2 py-2">{formatCurrency(dataMes?.PagosProvAntCalc || 0)}</td>
                                        <td className="text-right tabular-nums bg-slate-50 px-2 py-2">{formatCurrency(dataMes?.PagoProvisionalCalcEst || 0)}</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                         <tfoot className="font-semibold text-slate-700 bg-slate-100 total-highlight">
                            <tr>
                                <td className="px-2 py-2">Totales Anuales</td>
                                <td className="text-right tabular-nums px-2 py-2">{formatCurrency(cedulaIsrCalculada.totales.totalIngresosNominales)}</td>
                                <td className="text-right tabular-nums px-2 py-2">{formatCurrency(cedulaIsrCalculada.totales.totalDeduccionesAutorizadas)}</td>
                                <td className="text-right tabular-nums px-2 py-2">{formatCurrency(cedulaIsrCalculada.totales.totalUtilidadFiscal)}</td>
                                <td className="text-right tabular-nums px-2 py-2">{formatCurrency(cedulaIsrCalculada.totales.totalBaseGravable)}</td>
                                <td className="text-right tabular-nums px-2 py-2">{formatCurrency(cedulaIsrCalculada.totales.totalIsrCausadoEstimado)}</td>
                                <td className="px-2 py-2 text-right">N/A</td>
                                <td className="text-right tabular-nums px-2 py-2">{formatCurrency(cedulaIsrCalculada.totales.totalPagosProvisionales)}</td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
                 <div className="mt-6">
                    <h5 className="text-slate-700 font-semibold mb-2">Proyección Mensual ISR (Pago Provisional Estimado)</h5>
                    <ChartWrapper chartId="isrMensualChart" type="bar" data={isrMensualChartData} className="chart-container h-72 md:h-96"/>
                </div>
            </div>
        );
    case 'resico-pf':
        return (
            <div className="mt-4 bg-white p-4 shadow rounded-lg">
                <h4 className="text-xl font-semibold text-slate-700">Cálculo ISR - RESICO PF ({currentConfig.ejercicioFiscal})</h4>
                 <div className="text-sm bg-sky-100 text-sky-700 p-3 rounded my-4">
                    <i className="fas fa-info-circle mr-1"></i> No se permiten deducciones. Límite de ingresos anual: $3.5M.
                 </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left text-slate-500" id="table-resico-pf">
                        <thead className="text-xs text-slate-700 uppercase bg-slate-100">
                            <tr>
                                <th className="px-2 py-2 w-[10%]">Mes</th>
                                <th className="px-2 py-2 w-[25%]">Ingresos del Mes</th>
                                <th className="px-2 py-2 w-[15%] text-center">Tasa ISR (%)</th>
                                <th className="px-2 py-2 w-[20%] text-center">ISR Calculado</th>
                                <th className="px-2 py-2 w-[15%] text-center">Ret. ISR (1.25%)</th>
                                <th className="px-2 py-2 w-[15%] text-center">ISR Mensual a Pagar</th>
                            </tr>
                        </thead>
                        <tbody>
                            {MESES.map((mes, index) => {
                                const dataMes = resicoPfCalculado.mensuales[index];
                                return (
                                    <tr key={mes} className="bg-white border-b hover:bg-slate-50">
                                        <td className="px-2 py-2 font-medium text-slate-900">{mes}</td>
                                        <td><input type="number" step="any" value={resicoPfData[index]?.ingresos || 0} onChange={(e) => handleResicoDataChange(index, 'ingresos', getNumericValue(e.target.value))} className="w-full p-1 border rounded text-right tabular-nums"/></td>
                                        <td className="text-center tabular-nums bg-slate-50 px-2 py-2">{dataMes?.tasaIsr || '0.00%'}</td>
                                        <td className="text-right tabular-nums bg-slate-50 px-2 py-2">{formatCurrency(dataMes?.isrCalculado || 0)}</td>
                                        <td><input type="number" step="any" value={resicoPfData[index]?.retencion || 0} onChange={(e) => handleResicoDataChange(index, 'retencion', getNumericValue(e.target.value))} className="w-full p-1 border rounded text-right tabular-nums"/></td>
                                        <td className="text-right tabular-nums bg-slate-50 px-2 py-2">{formatCurrency(dataMes?.isrMensualPagar || 0)}</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                        <tfoot className="font-semibold text-slate-700 bg-slate-100 total-highlight">
                            <tr>
                                <td className="px-2 py-2">Totales Anuales</td>
                                <td className="text-right tabular-nums px-2 py-2">{formatCurrency(resicoPfCalculado.totales.totalIngresosAnual)}</td>
                                <td className="text-center px-2 py-2">N/A</td>
                                <td className="text-right tabular-nums px-2 py-2">{formatCurrency(resicoPfCalculado.totales.totalIsrCalculadoAnual)}</td>
                                <td className="text-right tabular-nums px-2 py-2">{formatCurrency(resicoPfCalculado.totales.totalRetencionAnual)}</td>
                                <td className="text-right tabular-nums px-2 py-2">{formatCurrency(resicoPfCalculado.totales.totalIsrPagarAnual)}</td>
                            </tr>
                        </tfoot>
                    </table>
                     {resicoPfCalculado.totales.totalIngresosAnual > 3500000 && (
                        <p className="text-red-600 font-semibold mt-3 text-sm"><i className="fas fa-exclamation-triangle mr-1"></i> ¡Alerta! Ingresos anuales superan el límite de $3,500,000 para RESICO PF.</p>
                     )}
                </div>
                 <div className="mt-6">
                    <h5 className="text-slate-700 font-semibold mb-2">Proyección Mensual ISR RESICO PF (Estimado)</h5>
                    <ChartWrapper chartId="isrResicoPfMensualChart" type="bar" data={isrResicoPfMensualChartData} options={{ interaction: { mode: 'index', intersect: false }, scales: { yIsr: { type: 'linear', display: true, position: 'left', beginAtZero: true, title: { display: true, text: 'ISR Mensual ($)' }, grid: { drawOnChartArea: false } }, yIngresos: { type: 'linear', display: true, position: 'right', beginAtZero: true, title: { display: true, text: 'Ingresos Mensuales ($)' } } }, plugins: { tooltip: { callbacks: { label: (ctx: any) => `${ctx.dataset.label}: ${formatCurrency(ctx.parsed.y)}`}}}}} className="chart-container h-72 md:h-96"/>
                </div>
            </div>
        );
    case 'reportes':
        return (
            <div className="mt-4 space-y-6">
                {/* Resumen Anual y Declaración */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="bg-white p-4 shadow rounded-lg">
                        <h4 className="text-xl font-semibold text-slate-700 mb-3">Declaración Anual (Preliminar - {currentConfig.ejercicioFiscal})</h4>
                        <table className="w-full text-sm" id="table-declaracion-anual">
                            <tbody>
                                {[
                                    { label: "Ingresos Acumulables Anuales", value: declaracionAnualData.ingresosAcumulables },
                                    { label: "Deducciones Autorizadas Anuales", value: declaracionAnualData.deduccionesAutorizadas },
                                    { label: "Utilidad Fiscal Anual", value: declaracionAnualData.utilidadFiscal },
                                    { label: "Pérdidas Fiscales Anteriores (No Imp.)", value: declaracionAnualData.perdidasFiscales, disabled: true },
                                    { label: "Base Gravable Anual", value: declaracionAnualData.baseGravable },
                                    { label: "ISR Anual Causado (Estimado)", value: declaracionAnualData.isrAnualCausado },
                                    { label: "Pagos Provisionales Efectuados", value: declaracionAnualData.pagosProvisionales },
                                    { label: "ISR a Cargo / (Favor) Anual (Est.)", value: declaracionAnualData.isrNeto, highlight: true },
                                ].map(item => (
                                    <tr key={item.label} className="border-b">
                                        <td className="py-2 text-slate-600">{item.label}</td>
                                        <td className={`py-2 text-right tabular-nums font-medium ${item.highlight ? (item.value < 0 ? 'text-green-600' : item.value > 0 ? 'text-red-600' : 'text-slate-800') : 'text-slate-800'}`}>
                                            {formatCurrency(item.value)}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        <div className="text-xs bg-yellow-100 text-yellow-700 p-2 rounded mt-3"><i className="fas fa-exclamation-triangle mr-1"></i>Estimación. No sustituye declaración oficial.</div>
                    </div>
                    <div className="bg-white p-4 shadow rounded-lg">
                        <h4 className="text-xl font-semibold text-slate-700 mb-3">Resumen Impuestos Anuales ({currentConfig.ejercicioFiscal})</h4>
                        <dl className="text-sm">
                            {[
                                { label: "ISR Anual Estimado (Cargo)/Favor:", value: reportesAnualesData.isrAnualNeto, highlight: true },
                                { label: "Total IVA a Cargo Anual:", value: reportesAnualesData.ivaCargoAnual },
                                { label: "Saldo a Favor IVA (Dic):", value: reportesAnualesData.ivaFavorDic, highlightFavor: true },
                            ].map(item => (
                                <div key={item.label} className="flex justify-between py-2 border-b">
                                    <dt className="text-slate-600">{item.label}</dt>
                                    <dd className={`font-medium tabular-nums ${item.highlight ? (item.value < 0 ? 'text-green-600' : item.value > 0 ? 'text-red-600' : 'text-slate-800') : (item.highlightFavor && item.value > 0 ? 'text-green-600' : 'text-slate-800')}`}>
                                        {formatCurrency(item.value)}
                                    </dd>
                                </div>
                            ))}
                        </dl>
                    </div>
                </div>

                {/* Planeación Fiscal Avanzada */}
                <div className="bg-white p-6 shadow-xl rounded-lg border-t-4 border-teal-500">
                    <h4 className="text-xl font-semibold text-teal-600 mb-1"><i className="fas fa-chart-line mr-2"></i>Planeación Fiscal Avanzada</h4>
                    <p className="text-sm text-slate-500 mb-4">Proyecte sus resultados fiscales para el próximo ejercicio ({currentConfig.ejercicioFiscal + 1}) y obtenga consejos de IA.</p>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4 p-4 border border-slate-200 rounded-md bg-slate-50">
                        <div>
                            <label htmlFor="incomeAdjustmentPercent" className="block text-sm font-medium text-slate-700 mb-1">Ajuste Proyectado de Ingresos (%)</label>
                            <input
                                type="number"
                                name="incomeAdjustmentPercent"
                                id="incomeAdjustmentPercent"
                                value={projectionSettings.incomeAdjustmentPercent}
                                onChange={handleProjectionSettingChange}
                                className="w-full p-2 border border-slate-300 rounded-md focus:ring-teal-500 focus:border-teal-500"
                                placeholder="Ej: 10 para +10%, -5 para -5%"
                            />
                        </div>
                        <div>
                            <label htmlFor="expenseAdjustmentPercent" className="block text-sm font-medium text-slate-700 mb-1">Ajuste Proyectado de Egresos (%)</label>
                            <input
                                type="number"
                                name="expenseAdjustmentPercent"
                                id="expenseAdjustmentPercent"
                                value={projectionSettings.expenseAdjustmentPercent}
                                onChange={handleProjectionSettingChange}
                                className="w-full p-2 border border-slate-300 rounded-md focus:ring-teal-500 focus:border-teal-500"
                                placeholder="Ej: 5 para +5%, -10 para -10%"
                            />
                        </div>
                        <div className="md:col-span-2">
                             <button 
                                onClick={calculateProjectedFiscalData}
                                className="w-full bg-teal-600 hover:bg-teal-700 text-white font-medium py-2 px-4 rounded-md transition-colors"
                                disabled={activeRfc.startsWith("TEMP_NEW_RFC_")}
                             >
                                <i className="fas fa-calculator mr-2"></i>Calcular Proyección Fiscal ({currentConfig.ejercicioFiscal + 1})
                            </button>
                        </div>
                    </div>

                    {projectedFiscalData && (
                        <div className="mt-6 space-y-4">
                            <h5 className="text-lg font-semibold text-slate-700">Resultados Proyectados para {projectedFiscalData.projectionYear}</h5>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3 text-sm p-4 border border-teal-200 bg-teal-50/50 rounded-md">
                                <div className="flex justify-between"><span>Ingresos Anuales Proyectados:</span> <span className="font-semibold">{formatCurrency(projectedFiscalData.projectedIncome)}</span></div>
                                <div className="flex justify-between"><span>Egresos Anuales Proyectados:</span> <span className="font-semibold">{formatCurrency(projectedFiscalData.projectedExpenses)}</span></div>
                                <div className="flex justify-between font-bold text-teal-700"><span>Utilidad Fiscal Proyectada:</span> <span>{formatCurrency(projectedFiscalData.projectedProfit)}</span></div>
                                <div className="flex justify-between"><span>ISR Anual Proyectado (Act. Emp.):</span> <span className="font-semibold">{formatCurrency(projectedFiscalData.projectedISR_ActEmp)}</span></div>
                                {resicoPfCalculado.totales.totalIngresosAnual > 0 && ( // Show RESICO PF only if it was relevant in base year
                                <div className="flex justify-between"><span>ISR Anual Proyectado (RESICO PF):</span> <span className="font-semibold">{formatCurrency(projectedFiscalData.projectedISR_RESICOPF)}</span></div>
                                )}
                                <div className="flex justify-between"><span>IVA a Cargo Anual Proyectado:</span> <span className="font-semibold">{formatCurrency(projectedFiscalData.projectedIVA_Cargo)}</span></div>
                            </div>

                            <div className="mt-4">
                                <h6 className="text-md font-semibold text-slate-700 mb-2">Comparativa Anual Proyectada vs Actual</h6>
                                <ChartWrapper chartId="proyeccionComparativoChart" type="bar" data={proyeccionComparativoChartData} options={{ scales: { y: { beginAtZero: true, ticks: { callback: (value:any) => formatCurrency(value,false) } } } }} className="chart-container h-72"/>
                            </div>
                            
                            <button
                                onClick={handleFetchProjectionAiAdvice}
                                disabled={isProjectionAiLoading || !ai}
                                className="bg-sky-600 hover:bg-sky-700 text-white font-medium py-2 px-4 rounded-md text-sm transition-colors flex items-center disabled:opacity-70 mt-3"
                            >
                                {isProjectionAiLoading ? (
                                    <><svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> Consultando IA...</>
                                ) : (
                                    <><i className="fas fa-lightbulb mr-2"></i>Obtener Consejo IA sobre Planeación</>
                                )}
                            </button>
                            {projectionAiAdvice && (
                                <div className="mt-3 p-3 bg-sky-50 border border-sky-200 rounded-md text-sm text-slate-700 whitespace-pre-wrap" aria-live="polite">
                                    <strong className="text-sky-800">Consejo IA para Planeación ({projectedFiscalData.projectionYear}):</strong><br/>
                                    {projectionAiAdvice}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        );
    case 'xml-tools': 
        return (
            <div className="mt-4 space-y-6">
                <div className="bg-white p-6 shadow rounded-lg">
                    <h5 className="text-lg font-semibold text-blue-600 mb-3"><i className="fas fa-upload mr-2"></i>Carga de Archivos XML</h5>
                    <div className="text-sm bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700 p-3 rounded mb-4">
                       <i className="fas fa-exclamation-triangle mr-1"></i> XMLs se procesan en navegador. Datos derivados no se guardan en nube.
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1" htmlFor="xmlEmitidosInput">XML Emitidos (.xml)</label>
                            <input type="file" id="xmlEmitidosInput" multiple accept=".xml" onChange={(e) => setXmlEmitidosFiles(e.target.files)}
                                className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"/>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1" htmlFor="xmlRecibidosInput">XML Recibidos (.xml)</label>
                            <input type="file" id="xmlRecibidosInput" multiple accept=".xml" onChange={(e) => setXmlRecibidosFiles(e.target.files)}
                                className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-orange-50 file:text-orange-700 hover:file:bg-orange-100"/>
                        </div>
                    </div>
                    <button onClick={handleProcessXml} className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded transition duration-150">
                        <i className="fas fa-cogs mr-1"></i> Procesar XML
                    </button>
                    {xmlProcessingStatus && <div className="mt-3 text-sm text-slate-600">{xmlProcessingStatus}</div>}
                </div>
                <div className="bg-white p-6 shadow rounded-lg">
                    <h5 className="text-lg font-semibold text-slate-700 mb-3">KPIs por Forma de Pago (Desde XML)</h5>
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                        {KPI_FORMA_PAGO_KEYS.map(key => {
                            const item = kpiFormaPagoData[key] || (key === "otros" && Object.keys(kpiFormaPagoData).filter(k => !KPI_FORMA_PAGO_KEYS.includes(k)).reduce((acc,otherKey) => ({total: acc.total + (kpiFormaPagoData[otherKey]?.total || 0), count: acc.count + (kpiFormaPagoData[otherKey]?.count || 0)}), {total:0, count:0})) || {total:0, count:0};
                            const label = FORMA_PAGO_DESCRIPCIONES[key] || (key === "otros" ? "Otros" : `FP ${key}`);
                            return (
                                <div key={key} className="bg-slate-50 p-3 rounded-md text-center border border-slate-200">
                                    <div className="text-xl font-bold text-blue-600">{formatCurrency(item.total)}</div>
                                    <div className="text-xs text-slate-500 mt-1">{label}</div>
                                    <div className="text-xs text-slate-400">({item.count} XMLs)</div>
                                </div>
                            );
                        })}
                    </div>
                    <div className="mt-6">
                         <ChartWrapper chartId="formaPagoChart" type="doughnut" data={formaPagoChartData} options={{plugins:{legend:{position:'bottom'}}}} className="chart-container h-72 md:h-80"/>
                    </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-white p-4 shadow rounded-lg">
                        <h5 className="text-md font-semibold text-slate-700 mb-2">Top 10 Clientes (XML Emitidos)</h5>
                        <div className="overflow-x-auto max-h-80">
                            <table className="w-full text-xs">
                                <thead className="bg-slate-100 text-slate-600 sticky top-0"><tr><th className="p-2 text-left">#</th><th className="p-2 text-left">RFC Cliente</th><th className="p-2 text-right">Monto Total</th></tr></thead>
                                <tbody>{topClientesData.length === 0 ? (<tr><td colSpan={3} className="p-4 text-center text-slate-400">No hay datos de XML Emitidos procesados.</td></tr>) : topClientesData.map((c,i)=>(<tr key={c.rfc} className="border-b"><td className="p-2">{i+1}</td><td className="p-2">{c.rfc}</td><td className="p-2 text-right tabular-nums">{formatCurrency(c.total)}</td></tr>))}</tbody>
                            </table>
                        </div>
                    </div>
                     <div className="bg-white p-4 shadow rounded-lg">
                        <h5 className="text-md font-semibold text-slate-700 mb-2">Top 10 Proveedores (XML Recibidos)</h5>
                        <div className="overflow-x-auto max-h-80">
                            <table className="w-full text-xs">
                                <thead className="bg-slate-100 text-slate-600 sticky top-0"><tr><th className="p-2 text-left">#</th><th className="p-2 text-left">RFC Proveedor</th><th className="p-2 text-right">Monto Total</th></tr></thead>
                                <tbody>{topProveedoresData.length === 0 ? (<tr><td colSpan={3} className="p-4 text-center text-slate-400">No hay datos de XML Recibidos procesados.</td></tr>) : topProveedoresData.map((p,i)=>(<tr key={p.rfc} className="border-b"><td className="p-2">{i+1}</td><td className="p-2">{p.rfc}</td><td className="p-2 text-right tabular-nums">{formatCurrency(p.total)}</td></tr>))}</tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        );
    case 'sat-xml':
      return (
        <div className="mt-4 p-6 bg-white shadow-lg rounded-lg space-y-6">
            <h4 className="text-xl font-semibold text-slate-800 border-b pb-3 mb-6"><i className="fas fa-cloud-download-alt mr-2 text-blue-600"></i>Descarga Automática de CFDI desde el SAT</h4>

            <div className="p-4 border border-slate-200 rounded-md">
                <h5 className="text-md font-semibold text-slate-700 mb-2">1. Configuración de e.firma (FIEL)</h5>
                <div className="text-xs text-red-600 bg-red-50 p-3 rounded-md mb-3">
                    <i className="fas fa-shield-alt mr-1"></i> <strong>Importante:</strong> Su llave privada (.key) y contraseña son información sensible.
                    En una aplicación real, NUNCA deben almacenarse o procesarse directamente en el navegador.
                    La firma de solicitudes al SAT debe realizarse en un servidor seguro (backend).
                    Esta interfaz es para enviar los archivos al backend seguro. Los archivos seleccionados aquí SÍ se enviarán al servidor.
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-3">
                    <div>
                        <label htmlFor="efirma-cer" className="block text-sm font-medium text-slate-600 mb-1">Archivo Certificado (.cer)</label>
                        <input type="file" id="efirma-cer" accept=".cer" onChange={(e) => handleEFirmaFileChange(e, 'cer')} className="block w-full text-sm text-slate-500 file:mr-4 file:py-1.5 file:px-3 file:rounded-md file:border file:border-slate-300 file:text-sm file:font-medium file:bg-slate-50 file:text-slate-700 hover:file:bg-slate-100"/>
                    </div>
                    <div>
                        <label htmlFor="efirma-key" className="block text-sm font-medium text-slate-600 mb-1">Archivo Llave Privada (.key)</label>
                        <input type="file" id="efirma-key" accept=".key" onChange={(e) => handleEFirmaFileChange(e, 'key')} className="block w-full text-sm text-slate-500 file:mr-4 file:py-1.5 file:px-3 file:rounded-md file:border file:border-slate-300 file:text-sm file:font-medium file:bg-slate-50 file:text-slate-700 hover:file:bg-slate-100"/>
                    </div>
                </div>
                <div>
                    <label htmlFor="efirma-password" className="block text-sm font-medium text-slate-600 mb-1">Contraseña de la Llave Privada</label>
                    <input type="password" id="efirma-password" value={eFirmaConfig.password} onChange={handleEFirmaPasswordChange} className="w-full p-2 border border-slate-300 rounded-md focus:ring-blue-500 focus:border-blue-500" placeholder="Contraseña e.firma"/>
                </div>
                <button 
                  onClick={handleSaveEFirmaConfig} 
                  disabled={isLoadingOverlay || activeRfc.startsWith("TEMP_NEW_RFC_")}
                  className="mt-3 bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2 px-4 rounded-md text-sm transition-colors flex items-center disabled:opacity-50">
                   <i className="fas fa-save mr-2"></i>Guardar Configuración e.firma
                </button>
            </div>

            <div className="p-4 border border-slate-200 rounded-md">
                <h5 className="text-md font-semibold text-slate-700 mb-3">2. Iniciar Descarga de CFDI</h5>
                 <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-3">
                    <div>
                        <label htmlFor="sat-download-fecha-inicio" className="block text-sm font-medium text-slate-600 mb-1">Fecha Inicio</label>
                        <input type="date" id="sat-download-fecha-inicio" value={satDownloadFechaInicio} onChange={e => setSatDownloadFechaInicio(e.target.value)} className="w-full p-2 border border-slate-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-sm"/>
                    </div>
                     <div>
                        <label htmlFor="sat-download-fecha-fin" className="block text-sm font-medium text-slate-600 mb-1">Fecha Fin</label>
                        <input type="date" id="sat-download-fecha-fin" value={satDownloadFechaFin} onChange={e => setSatDownloadFechaFin(e.target.value)} className="w-full p-2 border border-slate-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-sm"/>
                    </div>
                    <div>
                        <label htmlFor="sat-download-tipo" className="block text-sm font-medium text-slate-600 mb-1">Tipo CFDI</label>
                        <select id="sat-download-tipo" value={satDownloadTipo} onChange={e => setSatDownloadTipo(e.target.value as 'emitidos' | 'recibidos')} className="w-full p-2 border border-slate-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-sm">
                            <option value="recibidos">Recibidos</option>
                            <option value="emitidos">Emitidos</option>
                        </select>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <button 
                        onClick={handleInitiateSatDownload} 
                        disabled={isLoadingOverlay || activeRfc.startsWith("TEMP_NEW_RFC_")}
                        className="bg-green-600 hover:bg-green-700 text-white font-medium py-2 px-4 rounded-md text-sm transition-colors flex items-center disabled:opacity-50">
                        <i className="fas fa-download mr-2"></i>Iniciar Descarga Diaria
                    </button>
                    {currentSolicitudId && (
                         <button 
                            onClick={() => handleCheckDownloadStatus()} 
                            disabled={isLoadingOverlay}
                            className="bg-sky-500 hover:bg-sky-600 text-white font-medium py-2 px-4 rounded-md text-sm transition-colors flex items-center">
                            <i className="fas fa-check-circle mr-2"></i>Verificar Estado (ID: {currentSolicitudId.substring(0,8)}...)
                        </button>
                    )}
                </div>
            </div>
            
            <div className={`p-4 rounded-md text-sm border ${
                satDownloadInfo.status === 'success' ? 'bg-green-50 border-green-300 text-green-700' :
                satDownloadInfo.status === 'error' ? 'bg-red-50 border-red-300 text-red-700' :
                satDownloadInfo.status === 'pending' ? 'bg-yellow-50 border-yellow-300 text-yellow-700' :
                'bg-slate-50 border-slate-300 text-slate-600'
            }`}>
                <p className="font-semibold">Estado del Servicio de Descarga:</p>
                <p><strong>Último Intento:</strong> {satDownloadInfo.lastAttempt !== 'N/A' ? new Date(satDownloadInfo.lastAttempt).toLocaleString('es-MX') : 'N/A'}</p>
                <p><strong>Estado:</strong> <span className="font-medium">{satDownloadInfo.status.toUpperCase()}</span></p>
                <p><strong>Mensaje:</strong> {satDownloadInfo.message}</p>
            </div>
        </div>
      );
    case 'historial-descarga':
      return <HistorialDescargaTab activeRfc={activeRfc} currentConfig={currentConfig} onNavigateToXmlTools={handleNavigateToXmlToolsFromHistory} />;
    case 'educacion':
        return (
            <div className="mt-4 bg-white p-6 shadow rounded-lg">
                <h4 className="text-xl font-semibold text-slate-700 mb-2 flex items-center">
                    <i className="fas fa-graduation-cap text-blue-500 mr-3"></i>Centro de Educación Fiscal IA
                </h4>
                <p className="text-sm text-slate-500 mb-4">Seleccione un tema para obtener una explicación generada por IA (Gemini).</p>
                {!ai && <p className="text-red-500 text-sm mb-4"><i className="fas fa-exclamation-triangle mr-1"></i>Servicio de IA no disponible: API Key no configurada.</p>}
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mb-6">
                    {fiscalTopics.map(topic => (
                        <button
                            key={topic}
                            onClick={() => handleFetchEducationTopic(topic)}
                            disabled={!ai || isEducationLoading}
                            className={`p-3 text-left rounded-md border text-sm font-medium transition-colors disabled:opacity-60
                                ${selectedTopic === topic ? 'bg-blue-100 border-blue-300 text-blue-700' : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700'}`}
                        >
                            {topic}
                        </button>
                    ))}
                </div>

                {isEducationLoading && (
                    <div className="text-center py-5">
                        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500 mx-auto mb-2"></div>
                        <p className="text-slate-600">Obteniendo información sobre "{selectedTopic}"...</p>
                    </div>
                )}

                {educationContent && (
                    <div className="mt-4 p-4 bg-slate-50 border border-slate-200 rounded-md">
                        <h5 className="text-md font-semibold text-slate-800 mb-2">Explicación sobre: {selectedTopic}</h5>
                        <div className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{educationContent}</div>
                    </div>
                )}
            </div>
        );
    case 'config':
        return (
            <div className="mt-4 bg-white p-6 shadow rounded-lg">
                <h4 className="text-xl font-semibold text-slate-700 mb-4">Configuración del Contribuyente ({currentConfig.rfc || "Nuevo RFC"})</h4>
                <div className="text-sm bg-sky-100 text-sky-700 p-3 rounded mb-4"><i className="fas fa-info-circle mr-1"></i> Cambiar el RFC aquí y guardar cargará o creará un nuevo perfil de contribuyente. La configuración es específica por RFC.</div>
                <form onSubmit={handleConfigFormSubmit} className="space-y-4">
                    <div>
                        <label htmlFor="configRFC" className="block text-sm font-medium text-slate-600 mb-1">RFC del Contribuyente (ID)</label>
                        <div className="relative">
                            <input 
                               type="text" 
                               id="configRFC" 
                               value={currentConfig.rfc} 
                               onChange={handleRfcInputChange}
                               className={`w-full p-2 border rounded-md focus:ring-blue-500 focus:border-blue-500 ${
                                   rfcValidation === null ? 'border-slate-300' : rfcValidation.valid ? 'border-green-500' : 'border-red-500'
                               }`}
                               placeholder="XAXX010101000"
                               maxLength={13}
                            />
                            {rfcValidation && (
                                <span className={`absolute right-3 top-1/2 -translate-y-1/2 text-lg ${rfcValidation.valid ? 'text-green-500' : 'text-red-500'}`} title={rfcValidation.message}>
                                    <i className={`fas ${rfcValidation.valid ? 'fa-check-circle' : 'fa-times-circle'}`}></i>
                                </span>
                            )}
                        </div>
                        {rfcValidation && <p className={`text-xs mt-1 ${rfcValidation.valid ? 'text-green-600' : 'text-red-600'}`}>{rfcValidation.message}</p>}
                    </div>
                    <div>
                        <label htmlFor="configNombreEmpresa" className="block text-sm font-medium text-slate-600 mb-1">Nombre de la Empresa / Contribuyente</label>
                        <input type="text" id="configNombreEmpresa" value={currentConfig.nombreEmpresa} 
                               onChange={e => setCurrentConfig({...currentConfig, nombreEmpresa: e.target.value})}
                               className="w-full p-2 border border-slate-300 rounded-md focus:ring-blue-500 focus:border-blue-500"/>
                    </div>
                    <div>
                        <label htmlFor="configTasaIVA" className="block text-sm font-medium text-slate-600 mb-1">Tasa de IVA General (%)</label>
                        <input type="number" step="any" id="configTasaIVA" value={currentConfig.tasaIVA} 
                               onChange={e => setCurrentConfig({...currentConfig, tasaIVA: getNumericValue(e.target.value)})}
                               className="w-full p-2 border border-slate-300 rounded-md focus:ring-blue-500 focus:border-blue-500"/>
                    </div>
                    <div>
                        <label htmlFor="configEjercicioFiscal" className="block text-sm font-medium text-slate-600 mb-1">Ejercicio Fiscal</label>
                        <input type="number" id="configEjercicioFiscal" value={currentConfig.ejercicioFiscal} 
                               onChange={e => setCurrentConfig({...currentConfig, ejercicioFiscal: getNumericValue(e.target.value)})} 
                               min="2000" max="2099"
                               className="w-full p-2 border border-slate-300 rounded-md focus:ring-blue-500 focus:border-blue-500"/>
                    </div>
                    <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded transition duration-150">
                        Guardar Configuración de RFC ({currentConfig.rfc || "NUEVO"})
                    </button>
                </form>
            </div>
        );
      default: return <div className="mt-4 text-center text-slate-500">Seleccione una pestaña.</div>;
    }
  };
  
  if (!activeRfc && !isLoadingOverlay && !requestedTab) { 
    return (
        <div className="flex-grow flex items-center justify-center p-4">
            <div className="text-center text-slate-600">
                <i className="fas fa-folder-open fa-2x mb-3"></i>
                <p>No hay un RFC activo seleccionado. Por favor, configure uno en la pestaña 'Configuración' o selecciónelo del menú de clientes.</p>
            </div>
        </div>
    );
  }


  return (
    <div className="container mx-auto p-4 flex-grow">
        {isLoadingOverlay && (
            <div className="fixed inset-0 bg-white bg-opacity-75 flex items-center justify-center z-[100]">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
                <span className="ml-3 text-slate-700">Procesando...</span>
            </div>
        )}
      <div className="bg-white p-4 shadow rounded-lg mb-4 text-center">
        <h1 className="text-2xl font-bold text-slate-800">Dashboard Fiscal: {currentConfig.nombreEmpresa} ({activeRfc.startsWith("TEMP_NEW_RFC_") ? "Configurando Nuevo..." : activeRfc})</h1>
        <p className="text-sm text-slate-500 mt-1">Ejercicio: {currentConfig.ejercicioFiscal}</p>
      </div>
      
      <div className="flex flex-wrap justify-between items-center mb-4 gap-2">
        <div className="flex flex-wrap gap-2">
          <button 
            onClick={handleExportToPdf} 
            disabled={activeRfc.startsWith("TEMP_NEW_RFC_")}
            className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium py-2 px-3 rounded-md shadow transition duration-150 disabled:opacity-50"
          >
            <i className="fas fa-file-pdf mr-1"></i> Exportar PDF
          </button>
          <button 
            onClick={handleExportToExcel} 
            disabled={activeRfc.startsWith("TEMP_NEW_RFC_")}
            className="bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium py-2 px-3 rounded-md shadow transition duration-150 disabled:opacity-50"
          >
            <i className="fas fa-file-excel mr-1"></i> Exportar Excel
          </button>
        </div>
        <div className="flex items-center gap-3">
            {savingIndicator.show && (
                <span className={`text-sm flex items-center ${savingIndicator.success ? 'text-green-600' : 'text-red-600'}`}>
                    <i className={`fas ${savingIndicator.success ? 'fa-check-circle' : 'fa-exclamation-triangle'} mr-1`}></i> {savingIndicator.message}
                </span>
            )}
            <span className="text-xs text-slate-500">
                <i className="fas fa-clock mr-1"></i> Último guardado (nube): {lastSaved}
            </span>
            <button 
                onClick={handleResetData} 
                disabled={activeRfc.startsWith("TEMP_NEW_RFC_")}
                className="bg-red-500 hover:bg-red-600 text-white text-sm font-medium py-2 px-3 rounded-md shadow transition duration-150 disabled:opacity-50">
                <i className="fas fa-trash-alt mr-1"></i> Restablecer datos (nube para {activeRfc.startsWith("TEMP_NEW_RFC_") ? "NUEVO" : activeRfc})
            </button>
        </div>
      </div>

      <div className="mb-4 border-b border-slate-200">
        <nav className="flex flex-wrap -mb-px text-sm font-medium text-center" aria-label="Tabs">
          {TAB_OPTIONS.map(tab => (
             (activeRfc.startsWith("TEMP_NEW_RFC_") && tab.id !== 'config') ? null : (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`whitespace-nowrap group inline-flex items-center justify-center p-3 border-b-2 font-medium text-sm focus:outline-none
                  ${activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                  }`}
              >
                {tab.label}
              </button>
             )
          ))}
        </nav>
      </div>
      
      <div className="tab-content">
        {renderActiveTabContent()}
      </div>

      <button
        onClick={() => setIsFiscalAssistantModalOpen(true)}
        className="fixed bottom-6 right-6 bg-gradient-to-br from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white w-14 h-14 rounded-full shadow-lg flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-cyan-500 transition-all duration-150 ease-in-out transform hover:scale-110"
        title="Asistente Fiscal IA"
        aria-label="Abrir Asistente Fiscal IA"
      >
        <i className="fas fa-robot text-xl"></i>
      </button>
      <FiscalAssistantModal 
        isOpen={isFiscalAssistantModalOpen} 
        onClose={() => setIsFiscalAssistantModalOpen(false)}
        fiscalDataSummary={fiscalAssistantSummary}
        apiKeyAvailable={!!process.env.API_KEY && !!ai}
      />
    </div>
  );
};