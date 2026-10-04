# Kipobot por WhatsApp

El mismo bot de captura de gastos de la app, por WhatsApp. Código: `api/whatsapp.js`
(webhook) y `api/_lib/expenseParser.js` (el motor, compartido con `api/parse-expense.js`).
Tarjeta en la app: Más → "Kipobot en WhatsApp" (`mobile/src/components/WhatsAppLinkCard.tsx`).

## Cómo lo usa la persona

1. En la app: **Más → Kipobot en WhatsApp → Vincular mi WhatsApp**. Muestra un código (15 min).
2. Manda `VINCULAR AB12CD34` al WhatsApp del bot (o toca "Abrir WhatsApp").
3. Desde ahí, cualquier mensaje es un gasto: `Super Selectos 51` → el bot responde con el resumen.
   Si falta algo (p. ej. el monto) pregunta antes de guardar.
4. `espacio` lista sus espacios; `espacio 2` cambia a cuál se registra. Cada espacio es independiente.

Gastos con confianza baja/media quedan **pendientes** de confirmar en la app (igual que en el chat).

## Puesta en marcha (pruebas)

1. **Base de datos**: aplicar `supabase/migrations/0027_whatsapp_links.sql`.
2. **Meta**: https://developers.facebook.com → crear app tipo *Business* → agregar el producto
   *WhatsApp*. En *API Setup* aparecen un número de prueba, su **Phone number ID** y un token
   temporal; ahí mismo se agrega el número real de pruebas a la lista de destinatarios permitidos.
   Para un token que no venza: Business Settings → System users → generar token con permiso
   `whatsapp_business_messaging`.
3. **Variables en Vercel** (Settings → Environment Variables):

   | Variable | Valor |
   |---|---|
   | `WHATSAPP_VERIFY_TOKEN` | cualquier texto secreto que tú elijas |
   | `WHATSAPP_APP_SECRET` | App Settings → Basic → App secret |
   | `WHATSAPP_TOKEN` | token de acceso de la Cloud API |
   | `WHATSAPP_PHONE_NUMBER_ID` | Phone number ID de *API Setup* |
   | `SUPABASE_URL` | URL del proyecto de Supabase |
   | `SUPABASE_SERVICE_ROLE_KEY` | clave `service_role` (**solo servidor**, nunca en la app) |
   | `GEMINI_API_KEY` | ya existe (la usa `/api/parse-expense`) |
   | `EXPO_PUBLIC_WHATSAPP_NUMBER` | número del bot, solo dígitos con código de país (para el botón de la app) |

4. **Webhook**: en Meta → WhatsApp → Configuration → Callback URL
   `https://<tu-dominio>/api/whatsapp`, Verify token = `WHATSAPP_VERIFY_TOKEN`, y suscribirse al
   campo **messages**.
5. Probar: vincular desde la app y mandar un gasto.

## Notas de seguridad

- Cada request se valida con la firma `X-Hub-Signature-256` (HMAC con el App secret); sin firma válida → 401.
- El webhook usa `service_role` (se salta RLS), así que filtra a mano: solo opera sobre el espacio
  al que ese teléfono ya verificado tiene acceso activo.
- Un número solo se vincula con un código generado desde una sesión autenticada de la app.
- Límite de 20 mensajes/minuto por teléfono.
- Meta reintenta entregas: cada mensaje se deduplica por su `id` (`metadata.whatsapp_message_id`).

## Producción

El número de pruebas de Meta solo escribe a destinatarios agregados a mano. Para uso real hay que
verificar el negocio en Meta y registrar un número propio. Los mensajes que el bot responde dentro
de las 24 h posteriores a un mensaje de la persona no requieren plantilla; los que inicie el bot
por su cuenta (recordatorios) sí necesitan plantillas aprobadas.
