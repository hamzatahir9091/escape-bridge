const DEVICE_ID_KEY = "bridge_device_id";

export function getDeviceID(): string {
    let deviceId = localStorage.getItem(DEVICE_ID_KEY)

    if (!deviceId) {
        deviceId = crypto.randomUUID();

        localStorage.setItem(DEVICE_ID_KEY, deviceId)
    }

    return deviceId
}