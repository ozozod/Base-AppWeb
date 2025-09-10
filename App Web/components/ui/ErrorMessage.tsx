import React from 'react';
import { TransactionType } from '../../types';

interface ErrorMessageProps {
    error: string | null;
}

const CodeBlock: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <pre className="bg-gray-900 p-3 rounded-md mt-2 text-cyan-300 overflow-x-auto text-xs">
        <code>{children}</code>
    </pre>
);

const Hint: React.FC<{ children: React.ReactNode }> = ({ children }) => (
     <div className='mt-4 text-yellow-300 bg-yellow-900/50 p-3 rounded-md text-sm text-left'>
        <strong>Sugerencia:</strong>
        <div className="mt-2">{children}</div>
    </div>
);

export const ErrorMessage: React.FC<ErrorMessageProps> = ({ error }) => {
    if (!error) return null;

    let title = 'Ocurrió un Error';
    let details: React.ReactNode = <p>{error}</p>;

    const lowerCaseError = error.toLowerCase();

    if (lowerCaseError.includes('tabla "device_status" no se encuentra')) {
        title = 'Error de Base de Datos: Falta la Tabla de Dispositivos';
        details = (
            <>
                <p>La funcionalidad de 'Dispositivos' requiere una tabla adicional en la base de datos que no se ha encontrado.</p>
                <Hint>
                    <p className="mb-2">Para habilitar el monitoreo de dispositivos, necesitas crear la tabla <code>device_status</code>. Copia y ejecuta el siguiente comando SQL en tu herramienta de base de datos (como DBeaver, pgAdmin, o psql):</p>
                    <CodeBlock>
{`CREATE TABLE device_status (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id VARCHAR(255) UNIQUE NOT NULL,
    event_id UUID REFERENCES events(id) ON DELETE CASCADE,
    staff_id UUID REFERENCES staff(id) ON DELETE SET NULL,
    staff_name VARCHAR(255),
    battery_level INT,
    signal_strength INT,
    last_seen TIMESTAMPTZ NOT NULL DEFAULT NOW()
);`}
                    </CodeBlock>
                    <p className="mt-2">Después de crear la tabla, recarga esta página.</p>
                </Hint>
            </>
        );
    } else if (lowerCaseError.includes('transactions_type_check')) {
        title = 'Error de Base de Datos: Tipo de Transacción no Válido';
        details = (
            <>
                <p><strong>Causa del Problema:</strong></p>
                <p className="mt-2">
                    {/* FIX: Corrected enum from DEVOLUTION to REFUND */}
                    El error <strong>"viola la restricción «transactions_type_check»"</strong> significa que tu base de datos no permite guardar una transacción con el tipo <code>'{TransactionType.REFUND}'</code>. 
                    La regla de la tabla <code>transactions</code> solo permite ciertos valores (probablemente solo 'Venta' y 'Recarga').
                </p>
                <p className="mt-3"><strong>Solución (Acción Requerida):</strong></p>
                <p className="mt-1">
                    {/* FIX: Corrected enum from DEVOLUTION to REFUND */}
                    Para solucionarlo, necesitas ejecutar un comando SQL en tu base de datos PostgreSQL para añadir <code>'{TransactionType.REFUND}'</code> a la lista de tipos permitidos. 
                    Copia y ejecuta el siguiente comando en tu herramienta de base de datos (como DBeaver, pgAdmin, o psql):
                </p>
                <CodeBlock>
                    {`-- Primero, eliminamos la restricción existente
ALTER TABLE transactions DROP CONSTRAINT transactions_type_check;

-- Luego, la volvemos a crear con el nuevo valor '${/* FIX: Corrected enum from DEVOLUTION to REFUND */ TransactionType.REFUND}'
ALTER TABLE transactions ADD CONSTRAINT transactions_type_check CHECK (type IN ('Venta', 'Recarga', 'Devolución', 'Anulación'));`}
                </CodeBlock>
                <p className="mt-2">
                    <strong>Nota:</strong> Si usas otros tipos de transacción, asegúrate de incluirlos también en la lista <code>IN (...)</code>.
                </p>
            </>
        );
    } else if (lowerCaseError.includes('status 404') || lowerCaseError.includes('not found')) {
        title = 'Error de Conexión: Recurso no Encontrado (404)';
        details = (
            <>
                <p>La aplicación intentó acceder a un recurso en el servidor que no existe.</p>
                <Hint>
                    Un error '404 Not Found' significa que el servidor de la API está funcionando, pero no tiene las URLs específicas que la aplicación está solicitando. 
                    Por favor, revisa tu archivo de backend <strong>index.js</strong> y asegúrate de que la ruta para el endpoint que falla (por ejemplo, <code>/transactions</code>) exista y esté correctamente definida bajo <code>/api/events/:eventId/</code>.
                </Hint>
            </>
        );
    } else if (
        lowerCaseError.includes('internal server error') || 
        lowerCaseError.includes('error interno del servidor') || 
        lowerCaseError.includes('no existe la relación') // 'relation does not exist' in Spanish
    ) {
        title = 'Error Interno del Servidor (500)';
        details = (
            <>
                <p>Ocurrió un problema en el servidor de la API. El mensaje original fue: "{error}"</p>
                <Hint>
                    Este es un problema de la base de datos o del código del servidor. Revisa la consola de tu servidor API para ver los errores detallados (como "no existe la relación" o "table not found") y asegúrate de que los nombres de las tablas en las consultas SQL de tu código API coincidan exactamente con tu esquema de base de datos.
                </Hint>
            </>
        );
    } else if (lowerCaseError.includes('multiple data fetch errors occurred')) {
        title = 'Carga de Datos Parcial';
        const errorList = error.replace('Multiple data fetch errors occurred: [', '').slice(0,-1).split('; ');
        details = (
            <>
                <p>Algunos datos no se pudieron cargar, por lo que el dashboard puede estar incompleto. Errores encontrados:</p>
                <ul className="list-disc list-inside mt-2 text-red-300 text-left text-sm">
                    {errorList.map((e, i) => <li key={i}>- {e.trim()}</li>)}
                </ul>
            </>
        );
    } else if (lowerCaseError.includes('failed to fetch')) {
        title = 'Error de Conexión';
        details = (
             <>
                <p>No se pudo conectar con el servidor local de la API.</p>
                <Hint>
                    Asegúrate de que tu servidor local (<code>node index.js</code>) se esté ejecutando y que no haya errores en su consola. La aplicación web no puede funcionar sin él.
                </Hint>
            </>
        )
    }

    return (
        <div className="text-red-400 bg-red-900/50 p-4 rounded-md" role="alert">
            <h4 className="font-bold text-lg mb-2">{title}</h4>
            <div className="text-sm space-y-2">{details}</div>
        </div>
    );
};