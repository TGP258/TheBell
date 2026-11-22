import { registerPlugin } from '@capacitor/core';

export interface PlatformInfo {
  /** 平台名 + 系统版本，如 "PadOS 13"、"Android 14"、"iPadOS 17.5"、"Web 预览" */
  name: string;
  /** 厂商 UI 版本（如 HyperOS / MIUI），获取不到时不显示 */
  ui?: string;
}

interface DeviceInfoBridge {
  info(): Promise<{
    osVersion: string;
    manufacturer: string;
    model: string;
    isTablet: boolean;
    uiVersion: string;
  }>;
}

const DeviceInfo = registerPlugin<DeviceInfoBridge>('DeviceInfo');

/** 浏览器或桥不可用时的降级：从 User-Agent 解析 */
function fromUserAgent(): PlatformInfo {
  const ua = navigator.userAgent;
  const iPad =
    /iPad/.test(ua) ||
    (/Macintosh/.test(ua) && (navigator.maxTouchPoints ?? 0) > 1);
  const android = /Android (\d+(?:\.\d+)*)/.exec(ua);
  if (android) {
    return { name: `Android ${android[1]}` };
  }
  const ios = /OS (\d+(?:_\d+)*) like Mac OS X/.exec(ua);
  if (ios) {
    return { name: `${iPad ? 'iPadOS' : 'iOS'} ${ios[1].replace(/_/g, '.')}` };
  }
  return { name: 'Web 预览' };
}

/** 厂商属性值转显示名：小米 HyperOS 属性值为 "OS1.0" 这类，MIUI 为 "V14" */
function uiLabel(value: string): string | undefined {
  const v = (value ?? '').trim();
  if (!v) return undefined;
  const os = /^OS(\d+)/i.exec(v);
  if (os) return `HyperOS ${os[1]}`;
  const miui = /^V(\d+)/i.exec(v);
  if (miui) return `MIUI ${miui[1]}`;
  return v;
}

export async function platformInfo(): Promise<PlatformInfo> {
  try {
    const raw = await DeviceInfo.info();
    return { name: `Android ${raw.osVersion}`, ui: uiLabel(raw.uiVersion) };
  } catch {
    return fromUserAgent();
  }
}
