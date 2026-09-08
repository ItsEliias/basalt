import React from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { WidgetTaskHandlerProps } from 'react-native-android-widget';
import { BasaltTodayWidget } from './BasaltTodayWidget';
import { BasaltReadinessWidget, parseReadinessSnapshot } from './BasaltReadinessWidget';
import { parseSnapshot } from './widgetModel';

// Headless widget task — reads the last snapshot Today wrote and renders.
// No network, no auth in the background task: the widget is a mirror of
// the app's own last computation, stamped with its age.

export const WIDGET_SNAPSHOT_KEY = 'basalt.widgetSnapshot';
export const READINESS_SNAPSHOT_KEY = 'basalt.readinessSnapshot';

export async function widgetTaskHandler(props: WidgetTaskHandlerProps): Promise<void> {
  if (props.widgetInfo.widgetName === 'BasaltReadiness') {
    const snap = parseReadinessSnapshot(await AsyncStorage.getItem(READINESS_SNAPSHOT_KEY));
    props.renderWidget(<BasaltReadinessWidget snapshot={snap} nowMs={Date.now()} />);
    return;
  }
  const snapshot = parseSnapshot(await AsyncStorage.getItem(WIDGET_SNAPSHOT_KEY));
  props.renderWidget(<BasaltTodayWidget snapshot={snapshot} nowMs={Date.now()} />);
}
