-- El parser de SMS (smsParser.mjs) ahora reconoce depósitos/abonos
-- ("*Davivienda Abono*... Monto:$X") como transaction_type 'deposito', pero
-- el check constraint de sms_inbox solo permitía compra/retiro/pago — el
-- insert fallaba en silencio (simulateIncomingSms no surfacea el error) y el
-- depósito nunca se guardaba en el backend, aunque el estado local optimista
-- sí lo mostrara como pendiente.

alter table sms_inbox drop constraint sms_inbox_parsed_transaction_type_check;
alter table sms_inbox add constraint sms_inbox_parsed_transaction_type_check
  check (parsed_transaction_type in ('compra', 'retiro', 'pago', 'deposito'));
