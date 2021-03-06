var isLightOn = false;
var isEcoModeOn = false;
var isLockOn = false;

var statusSpanTimeout = 0;

function handleError(err)
{
	console.error(err);
	/* TODO: show to user */
}

document.body.onload = function()
{
	var size = window.screen.width;
	if(size > 400)
		size = 400;

	var speedGauge = new RadialGauge({
		renderTo: 'speed-gauge',
		width: size,
		height: size,
		units: 'km/h',

		title: false,
		borders: false,
		colorPlate: 'rgba(255, 255, 255, 0)',
		animationRule: 'linear',
		animationDuration: 200,

		value: 0,
		valueBox: false,
		minValue: 0,
		maxValue: 35,

		startAngle: 0,
		ticksAngle: 180,

		majorTicks: [
			'0','5','10','15','20','25','30','35'
		],
		minorTicks: 5,
		strokeTicks: false,
		highlights: [
			{ from: 20, to: 35, color: 'rgba(255,0,0,.5)' }
		],

		colorNeedle: '#f00',
		colorNeedleEnd: '#f00',
		needleShadow: false,
	});

	var batteryGauge = new RadialGauge({
		renderTo: 'battery-gauge',
		width: size,
		height: size,

		title: false,
		borders: false,

		value: 0,
		valueBox: false,
		minValue: 0,
		maxValue: 100,

		startAngle: 280,
		ticksAngle: 70,

		majorTicks: [
			'100','80','60','40','20','0',
		],
		minTicks: 1,
		highlights: [
			{ from: 00, to: 20, color: 'rgba(0,255,0,.5)' },
			{ from: 20, to: 40, color: 'rgba(0,255,0,.4)' },
			{ from: 40, to: 60, color: 'rgba(0,255,0,.3)' },
			{ from: 60, to: 80, color: 'rgba(0,255,0,.2)' },
			{ from: 80, to: 100, color: 'rgba(0,255,0,.1)' },
		],
		colorPlate: 'rgba(255, 255, 255, 0)',
		animationRule: 'linear',
		animationDuration: 0,

		needleType: 'line',
		needleWidth: 2,
		needleStart: 75,
		needleEnd: 90,
		colorNeedle: '#00f',
		colorNeedleEnd: '#00f',
		needleShadow: false,

		barStartPosition: 'right',
	});

	var accelerationGauge = new RadialGauge({
		renderTo: 'acceleration-gauge',
		width: size,
		height: size,

		title: false,
		borders: false,

		value: 0,
		valueBox: false,
		minValue: -1,
		maxValue: 1,

		startAngle: 190,
		ticksAngle: 80,

		majorTicks: [
			'1','0.5','0','-0.5','-1',
		],
		minTicks: 3,
		highlights: [
			{ from: 0, to: 1, color: 'rgba(0,255,0,.5)' },
			{ from: -1, to: 0, color: 'rgba(255,0,0,.5)' },
		],
		colorPlate: 'rgba(255, 255, 255, 0)',
		animationRule: 'linear',
		animationDuration: 200,

		needleType: 'line',
		needleWidth: 2,
		needleStart: 75,
		needleEnd: 90,
		colorNeedle: '#00f',
		colorNeedleEnd: '#00f',
		needleShadow: false,

		barStartPosition: 'right',
	});

	function updateData()
	{
		return fetch('/data')
			.then(res => res.json())
			.then(data => {

				if(statusSpanTimeout > 0)
				{
					statusSpanTimeout--;
				}
				else
				{
					isLightOn = !!data.lights;
					isEcoModeOn = !!data.ecoMode;
					isLockOn = !!data.isLocked;

					updateStatusSpan("light-status", isLightOn);
					updateStatusSpan("eco-status", isEcoModeOn);
					updateStatusSpan("lock-status", isLockOn);
				}

				speedGauge.value = data.speed / 1000;
				batteryGauge.value = data.soc;

				var throttle = data.throttle;
				var brake = data.brake;
				if(brake > throttle)
					accelerationGauge.value = -1 * (brake - 0x2C) / (0xB5 - 0x2C);
				else
					accelerationGauge.value = (throttle - 0x2C) / (0xC5 - 0x2C);

				for(var key in data)
				{
					var el = document.getElementById("stat-" + key);
					if(!el)
						continue;

					var val = data[key];
					if(el.dataset.scale == "time")
						val = `${val / (60 * 60) | 0}h ${(val / 60) % 60 | 0}min ${val % 60}s`;
					else if(!isNaN(el.dataset.scale))
						val = val * parseFloat(el.dataset.scale);

					el.innerText = val;
				}

			})
			.catch(handleError)
			.then(() => setTimeout(updateData, 200));
	}

	speedGauge.draw();
	batteryGauge.draw();
	accelerationGauge.draw();

	updateData()
		.then(() => updateConfig());
};

function updateStatusSpan(id, status)
{
	var el = document.getElementById(id);
	el.innerText = status ? "ON" : "OFF";
}

function updateReadablePin()
{
	var readable = ["up", "right", "down", "left", "cancel", "power"];
	var pin = document.getElementById("config-lock-pin").value;
	var el = document.getElementById("readable-pin");

	var readblePin = [];
	for(var i = 0; i < pin.length; i++)
	{
		var curr = pin.charCodeAt(i) - "0".charCodeAt(0);
		if(curr < 0 || curr > readable.length)
		{
			el.innerText = "invalid";
			return;
		}

		readblePin.push(readable[curr]);
	}

	el.innerText = readblePin.join(", ");
}

function updateConfig()
{
	return fetch('/config')
		.then(res => res.json())
		.then(config => {

			for(var key in config)
			{
				var el = document.getElementById("config-" + key);
				if(el.type === "checkbox")
					el.checked = !!config[key];
				else
					el.value = config[key];
			}

			if(config.hasOwnProperty("lock-pin"))
				updateReadablePin();

		})
		.catch(err => {
			handleError(err);
			setTimeout(updateConfig, 500);
		});
}

function saveConfig()
{
	var status = document.getElementById("save-status");
	status.innerText = "saving...";

	var fields = document.querySelectorAll('*[id^="config-"]');
	var params = new URLSearchParams();


	for(var field of fields)
	{
		var name = field.id.substr("config-".length);
		var value;
		if(field.type == "checkbox")
			value = field.checked.toString();
		else
			value = field.value;

		params.append(name, value);
	}

	fetch("/updateConfig", {
		method: 'POST',
		body: params,
	})
		.then(res => res.ok
			? Promise.resolve()
			: Promise.reject(new Error('non 200 response code'))
		)
		.then(() => status.innerText = "success")
		.then(updateConfig)
		.catch(err => {
			status.innerText = "failed";
			handleError(err);
		});
}

function doAction(name, value)
{
	fetch("/action/" + name + "/" + value)
		.catch(handleError);
}

function toggleLight()
{
	doAction("setLight", !isLightOn);
	updateStatusSpan("light-status", !isLightOn);
	statusSpanTimeout = 3;
}
function toggleEcoMode()
{
	doAction("setEcoMode", !isEcoModeOn);
	updateStatusSpan("eco-status", !isEcoModeOn);
	statusSpanTimeout = 3;
}
function toggleLock()
{
	doAction("setLock", !isLockOn);
	updateStatusSpan("lock-status", !isLockOn);
	statusSpanTimeout = 3;
}

function startFirmwareUpdate()
{
	if(!confirm("The Scooter will become unresponsive until the update is finished!"))
		return;

	fetch("/updateFirmware")
		.then(() => document.getElementById("stat-updateStatus").innerText = "running...")
		.catch(handleError)
}
