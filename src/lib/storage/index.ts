import { Capacitor } from '@capacitor/core';
import type { StorageDriver } from './driver';
import { NativeDriver } from './native';
import { WebDriver } from './web';

export function createDriver(): StorageDriver {
  return Capacitor.isNativePlatform() ? new NativeDriver() : new WebDriver();
}

export type { StorageDriver } from './driver';
