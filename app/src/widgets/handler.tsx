import React from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { WidgetTaskHandlerProps } from 'react-native-android-widget';
import { BasaltTodayWidget } from './BasaltTodayWidget';
import { parseSnapshot } from './widgetModel';

// Headless widget task — reads the last snapshot Today wrote and renders.
// No network, no auth in the background task: the widget is a mirror of
// the app's own last computation, stamped with its age.

export const WIDGET_SNAPSHOT_KEY = 'basalt.widgetSnapshot';

export async function widgetTaskHandler(props: WidgetTaskHandlerProps): Promise<void> {
  const snapshot = parseSnapshot(await AsyncStorage.getItem(WIDGET_SNAPSHOT_KEY));
  props.renderWidget(<BasaltTodayWidget snapshot={snapshot} nowMs={Date.now()} />);
}
