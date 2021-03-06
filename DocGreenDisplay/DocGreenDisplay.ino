#include <Arduino.h>
#include <stdint.h>

#include "config.h"
#include "state.hpp"
#include "protocol.h"

#include "wifi.hpp"
#include "oled-ui.hpp"
#include "reenable-light.hpp"
#include "webserver.hpp"
#include "bluetooth.hpp"
#include "update.hpp"

Preferences preferences;

docgreen_status_t scooterStatus = {
	.enableStatsRequests = true,
};

bool lightPinStatus = false;

void setup()
{
#ifdef ARDUINO_ARCH_ESP32
	ScooterSerial.begin(115200, SERIAL_8N1, 27, 26);

	analogReadResolution(10);
	analogSetAttenuation(ADC_11db);
#else
	ScooterSerial.begin(115200);
#endif

	pinMode(MECHANICAL_BRAKE_PIN, INPUT);
	preferences.begin("scooter", false);

	pinMode(LED_MOSFET_PIN, OUTPUT);
	digitalWrite(LED_MOSFET_PIN, LOW);

	wifiSetup();
	initializeOledUi();
	webServerSetup();
	bluetoothSetup();

	if(wifiApEnabled || wifiStaEnabled)
	{
		MDNS.begin(MDNS_DOMAIN_NAME); // TODO allow the user to configure this?
		MDNS.addService("http", "tcp", 80);
	}

	if(wifiStaEnabled)
		configTime(0, 0, NTP_SERVER_1, NTP_SERVER_2, NTP_SERVER_3);

	configuredSpeed = preferences.getUChar(PREFERENCE_MAX_SPEED, 20);
	if(configuredSpeed != 20)
	{
		// send default max speed 3 times, to make sure the packet isn't lost
		setMaxSpeed(configuredSpeed);
		setMaxSpeed(configuredSpeed);
		setMaxSpeed(configuredSpeed);
	}

	if(preferences.getUChar(PREFERENCE_REENABLE_LIGHT, 0))
		reenableLightsAfterError = true;

	setupFirmwareUpdate();
}

void loop()
{
	static uint32_t lastTransmit = 0;
	uint32_t now = millis();
	if(now - lastTransmit > TRANSMIT_INTERVAL)
	{
		uint16_t throttle = analogRead(THROTTLE_PIN);
		uint16_t brake = analogRead(BRAKE_PIN);
		bool brakeLever = digitalRead(MECHANICAL_BRAKE_PIN) == HIGH;

		if(throttle < THROTTLE_READ_MIN)
			throttle = THROTTLE_READ_MIN;
		if(throttle > THROTTLE_READ_MAX)
			throttle = THROTTLE_READ_MAX;
		if(brake < BRAKE_READ_MIN)
			brake = BRAKE_READ_MIN;
		if(brake > BRAKE_READ_MAX)
			brake = BRAKE_READ_MAX;

		detectButtonPress(throttle, brake, brakeLever);

		if(brakeLever)
		{
			throttle = THROTTLE_READ_MIN;

			// XXX: in the orginal configuration pulling the mechanical brake
			// lever makes the scooter brake with the maximum power on the
			// electrical brake, however that feels very harsh and dangerous
			uint16_t minBrake = map(40, 0, 100, BRAKE_READ_MIN, BRAKE_READ_MAX);

			// allow the user to manually brake >40%
			if(minBrake > brake)
				brake = minBrake;
		}

		throttle = map(throttle, THROTTLE_READ_MIN, THROTTLE_READ_MAX, THROTTLE_MIN, THROTTLE_MAX);
		brake = map(brake, BRAKE_READ_MIN, BRAKE_READ_MAX, BRAKE_MIN, BRAKE_MAX);

		scooterStatus.throttle = throttle;
		scooterStatus.brake = brake;
		transmitInputInfo(scooterStatus);
		lastTransmit = now;
	}

	if(ScooterSerial.available() && receivePacket(&scooterStatus))
	{
		static bool hadButton = false;
		if(scooterStatus.buttonPress)
		{
			hadButton = true;
		}
		else if(hadButton)
		{
			hadButton = false;
			pressedButtons |= BUTTON_POWER;
		}

		if(scooterStatus.lights != lightPinStatus)
		{
			lightPinStatus = scooterStatus.lights;
			digitalWrite(LED_MOSFET_PIN, lightPinStatus ? HIGH : LOW);
		}

		reenableLightLoop(scooterStatus);

		// TODO do this more often?
		// not only after a packet from the motor controller was received?
		updateOledUi(scooterStatus);
		bluetoothLoop(scooterStatus);
	}

	webServerLoop();
	delay(1);
}
