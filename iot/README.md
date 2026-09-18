# IoT: parking and safety nodes

The project runs without hardware, because `simulator.py` streams realistic readings. If you add an
ESP32 before the demo, a physical 4-slot parking model on the table is the most memorable thing
judges can touch.

## Shopping list (≈ ₹900–1,400)

| Part | Qty | Approx. |
|---|---|---|
| ESP32 DevKit (WROOM-32) | 1 | ₹400 |
| HC-SR04 ultrasonic sensor | 4 | ₹60 each |
| Red + green 5 mm LEDs, 220 Ω resistors | 4 + 4 | ₹40 |
| 1 kΩ + 2 kΩ resistors (echo voltage divider) | 4 + 4 | ₹20 |
| Breadboard + jumper wires | 1 set | ₹150 |
| Optional safety node: PIR HC-SR501, DHT22, buzzer, push button | 1 each | ₹350 |

## Parking model (cardboard, 4 slots)

1. Make 4 slots with cardboard walls; mount one HC-SR04 at the back of each slot, facing the entrance.
2. Wire per `parking_node/parking_node.ino` (TRIG 5/18/19/21, ECHO 34/35/32/33 through the divider).
3. Set `WIFI_SSID`, `WIFI_PASS`, and `SERVER` (the laptop IP that `python -m server` prints).
4. Flash from Arduino IDE (board: *ESP32 Dev Module*). Put a toy car in a slot: its LED turns red,
   and within seconds the command centre's IoT panel and the app's parking count change.

## Without hardware

```bash
python iot/simulator.py            # normal
python iot/simulator.py --fault    # a sensor gets stuck at 0 -> the server's anomaly detector raises an alert
python iot/simulator.py --heat     # 41 °C -> heat alert
```
