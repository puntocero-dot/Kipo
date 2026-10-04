// React Native's <Alert> no tiene implementación real en web (no muestra
// nada — ni error, ni diálogo, simplemente no pasa nada). Como esta app
// corre en las tres plataformas, cualquier Alert.alert() usado para
// confirmar una acción destructiva o avisar un error queda mudo en la
// versión web si no se pasa por aquí primero.
import { Alert, Platform } from 'react-native';

export function notify(title: string, message?: string) {
  if (Platform.OS === 'web') {
    window.alert(message ? `${title}\n\n${message}` : title);
    return;
  }
  Alert.alert(title, message);
}

export function confirmAction(title: string, message: string, confirmLabel: string, onConfirm: () => void, destructive = true) {
  if (Platform.OS === 'web') {
    if (window.confirm(`${title}\n\n${message}`)) onConfirm();
    return;
  }
  Alert.alert(title, message, [
    { text: 'Cancelar', style: 'cancel' },
    { text: confirmLabel, style: destructive ? 'destructive' : 'default', onPress: onConfirm },
  ]);
}

// En web, react-native-web marca la app con aria-hidden al abrir un <Modal>;
// si el botón que lo abrió sigue enfocado, el navegador avisa en consola
// ("Blocked aria-hidden on an element because its descendant retained
// focus"). Quitar el foco antes de mostrar el modal lo evita.
export function blurActiveElement() {
  if (Platform.OS === 'web' && typeof document !== 'undefined') {
    (document.activeElement as HTMLElement | null)?.blur?.();
  }
}
