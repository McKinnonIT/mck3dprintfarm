/**
 * Fields safe to return from endpoints the public dashboard can reach
 * without authentication. Deliberately excludes apiKey and serialNumber -
 * everything else here is just display/status data.
 */
export const PUBLIC_PRINTER_SELECT = {
  id: true,
  name: true,
  type: true,
  status: true,
  operationalStatus: true,
  lastSeen: true,
  webcamUrl: true,
  hlsUrl: true,
  webrtcUrl: true,
  cameraStreamMode: true,
  printImageUrl: true,
  printJobName: true,
  currentJobFilename: true,
  bedTemp: true,
  toolTemp: true,
  printStartTime: true,
  printTimeElapsed: true,
  printTimeRemaining: true,
  groupId: true,
  machineProfileId: true,
} as const;
