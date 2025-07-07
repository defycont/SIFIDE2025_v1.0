
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { AppConfig, ActiveTab, IngresosMensual, EgresosMensual, ResicoPfMensual, CedulaIVAMes, CedulaISRMes, ResicoPfCalculadoMes, ChartData, XmlSummaryItem, KpiFormaPago, BenfordDistribution, DashboardControllerProps, TaxpayerData } from './types.ts';
import { MESES, MESES_TARIFAS_KEYS, TABLA_TASAS_RESICO_PF_SAT, BENFORD_EXPECTED_DISTRIBUTION, BENFORD_LABELS, FORMA_PAGO_DESCRIPCIONES, KPI_FORMA_PAGO_KEYS, TAB_OPTIONS, INITIAL_INGRESOS, INITIAL_EGRESOS, INITIAL_RESICO_PF, DEFAULT_APP_CONFIG, TARIFAS_ISR_ACUMULADAS_POR_MES } from './constants.ts';
import FiscalCalculationsTab from './components/tabs/FiscalCalculationsTab.tsx';
import { ChartWrapper } from './components/ChartWrapper.tsx';
import { updateTaxpayerPartialData, resetTaxpayerFirestoreData, getSpecificTaxpayerField } from './firebaseUtils.ts';


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

export const DashboardController: React.FC<DashboardControllerProps> = ({
  authUserId, activeRfc, initialTaxpayerData,
  onAppConfigChange, onSwitchRfc,
  totalPerdidasFiscalesAcumuladas, onCedulaIsrDataChange
}) => {
  const [activeTab, setActiveTab] = useState<ActiveTab>('resumen');
  const [lastSaved, setLastSaved] = useState<string | null>(null);
  const [savingIndicator, setSavingIndicator] = useState<{ show: boolean; message: string; success: boolean }>({ show: false, message: '', success: true });
  const [isLoadingOverlay, setIsLoadingOverlay] = useState<boolean>(true); 

  // Fiscal data states
  const [ingresosData, setIngresosData] = useState<IngresosMensual[]>(INITIAL_INGRESOS);
  const [egresosData, setEgresosData] = useState<EgresosMensual[]>(INITIAL_EGRESOS);
  const [resicoPfData, setResicoPfData] = useState<ResicoPfMensual[]>(INITIAL_RESICO_PF);
  
  const [currentConfig, setCurrentConfig] = useState<AppConfig>(initialTaxpayerData.appConfig || DEFAULT_APP_CONFIG);
  
   useEffect(() => {
    setCurrentConfig(initialTaxpayerData.appConfig || DEFAULT_APP_CONFIG);
  }, [initialTaxpayerData.appConfig]);

  // Se añade una nueva variable para simplificar el acceso al régimen fiscal actual
  const currentRegimenFiscal = currentConfig.regimenFiscal || 'General'; // Default a 'General'


  // XML Processing states
  const [xmlEmitidosFiles, setXmlEmitidosFiles] = useState<FileList | null>(null);
  const [xmlRecibidosFiles, setXmlRecibidosFiles] = useState<FileList | null>(null);
  const [xmlProcessingStatus, setXmlProcessingStatus] = useState<string>('');
  const [topClientesData, setTopClientesData] = useState<Array<{ rfc: string, total: number }>>([]);
  const [topProveedoresData, setTopProveedoresData] = useState<Array<{ rfc: string, total: number }>>([]);
  const [kpiFormaPagoData, setKpiFormaPagoData] = useState<KpiFormaPago>({});
  
  const updateLastSavedTimeDisplay = useCallback(async (rfc: string) => {
    if (!rfc) {
        setLastSaved("N/A RFC"); return;
    }
    try {
      const timestampStr = await getSpecificTaxpayerField(rfc, 'lastSavedTimestamp');
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

  // Initial data load from Firestore based on activeRfc
  useEffect(() => {
    const loadData = async () => {
      if (!activeRfc) {
        console.warn("DashboardController: activeRfc no proporcionado. Usando datos iniciales de props.");
        setIngresosData(initialTaxpayerData.ingresosData || INITIAL_INGRESOS);
        setEgresosData(initialTaxpayerData.egresosData || INITIAL_EGRESOS);
        setResicoPfData(initialTaxpayerData.resicoPfData || INITIAL_RESICO_PF);
        setCurrentConfig(initialTaxpayerData.appConfig || DEFAULT_APP_CONFIG);
        if (initialTaxpayerData.lastSavedTimestamp) {
            setLastSaved(new Date(initialTaxpayerData.lastSavedTimestamp).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }));
        } else {
            updateLastSavedTimeDisplay(activeRfc); 
        }
        setIsLoadingOverlay(false);
        return;
      }
      setIsLoadingOverlay(true);
      try {
        setIngresosData(initialTaxpayerData.ingresosData || INITIAL_INGRESOS);
        setEgresosData(initialTaxpayerData.egresosData || INITIAL_EGRESOS);
        setResicoPfData(initialTaxpayerData.resicoPfData || INITIAL_RESICO_PF);
        setCurrentConfig(initialTaxpayerData.appConfig || DEFAULT_APP_CONFIG);
        
        if (initialTaxpayerData.lastSavedTimestamp) {
          setLastSaved(new Date(initialTaxpayerData.lastSavedTimestamp).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }));
        } else {
           updateLastSavedTimeDisplay(activeRfc);
        }
      } catch (error) {
        console.error("Error setting data from initialTaxpayerData:", error);
        setIngresosData(INITIAL_INGRESOS);
        setEgresosData(INITIAL_EGRESOS);
        setResicoPfData(INITIAL_RESICO_PF);
        setCurrentConfig(DEFAULT_APP_CONFIG); 
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

  const handleGenericDataSave = async <TItem extends IngresosMensual | EgresosMensual | ResicoPfMensual>(
    dataKey: 'ingresosData' | 'egresosData' | 'resicoPfData', // Explicit union type
    currentDataArray: TItem[],
    monthIndex: number,
    field: keyof TItem, // Cambiado a keyof TItem para permitir claves de cualquier tipo
    value: number
  ) => {
    const updatedArray: TItem[] = currentDataArray.map((item: TItem, index) => {
      if (index === monthIndex) { // Apply update only for the relevant month
        return { ...item, [field]: value };
      }
      return item;
    });
    
    if (!activeRfc) {
      showSavingFlash(false, 'Error: No hay un RFC activo.');
      console.error("handleGenericDataSave: activeRfc no disponible.");
      return;
    }
     if (dataKey === 'ingresosData') {
      // Cast is likely needed here as TS cannot guarantee TItem === IngresosMensual for the set call.
      setIngresosData(updatedArray as IngresosMensual[]);
    } else if (dataKey === 'egresosData') {
      setEgresosData(updatedArray as EgresosMensual[]);
    } else if (dataKey === 'resicoPfData') {
      setResicoPfData(updatedArray as ResicoPfMensual[]);
    }

    try {
      await updateTaxpayerPartialData(activeRfc, { [dataKey]: updatedArray as TaxpayerData[typeof dataKey] });
      showSavingFlash(true, 'Guardado en nube');
      updateLastSavedTimeDisplay(activeRfc);
    } catch (error) {
      showSavingFlash(false, 'Error al guardar');
      console.error(`Error saving ${dataKey} to Firestore for RFC ${activeRfc}:`, error);
    }
  };
    
  const handleIngresosDataChange = (monthIndex: number, field: keyof IngresosMensual, value: number) => {
    // La función handleGenericDataSave ya es genérica. Solo necesita el tipo de elemento del array.
    handleGenericDataSave<IngresosMensual>(
      'ingresosData',
      ingresosData,
      monthIndex,
      field, // Ya correctamente tipado como keyof IngresosMensual
      value
    );
  };
  
  const handleEgresosDataChange = (monthIndex: number, field: keyof EgresosMensual, value: number) => {
    handleGenericDataSave<EgresosMensual>(
      'egresosData',
      egresosData,
      monthIndex,
      field, // Ya correctamente tipado como keyof EgresosMensual
      value
    );
  };
    
  const handleResicoDataChange = (monthIndex: number, field: keyof ResicoPfMensual, value: number) => {
    handleGenericDataSave<ResicoPfMensual>(
      'resicoPfData',
      resicoPfData,
      monthIndex,
      field, // Ya correctamente tipado como keyof ResicoPfMensual
      value
    );
  };
  
  // Totales Ingresos
  const totalesIngresos = useMemo(() => {
    const tasaIva = currentConfig.tasaIVA / 100;
    let t16 = 0, t0 = 0, tEx = 0, tIva = 0, tGen = 0;
    const mensuales = ingresosData.map(mes => {
      const ivaCobrado = mes.Ingresos16 * tasaIva;
      const totalMes = mes.Ingresos16 + mes.Ingresos0 + mes.IngresosExentos;
      t16 += mes.Ingresos16;
      t0 += mes.Ingresos0;
      tEx += mes.IngresosExentos;
      tIva += ivaCobrado;
      tGen += totalMes;
      return { ...mes, ivaCobrado, totalMes };
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

  // Totales Egresos
  const totalesEgresos = useMemo(() => {
    const tasaIva = currentConfig.tasaIVA / 100;
    let t16 = 0, tIva = 0, t0 = 0, tEx = 0, tNom = 0, tGen = 0;
    const mensuales = egresosData.map(mes => {
      const ivaAcreditable = mes.Gastos16 * tasaIva;
      const totalMes = mes.Gastos16 + mes.Gastos0 + mes.GastosExentos + mes.Nmina;
      t16 += mes.Gastos16;
      tIva += ivaAcreditable;
      t0 += mes.Gastos0;
      tEx += mes.GastosExentos;
      tNom += mes.Nmina;
      tGen += totalMes;
      return { ...mes, ivaAcreditable, totalMes };
    });
    return {
      mensuales,
      totalAnualEgresos16: t16,
      totalAnualIvaAcreditableGastos: tIva,
      totalAnualEgresos0: t0,
      totalAnualEgresosExentos: tEx,
      totalAnualNomina: tNom,
      totalAnualEgresosGeneral: tGen,
    };
  }, [egresosData, currentConfig.tasaIVA]);

  // Cédula IVA
  const cedulaIvaCalculada = useMemo(() => {
    const tasaIva = currentConfig.tasaIVA / 100;
    let saldoFavorAnterior = 0;
    const resultadosMensuales: CedulaIVAMes[] = [];
    let totalIngrGrav = 0, totalIvaCobrado = 0, totalEgrGrav = 0, totalIvaAcreditable = 0, totalIvaCausado = 0, totalIvaCargo = 0;

    for (let i = 0; i < 12; i++) {
      const ingrGrav16 = ingresosData[i].Ingresos16;
      const egrGrav16 = egresosData[i].Gastos16;
      const ivaCobrado = ingrGrav16 * tasaIva;
      const ivaAcreditable = egrGrav16 * tasaIva;
      const ivaCausado = ivaCobrado - ivaAcreditable;
      const baseCalculo = ivaCausado - saldoFavorAnterior;
      const ivaCargo = Math.max(0, baseCalculo);
      const saldoFavorSiguiente = Math.max(0, -baseCalculo);

      resultadosMensuales.push({
        IngrGrav16: ingrGrav16, IVACobrado: ivaCobrado, EgrGrav16: egrGrav16,
        IVAAcreditable: ivaAcreditable, IVACausado: ivaCausado, SaldoFavorAnt: saldoFavorAnterior,
        IVACargo: ivaCargo, SaldoFavorSig: saldoFavorSiguiente
      });
      
      totalIngrGrav += ingrGrav16; totalIvaCobrado += ivaCobrado; totalEgrGrav += egrGrav16;
      totalIvaAcreditable += ivaAcreditable; totalIvaCausado += ivaCausado; totalIvaCargo += ivaCargo;
      saldoFavorAnterior = saldoFavorSiguiente;
    }
    return { 
        mensuales: resultadosMensuales, 
        totales: { totalIngrGrav, totalIvaCobrado, totalEgrGrav, totalIvaAcreditable, totalIvaCausado, totalIvaCargo } 
    };
  }, [ingresosData, egresosData, currentConfig.tasaIVA]);

  // Cédula ISR
  const cedulaIsrCalculada = useMemo(() => {
    let ingresosAcumulados = 0;
    let deduccionesAcumuladas = 0;
    let pagosProvisionalesAnteriores = 0;
    const resultadosMensuales: CedulaISRMes[] = [];
    let totalPagoProvisionalAnual = 0;
    let perdidaFiscalRemanente = totalPerdidasFiscalesAcumuladas; // Iniciar con la pérdida total recibida

    const ejercicioFiscal = currentConfig.ejercicioFiscal;

    for (let i = 0; i < 12; i++) {
      const mesKey = MESES_TARIFAS_KEYS[i] as keyof typeof TARIFAS_ISR_ACUMULADAS_POR_MES;
      const tarifaDelMes = TARIFAS_ISR_ACUMULADAS_POR_MES[mesKey]; 
      
      if (!tarifaDelMes) {
        console.error(`No se encontró tarifa de ISR para el mes: ${mesKey} (Ejercicio: ${ejercicioFiscal})`);
        resultadosMensuales.push({
            IngresosNominalesAcum: ingresosAcumulados, DeduccionesAutorizadasAcum: deduccionesAcumuladas,
            UtilidadFiscalAcum: Math.max(0, ingresosAcumulados - deduccionesAcumuladas), BaseGravableAcum: Math.max(0, ingresosAcumulados - deduccionesAcumuladas), 
            ISRCausadoAcumEst: 0, PagosProvAntCalc: pagosProvisionalesAnteriores, PagoProvisionalCalcEst: 0
        });
        continue; 
      }

      const ingresosMes = totalesIngresos.mensuales[i].totalMes;
      const deduccionesMes = totalesEgresos.mensuales[i].totalMes;

      ingresosAcumulados += ingresosMes;
      deduccionesAcumuladas += deduccionesMes;

      const utilidadFiscalAcum = Math.max(0, ingresosAcumulados - deduccionesAcumuladas);
      
      let perdidasAplicadasEsteMes = 0;
      let baseGravableAcum = utilidadFiscalAcum;

      if (utilidadFiscalAcum > 0 && perdidaFiscalRemanente > 0) {
        perdidasAplicadasEsteMes = Math.min(utilidadFiscalAcum, perdidaFiscalRemanente);
        baseGravableAcum = Math.max(0, utilidadFiscalAcum - perdidasAplicadasEsteMes);
        perdidaFiscalRemanente -= perdidasAplicadasEsteMes; // Reducir la pérdida remanente
      }

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
        PerdidasFiscalesAplicables: perdidasAplicadasEsteMes, // Nueva propiedad
        BaseGravableAcum: baseGravableAcum,
        ISRCausadoAcumEst: isrCausadoAcum,
        PagosProvAntCalc: pagosProvisionalesAnteriores,
        PagoProvisionalCalcEst: pagoProvisionalMes,
      });
      pagosProvisionalesAnteriores += pagoProvisionalMes;
      totalPagoProvisionalAnual += pagoProvisionalMes;
    }
    
    // Notificar a App.tsx sobre la cédula ISR actualizada
    onCedulaIsrDataChange(resultadosMensuales);

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
        totalBaseGravable: utilidadFiscalAnual, // Ya fue ajustado en los meses, esto es el total
        totalIsrCausadoEstimado: isrCausadoAnualEstimado,
        totalPagosProvisionales: totalPagoProvisionalAnual,
      }
    };
  }, [ingresosData, egresosData, totalesIngresos, totalesEgresos, currentConfig.ejercicioFiscal, totalPerdidasFiscalesAcumuladas]);
  
  // RESICO PF
  const resicoPfCalculado = useMemo(() => {
    const tablaTasas = TABLA_TASAS_RESICO_PF_SAT; 
    let totalIngresosAnual = 0;
    let totalIsrCalculadoAnual = 0;
    let totalRetencionAnual = 0;
    let totalIsrPagarAnual = 0;
    const resultadosMensuales: ResicoPfCalculadoMes[] = [];

    resicoPfData.forEach(mes => {
      const ingresosMes = mes.ingresos;
      const retencionMes = mes.retencion;
      let tasaAplicableNum = 0.00;

      if (ingresosMes > 0) {
        for (const tramo of tablaTasas) {
          if (ingresosMes >= tramo.limiteInferior && ingresosMes <= tramo.limiteSuperior) {
            tasaAplicableNum = tramo.tasa;
            break;
          }
        }
        if (tasaAplicableNum === 0.00 && ingresosMes > tablaTasas[tablaTasas.length - 2].limiteSuperior) {
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
  }, [resicoPfData, currentConfig.ejercicioFiscal]);

  const summaryData = useMemo(() => {
    const ingresosTotal = currentRegimenFiscal === 'RESICO_PF' ? resicoPfCalculado.totales.totalIngresosAnual : totalesIngresos.totalAnualIngresosGeneral;
    const egresosTotal = currentRegimenFiscal === 'RESICO_PF' ? 0 : totalesEgresos.totalAnualEgresosGeneral; // RESICO PF no considera egresos para ISR
    const utilidadTotal = ingresosTotal - egresosTotal; // Para RESICO PF, esto es ingresos menos 0

    return {
      ingresos: ingresosTotal,
      egresos: egresosTotal,
      utilidad: utilidadTotal,
    };
  }, [totalesIngresos, totalesEgresos, resicoPfCalculado, currentRegimenFiscal]);

  const declaracionAnualData = useMemo(() => {
    let ingresosAcumulables = 0;
    let deduccionesAutorizadas = 0;
    let utilidadFiscal = 0;
    let baseGravable = 0;
    let isrAnualCausado = 0;
    let pagosProvisionales = 0;
    let isrNeto = 0;

    if (currentRegimenFiscal === 'RESICO_PF') {
      ingresosAcumulables = resicoPfCalculado.totales.totalIngresosAnual;
      deduccionesAutorizadas = 0; // RESICO PF no aplica deducciones autorizadas para cálculo de ISR
      utilidadFiscal = resicoPfCalculado.totales.totalIngresosAnual; // En RESICO PF la utilidad fiscal es igual al ingreso
      baseGravable = resicoPfCalculado.totales.totalIngresosAnual; // Base gravable es igual al ingreso para RESICO PF
      isrAnualCausado = resicoPfCalculado.totales.totalIsrCalculadoAnual;
      pagosProvisionales = resicoPfCalculado.totales.totalIsrPagarAnual; // Los pagos provisionales para RESICO PF son el ISR a pagar mensual
      isrNeto = isrAnualCausado - pagosProvisionales; // Para RESICO PF, es ISR Calculado - Retenciones (que ya está en isrMensualPagar)
    } else { // Regimen General
      ingresosAcumulables = cedulaIsrCalculada.totales.totalIngresosNominales;
      deduccionesAutorizadas = cedulaIsrCalculada.totales.totalDeduccionesAutorizadas;
      utilidadFiscal = cedulaIsrCalculada.totales.totalUtilidadFiscal;
      baseGravable = cedulaIsrCalculada.totales.totalBaseGravable;
      isrAnualCausado = cedulaIsrCalculada.totales.totalIsrCausadoEstimado;
      pagosProvisionales = cedulaIsrCalculada.totales.totalPagosProvisionales;
      isrNeto = isrAnualCausado - pagosProvisionales;
    }

    return {
      ingresosAcumulables: ingresosAcumulables,
      deduccionesAutorizadas: deduccionesAutorizadas,
      utilidadFiscal: utilidadFiscal,
      perdidasFiscales: (currentRegimenFiscal === 'General' ? totalPerdidasFiscalesAcumuladas : 0), // Pérdidas solo aplican en Régimen General
      baseGravable: baseGravable,
      isrAnualCausado: isrAnualCausado,
      pagosProvisionales: pagosProvisionales,
      isrNeto: isrNeto,
      regimenFiscal: currentRegimenFiscal, // Add regimen to data
    };
  }, [cedulaIsrCalculada, resicoPfCalculado, currentRegimenFiscal, totalPerdidasFiscalesAcumuladas]);
  
  const reportesAnualesData = useMemo(() => ({
      isrAnualNeto: declaracionAnualData.isrNeto,
      ivaCargoAnual: cedulaIvaCalculada.totales.totalIvaCargo,
      ivaFavorDic: cedulaIvaCalculada.mensuales.length > 0 ? cedulaIvaCalculada.mensuales[11].SaldoFavorSig : 0,
  }), [declaracionAnualData, cedulaIvaCalculada]);


  const comparativoIngresosEgresosChartData: ChartData = useMemo(() => ({
    labels: MESES,
    datasets: [
      { label: 'Ingresos', data: totalesIngresos.mensuales.map(m => m.totalMes), backgroundColor: 'rgba(59, 130, 246, 0.7)' },
      { label: 'Egresos', data: totalesEgresos.mensuales.map(m => m.totalMes), backgroundColor: 'rgba(239, 68, 68, 0.7)' },
    ],
  }), [totalesIngresos, totalesEgresos]);

  const composicionEgresosChartData: ChartData = useMemo(() => ({
    labels: ['Gastos 16%', 'Gastos 0%', 'Gastos Exentos', 'Nómina'],
    datasets: [{
      label: 'Composición Egresos',
      data: [
        totalesEgresos.totalAnualEgresos16,
        totalesEgresos.totalAnualEgresos0,
        totalesEgresos.totalAnualEgresosExentos,
        totalesEgresos.totalAnualNomina,
      ],
      backgroundColor: ['#fbbf24', '#38bdf8', '#64748b', '#22c55e'],
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
        { label: 'Observado (%)', data: BENFORD_LABELS.map((d: string) => observed[d] || 0), backgroundColor: 'rgba(59, 130, 246, 0.7)', order: 2 },
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


  const handleConfigFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeRfc) { // Use activeRfc from props
        showSavingFlash(false, 'Error: No hay un RFC activo para guardar la configuración.');
        console.error("handleConfigFormSubmit: activeRfc no disponible.");
        return;
    }
    const rfcFromForm = currentConfig.rfc.toUpperCase().trim();
    if (!rfcFromForm) {
      alert("El campo RFC no puede estar vacío en la configuración.");
      showSavingFlash(false, 'RFC vacío en config.');
      return;
    }
    if (!/^[A-Z&Ñ]{3,4}\d{6}[A-Z\d]{3}$/.test(rfcFromForm)) {
        alert("El formato del RFC parece incorrecto. Use el formato mexicano (e.g., XAXX010101000).");
        showSavingFlash(false, 'RFC inválido en config.');
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
    if (!activeRfc) {
        showSavingFlash(false, 'Error: No hay un RFC activo para restablecer.');
        console.error("handleResetData: activeRfc no disponible.");
        return;
    }
    if (window.confirm(`¿Está seguro de que desea borrar TODOS los datos fiscales y la configuración en la nube para el RFC ${activeRfc}? Esta acción no se puede deshacer.`)) {
      setIsLoadingOverlay(true);
      try {
        const resetData = await resetTaxpayerFirestoreData(activeRfc);
        
        setIngresosData(resetData.ingresosData);
        setEgresosData(resetData.egresosData);
        setResicoPfData(resetData.resicoPfData);
        setCurrentConfig(resetData.appConfig); 

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

        const addTableToPdf = (title: string, tableId: string, startY: number, condition: boolean = true): number => {
            if (!condition) return startY; // Skip if condition is false
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
        currentY = addTableToPdf('Cédula ISR (Pagos Provisionales Estimados)', 'table-cedula-isr', currentY, currentRegimenFiscal === 'General');
        currentY = addTableToPdf('Cédula ISR RESICO Personas Físicas', 'table-resico-pf', currentY, currentRegimenFiscal === 'RESICO_PF');
        currentY = addTableToPdf('Cédula IVA', 'table-cedula-iva', currentY); // IVA applies to both
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


        const addSheetFromTable = (sheetName: string, tableId: string, condition: boolean = true) => {
            if (!condition) return; // Skip if condition is false
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
        addSheetFromTable('Cedula ISR Prov', 'table-cedula-isr', currentRegimenFiscal === 'General');
        addSheetFromTable('Cedula ISR RESICO PF', 'table-resico-pf', currentRegimenFiscal === 'RESICO_PF');
        addSheetFromTable('Cedula IVA', 'table-cedula-iva');
        addSheetFromTable('Ingresos', 'table-ingresos');
        addSheetFromTable('Egresos', 'table-egresos');

        const configDataSheet = [
            ["Configuración", "Valor"],
            ["Empresa", empresa],
            ["RFC", rfc],
            ["Tasa IVA (%)", currentConfig.tasaIVA],
            ["Ejercicio Fiscal", ejercicio],
            ["Régimen Fiscal", currentRegimenFiscal === 'General' ? 'Régimen General' : 'RESICO PF']
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
                        resolve(null); return;
                    }
                    const comprobanteNode = xmlDoc.getElementsByTagName('cfdi:Comprobante')[0];
                    if (!comprobanteNode) { resolve(null); return; }
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
                } catch (err) { resolve(null); }
            };
            reader.onerror = () => { resolve(null); };
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

  const renderActiveTabContent = () => {
    switch (activeTab) {
      case 'resumen':
        return (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
            <div className="md:col-span-1 lg:col-span-1 bg-white p-4 shadow rounded-lg border-l-4 border-blue-500">
              <h5 className="text-slate-500 text-sm font-medium">Total Ingresos Anual ({currentConfig.ejercicioFiscal}) {currentRegimenFiscal === 'RESICO_PF' ? '(RESICO PF)' : ''}</h5>
              <h2 className="text-2xl font-bold text-slate-700">{formatCurrency(summaryData.ingresos)}</h2>
            </div>
            {currentRegimenFiscal === 'General' && (
              <>
                <div className="md:col-span-1 lg:col-span-1 bg-white p-4 shadow rounded-lg border-l-4 border-red-500">
                  <h5 className="text-slate-500 text-sm font-medium">Total Egresos Anual ({currentConfig.ejercicioFiscal})</h5>
                  <h2 className="text-2xl font-bold text-slate-700">{formatCurrency(summaryData.egresos)}</h2>
                </div>
                <div className="md:col-span-2 lg:col-span-1 bg-white p-4 shadow rounded-lg border-l-4 border-green-500">
                  <h5 className="text-slate-500 text-sm font-medium">Utilidad Fiscal Estimada ({currentConfig.ejercicioFiscal})</h5>
                  <h2 className="text-2xl font-bold text-slate-700">{formatCurrency(summaryData.utilidad)}</h2>
                </div>
              </>
            )}

            <div className="md:col-span-2 lg:col-span-3 bg-white p-4 shadow rounded-lg">
              <h5 className="text-slate-700 font-semibold mb-2">Comparativo Ingresos y Egresos Mensual</h5>
              <ChartWrapper chartId="comparativoChart" type="bar" data={comparativoIngresosEgresosChartData} options={{ scales: { y: { beginAtZero: true } } }} className="chart-container h-72 md:h-96" />
            </div>
            <div className="md:col-span-1 bg-white p-4 shadow rounded-lg">
              <h5 className="text-slate-700 font-semibold mb-2">Composición de Egresos Anual</h5>
              <ChartWrapper chartId="composicionEgresosChart" type="doughnut" data={composicionEgresosChartData} className="chart-container h-72"/>
            </div>
            <div className="md:col-span-1 bg-white p-4 shadow rounded-lg">
              <h5 className="text-slate-700 font-semibold mb-2">Análisis Ley de Benford (Ingresos)</h5>
              <ChartWrapper chartId="benfordIngresosChart" type="bar" data={benfordIngresosData} options={{ scales: {y:{ticks:{callback: (v: number) => v.toFixed(1)+'%',}, title:{display:true, text:'Frecuencia (%)'}}, x:{title:{display:true, text:'Primer Dígito Significativo'}}}, plugins:{tooltip:{callbacks:{label: (ctx: any) => `${ctx.dataset.label}: ${ctx.parsed.y.toFixed(1)}%`}}}}} className="chart-container h-72"/>
            </div>
             <div className="md:col-span-1 bg-white p-4 shadow rounded-lg">
              <h5 className="text-slate-700 font-semibold mb-2">Análisis Ley de Benford (Egresos)</h5>
              <ChartWrapper chartId="benfordEgresosChart" type="bar" data={benfordEgresosData} options={{ scales: {y:{ticks:{callback: (v: number) => v.toFixed(1)+'%',}, title:{display:true, text:'Frecuencia (%)'}}, x:{title:{display:true, text:'Primer Dígito Significativo'}}}, plugins:{tooltip:{callbacks:{label: (ctx: any) => `${ctx.dataset.label}: ${ctx.parsed.y.toFixed(1)}%`}}}}} className="chart-container h-72"/>
            </div>
             <div className="md:col-span-3 lg:col-span-1 bg-white p-4 shadow rounded-lg">
                <h5 className="text-slate-700 font-semibold mb-2">Top Productos/Servicios Vendidos</h5>
                <div className="text-xs bg-sky-100 text-sky-700 p-2 rounded mb-2"><i className="fas fa-info-circle mr-1"></i> Requiere cargar XML. Mostrando datos de ejemplo.</div>
                <ChartWrapper chartId="topProductosVendidosChart" type="bar" data={topProductosVendidosChartData} options={{ indexAxis: 'y', scales: { x: { beginAtZero: true } } }} className="chart-container h-72"/>
            </div>
            <div className="md:col-span-3 lg:col-span-1 bg-white p-4 shadow rounded-lg">
                <h5 className="text-slate-700 font-semibold mb-2">Top Productos/Servicios Comprados</h5>
                <div className="text-xs bg-sky-100 text-sky-700 p-2 rounded mb-2"><i className="fas fa-info-circle mr-1"></i> Requiere cargar XML. Mostrando datos de ejemplo.</div>
                <ChartWrapper chartId="topProductosCompradosChart" type="bar" data={topProductosCompradosChartData} options={{ indexAxis: 'y', scales: { x: { beginAtZero: true } } }} className="chart-container h-72"/>
            </div>
          </div>
        );
      case 'ingresos':
        return (
          <div className="mt-4 bg-white p-4 shadow rounded-lg">
            <h4 className="text-xl font-semibold text-slate-700">Registro Mensual de Ingresos ({currentConfig.ejercicioFiscal})</h4>
            <div className="text-sm bg-sky-100 text-sky-700 p-3 rounded my-4"><i className="fas fa-info-circle mr-1"></i> Los valores se guardan en la nube al cambiar.</div>
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
                  {MESES.map((mes: string, index: number) => (
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
            <div className="text-sm bg-sky-100 text-sky-700 p-3 rounded my-4"><i className="fas fa-info-circle mr-1"></i> Los valores se guardan en la nube al cambiar.</div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left text-slate-500" id="table-egresos">
                <thead className="text-xs text-slate-700 uppercase bg-slate-100">
                  <tr>
                    <th className="px-4 py-2 w-[10%]">Mes</th>
                    <th className="px-4 py-2 w-[16%]">Gastos 16%</th>
                    <th className="px-4 py-2 w-[14%] text-center">IVA Acred. (Calc)</th>
                    <th className="px-4 py-2 w-[16%]">Gastos 0%</th>
                    <th className="px-4 py-2 w-[16%]">Gastos Exentos</th>
                    <th className="px-4 py-2 w-[16%]">Nómina</th>
                    <th className="px-4 py-2 w-[12%] text-center">Total (Calc)</th>
                  </tr>
                </thead>
                <tbody>
                  {MESES.map((mes: string, index: number) => (
                    <tr key={mes} className="bg-white border-b hover:bg-slate-50">
                      <td className="px-4 py-2 font-medium text-slate-900">{mes}</td>
                      <td><input type="number" step="any" value={egresosData[index]?.Gastos16 || 0} onChange={(e) => handleEgresosDataChange(index, 'Gastos16', getNumericValue(e.target.value))} className="w-full p-1 border rounded text-right tabular-nums"/></td>
                      <td className="text-right tabular-nums bg-slate-50 px-4 py-2">{formatCurrency(totalesEgresos.mensuales[index]?.ivaAcreditable || 0)}</td>
                      <td><input type="number" step="any" value={egresosData[index]?.Gastos0 || 0} onChange={(e) => handleEgresosDataChange(index, 'Gastos0', getNumericValue(e.target.value))} className="w-full p-1 border rounded text-right tabular-nums"/></td>
                      <td><input type="number" step="any" value={egresosData[index]?.GastosExentos || 0} onChange={(e) => handleEgresosDataChange(index, 'GastosExentos', getNumericValue(e.target.value))} className="w-full p-1 border rounded text-right tabular-nums"/></td>
                      <td><input type="number" step="any" value={egresosData[index]?.Nmina || 0} onChange={(e) => handleEgresosDataChange(index, 'Nmina', getNumericValue(e.target.value))} className="w-full p-1 border rounded text-right tabular-nums"/></td>
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
                                {MESES.map((mes: string, index: number) => {
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
                                    <th className="px-2 py-2 text-right">Pérdidas Apl.</th> {/* Nueva columna */}
                                    <th className="px-2 py-2 text-right">Base Grav. (Acum)</th>
                                    <th className="px-2 py-2 text-right">ISR Caus. (Acum Est)</th>
                                    <th className="px-2 py-2 text-right">Pag. Prov. Ant.</th>
                                    <th className="px-2 py-2 text-right">Pago Prov. (Calc Est)</th>
                                </tr>
                            </thead>
                            <tbody>
                                 {MESES.map((mes: string, index: number) => {
                                    const dataMes = cedulaIsrCalculada.mensuales[index];
                                    return (
                                        <tr key={mes} className="bg-white border-b hover:bg-slate-50">
                                            <td className="px-2 py-2 font-medium text-slate-900">{mes}</td>
                                            <td className="text-right tabular-nums bg-slate-50 px-2 py-2">{formatCurrency(dataMes?.IngresosNominalesAcum || 0)}</td>
                                            <td className="text-right tabular-nums bg-slate-50 px-2 py-2">{formatCurrency(dataMes?.DeduccionesAutorizadasAcum || 0)}</td>
                                            <td className="text-right tabular-nums bg-slate-50 px-2 py-2">{formatCurrency(dataMes?.UtilidadFiscalAcum || 0)}</td>
                                            <td className="text-right tabular-nums bg-yellow-50 px-2 py-2">{formatCurrency(dataMes?.PerdidasFiscalesAplicables || 0)}</td> {/* Mostrar nueva columna */}
                                            <td className="text-right tabular-nums bg-blue-50 px-2 py-2 font-bold">{formatCurrency(dataMes?.BaseGravableAcum || 0)}</td>
                                            <td className="text-right tabular-nums bg-slate-50 px-2 py-2">{formatCurrency(dataMes?.ISRCausadoAcumEst || 0)}</td>
                                            <td className="text-right tabular-nums bg-slate-50 px-2 py-2">{formatCurrency(dataMes?.PagosProvAntCalc || 0)}</td>
                                            <td className="text-right tabular-nums bg-slate-50 px-2 py-2">{formatCurrency(dataMes?.PagoProvisionalCalcEst || 0)}</td>
                                        </tr>
                                    );
                                })}
                         <tfoot className="font-semibold text-slate-700 bg-slate-100 total-highlight">
                            <tr>
                                <td className="px-2 py-2">Totales Anuales</td>
                                <td className="text-right tabular-nums px-2 py-2">{formatCurrency(cedulaIsrCalculada.totales.totalIngresosNominales)}</td>
                                <td className="text-right tabular-nums px-2 py-2">{formatCurrency(cedulaIsrCalculada.totales.totalDeduccionesAutorizadas)}</td>
                                <td className="text-right tabular-nums px-2 py-2">{formatCurrency(cedulaIsrCalculada.totales.totalUtilidadFiscal)}</td>
                                <td className="text-right tabular-nums px-2 py-2">N/A</td> {/* No hay total para pérdidas aplicables directamente aquí */}
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
                            {MESES.map((mes: string, index: number) => {
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
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-4">
                <div className="bg-white p-4 shadow rounded-lg">
                    <h4 className="text-xl font-semibold text-slate-700 mb-3">Declaración Anual (Preliminar - {currentConfig.ejercicioFiscal})</h4>
                    <table className="w-full text-sm" id="table-declaracion-anual">
                        <tbody>
                            {[
                                { label: "Ingresos Acumulables Anuales", value: declaracionAnualData.ingresosAcumulables },
                                { label: "Deducciones Autorizadas Anuales", value: declaracionAnualData.deduccionesAutorizadas, hide: currentRegimenFiscal === 'RESICO_PF' },
                                { label: "Utilidad Fiscal Anual", value: declaracionAnualData.utilidadFiscal, hide: currentRegimenFiscal === 'RESICO_PF' },
                                { label: "Pérdidas Fiscales Anteriores (No Imp.)", value: declaracionAnualData.perdidasFiscales, disabled: true, hide: currentRegimenFiscal === 'RESICO_PF' },
                                { label: "Base Gravable Anual", value: declaracionAnualData.baseGravable },
                                { label: "ISR Anual Causado (Estimado)", value: declaracionAnualData.isrAnualCausado },
                                { label: (currentRegimenFiscal === 'RESICO_PF' ? "ISR Pagado / Retenido" : "Pagos Provisionales Efectuados"), value: declaracionAnualData.pagosProvisionales },
                                { label: (currentRegimenFiscal === 'RESICO_PF' ? "ISR Final RESICO PF" : "ISR a Cargo / (Favor) Anual (Est.)"), value: declaracionAnualData.isrNeto, highlight: true },
                            ].map(item => (
                                !item.hide && (
                                <tr key={item.label} className="border-b">
                                    <td className="py-2 text-slate-600">{item.label}</td>
                                    <td className={`py-2 text-right tabular-nums font-medium ${item.highlight ? (item.value < 0 ? 'text-green-600' : item.value > 0 ? 'text-red-600' : 'text-slate-800') : 'text-slate-800'}`}>
                                        {formatCurrency(item.value)}
                                    </td>
                                </tr>
                                )
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
    case 'config':
        return (
            <div className="mt-4 bg-white p-6 shadow rounded-lg">
                <h4 className="text-xl font-semibold text-slate-700 mb-4">Configuración del Contribuyente (RFC: {activeRfc})</h4>
                <div className="text-sm bg-sky-100 text-sky-700 p-3 rounded mb-4"><i className="fas fa-info-circle mr-1"></i> Cambiar el RFC aquí y guardar cargará o creará un nuevo perfil de contribuyente. La configuración es específica por RFC.</div>
                <form onSubmit={handleConfigFormSubmit} className="space-y-4">
                    <div>
                        <label htmlFor="configRFC" className="block text-sm font-medium text-slate-600 mb-1">RFC del Contribuyente (ID)</label>
                        <input type="text" id="configRFC" value={currentConfig.rfc} 
                               onChange={e => setCurrentConfig({...currentConfig, rfc: e.target.value.toUpperCase()})}
                               className="w-full p-2 border border-slate-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                               placeholder="XAXX010101000"/>
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
                      <div>
                        <label htmlFor="configRegimenFiscal" className="block text-sm font-medium text-slate-600 mb-1">Régimen Fiscal</label>
                        <select id="configRegimenFiscal" value={currentRegimenFiscal}
                                onChange={e => setCurrentConfig({...currentConfig, regimenFiscal: e.target.value as 'General' | 'RESICO_PF'})}
                                className="w-full p-2 border border-slate-300 rounded-md focus:ring-blue-500 focus:border-blue-500">
                            <option value="General">Régimen General (Act. Empresarial y Profesional)</option>
                            <option value="RESICO_PF">RESICO Personas Físicas</option>
                        </select>
                      </div>
                   <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded transition duration-150">
                       Guardar Configuración de RFC ({currentConfig.rfc || "NUEVO"})
                   </button>
               </form>
           </div>
       );
      case 'fiscal-calculations':
        return <FiscalCalculationsTab />;
      default: return <div className="mt-4 text-center text-slate-500">Seleccione una pestaña.</div>;
    }
  };
  
  if (!activeRfc && !isLoadingOverlay) { 
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
        <h1 className="text-2xl font-bold text-slate-800">Dashboard Fiscal: {currentConfig.nombreEmpresa} ({activeRfc})</h1>
        <p className="text-sm text-slate-500 mt-1">Ejercicio: {currentConfig.ejercicioFiscal}</p>
      </div>
      
      <div className="flex flex-wrap justify-between items-center mb-4 gap-2">
        <div className="flex flex-wrap gap-2">
          <button onClick={handleExportToPdf} className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium py-2 px-3 rounded-md shadow transition duration-150">
            <i className="fas fa-file-pdf mr-1"></i> Exportar PDF
          </button>
          <button onClick={handleExportToExcel} className="bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium py-2 px-3 rounded-md shadow transition duration-150">
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
            <button onClick={handleResetData} className="bg-red-500 hover:bg-red-600 text-white text-sm font-medium py-2 px-3 rounded-md shadow transition duration-150">
                <i className="fas fa-trash-alt mr-1"></i> Restablecer datos (nube para {activeRfc})
            </button>
        </div>
      </div>

      <div className="mb-4 border-b border-slate-200">
        <nav className="flex flex-wrap -mb-px text-sm font-medium text-center" aria-label="Tabs">
          {TAB_OPTIONS.map((tab: { id: ActiveTab; label: string }) => (
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
          ))}
        </nav>
      </div>
      
      <div className="tab-content">
        {renderActiveTabContent()}
      </div>
    </div>
  );
};
