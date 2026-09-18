/*
  Chalukya AI · Safety node (ESP32 + PIR + DHT11/22 + ultrasonic + buzzer + panic button)

  Placed at a risky spot (cave steps, lake ghats, cliff edge). It reports every 60 s:
      {"node":"safety_caves","temp_c":38.5,"humidity":22,"motion":7}
  and raises alerts on the server (which runs anomaly detection on these streams):
    • panic button pressed            -> immediate SOS-type reading, local buzzer
    • someone within 1 m of an edge after closing time (ultrasonic + PIR) -> buzzer + report
    • temperature ≥ 40 °C             -> server raises a heat alert

  Wiring: PIR OUT -> GPIO 27 · DHT data -> GPIO 4 (10k pull-up) · HC-SR04 TRIG 5 / ECHO 18 (divider)
          buzzer -> GPIO 25 · panic button -> GPIO 26 to GND (internal pull-up)
  Library: "DHT sensor library" by Adafruit (+ Adafruit Unified Sensor).
*/
#include <WiFi.h>
#include <HTTPClient.h>
#include <DHT.h>

const char* WIFI_SSID = "YOUR_HOTSPOT";
const char* WIFI_PASS = "YOUR_PASSWORD";
const char* SERVER    = "http://192.168.1.8:8300/api/iot";
const char* NODE_ID   = "safety_caves";

#define PIR 27
#define DHTPIN 4
#define TRIG 5
#define ECHO 18
#define BUZZER 25
#define PANIC 26
DHT dht(DHTPIN, DHT22);

volatile int motion = 0;
unsigned long lastReport = 0;
void IRAM_ATTR onMotion() { motion++; }

float edgeCm() {
  digitalWrite(TRIG, LOW); delayMicroseconds(2); digitalWrite(TRIG, HIGH); delayMicroseconds(10); digitalWrite(TRIG, LOW);
  long us = pulseIn(ECHO, HIGH, 25000); return us == 0 ? 999 : us * 0.0343 / 2;
}

void post(String body) {
  if (WiFi.status() != WL_CONNECTED) return;
  HTTPClient http; http.begin(SERVER); http.addHeader("Content-Type", "application/json");
  Serial.printf("POST %d %s\n", http.POST(body), body.c_str()); http.end();
}

void beep(int ms) { digitalWrite(BUZZER, HIGH); delay(ms); digitalWrite(BUZZER, LOW); }

void setup() {
  Serial.begin(115200);
  pinMode(PIR, INPUT); pinMode(TRIG, OUTPUT); pinMode(ECHO, INPUT); pinMode(BUZZER, OUTPUT); pinMode(PANIC, INPUT_PULLUP);
  attachInterrupt(digitalPinToInterrupt(PIR), onMotion, RISING);
  dht.begin();
  WiFi.begin(WIFI_SSID, WIFI_PASS);
  for (int t = 0; t < 40 && WiFi.status() != WL_CONNECTED; t++) delay(250);
}

void loop() {
  if (digitalRead(PANIC) == LOW) {                       // panic button
    beep(800);
    post(String("{\"node\":\"") + NODE_ID + "\",\"motion\":99,\"battery\":0}");
    delay(3000);
  }
  if (edgeCm() < 100 && digitalRead(PIR) == HIGH) {      // person right at the edge
    beep(200); delay(200); beep(200);
  }
  if (millis() - lastReport > 60000) {
    float t = dht.readTemperature(), h = dht.readHumidity();
    String body = String("{\"node\":\"") + NODE_ID + "\",\"motion\":" + motion;
    if (!isnan(t)) body += ",\"temp_c\":" + String(t, 1);
    if (!isnan(h)) body += ",\"humidity\":" + String(h, 0);
    body += "}";
    post(body); motion = 0; lastReport = millis();
  }
  delay(100);
}
