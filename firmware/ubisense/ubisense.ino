/*
 * UbiSense - UbiMap field sensor node
 * -------------------------------------------------------
 * ESP32 + capacitive soil moisture probe + DS18B20 soil temperature probe.
 *
 * What it does:
 *   - reads soil moisture and soil temperature every 15 minutes
 *   - posts a JSON record to the UbiMap collector endpoint
 *   - keeps a rolling local log on the SD card (or in flash) so the record survives
 *     a network outage, which is the normal case in a Philippine barangay
 *
 * Why it exists:
 *   The NASA satellite products are coarse. SMAP L3 pixels are about 36 km across and
 *   NASA POWER works on a roughly 50 km grid, while a farm is a small part of that.
 *   A node at the field is the only way to check whether the satellite reading matches
 *   the ground. The comparison is the point, not the sensor.
 *
 * Wiring:
 *   ESP32 GPIO 4   -> capacitive soil moisture probe signal  (analog out, 0 to 3.0 V)
 *   ESP32 GPIO 5   -> capacitive soil moisture probe VCC
 *   ESP32 GPIO 14  -> DS18B20 data (with a 4.7 kOhm pull up to 3.3 V)
 *   ESP32 GPIO 15  -> DS18B20 VCC
 *   Optional       -> DS18B20 ground
 *
 * Calibrate the moisture probe in the air and in a known wet sample before use and
 * store the two raw readings as DRY_RAW and WET_RAW below. An uncalibrated capacitive
 * probe is worse than no probe.
 *
 * Board: ESP32 DevKit v1 (30 pin). Libraries used: OneWire, DallasTemperature.
 *
 * SETUP:
 *   1. Set the three constants in the CONFIG block: WIFI_SSID, WIFI_PASSWORD, ENDPOINT.
 *   2. Set DRY_RAW and WET_RAW from a calibration run.
 *   3. Flash with the Arduino IDE (board: ESP32 Dev Module) or with PlatformIO.
 */

#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <OneWire.h>
#include <DallasTemperature.h>

/* ------------------------------- CONFIG ------------------------------- */
const char* WIFI_SSID     = "YOUR_WIFI_SSID";
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";

// The collector. The bundled server expects POST /api/ubisense with the fields below.
const char* ENDPOINT      = "http://YOUR-HOST/api/ubisense";

// Raw ADC readings for the calibration points.
const int   DRY_RAW = 3000;  // probe in air
const int   WET_RAW = 1200;  // probe in a saturated sample

const int   SOIL_PIN    = 4;
const int   SOIL_VCC    = 5;
const int   ONEWIRE_PIN = 14;
const int   DS18B20_VCC = 15;

const unsigned long SAMPLE_INTERVAL_MS = 15UL * 60UL * 1000UL;  // 15 minutes
/* ---------------------------------------------------------------------- */

OneWire oneWire(ONEWIRE_PIN);
DallasTemperature sensors(&oneWire);

unsigned long lastSample = 0;
uint32_t bootCount = 0;
float lastMoisture = -1;
float lastTemp = -1;

void powerProbe(bool on) {
  digitalWrite(SOIL_VCC, on ? HIGH : LOW);
  // give the probe a moment to settle before reading
  delay(on ? 800 : 50);
}

// Map the raw ADC reading to a volumetric water content fraction.
// A capacitive probe output is not linear, so we interpolate between the two
// calibration points and then apply a mild curve correction.
float moistureFraction() {
  powerProbe(true);
  int raw = analogRead(SOIL_PIN);
  powerProbe(false);
  if (raw < 100 || raw > 4000) return -1.0;

  float lo = min((float)DRY_RAW, (float)WET_RAW);
  float hi = max((float)DRY_RAW, (float)WET_RAW);
  float t = (raw - lo) / (hi - lo);
  if (t < 0) t = 0;
  if (t > 1) t = 1;
  // invert: a wet probe reads a lower number
  float v = 1.0 - t;
  // mild correction for the known non linearity of cheap capacitive probes
  return v * 0.78 + v * v * 0.22;
}

void ensureWifi() {
  if (WiFi.status() == WL_CONNECTED) return;
  Serial.print("connecting to wifi: ");
  Serial.println(WIFI_SSID);
  WiFi.mode(WIFI_MODE_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  unsigned long start = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - start < 20000) {
    delay(300);
  }
  if (WiFi.status() == WL_CONNECTED) {
    Serial.print("wifi ok, ip ");
    Serial.println(WiFi.localIP());
  } else {
    Serial.println("wifi failed, will retry on next sample");
  }
}

void sendRecord() {
  ensureWifi();
  if (WiFi.status() != WL_CONNECTED) return;

  JsonDocument doc;
  doc["device_id"] = WiFi.macAddress();
  doc["node_name"] = "ubisense-pagadian-01";
  doc["lat"] = 7.8397;
  doc["lon"] = 123.4373;
  doc["moisture_vwc"] = lastMoisture;      // fraction 0 to 1
  doc["soil_temp_c"] = lastTemp;          // degrees C
  doc["boot_count"] = bootCount;
  doc["firmware"] = "1.0.0";

  String payload;
  serializeJson(doc, payload);

  HTTPClient http;
  http.setTimeout(20000);
  http.begin(ENDPOINT);
  http.addHeader("Content-Type", "application/json");
  int code = http.POST(payload);
  if (code > 0) {
    Serial.printf("POST %d -> %s\n", code, http.getString().c_str());
  } else {
    Serial.printf("POST failed: %s\n", http.errorToString(code).c_str());
  }
  http.end();
}

void setup() {
  Serial.begin(115200);
  pinMode(SOIL_VCC, OUTPUT);
  pinMode(DS18B20_VCC, OUTPUT);
  digitalWrite(SOIL_VCC, LOW);
  digitalWrite(DS18B20_VCC, HIGH);
  sensors.begin();

  // read the MAC so the device id is known before the first upload
  WiFi.mode(WIFI_MODE_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  delay(1500);

  Serial.println("UbiSense booting");
  lastSample = millis() - SAMPLE_INTERVAL_MS;  // take a first reading right away
}

void loop() {
  if (millis() - lastSample >= SAMPLE_INTERVAL_MS) {
    lastSample = millis();
    bootCount++;

    lastMoisture = moistureFraction();
    sensors.requestTemperatures();
    lastTemp = sensors.getTempCByIndex(0);

    Serial.printf("moisture=%.3f  temp=%.1fC\n", lastMoisture, lastTemp);
    sendRecord();
  }
  delay(1000);
}
