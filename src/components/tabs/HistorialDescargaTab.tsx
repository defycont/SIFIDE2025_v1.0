
import React, { useState, useEffect, useMemo } from 'react';
import { MonthlyStatus, DailyStatus, DownloadDayStatusValue, AppConfig } from '../../types';
import { MESES_COMPLETOS } from '../../constants';
import { listarCFDIs, CfdiHistoryItem } from '../../apiService'; // Import API service

interface HistorialDescargaTabProps {
  activeRfc: string;
  currentConfig: AppConfig;
  onNavigateToXmlTools: () => void; // New prop for navigation
}

const STATUS_LEGEND: { status: DownloadDayStatusValue; label: string; color: string; textColor?: string }[] = [
  { status: 'not_attempted', label: 'Por Descargar', color: 'bg-slate-100 border border-slate-300', textColor: 'text-slate-500'},
  { status: 'error', label: 'Error al Descargar', color: 'bg-red-500 text-white', textColor: 'text-white' },
  { status: 'in_progress', label: 'Descarga en Proceso', color: 'bg-sky-300 text-sky-800', textColor: 'text-sky-800' },
  { status: 'success', label: 'Descarga Exitosa', color: 'bg-green-600 text-white', textColor: 'text-white' },
  { status: 'pending', label: 'Pendiente Verificación', color: 'bg-yellow-300 text-yellow-800', textColor: 'text-yellow-800'}
];

export const HistorialDescargaTab: React.FC<HistorialDescargaTabProps> = ({ activeRfc, currentConfig, onNavigateToXmlTools }) => {
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState<number>(currentConfig.ejercicioFiscal || currentYear);
  const [downloadHistory, setDownloadHistory] = useState<MonthlyStatus[]>([]);
  const [fielConfigured, setFielConfigured] = useState(true); // Mock status
  const [ciecConfigured, setCiecConfigured] = useState(false); // Mock status
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);

  useEffect(() => {
    setSelectedYear(currentConfig.ejercicioFiscal || new Date().getFullYear());
  }, [currentConfig.ejercicioFiscal]);
  
  const transformApiDataToMonthlyStatus = (apiData: CfdiHistoryItem[], year: number): MonthlyStatus[] => {
    const monthlyStatuses: MonthlyStatus[] = [];
    for (let monthIndex = 0; monthIndex < 12; monthIndex++) {
      const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
      const dailyStatuses: DailyStatus[] = [];
      for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const foundApiDay = apiData.find(d => d.fecha === dateStr);
        dailyStatuses.push({
          day: day,
          status: foundApiDay ? foundApiDay.status : 'not_attempted'
        });
      }
      monthlyStatuses.push({
        monthName: MESES_COMPLETOS[monthIndex],
        monthIndex: monthIndex,
        days: dailyStatuses
      });
    }
    return monthlyStatuses;
  };

  useEffect(() => {
    if (activeRfc && !activeRfc.startsWith("TEMP_NEW_RFC_")) {
      setIsLoadingHistory(true);
      setHistoryError(null);
      setDownloadHistory([]); // Clear previous data

      listarCFDIs(activeRfc, selectedYear)
        .then(apiData => {
          const transformedData = transformApiDataToMonthlyStatus(apiData, selectedYear);
          setDownloadHistory(transformedData);
        })
        .catch(error => {
          console.error(`Error fetching download history for RFC: ${activeRfc}, Year: ${selectedYear}`, error);
          setHistoryError(error.message || 'Error al cargar el historial de descargas.');
        })
        .finally(() => {
          setIsLoadingHistory(false);
        });
    } else {
      setDownloadHistory([]);
      setIsLoadingHistory(false);
      setHistoryError(null);
    }
  }, [activeRfc, selectedYear]);

  const handleYearChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedYear(parseInt(event.target.value, 10));
  };
  
  const getStatusColor = (status: DownloadDayStatusValue): string => {
    const legendItem = STATUS_LEGEND.find(s => s.status === status);
    return legendItem ? legendItem.color : 'bg-white border border-slate-300';
  };

  const yearOptions = useMemo(() => {
    const years = [];
    const currentFiscalYear = new Date().getFullYear();
    for (let y = currentFiscalYear + 1; y >= currentFiscalYear - 5; y--) {
      years.push(y);
    }
    return years;
  }, []);
  
  const displayGrid = useMemo(() => {
    return activeRfc && !activeRfc.startsWith("TEMP_NEW_RFC_");
  }, [activeRfc]);

  let gridContent;
  if (isLoadingHistory) {
    gridContent = (
      <div className="p-10 text-center text-slate-500 col-span-full min-h-[200px] flex flex-col items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500 mb-3"></div>
        Cargando historial de descargas...
      </div>
    );
  } else if (historyError) {
    gridContent = (
      <div className="p-10 text-center text-red-500 col-span-full min-h-[200px] flex flex-col items-center justify-center">
        <i className="fas fa-exclamation-triangle fa-lg mr-2 mb-2"></i>
        {historyError}
      </div>
    );
  } else if (!activeRfc || activeRfc.startsWith("TEMP_NEW_RFC_")) {
    gridContent = (
      <div className="p-10 text-center text-slate-500 col-span-full min-h-[200px] flex items-center justify-center">
        <i className="fas fa-info-circle fa-lg mr-2"></i> Seleccione un RFC válido para ver el historial.
      </div>
    );
  } else if (downloadHistory.length === 0 && !isLoadingHistory) { // Ensure not to show "No data" while loading
     gridContent = (
      <div className="p-10 text-center text-slate-500 col-span-full min-h-[200px] flex items-center justify-center">
        <i className="fas fa-history fa-lg mr-2"></i> No hay datos de historial de descarga disponibles para {activeRfc} en {selectedYear}. (Esperando datos del backend)
      </div>
    );
  } else {
    gridContent = (
      downloadHistory.map((monthData) => (
        <div key={monthData.monthIndex} className="flex">
          {monthData.days.map((dayStatus) => (
            <div
              key={dayStatus.day}
              title={`${dayStatus.day} ${monthData.monthName}: ${STATUS_LEGEND.find(s => s.status === dayStatus.status)?.label || 'Desconocido'}`}
              className={`w-8 h-8 border-b border-r border-slate-200 ${getStatusColor(dayStatus.status)} flex-shrink-0 transition-colors duration-150 hover:ring-2 hover:ring-blue-400 hover:z-20 relative`}
            >
              {/* Optional: Add a small dot or icon inside the cell for specific statuses */}
            </div>
          ))}
        </div>
      ))
    );
  }


  return (
    <div className="p-4 sm:p-6 bg-slate-50 rounded-lg shadow-md mt-4">
      <nav className="text-sm mb-4 text-slate-500" aria-label="Breadcrumb">
        <ol className="list-none p-0 inline-flex">
          <li className="flex items-center">
            <span className="hover:text-blue-600">Auditoría</span>
          </li>
          <li className="flex items-center">
            <span className="mx-2">/</span>
            <span>Historial Descarga</span>
          </li>
        </ol>
      </nav>

      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div className="flex gap-2">
          <button 
            onClick={() => alert('Iniciar Descarga Automática SAT (funcionalidad no implementada)')}
            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-md text-sm shadow flex items-center transition-colors"
            title="Iniciar descarga automática programada o verificar estado."
            disabled={activeRfc.startsWith("TEMP_NEW_RFC_") || isLoadingHistory}
          >
            <i className="fas fa-cloud-download-alt mr-2"></i>Descarga Automatica SAT
          </button>
          <button 
            onClick={onNavigateToXmlTools} // Updated onClick handler
            className="bg-slate-600 hover:bg-slate-700 text-white font-semibold py-2 px-4 rounded-md text-sm shadow flex items-center transition-colors"
            disabled={activeRfc.startsWith("TEMP_NEW_RFC_") || isLoadingHistory}
          >
            <i className="fas fa-upload mr-2"></i>Carga manual CFDis
          </button>
        </div>
        <div className="flex gap-4 items-center text-xs">
          <span 
            className={`px-3 py-1 rounded-full font-medium flex items-center ${fielConfigured ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}
            title={fielConfigured ? 'Configuración FIEL activa' : 'Configuración FIEL pendiente'}
            >
            <span className={`w-2 h-2 rounded-full mr-2 ${fielConfigured ? 'bg-green-500' : 'bg-red-500'}`}></span>
            Configuración FIEL
          </span>
          <span 
            className={`px-3 py-1 rounded-full font-medium flex items-center ${ciecConfigured ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}
            title={ciecConfigured ? 'Configuración Contraseña (antes CIEC) activa' : 'Configuración Contraseña (antes CIEC) pendiente'}
            >
            <span className={`w-2 h-2 rounded-full mr-2 ${ciecConfigured ? 'bg-green-500' : 'bg-red-500'}`}></span>
            Configuración Contraseña (Antes CIEC)
          </span>
        </div>
      </div>
      
      <div className="mb-4 flex items-center">
        <label htmlFor="year-selector" className="mr-2 text-sm font-medium text-slate-700">Año:</label>
        <select
          id="year-selector"
          value={selectedYear}
          onChange={handleYearChange}
          className="p-2 border border-slate-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-sm"
          disabled={isLoadingHistory}
        >
          {yearOptions.map(year => (
            <option key={year} value={year}>{year}</option>
          ))}
        </select>
      </div>

      <div className="overflow-x-auto bg-white p-2 rounded-md shadow">
        <div className="inline-block min-w-full align-middle">
            <div className="flex">
                <div className="w-24 sticky left-0 bg-white z-10">
                    <div className="h-8 border-b border-r border-slate-200"></div> 
                    {MESES_COMPLETOS.map((monthName) => (
                    <div key={monthName} className="h-8 flex items-center justify-start pl-2 text-xs font-medium text-slate-600 border-r border-b border-slate-200 sticky left-0 bg-white truncate" title={monthName}>
                        {monthName}
                    </div>
                    ))}
                </div>
                <div className="flex-grow overflow-x-auto">
                    <div className="flex sticky top-0 bg-white z-10">
                    {Array.from({ length: 31 }, (_, i) => i + 1).map(day => (
                        <div key={day} className="w-8 h-8 flex items-center justify-center text-xs font-medium text-slate-500 border-b border-r border-slate-200 flex-shrink-0">
                        {day}
                        </div>
                    ))}
                    </div>
                    {displayGrid ? gridContent : (
                         <div className="p-10 text-center text-slate-500 col-span-full min-h-[200px] flex items-center justify-center">
                            <i className="fas fa-info-circle fa-lg mr-2"></i> Seleccione un RFC válido para ver el historial.
                         </div>
                    )}
                </div>
            </div>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap justify-center gap-x-6 gap-y-2 text-xs">
        {STATUS_LEGEND.map(item => (
          <div key={item.status} className="flex items-center">
            <span className={`w-3 h-3 rounded-sm mr-1.5 ${item.color}`}></span>
            <span className="text-slate-600">{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
};
