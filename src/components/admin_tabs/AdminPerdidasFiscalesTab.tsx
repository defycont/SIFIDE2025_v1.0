import React, { useState, useEffect } from 'react';

// --- COMPONENTE 1: DATOS INPC ---
const inpcData = [
  // Fuente: INEGI, Base 2a Quincena de Julio 2018 = 100
  { mesAno: '01/2018', valor: 98.795000 }, { mesAno: '02/2018', valor: 99.171374 },
  { mesAno: '03/2018', valor: 99.492157 }, { mesAno: '04/2018', valor: 99.154847 },
  { mesAno: '05/2018', valor: 98.994080 }, { mesAno: '06/2018', valor: 99.376465 },
  { mesAno: '07/2018', valor: 99.909000 }, { mesAno: '08/2018', valor: 100.492000 },
  { mesAno: '09/2018', valor: 100.917000 }, { mesAno: '10/2018', valor: 101.440000 },
  { mesAno: '11/2018', valor: 102.303000 }, { mesAno: '12/2018', valor: 103.020000 },
  // 2019
  { mesAno: '01/2019', valor: 103.108000 }, { mesAno: '02/2019', valor: 103.079000 },
  { mesAno: '03/2019', valor: 103.476000 }, { mesAno: '04/2019', valor: 103.531000 },
  { mesAno: '05/2019', valor: 103.233000 }, { mesAno: '06/2019', valor: 103.299000 },
  { mesAno: '07/2019', valor: 103.687000 }, { mesAno: '08/2019', valor: 103.670000 },
  { mesAno: '09/2019', valor: 103.942000 }, { mesAno: '10/2019', valor: 104.503000 },
  { mesAno: '11/2019', valor: 105.346000 }, { mesAno: '12/2019', valor: 105.934000 },
  // 2020
  { mesAno: '01/2020', valor: 106.447000 }, { mesAno: '02/2020', valor: 106.889000 },
  { mesAno: '03/2020', valor: 106.838000 }, { mesAno: '04/2020', valor: 105.755000 },
  { mesAno: '05/2020', valor: 106.162000 }, { mesAno: '06/2020', valor: 106.743000 },
  { mesAno: '07/2020', valor: 107.444000 }, { mesAno: '08/2020', valor: 107.867000 },
  { mesAno: '09/2020', valor: 108.114000 }, { mesAno: '10/2020', valor: 108.774000 },
  { mesAno: '11/2020', valor: 108.856000 }, { mesAno: '12/2020', valor: 109.271000 },
  // 2021
  { mesAno: '01/2021', valor: 110.210000 }, { mesAno: '02/2021', valor: 110.907000 },
  { mesAno: '03/2021', valor: 111.824000 }, { mesAno: '04/2021', valor: 112.190000 },
  { mesAno: '05/2021', valor: 112.419000 }, { mesAno: '06/2021', valor: 113.018000 },
  { mesAno: '07/2021', valor: 113.682000 }, { mesAno: '08/2021', valor: 113.899000 },
  { mesAno: '09/2021', valor: 114.601000 }, { mesAno: '10/2021', valor: 115.561000 },
  { mesAno: '11/2021', valor: 116.884000 }, { mesAno: '12/2021', valor: 117.308000 },
  // 2022
  { mesAno: '01/2022', valor: 118.002000 }, { mesAno: '02/2022', valor: 118.981000 },
  { mesAno: '03/2022', valor: 120.159000 }, { mesAno: '04/2022', valor: 120.809000 },
  { mesAno: '05/2022', valor: 121.022000 }, { mesAno: '06/2022', valor: 122.044000 },
  { mesAno: '07/2022', valor: 122.948000 }, { mesAno: '08/2022', valor: 123.803000 },
  { mesAno: '09/2022', valor: 124.571000 }, { mesAno: '10/2022', valor: 125.276000 },
  { mesAno: '11/2022', valor: 125.997000 }, { mesAno: '12/2022', valor: 126.478000 },
  // 2023
  { mesAno: '01/2023', valor: 127.336000 }, { mesAno: '02/2023', valor: 128.046000 },
  { mesAno: '03/2023', valor: 128.389000 }, { mesAno: '04/2023', valor: 128.363000 },
  { mesAno: '05/2023', valor: 128.084000 }, { mesAno: '06/2023', valor: 128.214000 },
  { mesAno: '07/2023', valor: 128.832000 }, { mesAno: '08/2023', valor: 129.545000 },
  { mesAno: '09/2023', valor: 130.120000 }, { mesAno: '10/2023', valor: 130.609000 },
  { mesAno: '11/2023', valor: 131.445000 }, { mesAno: '12/2023', valor: 132.373000 },
  // 2024
  { mesAno: '01/2024', valor: 133.555000 }, { mesAno: '02/2024', valor: 133.681000 },
  { mesAno: '03/2024', valor: 134.065000 }, { mesAno: '04/2024', valor: 134.336000 },
  { mesAno: '05/2024', valor: 134.087000 }, { mesAno: '06/2024', valor: 134.594000 },
  { mesAno: '12/2024', valor: 137.949000 },
  // 2025
  { mesAno: '01/2025', valor: 138.343000 }, { mesAno: '02/2025', valor: 138.726000 },
  { mesAno: '03/2025', valor: 139.161000 }, { mesAno: '04/2025', valor: 139.620000 },
  { mesAno: '05/2025', valor: 140.012000 }, { mesAno: '06/2025', valor: 140.500000 },
];

const INPCTab = ({ data }) => (
  <div className="p-6 text-slate-700"> {/* Reemplaza .tab-content por clases Tailwind */}
    <h2 className="text-xl font-bold mb-4">Tabla de Datos - INPC</h2>
    <p className="mb-4 text-sm text-slate-600">Fuente de verdad para el Índice Nacional de Precios al Consumidor (Base 2a Quincena de Julio 2018 = 100).</p>
    <div className="overflow-x-auto border border-slate-300 rounded-lg shadow-sm"> {/* Reemplaza .table-container */}
      <table className="min-w-full divide-y divide-slate-200">
        <thead className="bg-slate-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Mes/Año (MM/YYYY)</th>
            <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">Valor</th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-slate-200">
          {data.map((item, index) => (
            <tr key={index} className="hover:bg-slate-50">
              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900">{item.mesAno}</td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-800 text-right font-mono">{item.valor.toFixed(6)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
);

// --- COMPONENTE 2: PESTAÑA DE ENTRADA DE DATOS ---
const PastDataTab = ({ losses, setLosses }) => {
  const handleLossChange = (index: number, field: string, value: string) => {
    const newLosses = [...losses];
    newLosses[index][field] = value;
    setLosses(newLosses);
  };

  const addLossRow = () => {
    if (losses.length < 10) {
      setLosses([...losses, { anio: '', monto: '' }]);
    }
  };
  
  const removeLossRow = (index: number) => {
    const newLosses = losses.filter((_, i) => i !== index);
    setLosses(newLosses);
  };

  return (
    <div className="p-6 text-slate-700"> {/* Reemplaza .tab-content */}
      <h2 className="text-xl font-bold mb-4">Datos de Periodos Anteriores</h2>
      <div className="bg-white border border-slate-200 p-6 rounded-lg shadow-sm mt-4"> {/* Reemplaza .form-section */}
        <h3 className="text-lg font-semibold text-slate-800 pb-3 mb-4 border-b-2 border-blue-500">Registro de Pérdidas Fiscales Históricas</h3>
        {losses.map((loss, index) => (
          <div key={index} className="grid grid-cols-auto-1fr-1fr-auto items-center gap-4 mb-4 p-3 bg-slate-50 rounded-md"> {/* Reemplaza .loss-row */}
            <span className="font-medium text-slate-700">Pérdida {index + 1}:</span>
            <input
              type="number"
              placeholder="Año de la Pérdida"
              value={loss.anio}
              onChange={(e) => handleLossChange(index, 'anio', e.target.value)}
              className="p-2 border border-slate-300 rounded-md text-sm w-full"
            />
            <input
              type="number"
              placeholder="Monto Original"
              value={loss.monto}
              onChange={(e) => handleLossChange(index, 'monto', e.target.value)}
              className="p-2 border border-slate-300 rounded-md text-sm w-full"
            />
            <button className="bg-red-500 hover:bg-red-600 text-white py-2 px-3 rounded-md text-sm transition-colors" onClick={() => removeLossRow(index)}>Eliminar</button>
          </div>
        ))}
        {losses.length < 10 && (
          <button onClick={addLossRow} className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-md transition-colors mt-4">+ Agregar Pérdida</button>
        )}
      </div>
    </div>
  );
};

// --- COMPONENTE 3: CÉDULA DE ISR Y LÓGICA DE CÁLCULO ---
interface INPCData {
  mesAno: string;
  valor: number;
}

interface HistoricalLoss {
  anio: string;
  monto: string;
}

const getInpc = (data: INPCData[], mes: number, anio: number) => {
  if (!mes || !anio) return null;
  const mesFormateado = String(mes).padStart(2, '0');
  const fecha = `${mesFormateado}/${anio}`;
  const record = data.find(d => d.mesAno === fecha);
  return record ? record.valor : null;
};

const formatCurrency = (value: number) => {
    return `$${(value || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const ISRCedula = ({ historicalLosses, inpcData }: { historicalLosses: HistoricalLoss[], inpcData: INPCData[] }) => {
  const [perdidaAplicableTotal, setPerdidaAplicableTotal] = useState(0);
  const [calculoDetallado, setCalculoDetallado] = useState<any[]>([]);
  const [anioDeAplicacion, setAnioDeAplicacion] = useState(2023); 

  useEffect(() => {
    const calcularPerdidaTotal = () => {
      let totalPerdidaAplicable = 0;
      const detallesCalculos: any[] = [];

      historicalLosses.forEach(perdida => {
        if (!perdida.anio || !perdida.monto || !anioDeAplicacion) {
          detallesCalculos.push({ anioPerdida: perdida.anio || '???', isEmpty: true });
          return;
        }

        const anioPerdida = parseInt(perdida.anio, 10);
        const montoOriginal = parseFloat(perdida.monto);

        // --- PASO A: Actualización al cierre del ejercicio de origen ---
        const inpcJulioOrigen = getInpc(inpcData, 7, anioPerdida);
        const inpcDicOrigen = getInpc(inpcData, 12, anioPerdida);

        if (!inpcJulioOrigen || !inpcDicOrigen) {
          detallesCalculos.push({ anioPerdida: anioPerdida, error: `Faltan valores de INPC para el año de origen ${anioPerdida}` });
          return;
        }
        
        const factorActualizacion1 = inpcDicOrigen / inpcJulioOrigen;
        const perdidaActualizadaCierre = montoOriginal * factorActualizacion1;

        // --- PASO B: Actualización para aplicación en el ejercicio actual ---
        const inpcDicUltimaActualizacion = inpcDicOrigen; 
        const inpcJunioAplicacion = getInpc(inpcData, 6, anioDeAplicacion);
        
        if (!inpcJunioAplicacion) {
          detallesCalculos.push({ anioPerdida: anioPerdida, error: `Falta valor de INPC para Junio del año de aplicación ${anioDeAplicacion}` });
          return;
        }

        const factorActualizacion2 = inpcJunioAplicacion / inpcDicUltimaActualizacion;
        const perdidaFinalAplicable = perdidaActualizadaCierre * factorActualizacion2;
        
        totalPerdidaAplicable += perdidaFinalAplicable;
        
        detallesCalculos.push({
          montoOriginal, anioPerdida, inpcJulioOrigen, inpcDicOrigen,
          factorActualizacion1, perdidaActualizadaCierre, anioDeAplicacion,
          inpcJunioAplicacion, inpcDicUltimaActualizacion, factorActualizacion2,
          perdidaFinalAplicable,
        });
      });

      setPerdidaAplicableTotal(totalPerdidaAplicable);
      setCalculoDetallado(detallesCalculos);
    };

    calcularPerdidaTotal();
  }, [historicalLosses, inpcData, anioDeAplicacion]); 

  const cedulaData = [
    { mes: `Junio ${anioDeAplicacion} (Escenario 1)`, baseGravableAcum: 800000 },
    { mes: `Junio ${anioDeAplicacion} (Escenario 2)`, baseGravableAcum: 400000 },
    { mes: `Julio ${anioDeAplicacion} (Simulación)`, baseGravableAcum: 300000 },
  ];
  
  let remanente = perdidaAplicableTotal;

  return (
    <div className="p-6 text-slate-700"> {/* Reemplaza .tab-content */}
      <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 flex items-center gap-4 mb-6"> {/* Reemplaza .config-section */}
        <label htmlFor="anio-aplicacion" className="font-semibold text-slate-700">Seleccionar Año de Aplicación:</label>
        <input 
          id="anio-aplicacion"
          type="number"
          placeholder="Ej. 2023"
          value={anioDeAplicacion}
          onChange={(e) => setAnioDeAplicacion(Number(e.target.value))}
          className="p-2 border border-slate-300 rounded-md text-sm w-32"
        />
      </div>

      <h2 className="text-xl font-bold mb-4">Cédula de ISR - Pagos Provisionales (Ejercicio {anioDeAplicacion || '...'})</h2>

      {calculoDetallado && calculoDetallado.length > 0 && (
        <div className="bg-slate-100 border border-slate-300 border-l-4 border-blue-500 p-5 my-6 rounded-lg"> {/* Reemplaza .calculation-details */}
          <h4 className="text-lg font-semibold text-slate-800 mb-4">Verificación del Cálculo (QA)</h4>
          {calculoDetallado.map((detalle, index) => {
            if (detalle.isEmpty) return null;
            if (detalle.error) return <p key={index} className="text-red-600 font-bold bg-red-100 border border-red-600 p-4 rounded-md mb-4">{detalle.error}</p>;
            return (
              <div key={index} className="pb-4 mb-4 last:border-b-0 last:pb-0 last:mb-0 border-b-2 border-slate-200">
                <p className="mb-2"><strong className="text-slate-800">Pérdida Original ({detalle.anioPerdida}):</strong> {formatCurrency(detalle.montoOriginal)}</p>
                <hr className="border-t border-dashed border-slate-400 my-4"/>
                <p className="mb-1 text-slate-700"><strong>Paso A: Actualización a Dic {detalle.anioPerdida}</strong></p>
                <p className="font-mono text-base mb-1">Factor 1 = {detalle.inpcDicOrigen} / {detalle.inpcJulioOrigen} = <strong className="text-blue-700">{detalle.factorActualizacion1.toFixed(4)}</strong></p>
                <p className="font-mono text-base">Pérdida Act. = {formatCurrency(detalle.montoOriginal)} &times; {detalle.factorActualizacion1.toFixed(4)} = <strong className="text-green-700">{formatCurrency(detalle.perdidaActualizadaCierre)}</strong></p>
                <hr className="border-t border-dashed border-slate-400 my-4"/>
                <p className="mb-1 text-slate-700"><strong>Paso B: Actualización para aplicar en {detalle.anioDeAplicacion}</strong></p>
                <p className="font-mono text-base mb-1">Factor 2 = {detalle.inpcJunioAplicacion} / {detalle.inpcDicUltimaActualizacion} = <strong className="text-blue-700">{detalle.factorActualizacion2.toFixed(4)}</strong></p>
                <p className="font-mono text-base">Pérdida Aplicable = {formatCurrency(detalle.perdidaActualizadaCierre)} &times; {detalle.factorActualizacion2.toFixed(4)} = <strong className="text-green-700">{formatCurrency(detalle.perdidaFinalAplicable)}</strong></p>
              </div>
            );
          })}
        </div>
      )}
      
      <div className="overflow-x-auto border border-slate-300 rounded-lg shadow-sm"> {/* Reemplaza .table-container */}
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Mes</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Base grav. acum</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Pérdidas Fiscales Actualizadas en el Periodo</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">Monto de Pérdida a Disminuir</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">Nueva Base Gravable</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">Remanente de Pérdida</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-slate-200">
            {cedulaData.map((row, index) => {
               const perdidaADisminuir = Math.min(remanente, row.baseGravableAcum);
               const nuevaBaseGravable = row.baseGravableAcum - perdidaADisminuir;
               const remanenteActual = remanente - perdidaADisminuir; 
               remanente -= perdidaADisminuir; // Acumulador para la siguiente fila

               return (
                <tr key={index} className="hover:bg-slate-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900">{row.mes}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-800 text-right font-mono">{formatCurrency(row.baseGravableAcum)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-800 text-right font-mono">{formatCurrency(perdidaAplicableTotal)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-bold bg-emerald-100 text-emerald-800">{formatCurrency(perdidaADisminuir)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-extrabold text-blue-700">{formatCurrency(nuevaBaseGravable)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-bold bg-amber-100 text-amber-800">{formatCurrency(remanenteActual)}</td>
                </tr>
               );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// --- COMPONENTE PRINCIPAL: AdminPerdidasFiscalesTab ---
export const AdminPerdidasFiscalesTab: React.FC = () => {
  const [activeTab, setActiveTab] = useState('cedula');
  
  const [historicalLosses, setHistoricalLosses] = useState([
    { anio: '2018', monto: '500000' },
    { anio: '2019', monto: '120000' }
  ]);

  const renderTabContent = () => {
    switch (activeTab) {
      case 'inpc':
        return <INPCTab data={inpcData} />;
      case 'pastData':
        return <PastDataTab losses={historicalLosses} setLosses={setHistoricalLosses} />;
      case 'cedula':
        return <ISRCedula historicalLosses={historicalLosses} inpcData={inpcData} />;
      default:
        return null;
    }
  };

  return (
    <div className="flex flex-col"> {/* Removido 'App', encabezado y footer generales */}
      <nav className="flex flex-wrap border-b border-slate-200">
        <button 
          onClick={() => setActiveTab('pastData')} 
          className={`py-3 px-5 border-b-4 transition-colors font-medium text-sm focus:outline-none 
            ${activeTab === 'pastData' ? 'border-blue-600 text-blue-700 bg-white' : 'border-transparent text-slate-600 hover:text-slate-800 hover:border-slate-300'}`}>
          1. Datos de Periodos Anteriores
        </button>
        <button 
          onClick={() => setActiveTab('cedula')} 
          className={`py-3 px-5 border-b-4 transition-colors font-medium text-sm focus:outline-none 
            ${activeTab === 'cedula' ? 'border-blue-600 text-blue-700 bg-white' : 'border-transparent text-slate-600 hover:text-slate-800 hover:border-slate-300'}`}>
          2. Cédula de ISR (Aplicación)
        </button>
        <button 
          onClick={() => setActiveTab('inpc')} 
          className={`py-3 px-5 border-b-4 transition-colors font-medium text-sm focus:outline-none 
            ${activeTab === 'inpc' ? 'border-blue-600 text-blue-700 bg-white' : 'border-transparent text-slate-600 hover:text-slate-800 hover:border-slate-300'}`}>
          3. Datos de Soporte (INPC)
        </button>
      </nav>
      <main className="p-4 sm:p-6 lg:p-8"> {/* Removido container mx-auto para anidarlo en AdminPanel */}
        {renderTabContent()}
      </main>
    </div>
  );
};