import { useEffect, useState } from 'react';
import { Alert, Linking, Pressable } from 'react-native';
import { Card, ReceiptHeader, ReceiptRow, SrcNote, useTheme } from '@basalt/ui';
import { SERVICES, REGISTRATION_NOTE } from '../../lib/connectedServicesModel';
import {
  connect, disconnect, handleOauthUrl, isConnected, runImport, serviceAvailable,
} from '../../lib/connectedServices';

// Connected services (imports Extra) — three rows. Until the developer
// registrations exist the rows say so plainly and do nothing.

export function ConnectedServicesCard() {
  const { theme } = useTheme();
  const [connected, setConnected] = useState<Record<string, boolean>>({});

  const refresh = () => {
    for (const s of SERVICES) {
      void isConnected(s.id).then((on) => setConnected((c) => ({ ...c, [s.id]: on })));
    }
  };
  useEffect(() => {
    refresh();
    const sub = Linking.addEventListener('url', ({ url }) => {
      void handleOauthUrl(url).then((outcome) => {
        if (outcome) {
          Alert.alert('Connected services', outcome);
          refresh();
        }
      });
    });
    return () => sub.remove();
  }, []);

  const tap = async (id: (typeof SERVICES)[number]['id']) => {
    if (!serviceAvailable(id)) return;
    if (connected[id]) {
      Alert.alert('Disconnect?', 'Imported rows stay in your ledger; the token is deleted.', [
        { text: 'Keep it', style: 'cancel' },
        {
          text: 'Disconnect',
          style: 'destructive',
          onPress: () => void disconnect(id).then(refresh),
        },
      ]);
      return;
    }
    await connect(id);
  };

  return (
    <Card>
      <ReceiptHeader label="Connected services" summary="imports only — rows carry their source, Basalt never writes back" />
      {SERVICES.map((s, i) => {
        const available = serviceAvailable(s.id);
        const on = !!connected[s.id];
        return (
          <Pressable
            key={s.id}
            onPress={() => void tap(s.id)}
            onLongPress={() => {
              if (on) void runImport(s.id).then((r) => Alert.alert(s.name, r));
            }}
            disabled={!available}
            hitSlop={8}
          >
            <ReceiptRow
              name={s.name}
              meta={available ? s.reads : `${REGISTRATION_NOTE} (docs/REGISTRATIONS.md)`}
              value={available ? (on ? 'connected' : 'connect') : 'soon'}
              valueColor={on ? theme.text.carbs : theme.text.faint}
              last={i === SERVICES.length - 1}
            />
          </Pressable>
        );
      })}
      <SrcNote>OAuth in the service's own page · tokens stay on this phone, secrets stay on the server · long-press a connected row to re-run the import</SrcNote>
    </Card>
  );
}
