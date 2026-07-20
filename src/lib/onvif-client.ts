import { Cam } from "onvif";

const ONVIF_TIMEOUT_MS = 8000;

export interface OnvifCredentials {
  host: string;
  port?: number | null;
  username: string;
  password: string;
}

export interface OnvifStreamInfo {
  uri: string;
  deviceInfo?: {
    manufacturer?: string;
    model?: string;
  };
}

/**
 * Connects to an ONVIF camera and fetches its RTSP stream URI (Profile S,
 * first/default media profile - good enough for a live view, no per-profile
 * picker). The URI ONVIF returns typically omits credentials (e.g.
 * "rtsp://192.168.1.50:554/stream1"), so they're injected here - Tapo
 * cameras reuse the same "camera account" username/password for both ONVIF
 * and RTSP auth.
 */
export function fetchOnvifStreamUri(credentials: OnvifCredentials): Promise<OnvifStreamInfo> {
  const { host, username, password } = credentials;
  const port = credentials.port || 2020;

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error(`Timed out connecting to ONVIF camera at ${host}:${port}`));
    }, ONVIF_TIMEOUT_MS);

    let settled = false;
    const settle = (fn: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      fn();
    };

    const cam = new Cam(
      { hostname: host, port, username, password, timeout: ONVIF_TIMEOUT_MS },
      (err: Error | null) => {
        if (err) {
          settle(() => reject(new Error(`Failed to connect to ONVIF camera at ${host}:${port}: ${err.message}`)));
          return;
        }

        cam.getStreamUri({ protocol: "RTSP" }, (streamErr: Error | null, stream: { uri: string }) => {
          if (streamErr || !stream?.uri) {
            settle(() =>
              reject(new Error(`Failed to get RTSP stream URI from ${host}:${port}: ${streamErr?.message || "no URI returned"}`))
            );
            return;
          }

          let uri: string;
          try {
            const parsed = new URL(stream.uri);
            parsed.username = encodeURIComponent(username);
            parsed.password = encodeURIComponent(password);
            uri = parsed.toString();
          } catch {
            settle(() => reject(new Error(`ONVIF camera returned an unusable stream URI: ${stream.uri}`)));
            return;
          }

          // Device info is a nice-to-have for the test-connection UI - don't
          // fail the whole thing if it's unavailable.
          cam.getDeviceInformation((infoErr: Error | null, info?: { manufacturer?: string; model?: string }) => {
            settle(() =>
              resolve({
                uri,
                deviceInfo: !infoErr && info ? { manufacturer: info.manufacturer, model: info.model } : undefined,
              })
            );
          });
        });
      }
    );
  });
}
