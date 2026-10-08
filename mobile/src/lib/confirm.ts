import { Alert, Platform } from 'react-native';

/** Rückfrage mit Ja/Abbrechen – nativer Dialog auf dem Handy, Browser-Dialog in der Web-Vorschau. */
export function confirm(title: string, message: string | undefined, ok: string, onOk: () => void, destructive = false) {
  if (Platform.OS === 'web') {
    if (window.confirm([title, message].filter(Boolean).join('\n\n'))) onOk();
    return;
  }
  Alert.alert(title, message, [{ text: 'Abbrechen', style: 'cancel' }, { text: ok, style: destructive ? 'destructive' : 'default', onPress: onOk }]);
}
