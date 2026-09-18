/*
  Chalukya AI · Smart parking node (ESP32 + 4 × HC-SR04 ultrasonic sensors)

  One node watches 4 parking slots. A car is "present" when the sensor, mounted overhead or at the
  slot's back wall, reads closer than OCCUPIED_CM for 3 consecutive readings (debounce).
  Every 30 s (and immediately on any change) the node POSTs JSON to the Chalukya AI server:
      {"node":"p_badami_caves","slots":[1,0,1,1],"capacity":4,"battery":3.9}
  Each slot also has a green/red LED so drivers see free slots on site.

  Wiring (per slot i):  TRIG -> TRIG_PINS[i], ECHO -> ECHO_PINS[i] (through a 1k/2k divider: HC-SR04 echo is 5 V),
                        VCC -> 5V (VIN), GND -> GND, LED green -> GREEN_PINS[i] (220 Ω), LED red -> RED_PINS[i] (220 Ω)
  Board: "ESP32 Dev Module" in Arduino IDE (esp32 core 2.x or 3.x). No extra libraries needed.
*/
#include <WiFi.h>
#include <HTTPClient.h>

const char* WIFI_SSID = "YOUR_HOTSPOT";
const char* WIFI_PASS = "YOUR_PASSWORD";
const char* SERVER    = "http://192.168.1.8:8300/api/iot";   // laptop IP printed by `python -m server`
const char* NODE_ID   = "p_badami_caves";

const int SLOTS = 4;
const int TRIG_PINS[SLOTS]  = {5, 18, 19, 21};
const int ECHO_PINS[SLOTS]  = {34, 35, 32, 33};
const int GREEN_PINS[SLOTS] = {13, 12, 14, 27};
const int RED_PINS[SLOTS]   = {26, 25, 23, 22};
const float OCCUPIED_CM = 60.0;
const unsigned long REPORT_MS = 30000;

int state[SLOTS] = {0}, streak[SLOTS] = {0};
unsigned long lastReport = 0;

float readCm(int trig, int echo) {
  digitalWrite(trig, LOW); delayMicroseconds(2);
  digitalWrite(trig, HIGH); delayMicroseconds(10); digitalWrite(trig, LOW);
  long us = pulseIn(echo, HIGH, 25000);            // 25 ms timeout ≈ 4 m
  return us == 0 ? 999.0 : us * 0.0343 / 2.0;
}

void report() {
  if (WiFi.status() != WL_CONNECTED) return;
  String body = String("{\"node\":\"") + NODE_ID + "\",\"capacity\":" + SLOTS + ",\"slots\":[";
  for (int i = 0; i < SLOTS; i++) { body += state[i]; if (i < SLOTS - 1) body += ","; }
  body += "],\"battery\":" + String(analogReadMilliVolts(36) * 2 / 1000.0, 2) + "}";
  HTTPClient http;
  http.begin(SERVER);
  http.addHeader("Content-Type", "application/json");
  int code = http.POST(body);
  Serial.printf("POST %d %s\n", code, body.c_str());
  http.end();
  lastReport = millis();
}

void setup() {
  Serial.begin(115200);
  for (int i = 0; i < SLOTS; i++) {
    pinMode(TRIG_PINS[i], OUTPUT); pinMode(ECHO_PINS[i], INPUT);
    pinMode(GREEN_PINS[i], OUTPUT); pinMode(RED_PINS[i], OUTPUT);
  }
  WiFi.begin(WIFI_SSID, WIFI_PASS);
  Serial.print("WiFi");
  for (int t = 0; t < 40 && WiFi.status() != WL_CONNECTED; t++) { delay(250); Serial.print("."); }
  Serial.println(WiFi.status() == WL_CONNECTED ? " connected" : " offline (LEDs still work)");
}

void loop() {
  bool changed = false;
  for (int i = 0; i < SLOTS; i++) {
    int present = readCm(TRIG_PINS[i], ECHO_PINS[i]) < OCCUPIED_CM ? 1 : 0;
    streak[i] = (present != state[i]) ? streak[i] + 1 : 0;
    if (streak[i] >= 3) { state[i] = present; streak[i] = 0; changed = true; }   // debounce
    digitalWrite(GREEN_PINS[i], state[i] ? LOW : HIGH);
    digitalWrite(RED_PINS[i], state[i] ? HIGH : LOW);
    delay(60);                                                                    // avoid ultrasonic cross-talk
  }
  if (changed || millis() - lastReport > REPORT_MS) report();
}
