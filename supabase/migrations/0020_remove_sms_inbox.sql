-- Quita la lectura de SMS bancarios por completo: se reemplaza por Kipobot
-- (captura de gastos por chat interpretada con IA, ver api/parse-expense.js
-- y mobile/app/(tabs)/chat.tsx). Ya no hay ninguna pantalla ni permiso de
-- Android que lea/escriba sms_inbox — la tabla queda huérfana.
--
-- Nota: transactions.source todavía permite el valor 'sms' (no se toca ese
-- check constraint) para que las transacciones históricas creadas desde la
-- bandeja de SMS, si existen, se sigan mostrando bien — solo se quita la
-- tabla de la bandeja en sí y el permiso de Android para leer SMS.
drop table if exists sms_inbox cascade;

alter table devices drop column if exists sms_reader_enabled;
