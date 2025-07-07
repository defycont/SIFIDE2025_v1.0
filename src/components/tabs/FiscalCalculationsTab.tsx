import React, { useState, useEffect } from 'react';

const FiscalCalculationsTab: React.FC = () => {
  // Estados para los inputs
  const [importeOriginal, setImporteOriginal] = useState(10000);
  const [fechaVencimiento, setFechaVencimiento] = useState("2023-05-15");
  const [fechaPago, setFechaPago] = useState("2025-07-02");

  // Estados para los resultados
  const [factorActualizacion, setFactorActualizacion] = useState(0);
  const [montoActualizado, setMontoActualizado] = useState(0);
  const [mesesAtraso, setMesesAtraso] = useState(0);
  const [recargos, setRecargos] = useState(0);
  const [total, setTotal] = useState(0);

  // INPC reales (ejemplo, deben venir de API o tabla precargada)
  // TODO: Consumir automáticamente INPC desde el portal del SAT con una API propia.
  const inpcData = {
    "2023-04": 126.5,  // mes anterior al vencimiento
    "2025-06": 139.2   // mes anterior al pago
  };

  const tasaMensual = 0.0147; // 1.47% mensual

  useEffect(() => {
    try {
      const vencimientoDate = new Date(fechaVencimiento);
      const pagoDate = new Date(fechaPago);

      // Paso 1: Obtener claves INPC
      const getClaveINPC = (fecha: Date) => {
        const y = fecha.getFullYear();
        const m = fecha.getMonth(); // getMonth es 0-indexed
        return `${y}-${(m + 1).toString().padStart(2, "0")}`;
      };

      const claveInicio = getClaveINPC(new Date(vencimientoDate.getFullYear(), vencimientoDate.getMonth() - 1));
      const claveFin = getClaveINPC(new Date(pagoDate.getFullYear(), pagoDate.getMonth() - 1));

      // Paso 2: Factor de actualización
      const inpcInicio = inpcData[claveInicio as keyof typeof inpcData];
      const inpcFin = inpcData[claveFin as keyof typeof inpcData];

      if (!inpcInicio || !inpcFin) {
        throw new Error("Datos INPC incompletos para las fechas especificadas.");
      }

      const calculatedFactorActualizacion = inpcFin / inpcInicio;
      setFactorActualizacion(calculatedFactorActualizacion);

      // Paso 3: Monto actualizado
      const calculatedMontoActualizado = importeOriginal * calculatedFactorActualizacion;
      setMontoActualizado(calculatedMontoActualizado);

      // Paso 4: Número de meses de atraso
      const calculatedDiferenciaMeses = (pagoDate.getFullYear() - vencimientoDate.getFullYear()) * 12 +
                                      (pagoDate.getMonth() - vencimientoDate.getMonth());
      setMesesAtraso(calculatedDiferenciaMeses);

      // Paso 5: Recargos
      const calculatedRecargos = calculatedMontoActualizado * tasaMensual * calculatedDiferenciaMeses;
      setRecargos(calculatedRecargos);

      // Paso 6: Total a pagar
      const calculatedTotal = calculatedMontoActualizado + calculatedRecargos;
      setTotal(calculatedTotal);

    } catch (error: any) {
      console.error("Error calculando:", error.message);
      // Opcional: mostrar un mensaje de error en la UI
    }
  }, [importeOriginal, fechaVencimiento, fechaPago, inpcData, tasaMensual]); // Dependencias del efecto

  return (
    <div className="p-4">
      <h2 className="text-2xl font-bold mb-4">Cálculo de Adeudos Fiscales</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div>
          <label htmlFor="importeOriginal" className="block text-sm font-medium text-gray-700">Importe Original:</label>
          <input
            type="number"
            id="importeOriginal"
            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
            value={importeOriginal}
            onChange={(e) => setImporteOriginal(parseFloat(e.target.value))}
          />
        </div>
        <div>
          <label htmlFor="fechaVencimiento" className="block text-sm font-medium text-gray-700">Fecha de Vencimiento:</label>
          <input
            type="date"
            id="fechaVencimiento"
            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
            value={fechaVencimiento}
            onChange={(e) => setFechaVencimiento(e.target.value)}
          />
        </div>
        <div>
          <label htmlFor="fechaPago" className="block text-sm font-medium text-gray-700">Fecha de Pago:</label>
          <input
            type="date"
            id="fechaPago"
            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
            value={fechaPago}
            onChange={(e) => setFechaPago(e.target.value)}
          />
        </div>
      </div>

      <div className="bg-gray-100 p-4 rounded-md">
        <h3 className="text-xl font-semibold mb-2">Resultados:</h3>
        <p><strong>Importe Original:</strong> {importeOriginal.toFixed(2)}</p>
        <p><strong>Factor de Actualización:</strong> {factorActualizacion.toFixed(3)}</p>
        <p><strong>Monto Actualizado:</strong> {montoActualizado.toFixed(2)}</p>
        <p><strong>Meses de Atraso:</strong> {mesesAtraso}</p>
        <p><strong>Recargos:</strong> {recargos.toFixed(2)}</p>
        <p className="text-lg font-bold"><strong>Total a Pagar:</strong> {total.toFixed(2)}</p>
      </div>

      {/* TODO: Mostrar desglose mensual de recargos y actualización (interfaz detallada). */}
      {/* TODO: Visualizar en React con tablas y gráficos (ej. Chart.js o recharts). */}
      {/* TODO: Incluir validación por tipo de contribución o tasa reducida si aplica. */}
    </div>
  );
};

export default FiscalCalculationsTab;